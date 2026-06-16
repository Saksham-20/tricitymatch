# User Flows — Production Validation (https://tricityshadi.com)

**Status:** ✅ pass · ❌ fail · 🔄 testing · ⏳ pending · 🚧 blocked
**Method:** live prod API probing with browser Origin header + cookie jars. Validated 2026-06-16 after deploy.

| # | Persona | Flow | Status | Evidence |
|---|---------|------|--------|----------|
| 1 | Visitor | Land on homepage (valid HTTPS) | ✅ | 200, valid cert, http→https 301, new build hash `index-R6Me6bcj.js` |
| 2 | Visitor | Public APIs (plans, success-stories) | ✅ | 200 with Origin |
| 3 | New user | Signup → session | ✅ | 200, user created, `/auth/me` 200 with signup cookie |
| 4 | New user | OTP send + verify | ✅ | send-otp 200; verify `000000`/`123456` (bypass) 200; wrong code 400 |
| 5 | Returning user | Login → /auth/me → logout | ✅ | login 200, /auth/me 200 |
| 6 | Free user | Authed search / match-daily | ✅ | search 200, match/daily 200 |
| 7 | Admin | Login → analytics → users | ✅ | role=admin, /admin/analytics 200, /admin/users 200 |
| 8 | Security | Non-admin → admin endpoint | ✅ | 403 (RBAC enforced) |
| 9 | Security | Unauth → protected | ✅ | 401 |
| 10 | Security | No-Origin → API (CORS) | ✅ | 403 strict (browser Origin allowed) |
| 11 | Integration | Webhook reaches HMAC check | ✅ | subscription/bg-check webhook → 401 signature (not 403) |
| 12 | Paid user | Razorpay payment | ⏳ | config-gated (placeholder keys; ALLOW_INSECURE_PROD) — not testable |
| 13 | Any | Email password-reset delivery | ⏳ | SMTP not configured (placeholder) |

**Verdict:** all testable core journeys PASS on production. Payment + email delivery remain config-gated (need real creds).
