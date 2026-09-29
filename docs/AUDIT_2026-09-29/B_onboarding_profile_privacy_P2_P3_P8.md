# Audit B — Onboarding (Phase 2), Profile Data (Phase 3), Privacy/Account (Phase 8)

Scope: /Users/sakshampanjla/Desktop/REACT/tricitymatch (backend/, frontend/, mobile/). READ-ONLY. No repo file modified, no OTP/SMS/email/payment triggered, no prod touched. One scratch node run (a copy of `sanitizeObject`, see P2-05) and one bcrypt/crypto null-arg probe, both in the scratchpad. CLAUDE.md claims were treated as leads; every finding below cites code read in this session. Personal data/secrets deliberately not printed.

Legend: PASS / PARTIAL / FAIL / NOT VERIFIED / N/A. Severity: Critical/High/Medium/Low/Info.
Path shorthand: `BE`=/backend, `FE`=/frontend/src, `MOB`=/mobile/src.

---------------------------------------------------------------------------------------------------
## 0. Executive summary (top items)

1. **P8-11a High** — `GET /match/daily` (BE/controllers/matchController.js:258-345,351-380) returns the raw `Profile` row of candidates with **none** of the privacy gates that search/getProfile apply: no `profileVisibility='matches_only'` filter, no `incognitoMode` filter, no `photoBlurUntilMatch` redaction, no social-link visibility filtering, no voice/video-intro gating. It also ships exact DOB, birth time, place of birth, exact income, saved-search JSON. Result is **cached per viewer per IST day** and never invalidated.
2. **P8-07 High** — Erasure (BE/utils/accountErasure.js:56-155) deletes DB rows but **never deletes Cloudinary assets** (photos, voice/video intro, KYC selfie/liveness, voice messages), never clears the Redis daily-match caches that embed the erased person's full profile JSON, and leaves `MarketingLeads` (name/phone/email) untouched. Privacy Policy s.13 (FE/pages/Privacy.jsx:184-192) says photographs and selfie are "erased immediately".
3. **P2-08 High** — Legal age: Terms/Privacy say **21 men / 18 women** (FE/pages/Terms.jsx:93, Privacy.jsx:227); every enforcement point is a flat **18** for everyone (BE/validators/index.js:96, BE/models/Profile.js:45-50, FE BasicInfoStep.jsx:58, MOB BasicsScreen.tsx:149). A 19-year-old man can register and edit freely. Gender (which selects the threshold) is also freely editable.
4. **P2-02 Medium/High** — "Verified mobile compulsory" is not server-enforced: `X-App-Client: mobile` (a client-set constant header) skips it (BE/authController.js:248-251). With it, an account can be created with **no OTP for either email or phone** -> squatting on someone else's email/phone, fake accounts.
5. **P8-09 High(compliance)** — No data-access/export endpoint anywhere, while the signup consent notice says "You can see, correct, **export** or erase it at any time" (FE CreateAccountStep.jsx:337-345).
6. Also: Google-only accounts cannot delete their account (500; erasure requires a password — P8-06), `sanitizeObject` silently deletes any JSON string starting with `$` (password `$Secret123` cannot register/login — P2-05), `by-code` bypasses `matches_only` (P8-01), search leaks voice/video-intro URLs to free viewers (P8-11b), verified badge survives photo/name/DOB change (P3-13), no re-consent on Terms bump (P2-07), pending guardian invites are a dead end (P2-12).

---------------------------------------------------------------------------------------------------
## 1. Checklist table

| ID | Requirement | Status | Sev | One-line reason |
|---|---|---|---|---|
| P2-01 | Mobile OTP registration + verify | PARTIAL | Medium | Works & server-verified (marker `otp-verified:*`); 4-digit non-CSPRNG code, marker not bound to requester, email OTP has no per-target send cap |
| P2-02 | Verified mobile compulsory (server-side) | FAIL | Medium | `X-App-Client: mobile` bypass; no OTP at all on that path |
| P2-03 | Email verification | PARTIAL | Low | OTP-only, optional on web/RN; email-OTP case-mismatch; `normalizeEmail` breaks marker lookup; `emailVerified` gates nothing |
| P2-04 | Account recovery | PARTIAL | Medium | Email reset only; phone-only accounts have no self-serve recovery; Google-only reset path 500s |
| P2-05 | Password / passwordless auth | PARTIAL | Medium | Password policy + lockout PASS; leading-`$` strings deleted by global sanitizer (login/signup break); no passwordless (owner decision) |
| P2-06 | Session issuance/expiry/revocation/logout | PARTIAL (mostly PASS) | Low | Rotation + reuse detection + sessions UI good; access token not tied to session revocation (<=15 min); no absolute session cap |
| P2-07 | Consent capture w/ version+timestamp | PARTIAL | Medium | Stamped by server at account creation, not asserted by client; no re-consent on version bump; no purpose-split |
| P2-08 | Marriageable-age validation at registration (thresholds vs Terms) | FAIL | High | 18 flat vs 21M/18F published |
| P2-09 | Age validation on profile update | PARTIAL | Medium | Model validator enforces 18 (server-side, OK); no gender-based rule, no upper bound, Google signup fabricates DOB |
| P2-10 | DOB/gender change abuse | FAIL | Medium | Unlimited, unaudited edits of DOB and gender; badge persists |
| P2-11 | Profile creation by self/parent/sibling/relative | PARTIAL | Medium | `creatingFor` never reaches the server; subject consent/identity of creator not recorded |
| P2-12 | Ownership/authz for family-managed accounts (guardian) | PARTIAL | Medium | Read-only guardian authz is sound; but auto-active link with no acceptance, pending invites undeliverable, slot leak |
| P2-13 | Unique account/phone; duplicate handling | PARTIAL | Low | DB unique indexes OK; enumeration + squatting; no duplicate-person detection |
| P2-14 | Input validation & abuse prevention | PARTIAL | Low | Server-side validators + limiters present; gaps listed |
| P2-15 | Save-and-resume | PASS | Info | Web draft (no password) in localStorage; RN resumes off server flags |
| P2-16 | Completion % on validated fields | PASS | Info | Presence-based over server-validated fields; server-computed, not client-settable |
| P2-17 | Phone/email change requires re-verification | PASS | Low | OTP to new number/email; password for email; no alert to old channel |
| P3-01 | Personal fields | PARTIAL | Low | Missing nationality, relocation, previous-marriage/children-living-with |
| P3-02 | Cultural fields (voluntary) | PARTIAL | Low | All optional; free-text (no controlled vocab); birthTime unvalidated |
| P3-03 | Education/career | PARTIAL | Low | Missing institution, industry, employer; income unit/period undefined |
| P3-04 | Lifestyle/family | PARTIAL | Low | Missing living arrangement, family-values schema, sibling breakdown |
| P3-05 | Partner preferences | FAIL | Medium | ~half the required dimensions absent; no must-have vs preferred; height range unvalidated |
| P3-06 | Age computed from DOB (not stored) | PASS | Info | No age column; derived in queries/clients |
| P3-07 | Server-side enum/range/nullability validation | PARTIAL | Low | Enums validated; several range/type gaps -> 500 instead of 400 |
| P3-08 | Optional fields genuinely optional | PASS | Info | firstName/lastName/gender/city cannot be cleared (by design) |
| P3-09 | Sensitive-data minimisation | FAIL | Medium | Exact DOB, birth time/place, exact income to every viewer; skinTone/weight collected |
| P3-10 | Mass-assignment protection | PASS | Info | `PROFILE_EDITABLE_FIELDS` allowlist, both stripper and loop |
| P3-11 | Profile change -> search/recommendation refresh | PARTIAL | Medium | Search reads live DB; daily-matches cache stale up to 24h; `invalidateUser` is dead code |
| P3-12 | Users can edit/hide/remove eligible info | PARTIAL | Medium | Edit/clear yes; per-field hide no |
| P3-13 | Verified badge integrity after profile change | FAIL | Medium | Badge = any approved Verification row; never re-evaluated |
| P3-14 | Free-text / JSON sanitisation | PARTIAL | Low | Tags stripped from a subset; JSON blobs & arrays unsanitised, unbounded |
| P8-01 | Profile visibility levels | PARTIAL | High | 2 levels (everyone/matches_only) enforced in search+getProfile; bypassed by daily, by-code, matchAction |
| P8-02 | Separate photo/phone/income/sensitive visibility | PARTIAL | Medium | Photo blur + phone-unlock gate real; income/DOB/etc. not controllable; `showPhone`/`showEmail` are dead controls |
| P8-03 | Last-seen/online controls | PARTIAL | Low | Online enforced on socket; last-seen setting has no implementation behind it |
| P8-04 | Consent withdrawal & marketing prefs | PARTIAL | Low | Email unsubscribe (signed link) real; no in-app toggle, no push prefs, no consent-withdrawal action |
| P8-05 | Account pause/hide/delete/recovery | PARTIAL | Medium | Delete yes; no pause/deactivate; no grace/recovery; Google-only cannot delete |
| P8-06 | Access/correction/erasure requests | PARTIAL | High | Correction self-serve; access = email only; erasure self-serve except Google-only |
| P8-07 | Deletion propagation (DB/cache/search/storage/processors) | FAIL | High | See finding |
| P8-08 | Retention exceptions | PASS | Info | Financial + Reports retained, disclosed in policy; MarketingLeads gap under P8-07 |
| P8-09 | Data export | FAIL | High | Not implemented; policy/consent copy claims it |
| P8-10 | Active session mgmt & suspicious-login controls | PARTIAL | Low | Session list/revoke/logout-all PASS; no new-device alert, no login history, no 2FA |
| P8-11 | Privacy enforced in API responses/queries/exports/logs/WS | FAIL | High | Daily, search, by-code, likes; logs carry PII; sockets PASS |
| P8-12 | Leaks via errors/analytics/notifications/cached responses | PARTIAL | Medium | Cached daily set is the leak; analytics clean (userId only, no contact); admin CSV has formula-injection gap |

---------------------------------------------------------------------------------------------------
## 2. Detailed findings

### PHASE 2

#### P2-01 Mobile OTP registration + verify — PARTIAL, Medium
Evidence: BE/routes/authRoutes.js:101-125 (`send-otp`, `verify-otp`, `otpLimiter` 10/10min/IP, BE/middlewares/security.js:170-176); BE/utils/smsService.js:20 (`generateCode` = `Math.floor(1000+Math.random()*9000)`), :152-160 (3 sends/hr/phone), :212-252 (verify, 5 attempts, 10-min TTL); BE/controllers/authController.js:880-985 (send/verify), 973-979 (marker `otp-verified:phone:<91XXXXXXXXXX>` TTL 1800s), 228-242 (marker consumed at signup).
Actual: server-side verification is real and is a precondition of web signup (:249-251). Weaknesses: (a) 4-digit code from non-CSPRNG `Math.random`; (b) attempt counter is read-modify-write in cache -> parallel guesses can exceed 5 (bounded by IP limiter); each re-send resets attempts, so ~15 guesses/hr/phone => ~0.15%/hr success against a chosen number; (c) marker is keyed by phone only, **not bound to the requester/session/IP** — anyone who knows a phone that has just verified can complete signup with it within 30 min (Low); (d) **email** OTP has no per-address send cap (only per-IP 10/10 min) so a victim mailbox can be bombed (BE/authController.js:904-909); email OTP is 6-digit `Math.random` too; (e) SMS-pumping surface: no CAPTCHA, per-IP only; (f) `otp_rate` window set on send, 3/hr OK.
Expected: CSPRNG codes (`crypto.randomInt`), atomic attempt counting (Redis INCR), marker bound to a signup-session nonce, per-target send caps for email, CAPTCHA/device attestation on SMS send.
Repro (safe): read-only; to test (d) in a non-prod env with `EMAIL_DRY_RUN=1`, POST `send-otp` 10x/10min for one email from one IP and observe no per-target cap. Do NOT run against prod.
Impact: OTP guessing on a chosen number is slow but non-zero; email bombing; SMS cost abuse.
Fix: `crypto.randomInt`, Redis `INCR` attempts with TTL, per-target caps (email 3/hr), 6-digit SMS if DLT template allows, bind marker to a random `signupToken` returned by verify-otp and required at signup.

#### P2-02 Verified mobile "compulsory" not enforced server-side — FAIL, Medium (High if squatting matters)
Evidence: BE/controllers/authController.js:244-251:
`const isNativeClient = String(req.headers['x-app-client']||'').toLowerCase()==='mobile'; if (!isNativeClient && !phoneWasVerified) throw ...`. Header is set by the RN client (MOB api/client.ts:15) and is trivially forgeable; it is also the CORS escape hatch (security.js:424/450).
Actual: any HTTP client sending the header skips phone verification, and **no OTP at all is required** for email or phone on that path (emailWasVerified/phoneWasVerified simply stay false). The account is created `status:'active'` with attacker-chosen unowned email/phone.
Expected: verification proof required for every client, or a signed short-lived app-attestation; legacy-build exemption must be time-boxed and not header-based.
Repro (safe, dev only): POST /auth/signup with `X-App-Client: mobile` and body `{email,password,...}` without any prior verify-otp -> 201. (Do not run on prod.)
Impact: (1) contact squatting — the real owner then hits `send-otp` 409 "account already exists" and is locked out of registering; (2) pre-account hijack: attacker registers victim's email with their own password, later a Google sign-in (`googleAuth` links by email, :1075-1081) attaches the victim's Google identity to the attacker-controlled account without revoking existing sessions/password; (3) mass fake accounts (only signupLimiter 5/hr/IP, `skipFailedRequests`).
Fix: enforce OTP proof server-side for all clients; when linking Google to an existing **unverified-email** account, refuse or reset password + revoke sessions; drop header-based exemption after the build cut-off.

#### P2-03 Email verification — PARTIAL, Low
Evidence: only OTP at signup (`emailWasVerified`, authController.js:230-242) and OTP on email change (:1193-1227). No verification-link flow. `emailVerified` is consumed by invite-reward only (BE/utils/inviteReward.js:168-170) and admin filters — never by login, password reset, or notification sending.
Defects: (a) `send-otp` stores `otp:${target}` with the **raw** target (:908) but `verify-otp` reads `otp:${lowercase(trim(target))}` (:942) -> a mixed-case address can never verify ("OTP expired or not sent"); (b) signup validator runs `.normalizeEmail()` (validators/index.js:70) which for Gmail strips dots/+tags, so the account email differs from the string verified -> marker key `otp-verified:email:<normalized>` (:235) never matches -> `emailVerified=false` although the user did verify; (c) no re-verify prompt for unverified emails; reset emails are sent to unverified addresses.
Expected: single canonical email normalisation at send/verify/signup; verification state that gates sensitive use.
Fix: one `canonicalEmail()` used in all three places.

#### P2-04 Account recovery — PARTIAL, Medium
Evidence: BE/routes/authRoutes.js:70-85, `forgotPasswordValidation` requires `isEmail` (validators/index.js:170-175). `forgotPassword` (authController.js:609-654) generic response (good), token bound to password fingerprint (single use), 1h expiry; `resetPassword` revokes all sessions (:703-704) and mails a security alert.
Defects: (a) **phone-only accounts (email nullable, migration 000041) have no self-serve recovery** — only email support; (b) for an OAuth-only account `user.password` is null -> `crypto.createHash().update(null)` throws (verified: `ERR_INVALID_ARG_TYPE`), so `forgot-password` returns **500 instead of the generic 200** for Google-only emails — an account-existence/sign-in-method oracle and a broken recovery path (latent while Google is off); (c) no phone/OTP-based reset by owner decision.
Fix: guard null password; add phone-OTP reset (OTP already exists) or documented support-verified path.

#### P2-05 Password / passwordless auth — PARTIAL, Medium
Evidence: policy BE/validators/index.js:60-64 (>=8, upper, lower, digit, symbol from `[@$!%*?&]`); model `len:[8,100]` (models/User.js:26-30); bcrypt rounds from config; lockout 5/30 min keyed by `loginLookupKey` (security.js:579-650); constant "Invalid credentials" (authController.js:404-433).
**Defect (verified by running a copy of the function):** `sanitizeObject` (BE/middlewares/security.js:505-535, mounted globally server.js:157) executes `if (obj[key].startsWith('$')) delete obj[key]` on every JSON/urlencoded string. Input `{"password":"$Secret123","bio":"$100k package"}` -> `{}`. `$` is in the permitted symbol set, so a user choosing a password that **starts with `$`** gets "Password is required/at least 8 chars" on signup and can never log in; free text (bio, education, "₹"-less "$..." strings) is silently dropped. Multipart routes (PUT /profile/me) are unaffected because multer runs later.
Expected: NoSQL-operator stripping applies to object **keys**, not user string values (Sequelize/SQL is not vulnerable to `$` values anyway).
Fix: remove the value-prefix branch (lines 519-522, 526).
Passwordless: none by owner decision (Info).

#### P2-06 Session issuance / expiry / revocation / logout — PARTIAL (mostly PASS), Low
Evidence: cookies httpOnly, `Secure` unconditional in prod, `SameSite=strict` prod (authController.js:21-36); access 15 min + refresh 7d (hashed at rest, RefreshToken.hashToken), rotation with reuse detection revoking the family (:482-504); logout/logout-all/revoke-session/password-reset/password-change revoke refresh rows (:555-585, 703, 753-775, 828-848); status re-checked per request (middlewares/auth.js:57-59) and on refresh; sockets re-check status at handshake.
Gaps: (a) access-token `sid` is read (auth.js:71) but never checked against a revoked session -> a stolen access token stays valid <=15 min after logout/revoke/password change; (b) sessions renew indefinitely (each rotation mints a fresh 7d expiry in same family) — no absolute lifetime; (c) already-connected sockets are not disconnected on logout/erasure/ban (status checked only at handshake).
Fix: check `sid` row isRevoked in `auth` (cache 30s), absolute family lifetime (e.g. 30-90d), disconnect sockets on revoke/erase.

#### P2-07 Consent capture (version + timestamp) — PARTIAL, Medium
Evidence: BE/models/User.js:70-82 (`termsAcceptedAt`,`termsVersion`), constants/legal.js:10 (`TERMS_VERSION '2026-08-26'`), authController.js:266-267 (signup), :1094-1095 (Google), migration 000062. Web checkbox FE CreateAccountStep.jsx:350-360; RN CreateAccountScreen.tsx:87,116,233.
Actual: the server stamps consent **unconditionally at account creation**; no `termsAccepted:true` field is required or validated (grep: no `acceptTerms`/`account_agree` anywhere in BE). A direct API/old-client signup is stamped "accepted". Google sign-up is implied by a notice on the login page. Nothing reads `termsVersion` again: **no re-consent** when `TERMS_VERSION` changes; the version constant must be bumped by hand in 3 places. No IP/UA/consent-text hash; no separate consent for special/sensitive data (caste, religion, horoscope) vs. marketing; guardian flow: consent given by the operator, not the profile subject.
Expected: explicit boolean asserted in the request (400 if false), stored with version + IP/UA; middleware that forces re-acceptance when `user.termsVersion !== TERMS_VERSION`; separate optional consents.
Fix: add `termsAccepted` to `signupValidation`; add `POST /auth/accept-terms`; compare versions in `/auth/me` and return `requiresReconsent`.

#### P2-08 Marriageable-age validation at registration — FAIL, High
Evidence: **Published**: FE/pages/Terms.jsx:93 "21 years or above if you are a man, 18 years or above if you are a woman"; FE/pages/Privacy.jsx:227 same; Terms.jsx:123 requires subject to be of legal age. **Enforced**: BE/validators/index.js:88-102 (`age < 18` for all, plus `>120`), BE/models/Profile.js:44-50 (`isOldEnough` <18), FE BasicInfoStep.jsx:58 (`validateAge(dob,18,100)`), FE DobField.jsx:63 (`minAge=18`), MOB BasicsScreen.tsx:149 and CompleteBasicsScreen.tsx:158 (`age < 18`). Age math uses `(now-dob)/(365.25d)` (off by up to ~1 day around the birthday).
Actual: men aged 18-20 can register; `gender:'other'` has no defined threshold. Mobile signup omits DOB (validator `optional`), so the check is deferred to onboarding; Google signup collects **no** DOB (see P2-09).
Expected: a single server-side rule (male >=21, female >=18, other/undisclosed: pick the stricter or route to manual review) enforced at signup AND profile update, matching the published text; use calendar-accurate age.
Repro: POST /auth/signup with gender `male`, DOB 19 years ago -> accepted. (dev only)
Impact: policy/legal exposure (Prohibition of Child Marriage Act framing the Terms themselves invoke); the platform's own published rule is unenforced.
Fix: shared `constants/age.js` + `assertMarriageableAge(gender,dob)` in validator and Profile model hook; align copy or rule (owner/counsel call which is intended).

#### P2-09 Age validation on profile updates — PARTIAL, Medium
Evidence: PUT /profile/me validator BE/validators/index.js:214-218 (`isISO8601` only); the sole age check is the Profile model validator (models/Profile.js:44-50) which does run on `profile.update()` (server-side, PASS for <18). Google signup writes `gender:'other'` and `dateOfBirth: new Date('2000-01-01')` (authController.js:1098-1105).
Gaps: no upper bound on update (DOB 1900 accepted -> age 126; signup caps 120); the gender-conditional rule is absent; Google-registered accounts carry a **fabricated DOB (age ~26) and gender `other`**, and the first later PUT that supplies a firstName flips `onboardingComplete=true` (profileController.js:348-355) because the placeholder DOB/gender satisfy the triple — so the account can appear in search with an invented age without the person ever entering one (latent: Google OAuth currently unset).
Fix: leave DOB/gender null for Google signups (as email signup does); add max-age; gender-conditional rule.

#### P2-10 DOB / gender change abuse — FAIL, Medium
Evidence: `dateOfBirth` and `gender` are in `PROFILE_EDITABLE_FIELDS` (BE/constants/profileFields.js:44-45); updateProfile applies them with no cooldown, no change counter, no audit row (profileController.js:207-242, 358); `criticalFields` only prevents clearing gender/name, not changing them. `logAudit` is not called on profile edits.
Actual: a user can change DOB and gender any number of times (e.g. register at 18, edit to 26; or flip gender to change which age threshold would apply once P2-08 is fixed). The Verification "approved" status is unaffected by such changes (P3-13).
Expected: DOB/gender locked after onboarding or change-limited (e.g. once, via support), every change audit-logged with old/new value hash and IP.
Fix: make DOB/gender immutable post-`onboardingComplete` except through admin/support; write `AuditLog` rows; re-queue verification on change.

#### P2-11 Profile creation by self/parent/sibling/relative/authorised rep — PARTIAL, Medium
Evidence (trace): FE ModernOnboarding.jsx:63 (`mode='create_for_other'`), CreateAccountStep.jsx:379-434 (creatingFor: self/parent/sibling/child/relative/friend; fields "Profile Owner's Email/Phone/Password"), OnboardingContext.jsx:236-243; submit path FE ModernOnboarding.jsx:263-337 -> `POST /auth/signup` (no endpoint of its own; authController.js:339-341 comment) -> `PUT /profile/me` -> `POST /guardian/invite` (only if `yourEmail` given).
Actual: `creatingFor` and `relationshipToProfile` are sent inside the signup body but **ignored by the validator/controller** — never persisted on Profile/User. The only server trace is `GuardianLink.relationship`, and only when the operator typed their own email. Account holder = whoever knows the password. The Terms claim "the person knows and has agreed" (Terms.jsx:123) has no server-side evidence; no candidate-side acceptance/handover; other members cannot see "managed by family". For the guardian path the phone OTP verifies control of the number entered ("Profile Owner's Phone"), i.e. proves the operator holds a phone, not that the subject consented. No age/consent attestation about the subject beyond DOB.
Fix: persist `createdFor`/`managedBy` on Profile; record an attestation checkbox ("subject is of legal age and consents") with timestamp; provide a "hand over to the profile owner" flow (owner sets own password/phone).

#### P2-12 Guardian ownership/authz — PARTIAL, Medium
Evidence: BE/routes/guardianRoutes.js (all routes `auth`; UUID param validation); reads scoped by `GuardianLink{candidateId,guardianId,status:'active'}` (:172-176, 199-201) — **IDOR-safe, read-only, minimal fields** (name/city/completion; matches: name/city). Revocable by either party (:132-145).
Defects: (a) `POST /guardian/invite` **auto-links `active` with no acceptance** whenever the email belongs to an existing user (:88-107) — consent of the guardian is not sought; (b) for unknown emails a `pending` link + 32-byte token is stored but the token is **never delivered** (no email is sent, response text says "they will see the link when they join") and **no client or signup code calls `resolve-invite`** (grep across BE/FE/MOB: only routes file + limiter test) -> pending invites are a permanent dead end; (c) `activeCount` counts `pending` regardless of `inviteExpiresAt` (:75-79) so 3 expired pendings block the 3-guardian cap forever; (d) `User.findOne({where:{email}})` is case-sensitive (:88) so `Foo@x.com` for an existing `foo@x.com` user silently becomes a dead pending; (e) guardian match/shortlist lists don't filter blocked/inactive counterparties (:206-245); (f) guardians can neither act nor message (by design) — "authorised representative" acting rights (edit/respond) do not exist.
Fix: send the invite email (token link) and call resolve on signup/login; expire pendings; lowercase; require guardian acceptance for existing users.

#### P2-13 Unique account/phone; duplicates — PARTIAL, Low
Evidence: email `unique` (models/User.js:14) ; phone: **model has no `unique`** but partial unique index `users_phone_unique` (migration 000041) exists; stored canonical form is bare 10-digit (validator `^[6-9]\d{9}$` at validators/index.js:80-83 + model check) and `sendOtp`/`assertPhoneFree` check all variants (authController.js:893-897, 991-1001). Race handled by `SequelizeUniqueConstraintError` -> 409 (:313-315). Erased users free phone (NULL) and email (tombstone).
Gaps: `send-otp` 409 and `signup` 409 confirm registered emails/phones to unauthenticated callers (account-enumeration, only IP-limited — accepted by design per CLAUDE.md but it also enables squatting, see P2-02); no duplicate-person heuristics (same photo/DOB/name across accounts); `signupLimiter skipFailedRequests:true` makes 409 probes free.
Fix: generic OTP response for existing contacts + "sign in" hint out-of-band; optional duplicate-photo hash.

#### P2-14 Input validation & abuse prevention — PARTIAL, Low
Server-side: express-validator on signup/login/reset/refresh/OTP/profile; `sensitiveActionLimiter` (10/h/user) on delete; signup 5/h/IP; OTP 10/10min/IP; per-phone 3/h; lockout by identifier. Gaps: see P2-01 (email OTP), P2-14a body `password` has no max length at the validator (model `len:[8,100]` fires later; bcrypt truncates at 72 bytes but a 10 MB body still costs parse time); P2-14b OTP `code` `isNumeric` 4-6 digits fine; P2-14c signup name regex `[a-zA-Z\s'-]` rejects non-Latin names (Devanagari/Gurmukhi) — usability for Hindi/Punjabi users (Info); P2-14d MarketingLead insert on referral uses `${firstName} ${lastName}` which are `undefined undefined` for RN signups (data quality, Info).

#### P2-15 Save-and-resume — PASS, Info
Web: `onboarding_draft` + `onboarding_step` in localStorage, password excluded (FE context/OnboardingContext.jsx:71-88, comment at :76); account created only after OTP + password. RN: `onboardingComplete` server-derived (authController.js:56) and `PUT /profile/me` flips it one-way (profileController.js:348-355); journey resumes at first incomplete step. Server has no draft store (a cleared browser loses in-progress signup — acceptable).

#### P2-16 Profile-completion calculation — PASS, Info
`calculateCompletion` (profileController.js:47-129): weights sum to 100 (35/50/15), presence checks over fields that are validated on write, `bio>=20 chars`, trimmed strings; server-recomputed on every GET/PUT (`getMyProfile` writes on read, :149-152 — side effect on a GET, Info). `completionPercentage` excluded from `PROFILE_EDITABLE_FIELDS` so not client-settable. Note: weight (a sensitive field) contributes +4; `photos>0` counts without a `profilePhoto`.

#### P2-17 Phone/email change requires re-verification — PASS, Low
Phone: `POST /auth/contact-number/request|verify` (authController.js:1006-1036) — OTP to the **new** number, uniqueness (`assertPhoneFree`), then `User.update({phone,phoneVerified:true})`; the generic profile route cannot change phone/email (not in allowlist). Email: password + OTP to the new address (:1154-1227). Low gaps: no security alert to the old email/number on either change, no session revocation, phone swap needs no password (session-only); `verifyContactNumber` skips `assertPhoneFree` race (DB unique index backstops -> surfaces as error).

---------------------------------------------------------------------------------------------------
### PHASE 3

#### P3-01..P3-05 Data model coverage vs. requested schema (BE/models/Profile.js, constants/profileFields.js, validators/index.js:203-353)

| Group | Present | **MISSING** |
|---|---|---|
| Personal | firstName, lastName, gender(male/female/other), dateOfBirth, height(cm), weight(kg), maritalStatus enum, numberOfChildren, motherTongue, languages[], city, state, isNri/residenceCountry/residenceStatus/familyLocation | **nationality/citizenship; relocation willingness; previous-marriage details (year, reason, children living with whom); disability/health disclosure (optional); country for non-NRI; area/pin; native place** |
| Cultural | religion, caste, subCaste, gotra (all free-text, optional), manglikStatus enum, zodiac/rashi/nakshatra, birthTime, placeOfBirth | **controlled vocab (free text -> fragmented data)**; birthTime format check (`HH:MM` documented but validator only length<=20); kundli optional upload was removed |
| Education/career | education (free text), degree, profession, income (int, no unit/period/currency) | **institution, industry, employer/company, designation vs. occupation, work city, income period (annual/monthly)** |
| Lifestyle/family | diet, smoking, drinking (enums), interestTags[<=20], bio(<=1000), familyType, familyStatus, father/motherOccupation, numberOfSiblings, familyPreferences JSON, lifestylePreferences JSON, skinTone | **living arrangement (with parents/alone/with family), sibling breakdown (married/unmarried), family values/religiosity as typed field, hobbies as a structured field (only tags), pets/fitness** |
| Partner preferences | preferredAgeMin/Max (18-99), preferredHeightMin/Max, preferredEducation (single free-text), preferredProfession (single), preferredCity[] | **marital-status pref, religion/caste/community pref, income pref, diet/smoking/drinking pref, manglik/horoscope pref, mother-tongue pref, relocation pref, family-type pref, "must-have vs preferred" priority for any dimension**; search has income/religion/caste filters but they are not stored as reusable preferences except `savedSearches` |

Statuses: P3-01 PARTIAL (Low), P3-02 PARTIAL (Low), P3-03 PARTIAL (Low), P3-04 PARTIAL (Low), **P3-05 FAIL (Medium)**.
Also in P3-05: `preferredHeightMin/Max` (and `preferredCity`) have **no validator at all** (validators list lines 203-353 has none; only `preferredAgeMin/Max` 18-99). Non-numeric input reaches Postgres INTEGER -> 500 (Sequelize `typeValidation` is off); min>max is not checked for height, and for age the model check (Profile.js:113-121) only fires when `preferredAgeMax` is among the changed fields (Sequelize validates changed fields only), so a PUT with only `preferredAgeMin` above the stored max is accepted. Fix: add `isInt({min:100,max:250})`, cross-field min<=max (like `searchValidation` does for search, validators/index.js ~400-415).

#### P3-06 Age computed from DOB — PASS
No `age` column; age derived at query time (searchController.js:104-120 DOB range) and in clients. Precision: Profile.js:45 and validators use `/365.25` (Low).

#### P3-07 Server-side enum/range/nullability — PARTIAL, Low
Enums enforced twice (validator `isIn` + DB ENUM): gender, skinTone, diet, smoking, drinking, maritalStatus, manglikStatus, familyType, familyStatus. Ranges: height 100-250 (validator) vs model 100-250; **weight validator 30-300 but model 30-250 -> 251-300 passes validator then fails model**; income 0-1e8; siblings/children 0-20. Gaps: preferredHeight* / preferredCity (above); `languages` items and `interestTags` items only length-checked for tags; JSONB blobs unschema'd (see P3-14); `city` NOT NULL default 'Chandigarh' (a cleared city becomes ''); age max on update (P2-09).

#### P3-08 Optional fields genuinely optional — PASS
Everything except firstName/lastName/gender/dateOfBirth/city is nullable; empty string coerces to null for enum/int (NULLABLE_NONSTRING_FIELDS, profileController.js:247-249). `criticalFields` cannot be cleared (:251-256) — by design.

#### P3-09 Sensitive-data minimisation — FAIL, Medium
Evidence: `getProfile` returns `profile.toJSON()` of the **entire** row to any authenticated viewer who passes the visibility gate (profileController.js:649-736), with only photos/voice/video/contact/social links redacted. Search (:243-253 of searchController.js) and daily (matchController.js:331) do the same minus a few JSON columns. Exposed to strangers: **exact `dateOfBirth`, `birthTime`, `placeOfBirth`, exact `income`, `weight`, `familyLocation`, `showPhone/showEmail/incognitoMode/profileVisibility/showOnlineStatus/showLastSeen`, `completionPercentage`, `lifestylePreferences` (which embeds the member's private `savedSearches`), `quizAnswers`**.
Also: `income` range filters in `searchValidation` allow **binary-search inference of an exact income** even if the field were hidden; `skinTone` is collected (colourism attribute) with no stated need.
Expected: return derived `age` (not DOB), income band, hide birth details unless mutual/premium-consented; strip owner-private JSON (`savedSearches`).
Fix: introduce a `toPublicProfile(viewerContext)` serializer used by getProfile/search/daily/by-code/likes; delete keys not needed by the card.

#### P3-10 Mass-assignment — PASS
`PROFILE_EDITABLE_FIELDS` is the single allowlist for both the validator stripper (validators/index.js:334-346) and the update loop (profileController.js:207-242). `onboardingComplete`, `completionPercentage`, `isActive`, `verified`, `userId`, `profileVisibility` (has its own endpoint) are not settable via PUT /me. Photo fields limited to the member's own gallery (:331-337). `role/status/plan` are not reachable.

#### P3-11 Profile change -> search index / recommendations — PARTIAL, Medium
Search is a live SQL query over `Profiles` (no separate index) -> instantly consistent. `GET /match/daily` caches the **whole ranked profile JSON** per viewer per IST day (`daily-matches:v2:<viewer>:<date>`, matchController.js:370-373) and **nothing invalidates it**: `invalidateUser` (BE/utils/cache.js:245) is referenced only by a test comment — dead code; `delPattern('user:…')` would not match the key anyway. Consequences: edits, `matches_only`, incognito, photo-blur toggles, blocks, deactivation and account **erasure** are not reflected for up to ~24h in any viewer's cached set.
Fix: key the cache by candidate **IDs only** and re-hydrate + re-gate per request, or purge on profile-write/privacy/block/erase (SCAN `daily-matches:v2:*` is expensive; ID-only caching is cleaner).

#### P3-12 Users can edit / hide / remove eligible info — PARTIAL, Medium
Edit: yes (PUT /profile/me; clearing = '' / null). Hide: only whole-profile `matches_only`, `incognitoMode` (removes from search), photo blur, per-link social-link visibility. **No per-field hide** (income, DOB, caste, horoscope, family). Remove: gallery/profile photo delete (Cloudinary destroy on images works; **voice/video intro destroy silently fails**, see P8-07), voice/video delete endpoints exist.

#### P3-13 Verified-badge integrity — FAIL, Medium
Evidence: badge = existence of `Verification.status='approved'` (profileController.js:160-164, 701-705; searchController verifiedUserIds). `updateProfile` never touches Verification. Approval compares a live selfie with the profile photo **at review time**.
Actual: after approval a member can replace the profile photo, name, DOB, gender (P2-10) and keep the "Verified" badge — the badge stops meaning "this person matches this profile".
Fix: on change of `profilePhoto`/name/DOB/gender set Verification to `stale`/require re-verification (or hash the approved photo and compare).

#### P3-14 Free-text and JSON sanitisation — PARTIAL, Low
Tag-stripping (`/<[^>]*>/g`) covers only the `freeTextFields` list (profileController.js:230-238) — it excludes `spotifyPlaylist`, `interestTags` items, `languages` items, `preferredCity` items and all JSONB (`profilePrompts`, `personalityValues`, `familyPreferences`, `lifestylePreferences`, `quizAnswers`) which are stored raw and later rendered to other members (profilePrompts is also echoed into notifications/like snapshots). Body limit is 10 MB (config MAX_REQUEST_SIZE) with no per-field size caps -> storage abuse. React escapes on render (no XSS confirmed), but PDFs/emails/notifications interpolate some of these. `spotifyPlaylist` is not URL-validated (`javascript:` scheme risk depends on FE render — NOT VERIFIED).
Fix: schema-validate JSON (zod/Joi), cap sizes, strip tags on all string leaves, validate URLs.

---------------------------------------------------------------------------------------------------
### PHASE 8

#### P8-01 Profile visibility levels — PARTIAL, High
Implemented: `Profile.profileVisibility` enum(everyone|matches_only) (models/Profile.js:313-318), `PUT /profile/privacy` (profileController.js:1098-1120; RN PrivacySettingsScreen, web Settings.jsx:560-674); enforced in `getProfile`/`compatibility`/`horoscope`/`kundli` through `assertProfileVisible` (:508-572) and in search (searchController.js:71-95). Gaps:
(1) **`/match/daily` does not filter `matches_only` or incognito profiles** (matchController.js:258-345: where = isActive/gender/not-interacted/not-blocked only).
(2) **`GET /search/by-code`** (searchController.js:548-615) checks isActive + blocks only — no `profileVisibility`, no user `status` — and returns name/DOB/city/profession/photo for a `matches_only` member.
(3) **`POST /match/:userId`** (matchController.js:23-256) checks blocks only: no target status/visibility/existence check, no self check (raw-SQL upsert bypasses the model hook at models/Match.js:56-60, so a self "like" then reverse-lookup finds the same row and marks a **self mutual match**); a like on a `matches_only`/inactive/banned target fires a "X liked your profile" notification to them.
(4) Likes/shortlist/mutual lists (matchController getLikes/getShortlist) return the counterparty `profilePhoto` without `photoBlurUntilMatch` redaction.
Repro (safe, dev with two seeded users): set user B `matches_only`; as A, GET /match/daily (B appears if ranked), GET /search/by-code?code=TCS-<B prefix>, POST /match/<B>. Compare with GET /profile/<B> (403 PROFILE_MATCHES_ONLY).
Fix: single `visibleTo(viewer)` scope used by every listing/lookup; add `assertProfileVisible` to `matchAction` (+ self/self-status check).

#### P8-02 Separate visibility for photo / phone / income / sensitive — PARTIAL, Medium
Photo: `photoBlurUntilMatch` honoured in getProfile and search (getProfile :655-658; search :332-334) — **not** in daily/likes/shortlist lists (P8-01). Phone: only a `phoneVerified` number ever revealed and only after a paid unlock (profileController.js:672-688, 819-825) — good. **`showPhone`/`showEmail` are dead controls**: stored/editable (PROFILE_EDITABLE_FIELDS) but never read anywhere (grep) — a member who leaves/sets "don't show phone" is still revealed on unlock; unlock also reveals the **email** (unverified, arbitrary) regardless (:815, 860, 944, 960). Income/DOB/birth details/caste/horoscope: no visibility control (P3-09). Social links: per-link visibility (everyone/matches_only/hidden) enforced in getProfile (:693-696) but **not** in daily (raw row).
Fix: honour `showPhone`/`showEmail` at unlock (or delete the toggles); add `incomeVisibility`/`birthDetailsVisibility`.

#### P8-03 Last-seen / online — PARTIAL, Low
Online: `get-online-status` (socket/socketHandler.js:381-438) restricts to allowed peers and requires target `showOnlineStatus:true` — PASS. `showLastSeen`: persisted and shown in UI but **no last-seen value is stored or emitted anywhere** (no `lastSeen` in BE) — the setting is a no-op (Info; harmless but implies a control that does nothing).

#### P8-04 Consent withdrawal & marketing preferences — PARTIAL, Low
Email: signed-link unsubscribe / resubscribe (`POST /api/v1/email/unsubscribe|resubscribe`, RFC 8058) stops checkout follow-up, photo nudge, win-back, digest; transactional exempt. No in-app toggle; no push categories (`DEL /notifications/fcm-token` only); no "withdraw sensitive-data consent" action (Privacy.jsx:205 says clear the field or delete the account — true for fields; consent to processing of caste/religion is not separately recorded so cannot be separately withdrawn). RN "Notification Preferences" opens the inbox (noted in CLAUDE.md).

#### P8-05 Account pause / hide / delete / recovery — PARTIAL, Medium
Delete: `DELETE /auth/account` (authController.js:853-875; UI FE Settings.jsx:979, RN SettingsScreen.tsx:269, public page FE pages/DeleteAccount.jsx). **Pause/deactivate: absent** (no user-facing `isActive` toggle; `matches_only`+incognito are partial substitutes). **Recovery: none** — erasure is immediate and irreversible with no grace period; a stolen session + password (or a shoulder-surfed one) can erase a paid member irretrievably. **Google-only accounts cannot delete**: route requires `password` (authRoutes.js:207-211 `notEmpty`) and `user.comparePassword(password)` with a null hash rejects (`bcrypt.compare(x,null)` -> "Illegal arguments", verified) -> 500. Latent while Google is off; the RN Settings comment (SettingsScreen.tsx:91) shows the constraint is known.
Fix: re-auth by password OR fresh OTP/Google credential; 7-14 day soft-delete window with cancel link; add pause.

#### P8-06 Access / correction / erasure requests — PARTIAL, High
Correction: self-serve (profile editor). Erasure: self-serve except Google-only (above). **Access: no self-serve or admin-served endpoint** (no `/me/export`, no admin "subject access" tool; grep for export routes shows only `GET /admin/users/export` = member roster CSV). Policy promises 30-day email handling (Privacy.jsx:207) — process is manual and untested in code. Nominee right (Privacy.jsx:205) "we will record it" — no storage for it (NOT VERIFIED; no model/route found).

#### P8-07 Deletion propagation — FAIL, High
Evidence: BE/utils/accountErasure.js:56-155 (transaction over Profile, Verification, GuardianLink, ProfileView, Match, ContactUnlock, Notification, CallSession, AnalyticsEvent, ChatGrant, Block, GroupMember, RefreshToken; tombstones Message/GroupMessage bodies; scrubs Users row). `grep deleteFromCloudinary` shows it is called only from profile/photo/voice/video controllers — **never from erasure**.
Not propagated:
1. **Cloudinary**: profile/gallery photos, voice+video intro, **verification selfie + liveness video** (uploaded as public `type:upload` assets, upload.js:113-135 — no `authenticated`/`private` delivery), voice-message media. URLs remain live and publicly fetchable after "deletion". (Message `mediaUrl` is nulled in DB but the object stays.) Even manual `DELETE voice-intro/video-intro` does not remove the asset: `deleteFromCloudinary` calls `cloudinary.uploader.destroy(publicId)` with the default `resource_type:'image'` (upload.js:390) while these are `resource_type:'video'` uploads -> result "not found", silently ignored (error only logged in dev).
2. **Redis**: `daily-matches:v2:<otherViewer>:<date>` embeds the erased member's full profile JSON (name, photo URLs, DOB, income, …) and is served until IST midnight (P3-11). Deleted profile also remains in other viewers' caches after block/hide.
3. **DB rows retained beyond disclosure**: `MarketingLeads` (name, phone, email; `convertedUserId`) for referred signups; `ContactMessages` (name/email/phone/message; may be legitimately kept but undisclosed); `SuccessStories` (couple names/photo, submitter-linked); `AstrologerBookings`/`UnlockPurchases`/`Subscriptions` (financial — disclosed); `Reports` free-text (disclosed); `AuditLogs` `details` JSON (may carry email/phone — NOT VERIFIED which callers); `Users` scrub leaves `referralCodeUsed`, `referredByMarketingUserId`, `invitedBy`, `termsAcceptedAt/Version`, `lifecycleMail` (low sensitivity).
4. **Processors** (Resend delivery logs, MSG91 logs, Razorpay customer records, Agora, FCM): no propagation or documented request path — NOT VERIFIED/N-A in code.
5. Live sockets remain connected (P2-06c).
Also `hardDeleteUsers` (admin) has the same Cloudinary/cache gaps.
Fix: iterate the member's asset URLs (`resource_type` per asset, `invalidate:true`) inside erasure with retry queue; purge/ID-cache design (P3-11); erase or anonymise MarketingLead PII; disconnect sockets; add processor-deletion checklist.

#### P8-08 Retention exceptions — PASS, Info
Financial (Subscriptions, UnlockPurchases) and Reports retention is implemented (accountErasure.js header) and disclosed (Privacy.jsx:184-192). The 180-day preservation and CERT-In log retention statements are policy only (no job) — NOT VERIFIED beyond copy.

#### P8-09 Data export — FAIL, High (compliance / honesty)
No route, controller or UI for exporting a member's own data (searched routes/controllers/FE/MOB). Yet FE CreateAccountStep.jsx:342 (consent notice) says "You can see, correct, export or erase it at any time"; Privacy.jsx s.14 promises manual fulfilment in 30 days. Either implement `GET /auth/me/export` (profile, matches, messages authored, sessions, consents, purchases as JSON/ZIP with rate-limit + re-auth) or reword the consent copy.

#### P8-10 Session management & suspicious-login controls — PARTIAL, Low
PASS: `GET /auth/sessions` (UA, IP, created, lastUsed, isCurrent via `sid`), `DELETE /auth/sessions/:id` (ownership-scoped, UUID-validated), logout-all, reuse-detection family revoke, lockout 5/30 min, security alert email after password **reset**. MISSING: no alert on **new-device login**, password **change**, email/phone change, or session revoke; no login-history/IP-geo anomaly detection; no 2FA/step-up for erasure or phone swap; lockout is a DoS lever against a known identifier (Info).

#### P8-11 Privacy enforced in API responses/queries/exports/logs/WS — FAIL, High
(a) `/match/daily` — see P8-01, P3-09, P3-11. Everything in the row is returned: e.g. `voiceIntroUrl`, `videoIntroUrl`, `socialMediaLinks` (owner-hidden links included), `lifestylePreferences.savedSearches`, `quizAnswers`, birth data (matchController.js:331-343; no `attributes` exclusion, no redaction).
(b) **Search leaks voice/video intro URLs to free viewers** — the PERF-1 exclude list (searchController.js:243-253) omits `voiceIntroUrl`/`videoIntroUrl`, while getProfile deliberately nulls them for non-mutual non-premium viewers (profileController.js:665-668). Paid-feature bypass + privacy.
(c) `by-code`, matchAction (P8-01).
(d) Logs: redaction masks secret-like keys (logger.js:28-52) but not email/phone; e.g. `log.info('[OTP] Sent via … to <phone>')` (smsService.js ~187), guardian invite `log.info(... {email})` (guardianRoutes.js:120), so phone/email land in app logs in prod.
(e) WebSocket: PASS — handshake status check, mutual+premium-gated `join-room`, membership-gated groups, presence gated (socketHandler.js:80-118, 220-274, 340-438).
(f) Admin export (`GET /admin/users/export`, adminController.js:815-855): scoped + audited (`users_exported`), 5000-row cap; `esc()` neutralises commas/quotes only — emails beginning `=`,`+`,`-`,`@` are a CSV/formula-injection vector (names are regex-limited, emails are not) — Low.
(g) Errors: generic constant messages on auth paths (PASS); OAuth-only branches 500 (P2-04/P8-05).

#### P8-12 Leaks via errors / analytics / notifications / caches — PARTIAL, Medium
Analytics: `AnalyticsEvent` carries userId + event type only, no contact data (trackEvent.js header) — PASS. Notifications: text includes the actor's full name and (for likes) the note body; no server push of private profile fields (PASS). Caches: daily-matches (P3-11/P8-07). The `otp-verified:*` marker (P2-01c) is a cross-request capability keyed on a public identifier.

---------------------------------------------------------------------------------------------------
## 3. Workflow maps (actual implementation vs. missing transitions)

### 3.1 Registration (web, self)
```
Home/Login ─▶ /onboarding
  Step 1 CreateAccountStep (FE steps/CreateAccountStep.jsx)
     identifier (email|10-digit mobile) ─▶ POST /auth/send-otp  [BE authRoutes:101; otpLimiter 10/10m/IP;
                                          409 if account exists (enumeration); phone: smsService 4-digit, 3/h/phone;
                                          email: 6-digit, NO per-target cap; key otp:<raw target>]
     enter code ─▶ POST /auth/verify-otp  [5 attempts, 10m TTL; sets otp-verified:<kind>:<contact> for 30m — NOT bound to requester]
     password + consent checkbox (client-only; server never receives an assertion)
  Step 2 BasicInfoStep: names, gender, DOB (client age>=18)
  ─▶ POST /auth/signup [signupLimiter 5/h/IP; validator: age>=18 flat (MISSING 21M/18F); phone bare-10-digit;
        requires phone marker unless header X-App-Client: mobile  ◀── BYPASS (P2-02)]
        tx: User(status active, terms stamp = now, version const) + Profile(onboardingComplete=firstName&&gender&&dob)
        post-tx: founding grant, invite reward, welcome email, refresh row + access JWT(sid), httpOnly cookies
  ─▶ preview card ─▶ Dashboard ─▶ profile editor (PUT /profile/me, multipart, allowlist)
MISSING transitions: email-link verification; server-side terms assertion; re-consent on version bump;
  gender-conditioned age gate; duplicate-person check; signup-session binding of OTP proof.
```
Guardian variant: same endpoints; `creatingFor` dropped server-side; after account+profile PUT, `POST /guardian/invite {yourEmail}` -> active link if that email is an existing user (no acceptance), else dead pending (no token mail, no resolver caller). MISSING: subject consent record, hand-over to owner, "managed by" flag.
Native (RN new build): `CreateAccountScreen` (contact+OTP+password+Terms) -> `BasicsScreen` (DOB slash auto-insert, client age>=18) -> `POST /auth/signup` (header `X-App-Client: mobile` -> exempt from phone-proof) -> Main; steps 2-12 journey modal with server-derived resume. Google: `POST /auth/google` creates account with **fabricated DOB 2000-01-01 + gender other**, terms stamped implicitly, no OTP/phone.

### 3.2 Profile completion
```
PUT /profile/me [auth, profileUpdateLimiter 10/min, uploadLimiter 20/h, multer, magic-byte check, validator+stripper]
  loop over PROFILE_EDITABLE_FIELDS (booleans/arrays/JSON coerced; free-text tag-stripped for a subset)
  DOB/gender: any change accepted (model validator only: age>=18)          ◀── no lock/audit/cooldown
  photos: gallery cap, profilePhoto must come from own gallery
  onboardingComplete: one-way flip when firstName+gender+DOB present
  completionPercentage recomputed server-side; 60% milestone event; notifications
  ── no hook to: re-verify selfie badge, invalidate daily-match caches, audit-log sensitive edits
Read side: GET /profile/:id (assertProfileVisible + redactions) | GET /search (live SQL, visibility filters)
           | GET /match/daily (cached full rows, NO visibility filters) | GET /search/by-code (no visibility filter)
```

### 3.3 Deletion / erasure
```
Settings ▶ Danger Zone ▶ DELETE /auth/account {password}  [auth + sensitiveActionLimiter 10/h]
   password null (Google-only) ─▶ bcrypt throws ─▶ 500   ◀── cannot erase
   ─▶ eraseAccount(): TX
        DESTROY: Profile, Verification, GuardianLink, ProfileView, Match, ContactUnlock, Notification,
                 CallSession, AnalyticsEvent, ChatGrant, Block, GroupMember, RefreshToken
        TOMBSTONE: Messages/GroupMessages content ("[deleted]"), mediaUrl NULL
        SCRUB Users: email->deleted-<uuid>@deleted.invalid, phone NULL, googleId NULL, fcm [], password garbage, status 'deleted'
        RETAIN: Subscriptions, UnlockPurchases, Reports (disclosed)
   ─▶ clear cookies ─▶ 200 "Account deleted successfully"
MISSING transitions: Cloudinary destroy (all asset types, resource_type-aware) | Redis cache purge (daily sets of others embed
  the member's profile) | MarketingLead PII | socket disconnect | grace period + undo | re-auth beyond password |
  processor deletion (Resend/MSG91/Razorpay) | erasure receipt/audit row | admin hardDelete parity
```

### 3.4 Data-subject rights
Access/export: none (manual email). Correction: profile editor (self-serve). Erasure: 3.3. Withdrawal: unsubscribe link (email only); clear field; delete account. Nominee: policy only.

---------------------------------------------------------------------------------------------------
## 4. Safe test methods used / recommended
* Static tracing only for all endpoints above. Executed locally in scratchpad: (1) a verbatim copy of `sanitizeObject` on `{password:'$Secret123', bio:'$100k package'}` -> both keys removed; (2) `bcryptjs.compare('x', null)` -> rejects "Illegal arguments: string, object"; `crypto.createHash().update(null)` -> `ERR_INVALID_ARG_TYPE`.
* Recommended dev-only repros (two seeded accounts, `EMAIL_DRY_RUN=1`, SMS provider `dev`): daily/by-code/matchAction visibility bypass (P8-01), search voice-URL leak with a free viewer (P8-11b), header bypass signup (P2-02), erase then check Cloudinary URL still 200 and `daily-matches` key still present (P8-07), Google-only delete/forgot (needs mocked OAuth).
* NOT VERIFIED (needs live/env access): production values of `OTP_BYPASS_CODES`, Google OAuth config, Cloudinary account settings (delivery type restrictions, EXIF stripping), audit-log call sites carrying PII, Resend/MSG91/Razorpay retention, whether RN shows the DOB slash fix consistently, nominee-right storage.

## 5. Prioritised fix list
1. Single serializer + visibility scope for every profile listing (daily, by-code, likes/shortlist, search voice/video) — P8-01/P8-11/P3-09.
2. Erasure completeness: Cloudinary (video/image), cache design, MarketingLead, sockets — P8-07; Google-only deletion & recovery — P8-05/P8-06.
3. Age policy alignment (21M/18F or change copy) + DOB/gender lock — P2-08/P2-10.
4. Remove header-based OTP exemption; bind OTP proof; fix Google-link pre-hijack — P2-02/P2-01.
5. Export endpoint (or reword consent copy) + re-consent flow + server-asserted consent — P8-09/P2-07.
6. Fix `$`-prefix sanitizer, forgot-password null guard, email OTP normalisation — P2-05/P2-04/P2-03.
7. Verified-badge invalidation on photo/name/DOB change; guardian invite delivery; partner-preference schema.
