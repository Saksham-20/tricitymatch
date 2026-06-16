# Browser UX / Visual QA Plan — Production

**Target:** https://tricityshadi.com (prod, post-deploy HEAD `305b633`)
**Goal:** Pixel-level / render-level validation that complements the API-level pass in `launch-readiness.md`. Prove every page renders correctly, no blank screens, no console errors, no broken layout, across desktop/tablet/mobile.
**Tool:** gstack browse headless browser (`$B`) — navigate, screenshot, DOM snapshot, console + network capture, JS eval. Live browser is source of truth, not source code.
**Method:** TEST → FAIL → root-cause → FIX → redeploy → RETEST → VERIFY. Fix-on-discovery, do not batch. Every finding needs evidence (URL + screenshot/console line).

## Credentials / fixtures
- New user: signup fresh (10-digit phone, OTP bypass `000000`).
- Returning user: reuse the signed-up account.
- Admin: `admin@tricitymatch.com` / `Pass@1234`.
- Mark all test data with `qa.ux.*@tricityshadi.com`; delete from DB after.

## Viewports
| Name | Size | Note |
|------|------|------|
| Desktop | 1440×900 | primary |
| Tablet | 768×1024 | breakpoint |
| Mobile | 375×812 | iPhone-class, no horizontal overflow |

## Per-page checklist (every page, every viewport)
1. Loads, HTTP 200, no blank/white screen, app root mounts
2. Console: 0 errors / 0 unhandled rejections (warnings noted)
3. Network: no failed (4xx/5xx) requests except expected 401 auth-probe
4. Layout: no horizontal scroll, no overlap, no cut-off text, no broken grid
5. Images/assets: all load (no broken img, no 404 asset)
6. No placeholder / lorem ipsum / "TODO" / dead buttons (click key CTAs)
7. States: loading, empty, error, success render correctly where reachable
8. Typography/spacing/alignment consistent; hierarchy readable
9. Keyboard: tab order + visible focus on forms; Esc closes modals
10. Copy: no obvious typos, correct brand name (TricityShadi)

## Scope — routes (from CLAUDE.md route map)

### Public (no auth) — Phase A
`/` · `/login` · `/signup` · `/onboarding` · `/forgot-password` · `/reset-password` · `/terms` · `/privacy` · `/about` · `/contact` · `/safety` · `/success-stories`

### Authenticated (user) — Phase B
`/dashboard` · `/profile` · `/profile/edit` · `/search` · `/chat` · `/subscription` · `/settings` · `/notifications` · `/verification` · `/guardian` · `/astrologers` · `/astrologers/bookings` · `/payment/success|failed|history`

### Admin — Phase C
`/admin/dashboard` · `/admin/users` · `/admin/verifications` · `/admin/subscriptions` · `/admin/revenue` · `/admin/reports` · `/admin/marketing-users` · `/admin/referral-codes` · `/admin/leads` · `/admin/success-stories`

### Flows (interactive) — Phase D
- Onboarding 14-step wizard: step nav, validation, back/forward, resume
- Login → bad password shows error inline (BUG-002 fix live in browser)
- Checkbox label click toggles (BUG-003 fix live in browser)
- Search filter panel open/apply/clear
- Logout → redirect → re-login

## Config-gated (skip / note, not failures)
Payment (Razorpay placeholder), web calls (no `VITE_AGORA_APP_ID` → UI auto-hides), email/SMS delivery, Google sign-in button (no client id).

## Exit criteria
All public + authed + admin pages render clean on 3 viewports, 0 console errors, 0 broken layout/asset, all 4 Phase-D flows pass. Findings fixed+verified or explicitly deferred with reason.
