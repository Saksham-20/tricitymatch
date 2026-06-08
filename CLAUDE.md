# CLAUDE.md

> **AGENT RULES — read before every session:**
> 1. **Read this file first.** Always. Every session.
> 2. **Update this file after every session** — mark completed work, update "Next Session", add new gotchas. Keep it compact: no verbose prose, no redundant examples, one-liner per audit entry.
> 3. **Use skills** (see gstack section). Never do manually what a skill does.

**TricityShadi** — hyperlocal matrimonial for Chandigarh/Mohali/Panchkula. React 18 SPA + Express.js + PostgreSQL + Redis + Socket.io. Docker Compose + Nginx.

---

## Commands

```bash
npm run dev                          # both services
npm run dev:backend                  # nodemon :5001
npm run dev:frontend                 # Vite :3000
npm run test / test:backend / test:frontend
npm run lint / lint:fix
npm run build

# DB (from backend/)
npm run migrate / migrate:undo / db:reset / db:create / db:drop
node seeders/adminSeeder.js          # after migrate

# E2E
npm run qa / qa:auth / qa:visual / qa:headed / qa:full / qa:ui
```

Backend: **5001**. Frontend dev: **3000** (Vite proxies `/api` + `/socket.io`).

---

## Architecture

```
/
├── backend/      Express.js API (CommonJS)
├── frontend/     React + Vite (ESM, JSX+TSX)
├── mobile/       React Native (Expo bare, iOS+Android) — Sessions 1+2 done
├── shared/       TypeScript types + constants
├── docs/         PRD, architecture, security, frontend spec, feature tickets
├── e2e/          Playwright (8 spec files)
├── nginx/        Reverse proxy config
├── monitoring/   Prometheus/Grafana
└── docker-compose.yml
```

---

## Backend

**Entry:** `server.js` → Express, Socket.io, middleware, routes.

| Path | Purpose |
|------|---------|
| `config/env.js` | Single source of truth for env vars — never read `process.env` elsewhere |
| `config/database.js` | Sequelize + PostgreSQL |
| `routes/index.js` | Mounts all routes under `/api/v1` + `/api` (legacy) |
| `middlewares/security.js` | Helmet, CORS, 9 rate limiters, account lockout (Redis), sanitization |
| `middlewares/auth.js` | JWT cookie auth, adminAuth, requirePremium, requireVIP, socketAuth |
| `middlewares/errorHandler.js` | AppError, asyncHandler, Sequelize/JWT/Multer translators |
| `middlewares/logger.js` | Structured JSON logger (log.error/warn/info/debug/security/audit/performance) |
| `middlewares/upload.js` | Multer + CloudinaryStorage, magic-byte validation |
| `socket/socketHandler.js` | join-room, send-message, typing, edit, delete, online-status |
| `utils/cache.js` | Redis (ioredis) + in-memory fallback |
| `utils/queue.js` | Bull queues: email, cleanup, push-stub. Weekly digest cron Mon 10AM |
| `utils/notifyUser.js` | `notify(userId,type,title,body,relatedId)` → DB + Socket.io |
| `utils/razorpay.js` | PLANS object, createOrder, verifyPayment, getPlanDetails |
| `utils/email.js` | Primary email util — nodemailer, all templates |
| `utils/emailService.js` | Legacy (chatController only) — sendMatchNotification/sendMessageNotification |
| `utils/compatibility.js` | Compatibility score between two Profile objects |
| `validators/index.js` | All express-validator schemas |

**Auth:** httpOnly `accessToken` (15m JWT) + `refreshToken` (7d, hashed in DB). Token rotation + family revocation. Account lockout: 5 attempts / 30min (Redis). Google OAuth: `POST /api/v1/auth/google`.

**Rate limiters:** apiLimiter 200/15m · authLimiter 5/15m · signupLimiter 3/hr · passwordResetLimiter 3/hr · searchLimiter 30/min · messageLimiter 60/min · profileUpdateLimiter 10/min · matchActionLimiter 60/min · uploadLimiter 20/hr · adminLimiter 100/min · paymentLimiter 10/hr

**API routes** (all under `/api/v1`): auth · profile · search · match · chat (premium) · subscription · admin · verification · block · report · notifications · calls · guardian · astrologers · marketing · monitoring — **full reference: `docs/06_API_Reference.md`**

**Plans:** free ₹0 · basic_premium ₹1500/15d/5unlocks · premium_plus ₹3000/30d/10unlocks · vip ₹7499/90d/unlimited+boost

**DB Migrations:** 000001–000022 (users → profiles → subscriptions → matches → messages → verifications → profile-views → enhanced-fields → delivered-at → edit-fields → refresh-tokens → indexes → horoscope → privacy → notifications → blocks → reports → contact-unlocks → subscription-plans → sync-users → deleted-status → google-oauth)

**Key flows:** Login → httpOnly cookies → `/auth/me`. Onboarding: 14-step → `PUT /profile/me`. Match: `POST /match/:userId { action }` → mutual detection → notify. Chat: premium + mutual + REST + Socket.io. Payment: Razorpay order → verify → webhook fallback. Photo: Multer → Cloudinary, 500×500 face + 1200×1200 gallery, max 6. Boost: +8 sort score. Verification: docs → admin → badge. Notifications: DB + Socket.io emit.

---

## Frontend

**Entry:** `main.jsx` → `App.jsx` → AuthProvider → OnboardingProvider → SocketProvider

**Context:** `useAuth()` (auth state, localStorage hint), `useOnboarding()` (14-step state machine), `useSocket()` (Socket.io lifecycle)

**Path aliases:** `@`→src · `@components` · `@pages` · `@context` · `@api` · `@utils` · `@hooks` · `@assets`

**HTTP client:** `api/axios.js` — `withCredentials:true`, auto 401→refresh queue. `api/apiClient.js` re-export alias.

**Routes:**

| Route | Component | Guard |
|-------|-----------|-------|
| `/` | Home | public |
| `/login` | Login | public |
| `/onboarding` | ModernOnboarding | public |
| `/forgot-password` / `/reset-password` | ForgotPassword / ResetPassword | public |
| `/dashboard` `/profile` `/profile/edit` `/profile/:userId` `/search` `/chat` | various | ProtectedRoute |
| `/subscription` `/payment/*` `/settings` `/notifications` | various | ProtectedRoute |
| `/admin/*` | AdminLayout | AdminProtectedRoute |
| `/marketing/*` | MarketingLayout | MarketingProtectedRoute |

Dead files (safe to delete): `pages/Profile.jsx`, `pages/Signup.jsx`

**Onboarding steps (14):** Welcome → CreatingFor → BasicInfo → CreateAccount → AboutYourself → Location → Education → MaritalStatus → Religion → Lifestyle → Family → Preferences → Photos → Verification

**Build:** Vite terser drops console in prod. Manual chunks: vendor-react, vendor-ui, vendor-utils. Targets: es2020/edge88/firefox78/chrome87/safari14.

---

## Environment

**Backend env** — file `.env.development` at repo root (has trailing space quirk).

Required: `PORT=5001 DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET FRONTEND_URL`

Status: Cloudinary ✅ · Razorpay ❌ placeholder · Email ❌ placeholder · Google OAuth ❌ placeholder · Redis optional (in-memory fallback)

**Frontend env** — `frontend/.env`: `VITE_API_URL VITE_WS_URL VITE_RAZORPAY_KEY_ID VITE_CLOUDINARY_CLOUD_NAME✅ VITE_GOOGLE_CLIENT_ID❌`

**Production guard:** `config/env.js` calls `process.exit(1)` if JWT_SECRET/COOKIE_SECRET/DB_PASSWORD/FRONTEND_URL have dev values.

---

## Deployment

```bash
docker-compose up -d
docker-compose --profile full up -d          # production
docker-compose --profile full --profile monitoring up -d
```

Nginx upstream: `backend:5000` (Docker internal — correct, host maps 5001:5000).

**Production checklist:** Real Razorpay keys → Email creds → Google OAuth → `.env.production` → strong secrets → migrate → seed admin → PWA icons → HTTPS.

**CRITICAL deploy note:** Use `--force-recreate` when rebuilding backend image. `docker compose up -d` alone won't replace running containers.

---

## Admin

| | |
|-|-|
| Email | `admin@tricitymatch.com` (or `ADMIN_EMAIL`) |
| Password | `Pass@1234` (or `ADMIN_PASSWORD`) |
| Login URL | `/login` (not `/admin/login`) |

Re-seed: `node backend/seeders/adminSeeder.js`

---

## Testing

| Layer | Framework | Location |
|-------|-----------|---------|
| Backend unit | Jest + Supertest | `backend/tests/unit/` |
| Backend integration | Jest + Supertest | `backend/tests/integration/` |
| Frontend unit | Vitest + RTL | `frontend/src/tests/` |
| E2E | Playwright | `e2e/tests/` (8 suites) |

---

## Known Issues

| Issue | Severity |
|-------|----------|
| Razorpay keys placeholder | 🔴 BLOCKER |
| Email not configured | 🟡 |
| Google OAuth disabled | 🟡 |
| OTP bypass removed — real SMS via Fast2SMS/MSG91, needs SMS_API_KEY env var to activate | 🟡 set env var |
| PWA icons missing | ✅ resolved |
| Push notifications stub | 🟠 |
| Redis not in dev | 🟠 degraded |
| `pages/Profile.jsx` dead file | ⚪ |
| `emailService.js` legacy duplicate | ⚪ |
| Admin user detail "No profile created yet" | ⚪ bug |

---

## Audit History (summary)

- **2026-03-12** Security audit — all critical/high/medium resolved, CORS hardened
- **2026-04-28** Backend hardening — 9 bugs (CSP, webhook, email, notifications, boost, validators)
- **2026-04-28** Workflow audit — 11 flows traced, 8 bugs fixed
- **2026-04-28** Competitive features — religion/caste/income/motherTongue filters, photo blur, incognito, verified badge, weekly digest, VIP boost
- **2026-04-30** UI fixes — dark mode, chat route, profile meter, password standardization, Google Sign-In
- **2026-05-01** Backend prod hardening — 16 issues (webhook path CRITICAL, raw body, timing-safe sig, OTP rate limit, pagination, PII leak in email preview, XSS strip, startup validation)
- **2026-05-04** Full prod QA on tricityshadi.com — 6 bugs (DB SSL crash CRITICAL, missing migrations CRITICAL, CORS loopback HIGH, login complexity check HIGH, error display MEDIUM, 404 redirect MEDIUM)
- **2026-06-02** Mobile responsiveness — Home.jsx full audit at 375px/768px, all sections fixed
- **2026-06-04** Session 8 — Agora backend (token util, call_sessions migration, callController/routes), FCM useNotificationHandler hook, authStore logout FCM deregister, full NotificationsScreen, 0 TS errors
- **2026-06-04** Session 9 — VoiceCallScreen (Agora dynamic require, mute/speaker/end, 30s ring timeout, timer), VideoCallScreen (remote feed, draggable PiP, camera toggle/flip, auto-hide controls), IncomingCallModal (pulse animation, 30s countdown, accept→navigate, decline→API), wired into RootNavigator via callStore, 0 TS errors
- **2026-06-04** Session 10 — SubscriptionScreen (plan cards, Razorpay dynamic stub, history tab), SettingsScreen (incognito, elder mode, language picker, delete account), VerificationScreen (4 tiers, document upload stub), BlockReportSheet (6 categories, wired into ProfileDetailScreen ⋮), verification.ts + block.ts APIs, deleteAccount auth API, 0 TS errors
- **2026-06-04** Session 11 — Biometric login full flow (LoginScreen: capability check on mount, setup-prompt modal post email/password login, 3-attempt lockout, settings toggle in SettingsScreen), useOfflineShortlist hook (MMKV cache, @react-native-community/netinfo, react-native-fast-image prewarm, 200-profile cap, lastSyncedLabel), OfflineBanner wired into MatchesScreen shortlisted tab, elderTheme util (fontSize/tapSize helpers), MainNavigator elder mode (4-tab, icons +6dp, tabBarHeight 80, animation:none), 0 TS errors
- **2026-06-04** Session 12 — AdminHomeScreen (stats cards, queue entry points), VerificationQueueScreen (approve/reject + reason modal, DocumentType map), ReportsQueueScreen (dismiss/suspend + admin notes modal), BureauHomeScreen (overview stats, recent proposals), ClientRosterScreen (search, propose button), MatchProposalScreen (3-step wizard: select client → select match → review+notes), EarningsScreen (total/pending/paid + transaction list), SupportScreen (WhatsApp deep link + email + accordion FAQ), SuccessStoryScreen (form + success state), submitSuccessStory API added to profile.ts, getBureauProposals + updateReport + updateUserStatus API methods, corrected admin API routes (PUT /verifications not POST /approve), 0 TS errors
- **2026-06-04** Session 13 — Real OTP backend (smsService.js Fast2SMS/MSG91, removed 123456/000000 bypass, rate-limited 3/hr, env.sms config added), "Why This Match" CompatibilityBreakdownSheet (modal, per-category score bars, wired into ProfileDetailScreen tap on compat bar, GET /profile/:userId/compatibility endpoint), Profile completeness rewards (milestone notifications at 50/70/80/100% via checkMilestone in updateProfile, MilestoneStrip badges on OwnProfileScreen), Compatibility Quiz (QuizScreen 10-question, quizAnswers stored on Profile model + shared type, Quiz registered in MainNavigator, CTA banner on OwnProfileScreen), Weekly digest push notifications (APP-047: FCM push added alongside email in send-weekly-digest cron), Saved search alerts (APP-048: saved-search-alerts daily 9AM cron, notify per matched saved search with 24h dedup), 0 TS errors
- **2026-06-05** Session 14 — PWA icons confirmed already present (removed ✅ known issue), APP-050 voice note profile intros (audio upload middleware, POST/DELETE /profile/voice-intro, voiceIntroUrl on Profile model, VoiceIntroRecorder component record/preview/upload/delete + read-only playback in ProfileDetailScreen Premium+ gated, mobile API uploadVoiceIntro/deleteVoiceIntro), migration 000028 (quizAnswers + voiceIntroUrl), APP-058 dark mode (darkColours palette in shared theme, useTheme hook, uiStore darkModeOverride null|bool, Settings toggle with system fallback, NavigationContainer DarkTheme/DefaultTheme wired in RootNavigator), 0 TS errors
- **2026-06-05** Session 15 — APP-052 selfie liveness stub (SelfieVerificationScreen: 5-stage UI instructions→recording→processing→success→failed, expo-camera dynamic require, countdown circle, RecordingDot pulse animation, POST /verification/selfie API, CTA card wired into VerificationScreen), APP-053 family group chat (FamilyGroupsScreen create/list, FamilyGroupChatScreen inverted FlatList + invite modal + socket group-message-received event, getFamilyGroups/createFamilyGroup/sendGroupMessage/getGroupThread APIs), APP-054 guardian co-pilot (GuardianSetupScreen candidate invites up to 3 guardians, revokeGuardian, read-only permission table; GuardianViewScreen: read-only mutual/shortlisted tabs, no action buttons, candidateName header; GuardianCandidatesScreen: list all active links → open GuardianView; guardian.ts API file), role gating (AdminStack only when role=admin|super_admin, BureauStack only when role=bureau in MainNavigator), SettingsScreen new Family section (Family Chat, Guardian Co-Pilot, Guardian Dashboard) + role-conditional Admin/Bureau sections, 0 TS errors
- **2026-06-05** Session 16 — APP-055 full Vedic Ashtakoot Guna Milan (27 nakshatras with Varna/Vashya/Tara/Yoni/Graha Maitri/Gana/Bhakoot/Nadi scoring, dosha detection, compatibility/utils updated, GET /profile/:id/horoscope-match endpoint), HoroscopeMatchScreen mobile (guna bars, dosha tags, manglik badge, rashi fallback, "View Ashtakoot" CTA in ProfileDetailScreen Horoscope accordion), APP-059 astrologer marketplace stub (AstrologerMarketplaceScreen: list, online filter, stub data fallback; AstrologerDetailScreen: duration picker, slot picker, booking flow, stub success in DEV; backend /astrologers/* routes; SettingsScreen "Astrologer Consult" entry), guardian backend routes (guardianRoutes.js: /my-guardians, /invite, /:id DELETE, /my-candidates, /candidate/:id/matches+shortlisted; in-memory store for dev), family group socket room (socketHandler: join-group, leave-group, group-send-message→group-message-received), 0 TS errors
- **2026-06-05** Session 17 — Guardian DB migration (GuardianLink model + migration 000029 `guardian_links` table, full DB-backed guardianRoutes.js replaces GUARDIAN_STORE + in-memory reverse index, /resolve-invite/:token endpoint), Astrologer marketplace real impl (Astrologer + AstrologerBooking models + migrations 000030/000031, astrologerRoutes.js Razorpay createGenericOrder + verify-payment + Agora start-call + end-call, auto-seed on first request), APP-060 background check (migration 000032 adds bgCheck*/selfie* cols to Verifications, verificationRoutes.js bg-check/initiate + verify-payment + status + selfie endpoints, BackgroundCheckScreen mobile with consent checkbox + Razorpay dynamic require + polling, wired CTA in VerificationScreen + BackgroundCheck in MainStackParamList/MainNavigator), E2E test suite (09-sessions-13-16-features.spec.js 20 API smoke tests + mobile-only skip stubs), Docker prod hardening (nginx/conf.d/ + nginx/ssl/README.md + security-headers.conf, .env.production.example AGORA/SMS/FCM/BG_CHECK sections, docker-compose.yml new env pass-throughs), 0 TS errors
- **2026-06-05** Session 18 — SKIPPED (APP-057 WhatsApp onboarding deferred — P3/XL, needs WhatsApp Business API provider decision before building)
- **2026-06-05** Session 19 — APP-060 real background check integration: bgCheckService.js (AuthBridge + Signzy adapters, normalized submit/webhook API, dev stub), env.js bgCheck config block (provider/apiKey/apiSecret/webhookSecret/baseUrls), verificationRoutes.js verify-payment now calls submitBgCheck via setImmediate + stores bgCheckProviderRef, webhook endpoint POST /verification/bg-check/webhook (HMAC-SHA256 sig verify, idempotent, notifies user on pass/fail), server.js rawBodyCapture for webhook path, Verification model + migration 000033 (bgCheckProviderRef column + partial index), BackgroundCheckScreen AppState foreground refresh + 15s polling while in_progress, .env.production.example expanded with all new BG_CHECK vars
- **2026-06-05** Session 20 — Launch prep: mobile bundle IDs fixed (app.json TricityShadi slug + iOS com.tricityshadi.app + Android com.tricityshadi.app + strings.xml + AndroidManifest), Java files moved to com/tricityshadi/app/ package dir, eas.json updated (dev/preview/prod env vars + iOS/Android submit config), k6 load test script (scripts/load-test.js, 4-stage ramp to 100 VUs, p95<500ms threshold), pre-launch checklist script (scripts/prelaunch-check.sh, checks env vars/JWT length/health/HTTPS/SSL expiry/Docker/migrations/security flags), FCM push smoke test admin endpoint (POST /api/v1/admin/push-smoke-test, targets specific userId or up to 5 recent users)
- **2026-06-06** Session 21 — iOS native build debugging: fixed node:fs stub, metro resolverMainFields, 19 RN 0.63 platform shims, unimodules pod scanner path, EXUpdates AppDelegate #ifndef DEBUG guards, expo-updates scripts symlink, razorpay/camera/av stubs, metro-transform-plugins inline-plugin null guard, MMKV v4→MemoryStorage fallback. Build now succeeds, Metro bundling active, runtime errors remain.
- **2026-06-06** Session 22 — Mobile stack upgrade to Expo SDK 51 (React 18 + RN 0.74): rewrote package.json (deleted nativewind/unimodules/old metro deps, MMKV v4→v2, react-navigation v7→v6 for screens 3.31.1 compatibility), clean metro.config.js (vanilla monorepo, @shared alias, no node stubs), reset babel/tsconfig, fixed 3 TS errors (CompatibilityBreakdownSheet cast, HoroscopeMatchScreen GunaDetail entries, VideoCallScreen StyleSheet.absoluteFill ViewStyle cast), added i18next compatibilityJSON v3, generated fresh ios/ via expo prebuild, `iOS Bundled 968ms — 0 errors` on simulator. Build is clean + reproducible without any node_modules patches.

---

## Mobile App (`mobile/`) — React Native

### Status: Session 22 Complete (2026-06-06) — SDK 51 CLEAN BUILD ✅

**Reference docs:** `docs/01_PRD.md` · `docs/02_Technical_Architecture.md` · `docs/03_Security_Access.md` · `docs/04_Frontend_Spec.md` · `docs/05_Feature_Tickets.md` · `docs/06_API_Reference.md`

### What's Been Built

| Session | Epic | Built |
|---------|------|-------|
| ✅ 1 | EPIC 1 | shared/ types, stores (auth/ui/call), API client + all endpoints, nav shell (Root/Auth/Onboarding/Main), i18n (en/hi/pa), App.tsx providers, utils, constants, all config |
| ✅ 2 | EPIC 2 | All 7 auth screens fully styled + wired to API (see below) |
| ✅ 3 | EPIC 3a | OnboardingContext (shared state, resume logic), OnboardingLayout (progress bar, back, skip, save), Steps 0–7 fully implemented + wired |
| ✅ 4 | EPIC 3b | Steps 8–14 fully implemented: Lifestyle, FamilyDetails, AboutMe+chips, PartnerPreferences+sliders, PhotoUpload grid, PhoneOTP, Completion ring |
| ✅ 5 | EPIC 4+5 | HomeScreen (feed, completeness strip, quick actions, new profiles), OwnProfileScreen (gallery, sections, ring, verification badges, preview toggle), ProfileDetailScreen (gallery, sticky action bar, accordions, mutual match overlay, match actions), EditProfileScreen (collapsible sections, photo grid, inline field editing, save to API) |
| ✅ 6 | EPIC 6 | ProfileCard (full + compact, compat bar, action buttons), CompatibilityMeter, VerificationBadges, FilterPanel (@gorhom/bottom-sheet, accordion sections, range inputs, gotra exclusion tags, manglik radio, apply count, save search), SearchScreen (name search, infinite scroll, sort picker, saved searches, empty state, skeletons), MatchesScreen (4 sub-tabs: Mutual/Shortlisted/Liked Me/My Interests, accept/decline, upgrade gate) |
| ✅ 7 | EPIC 7+8 | useSocket hook (module-level singleton, AppState foreground reconnect, 8 events → RQ cache patches + Zustand), ConversationsScreen (Plus+ gate, ConversationCard, unread badge, real-time via useSocket, pull-to-refresh), ChatThreadScreen (inverted FlatList, MessageBubble own/theirs, date separators, read receipts, typing indicator, optimistic send, edit/delete, long-press menu, contact unlock banner, voice/video call header buttons), ChatThread route added to MainStackParamList + MainNavigator |
| ✅ 8 | Backend+EPIC 9+10 | Agora: agoraToken.js util, migration 000027 call_sessions, CallSession model, callController.js (getAgoraToken/initiateCall/acceptCall/declineCall/endCall/getCallHistory), callRoutes.js mounted at /api/v1/calls, Agora config in env.js. FCM: useNotificationHandler hook (dynamic require, permission, token register/refresh/deregister, foreground + background-tap), FCM token deregister wired into authStore.logout, registerFcmToken/removeFcmToken/getUnreadCount added to notifications API. NotificationsScreen: full implementation (infinite scroll, mark-read, mark-all-read, type→icon+colour map, deep-link navigation, empty state, pull-to-refresh). |

**Session 2 auth screens** (`mobile/src/features/auth/`):

| Screen | What it does |
|--------|-------------|
| `SplashScreen` | Rose-600 bg, text logo, 2s → Welcome (or Main if auth'd) |
| `WelcomeScreen` | 3 swipeable value-prop cards, language selector EN/हि/ਪੰ, Get Started + Sign In CTAs |
| `LoginScreen` | Email/password, show/hide, biometric auto-prompt, 429 lockout countdown, Google Sign-In stub |
| `SignupScreen` | Email/password/confirm, password strength bar (weak/medium/strong), T&C checkbox, field-level errors |
| `ForgotPasswordScreen` | Email input, email enumeration protection, success state |
| `ResetPasswordScreen` | Deep-link token via route params, new password + confirm, success state |
| `OTPScreen` | 6 digit boxes, auto-advance on fill, auto-submit when complete, 60s resend countdown, backspace backtrack |

All screens: `testID` on every element · `accessibilityLabel` on all inputs/buttons · `useTranslation()` for all strings · `RouteProp` from `@react-navigation/native` (not native-stack).

### Next: Post-Launch

**Gotcha:** Session 20 complete. Run `npm run migrate` from backend/ before prod deploy to apply all migrations through 000033. Bundle IDs are now `com.tricityshadi.app` on both iOS + Android — update `eas.json` `submit.production.ios` fields (appleId, ascAppId, appleTeamId) with real values before `eas submit`. Pre-launch checklist: `bash scripts/prelaunch-check.sh` — set `ENV_FILE=.env` and `BASE_URL=https://tricityshadi.com`. Load test: `k6 run scripts/load-test.js --env BASE_URL=https://tricityshadi.com`. FCM smoke test: `POST /api/v1/admin/push-smoke-test` (admin auth required). BG check auto-passes after 5s in dev — needs `BG_CHECK_PROVIDER` + `BG_CHECK_API_KEY` in prod. `verifyPayment` throws on placeholder Razorpay secret — set real keys before prod.

### Mobile Commands

```bash
# IMPORTANT: ALL mobile commands must run from inside mobile/ directory
cd /Users/sakshampanjla/Desktop/REACT/tricitymatch/mobile

# TypeScript check (must pass -p mobile/tsconfig.json)
/Users/sakshampanjla/Desktop/REACT/tricitymatch/node_modules/.bin/tsc --noEmit -p tsconfig.json

# Start Metro
npx expo start --clear

# Simulators (after EAS dev build) — run from mobile/ dir
npx expo run:ios
npx expo run:android

# Install packages (run from repo root)
npm install <pkg> --legacy-peer-deps -w mobile
```

### Mobile Gotchas

| Issue | Fix |
|-------|-----|
| **ALL expo commands run from `mobile/`** | `cd mobile` first — metro.config.js, app.json, ios/, android/ all live there. Running from repo root uses wrong config. |
| `tsc` in PATH = v4.0.8 | Use `/Users/sakshampanjla/Desktop/REACT/tricitymatch/node_modules/.bin/tsc` |
| MMKV v4 API | `createMMKV()` not `new MMKV()`. `.remove(key)` not `.delete(key)` |
| `moduleResolution: bundler` needs TS5 | `typescript@5` in mobile devDeps |
| Expo SDK 41 = React 16 types | `@types/react@^18.3.0` + `@types/react-native@^0.73.0` pinned in mobile |
| `@shared/*` alias | In both `tsconfig.json` paths AND `metro.config.js` |
| `RouteProp` import | From `@react-navigation/native`, NOT `native-stack` |
| `OnboardingProvider` wraps `Stack.Navigator` | Provider must be outside Stack so `useNavigation()` inside context can navigate between steps |
| `DocumentPicker.getDocumentAsync` result | Check `result.assets[0]` not `result.uri` (SDK 41+ API) |
| Dual-handle slider (Step 11) | No slider lib installed. Custom PanResponder implementation. Track width stored in `useRef` and updated via `onLayout`. |
| Step 12 photo reorder | No drag-reorder lib. Uses left/right chevron buttons to swap positions. DnD lib requires `react-native-reanimated@3+` which conflicts with SDK 41. |
| Step 14 completion ring | No SVG. Uses View with border colours for partial-ring effect. Full arc requires `react-native-svg`. |
| `ProfileSummary.age` | No `age` field — derive via `dateOfBirth`: `Math.floor((Date.now() - new Date(dob).getTime()) / (365.25*24*3600*1000))` |
| EditProfileScreen nav | Navigates to `EditProfile` (MainStackParamList) not `Settings`. Both are registered in MainNavigator. |
| Photo upload in EditProfile | Uses Alert picker stub only — real `expo-image-picker` needs native build (`npx expo run:ios`). |
| FCM token hook | `useNotificationHandler` uses dynamic `require('@react-native-firebase/messaging')` — no-op in Expo Go. Needs native build. |
| FCM backend routes | `/api/v1/notifications/fcm-token` (POST/DELETE) — NOT `/api/v1/auth/device-token` as spec says. Backend already had these at notifications routes. |
| Agora token stub | If `AGORA_APP_ID`/`AGORA_APP_CERTIFICATE` not set, backend returns `{ token: 'DEV_STUB_TOKEN', isStub: true }` — safe for dev. |
| CallSession migration | File: `20240101000027-create-call-sessions.js`. Run `npm run migrate` from backend/ to apply. |
| cache API (MMKV) | Use `.setString/.getString` not `.set/.get` — cache object has typed accessors only. |
| Tab navigation from stack | Tabs (Matches, Profile) need `nav.navigate('MainTabs', { screen: 'Matches' })` not direct `nav.navigate('Matches')`. |
| `react-native-agora` not installed | Uses dynamic `require('react-native-agora')` — no-op in Expo Go, real engine in EAS native build (same pattern as FCM). Install with `npm install react-native-agora --legacy-peer-deps -w mobile` before native build. |
| `IncomingCallModal` placement | Rendered inside `<NavigationContainer>` in RootNavigator but outside Stack — gives it access to navigation context so it can `navigate()` on accept. |
| `StyleSheet.absoluteFillObject` | Not in RN 0.63 types. Use `StyleSheet.absoluteFill` (same result, correct type). |
| VoiceCallScreen `useCallStore.getState()` | Called inside `useEffect` before Zustand subscription is set up — safe because it's a synchronous read of current state, not a subscription. |
| `react-native-razorpay` not installed | Dynamic `require('react-native-razorpay')` stub returns `pay_DEV_STUB` in Expo Go. Install with `npm install react-native-razorpay --legacy-peer-deps -w mobile` before native build. Set `EXPO_PUBLIC_RAZORPAY_KEY_ID` in mobile `.env`. |
| `AuthUser` has no `incognitoMode` or `name` | `incognitoMode` lives on Profile. Default false in SettingsScreen. Use `user.email` for Razorpay prefill — no `name` on AuthUser. |
| `expo-document-picker` in VerificationScreen | Dynamic require stub returns `file://DEV_STUB` in Expo Go. Real uploads need native build. |
| `deleteAccount` auth API | `DELETE /api/v1/auth/delete-account` — added to `mobile/src/api/auth.ts`. |
| `tsc --noEmit` correct invocation | Must pass `-p mobile/tsconfig.json` — root tsconfig does not cover mobile. |
| `expo-local-authentication` on simulator | `hasHardwareAsync()` returns false on iOS Simulator — always do capability check before calling authenticate. Auto-prompt skips silently if not available. |
| Biometric after login = refresh token flow | Biometric success calls `refreshAccessToken()` (not login again) — stored refresh token must still be valid. If expired, show "session expired" and fall back to email/password. |
| `Match.MatchedProfile` not `match.profile` | Association field is `MatchedProfile` (PascalCase, Sequelize convention). `profile` does not exist on Match type. |
| `CACHE_KEYS.SHORTLIST_SYNC_TIME` type | Value is string literal via `as const` — satisfies `string` arg for `cache.getNumber/setNumber`. No cast needed. |
| Elder mode Chat tab hidden | In elder mode, `Chat` tab is removed from BottomTabs. Users reach chat via match cards or mutual match "Chat" button. If a screen does `navigation.navigate('MainTabs', { screen: 'Chat' })` while in elder mode, it will throw — guard with `!elderMode` before navigating to Chat tab. |
| `AccessibilityInfo.addEventListener` return | Returns subscription object in RN 0.65+. Call `.remove()` in cleanup, not `AccessibilityInfo.removeEventListener()` (deprecated). |
| `ProfileSummary.name` doesn't exist | No `name` field. Use `[p.firstName, p.lastName].filter(Boolean).join(' ')`. Applies in all bureau/admin screens. |
| `VerificationTier` is an interface, not a union | Cannot use as `Record<VerificationTier, ...>`. Use `DocumentType` ('aadhaar' | 'pan' | 'passport' | 'driving_license') for doc-type maps instead. |
| Admin verification route | `PUT /admin/verifications/:id` with `{ status: 'approved'|'rejected', adminNotes? }` — NOT `POST /admin/verification/:id/approve`. |
| Admin stats route | `GET /admin/analytics` — NOT `/admin/stats`. |
| Admin reports update | `PUT /admin/reports/:reportId` with `{ status: 'reviewed'|'dismissed', adminNotes? }`. |
| `colours.text` / `colours.surface` | Don't exist. Use `colours.textPrimary` and `colours.surfaceCard`. |
| `RouteProp` import | Always from `@react-navigation/native` — `@react-navigation/native-stack` exports `NativeStackNavigationProp` only. |
| `borderRadius['2xl']` | Doesn't exist. `borderRadius` has only: sm/md/lg/xl/full. Use literal `20` for sheet corners. |
| `quizAnswers` on Profile model | Added as JSONB to Profile.js but no migration file written — run `ALTER TABLE "Profiles" ADD COLUMN "quizAnswers" JSONB` manually or write migration before deploying. |
| smsService cache API | Uses `get/set/del` from `cache.js` (not raw Redis). `set(key, value, ttlSeconds)` — third arg is TTL in seconds, not Redis `EX` syntax. |
| Real OTP activation | Set `SMS_PROVIDER=fast2sms` and `SMS_API_KEY=<your-key>` in `.env`. Dev fallback logs OTP to console when `SMS_PROVIDER=dev` (default). |
| `expo-av` in VoiceIntroRecorder | Dynamic require — no-op in Expo Go. Needs native build. Same pattern as FCM/Agora. |
| `useTheme()` hook | Returns `{ isDark, c }` where `c` is the active colour palette. Individual screens still use hardcoded `colours` import — migrate incrementally. Infra is live; screens don't break without migration. |
| `darkModeOverride` in uiStore | `null` = follow system, `true` = force dark, `false` = force light. Persisted as `'true'`/`'false'` string in MMKV (not boolean) so it can be cleared with `cache.delete`. |
| Cloudinary voice-intro `resource_type` | Must be `'video'` (not `'raw'`) — Cloudinary uses `video` type for audio files. |
| `expo-camera` in SelfieVerificationScreen | Dynamic require — no-op in Expo Go. Returns `file://DEV_STUB_SELFIE.mp4` after 3s stub. Needs native build. |
| Family group socket room | ✅ Implemented in Session 16 — socketHandler handles `join-group`, `leave-group`, `group-send-message` → broadcasts `group-message-received`. |
| Guardian API routes | ✅ Implemented in Session 16 — `/api/v1/guardian/*` routes live. Uses in-memory store (resets on restart) — add DB migration before prod. |
| AdminStack/BureauStack conditional registration | Screens only registered when role matches. Deep links to AdminStack while role=user = silent navigation failure. |
| `queryKeys.myProfile` | Added to queryKeys.ts (`['profile','me']`) — used by SelfieVerificationScreen onSuccess invalidation. Matches key used in OwnProfileScreen's `getMyProfile` query. |
| Guardian links DB-backed | ✅ Session 17 — GuardianLinks table live (migration 000029). Run `npm run migrate` before prod deploy. |
| Astrologer routes real impl | ✅ Session 17 — Razorpay + Agora wired. Migrations 000030/000031. Seed auto-inserts on first request. |
| Background check | ✅ Session 19 — real AuthBridge/Signzy integration live. Migration 000033 (bgCheckProviderRef). Webhook at `/verification/bg-check/webhook`. Set `BG_CHECK_PROVIDER`, `BG_CHECK_API_KEY`, `BG_CHECK_WEBHOOK_SECRET` in prod env. |
| `getAshtakootScore` returns null | Returns `null` when both nakshatras unknown. `HoroscopeMatchScreen` falls back to rashi score, then empty state — always guard for null. |
| Nakshatra aliases | `resolveNakshatra()` in compatibility.js handles 50+ alternate spellings. If user enters an unknown variant, returns null (graceful degradation). |
| `AstrologerMarketplaceScreen` stub fallback | `useQuery` `select` merges API data with `STUB_ASTROLOGERS` — if backend returns empty array it shows stubs. Remove stub merge when real DB populated. |
| HoroscopeMatch nav params | Takes `{ userId, name }`. `name` = full display name (not userId). Used in screen header subtitle. |
| BGC webhook auth bypass | `/verification/bg-check/webhook` skips `auth` middleware (provider can't send JWT). Secured via HMAC-SHA256 on `BG_CHECK_WEBHOOK_SECRET`. Without that secret set, sig check is skipped in dev only. |
| BGC webhook raw body | server.js adds `/api/v1/verification/bg-check/webhook` to rawBodyCapture — must stay there or `req.rawBody` will be undefined and sig verify will fail. |
| BGC providerRef lookup | Webhook looks up Verification by `bgCheckProviderRef` (not userId). Migration 000033 adds partial index on that column for fast lookup. Run `npm run migrate` from backend/. |
| BGC setImmediate pattern | `verify-payment` responds 200 immediately then submits to provider via `setImmediate`. If provider submit fails, `bgCheckProviderRef` stays null — admin can identify these by querying `bgCheckStatus='in_progress' AND bgCheckProviderRef IS NULL`. |

---

### SDK 51 Build Baseline (Session 22)

**Status: Clean reproducible build — 0 node_modules patches, 0 TS errors, `iOS Bundled 968ms` ✅**

**Stack:** Expo SDK 51 · React 18.2.0 · RN 0.74.5 · react-navigation v6 · react-native-screens 3.31.1 · MMKV v2 · Old arch

| Gotcha | Notes |
|--------|-------|
| `@react-navigation/*` must be **v6**, not v7 | v7 requires `react-native-screens >= 4.0` which needs RN codegen from 0.75+. SDK 51 pins screens to 3.31.1. Symptom if wrong: `right operand of 'in' is not an object` in NativeStackView. |
| `react-native-screens: 3.31.1` | Pinned by SDK 51. Do NOT upgrade to 4.x until SDK 52+. |
| `react-native-mmkv: ^2.12.2` | Uses `new MMKV({ id })` API. v4 (used before) requires new arch/Nitro — incompatible with old arch on SDK 51. |
| Root `app.json` must not exist | Expo prebuild reads it when running from monorepo root — shadows `mobile/app.json`. Keep only `mobile/app.json`. |
| All expo commands from `mobile/` | `cd mobile` first. Root dir has no expo config. |
| `app.json` must be strict JSON | No trailing commas. Expo parses it as JSON, not JSONC. |
| Firebase files optional | `ios.googleServicesFile` / `android.googleServicesFile` removed from app.json — add back only when real Firebase config exists. |
| placeholder assets in `mobile/assets/` | `icon.png`, `splash.png`, `adaptive-icon.png`, `favicon.png` — 1×1 placeholders. Replace with real assets before App Store submission. |
| i18next needs `compatibilityJSON: 'v3'` | Hermes may not have `Intl.PluralRules`. Set in `src/i18n/index.ts` init options. |
| metro.config.js is now clean | Vanilla `expo/metro-config` + monorepo watchFolders + `@shared` alias. No node stubs, no MOBILE_ONLY, no browser maps. |
| tsc from correct binary | `/Users/sakshampanjla/Desktop/REACT/tricitymatch/node_modules/.bin/tsc --noEmit -p tsconfig.json` (run from `mobile/`) |
| `tsconfig.json` has `noImplicitAny: false` | Suppresses 50+ callback param errors (pre-existing, not new). Remove and clean up when time permits. |
| Agora/Razorpay/Firebase = dynamic require | Not installed as deps. Dynamically required + stubbed. Install as native config plugins when enabling for prod. |

### Session Roadmap

| Session | Epic | What Gets Built |
|---------|------|----------------|
| ✅ 1 | EPIC 1 | Scaffold |
| ✅ 2 | EPIC 2 | Auth screens |
| ✅ 3 | EPIC 3a | Onboarding Steps 0–7 (required steps) |
| ✅ 4 | EPIC 3b | Onboarding Steps 8–14 (lifestyle, family, about, preferences, photos, OTP, completion) |
| ✅ 5 | EPIC 4+5 | Home, Own Profile, Other Profile, Edit Profile |
| ✅ 6 | EPIC 6 | Search, FilterPanel, results, ProfileCard, MatchesScreen |
| ✅ 7 | EPIC 7+8 | Socket.io hook, ConversationsScreen, ChatThreadScreen |
| ✅ 8 | Backend+EPIC 9+10 | FCM push (useNotificationHandler, logout deregister), Agora backend (agoraToken.js, call_sessions migration, callController+routes), NotificationsScreen (full) |
| ✅ 9 | EPIC 9+10 | VoiceCallScreen (Agora dynamic require, mute/speaker/end, 30s timeout, timer), VideoCallScreen (remote feed, draggable PiP, camera toggle/flip, auto-hide controls 3s), IncomingCallModal (pulse, 30s countdown, accept/decline), wired into RootNavigator |
| ✅ 10 | EPIC 11+12 | SubscriptionScreen (plan cards, Razorpay dynamic-require stub, verify-payment, history tab), SettingsScreen (grouped sections, incognito toggle, elder mode, language picker modal, delete account modal), VerificationScreen (4 tiers, expo-document-picker dynamic require, status badges, resubmit flow), BlockReportSheet (6 categories, description input, block confirm, wired into ProfileDetailScreen ⋮ menu), verification.ts + block.ts API files, deleteAccount added to auth.ts, 0 TS errors |
| ✅ 11 | EPIC 13+14 | BiometricLogin (LoginScreen full flow: capability check, 3-attempt lockout, setup-prompt modal post-login, settings toggle), useOfflineShortlist hook (MMKV, netinfo, fast-image prewarm, 200-limit, lastSyncedLabel, isStale), OfflineBanner component wired into MatchesScreen shortlisted tab, ElderMode wiring (4-tab nav hiding Chat, 60dp tap targets, +4sp font scale via elderTheme util, animation disable via AccessibilityInfo + elderMode flag), 0 TS errors |
| ✅ 12 | EPIC 15+16 | AdminHomeScreen (stats + queue entry), VerificationQueueScreen (approve/reject modal + DocumentType map), ReportsQueueScreen (dismiss/suspend + notes modal), BureauHomeScreen (overview + recent proposals), ClientRosterScreen (search + propose), MatchProposalScreen (3-step wizard), EarningsScreen (summary + tx list), SupportScreen (WhatsApp deep link + FAQ accordion), SuccessStoryScreen (form + success state), 0 TS errors |
| ✅ 13 | Phase 2 | Real OTP backend (Fast2SMS/MSG91), "Why This Match" breakdown sheet, profile completeness milestone badges, compatibility quiz (10 questions), weekly digest push (APP-047), saved search alerts cron (APP-048) |
| ✅ 14 | Phase 2 cont. | PWA icons confirmed ✅, APP-050 voice note intros (backend + VoiceIntroRecorder), migration 000028 (quizAnswers+voiceIntroUrl), APP-058 dark mode (darkColours, useTheme hook, uiStore override, RootNavigator theme) |
| ✅ 15 | Phase 2 cont. | APP-052 selfie liveness stub, APP-053 family group chat, APP-054 guardian co-pilot, admin/bureau role gating |
| ✅ 16 | Phase 3 | APP-055 full Vedic Ashtakoot Guna Milan (27-nakshatra, all 8 gunas, dosha detection), HoroscopeMatchScreen mobile, APP-059 astrologer marketplace stub (2 screens + backend routes), guardian backend routes (/guardian/*), family group socket room, horoscope-match backend endpoint, 0 TS errors |
| ✅ 17 | Prod hardening | Guardian DB migration (guardian_links table, DB-backed guardianRoutes), Astrologer real impl (Razorpay + Agora, 2 models + 2 migrations), APP-060 background check (migration + backend endpoints + BackgroundCheckScreen + VerificationScreen CTA), E2E test suite (09-sessions-13-16 20 smoke tests), Docker prod hardening (nginx ssl/conf.d, .env.production.example updated), 0 TS errors |
| ⏭️ 18 | APP-057 | **SKIPPED** — WhatsApp onboarding deferred (P3, needs provider decision) |
| ✅ 19 | APP-060 | Real BGC integration: bgCheckService.js (AuthBridge+Signzy adapters), env.js bgCheck config, webhook endpoint + HMAC sig verify, Verification model bgCheckProviderRef + migration 000033, BackgroundCheckScreen foreground polling + 15s in-progress poll |
| ✅ **20** | Launch prep | Bundle IDs fixed (com.tricityshadi.app iOS+Android), eas.json submit config, k6 load test script (scripts/load-test.js), pre-launch checklist (scripts/prelaunch-check.sh), FCM push smoke test endpoint (POST /admin/push-smoke-test) |
| ✅ **22** | Build fix | Expo SDK 51 upgrade: React 18, RN 0.74, react-navigation v6, MMKV v2, clean metro config, 0 node_modules patches, 0 TS errors, iOS builds + bundles cleanly |

---

## gstack Skills (REQUIRED — use for ALL applicable work)

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Install:
```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

**MANDATORY: Always use the matching skill — never do manually what a skill does.**

### Skill Usage Map

| Skill | When to use |
|-------|-------------|
| `/browse` | **ALL web browsing** — Expo docs, RN docs, any URL lookup. Never use WebFetch/WebSearch instead. |
| `/qa` | After any feature build — run automated QA on web frontend, find + fix bugs before marking session done |
| `/design-review` | After any UI screen build — catches spacing/hierarchy/visual issues Claude misses |
| `/review` | Before committing — code review for correctness, security, simplification |
| `/investigate` | Debugging unknown bugs — systematic root cause analysis |
| `/ship` | When ready to deploy — runs full pre-deploy checklist |
| `/run` | Start/verify app is running correctly after changes |
| `/verify` | Confirm a specific fix/feature actually works in the live app |
| `/code-review` | Review current diff for bugs + cleanup (use `ultra` for deep cloud review) |
| `/simplify` | After implementation — find reuse/simplification opportunities |
| `/ui-ux-pro-max` | Any UI design work — component design, style choices, layout decisions |
| `/spec` | Before starting complex feature — generate spec/plan first |
| `/security-review` | Before any auth, payment, or data-access code ships |

### When skills fire in mobile sessions

| Trigger | Skill |
|---------|-------|
| Each screen batch complete | `/design-review` — visual QA |
| End of every session | `/qa` — catch regressions |
| Any Expo/RN API question | `/browse` — check versioned docs |
| Before session commit | `/review` — correctness pass |
| Auth/payment code | `/security-review` — mandatory |
| Bug with unclear cause | `/investigate` — don't guess |
