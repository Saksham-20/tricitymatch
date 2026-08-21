/**
 * Authentication Controller
 * Implements secure JWT authentication with refresh token rotation
 */

const jwt = require('jsonwebtoken');
const { User, Profile, RefreshToken, ReferralCode, MarketingLead } = require('../models');
const { sendWelcomeEmail, sendPasswordResetEmail, sendEmail, sendOtpEmail, sendSecurityAlert } = require('../utils/email');
const config = require('../config/env');
const { createError, asyncHandler } = require('../middlewares/errorHandler');
const { recordFailedLogin, clearLoginAttempts, loginLookupKey } = require('../middlewares/security');
const { log } = require('../middlewares/logger');
const { OAuth2Client } = require('google-auth-library');
const smsService = require('../utils/smsService');
const { trackEvent } = require('../utils/trackEvent');
const { grantFoundingIfOpen } = require('../utils/foundingGrant');
const { getActiveSubscription } = require('../utils/entitlements');

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
  // Read through utils/entitlements — the SAME query every gate uses, including
  // its endDate predicate. Filtering on `status:'active'` alone (what this did
  // until 2026-08-10) meant that between a subscription's expiry and the hourly
  // Bull sweep that flips the row to 'expired', /auth/me reported the member as
  // premium while every actual gate 403'd; if Redis is down the sweep never
  // runs at all. The sweep is cleanup, not correctness.
  const activeSub = await getActiveSubscription(user.id);
  user.subscriptionPlan = activeSub?.planType || 'free';
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
    token,
    tokenHash: RefreshToken.hashToken(token),
    family: existingFamily || require('crypto').randomUUID(),
    expiresAt,
    userAgent: userAgent?.substring(0, 500),
    ipAddress,
  });

  return { token, sessionId: row.id };
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

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
exports.signup = asyncHandler(async (req, res) => {
  const { email, password, phone, firstName, lastName, gender, dateOfBirth, referralCode } = req.body;
  const codeFromQuery = req.query.ref || req.body.ref;
  // Member invite (Phase S) — a DIFFERENT param from the marketing `ref` above.
  // Both may be present on one signup and are honoured independently.
  const inviteFromRequest = req.body.invite || req.query.invite;

  // Flexible auth: account is identified by EITHER an email OR a phone number.
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const normalizedPhone = phone ? String(phone).trim() : null;
  if (!normalizedEmail && !normalizedPhone) {
    throw createError.badRequest('An email address or phone number is required');
  }

  // Check if user already exists (by whichever identifier was provided)
  if (normalizedEmail) {
    const existingByEmail = await User.findOne({ where: { email: normalizedEmail } });
    if (existingByEmail) throw createError.conflict('An account already exists with this email');
  }
  if (normalizedPhone) {
    const existingByPhone = await User.findOne({ where: { phone: normalizedPhone } });
    if (existingByPhone) throw createError.conflict('An account already exists with this phone number');
  }

  // Validate and process referral code
  let referralData = null;
  const codeToUse = referralCode || codeFromQuery;
  if (codeToUse) {
    const code = await ReferralCode.findOne({ where: { code: codeToUse.toUpperCase(), isActive: true } });
    if (code) {
      referralData = {
        referralCodeUsed: code.code,
        referredByMarketingUserId: code.marketingUserId,
        isBoosted: true,
        boostExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };
    }
  }

  // Resolve the member invite AT SIGNUP, not just when the landing page rendered
  // the inviter's name: the inviter may have been deleted or deactivated in
  // between, and `invitedBy` must never point at a dead account. Any failure
  // (unknown token, inactive inviter, DB hiccup) resolves to null and the signup
  // proceeds normally — a forged invite is silently ignored, never an error.
  let invitedBy = null;
  if (inviteFromRequest) {
    try {
      const token = String(inviteFromRequest).trim();
      if (/^[0-9a-f]{16,128}$/i.test(token)) {
        const inviter = await User.findOne({
          where: { inviteToken: token, status: 'active' },
          attributes: ['id'],
        });
        if (inviter) invitedBy = inviter.id;
      }
    } catch (err) {
      log.warn('Invite lookup failed at signup (ignored)', { error: err.message });
    }
  }

  // Consume the OTP-verified markers set by verify-otp so the account is stamped
  // verified at creation (proves the contact was confirmed, not client-trusted).
  let emailWasVerified = false;
  let phoneWasVerified = false;
  try {
    const { get: cacheGet, del: cacheDel } = require('../utils/cache');
    if (normalizedEmail) {
      const k = `otp-verified:email:${normalizedEmail}`;
      if (await cacheGet(k)) { emailWasVerified = true; await cacheDel(k); }
    }
    if (normalizedPhone) {
      const k = `otp-verified:phone:${smsService.normalizePhone(normalizedPhone)}`;
      if (await cacheGet(k)) { phoneWasVerified = true; await cacheDel(k); }
    }
  } catch { /* non-fatal */ }

  const sequelize = require('../config/database');
  let result;
  try {
    result = await sequelize.transaction(async (t) => {
      const user = await User.create({
        email: normalizedEmail,
        password,
        phone: normalizedPhone,
        status: 'active',
        emailVerified: emailWasVerified,
        phoneVerified: phoneWasVerified,
        invitedBy,
        ...(referralData && referralData)
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

      // If referral code used, increment usage count and create marketing lead
      if (referralData) {
        await ReferralCode.update(
          { usageCount: sequelize.literal('usageCount + 1') },
          { where: { code: referralData.referralCodeUsed }, transaction: t }
        );

        await MarketingLead.create({
          name: `${firstName} ${lastName}`,
          phone: normalizedPhone || 'N/A',
          email: normalizedEmail || 'N/A',
          assignedToMarketingUserId: referralData.referredByMarketingUserId,
          referralCode: referralData.referralCodeUsed,
          convertedUserId: user.id,
          status: 'contacted'
        }, { transaction: t });
      }

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
  if (invitedBy) {
    trackEvent(result.id, 'invited_signup');
    // Reward BOTH sides. Deliberately outside the signup transaction and
    // never awaited into the response path's failure modes — rewardInvite
    // swallows its own errors by contract, because a reward that fails must
    // not cost anyone their account. Awaited so the grant below sees any
    // credit that landed as pending.
    await require('../utils/inviteReward').rewardInvite(result.id, invitedBy);
  }

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
  const where = isEmail ? { email: lookupKey } : { phone: lookupKey };

  // Find user by email or phone
  const user = await User.findOne({ where });
  if (!user) {
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

  // Clear failed login attempts on success
  await clearLoginAttempts(lookupKey);

  // Check if user is active
  if (user.status !== 'active') {
    throw createError.forbidden('Account is not active. Please contact support.');
  }

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

// @route   POST /api/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public (with valid refresh token)
exports.refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or body
  const refreshTokenValue = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (!refreshTokenValue) {
    throw createError.unauthorized('Refresh token required');
  }

  // Find the token
  const tokenHash = RefreshToken.hashToken(refreshTokenValue);
  const storedToken = await RefreshToken.findValidToken(tokenHash);

  if (!storedToken) {
    // Token not found or invalid - could be token reuse attack
    // Revoke all tokens in the family as a precaution
    const possibleToken = await RefreshToken.findOne({ where: { tokenHash } });
    if (possibleToken) {
      await RefreshToken.revokeFamily(possibleToken.family, 'token_reuse_detected');
      log.security('token_reuse_detected', { userId: possibleToken.userId, family: possibleToken.family });
    }
    clearAuthCookies(res);
    throw createError.unauthorized('Invalid refresh token');
  }

  // Check if user is still active
  const user = await User.findByPk(storedToken.userId);
  if (!user || user.status !== 'active') {
    await storedToken.revoke('user_inactive');
    clearAuthCookies(res);
    throw createError.unauthorized('User account is not active');
  }

  // Rotate refresh token (invalidate old, create new)
  await storedToken.revoke('rotated');
  
  // Generate new tokens — the refresh row first, so the access token can carry its id.
  const { token: newRefreshToken, sessionId } = await generateRefreshToken(
    user.id,
    req.headers['user-agent'],
    req.clientIp || req.ip,
    storedToken.family // Keep the same family for tracking
  );
  const newAccessToken = generateAccessToken(user.id, sessionId);

  // Update last used
  storedToken.lastUsedAt = new Date();
  await storedToken.save();

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

// @route   POST /api/auth/forgot-password
// @desc    Initiate password reset
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase();
  
  // Always respond with same message to prevent email enumeration
  const genericMessage = 'If the email exists, a reset link has been sent.';

  const user = await User.findOne({ where: { email: normalizedEmail } });

  if (!user) {
    // Simulate processing time to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
    return res.json({ success: true, message: genericMessage });
  }

  // Generate reset token (short-lived, tied to current password so it's single-use)
  // Including a fingerprint of the current password hash invalidates the token
  // automatically once the password is changed.
  const pwdFingerprint = require('crypto')
    .createHash('sha256')
    .update(user.password)
    .digest('hex')
    .substring(0, 16);
  const resetToken = jwt.sign(
    { userId: user.id, type: 'password_reset', pwdFp: pwdFingerprint },
    config.auth.jwtSecret,
    { expiresIn: config.auth.resetTokenExpiry }
  );

  const resetUrl = `${config.server.frontendUrl}/reset-password?token=${resetToken}`;

  // Send email (don't fail the request if email fails)
  try {
    await sendPasswordResetEmail(user.email, user.firstName || 'User', resetUrl);
  } catch (error) {
    log.error('Failed to send password reset email', { error: error.message, userId: user.id });
    // Don't expose email failures to client
  }

  res.json({
    success: true,
    message: genericMessage,
    // Include token in development for testing
    ...(config.isDevelopment ? { resetToken } : {})
  });
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(token, config.auth.jwtSecret);
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

  // Update password (will be hashed by model hook)
  user.password = password;
  await user.save();

  // Revoke all refresh tokens for security
  await RefreshToken.revokeAllUserTokens(user.id, 'password_reset');

  // Send security alert (password changed)
  try {
    await sendSecurityAlert(
      user.email,
      user.firstName || 'User',
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

// @route   POST /api/auth/change-password
// @desc    Change password (while logged in)
// @access  Private
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findByPk(req.user.id);
  if (!user) {
    throw createError.notFound('User not found');
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

  // Revoke every other refresh token, keeping the session that made this
  // request. The access token's `sid` claim identifies it directly; the cookie
  // (web) or an explicitly posted refresh token are the fallbacks for tokens
  // minted before the claim existed. If none of the three resolve we revoke
  // nothing rather than everything — signing the member out of the device they
  // are standing on is a worse failure than leaving a stale session, and they
  // can still use "log out everywhere".
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
    await RefreshToken.update(
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'password_change' },
      { where: { userId: user.id, ...keep } }
    );
  }

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
    order: [['lastUsedAt', 'DESC']]
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

// @route   DELETE /api/auth/account
// @desc    Soft-delete account (requires password confirmation)
// @access  Private
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) throw createError.badRequest('Password is required to delete your account');

  const user = await User.findByPk(req.user.id);
  if (!user) throw createError.notFound('User not found');

  const isValid = await user.comparePassword(password);
  if (!isValid) throw createError.unauthorized('Incorrect password');

  // Soft-delete: mark as deleted + revoke all tokens
  user.status = 'deleted';
  await user.save();

  await RefreshToken.destroy({ where: { userId: user.id } });
  clearAuthCookies(res);

  res.json({ success: true, message: 'Account deleted successfully' });
});

// @route   POST /api/auth/send-otp
// @desc    Send real OTP via SMS (Fast2SMS/MSG91) or log in dev mode
// @access  Public
exports.sendOtp = asyncHandler(async (req, res) => {
  const { type, target } = req.body;
  if (!target) throw createError.badRequest('target is required');

  // OTP is signup verification — only for NEW contacts. If an account already
  // exists for this email/phone, refuse and point them to login. Without this an
  // existing (even logged-in) user could trigger an OTP to their own number.
  const { Op } = require('sequelize');
  if (type === 'email') {
    const email = String(target).toLowerCase().trim();
    const exists = await User.findOne({ where: { email }, attributes: ['id'] });
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
    // Email OTP: use smsService-style store but deliver via email (Resend)
    const { set: cacheSet } = require('../utils/cache');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const payload = JSON.stringify({ code, expiresAt: Date.now() + 600 * 1000, attempts: 0 });
    await cacheSet(`otp:${target}`, payload, 600);
    await sendOtpEmail(target, code, 'verify your email');
    // Dev affordance: log the code when no email channel is configured.
    // Gate on isDevelopment, not !isProduction: the negative form is also true
    // for 'staging', 'qa' or any unrecognised NODE_ENV. The code is interpolated
    // into the message string, where redactValue can never reach it.
    if (!config.email.isConfigured() && config.isDevelopment) {
      log.info(`[EMAIL-OTP DEV] Code for ${target}: ${code}`);
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
    // Email OTP lives at `otp:<email>` (set by send-otp). It must NOT go through
    // smsService.verifyOtp, which canonicalizes the target as a phone number —
    // an email normalizes to null and throws before any code check. Verify here.
    const { get: cacheGet, set: cacheSet, del: cacheDel } = require('../utils/cache');
    const key = `otp:${String(target).toLowerCase().trim()}`;

    const bypassCodes = config.sms.bypassCodes || [];
    if (bypassCodes.length > 0 && bypassCodes.includes(String(code))) {
      await cacheDel(key);
      result = { success: true, message: 'OTP verified (bypass)' };
    } else {
      const raw = await cacheGet(key);
      if (!raw) throw createError.badRequest('OTP expired or not sent. Please request a new one.');
      let entry;
      try { entry = JSON.parse(raw); } catch { throw createError.badRequest('OTP data corrupt. Please request a new one.'); }
      if (entry.expiresAt < Date.now()) { await cacheDel(key); throw createError.badRequest('OTP has expired. Please request a new one.'); }
      if ((entry.attempts || 0) >= 5) { await cacheDel(key); throw createError.badRequest('Too many incorrect attempts. Please request a new OTP.'); }
      if (entry.code !== String(code)) {
        const ttlSec = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
        await cacheSet(key, JSON.stringify({ ...entry, attempts: (entry.attempts || 0) + 1 }), ttlSec);
        const remaining = 5 - (entry.attempts || 0) - 1;
        throw createError.badRequest(`Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      }
      await cacheDel(key);
      result = { success: true, message: 'OTP verified successfully' };
    }
  } else {
    // Phone OTP — smsService canonicalizes + checks the `otp:<91…>` store.
    result = await smsService.verifyOtp(target, code);
  }

  // Record a short-lived "this contact was just verified" marker so signup can
  // (a) stamp the new account as verified and (b) prove the contact really was
  // confirmed — not just trusted from a client flag. 30-min window to finish
  // signup. Phone is canonicalized to match how signup normalizes it.
  try {
    const { set: cacheSet } = require('../utils/cache');
    const key = type === 'phone'
      ? `otp-verified:phone:${smsService.normalizePhone(target)}`
      : `otp-verified:email:${String(target).toLowerCase().trim()}`;
    await cacheSet(key, '1', 1800);
  } catch { /* non-fatal: verification still succeeds */ }

  // Funnel stage 2 — still pre-account (userId NULL), same raw-counter caveat.
  trackEvent(null, 'otp_verify_succeeded');

  res.json({ ...result, message: `${type} verified successfully` });
});

// @route   POST /api/auth/google
// @desc    Sign in / sign up with Google ID token
// @access  Public
exports.googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) throw createError.badRequest('Google credential is required');

  const clientId = config.google.clientId;
  if (!clientId) throw createError.internal('Google OAuth is not configured on this server');

  const client = new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw createError.unauthorized('Invalid Google credential');
  }

  const { sub: googleId, email, given_name: firstName, family_name: lastName, email_verified } = payload;
  if (!email_verified) throw createError.badRequest('Google account email is not verified');

  const sequelize = require('../config/database');

  // Find existing user by googleId or email
  let user = await User.findOne({ where: { googleId } });
  let isNewUser = false;

  if (!user) {
    user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (user) {
      // Link Google to existing email account
      user.googleId = googleId;
      if (!user.emailVerified) user.emailVerified = true;
      await user.save();
    } else {
      // New user — create account + profile in one transaction
      isNewUser = true;
      user = await sequelize.transaction(async (t) => {
        const newUser = await User.create({
          email: email.toLowerCase(),
          googleId,
          password: null,
          status: 'active',
          emailVerified: true,
        }, { transaction: t });

        await Profile.create({
          userId: newUser.id,
          firstName: firstName || '',
          lastName: lastName || '',
          gender: 'other',
          dateOfBirth: new Date('2000-01-01'),
        }, { transaction: t });

        return newUser;
      });

      // Same funnel stage 3 for the Google first-time signup path.
      trackEvent(user.id, 'account_created');

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
  setAuthCookies(res, accessToken, refreshToken);

  res.status(isNewUser ? 201 : 200).json({
    success: true,
    message: isNewUser ? 'Account created successfully' : 'Logged in successfully',
    isNewUser,
    user: { id: user.id, email: user.email, role: user.role },
    tokens: { accessToken, refreshToken, expiresIn: config.auth.jwtExpiry },
  });
});

// @route   POST /api/auth/change-email/request
// @desc    Authenticated: verify identity + email a 6-digit code to the NEW address
// @access  Private
exports.requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail, password } = req.body;
  const normalized = (newEmail || '').toLowerCase().trim();
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

  const taken = await User.findOne({ where: { email: normalized } });
  if (taken) throw createError.conflict('That email is already in use');

  const { set: cacheSet } = require('../utils/cache');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const payload = JSON.stringify({ code, expiresAt: Date.now() + 600 * 1000, attempts: 0, userId: user.id });
  await cacheSet(`email-change:${normalized}`, payload, 600);
  await sendOtpEmail(normalized, code, 'confirm your new email address');
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
  const normalized = (newEmail || '').toLowerCase().trim();
  if (!normalized || !code) throw createError.badRequest('New email and code are required');

  const { get: cacheGet, set: cacheSet, del: cacheDel } = require('../utils/cache');
  const key = `email-change:${normalized}`;
  const raw = await cacheGet(key);
  if (!raw) throw createError.badRequest('Code expired or not found. Please request a new one.');

  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (data.userId !== req.user.id) throw createError.unauthorized('This code was issued for a different account');
  if (Date.now() > data.expiresAt) { await cacheDel(key); throw createError.badRequest('Code expired. Please request a new one.'); }
  if (data.attempts >= 5) { await cacheDel(key); throw createError.badRequest('Too many attempts. Please request a new code.'); }
  if (String(code).trim() !== String(data.code)) {
    data.attempts += 1;
    await cacheSet(key, JSON.stringify(data), 600);
    throw createError.badRequest('Incorrect code');
  }

  // Re-check availability (guards a race between request and verify)
  const taken = await User.findOne({ where: { email: normalized } });
  if (taken && taken.id !== req.user.id) throw createError.conflict('That email is already in use');

  const user = await User.findByPk(req.user.id);
  user.email = normalized;
  user.emailVerified = true;
  await user.save();
  await cacheDel(key);

  const fullUser = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
    include: [{ model: Profile }],
  });
  res.json({ success: true, message: 'Email updated successfully', user: await withDerivedUserFields(fullUser) });
});

