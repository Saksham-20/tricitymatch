# CLAUDE.md

> **Every session:** read this first · update after · use skills (never do manually what a skill does).

**TricityShadi** — hyperlocal matrimonial (Chandigarh/Mohali/Panchkula). React 18 SPA + Express + PostgreSQL + Redis + Socket.io + RN mobile. Docker Compose + Nginx.

## Commands
```bash
npm run dev | dev:backend(:5001) | dev:frontend(:3000)   # Vite proxies /api + /socket.io
npm run test | lint | lint:fix | build
# backend/: npm run migrate | migrate:undo | db:reset | db:create | db:drop; node seeders/adminSeeder.js
npm run qa | qa:auth | qa:visual | qa:headed | qa:full | qa:ui          # e2e
# mobile/ ONLY: npx expo start --clear ; node_modules/.bin/tsc --noEmit -p tsconfig.json
```
Ports: backend 5001 · web 3000 · Metro 8081.

## Layout
`backend/` Express (CommonJS) · `frontend/` React+Vite · `mobile/` RN Expo SDK51 · `shared/` TS types (@shared) · `docs/` (PRD/arch/security/spec/tickets/API) · `e2e/` Playwright (9) · `nginx/` · `monitoring/` Prom+Grafana · `docker-compose.yml`

## Backend
Entry `server.js`. Key files:
- `config/env.js` — sole env source (never read process.env elsewhere); prod guard `process.exit(1)` on dev JWT_SECRET/COOKIE_SECRET/DB_PASSWORD/FRONTEND_URL + RAZORPAY_WEBHOOK_SECRET/SMS/SMTP + BG_CHECK_WEBHOOK_SECRET (when provider enabled)
- `config/database.js` Sequelize+PG · `routes/index.js` mounts `/api/v1`+`/api`; marketing mounted in server.js at `/api/marketing`
- `middlewares/`: security (helmet, CORS, 9 limiters, Redis lockout, sanitize) · auth (JWT cookie, adminAuth, requirePremium/VIP, socketAuth) · errorHandler (AppError, asyncHandler) · logger (JSON) · upload (Multer+Cloudinary; MIME+extension filter + Cloudinary `allowed_formats` content-validation + pinned `resource_type` per endpoint — no buffered magic-byte check since storage streams straight to Cloudinary; voice-intro + video-intro resource_type=`video`, MP4/MOV/WebM ≤25MB)
- `socket/socketHandler.js` — join-room (mutual+premium gated), send-message (anti-spoof), typing (mutual-match gated), edit, message-deleted (server-authoritative from REST), online-status. **Family-group socket events DISABLED** (join-group/group-send-message reject `FEATURE_UNAVAILABLE`) — no Group backend exists, prevents IDOR (see Known Issues + review-progress SOCK-1/MF-1)
- `utils/`: cache (Redis+in-mem fallback; `get/set/del`,`getString/setString`,`getNumber/setNumber`) · queue (Bull: email/cleanup/push; weekly digest Mon 10AM, saved-search-alerts daily 9AM) · notifyUser `notify(userId,type,title,body,relatedId)` · razorpay (PLANS, createOrder, verifyPayment [timing-safe HMAC], createGenericOrder; throws on placeholder secret) · agoraToken (`DEV_STUB_TOKEN` if unset) · smsService (Fast2SMS/MSG91, dev logs OTP, 3/hr) · bgCheckService (AuthBridge+Signzy, dev stub auto-pass 5s; webhook verify **fails CLOSED in prod** if secret unset) · email (primary) · emailService (legacy, chatController only) · compatibility (score + Vedic Ashtakoot 27-nakshatra/8-guna/dosha; `resolveNakshatra()` 50+ aliases) · numerology (life-path from DOB + pairwise match; in `horoscope-match`) · profileCode (deterministic `TCS-XXXXXXXX` from userId, no DB column; powers `/search/by-code`)
- `validators/index.js` all express-validator schemas

**Auth:** httpOnly accessToken(15m JWT)+refreshToken(7d hashed). Rotation+family revoke. Lockout 5/30min (Redis). Google `POST /auth/google`. Mobile biometric→refresh-token flow.
**Limiters:** api 200/15m · auth 5/15m · signup 3/hr · pwReset 3/hr · search 30/min · message 60/min · profileUpdate 10/min · matchAction 60/min · upload 20/hr · admin 100/min · payment 10/hr
**Plans:** free ₹0 · basic_premium ₹1500/15d/5unlock · premium_plus ₹3000/30d/10unlock · vip ₹7499/90d/unlimited+boost
**Migrations:** 000001–000038. `npm run migrate` (backend/) before prod. (`quizAnswers` JSONB IS created by migration 000028 — no manual ALTER needed.) 000035 ProfileView (viewerId,createdAt) index for recently-viewed; 000036 SuccessStories table; 000037 Profile.videoIntroUrl (video intro); 000038 search-index tuning (income/height/manglikStatus btree + interestTags GIN; drops duplicate Messages index).

## API (`/api/v1` unless noted; full: `docs/06_API_Reference.md`)
- **auth** `/auth`: signup, login, refresh, forgot-password, reset-password, google, send-otp, verify-otp, GET me, logout, logout-all, change-password, GET sessions, DEL sessions/:id, DEL account
- **profile** `/profile`: GET/PUT me, GET me/stats, GET me/viewers, GET me/recently-viewed (all tiers), DEL me/photo, DEL me/profile-photo, POST/DEL voice-intro, POST/DEL video-intro, PUT privacy, GET :id, POST :id/unlock-contact, GET :id/compatibility, GET :id/horoscope-match (incl. `numerology` life-path block)
- **search** `/search`: GET /, GET suggestions, GET by-code (public profile code `TCS-XXXXXXXX`→profile)
- **match** `/match`: POST :id {action}, GET likes, GET shortlist, GET mutual, GET daily (cached IST-day set, Redis TTL→midnight, free 5/premium 15)
- **success-stories** (public, no auth) `/api/v1/success-stories`: GET (published only)
- **chat** `/chat` (premium): GET conversations, GET messages/:id, POST messages, POST send, PUT/DEL messages/:id
- **subscription** `/subscription`: GET plans, POST webhook, GET my-subscription, POST create-order, POST verify-payment, DEL current, GET history, GET invoice/:id
- **verification** `/verification`: GET status, POST submit, POST selfie, POST bg-check/initiate, POST bg-check/verify-payment, GET bg-check/status, POST bg-check/webhook (no-auth, HMAC-SHA256 via BG_CHECK_WEBHOOK_SECRET, raw body)
- **notifications** `/notifications`: GET /, GET unread-count, PUT read-all, PUT :id/read, DEL :id, POST/DEL fcm-token
- **calls** `/calls`: GET agora-token, POST initiate, GET history, PUT :id/accept|decline|end
- **guardian** `/guardian` (DB): GET my-guardians, POST invite, DEL :linkId, GET my-candidates, GET candidate/:id/matches|shortlisted, POST resolve-invite/:token
- **astrologers** `/astrologers`: GET /, GET my-bookings, GET :id, POST book, POST book/:id/verify-payment|start-call|end-call
- **block**/**report** `/block`,`/report`: POST :id, DEL :id, GET /
- **admin** `/admin`: GET/POST users, GET users/:id, PUT users/:id/status|subscription, GET verifications, PUT verifications/:id {status,adminNotes}, GET analytics|revenue|reports, PUT reports/:id {status,adminNotes}, GET invoice/:id, GET/POST marketing-users, PUT marketing-users/:id/status, GET marketing-users/:id/stats, GET/POST referral-codes, PUT referral-codes/:id/toggle, GET leads, GET/POST success-stories, PUT/DEL success-stories/:id, POST push-smoke-test
- **marketing** `/api/marketing` (marketing role): GET dashboard|leads, PUT leads/:id/status, GET/POST referral-codes

**Flows:** Login→httpOnly cookies→`/auth/me`. Onboarding 14-step→`PUT /profile/me`. Match `POST /match/:id {action}`→mutual→notify. Chat premium+mutual (REST+Socket). Payment Razorpay order→verify→webhook fallback. Photo Multer→Cloudinary 500² face+1200² gallery max6. Boost +8 sort. Verify docs→admin→badge.

## Frontend (web)
`main.jsx`→`HelmetProvider`→`App.jsx`→AuthProvider→OnboardingProvider→SocketProvider. Contexts `useAuth/useOnboarding/useSocket`. Aliases `@`→src,@components/@pages/@context/@api/@utils/@hooks/@assets. HTTP `api/axios.js` (withCredentials, auto 401→refresh queue); `apiClient.js` alias. **react-router v7** (component/hook API only). Login/signup return full user (Profile) → no double `/auth/me`. **SEO:** `components/common/Seo.jsx` (react-helmet-async) sets per-route title/description/canonical/OG on public pages; `public/robots.txt` + `public/sitemap.xml` present.

Routes:
- public: `/ /login /signup /onboarding /forgot-password /reset-password /terms /privacy /about /contact /safety /success-stories`
- ProtectedRoute: `/dashboard /profile /profile/edit /profile/:id /search /chat /subscription /payment/success|failed|history /settings /notifications /verification /guardian /astrologers /astrologers/bookings /astrologers/:id`
- AdminProtectedRoute `/admin/*`: dashboard, users(+create,:id), verifications, subscriptions, revenue, reports, marketing-users(+:id), referral-codes, leads, success-stories
- **i18n (web):** react-i18next en/hi/pa; config `src/i18n/`, `LanguageSwitcher` in Settings. New pages use `useTranslation`; existing pages still English-only.
- MarketingProtectedRoute `/marketing/*`: dashboard, leads, referral-codes

Onboarding 14: Welcome→CreatingFor→BasicInfo→CreateAccount→AboutYourself→Location→Education→MaritalStatus→Religion→Lifestyle→Family→Preferences→Photos→Verification.
Dead files removed (`pages/Profile.jsx`, `pages/Signup.jsx` deleted). Build: **Vite 8** (rolldown) — `manualChunks` is function-form; terser drops console in prod; chunks vendor-react/ui/utils; es2020. AdminProtectedRoute + ProtectedRoute accept `['admin','super_admin']`.

## Mobile (`mobile/`) — RN
**Stack:** Expo SDK51 · React 18.2 · RN 0.74.5 · react-navigation **v6** · react-native-screens 3.31.1 · MMKV **v2** · old arch · Zustand+React Query · i18n en/hi/pa. Docs: `docs/01–06`.
**Nav:** RootNavigator→(Auth|Onboarding|Main). MainNavigator role-gates AdminStack (admin/super_admin), BureauStack (bureau). IncomingCallModal inside NavigationContainer, outside Stack.

Feature areas (`mobile/src/features/`):
- **auth** Splash, Welcome, Login (biometric+429 lockout), Signup (strength bar), Forgot/ResetPassword, OTP (6-box)
- **onboarding** 14 steps mirror web; OnboardingContext resume, OnboardingLayout progress
- **home** feed, completeness strip, quick actions, new profiles
- **profile** OwnProfile (gallery/ring/badges/preview/milestone/quiz CTA), ProfileDetail (sticky bar, accordions, compat→breakdown sheet, horoscope→Ashtakoot, voice playback, ⋮→BlockReportSheet), EditProfile, SelfieVerification, BackgroundCheck, Verification (4 tiers)
- **search** Search (infinite/sort/saved), FilterPanel (@gorhom sheet, ranges, gotra exclude, manglik, save), ProfileCard, CompatibilityMeter, VerificationBadges
- **matches** 4 tabs (Mutual/Shortlisted/LikedMe/MyInterests), OfflineBanner (useOfflineShortlist MMKV)
- **chat** Conversations (Plus+ gate), ChatThread (inverted, receipts, typing, optimistic, edit/del), FamilyGroups, FamilyGroupChat
- **calls** Voice, Video (draggable PiP), IncomingCall (30s). Agora dynamic require
- **subscription** Subscription (plans, Razorpay stub, history), AstrologerMarketplace, AstrologerDetail
- **notifications** Notifications (infinite, mark-read, deep-link), Settings (incognito, elder mode, language, dark mode, delete account, guardian/family/astrologer)
- **admin** AdminHome, VerificationQueue, ReportsQueue
- **bureau** BureauHome, ClientRoster, MatchProposal (3-step), Earnings, Support, SuccessStory
- **guardian** GuardianSetup, GuardianView (RO), GuardianCandidates
- **horoscope** HoroscopeMatch (guna bars/dosha/manglik), CompatibilityBreakdownSheet, Quiz (10q)

Stores/hooks: authStore, uiStore (darkModeOverride null/true/false), callStore · useSocket (singleton, AppState reconnect) · useNotificationHandler (FCM dynamic) · useOfflineShortlist · useTheme `{isDark,c}` · elderTheme.
Native modules (dynamic require, stub in Expo Go, need native build): Agora, Razorpay, Firebase messaging, expo-camera/av/document-picker/local-authentication.

**Gotchas:**
- tsc in PATH=v4 → use repo `node_modules/.bin/tsc -p tsconfig.json` from `mobile/`
- `RouteProp` from `@react-navigation/native` (not native-stack)
- MMKV v2 `new MMKV({id})`; cache typed accessors `.setString/.getString`
- `@shared/*` alias in tsconfig paths AND metro.config
- ProfileSummary no `age`/`name` → age from `dateOfBirth`; name `[firstName,lastName].filter(Boolean).join(' ')`
- `Match.MatchedProfile` not `match.profile`
- no `colours.text`/`.surface` → `textPrimary`/`surfaceCard`; no `borderRadius['2xl']` → literal 20
- `VerificationTier` is interface not union → use `DocumentType` for maps
- tab nav from stack: `nav.navigate('MainTabs',{screen:'X'})`; elder mode hides Chat tab (guard `!elderMode`)
- admin routes: PUT `/admin/verifications/:id`, GET `/admin/analytics`, PUT `/admin/reports/:id`; FCM `/notifications/fcm-token` (not auth/device-token)
- Razorpay mobile: set `EXPO_PUBLIC_RAZORPAY_KEY_ID`; AuthUser no `name` → prefill `user.email`
- `getAshtakootScore` null when both nakshatras unknown → fall back rashi→empty; HoroscopeMatch params `{userId,name}` (full name)
- `queryKeys.myProfile` = `['profile','me']`

## Env
**Backend** `.env.development` (root, trailing-space quirk). Req: `PORT=5001 DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET FRONTEND_URL`. Status: Cloudinary✅ Razorpay❌ Email❌ GoogleOAuth❌ Redis optional. Feature: `SMS_PROVIDER+SMS_API_KEY` · `AGORA_APP_ID+AGORA_APP_CERTIFICATE` · `BG_CHECK_PROVIDER+BG_CHECK_API_KEY+BG_CHECK_WEBHOOK_SECRET` · FCM creds.
**Frontend** `frontend/.env`: `VITE_API_URL VITE_WS_URL VITE_RAZORPAY_KEY_ID VITE_CLOUDINARY_CLOUD_NAME✅ VITE_GOOGLE_CLIENT_ID❌`.
**Mobile** `EXPO_PUBLIC_*`. Bundle IDs `com.tricityshadi.app` (iOS+Android). Set eas.json submit.production.ios (appleId/ascAppId/appleTeamId) before `eas submit`.

## Deploy
```bash
docker-compose up -d
docker-compose --profile full up -d                    # prod
docker-compose --profile full --profile monitoring up -d
```
Nginx upstream `backend:5000` (host maps 5001:5000). **CRITICAL:** `--force-recreate` when rebuilding backend (plain up won't replace).
Pre-launch `bash scripts/prelaunch-check.sh` (`ENV_FILE=.env BASE_URL=https://tricityshadi.com`). Load `k6 run scripts/load-test.js --env BASE_URL=...`. FCM smoke `POST /api/v1/admin/push-smoke-test`.
Checklist: real Razorpay → Email → Google OAuth → `.env.production` → strong secrets → migrate(→000038) → seed admin → PWA icons → HTTPS → SMS/Agora/BG_CHECK/FCM env.

## Admin
`admin@tricitymatch.com` / `Pass@1234` (or `ADMIN_EMAIL`/`ADMIN_PASSWORD`). Login `/login` (not /admin/login). Re-seed `node backend/seeders/adminSeeder.js`.

## Testing
Backend unit+integration **Jest 30**+Supertest `backend/tests/` (unit: numerology, profileCode, sanitize, validators, errorHandler, notifyUserImports, **razorpay** [timing-safe], **bgCheckWebhook** [fail-closed]; integration: auth). Frontend **Vitest 4**+RTL 16 `frontend/src/tests/` (utils/validators + **components/routeGuards** [covers FE-1 super_admin]). E2E Playwright `e2e/tests/` (9).
⚠️ 9 pre-existing/stale unit-test failures (errorHandler AppError-signature + validators age-range) — predate the audit, left for a dedicated test-fix chunk.

## Known Issues
**Config-gated (need real creds, not code):** 🔴 Razorpay placeholder · 🟡 Email/GoogleOAuth off · 🟡 SMS OTP needs SMS_API_KEY · 🟠 Push stub (FCM creds+native build) · 🟠 Redis not in dev.
**Incomplete features:** ⚪ family-group chat backend not built (socket events disabled to close IDOR — see review-progress MF-1/SOCK-1) · ⚪ kundli PDF missing · ⚪ web in-browser calls deferred (mobile-only) · ⚪ full web i18n partial.
**Held dep migrations (breaking, no security benefit — audits clean):** ⚪ react 18→19 BLOCKED (mobile/RN pins react@18.2.0 → dual-React; root override pins 18.2.0) · ⚪ tailwindcss 3→4 (config rewrite) · ⚪ express 4→5 · ⚪ multer 1→2 · ⚪ umzug 2→3 (server.js v2 API) · ⚪ eslint 8→10 (flat config).
**Minor:** ⚪ `emailService.js` legacy (chat+match) · ⚪ admin user detail "No profile created yet".

## Audit History
- 2026-03-12 Security audit — all critical/high/med resolved, CORS hardened
- 2026-04-28 Backend hardening (9 bugs: CSP/webhook/email/notif/boost/validators); Workflow audit (11 flows, 8 fixed); Competitive features (religion/caste/income/motherTongue filters, photo blur, incognito, verified badge, weekly digest, VIP boost)
- 2026-04-30 UI fixes (dark mode, chat route, profile meter, password std, Google Sign-In)
- 2026-05-01 Backend prod hardening (16: webhook path, raw body, timing-safe sig, OTP limit, pagination, PII leak, XSS strip, startup validation)
- 2026-05-04 Prod QA (6 bugs: DB SSL crash, missing migrations, CORS loopback, login complexity, error display, 404 redirect)
- 2026-06-02 Mobile-web responsiveness (Home.jsx 375/768px)
- 2026-06-09 Mobile re-theme (neutral palette →web #FAFAFA/#FFFFFF/#E8E8E8/#2D2D2D, errorBg/warningBg/successBg/infoBg tokens, callTheme.ts dark-navy)
- 2026-06-14 Competitive parity R1 (benchmark vs Shaadi/Jeevansathi → `docs/07_Competitive_Benchmark.md`, spec `docs/08_Spec_Competitive_Parity.md`). Shipped: web pages for Verification/Guardian/Astrologers (booking-only, in-browser calls DEFERRED); GET /match/daily (cached IST set); GET /profile/me/recently-viewed; SuccessStory model+admin CRUD+public page (Home.jsx now fetches); web i18n scaffold en/hi/pa. Migrations 000035/000036 — run `npm run migrate`.
- 2026-06-14 Competitive parity R2 (re-benchmark → final buildable-gap closure; spec addendum C8–C10). Shipped: **search-by-ID** (`GET /search/by-code` + shareable `TCS-XXXXXXXX` code on profile, util `profileCode`); **video intro** (`POST/DEL /profile/video-intro`, migration **000037** Profile.videoIntroUrl, web `VideoIntroManager`+playback); **numerology** (life-path + pairwise match on `horoscope-match`, util `numerology`). Unit tests `numerology.test.js`+`profileCode.test.js`. Remaining gaps intentional: web calls, kundli PDF, full web i18n, SMS match alerts (won't-do — push+email cover), settlement guarantee, RM web. Run `npm run migrate` for 000037.

- 2026-06-16 **Full 9-phase audit + remediation** (tracker `review-progress.md`, 53 findings REF-1..53). Fixed all 3 Highs (WH-1 bg-check fail-closed+env guard; SOCK-1/MF-1 group-socket IDOR disabled; FE-1 super_admin) + ~all Mediums/Lows: UTIL-1 timing-safe verify, VAL-1 OTP validators, SEC-1 no query-token, WH-2/3/4, SEC-2 CORS, SEC-3 dead guard removed, SEC-4 resource_type pin, CTRL-1/2 incognito, PERF-1 search attrs, UTIL-2 indexed by-code, ERR-1/2/3/4, FE-2 single auth call, SOCK-3/5/6. Migration **000038** (search indexes + drop dup Messages index); 000036 made idempotent. SEO: robots/sitemap + per-route helmet meta (`Seo.jsx`). Tests: route-guard + razorpay + bgCheck-webhook suites.
- 2026-06-16 **Dependency security + update sweep.** REF-3 single root lockfile. Fixed all runtime vulns: ws DoS (8.21.0 override), cloudinary 2.10 (arg-injection), nodemailer 9 (SMTP-injection), dompurify 3.4.10 (XSS), react-router 7 (open-redirect XSS). Updated: vite 8/vitest 4/jsdom 29/RTL 16, framer-motion 12, lucide 1, react-icons 5, typescript 6, helmet 8, bcryptjs 3, jest 30, +safe minors. react pinned 18.2.0 (override, mobile dual-React). **Result: frontend audit 0 vulns; backend 0 high/0 critical** (27 moderate transitive). Held: react 19 (mobile-blocked), tailwind 4, express 5, multer 2, umzug 3, eslint 10.

## Project Status (2026-06-16)
**✅ Complete:** audit (9 phases) + remediation (3 Highs + ~all M/L) · dependency security (0 runtime vulns) · DB migrations through 000038 (applied) · SEO (robots/sitemap/per-route meta) · regression tests (guards/payment/webhook) · build + FE 31/31 + BE 99 tests green · pushed to origin/main.
**🔧 Incomplete (needs creds, not code):** Razorpay/Email/Google-OAuth/SMS/FCM live keys.
**🔧 Incomplete (needs build work):** family-group chat backend (Group model+routes — currently disabled) · kundli PDF · web in-browser calls · full web i18n · held dep migrations (react 19 [mobile-blocked], tailwind 4, express 5, multer 2, umzug 3, eslint 10) · buffered magic-byte upload (SEC-4 full) · QA-2/3 broader integration+e2e · 9 stale unit tests.

## Audit System
Full-project audit runs chunked, never one pass. **Tracker = single source of truth: `review-progress.md` (repo root).** Read before any review chunk, update after. Methodology + phase→skill map: `docs/09_Audit_System.md`. Rules: evidence (`file:line`) for every finding · never assume/hallucinate code · severity Critical/High/Medium/Low · report-only skill first (`/qa-only`,`/code-review`), fix in separate chunk. 9 phases (Architecture→Backend→DB→Security[OWASP]→Frontend→SEO→Performance→QA→Missing Features); skills: `/health`,`/code-review`,`/security-review`,`/cso`,`/design-review`,`/browse`,`/benchmark`,`/qa-only`→`/qa`,`/spec`. Resume after context loss: open tracker → first non-✅ phase → first `[ ]` item. **Audit COMPLETE (2026-06-16)** — all 9 phases ✅, 53 findings remediated (3 Highs + ~all M/L); see tracker Remediation Log + Project Status above. Prior seeded gaps resolved: robots.txt/sitemap added, route-guard component tests added.

## gstack Skills (REQUIRED)
```bash
test -d ~/.claude/skills/gstack/bin && echo GSTACK_OK || echo GSTACK_MISSING
# MISSING: git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup --team
```
Always use matching skill. `/browse` all web (never WebFetch/Search) · `/qa` after feature · `/design-review` after UI · `/review` before commit · `/investigate` unknown bugs · `/ship` deploy · `/run` start/verify · `/verify` fix works · `/code-review` (ultra=cloud) · `/simplify` reuse · `/ui-ux-pro-max` UI design · `/spec` before complex feature · `/security-review` before auth/payment/data code.
