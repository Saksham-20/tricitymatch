# Production Bugs

**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low
**Status:** OPEN · FIXING · FIXED-VERIFIED · DEFERRED · WONTFIX

---

## Open / In Progress
_(none)_

---

## Fixed & Verified

### BUG-P003 🟠 High — Provider webhooks 403'd by strict CORS (no-Origin) — FIXED-VERIFIED
- **URL:** POST /api/v1/subscription/webhook, /api/v1/verification/bg-check/webhook
- **Repro (prod):** POST with no Origin header → 403 `{"code":"FORBIDDEN","message":"Not allowed by CORS"}`.
- **Impact:** Razorpay payment-confirmation + BG-check callbacks are server-to-server (no Origin). strictCors ([server.js:91](backend/server.js#L91)) ran before the webhook raw-body and rejected them → payment/verification webhooks would silently drop at launch. Latent now (Razorpay placeholder) but a launch blocker for paid flows.
- **Root cause:** SEC-2 hardening made CORS 403 all no-Origin callers; webhook paths weren't exempted (only /monitoring was).
- **Fix:** exempt `*/subscription/webhook` + `*/bg-check/webhook` from strictCors (they authenticate by HMAC signature, not CORS). Commit 482ba2e.
- **Validation:** webhook no-Origin → now 401 "Missing webhook signature" / "Invalid signature" (reaches HMAC check); regular API no-Origin still 403. **FIXED-VERIFIED**

### BUG-P002 🔴 Critical — Every send-otp/verify-otp returns 500 (broken logger import) — FIXED-VERIFIED
- **URL:** POST /api/v1/auth/send-otp, /api/v1/auth/verify-otp
- **Repro (prod):** `send-otp {type:phone,target:+91...}` → 500 INTERNAL_ERROR; backend log: `log.info is not a function` / `log.warn is not a function`.
- **Impact:** Phone OTP signup/login + email OTP entirely broken (500). Masked until now because SMS was never exercised on prod.
- **Root cause:** `middlewares/logger` exports the request-logger middleware as default with the `log` object on `.log` ([logger.js:225](backend/middlewares/logger.js#L225)). `utils/smsService.js:11` did `const log = require('../middlewares/logger')` (the middleware fn), so `log.info/.warn` were undefined. All 9 sibling utils correctly destructure `{ log }`.
- **Fix:** `const { log } = require('../middlewares/logger')`. Commit e427cb7. Rebuilt+recreated backend.
- **Validation:** send-otp → 200; verify-otp `000000`/`123456` → 200 verified; wrong code → 400. **FIXED-VERIFIED**

### BUG-P001 🔴 Critical — Production TLS certificate expired — FIXED-VERIFIED
- **URL:** https://tricityshadi.com (all routes)
- **Repro:** `curl https://tricityshadi.com` → `SSL certificate problem: certificate has expired`. Cert `notAfter=Jun 7 11:15:07 2026 GMT`; now Jun 16 → expired 9 days. App itself HTTP 200 behind it (`-k`) → pure cert failure.
- **Impact:** Every browser shows full-page security interstitial. ~all real users bounce. Total launch blocker.
- **Root cause:** tricityshadi.com renewal misconfigured `authenticator = standalone`, which must bind port 80 — but host nginx already holds :80 (serves all co-tenants). Nightly certbot.timer failed every run: *"Could not bind TCP port 80 because it is already in use."* (log 2026-06-15/16). All 5 co-tenant certs use `authenticator = nginx` and renewed fine.
- **Fix:** `certbot certonly --nginx --cert-name tricityshadi.com -d tricityshadi.com -d www.tricityshadi.com -n` → renewed (now valid Jun 16 → **Sep 14 2026**) AND persisted `authenticator = nginx` in renewal conf so the nightly auto-renew no longer fails. `nginx -t` (passed) → `systemctl reload nginx`. Scoped to tricityshadi only; co-tenants untouched.
- **Validation:** `curl https://tricityshadi.com` (no `-k`) → HTTP 200 ssl_verify_ok. `openssl` dates Jun16→Sep14. http→https 301. `/api/v1/subscription/plans` HTTP 200 over verified TLS.
- **Status:** FIXED-VERIFIED

## Open / Deferred (non-blocking)

### BUG-P004 ⚪ Low — phone validator vs User-model mismatch
- Route `signupValidation` accepts E.164-ish `+?[0-9]{10,15}`, but the `User` model validates "10-digit Indian mobile". A user submitting `+91XXXXXXXXXX` passes the route validator then fails the model with generic 400 "Unable to create account."
- Frontend currently sends 10-digit, so not hit in normal UI flow. **Fix later:** normalize phone (strip `+91`) before create, or align the model regex. DEFERRED.

## Pre-launch removal items (MUST revert before real users)
- `ALLOW_INSECURE_PROD=true` in prod `.env` — re-enable the SMS/SMTP/Razorpay startup guard once real creds exist.
- `OTP_BYPASS_CODES=000000,123456` in prod `.env` — master OTP codes; remove so only real OTPs verify.
- Both are env-only (code defaults to OFF). Backend logs a warning on every boot while active.

## Not-a-bug
_(none yet)_
