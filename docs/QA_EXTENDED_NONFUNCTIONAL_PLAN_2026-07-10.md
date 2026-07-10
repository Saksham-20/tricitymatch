# QA Extended — Non-Functional Battery (X1–X8)

> Follow-on to the deep functional run (`QA_DEEP_RUN_2026-07-08_CHECKLIST.md`, C0–C22 ✅).
> Same method: **TEST → FAIL → root-cause → FIX → RETEST → VERIFY**, one chunk at a time, fix-on-discovery, batch-commit on branch `qa/deep-run-2026-07-08` (or a fresh branch).
> Scope: web + RN + backend, non-functional dimensions the functional run only touched at C21.
> Status legend: ⬜ not started · 🟡 in progress · ✅ done · ⏸ paused.

## Run state
- **Started** 2026-07-10 (Opus). **PAUSED after X1 partial** to push+deploy the deep-run fixes + nodemailer patch.
- **Findings prefix:** `XF-nn` (extended finding), severity 🔴/🟠/🟡/⚪.

## X1 — Performance  🟡 (partial)
- [x] Backend dep audit → **XF-01 nodemailer HIGH** (`<=9.0.0`, message-`raw` attachment bypass) → bumped **9.0.0→9.0.3** (patch, non-breaking; app never uses message-`raw`, exposure nil). HIGH cleared. **DEPLOYED.**
- [x] Remaining 10 moderate = all `uuid` transitive advisory (buffer-bounds v3/v5/v6); only "fixes" are MAJOR downgrades (sequelize@3, firebase-admin@10, bull@1) → **held** per CLAUDE.md dep policy (breaking, no real benefit). Documented.
- [x] Public API latency sample (local): `/health` ~1ms, `/success-stories` ~3ms, `/subscription/plans` ~1.5ms. X-Response-Time header live (DQ-011 guard holds). ETag present (conditional GET).
- [ ] **N+1 query scan** — awaited Sequelize `findOne/findAll/findByPk` inside `.map/.forEach/for` loops across `controllers/` + `routes/`. (was mid-scan at pause). Priority: search, matches, chat, guardian, groups, notifications list endpoints.
- [ ] FE **bundle analysis** — `npm run build -w frontend`, inspect `dist/assets/*.js` gzip sizes, confirm `manualChunks` split (vendor-react/ui/utils), flag any chunk >250KB gzip; lazy-load heavy routes (Agora already lazy).
- [ ] **Cache-Control** on static-ish public GETs (`/subscription/plans`, `/success-stories`) — currently no `Cache-Control` (only ETag). Add short `public, max-age` (plans rarely change) to cut revalidation. Low priority.
- [ ] DB **index coverage** — confirm hot query columns indexed (migrations 000038 tuned search; verify matches/chat/notifications order-by columns have btree).
- [ ] Image delivery — Cloudinary transforms (500²/1200²) confirmed in upload; verify `f_auto,q_auto` on delivery URLs for web/RN.
- [ ] Redis cache hit-path (daily matches TTL, by-code) — dev has no Redis (in-mem fallback); verify prod Redis wired + TTL→midnight correct.

## X2 — Accessibility (web)  ⬜
- [ ] Keyboard nav: tab order, focus-visible rings, no keyboard traps (modals: MatchPopup, review lightbox, confirm dialogs), Esc closes overlays.
- [ ] ARIA: form inputs have `<label>`/`aria-label`; icon-only buttons labelled; `role`/`aria-live` on toasts + notif badge; nav landmarks.
- [ ] Color contrast AA — burgundy `#8B2346` on white, gold `#C9A227` text, muted text in light+dark+elder. Run axe or manual contrast on Home/Login/Dashboard/Profile.
- [ ] Images: `alt` on profile photos, logo, hero; decorative marked `alt=""`.
- [ ] Elder mode: 18.5px base + ≥44px hit targets actually applied on every interactive control (spot-check Search filters, chat send, bottom nav).
- [ ] Reduced-motion: `MotionConfig reducedMotion="user"` honored (confirm no essential info conveyed by motion only).

## X3 — SEO  ⬜
- [ ] `public/robots.txt` + `public/sitemap.xml` present + valid (URLs 200, lastmod sane, no staging leak).
- [ ] Per-route meta via `Seo.jsx` on ALL public routes (`/ /login /signup /about /contact /safety /success-stories /terms /privacy`) — unique title + description + canonical + OG (+ twitter card). Check for dupes.
- [ ] Structured data (JSON-LD Organization/WebSite) on Home; optional Product/Offer on subscription.
- [ ] OG image present + absolute URL; title length ≤60, desc ≤160.
- [ ] No `noindex` leaking on public pages; protected routes not in sitemap.
- [ ] Canonical host consistency (`https://tricityshadi.com`, non-www vs www decided).

## X4 — Responsive  ⬜
- [ ] 375 / 768 / 1440 layout integrity on: Home, Login, Signup/onboarding, Dashboard, Search+filters, Profile detail, Matches, Chat, Subscription, Settings, Admin.
- [ ] **No horizontal scroll** (DQ-001 class — `docScrollWidth == clientWidth`) at every breakpoint. DQ-001 fixed Home@1440; re-sweep all.
- [ ] Touch targets ≥44px on mobile; sticky navbar/bottom-nav don't occlude content or CTAs (DQ / prior FilterPanel z-index class).
- [ ] Tables/wide content scroll inside own container, not the page.
- [ ] RN: safe-area on notch devices, landscape not broken, font-scale (OS large-text) doesn't clip.

## X5 — Resilience / error-handling  ⬜
- [ ] Every data view ships 4 states (default/loading-skeleton/empty/error-retry) — audit Dashboard, Search, Matches, Chat, Notifications, Profile, Admin tables (design-system contract).
- [ ] Network-fail: throttle/offline → graceful (RN OfflineBanner; web retry cards) not white-screen.
- [ ] API 500/timeout → user-facing error, no raw stack, retry works; axios 401→refresh queue holds under concurrent 401s.
- [ ] Optimistic UI rollback on failure (chat send, match action, privacy save).
- [ ] Double-submit guards (signup, payment, match) — no dup rows.
- [ ] Socket disconnect/reconnect (AppState in RN, tab-refocus web) — messages/typing resync, no dupes.

## X6 — Security depth (beyond C20)  ⬜
- [x] Dep audit (see X1 — HIGH cleared).
- [ ] Cookie flags: accessToken/refreshToken `httpOnly` + `Secure` (prod) + `SameSite` correct; not readable by JS.
- [ ] CSRF posture — cookie-auth + custom header / SameSite=strict|lax reasoning documented; state-changing routes safe.
- [ ] Rate-limit **actual enforcement** (not just config) — hammer `/auth/login` (5/15m), `/auth/send-otp` (3/hr), search (30/min); confirm 429 + Redis lockout fires.
- [ ] Security headers live in prod behind nginx (helmet CSP/HSTS/X-Frame/X-Content-Type/Referrer-Policy) — verify not stripped by nginx.
- [ ] JWT: expiry honored, rotation+family-revoke on refresh, revoked token rejected.
- [ ] File upload: magic-byte (SEC-4) + Cloudinary allowed_formats hold; oversized + wrong-type rejected.
- [ ] IDOR re-sweep on any endpoint added since C20.
- [ ] PII: no secrets/tokens in logs (see X7); error bodies stack-stripped in prod (C20 ✅).
- [ ] VPS infra (documented, out of app scope, [[project-security-pentest-2026-07]]): `.env.production` 644 world-readable, SSH root/password/no-fail2ban — **owner action**.

## X7 — Observability / logging  ⬜
- [ ] Structured JSON logs (`middlewares/logger`) — request id, no PII (password/token/OTP/phone) in log lines; grep for accidental `console.log`.
- [ ] Error monitoring: uncaughtException/unhandledRejection handled (DQ-011 showed a crash-path); consider Sentry/log aggregation for prod.
- [ ] `/health` returns useful liveness (DB + Redis reachability), used by docker healthcheck + nginx.
- [ ] Prometheus/Grafana (`monitoring/`) scrape targets valid; key counters (signups, payments, errors) exported.
- [ ] Log levels correct (no debug spam in prod; terser drops FE console).

## X8 — Data integrity  ⬜
- [ ] Migrations 000001–000042 apply clean on a fresh DB (`db:reset` + migrate) with no drift vs models.
- [ ] Model ↔ column parity (DQ-009 by-code col typo class; the privacy-columns-not-declared class from 2026-06-21) — spot-check every model's declared attrs vs actual table columns.
- [ ] FK constraints + cascade on delete-account (User → Profile/Match/Message/Notification/Subscription) — no orphans; DEL /auth/account leaves no dangling rows.
- [ ] Enum coverage: statuses used in code all exist in DB enums (User.role, Subscription.planType, Match.action, Verification.status).
- [ ] Timezone/IST: daily-match set boundary at IST midnight; createdAt stored UTC, displayed IST; DOB date-only (DQ RN class).
- [ ] Unique constraints: email, phone, profileCode determinism (TCS-XXXXXXXX no collision), guardian dup-invite (DQ-013 area).
- [ ] Money math: subscription amounts, unlock quotas reset on upgrade (C11), invoice totals — integer paise, no float drift.

## Regression gates (run at each chunk close)
```bash
cd backend && npm test                 # BE unit (155/155 baseline)
cd frontend && npx vitest run          # FE (48/48 baseline)
cd mobile && node_modules/.bin/tsc --noEmit -p tsconfig.json   # 0 errors
cd frontend && npm run build           # build green
```

## Deferred / product-decision (from deep run)
- **DQ-015** RN bureau stack = unreachable dead code (`bureau` not in role enum, no `/bureau/*` backend). Build backend+enum+seed OR delete RN stack.
- Config-gated live-drive: Agora call media, live Razorpay checkout, FCM push (need real creds + native build).
- RN dark-mode toggle (deliberately omitted in Settings UI); web notif-prefs localStorage-only (no backend).
