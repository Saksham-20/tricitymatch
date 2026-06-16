# Release Scorecard — https://tricityshadi.com

**Date:** 2026-06-16 · **Verdict:** 🟢 CORE READY for controlled launch · ⚠️ payments/email config-gated

| Gate | Status |
|------|--------|
| Valid TLS / HTTPS | ✅ renewed → Sep 14; auto-renew fixed |
| No Critical bugs | ✅ P001 (cert) + P002 (OTP 500) + **P005 (CORS read-path)** fixed |
| No High bugs | ✅ P003 (webhook CORS) fixed |
| **Authed read path works in real browser** | ✅ **P005 fixed** — dashboard/search/admin GETs 200 (was 403 for all) |
| Homepage loads (new build) | ✅ |
| Backend API healthy | ✅ |
| Signup / login / session | ✅ |
| OTP (bypass for testing) | ✅ |
| Admin + RBAC | ✅ |
| Webhook reachability | ✅ (HMAC enforced) |
| Strict CORS (cross-origin still blocked) | ✅ no-Origin GET allowed, no-Origin writes + evil-Origin still 403 |
| Browser UX (35 routes × 3 viewports + 5 flows) | ✅ 0 console errors, no overflow; UX-002 fixed |
| Regression (BE 116 / FE 31) | ✅ green post-fix |
| Payment flow | ⏳ config-gated (Razorpay placeholder) |
| Email/SMS delivery | ⏳ config-gated (placeholders + OTP bypass) |

## Deploy delivered this session
- Prod brought from 36 commits behind → current (HEAD `74cf0f9`).
- **5 prod bugs found & fixed live** (P001 cert · P002 OTP-500 · P003 webhook-CORS · **P005 CORS read-path [the real blocker]** · UX-002 avatar) + 1 deferred low (P004) + UX-003 backlog.
- Build issues fixed to ship: backend `.npmrc` legacy-peer-deps (cloudinary), frontend `terser` dep.
- Full browser UX pass (Playwright) across desktop/tablet/mobile; trackers `browser-qa-*.md`.

## Before onboarding REAL users (blockers for full GA)
1. Remove `ALLOW_INSECURE_PROD` + `OTP_BYPASS_CODES` from prod `.env`.
2. Add real Razorpay / SMTP / SMS creds (then guard re-enables automatically).
3. (Optional) Google OAuth, FCM, Agora (`VITE_AGORA_APP_ID`) creds.

## Can 1,000 real users use it today?
**Yes for core matrimony flows** (browse, signup, login, search, match, admin) over valid HTTPS.
**Not yet for paid upgrades / OTP-by-SMS / reset-email** — those are config-gated on real provider keys, currently bypassed for testing.
