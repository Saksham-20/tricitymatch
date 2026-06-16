# Production Bugs

**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low
**Status:** OPEN · FIXING · FIXED-VERIFIED · DEFERRED · WONTFIX

---

## Open / In Progress
_(none)_

---

## Fixed & Verified

### BUG-P005 🔴 Critical — Entire authenticated read path 403'd in real browser (same-origin no-Origin GET) — FIXED-VERIFIED
- **URL:** every GET API call from the SPA — e.g. GET /api/notifications/unread-count, /api/admin/analytics, /api/success-stories, /api/v1/auth/me, /api/v1/search …
- **Repro (real browser, Playwright):** logged in as admin → redirected to /admin/dashboard; network showed `POST /api/auth/login → 200` but `GET /api/notifications/unread-count → 403` and `GET /api/admin/analytics → 403`. `curl` (no Origin) `GET /api/success-stories → 403 {"code":"FORBIDDEN","message":"Not allowed by CORS"}`; with `-H "Origin: https://tricityshadi.com"` → 200. Homepage console showed the success-stories 403 on first load.
- **Impact:** **THE launch blocker.** Browsers do NOT attach an `Origin` header to same-origin GET/HEAD requests. The SPA and API share the prod origin (tricityshadi.com), so *every* data-fetch GET arrived with no Origin and was rejected by SEC-2's strict no-Origin policy. Users could sign up / log in (POST carries Origin) but then saw **zero data** — dashboard, search, matches, chat, notifications, profile all dead. My earlier curl "passes" were false positives because curl was sending an Origin header the real browser omits.
- **Root cause:** [security.js:191](backend/middlewares/security.js#L191) (`if (!origin)`) 403'd all no-Origin requests in prod, on the false premise "real browser requests always send Origin." True for cross-origin and for writes; **false for same-origin GET/HEAD.**
- **Fix:** switched `strictCors` to a `cors()` per-request **delegate** (`corsDelegate`, sees `req.method`): allow no-Origin for safe methods (GET/HEAD/OPTIONS) + preflight; keep rejecting no-Origin on state-changing methods (browser writes always send Origin; provider webhooks already exempted via monitoringCors). Explicit cross-origin still validated against allow-list. Commit 055a1a6.
- **Validation (live prod):** no-Origin GET → 200 · no-Origin POST → 403 · evil cross-origin GET → 403 · legit-Origin GET → 200. **Real browser re-test:** re-login → `GET /api/notifications/unread-count → 200`, `GET /api/admin/analytics → 200`, dashboard rendered with data, console clean (only the expected pre-login /auth/me 401 probe). **FIXED-VERIFIED**

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
