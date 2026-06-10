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
- `config/env.js` — sole env source (never read process.env elsewhere); prod guard `process.exit(1)` on dev JWT_SECRET/COOKIE_SECRET/DB_PASSWORD/FRONTEND_URL
- `config/database.js` Sequelize+PG · `routes/index.js` mounts `/api/v1`+`/api`; marketing mounted in server.js at `/api/marketing`
- `middlewares/`: security (helmet, CORS, 9 limiters, Redis lockout, sanitize) · auth (JWT cookie, adminAuth, requirePremium/VIP, socketAuth) · errorHandler (AppError, asyncHandler) · logger (JSON) · upload (Multer+Cloudinary, magic-byte; voice-intro resource_type=`video`)
- `socket/socketHandler.js` — join-room, send-message, typing, edit, delete, online-status, group rooms (join-group/leave-group/group-send-message→group-message-received)
- `utils/`: cache (Redis+in-mem fallback; `get/set/del`,`getString/setString`,`getNumber/setNumber`) · queue (Bull: email/cleanup/push; weekly digest Mon 10AM, saved-search-alerts daily 9AM) · notifyUser `notify(userId,type,title,body,relatedId)` · razorpay (PLANS, createOrder, verifyPayment, createGenericOrder; throws on placeholder secret) · agoraToken (`DEV_STUB_TOKEN` if unset) · smsService (Fast2SMS/MSG91, dev logs OTP, 3/hr) · bgCheckService (AuthBridge+Signzy, dev stub auto-pass 5s) · email (primary) · emailService (legacy, chatController only) · compatibility (score + Vedic Ashtakoot 27-nakshatra/8-guna/dosha; `resolveNakshatra()` 50+ aliases)
- `validators/index.js` all express-validator schemas

**Auth:** httpOnly accessToken(15m JWT)+refreshToken(7d hashed). Rotation+family revoke. Lockout 5/30min (Redis). Google `POST /auth/google`. Mobile biometric→refresh-token flow.
**Limiters:** api 200/15m · auth 5/15m · signup 3/hr · pwReset 3/hr · search 30/min · message 60/min · profileUpdate 10/min · matchAction 60/min · upload 20/hr · admin 100/min · payment 10/hr
**Plans:** free ₹0 · basic_premium ₹1500/15d/5unlock · premium_plus ₹3000/30d/10unlock · vip ₹7499/90d/unlimited+boost
**Migrations:** 000001–000033. `npm run migrate` (backend/) before prod. `quizAnswers` JSONB on Profile has NO migration — `ALTER TABLE "Profiles" ADD COLUMN "quizAnswers" JSONB` manually.

## API (`/api/v1` unless noted; full: `docs/06_API_Reference.md`)
- **auth** `/auth`: signup, login, refresh, forgot-password, reset-password, google, send-otp, verify-otp, GET me, logout, logout-all, change-password, GET sessions, DEL sessions/:id, DEL account
- **profile** `/profile`: GET/PUT me, GET me/stats, GET me/viewers, DEL me/photo, DEL me/profile-photo, POST/DEL voice-intro, PUT privacy, GET :id, POST :id/unlock-contact, GET :id/compatibility, GET :id/horoscope-match
- **search** `/search`: GET /, GET suggestions
- **match** `/match`: POST :id {action}, GET likes, GET shortlist, GET mutual
- **chat** `/chat` (premium): GET conversations, GET messages/:id, POST messages, POST send, PUT/DEL messages/:id
- **subscription** `/subscription`: GET plans, POST webhook, GET my-subscription, POST create-order, POST verify-payment, DEL current, GET history, GET invoice/:id
- **verification** `/verification`: GET status, POST submit, POST selfie, POST bg-check/initiate, POST bg-check/verify-payment, GET bg-check/status, POST bg-check/webhook (no-auth, HMAC-SHA256 via BG_CHECK_WEBHOOK_SECRET, raw body)
- **notifications** `/notifications`: GET /, GET unread-count, PUT read-all, PUT :id/read, DEL :id, POST/DEL fcm-token
- **calls** `/calls`: GET agora-token, POST initiate, GET history, PUT :id/accept|decline|end
- **guardian** `/guardian` (DB): GET my-guardians, POST invite, DEL :linkId, GET my-candidates, GET candidate/:id/matches|shortlisted, POST resolve-invite/:token
- **astrologers** `/astrologers`: GET /, GET my-bookings, GET :id, POST book, POST book/:id/verify-payment|start-call|end-call
- **block**/**report** `/block`,`/report`: POST :id, DEL :id, GET /
- **admin** `/admin`: GET/POST users, GET users/:id, PUT users/:id/status|subscription, GET verifications, PUT verifications/:id {status,adminNotes}, GET analytics|revenue|reports, PUT reports/:id {status,adminNotes}, GET invoice/:id, GET/POST marketing-users, PUT marketing-users/:id/status, GET marketing-users/:id/stats, GET/POST referral-codes, PUT referral-codes/:id/toggle, GET leads, POST push-smoke-test
- **marketing** `/api/marketing` (marketing role): GET dashboard|leads, PUT leads/:id/status, GET/POST referral-codes

**Flows:** Login→httpOnly cookies→`/auth/me`. Onboarding 14-step→`PUT /profile/me`. Match `POST /match/:id {action}`→mutual→notify. Chat premium+mutual (REST+Socket). Payment Razorpay order→verify→webhook fallback. Photo Multer→Cloudinary 500² face+1200² gallery max6. Boost +8 sort. Verify docs→admin→badge.

## Frontend (web)
`main.jsx`→`App.jsx`→AuthProvider→OnboardingProvider→SocketProvider. Contexts `useAuth/useOnboarding/useSocket`. Aliases `@`→src,@components/@pages/@context/@api/@utils/@hooks/@assets. HTTP `api/axios.js` (withCredentials, auto 401→refresh queue); `apiClient.js` alias.

Routes:
- public: `/ /login /signup /onboarding /forgot-password /reset-password /terms /privacy /about /contact /safety`
- ProtectedRoute: `/dashboard /profile /profile/edit /profile/:id /search /chat /subscription /payment/success|failed|history /settings /notifications`
- AdminProtectedRoute `/admin/*`: dashboard, users(+create,:id), verifications, subscriptions, revenue, reports, marketing-users(+:id), referral-codes, leads
- MarketingProtectedRoute `/marketing/*`: dashboard, leads, referral-codes

Onboarding 14: Welcome→CreatingFor→BasicInfo→CreateAccount→AboutYourself→Location→Education→MaritalStatus→Religion→Lifestyle→Family→Preferences→Photos→Verification.
Dead (deletable): `pages/Profile.jsx`, `pages/Signup.jsx`. Build: Vite terser drops console in prod; chunks vendor-react/ui/utils; es2020.

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
Checklist: real Razorpay → Email → Google OAuth → `.env.production` → strong secrets → migrate(→000033) → seed admin → PWA icons → HTTPS → SMS/Agora/BG_CHECK/FCM env.

## Admin
`admin@tricitymatch.com` / `Pass@1234` (or `ADMIN_EMAIL`/`ADMIN_PASSWORD`). Login `/login` (not /admin/login). Re-seed `node backend/seeders/adminSeeder.js`.

## Testing
Backend unit+integration Jest+Supertest `backend/tests/`. Frontend Vitest+RTL `frontend/src/tests/`. E2E Playwright `e2e/tests/` (9).

## Known Issues
🔴 Razorpay placeholder · 🟡 Email/GoogleOAuth off · 🟡 SMS OTP needs SMS_API_KEY · 🟡 quizAnswers no migration (ALTER manually) · 🟠 Push stub (FCM creds+native build) · 🟠 Redis not in dev · ⚪ `pages/Profile.jsx`+`emailService.js` dead/legacy · ⚪ admin user detail "No profile created yet"

## Audit History
- 2026-03-12 Security audit — all critical/high/med resolved, CORS hardened
- 2026-04-28 Backend hardening (9 bugs: CSP/webhook/email/notif/boost/validators); Workflow audit (11 flows, 8 fixed); Competitive features (religion/caste/income/motherTongue filters, photo blur, incognito, verified badge, weekly digest, VIP boost)
- 2026-04-30 UI fixes (dark mode, chat route, profile meter, password std, Google Sign-In)
- 2026-05-01 Backend prod hardening (16: webhook path, raw body, timing-safe sig, OTP limit, pagination, PII leak, XSS strip, startup validation)
- 2026-05-04 Prod QA (6 bugs: DB SSL crash, missing migrations, CORS loopback, login complexity, error display, 404 redirect)
- 2026-06-02 Mobile-web responsiveness (Home.jsx 375/768px)
- 2026-06-09 Mobile re-theme (neutral palette →web #FAFAFA/#FFFFFF/#E8E8E8/#2D2D2D, errorBg/warningBg/successBg/infoBg tokens, callTheme.ts dark-navy)

## gstack Skills (REQUIRED)
```bash
test -d ~/.claude/skills/gstack/bin && echo GSTACK_OK || echo GSTACK_MISSING
# MISSING: git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup --team
```
Always use matching skill. `/browse` all web (never WebFetch/Search) · `/qa` after feature · `/design-review` after UI · `/review` before commit · `/investigate` unknown bugs · `/ship` deploy · `/run` start/verify · `/verify` fix works · `/code-review` (ultra=cloud) · `/simplify` reuse · `/ui-ux-pro-max` UI design · `/spec` before complex feature · `/security-review` before auth/payment/data code.
