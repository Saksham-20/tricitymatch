# QA Extended — Non-Functional Battery (X1–X8)

> Follow-on to the deep functional run (`QA_DEEP_RUN_2026-07-08_CHECKLIST.md`, C0–C22 ✅).
> Same method: **TEST → FAIL → root-cause → FIX → RETEST → VERIFY**, one chunk at a time, fix-on-discovery, batch-commit on branch `qa/deep-run-2026-07-08` (or a fresh branch).
> Scope: web + RN + backend, non-functional dimensions the functional run only touched at C21.
> Status legend: ⬜ not started · 🟡 in progress · ✅ done · ⏸ paused.

## Run state
- **Started** 2026-07-10 (Opus). X1–X8 substantially done (X1✅ X2✅ X3✅ X4✅ X5🟡 X6✅ X7✅ X8🟡); XF-01/03/04 fixed+deployed. Prod HEAD `823d81f`.
- **Findings prefix:** `XF-nn` (extended finding), severity 🔴/🟠/🟡/⚪.

## ⭐ PRIORITY-0 (NEXT) — Pricing revamp (feature, before the deferred X-passes)
**User-flagged top priority. Runs BEFORE resuming the deferred X8/X5/X2/X6 passes** — do pricing first, then continue the non-functional follow-ups.
- **Canonical spec:** `docs/PRICING_REVAMP_PLAN_2026-07-08.md` (user-selected; the duplicate `PLAN_pricing_revamp_2026-07-08.md` deleted 2026-07-11). Full 6-phase plan + blast-radius + open decisions live in that doc — build FROM it.
- **⛔ BLOCKED on 4 open decisions (confirm before ANY build — from the spec's "Open decisions"):**
  1. **VIP tenure 90d → 360d** at ₹5,999 (existing VIP holders keep their current endDate, unaffected). OK?
  2. **`nri` = VIP-equivalent** for boost/verified/premium gates. OK?
  3. **Bundle unlocks expire with the plan** (ride the subscription row, no persistent wallet). OK, or need a wallet?
  4. **NRI currency = static display labels** for v1 (charge INR via Razorpay, no live FX / no separate settlement). OK?
- **What it is:** 3-tier → **4-tier ladder + NRI card + à-la-carte unlock bundles**, with per-month framing, MRP-strike anchoring, social-proof badges. Prices: Basic ₹1,299/30d/5-unlock · Premium ₹2,499/90d/15 (⭐Most Popular) · **Elite ₹3,999/180d/30 (NEW, 💎Best Value)** · VIP ₹5,999/360d/unlimited+boost · **NRI Connect ₹9,999/180d/unlimited+boost (NEW)**. Bundles: 3/₹599 · 10/₹1,499 · 25/₹2,999 (shown at 0-unlock wall; not VIP/NRI).
- **Key de-risking decisions (from drafts):** KEEP existing enum keys (`basic_premium/premium_plus/vip`), only remap price/duration/unlocks/label; add exactly **2 new enum values** `elite`+`nri` (migration); **centralize the `['basic_premium','premium_plus','vip']` literal** (copy-pasted in 11–13 source files) into one shared `PREMIUM_PLAN_TYPES` const FIRST (Phase 0) so Elite/NRI don't silently lose premium/chat/boost gating; bundles reuse `contactUnlocksAllowed` + `checkContactUnlockLimit` (no gate change); NRI multi-currency = display-only v1 (charge INR via Razorpay).
- **Surfaces to touch:** backend `utils/razorpay.js` PLANS + `config` sources of truth, subscription controller (TIER_RANK upgrade gate must include elite/nri ordering), migration for the 2 enum values, web `Subscription.jsx` (tier cards + badges + MRP strike + bundle wall), RN `subscription.ts` shared PLANS overlay, email `planLabel()`, admin plan dropdowns. **Sync web+RN** (shared PLANS capability flags).
- **Gates:** BE unit + FE vitest + mobile tsc + build green; live-verify upgrade path (Razorpay test-mode) + tier-rank gate (DQ from 2026-07-07 C11); confirm existing paid members' access unaffected by enum/label remap.
- **Method:** consolidate spec → Phase 0 centralize const → migration → config/PLANS remap → +Elite/NRI → bundles → web UI → RN parity → emails/admin → test+deploy. Chunked, fix-on-discovery, same as X-run.

## X1 — Performance  ✅ (2026-07-11)
**Result: clean.** Findings: XF-01 (nodemailer, fixed+deployed) · XF-02 ⚪ (background-job serial queries, acceptable). Details below.
- **N+1 scan** ✅ — request paths (controllers/routes/socket) **CLEAN**, zero loop-nested queries (they use includes/joins). Only hits = `utils/queue.js` Bull background jobs (weekly digest per-user `Match.findAll`+`Profile.count` @235-264; saved-search-alerts per-search `Profile.count` @341-377). **XF-02 ⚪** — serial, but scheduled off-peak (Mon 10AM / daily 9AM), no user waiting → acceptable; revisit if user base grows large (batch into grouped aggregate). Not fixed (scope+risk vs benefit).
- **FE bundle** ✅ — 75 chunks, well code-split. Heavy libs isolated to lazy route chunks: AgoraRTC 411KB gz (calls-only), BarChart/recharts 100KB gz (admin-analytics-only). Initial shell ~200KB gz (index 44 + vendor-react 58 + vendor-ui 57 + vendor-utils 38) — healthy for a feature SPA. No action.
- **Static-asset cache** ✅ — hashed JS `max-age=31536000, public, immutable` (1yr); index.html `no-store, no-cache, must-revalidate` (instant deploy pickup). Textbook-correct nginx config.
- **API cache** ⚪ — public GETs (plans/success-stories) have ETag (conditional 304) but no `Cache-Control`. Marginal (endpoints 1-3ms); **skipped** (touches response path, low benefit).
- **Latency** ✅ — local public endpoints sub-3ms; X-Response-Time header live (DQ-011 guard holds).

### (original X1 checklist — completed above)
- [x] Backend dep audit → **XF-01 nodemailer HIGH** (`<=9.0.0`, message-`raw` attachment bypass) → bumped **9.0.0→9.0.3** (patch, non-breaking; app never uses message-`raw`, exposure nil). HIGH cleared. **DEPLOYED.**
- [x] Remaining 10 moderate = all `uuid` transitive advisory (buffer-bounds v3/v5/v6); only "fixes" are MAJOR downgrades (sequelize@3, firebase-admin@10, bull@1) → **held** per CLAUDE.md dep policy (breaking, no real benefit). Documented.
- [x] Public API latency sample (local): `/health` ~1ms, `/success-stories` ~3ms, `/subscription/plans` ~1.5ms. X-Response-Time header live (DQ-011 guard holds). ETag present (conditional GET).
- [ ] **N+1 query scan** — awaited Sequelize `findOne/findAll/findByPk` inside `.map/.forEach/for` loops across `controllers/` + `routes/`. (was mid-scan at pause). Priority: search, matches, chat, guardian, groups, notifications list endpoints.
- [ ] FE **bundle analysis** — `npm run build -w frontend`, inspect `dist/assets/*.js` gzip sizes, confirm `manualChunks` split (vendor-react/ui/utils), flag any chunk >250KB gzip; lazy-load heavy routes (Agora already lazy).
- [ ] **Cache-Control** on static-ish public GETs (`/subscription/plans`, `/success-stories`) — currently no `Cache-Control` (only ETag). Add short `public, max-age` (plans rarely change) to cut revalidation. Low priority.
- [ ] DB **index coverage** — confirm hot query columns indexed (migrations 000038 tuned search; verify matches/chat/notifications order-by columns have btree).
- [ ] Image delivery — Cloudinary transforms (500²/1200²) confirmed in upload; verify `f_auto,q_auto` on delivery URLs for web/RN.
- [ ] Redis cache hit-path (daily matches TTL, by-code) — dev has no Redis (in-mem fallback); verify prod Redis wired + TTL→midnight correct.

## X2 — Accessibility (web)  ✅ (2026-07-11, static pass)
**Result: strong baseline, 1 fix.** FormField label↔input assoc + aria-invalid + aria-describedby ✅; global `:focus-visible` burgundy ring + skip-link ✅; all 14 `<img>` have alt ✅; 76 aria-labels; 7 live-regions (+react-hot-toast own aria-live). Contrast: burgundy ~9:1 AA-pass; gold accent-only per design rule; elder-mode darkens muted. **XF-03 🟡 fixed** — `<html lang>` was static "en", never updated on hi/pa switch (WCAG 3.1.1/3.1.2 — SR mispronounces); added `i18n.on('languageChanged')` → `documentElement.lang` sync. **Remaining (deeper, needs live AT/browser):** full keyboard-nav walk of modals (focus-trap/Esc), axe scan per page — deferred to a focused interactive a11y pass.

## X2 (original checklist)
- [ ] Keyboard nav: tab order, focus-visible rings, no keyboard traps (modals: MatchPopup, review lightbox, confirm dialogs), Esc closes overlays.
- [ ] ARIA: form inputs have `<label>`/`aria-label`; icon-only buttons labelled; `role`/`aria-live` on toasts + notif badge; nav landmarks.
- [ ] Color contrast AA — burgundy `#8B2346` on white, gold `#C9A227` text, muted text in light+dark+elder. Run axe or manual contrast on Home/Login/Dashboard/Profile.
- [ ] Images: `alt` on profile photos, logo, hero; decorative marked `alt=""`.
- [ ] Elder mode: 18.5px base + ≥44px hit targets actually applied on every interactive control (spot-check Search filters, chat send, bottom nav).
- [ ] Reduced-motion: `MotionConfig reducedMotion="user"` honored (confirm no essential info conveyed by motion only).

## X3 — SEO  ✅ (2026-07-11)
**Result: strong, 1 fix.** robots.txt correct (public allowed; admin/marketing/api/dashboard/chat/settings/notifications disallowed) ✅; sitemap.xml 9 public URLs, no protected-route leak ✅; `Seo.jsx` per-route on 10 pages w/ canonical + OG + twitter card ✅; JSON-LD Organization+WebSite in index.html ✅. **XF-04 🟠 fixed** — index.html default OG + twitter + JSON-LD descriptions still claimed **"Government-ID verified"** (govt-ID removed 2026-07-02) → "Photo-verified, human-reviewed profiles" ×3; full-repo sweep confirms no other stale govt-ID user-facing claim (remaining hits = profession options + removal-explaining code comments). **⚪ deferred:** no SSR/prerender → raw HTML identical across routes, per-route meta only applies post-JS; Google (runs JS) fine, non-JS social scrapers get generic home preview for deep links. Fix = prerender/SSR (infra change, out of QA-fix scope).

## X3 (original checklist)
- [ ] `public/robots.txt` + `public/sitemap.xml` present + valid (URLs 200, lastmod sane, no staging leak).
- [ ] Per-route meta via `Seo.jsx` on ALL public routes (`/ /login /signup /about /contact /safety /success-stories /terms /privacy`) — unique title + description + canonical + OG (+ twitter card). Check for dupes.
- [ ] Structured data (JSON-LD Organization/WebSite) on Home; optional Product/Offer on subscription.
- [ ] OG image present + absolute URL; title length ≤60, desc ≤160.
- [ ] No `noindex` leaking on public pages; protected routes not in sitemap.
- [ ] Canonical host consistency (`https://tricityshadi.com`, non-www vs www decided).

## X4 — Responsive  ✅ (2026-07-11, live browser sweep)
**Result: clean.** Horizontal-overflow measured (`documentElement.scrollWidth − clientWidth`, offender-element listed if >1px) across **13 pages @375** (/, /about, /safety, /onboarding[signup], /login, /dashboard, /search, /matches, /subscription, /settings) + **Home @1440** → **zero overflow everywhere, no offending elements**. DQ-001 (Home h-scroll) class fully resolved. XF-03 `<html lang>` fix **verified live** (set hi → `documentElement.lang="hi"`). **Remaining (lower-risk):** @768 mid-breakpoint + touch-target ≥44px spot-audit — deferred (375 is the tightest; all clean).

## X4 (original checklist)
- [ ] 375 / 768 / 1440 layout integrity on: Home, Login, Signup/onboarding, Dashboard, Search+filters, Profile detail, Matches, Chat, Subscription, Settings, Admin.
- [ ] **No horizontal scroll** (DQ-001 class — `docScrollWidth == clientWidth`) at every breakpoint. DQ-001 fixed Home@1440; re-sweep all.
- [ ] Touch targets ≥44px on mobile; sticky navbar/bottom-nav don't occlude content or CTAs (DQ / prior FilterPanel z-index class).
- [ ] Tables/wide content scroll inside own container, not the page.
- [ ] RN: safe-area on notch devices, landscape not broken, font-scale (OS large-text) doesn't clip.

## X5 — Resilience / error-handling  🟡 (2026-07-11, error/empty/404 live)
**Result: graceful, no crashes.** Bad profile id (`/profile/<nonexistent-uuid>`) → "Profile not found ← Back to search" error card, navbar intact, no white-screen (title "Profile" — DQ-010 holds). Unknown route → proper "Page Not Found" page. Console errors on the bad-profile page = browser-logged HTTP 4xx (400 profile + 404 horoscope-match), **not uncaught JS** — app handled them; doubled by dev React StrictMode (1× in prod). ⚪ minor: ProfileDetail fires horoscope-match fetch even when the profile fetch 400s (harmless 404, gated would be cleaner). Data-view 4-states (loading/empty/error-retry) established in deep-run C-work (Dashboard/Search error+retry). **Remaining (needs network interception):** offline/throttle behavior, optimistic-UI rollback (chat/match/privacy), socket disconnect-resync, double-submit — deferred to a focused resilience pass.

## X5 (original checklist)
- [ ] Every data view ships 4 states (default/loading-skeleton/empty/error-retry) — audit Dashboard, Search, Matches, Chat, Notifications, Profile, Admin tables (design-system contract).
- [ ] Network-fail: throttle/offline → graceful (RN OfflineBanner; web retry cards) not white-screen.
- [ ] API 500/timeout → user-facing error, no raw stack, retry works; axios 401→refresh queue holds under concurrent 401s.
- [ ] Optimistic UI rollback on failure (chat send, match action, privacy save).
- [ ] Double-submit guards (signup, payment, match) — no dup rows.
- [ ] Socket disconnect/reconnect (AppState in RN, tab-refocus web) — messages/typing resync, no dupes.

## X6 — Security depth (beyond C20)  ✅ (2026-07-11, partial — headers/cookies/deps)
**Result: clean.** Cookie flags (prod live): accessToken + refreshToken both **HttpOnly + Secure + SameSite=Strict** (Max-Age 15m / 7d) → CSRF mitigated, XSS can't read tokens ✅. Security headers live through nginx: HSTS+preload, CSP (full allowlist), X-Frame DENY, X-Content-Type nosniff, Referrer-Policy ✅. Dep audit HIGH (nodemailer) cleared (X1). **Remaining (deeper, needs load/session driving):** rate-limit real-enforcement hammer (429 + Redis lockout), JWT rotation+family-revoke live test, upload magic-byte live — most already covered functionally in deep-run C2/C20; re-verify under a focused security-load pass.
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

## X7 — Observability / logging  ✅ (2026-07-11, static + prod-env)
**Result: clean.** OTP codes logged ONLY when `!isProduction` (SMS) / `!email.isConfigured() && !isProduction` (email) → prod never logs codes (only destination phone for delivery debug — acceptable). Prod env verified live: `NODE_ENV=production`, `OTP_BYPASS_CODES` unset, `ALLOW_INSECURE_PROD="false"` (parsed→disabled, secret-strength guards active), `SMS_PROVIDER=msg91`. Structured JSON logger in use. **XF-05 ⚪** — 3 leftover debug `console.log` in `profileController.js` (162/255/340: content-type/file/photo counts) bypass the structured logger + pollute prod container logs; harmless (counts, no PII); batch-remove with next backend change (not worth a standalone backend redeploy). **⚪** — logger has no auto-redaction of password/token fields (defense-in-depth); no actual body-dumping found, so latent only.

## X7 (original checklist)
- [ ] Structured JSON logs (`middlewares/logger`) — request id, no PII (password/token/OTP/phone) in log lines; grep for accidental `console.log`.
- [ ] Error monitoring: uncaughtException/unhandledRejection handled (DQ-011 showed a crash-path); consider Sentry/log aggregation for prod.
- [ ] `/health` returns useful liveness (DB + Redis reachability), used by docker healthcheck + nginx.
- [ ] Prometheus/Grafana (`monitoring/`) scrape targets valid; key counters (signups, payments, errors) exported.
- [ ] Log levels correct (no debug spam in prod; terser drops FE console).

## X8 — Data integrity  🟡 (2026-07-11, static slice only)
**Enum coverage ✅** — model ENUMs consistent with code + deep-run findings: `User.role` (user/admin/super_admin/marketing_manager/marketing — no `bureau`, confirms DQ-015); `Subscription.planType` (free/basic_premium/premium_plus/vip = shared PLANS) + status (active/expired/cancelled/pending); `Match.action` (like/shortlist/pass); `User.status` (+deleted for soft-delete). Model↔column parity risks (DQ-009 col-typo, 2026-06-21 privacy-columns) already found+fixed in prior runs. **Remaining (needs DB session):** orphan-row scan, FK-cascade on delete-account, migration-drift on fresh DB, timezone/IST boundary, money-math — deferred to a focused DB-integrity pass.

## X8 (original checklist)
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
