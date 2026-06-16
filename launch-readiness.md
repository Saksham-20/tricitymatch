
# Launch Readiness — Production Validation (Master Source of Truth)

**Target:** https://tricityshadi.com (prod VPS 178.16.138.82, shared host — co-tenants present)
**Started:** 2026-06-16
**Tester:** Claude (Opus 4.8) — production launch readiness mission
**Primary question:** *Can 1,000 real users use this product today without critical issues?*
**Current answer:** 🟢 YES for core flows (HTTPS, signup/login/search/match/chat/admin), now proven in a **real browser** across desktop/tablet/mobile. ⚠️ payments + SMS/email delivery config-gated on real creds (bypassed for testing). 5 prod bugs fixed live (P001/P002/P003 + **P005** + UX-002).

> **2026-06-16 Browser UX pass (gstack browse / Playwright):** all 12 public + 13 authed + 10 admin routes rendered clean (0 console errors, no horizontal overflow at 1440/768/375), all 5 interactive flows passed. **Found + fixed the real launch blocker: BUG-P005** — browsers omit Origin on same-origin GET, so SEC-2 strict-CORS 403'd the ENTIRE authed read path; my earlier curl "passes" were false (curl sent Origin). Fix deployed + re-verified in browser (dashboard/search/admin GETs all 200). Trackers: `browser-qa-progress.md` / `browser-qa-findings.md`.

## Method
Safe/read-only prod testing first. Fix-on-discovery. Shared VPS → scope every command to `tricityshadi.com` / `tricitymatch-*` only. `nginx -t` before any reload.

## Phase Status
| # | Phase | Status | Note |
|---|-------|--------|------|
| 1 | Platform discovery | ✅ | routes/APIs/containers/nginx mapped; prod inventory done |
| 2 | Public website | ✅ | homepage 200 valid HTTPS, public APIs 200 |
| 3 | New-user onboarding | ✅ | signup→session 200; OTP send+bypass verify |
| 4 | Real user journeys | ✅ | visitor/new/returning/admin all pass (user-flows.md) |
| 5 | Forms | ✅ | signup/login validation; phone model-mismatch noted (P004) |
| 6 | Edge cases | ◑ | invalid phone/wrong-OTP/unauth handled; deeper edge cases backlog |
| 7 | API | ✅ | public 200, authed 200, unauth 401, RBAC 403, rate-limit prior |
| 8 | Security | ✅ | TLS, strict CORS, RBAC, IDOR(prior), webhook HMAC, httpOnly |
| 9 | UX review | ✅ | full browser UX pass done — 35 routes × 3 viewports + 5 flows; P005 + UX-002 fixed |
| 10 | Log review | ✅ | surfaced P002 (log.info) + confirmed BGC fail-closed working |
| 11 | Performance | ◑ | TLS handshake ~0.14s, API <0.2s; load test not re-run |
| 12 | Missing-feature audit | ✅ | payment/SMS/email/OAuth/Agora config-gated (documented) |
| 13 | Readiness gate | ✅ | no open Critical/High; see release-scorecard.md |
| 14 | Final E2E | ✅ | signup→login→search→match→logout + admin verified on prod |

## Blockers
- ✅ ALL CLEARED. No open Critical/High.
- ⚠️ Pre-GA (not code): remove ALLOW_INSECURE_PROD + OTP_BYPASS_CODES; add real Razorpay/SMTP/SMS creds.

## Findings log
- **P005** (Critical, FIXED): same-origin no-Origin GET 403'd the entire authed read path in real browsers (whole SPA showed zero data). Switched strictCors to a method-aware delegate: allow no-Origin GET/HEAD/OPTIONS, reject no-Origin writes. Deployed + browser-re-verified. See production-bugs.md.
- **UX-002** (Low, FIXED): astrologer avatar placeholder 404 — added avatar-placeholder.svg. Deployed + verified.
- **P001** (Critical, FIXED): TLS cert expired Jun 7 — renewal misconfigured `standalone` (port-80 clash on shared nginx). Renewed via nginx authenticator + persisted; valid → Sep 14, auto-renew fixed.
- **P002** (Critical, FIXED): every send-otp/verify-otp 500 — `smsService` imported logger wrong (`log.info` undefined). Destructured `{ log }`.
- **P003** (High, FIXED): provider webhooks 403'd by strict CORS (no-Origin). Exempted webhook paths (HMAC-authed).
- **P004** (Low, deferred): phone route-validator vs User-model regex mismatch.
- Deploy fixes to ship 36-commit delta: backend `.npmrc` (cloudinary peer), frontend `terser` dep.
- Confirmed healthy: signup/login/session, authed search/match, admin+RBAC, webhook HMAC reachability, strict browser CORS, BG-check fail-closed.

## Deploy record (prod brought current)
- Was 36 commits behind → now HEAD `482ba2e`. DB backed up (`/root/tricityshadi-backups/`). Migrations already current (000035–039 pre-applied). Containers `tricitymatch-frontend`/`-backend` rebuilt + recreated, both healthy. Co-tenants untouched.

## Dev-phase carryover (already signed off — see qa-progress.md)
BUG-001/002/003 fixed+verified in dev. This mission validates PRODUCTION.
