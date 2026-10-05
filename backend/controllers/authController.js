/**
 * Authentication Controller
 * Implements secure JWT authentication with refresh token rotation
 */

const jwt = require('jsonwebtoken');
const { User, Profile, RefreshToken } = require('../models');
const { cleanName } = require('../constants/names');
const { sendWelcomeEmail, sendPasswordResetEmail, sendGoogleSignInHelpEmail, sendEmail, sendOtpEmail, sendSecurityAlert } = require('../utils/email');
const config = require('../config/env');
const { eraseAccount } = require('../utils/accountErasure');
const { createError, asyncHandler, AppError } = require('../middlewares/errorHandler');
const { recordFailedLogin, clearLoginAttempts, loginLookupKey } = require('../middlewares/security');
const { canonicalEmail, emailLookupCandidates } = require('../utils/emailAddress');
const { issueProof, consumeProof } = require('../utils/otpProof');
const otpStore = require('../utils/otpStore');
const { buildConsent, renewConsent, truthy } = require('../utils/consentRecord');
const { checkSecondFactor } = require('../utils/mfa');
const { buildMemberExport } = require('../utils/dataExport');
const { log, logSecurityEvent, logAudit } = require('../middlewares/logger');
const { OAuth2Client } = require('google-auth-library');
const smsService = require('../utils/smsService');
const { TERMS_VERSION, needsReconsent } = require('../constants/legal');
const { trackEvent } = require('../utils/trackEvent');
const { grantFoundingIfOpen } = require('../utils/foundingGrant');
const { resolveSignupAttribution, attributionUserFields, recordSignupAttribution, afterSignupAttribution } = require('../utils/signupAttribution');
const { getActiveSubscription } = require('../utils/entitlements');
const { spendEmailBudget } = require('../utils/emailBudget');
const { markSessionsRevoked } = require('../utils/sessionRevocation');

// Cookie configuration: Secure is UNCONDITIONAL in production. This used to be
// gated on FRONTEND_URL starting with 'https', with a `|| ''` fallback — so an
// unset or http FRONTEND_URL silently shipped the auth cookies without Secure,
// i.e. the failure mode was open. Production is HTTPS-only (env.js refuses to
// boot on a non-https FRONTEND_URL), so there is no legitimate prod case for a
// plaintext auth cookie. Dev stays off so http://localhost keeps working.
const useSecureCookies = config.isProduction;
const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: useSecureCookies,
  // 'strict' in production prevents CSRF via cross-site navigation.
  // 'lax' in dev allows port 3000 → 5001 cross-origin requests to carry cookies.
  sameSite: config.isProduction ? 'strict' : 'lax',
  maxAge,
  path: '/',
});

// Attach the derived AuthUser fields the clients (mobile RootNavigator + premium
// gates, web) expect but which aren't columns on Users: `subscriptionPlan` (from the
// active subscription, else 'free') and `onboardingComplete` (the user has filled the
// Step-1 basics). Kept in one place so login/signup/getMe stay in sync.
const withDerivedUserFields = async (userInstance) => {
  const user = userInstance.toJSON();
  // Whether the member can re-authenticate with a password. Members who signed
  // up with Google have none and must confirm sensitive actions (account
  // deletion) with a fresh Google credential instead. Only stated when the
  // column was actually loaded: `undefined` means "unknown", never "no password".
  if (userInstance.password !== undefined) user.hasPassword = Boolean(userInstance.password);
  // Read through utils/entitlements — the SAME query every gate uses, including
  // its endDate predicate. Filtering on `status:'active'` alone (what this did
  // until 2026-08-10) meant that between a subscription's expiry and the hourly
  // Bull sweep that flips the row to 'expired', /auth/me reported the member as
  // premium while every actual gate 403'd; if Redis is down the sweep never
  // runs at all. The sweep is cleanup, not correctness.
  const activeSub = await getActiveSubscription(user.id);
  user.subscriptionPlan = activeSub?.planType || 'free';
  // True when the Terms have moved on since the version this member accepted.
  // Clients block the app behind an accept screen; the server enforces it too
  // (middlewares/auth.js).
  user.requiresReconsent = needsReconsent(userInstance);
  user.currentTermsVersion = TERMS_VERSION;
  const profile = user.Profile;
  // Authoritative flag persisted on the profile: set at signup for web (full profile
  // collected first), at the end of onboarding Step 14 for mobile. The migration
  // backfilled every pre-existing row to true, so the column is always populated.
  user.onboardingComplete = Boolean(profile && profile.onboardingComplete);
  // Server-owned feature flags. The client branches on THIS and never on a
  // VITE_/EXPO_PUBLIC_ build var: a build-baked copy drifts from the server and
  // ends up advertising premium chat that is actually free (or the reverse).
  const foundingOpen = require('../utils/launchOffer').getFoundingState().open;
  user.features = {
    freeChatForMutuals: config.features.freeChatForMutuals,
    freeReplyWindow: config.features.freeReplyWindow,
    astrologerMarketplace: config.features.astrologerMarketplace,
    foundingOpen,
    // Server-decided, because the three conditions live in three different
    // places (the offer window, a User column, the entitlement query) and a
    // client that assembled them itself would offer a "Claim" button that
    // 409s. Mirrors the gates in subscriptionController.claimFounding.
    canClaimFounding: foundingOpen && !user.isFoundingMember && !activeSub,
    // Contact unlocks each side of an accepted invite receives. Lives here so a
    // surface can make the claim WITHOUT calling /invite/my-link, which mints a
    // token as a side effect — an invite card that renders for everyone must
    // not mint a token for everyone. 0 means the reward is off.
    inviteRewardUnlocks: require('../utils/inviteReward').INVITE_REWARD_UNLOCKS(),
  };
  // Admin permission scopes, resolved server-side. The panel uses them to hide
  // nav a scoped sub-admin cannot open; every admin route re-checks them, so
  // this is presentation only. Absent (undefined) for ordinary members.
  const { ADMIN_ROLES, scopesFor } = require('../constants/adminScopes');
  if (ADMIN_ROLES.includes(user.role)) {
    user.adminScopes = scopesFor(user);
  }
  return user;
};

/**
 * Generate a short-lived access token.
 *
 * `sid` is the id of the RefreshToken row this access token was issued
 * alongside — i.e. which session (device) is holding it. It exists so
 * `GET /auth/sessions` can mark "this device" for clients that have no
 * cookies: the web reads the refreshToken cookie and hashes it, but a native
 * client has no cookie to read and must not put its refresh token in a URL
 * (SEC-1). Without it the phone shows a session list with nothing marked
 * current, and revoking "the unfamiliar one" signs you out of the device
 * you're holding.
 *
 * The claim is optional. Tokens minted before this existed simply omit it and
 * fall back to the cookie path.
 */
const generateAccessToken = (userId, sessionId = null) => {
  return jwt.sign(
    sessionId ? { userId, type: 'access', sid: sessionId } : { userId, type: 'access' },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiry }
  );
};

/**
 * Create a refresh-token row and return both the plaintext token (for the
 * client) and its row id (to stamp into the paired access token).
 *
 * Rotation creates a new row, so the id changes on every refresh — session
 * identity across rotations is `family`, but only one un-revoked row per
 * family is ever live, so the id identifies the live session exactly.
 */
const generateRefreshToken = async (userId, userAgent, ipAddress, existingFamily = null) => {
  const token = RefreshToken.generateToken();
  const expiresAt = new Date(Date.now() + parseDuration(config.auth.refreshTokenExpiry));

  const row = await RefreshToken.create({
    userId,
    // The raw token is deliberately NOT persisted -- only its hash, which is
    // the only thing any lookup uses. It is returned to the caller below and
    // lives solely in the client's httpOnly cookie from there.
    tokenHash: RefreshToken.hashToken(token),
    family: existingFamily || require('crypto').randomUUID(),
    expiresAt,
    userAgent: userAgent?.substring(0, 500),
    ipAddress,
  });

  return { token, sessionId: row.id };
};

/**
 * Tell the member when their account is signed in from a device it has not been
 * used from before (audit P2). Best-effort and off the request path: a mail or
 * lookup failure must never fail or slow a sign-in. The first-ever sign-in is
 * not "new" (see utils/deviceRecognition).
 */
const alertIfNewDevice = (req, user, sessionId) => {
  const userAgent = req.headers['user-agent'];
  const ip = req.clientIp || req.ip;
  setImmediate(async () => {
    try {
      const { isNewDevice, describeDevice, maskIp } = require('../utils/deviceRecognition');
      if (!(await isNewDevice(RefreshToken, { userId: user.id, sessionId, userAgent }))) return;
      const device = describeDevice(userAgent).label;
      const where = maskIp(ip);
      const detail = `Your account was signed in to from ${device}${where ? ` (network ${where})` : ''}, a device we have not seen before.`;
      const { notify } = require('../utils/notifyUser');
      await notify(user.id, 'system', 'New sign-in to your account', `${device}. If this was not you, change your password and sign out other devices in Settings.`);
      if (user.email) {
        await sendSecurityAlert(user.email, '', 'New sign-in', detail, new Date().toUTCString());
      }
    } catch (error) {
      log.warn('New-device alert failed', { userId: user.id, error: error.message });
    }
  });
};

// Parse duration string (e.g., '7d', '1h', '30m') to milliseconds
const parseDuration = (duration) => {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  return parseInt(match[1]) * units[match[2]];
};

// Set auth cookies
const setAuthCookies = (res, accessToken, refreshToken) => {
  const accessMaxAge = parseDuration(config.auth.jwtExpiry);
  const refreshMaxAge = parseDuration(config.auth.refreshTokenExpiry);
  
  res.cookie('accessToken', accessToken, getCookieOptions(accessMaxAge));
  res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMaxAge));
};

// Clear auth cookies
const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
};

/**
 * Find the account for an email address under any form it may be stored in:
 * the address as typed (canonical), then the form older signups stored after
 * Gmail dot/+tag stripping. Canonical wins if both exist.
 */
const findUserByEmail = async (email, options = {}) => {
  for (const candidate of emailLookupCandidates(email)) {
    const found = await User.findOne({ ...options, where: { ...(options.where || {}), email: candidate } });
    if (found) return found;
  }
  return null;
};

// Login answers "unknown account" and "wrong password" with one message, but a
// real account ran a ~200ms bcrypt compare while an unknown / Google-only
// identifier returned in ~1ms: the clock told an attacker which accounts exist.
// Spend the same work on the miss branches against a throwaway hash.
let dummyHash = null;
const burnPasswordCheck = async (candidate) => {
  const bcrypt = require('bcryptjs');
  if (!dummyHash) dummyHash = await bcrypt.hash('timing-equaliser-not-a-password', config.auth.bcryptRounds);
  await bcrypt.compare(typeof candidate === 'string' ? candidate : '', dummyHash);
};

/**
 * Revoke every refresh token except the session making this request. The access
 * token's `sid` claim identifies it directly; the cookie (web) or an explicitly
 * posted refresh token are the fallbacks for tokens minted before the claim
 * existed. If none of the three resolve we revoke nothing rather than
 * everything -- signing the member out of the device they are standing on is a
 * worse failure than leaving a stale session, and they can still use "log out
 * everywhere".
 */
const revokeOtherSessions = async (req, userId, reason) => {
  const Op = require('sequelize').Op;
  let keep = null;
  if (req.sessionId) {
    keep = { id: { [Op.ne]: req.sessionId } };
  } else {
    const currentRefreshToken = req.cookies?.refreshToken || req.body.currentRefreshToken;
    if (currentRefreshToken) {
      keep = { tokenHash: { [Op.ne]: RefreshToken.hashToken(currentRefreshToken) } };
    }
  }
  if (keep) {
    const live = await RefreshToken.findAll({ where: { userId, isRevoked: false, ...keep }, attributes: ['id', 'family'] });
    await RefreshToken.update(
      { isRevoked: true, revokedAt: new Date(), revokedReason: reason },
      { where: { userId, ...keep } }
    );
    // Their access tokens die with them (AUTH-05); the session making this
    // request is not in `live`, so it carries on.
    await markSessionsRevoked(await RefreshToken.sessionIdsOfFamilies([...new Set(live.map((r) => r.family))], live.map((r) => r.id)));
  }
};

// Security notice by mail. Never throws, never blocks.
const notifySecurityChange = (user, title, detail, toEmail = user.email) => {
  setImmediate(async () => {
    try {
      if (toEmail) await sendSecurityAlert(toEmail, user.firstName || '', title, detail, new Date().toUTCString());
    } catch (error) {
      log.warn('Security notice not sent', { userId: user.id, error: error.message });
    }
  });
};

// A reset link is bound to the address it was mailed to: once the member's
// email changes, links already sitting in the OLD inbox stop working.
const emailFingerprint = (email) => require('crypto')
  .createHash('sha256').update(String(email || '').toLowerCase()).digest('hex').substring(0, 16);

/**
 * Forget every failed-login counter for this member, under each key a login
 * could have been recorded against (the mailbox identity, and the phone as
 * typed in any of its common forms). Called after a successful password reset:
 * the member has just proved ownership, so a lockout earned with the OLD
 * password must not keep refusing the new, correct one.
 */
const clearAllLoginLocks = async (user) => {
  const keys = new Set();
  if (user.email) keys.add(loginLookupKey({ identifier: user.email }));
  if (user.phone) {
    keys.add(String(user.phone));
    phoneVariants(toPhone10(user.phone)).forEach((v) => keys.add(v));
  }
  await Promise.all([...keys].filter(Boolean).map((k) => clearLoginAttempts(k).catch(() => {})));
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
exports.signup = asyncHandler(async (req, res) => {
  const { email, password, phone, firstName, lastName, gender, dateOfBirth, referralCode, creatingFor } = req.body;
  const marketingConsent = truthy(req.body.marketingConsent);
  const subjectAttested = truthy(req.body.subjectAttestation);
  const codeFromQuery = req.query.ref || req.body.ref;
  // Member invite (Phase S) — a DIFFERENT param from the marketing `ref` above.
  // Both may be present on one signup and are honoured independently.
  const inviteFromRequest = req.body.invite || req.query.invite;

  // Flexible auth: account is identified by EITHER an email OR a phone number.
  const normalizedEmail = email ? canonicalEmail(email) : null;
  const normalizedPhone = phone ? String(phone).trim() : null;
  if (!normalizedEmail && !normalizedPhone) {
    throw createError.badRequest('An email address or phone number is required');
  }

  // A profile made on someone else's behalf needs the operator to attest, in the
  // request, that the person is of legal age and knows about and agrees to it.
  // The Terms say so; this is the record that it was asserted.
  if (creatingFor && creatingFor !== 'self' && !subjectAttested) {
    throw createError.badRequest('Please confirm the person this profile is for is of legal age and agrees to it');
  }

  // Proof FIRST, existence second (AUTH-01). This used to answer 409 "account
  // already exists" before looking at any proof, so an anonymous caller could
  // ask about any email or number for free, bypassing send-otp's limits. Now an
  // unproven caller only ever sees the same generic 400; the 409 is for someone
  // who demonstrated they control the contact. A contact counts as verified only when the caller presents the single-use
  // proof verify-otp handed back for it (bound to whoever entered the code).
  // No client is exempt: every account starts with at least one proven contact,
  // so nobody can register an address or number they do not control.
  let emailWasVerified = false;
  let phoneWasVerified = false;
  try {
    if (normalizedEmail) {
      emailWasVerified = await consumeProof('email', normalizedEmail, req.body.emailProof);
    }
    if (normalizedPhone) {
      phoneWasVerified = await consumeProof('phone', smsService.normalizePhone(normalizedPhone), req.body.phoneProof);
    }
  } catch (err) {
    log.warn('Signup proof check failed', { error: err.message });
  }

  if (!emailWasVerified && !phoneWasVerified) {
    throw createError.badRequest('Please verify your email or mobile number to create your account.');
  }

  // Only a contact the caller PROVED is stored (AUTH-03). A typed-but-unproved
  // email or number is dropped: stored, it would lock the real owner out of
  // signing up (the send-otp "already exists" gate), receive our mail, and be
  // usable for password reset by whoever typed it. It can be added later
  // through the verified change-email / contact-number flows. Existence is
  // likewise answered only for what was proved, so this cannot be probed.
  const emailToStore = emailWasVerified ? normalizedEmail : null;
  const phoneToStore = phoneWasVerified ? normalizedPhone : null;

  // Check if user already exists (by whichever identifier was proved)
  if (emailToStore) {
    const existingByEmail = await findUserByEmail(emailToStore, { attributes: ['id'] });
    if (existingByEmail) throw createError.conflict('An account already exists with this email');
  }
  if (phoneToStore) {
    const existingByPhone = await User.findOne({ where: { phone: phoneToStore } });
    if (existingByPhone) throw createError.conflict('An account already exists with this phone number');
  }

  // Partner code, member code or invite, or a partner's hand-added lead.
  // Shared with Google signup (utils/signupAttribution) so both credit alike.
  const attribution = await resolveSignupAttribution({
    code: referralCode || codeFromQuery,
    invite: inviteFromRequest,
    phone: phoneToStore,
    email: emailToStore,
  });

  const sequelize = require('../config/database');
  let result;
  try {
    result = await sequelize.transaction(async (t) => {
      const user = await User.create({
        email: emailToStore,
        password,
        phone: phoneToStore,
        status: 'active',
        emailVerified: emailWasVerified,
        phoneVerified: phoneWasVerified,
        // Consent record (DPDP): signup is unreachable without ticking the
        // Terms + Privacy checkbox, so account creation IS the acceptance.
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        consent: buildConsent(req, { marketing: marketingConsent, createdFor: req.body.relationshipToProfile || creatingFor, subjectAttested }),
        // Promotional email is a separate, optional choice. Unticked means opted
        // out from the start, using the same switch the unsubscribe link flips
        // (a member can turn it back on from the link or their account).
        ...(marketingConsent ? {} : { lifecycleMail: { emailOptOut: new Date().toISOString() } }),
        ...attributionUserFields(attribution),
      }, { transaction: t });

      // Leave gender/dateOfBirth NULL when not supplied so a mobile account
      // (email+password only) doesn't pre-fill onboarding Step 1 with placeholders.
      // Web sends the full profile at signup, so it's onboarded immediately.
      const profileDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      const onboardedAtSignup = Boolean(firstName && gender && dateOfBirth);
      await Profile.create({
        userId: user.id,
        // Name is optional at signup; Profile.firstName/lastName are NOT NULL → '' .
        firstName: firstName || '',
        lastName: lastName || '',
        gender: gender || null,
        dateOfBirth: profileDateOfBirth,
        onboardingComplete: onboardedAtSignup
      }, { transaction: t });

      await recordSignupAttribution(t, user, attribution, {
        name: [firstName, lastName].filter(Boolean).join(' '),
        phone: phoneToStore,
        email: emailToStore,
      });

      return user;
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw createError.conflict('An account already exists with this email or phone number');
    }
    log.error('Signup transaction failed', { error: err.message, stack: err.stack });
    throw createError.badRequest('Unable to create account. Please try again.');
  }

  // Funnel stage 3 — account-bound, so the partial unique index makes it
  // once-per-user on its own. Fire-and-forget: never awaited.
  trackEvent(result.id, 'account_created');
  // Reward BOTH sides of an invite. Outside the transaction (a failed reward
  // must not cost anyone their account); awaited so the founding grant below
  // sees any credit that landed as pending.
  await afterSignupAttribution(result.id, attribution);

  // Founding-member grant (Phase S). Deliberately OUTSIDE the signup
  // transaction: any error raised inside a Postgres transaction poisons it, so
  // a failed grant in there would abort an otherwise-good signup at COMMIT —
  // exactly the outcome grantFoundingIfOpen's swallow-everything contract
  // exists to prevent. Awaited (not fire-and-forget) so the response below
  // already reflects the granted plan in `subscriptionPlan`.
  // This is the ONLY grant point for email signup, and it covers the guardian
  // `create_for_other` flow too — that flow has no endpoint of its own, it
  // posts to this same POST /auth/signup.
  await grantFoundingIfOpen(result.id);

  // Send welcome email (non-blocking) — only when the account has an email
  if (result.email) {
    setImmediate(() => {
      sendWelcomeEmail(result.email, firstName || 'there')
        .catch(err => log.error('Failed to send welcome email', { error: err.message, userId: result.id }));
    });
  }

  // Guardian invites sent to this address before the account existed are now
  // visible to it — say so (only when the address was proved at signup).
  setImmediate(() => { require('../utils/guardianInvites').noticeInvitesOnJoin(result); });

  // Generate tokens — the refresh row first, so the access token can carry its id.
  const { token: refreshToken, sessionId } = await generateRefreshToken(
    result.id,
    req.headers['user-agent'],
    req.clientIp || req.ip
  );
  const accessToken = generateAccessToken(result.id, sessionId);

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken);

  // FE-2: return the full user (with Profile) so the client can skip the
  // follow-up /auth/me round-trip. Mirrors getMe's shape.
  const fullUser = await User.findByPk(result.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    user: await withDerivedUserFields(fullUser),
    // Tokens returned for non-cookie (native) clients; both are also set as
    // httpOnly cookies for the web client.
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.auth.jwtExpiry
    }
  });
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  // Flexible auth: `identifier` may be an email or a phone. `email` kept for
  // backward compatibility with older clients.
  const rawIdentifier = (req.body.identifier ?? req.body.email ?? '').toString().trim();
  const { password } = req.body;
  if (!rawIdentifier) {
    throw createError.badRequest('Email or phone number is required');
  }

  const isEmail = rawIdentifier.includes('@');
  // Shared with checkAccountLockout so the lockout gate keys off exactly what
  // we record failures against (see loginLookupKey in middlewares/security).
  const lookupKey = loginLookupKey(req.body);
  // Email: lookupKey is the lockout identity (variants collapsed), NOT what is
  // stored — look the account up under every form it may be stored in.
  const user = isEmail
    ? await findUserByEmail(rawIdentifier)
    : await User.findOne({ where: { phone: lookupKey } });
  if (!user) {
    await burnPasswordCheck(password);
    await recordFailedLogin(lookupKey);
    throw createError.unauthorized('Invalid credentials');
  }

  // OAuth-only accounts have no password set.
  //
  // This branch used to name the auth method, and it fires BEFORE any password
  // check — so it confirmed both that the account exists and how it signs in,
  // to an unauthenticated caller, for free. The two branches around it were
  // deliberately given one constant message for exactly this reason; this one
  // undercut them. Return the same constant message and count the attempt so
  // lockout applies. (UX tradeoff: a Google-only user who types a password now
  // sees a generic failure and must use the Google button, which is present on
  // the login page.)
  if (!user.password) {
    await burnPasswordCheck(password);
    await recordFailedLogin(lookupKey);
    throw createError.unauthorized('Invalid credentials');
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    // Record the attempt for lockout, but return a CONSTANT message identical to
    // the "user not found" branch above. The old "N attempts remaining" / "Account
    // locked" wording revealed whether the account existed (account enumeration,
    // M-3 2026-07-01). Lockout is still enforced server-side by checkAccountLockout.
    await recordFailedLogin(lookupKey);
    throw createError.unauthorized('Invalid credentials');
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw createError.forbidden('Account is not active. Please contact support.');
  }

  // Second factor. The password is already proven, so answering "a code is
  // needed" reveals nothing an attacker does not hold. A missing code is the
  // normal first step (not counted as a failure); a wrong one counts toward
  // lockout, which is what bounds guessing a 6-digit code.
  if (user.mfaEnabledAt) {
    const supplied = req.body.mfaCode;
    if (!supplied) throw createError.unauthorized('Enter the code from your authenticator app', 'MFA_REQUIRED');
    const factor = await checkSecondFactor(user, supplied);
    if (!factor.ok) {
      await recordFailedLogin(lookupKey);
      throw createError.unauthorized('That code is not right', 'INVALID_MFA_CODE');
    }
    if (factor.recoveryUsed) {
      user.mfaRecoveryHashes = (user.mfaRecoveryHashes || []).filter((h) => h !== factor.recoveryUsed);
      logSecurityEvent('mfa_recovery_code_used', req, { userId: user.id });
    }
  }

  // Clear failed login attempts on success
  await clearLoginAttempts(lookupKey);

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens — the refresh row first, so the access token can carry its id.
  const { token: refreshToken, sessionId } = await generateRefreshToken(
    user.id,
    req.headers['user-agent'],
    req.clientIp || req.ip
  );
  const accessToken = generateAccessToken(user.id, sessionId);
  alertIfNewDevice(req, user, sessionId);

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken);

  // FE-2: return the full user (with Profile) so the client doesn't need a second
  // /auth/me round-trip right after login. Mirrors getMe's shape.
  const fullUser = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });

  res.json({
    success: true,
    message: 'Login successful',
    user: await withDerivedUserFields(fullUser),
    // Tokens returned for non-cookie (native) clients; both are also set as
    // httpOnly cookies for the web client.
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.auth.jwtExpiry
    }
  });
});

// How long after a rotation the OLD refresh token is still honoured as an
// idempotent replay rather than treated as theft. Two tabs, a retried request
// after a dropped response, or a phone that was killed between receiving the
// new token and persisting it all present the old token a moment after it was
// rotated; treating that as reuse signed the legitimate member out of every
// device. Past this window a presented rotated token IS reuse and kills the
// family, exactly as before.
const REFRESH_REUSE_GRACE_MS = 30 * 1000;

/**
 * The successor of a rotated refresh token is DERIVED (HMAC of the old token's
 * hash under the server secret), not random. That makes rotation idempotent:
 * however many times, and in whatever order, the old token is presented inside
 * the grace window, every caller is handed the same successor and one live row
 * exists — no forked family, no second live token per device. Without the
 * server secret it is as unguessable as a random token.
 */
const successorTokenFor = (oldTokenHash) => require('crypto')
  .createHmac('sha512', config.auth.jwtSecret)
  .update(`refresh-successor:${oldTokenHash}`)
  .digest('hex'); // 128 hex chars, same shape as RefreshToken.generateToken()

const ensureSuccessor = async (old, req) => {
  const token = successorTokenFor(old.tokenHash);
  const tokenHash = RefreshToken.hashToken(token);
  let row = await RefreshToken.findOne({ where: { tokenHash } });
  if (!row) {
    try {
      row = await RefreshToken.create({
        userId: old.userId,
        tokenHash,
        family: old.family,
        expiresAt: new Date(Date.now() + parseDuration(config.auth.refreshTokenExpiry)),
        userAgent: req.headers['user-agent']?.substring(0, 500),
        ipAddress: req.clientIp || req.ip,
        // Stamped on the row that is actually live (it used to land on the
        // already-revoked old row, so a session list never showed activity).
        lastUsedAt: new Date(),
      });
    } catch (err) {
      // The concurrent winner/loser created it first: same token, same row.
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
      row = await RefreshToken.findOne({ where: { tokenHash } });
    }
  }
  return { token, row };
};

// Mint (or re-read) the successor of `old` and answer with it. Shared by the
// winning rotation and by an in-grace replay so both return an identical body.
const respondWithSuccessor = async (req, res, user, old) => {
  const { token: newRefreshToken, row } = await ensureSuccessor(old, req);
  const newAccessToken = generateAccessToken(user.id, row.id);

  // Set cookies
  setAuthCookies(res, newAccessToken, newRefreshToken);

  // Return the full user so native clients can restore their session on cold
  // start without a second /auth/me round-trip (mirrors login/getMe shape).
  const fullUser = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });

  res.json({
    success: true,
    message: 'Token refreshed',
    user: await withDerivedUserFields(fullUser),
    tokens: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.auth.jwtExpiry
    }
  });
};

// @route   POST /api/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public (with valid refresh token)
exports.refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or body
  const refreshTokenValue = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (!refreshTokenValue) {
    throw createError.unauthorized('Refresh token required');
  }

  const tokenHash = RefreshToken.hashToken(refreshTokenValue);
  let storedToken = await RefreshToken.findOne({ where: { tokenHash } });

  if (!storedToken) {
    clearAuthCookies(res);
    throw createError.unauthorized('Invalid refresh token');
  }

  const now = new Date();
  const isLive = !storedToken.isRevoked && storedToken.expiresAt > now;

  if (isLive) {
    // Check if user is still active
    const user = await User.findByPk(storedToken.userId);
    if (!user || user.status !== 'active') {
      await storedToken.revoke('user_inactive');
      clearAuthCookies(res);
      throw createError.unauthorized('User account is not active');
    }

    // Rotate: the claim is ONE conditional UPDATE, so of any number of
    // simultaneous refreshes with this token exactly one changes the row. The
    // old read-then-write let all of them through and forked the family.
    const [claimed] = await RefreshToken.update(
      { isRevoked: true, revokedAt: now, revokedReason: 'rotated' },
      { where: { id: storedToken.id, isRevoked: false } }
    );
    if (claimed === 1) {
      return respondWithSuccessor(req, res, user, storedToken);
    }
    // Lost the race: someone rotated it between our read and our claim. Fall
    // through with the fresh row and let the replay rules decide.
    storedToken = await RefreshToken.findOne({ where: { tokenHash } });
  }

  const justRotated = storedToken.revokedReason === 'rotated'
    && storedToken.revokedAt
    && now - new Date(storedToken.revokedAt) <= REFRESH_REUSE_GRACE_MS;
  if (justRotated) {
    // Idempotent replay inside the grace window: hand back the SAME successor.
    const user = await User.findByPk(storedToken.userId);
    if (!user || user.status !== 'active') {
      throw createError.unauthorized('User account is not active');
    }
    const { row } = await ensureSuccessor(storedToken, req);
    if (!row || row.isRevoked || row.expiresAt <= now) {
      // The session already moved on (rotated again, or signed out). The
      // holder of this stale token has nothing to resume, but this is not
      // theft and the live session's cookies must not be wiped.
      throw createError.unauthorized('Invalid refresh token');
    }
    return respondWithSuccessor(req, res, user, storedToken);
  }

  // A revoked/expired token presented outside the grace window: could be token
  // reuse. Revoke the whole family as a precaution.
  await RefreshToken.revokeFamily(storedToken.family, 'token_reuse_detected');
  log.security('token_reuse_detected', { userId: storedToken.userId, family: storedToken.family });
  clearAuthCookies(res);
  throw createError.unauthorized('Invalid refresh token');
});

// @route   POST /api/auth/logout
// @desc    Logout user (revoke current refresh token)
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  const refreshTokenValue = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (refreshTokenValue) {
    const tokenHash = RefreshToken.hashToken(refreshTokenValue);
    const storedToken = await RefreshToken.findOne({ where: { tokenHash } });
    if (storedToken) {
      await storedToken.revoke('logout');
    }
  }
  // Also end this request's own access token (a client may log out without the
  // refresh token to hand, e.g. after the cookie expired).
  if (req.sessionId) await markSessionsRevoked([req.sessionId]);

  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @route   POST /api/auth/logout-all
// @desc    Logout from all devices (revoke all refresh tokens)
// @access  Private
exports.logoutAll = asyncHandler(async (req, res) => {
  await RefreshToken.revokeAllUserTokens(req.user.id, 'logout_all_devices');
  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Logged out from all devices'
  });
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }]
  });

  if (!user) {
    throw createError.notFound('User not found');
  }

  res.json({
    success: true,
    user: await withDerivedUserFields(user)
  });
});

// The name lives on the Profile, not the User row: `user.firstName` was always
// undefined, so every reset mail opened "Hi User".
const memberFirstName = async (userId) => {
  try {
    const profile = await Profile.findOne({ where: { userId }, attributes: ['firstName'] });
    return profile?.firstName?.trim() || 'there';
  } catch {
    return 'there';
  }
};

// @route   POST /api/auth/forgot-password
// @desc    Initiate password reset
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = canonicalEmail(email);

  // Always respond with same message to prevent email enumeration
  const genericMessage = 'If the email exists, a reset link has been sent.';

  const user = await findUserByEmail(normalizedEmail);

  // A member with no password (Google-only), or whose address was never proved
  // while their PHONE was (the address was typed at signup beside the verified
  // number and could belong to anyone), has nothing to reset by mail: same generic answer as an unknown
  // address, so this cannot be used to tell them apart.
  // Legacy accounts that have no verified phone either keep their (only) mail
  // route, so nobody is locked out by this rule.
  const eligible = Boolean(user && user.password && (user.emailVerified || !user.phoneVerified));
  // Created with Google, so there is no password to reset. Saying nothing read
  // as "the email is broken"; the address is Google-verified, so tell its owner
  // how they actually sign in (nothing about the account changes).
  const googleOnly = Boolean(user && !user.password && user.googleId && user.emailVerified);

  // Both outcomes do the same synchronous work (sign a token) and neither waits
  // on mail delivery, so response time does not distinguish them either.
  // Generate reset token (short-lived, tied to current password so it's single-use)
  // Including a fingerprint of the current password hash invalidates the token
  // automatically once the password is changed.
  const pwdFingerprint = require('crypto')
    .createHash('sha256')
    .update(eligible ? user.password : 'no-such-account')
    .digest('hex')
    .substring(0, 16);
  const resetToken = jwt.sign(
    { userId: eligible ? user.id : '00000000-0000-0000-0000-000000000000', type: 'password_reset', pwdFp: pwdFingerprint, em: emailFingerprint(eligible ? user.email : '') },
    config.auth.jwtSecret,
    { expiresIn: config.auth.resetTokenExpiry }
  );

  if (eligible || googleOnly) {
    const resetUrl = `${config.server.frontendUrl}/reset-password?token=${resetToken}`;
    // Off the request path. A per-member budget (3/hour, shared machinery with
    // OTP mail) and the global daily ceiling both fail SILENTLY: the caller
    // gets the same generic answer, but cannot make us mail one inbox a
    // hundred times or drain the shared provider quota.
    setImmediate(async () => {
      try {
        await otpStore.spendSend('reset', user.id);
        if (!(await spendEmailBudget())) {
          log.warn('Password reset mail skipped: daily account-mail budget spent', { userId: user.id });
          return;
        }
        const name = await memberFirstName(user.id);
        if (eligible) {
          await sendPasswordResetEmail(user.email, name, resetUrl);
        } else {
          await sendGoogleSignInHelpEmail(user.email, name, `${config.server.frontendUrl}/login`);
        }
      } catch (error) {
        // Includes the 429 from an exhausted per-member budget.
        log.warn('Password reset email not sent', { error: error.message, userId: user.id, googleOnly });
      }
    });
  }

  res.json({
    success: true,
    message: genericMessage,
    // Include token in development for testing
    ...(config.isDevelopment && eligible ? { resetToken } : {})
  });
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    throw createError.badRequest('Invalid or expired reset token');
  }

  if (decoded.type !== 'password_reset') {
    throw createError.badRequest('Invalid reset token');
  }

  const user = await User.findByPk(decoded.userId);
  if (!user) {
    throw createError.notFound('User not found');
  }

  // Verify the password fingerprint matches — if the password has already been
  // changed (token used once, or reset via another path), reject the token.
  //
  // This used to be `if (decoded.pwdFp)`, so a token that simply OMITTED the
  // claim skipped the single-use check entirely and stayed valid for its full
  // hour, reusable any number of times. Absence of the claim is now fatal.
  if (!decoded.pwdFp) {
    throw createError.badRequest('Reset token is malformed or is no longer valid');
  }
  if (!user.password) {
    throw createError.badRequest('Reset token has already been used or is no longer valid');
  }
  const currentFp = require('crypto')
    .createHash('sha256')
    .update(user.password)
    .digest('hex')
    .substring(0, 16);
  // timingSafeEqual over equal-length hex; both sides are 16 chars by construction.
  const fpMatches = currentFp.length === decoded.pwdFp.length
    && require('crypto').timingSafeEqual(Buffer.from(currentFp), Buffer.from(decoded.pwdFp));
  if (!fpMatches) {
    throw createError.badRequest('Reset token has already been used or is no longer valid');
  }

  // Tokens minted before this claim existed (<= 1h old) carry no `em` and are
  // still honoured; a token that has one must match the CURRENT address.
  if (decoded.em && decoded.em !== emailFingerprint(user.email)) {
    throw createError.badRequest('Reset token has already been used or is no longer valid');
  }

  // Update password (will be hashed by model hook)
  user.password = password;
  await user.save();

  // Revoke all refresh tokens for security
  await RefreshToken.revokeAllUserTokens(user.id, 'password_reset');
  await clearAllLoginLocks(user);

  // Send security alert (password changed)
  try {
    await sendSecurityAlert(
      user.email,
      await memberFirstName(user.id),
      'Your password was changed',
      'Your TricityMatch account password was just changed.',
      new Date().toUTCString()
    );
  } catch (error) {
    log.error('Failed to send password change confirmation', { error: error.message, userId: user.id });
  }

  res.json({
    success: true,
    message: 'Password has been reset successfully. Please login with your new password.'
  });
});

// ── Phone-OTP password reset ──────────────────────────────────────────────────
// For accounts that were created with a mobile number and no verified email, the
// email link has nowhere to go: those members had no way back in. A one-time code
// texted to the number they verified stands in for the link.
//
// Narrow on purpose, because a phone number is a weaker proof than a mailbox
// (SIM swap): only ordinary members (never staff), only accounts that already
// have a password (a Google-only account must not gain a password because
// someone held its number), only a VERIFIED number, and only when there is no
// verified email that the normal flow could use instead. Every session is
// revoked on success and an email alert goes out if there is an address.
const PHONE_RESET_GENERIC = 'If a matching account can be reset by mobile, we sent a code to that number.';
const PHONE_RESET_BAD_CODE = 'That code is not right or has expired. Request a new one.';

const findPhoneResetCandidate = async (phone10) => {
  const { Op } = require('sequelize');
  if (!/^[6-9]\d{9}$/.test(phone10)) return null;
  const user = await User.findOne({ where: { phone: { [Op.in]: phoneVariants(phone10) } } });
  if (!user) return null;
  const eligible = user.status === 'active'
    && user.role === 'user'
    && Boolean(user.password)
    && user.phoneVerified
    && !(user.email && user.emailVerified);
  return eligible ? user : null;
};

// @route   POST /api/auth/forgot-password/phone
// @desc    Text a reset code to a verified mobile number (phone-only accounts)
// @access  Public
exports.forgotPasswordPhone = asyncHandler(async (req, res) => {
  const phone10 = toPhone10(req.body.phone);
  const user = await findPhoneResetCandidate(phone10);

  if (user) {
    try {
      await smsService.sendOtp(phone10);
    } catch (error) {
      // Budget spent, provider down: the caller must not be able to tell this
      // apart from "no such account", so it is logged and answered the same.
      log.warn('Phone reset code not sent', { userId: user.id, error: error.message });
    }
  } else {
    // Match the time an eligible request spends, so timing does not answer either.
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 100));
  }
  res.json({ success: true, message: PHONE_RESET_GENERIC });
});

// @route   POST /api/auth/reset-password/phone
// @desc    Set a new password with the texted code
// @access  Public
exports.resetPasswordPhone = asyncHandler(async (req, res) => {
  const phone10 = toPhone10(req.body.phone);
  const { code, password } = req.body;

  const user = await findPhoneResetCandidate(phone10);
  // One answer for every failure (no such account, ineligible, wrong or expired
  // code). Only a real, eligible account has a code stored, so distinguishing
  // "invalid" from "expired or not sent" would reveal which numbers are members.
  if (!user) throw createError.badRequest(PHONE_RESET_BAD_CODE);
  try {
    await smsService.verifyOtp(phone10, String(code));
  } catch (error) {
    throw createError.badRequest(PHONE_RESET_BAD_CODE);
  }

  user.password = password;
  await user.save();
  await RefreshToken.revokeAllUserTokens(user.id, 'password_reset');
  await clearAllLoginLocks(user);

  logSecurityEvent('password_reset_by_phone', req, { userId: user.id });
  if (user.email) {
    sendSecurityAlert(user.email, '', 'Your password was changed', 'Your TricityMatch password was just changed using a code sent to your mobile number.', new Date().toUTCString())
      .catch((error) => log.warn('Phone reset alert failed', { userId: user.id, error: error.message }));
  }

  res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
});

// @route   POST /api/auth/change-password
// @desc    Change password (while logged in)
// @access  Private
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw createError.notFound('User not found');
  }

  // Google-only members have no password to change (bcrypt on a null hash
  // would throw a 500).
  if (!user.password) {
    throw createError.badRequest('Your account signs in with Google, so there is no password to change');
  }

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw createError.unauthorized('Current password is incorrect');
  }

  // Reusing the same password reported success and revoked the other sessions
  // without actually changing anything — worse than useless when the reason for
  // changing it is that the old one leaked.
  if (currentPassword === newPassword) {
    throw createError.badRequest('Your new password must be different from your current one');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  await revokeOtherSessions(req, user.id, 'password_change');

  // Tell the member (best effort, off the request path): a changed password is
  // exactly what an account takeover looks like from the inside.
  notifySecurityChange(user, 'Your password was changed', 'Your TricityMatch account password was just changed. If this was not you, reset your password now and contact support.');

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @route   GET /api/auth/sessions
// @desc    Get active sessions
// @access  Private
exports.getSessions = asyncHandler(async (req, res) => {
  const sessions = await RefreshToken.findAll({
    where: {
      userId: req.user.id,
      isRevoked: false,
      expiresAt: { [require('sequelize').Op.gt]: new Date() }
    },
    attributes: ['id', 'userAgent', 'ipAddress', 'createdAt', 'lastUsedAt'],
    // NULLs sort FIRST under DESC in Postgres; fall back to when it was created.
    order: [[require('sequelize').literal('COALESCE("lastUsedAt", "createdAt")'), 'DESC']]
  });

  // Identify the current session. The access token carries its session id
  // (`sid`) since 2026-08-11 — that works for every client. The cookie hash is
  // the fallback for access tokens minted before the claim existed; without it
  // a native client sees a list with nothing marked "this device" and can sign
  // itself out trying to revoke the unfamiliar one.
  let currentSessionId = req.sessionId || null;
  const currentRefreshToken = req.cookies?.refreshToken;
  if (!currentSessionId && currentRefreshToken) {
    const currentHash = RefreshToken.hashToken(currentRefreshToken);
    const currentSession = await RefreshToken.findOne({
      where: { tokenHash: currentHash },
      attributes: ['id']
    });
    if (currentSession) {
      currentSessionId = currentSession.id;
    }
  }

  res.json({
    success: true,
    sessions: sessions.map(s => ({
      ...s.toJSON(),
      isCurrent: s.id === currentSessionId
    })),
    currentSessionId
  });
});

// @route   GET /api/auth/login-history
// @desc    Recent sign-ins (one entry per login), newest first
// @access  Private
exports.getLoginHistory = asyncHandler(async (req, res) => {
  const { loginHistory } = require('../utils/deviceRecognition');
  const history = await loginHistory(RefreshToken, req.user.id, { limit: 20 });
  res.json({ success: true, history });
});

// @route   DELETE /api/auth/sessions/:sessionId
// @desc    Revoke a specific session
// @access  Private
exports.revokeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await RefreshToken.findOne({
    where: {
      id: sessionId,
      userId: req.user.id
    }
  });

  if (!session) {
    throw createError.notFound('Session not found');
  }

  await session.revoke('user_revoked');

  res.json({
    success: true,
    message: 'Session revoked'
  });
});

/**
 * Re-authenticate the signed-in member before a sensitive action (erasure,
 * data export). Password members give their password; Google-only members
 * (no password: bcrypt on a null hash used to 500) give a fresh Google
 * credential for the SAME Google identity — a token for another account is refused.
 */
const reauthenticateMember = async (user, { password, googleCredential }, action) => {
  if (user.password) {
    if (!password) throw createError.badRequest(`Password is required to ${action}`);
    if (!(await user.comparePassword(password))) throw createError.unauthorized('Incorrect password');
    return;
  }
  if (!user.googleId) throw createError.badRequest(`Password is required to ${action}`);
  if (!googleCredential) throw createError.badRequest(`Confirm with Google to ${action}`);
  const payload = await verifyGoogleCredential(googleCredential);
  if (payload.sub !== user.googleId) throw createError.unauthorized('That Google account does not match this member');
};

// @route   DELETE /api/auth/account
// @desc    Soft-delete account (requires password confirmation)
// @access  Private
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password, googleCredential } = req.body;

  const user = await User.findByPk(req.user.id);
  if (!user) throw createError.notFound('User not found');

  await reauthenticateMember(user, { password, googleCredential }, 'delete your account');

  // Real erasure. This used to be `user.status = 'deleted'` plus a token purge,
  // which left the profile (exact DOB, birth time, place of birth, caste,
  // income, photos), the KYC selfie and liveness video, every message, and a
  // guardian's name and phone number in the database indefinitely -- for an
  // endpoint that told the member their account was deleted.
  const erased = await eraseAccount(user.id);

  log.info('Account erased', { userId: user.id, erased });
  if (erased.mediaFailed && erased.mediaFailed.length) {
    // The database erasure is complete but some files could not be destroyed.
    // public_ids are not personal data; this is the retry list for an operator.
    log.error('Erasure left media files behind', { userId: user.id, files: erased.mediaFailed });
  }

  clearAuthCookies(res);

  res.json({ success: true, message: 'Account deleted successfully' });
});

// @route   POST /api/auth/account/schedule-deletion
// @desc    Delete the account after a grace period (cancellable by signing in)
// @access  Private (re-authentication required, same as immediate deletion)
exports.scheduleAccountDeletion = asyncHandler(async (req, res) => {
  const { password, googleCredential } = req.body;
  const user = await User.findByPk(req.user.id);
  if (!user) throw createError.notFound('User not found');
  await reauthenticateMember(user, { password, googleCredential }, 'delete your account');

  const { scheduleDeletion } = require('../utils/accountLifecycle');
  const result = await scheduleDeletion(user);
  if (result.immediate) {
    // Grace period switched off in configuration: same outcome as DELETE /account.
    await eraseAccount(user.id);
    clearAuthCookies(res);
    return res.json({ success: true, immediate: true, message: 'Account deleted successfully' });
  }

  if (user.email) {
    sendSecurityAlert(
      user.email, '', 'Account deletion scheduled',
      `Your TricityMatch account will be deleted on ${result.scheduledFor.toUTCString()}. Your profile is hidden until then. Sign in and cancel in Settings to keep it.`,
      new Date().toUTCString()
    ).catch((error) => log.warn('Deletion notice failed', { userId: user.id, error: error.message }));
  }
  res.json({ success: true, scheduledFor: result.scheduledFor, message: 'Deletion scheduled. Sign in and cancel any time before then to keep your account.' });
});

// @route   POST /api/auth/account/cancel-deletion
// @desc    Cancel a scheduled deletion and restore the profile
// @access  Private
exports.cancelAccountDeletion = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) throw createError.notFound('User not found');
  const { cancelDeletion } = require('../utils/accountLifecycle');
  const result = await cancelDeletion(user);
  res.json({ success: true, cancelled: result.changed });
});

// @route   POST /api/auth/me/export
// @desc    Download everything we hold about the signed-in member (re-auth required)
// @access  Private
exports.exportMyData = asyncHandler(async (req, res) => {
  const { password, googleCredential } = req.body;
  const user = await User.findByPk(req.user.id);
  if (!user) throw createError.notFound('User not found');
  await reauthenticateMember(user, { password, googleCredential }, 'download your data');

  const data = await buildMemberExport(user.id);
  logAudit('member_data_exported', user.id, { collections: Object.keys(data).length });

  const day = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tricitymatch-my-data-${day}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(data, null, 2));
});

// @route   POST /api/auth/send-otp
// @desc    Send real OTP via SMS (Fast2SMS/MSG91) or log in dev mode
// @access  Public
// @route   POST /api/v1/auth/referral-check
// @desc    Is this referral code real? Lets the signup form say so BEFORE the
//          person commits, instead of the server silently ignoring a typo.
// @access  Public (rate-limited)
// Reveals only what the code's own link already would: a member's first name
// (as GET /invite/:token does) and the configured discount. Marketing codes
// reveal nothing about the rep.
exports.checkReferralCode = asyncHandler(async (req, res) => {
  const { resolveCode, ReferralError } = require('../utils/referral');
  const { getReferralState } = require('../utils/launchOffer');
  try {
    const resolved = await resolveCode(req.body.code, null);
    const cfg = getReferralState();
    return res.json({
      success: true,
      valid: true,
      kind: resolved.kind,
      referrerName: resolved.referrerName || null,
      discountPaise: cfg.enabled ? cfg.discountPaise : 0,
    });
  } catch (err) {
    if (err instanceof ReferralError) {
      return res.json({ success: true, valid: false, message: err.message });
    }
    throw err;
  }
});

exports.sendOtp = asyncHandler(async (req, res) => {
  const { type, target } = req.body;
  if (!target) throw createError.badRequest('target is required');

  // OTP is signup verification — only for NEW contacts. If an account already
  // exists for this email/phone, refuse and point them to login. Without this an
  // existing (even logged-in) user could trigger an OTP to their own number.
  const { Op } = require('sequelize');
  if (type === 'email') {
    const email = canonicalEmail(target);
    if (!email) throw createError.badRequest('A valid email address is required');
    const exists = await findUserByEmail(email, { attributes: ['id'] });
    if (exists) throw createError.conflict('An account already exists with this email. Please log in instead.');
  } else if (type === 'phone') {
    // Match every form a phone might be stored in (bare 10-digit, +91, 91…).
    const last10 = String(target).replace(/\D/g, '').slice(-10);
    const variants = [...new Set([String(target).trim(), last10, `91${last10}`, `+91${last10}`, `0${last10}`])].filter(Boolean);
    const exists = await User.findOne({ where: { phone: { [Op.in]: variants } }, attributes: ['id'] });
    if (exists) throw createError.conflict('An account already exists with this phone number. Please log in instead.');
  }

  if (type === 'phone') {
    const result = await smsService.sendOtp(target);
    res.json(result);
  } else if (type === 'email') {
    // Email OTP: same store, budget and hashing as the phone path, delivered by email.
    const otpEmail = canonicalEmail(target);
    await otpStore.spendSend('email', otpEmail);
    if (!(await spendEmailBudget())) {
      throw new AppError('We cannot send verification codes right now. Please try again later.', 503);
    }
    const code = await otpStore.issue('email', otpEmail, { digits: 6 });
    try {
      await sendOtpEmail(otpEmail, code, 'verify your email');
    } catch (err) {
      await otpStore.discard('email', otpEmail);
      throw err;
    }
    // Dev affordance: log the code when no email channel is configured.
    // Gate on isDevelopment, not !isProduction: the negative form is also true
    // for 'staging', 'qa' or any unrecognised NODE_ENV. The code is interpolated
    // into the message string, where redactValue can never reach it.
    if (!config.email.isConfigured() && config.isDevelopment) {
      log.info(`[EMAIL-OTP DEV] Code for ${otpEmail}: ${code}`);
    }
    res.json({ success: true, message: 'OTP sent to email' });
  } else {
    throw createError.badRequest('type must be phone or email');
  }

  // Funnel stage 1 — reached only when a send branch ran (bad type throws above).
  // Pre-account: no User row exists yet, so userId is NULL and this is a RAW
  // COUNTER, inflated by resends (documented in scripts/funnel-report.sql).
  // Fire-and-forget: never awaited, never able to fail the response.
  trackEvent(null, 'otp_send_attempted');
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP — enforces expiry, attempt limits, no bypass codes
// @access  Public
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { type, target, code } = req.body;
  if (!target || !code) throw createError.badRequest('target and code are required');

  let result;
  if (type === 'email') {
    // Email OTP lives in the shared store under the 'email' namespace. It must
    // NOT go through smsService.verifyOtp, which canonicalizes the target as a
    // phone number — an email normalizes to null and throws before any code check.
    const emailTarget = canonicalEmail(String(target));
    const bypassCodes = config.sms.bypassCodes || [];
    if (bypassCodes.length > 0 && bypassCodes.includes(String(code))) {
      await otpStore.discard('email', emailTarget);
      result = { success: true, message: 'OTP verified (bypass)' };
    } else {
      await otpStore.verify('email', emailTarget, code);
      result = { success: true, message: 'OTP verified successfully' };
    }
  } else {
    // Phone OTP — smsService canonicalizes + checks the `otp:<91…>` store.
    result = await smsService.verifyOtp(target, code);
  }

  // Issue the single-use proof signup will ask for (see utils/otpProof). Unlike
  // the old contact-keyed marker it is returned only to the caller who entered
  // the correct code. Not "non-fatal": without it signup cannot proceed, so a
  // cache failure must surface here rather than as a confusing signup error.
  const verificationProof = await issueProof(
    type === 'phone' ? 'phone' : 'email',
    type === 'phone' ? smsService.normalizePhone(target) : canonicalEmail(String(target))
  );

  // Funnel stage 2 — still pre-account (userId NULL), same raw-counter caveat.
  trackEvent(null, 'otp_verify_succeeded');

  res.json({ ...result, verificationProof, message: `${type} verified successfully` });
});

// ---- Contact number (the number other members call after an unlock) ----
// Only a number the member has proved they control is ever shown on unlock, so a
// typo in a form can never send someone to a stranger. The check is against the
// DB: if the account already holds this exact number as verified, no OTP.
const phoneVariants = (phone10) => [phone10, `91${phone10}`, `+91${phone10}`, `0${phone10}`];
const toPhone10 = (raw) => String(raw || '').replace(/\D/g, '').slice(-10);

const assertPhoneFree = async (phone10, userId) => {
  const { Op } = require('sequelize');
  const taken = await User.findOne({
    where: { phone: { [Op.in]: phoneVariants(phone10) }, id: { [Op.ne]: userId } },
    attributes: ['id'],
  });
  if (taken) throw createError.conflict('This number is already linked to another account.');
};

// Where a verified contact number is stored.
//  - No verified login number yet: the number becomes the account's login number
//    (`phone`), which must be unique.
//  - A verified login number already exists: a different contact number goes in
//    `contactPhone` and the login number is left alone. That column is not an
//    identity, so a parent may give the same number on a sibling's profile.
const contactNumberState = (user, phone10) => {
  const loginVerified = Boolean(user.phoneVerified && user.phone);
  const isLogin = loginVerified && toPhone10(user.phone) === phone10;
  const isContact = Boolean(user.contactPhone) && toPhone10(user.contactPhone) === phone10;
  return { loginVerified, isLogin, isContact, alreadyVerified: isLogin || isContact };
};

const CONTACT_USER_ATTRS = ['id', 'phone', 'phoneVerified', 'contactPhone'];

// @route   POST /api/auth/contact-number/request
// @desc    Start verifying a contact number (skips the OTP when already verified)
// @access  Private
exports.requestContactNumber = asyncHandler(async (req, res) => {
  const phone10 = toPhone10(req.body.phone);
  if (!/^[6-9]\d{9}$/.test(phone10)) throw createError.badRequest('Enter a valid 10-digit Indian mobile number');

  const user = await User.findByPk(req.user.id, { attributes: CONTACT_USER_ATTRS });
  const state = contactNumberState(user, phone10);
  if (state.alreadyVerified) {
    return res.json({ success: true, alreadyVerified: true, phone: phone10 });
  }
  // A number that will become the login number must not belong to someone else.
  if (!state.loginVerified) await assertPhoneFree(phone10, user.id);
  const result = await smsService.sendOtp(phone10);
  res.json({ ...result, alreadyVerified: false, phone: phone10 });
});

// @route   POST /api/auth/contact-number/verify
// @desc    Confirm the OTP and save the number as the member's verified contact
// @access  Private
exports.verifyContactNumber = asyncHandler(async (req, res) => {
  const phone10 = toPhone10(req.body.phone);
  if (!/^[6-9]\d{9}$/.test(phone10)) throw createError.badRequest('Enter a valid 10-digit Indian mobile number');

  const user = await User.findByPk(req.user.id, { attributes: CONTACT_USER_ATTRS });
  const state = contactNumberState(user, phone10);
  let contactPhone = user.contactPhone || null;

  if (!state.alreadyVerified) {
    if (!req.body.code) throw createError.badRequest('Enter the code we sent');
    if (!state.loginVerified) await assertPhoneFree(phone10, user.id);
    await smsService.verifyOtp(phone10, String(req.body.code));
    if (state.loginVerified) {
      contactPhone = phone10;
      await User.update({ contactPhone }, { where: { id: user.id } });
    } else {
      contactPhone = null;
      await User.update({ phone: phone10, phoneVerified: true, contactPhone: null }, { where: { id: user.id } });
    }
    log.info('Contact number verified', { userId: user.id, separateFromLogin: state.loginVerified });
  } else if (state.isLogin && user.contactPhone) {
    // Choosing the login number again drops the separate contact number.
    contactPhone = null;
    await User.update({ contactPhone: null }, { where: { id: user.id } });
  }
  // `isLoginNumber` tells the client which field to refresh: the account's own
  // phone, or the separate contact number.
  res.json({ success: true, phone: phone10, phoneVerified: true, isLoginNumber: contactPhone === null, contactPhone });
});

// Verify a Google ID token and return its payload. Shared by sign-in and by
// account deletion (re-authentication for members who have no password).
async function verifyGoogleCredential(credential) {
  const clientId = config.google.clientId;
  if (!clientId) throw createError.internal('Google OAuth is not configured on this server');

  const client = new OAuth2Client(clientId);
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    return ticket.getPayload();
  } catch {
    throw createError.unauthorized('Invalid Google credential');
  }
}

// @route   POST /api/auth/google
// @desc    Sign in / sign up with Google ID token
// @access  Public
exports.googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) throw createError.badRequest('Google credential is required');

  const payload = await verifyGoogleCredential(credential);

  const { sub: googleId, email, given_name: rawFirstName, family_name: rawLastName, email_verified } = payload;
  if (!email_verified) throw createError.badRequest('Google account email is not verified');

  // Names arriving on this path never pass signupValidation, so they skip the
  // character rule every other write path enforces. The account holder controls
  // their own Google display name, so this is untrusted input: hold it to the
  // same charset (constants/names) and length as a native signup.
  const sanitizeGoogleName = (value) => cleanName(value, 50);
  const firstName = sanitizeGoogleName(rawFirstName);
  const lastName = sanitizeGoogleName(rawLastName);

  const sequelize = require('../config/database');

  // Find existing user by googleId or email
  let user = await User.findOne({ where: { googleId } });
  let isNewUser = false;

  if (!user) {
    user = await findUserByEmail(email);
    if (user) {
      // Link Google to the existing account with this email.
      //
      // If that account's email was never verified, whoever created it may not
      // own the address (they signed up with a victim's email, then waited for
      // the victim to arrive via Google). Google has now proven the address, so
      // the rightful owner takes the account: drop any password the earlier
      // registrant set and end every session they hold.
      const takeover = !user.emailVerified;
      user.googleId = googleId;
      if (takeover) {
        user.emailVerified = true;
        user.password = null;
      }
      await user.save();
      if (takeover) {
        await RefreshToken.revokeAllUserTokens(user.id, 'google_link_unverified_email');
        log.warn('Google link took over an unverified-email account', { userId: user.id });
      }
    } else {
      // New user — create account + profile in one transaction
      // A NEW account needs acceptance stated in the request, exactly like email
      // signup. An existing member signing in with Google is not creating one.
      // The code lets the client show its consent step and send the same
      // Google credential again with the box ticked (the token stays valid).
      if (!truthy(req.body.termsAccepted)) {
        const err = createError.badRequest('Please accept the Terms and Privacy Policy to create an account');
        err.code = 'GOOGLE_CONSENT_REQUIRED';
        throw err;
      }
      isNewUser = true;
      // Same credit rules as email/phone signup: partner code, member code or
      // invite, or a partner's hand-added lead for this email.
      const attribution = await resolveSignupAttribution({
        code: req.body.referralCode || req.body.ref,
        invite: req.body.invite,
        email: canonicalEmail(email),
      });
      user = await sequelize.transaction(async (t) => {
        const newUser = await User.create({
          email: canonicalEmail(email),
          googleId,
          ...attributionUserFields(attribution),
          password: null,
          status: 'active',
          emailVerified: true,
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
          consent: buildConsent(req, { marketing: truthy(req.body.marketingConsent) }),
          ...(truthy(req.body.marketingConsent) ? {} : { lifecycleMail: { emailOptOut: new Date().toISOString() } }),
        }, { transaction: t });

        await Profile.create({
          userId: newUser.id,
          firstName: firstName || '',
          lastName: lastName || '',
          // gender/dateOfBirth stay NULL: a placeholder here meant every
          // Google member was a 26-year-old of gender 'other' in search until
          // they edited it. Onboarding collects the real values.
        }, { transaction: t });

        await recordSignupAttribution(t, newUser, attribution, {
          name: [firstName, lastName].filter(Boolean).join(' '),
          email: canonicalEmail(email),
        });

        return newUser;
      });

      // Same funnel stage 3 for the Google first-time signup path.
      trackEvent(user.id, 'account_created');
      await afterSignupAttribution(user.id, attribution);

      // …and the same founding grant. Leaving it off this path would mean two
      // people signing up the same day get different entitlements purely by
      // which button they pressed. Post-transaction + never-throws, as above.
      await grantFoundingIfOpen(user.id);

      setImmediate(() => {
        sendWelcomeEmail(user.email, firstName || 'there')
          .catch(err => log.error('Failed to send welcome email (google)', { error: err.message }));
      });
    }
  }

  // Google carries no second factor, so it cannot stand in for one: an account
  // with two-step verification on must sign in with its password and code.
  if (user.mfaEnabledAt) {
    throw createError.unauthorized('This account uses two-step verification. Sign in with your password and code.', 'MFA_REQUIRED_PASSWORD_LOGIN');
  }

  // Every other auth path rejects `status !== 'active'`; this one checked only
  // for 'banned', so inactive / pending / deleted accounts could still sign in
  // through Google.
  if (user.status !== 'active') {
    throw createError.forbidden('Account is not active. Please contact support.');
  }

  user.lastLogin = new Date();
  await user.save();

  const { token: refreshToken, sessionId } = await generateRefreshToken(
    user.id,
    req.headers['user-agent'],
    req.clientIp || req.ip
  );
  const accessToken = generateAccessToken(user.id, sessionId);
  if (!isNewUser) alertIfNewDevice(req, user, sessionId);
  setAuthCookies(res, accessToken, refreshToken);

  // The full user, as password login returns it, so the client needs no
  // second /auth/me and sees onboardingComplete (false for a new Google member,
  // who still has to give gender and date of birth).
  const fullUser = await User.findByPk(user.id, { attributes: { exclude: ['password'] }, include: [{ model: Profile }] });
  res.status(isNewUser ? 201 : 200).json({
    success: true,
    message: isNewUser ? 'Account created successfully' : 'Logged in successfully',
    isNewUser,
    user: await withDerivedUserFields(fullUser),
    tokens: { accessToken, refreshToken, expiresIn: config.auth.jwtExpiry },
  });
});

// @route   POST /api/auth/change-email/request
// @desc    Authenticated: verify identity + email a 6-digit code to the NEW address
// @access  Private
exports.requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail, password } = req.body;
  const normalized = canonicalEmail(newEmail) || '';
  if (!normalized) throw createError.badRequest('New email is required');

  const user = await User.findByPk(req.user.id);
  if (!user) throw createError.unauthorized('Not authenticated');

  // Password-confirm for accounts that have a password (OAuth-only users skip)
  if (user.password) {
    if (!password) throw createError.badRequest('Current password is required');
    const ok = await user.comparePassword(password);
    if (!ok) throw createError.unauthorized('Incorrect password');
  }

  if (user.email && user.email.toLowerCase() === normalized) {
    throw createError.badRequest('That is already your email address');
  }

  const taken = await findUserByEmail(normalized, { attributes: ['id'] });
  if (taken) throw createError.conflict('That email is already in use');

  // Budget is per member (not per address) so one account cannot fan out mail to
  // many addresses; the code itself is bound to member + address, so nobody else
  // can burn its attempts or redeem it.
  await otpStore.spendSend('email-change', user.id);
  if (!(await spendEmailBudget())) {
    throw new AppError('We cannot send verification codes right now. Please try again later.', 503);
  }
  const changeTarget = `${user.id}:${normalized}`;
  const code = await otpStore.issue('email-change', changeTarget, { digits: 6 });
  try {
    await sendOtpEmail(normalized, code, 'confirm your new email address');
  } catch (err) {
    await otpStore.discard('email-change', changeTarget);
    throw err;
  }
  // Dev affordance (matches smsService): log the code when email isn't configured.
  // isDevelopment, not !isProduction -- see the note in sendOtp.
  if (!config.email.isConfigured() && config.isDevelopment) {
    log.info(`[EMAIL-CHANGE DEV] Code for ${normalized}: ${code}`);
  }

  res.json({ success: true, message: 'Verification code sent to your new email' });
});

// @route   POST /api/auth/change-email/verify
// @desc    Authenticated: verify the code and apply the new email
// @access  Private
exports.verifyEmailChange = asyncHandler(async (req, res) => {
  const { newEmail, code } = req.body;
  const normalized = canonicalEmail(newEmail) || '';
  if (!normalized || !code) throw createError.badRequest('New email and code are required');

  await otpStore.verify('email-change', `${req.user.id}:${normalized}`, code);

  // Re-check availability (guards a race between request and verify)
  const taken = await findUserByEmail(normalized, { attributes: ['id'] });
  if (taken && taken.id !== req.user.id) throw createError.conflict('That email is already in use');

  const user = await User.findByPk(req.user.id);
  const previousEmail = user.email;
  user.email = normalized;
  user.emailVerified = true;
  await user.save();

  // The address is the recovery channel: tell the OLD one it moved (so the
  // real owner of an account whose email was swapped learns of it), and sign
  // out every other device -- whoever changed it may not be the member.
  await revokeOtherSessions(req, user.id, 'email_change');
  if (previousEmail && previousEmail.toLowerCase() !== normalized) {
    notifySecurityChange(
      user,
      'Your account email was changed',
      `The email address on your TricityMatch account was changed to ${normalized.replace(/^(.).*(@.*)$/, '$1***$2')}. If this was not you, contact support immediately.`,
      previousEmail
    );
  }

  const fullUser = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });
  res.json({ success: true, message: 'Email updated successfully', user: await withDerivedUserFields(fullUser) });
});


// @route   POST /api/auth/accept-terms
// @desc    Accept the current Terms and Privacy Policy (re-consent after a version bump)
// @access  Private
// The client must send the version it displayed; accepting a version that is not
// the current one would record consent to text the member was not shown.
exports.acceptTerms = asyncHandler(async (req, res) => {
  if (String(req.body.termsVersion || '') !== TERMS_VERSION) {
    throw createError.conflict('The Terms have been updated again. Reload and review the latest version.');
  }
  if (!truthy(req.body.accepted)) {
    throw createError.badRequest('Please accept the Terms and Privacy Policy to continue');
  }
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'consent'] });
  if (!user) throw createError.unauthorized('Not authenticated');

  user.termsAcceptedAt = new Date();
  user.termsVersion = TERMS_VERSION;
  user.consent = renewConsent(user.consent, req);
  await user.save({ fields: ['termsAcceptedAt', 'termsVersion', 'consent'], hooks: false });

  logAudit('terms_accepted', req.user.id, { termsVersion: TERMS_VERSION });
  res.json({ success: true, termsVersion: TERMS_VERSION, requiresReconsent: false });
});
