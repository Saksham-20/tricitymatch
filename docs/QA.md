# QA Playbook — TricityShadi (Universal, reusable)

> Single QA reference for the whole product: **web** (desktop/tablet/mobile), **admin panel**, and **React Native apps** (iOS + Android on macOS simulators). Replaces the old scattered root QA files (`browser-qa-*.md`, `qa-progress.md`, `mobile-qa-progress.md`, `bug-tracker.md`, `production-bugs.md`, `launch-readiness.md`, `release-*.md`, `user-flows.md`) — their detailed run history lives in git history + the CLAUDE.md "Audit History" log. The audit-phase tracker `review-progress.md` is separate and stays.

---

## 0. Core method (applies to every pass)
**TEST → FAIL → root-cause → FIX → RETEST → VERIFY.** Fix-on-discovery, **one area at a time, never bulk.**
- Every finding needs **evidence**: URL/screen + viewport + screenshot and/or console line + `file:line` root cause.
- Live app is the source of truth, not the source code.
- After any fix: re-run the screen, confirm fixed, check console clean, then move on.
- Per area: update the run tracker, screenshot before/after.
- **Regression gate before sign-off:** FE tests `31/31` green · BE unit `116/116` green · `npm run build` green · console 0 non-benign errors.

**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low/Cosmetic
**Status:** OPEN · FIXING · FIXED-VERIFIED · DEFERRED · WONTFIX
**Bug IDs:** `BUG-00x` (dev/general) · `P00x` (production) · `UX-00x` (visual/render). Distinct schemes, don't collide.

---

## 1. Environments & credentials
| Env | Web | API | Notes |
|-----|-----|-----|-------|
| Dev (local) | http://localhost:3000 | :5001 (`/api`) | `npm run dev`; Postgres :5432, Redis :6379(opt) |
| Prod | https://tricityshadi.com | same origin `/api` | VPS `178.16.138.82`, containers `tricitymatch-*` (FE 3002→80, BE 5002→5000) |

**Credentials / fixtures**
- Admin: `admin@tricitymatch.com` / `Pass@1234` (seeded; → `/admin/dashboard`).
- Fresh user: signup via API `POST /api/v1/auth/signup` (email/password/phoneNumber/firstName/lastName/gender/dateOfBirth) or onboarding UI; seeded password `Pass@1234`.
- Premium-gated screens need a user with `planType` ∈ `basic_premium`/`premium_plus`/`vip`.
- OTP bypass (dev + ALLOW_INSECURE_PROD): `000000` / `123456`.
- Mark test data `qa.*@tricityshadi.com`; delete after.

**Config-gated (skip, note — not failures):** Razorpay (placeholder), Email/SMTP, Google OAuth, SMS OTP delivery, FCM push, Agora calls (`VITE_AGORA_APP_ID` / `EXPO_PUBLIC_*`).

> **Shared VPS rule:** co-tenants on the box. Scope every prod command to `tricityshadi.com` / `tricitymatch-*`. Never global `docker`/`compose down`/`prune`. `nginx -t` before any reload. Deploy = pull → `docker compose build frontend` (or backend) → `up -d --no-deps --force-recreate <service>`.

---

## 2. Universal per-screen checklist
Render/layout:
- Loads, HTTP 200, no blank/white screen, app root mounts; console 0 errors / 0 unhandled rejections.
- Network: no 4xx/5xx except expected (401 auth-probe while logged out).
- No horizontal overflow; no overlap/cut-off text; grids collapse to 1 col at narrow width.
- Tap targets ≥44px; bottom content not hidden behind sticky/bottom nav.
- Images/assets load (no broken `<img>`, no 404 asset).
- States: loading / empty / error / success all render where reachable.
- Keyboard: tab order + visible focus on forms; Esc closes modals/sheets.

Workflow:
- Screen's primary action actually works (submit, nav, validation, CRUD).
- Forms validate (required, format, cross-field); inline error states show, no silent failure.

**Professionalism / anti-slop (brand: serious matrimonial, burgundy `#8B2346` / gold `#C9A227` / cream):**
- **No emoji in UI copy.** No `✓`/`!`/`✦` unicode-as-icon → use `react-icons`/`lucide` (`FiCheck`, `FiAlertCircle`, …).
- **No childish multi-color info boxes** (`bg-blue/green/cyan/yellow/orange/indigo/pink/purple-50`) → one muted standard `bg-neutral-50 border-neutral-200 text-neutral-600`.
- **No rainbow gradients** (`from-rose-*`/`pink`/`purple`/`amber→yellow`) → solid brand. Premium = gold, accent = burgundy. Semantic colors OK (red=danger, green=success, traffic-light progress).
- Brand name is **"TricityShadi"** (never "TricityMatch") in all copy.
- Copy is formal — no clichéd/childish lines ("Make yourself shine", "perfect match").

---

## 3. Web QA (browser)
**Tool:** Playwright MCP (or gstack browse). **Viewports:** Mobile `375×812`, Tablet `768×1024`, Desktop `1440×900`.

**Route inventory** (full list in CLAUDE.md):
- Public: `/ /login /signup /onboarding /forgot-password /reset-password /terms /privacy /about /contact /safety /success-stories`
- Protected: `/dashboard /profile /profile/edit /profile/:id /search /chat /subscription /settings /notifications /verification /guardian /astrologers* /payment/*`
- Admin (`/admin/*`): dashboard, users(+create,:id), verifications, subscriptions, revenue, reports, marketing-users(+:id), referral-codes, leads, success-stories
- Marketing (`/marketing/*`): dashboard, leads, referral-codes

**Suggested area order (one at a time):** Global chrome (Navbar/BottomNav/drawers) → Public marketing → Auth → Onboarding (14 steps) → Dashboard → Search (+ProfileCard/FilterPanel) → Chat → Profile (view/detail/editor) → Subscription → Account (Settings/Notifications/Verification) → Admin.

**Admin panel notes:** desktop tool — audit at 1440 primarily (spot-check mobile). Verify dark sidebar nav, tables (search/filter/status dropdowns), tab queues (verifications/reports), CRUD modals (success-stories), charts render. Keep semantic status chips (`bg-blue-100`/etc.); brand-accent must be burgundy, not rose/blue.

**Security spot-checks (API):** unauth protected → 401 · non-admin → admin endpoint → 403 · rate limiter → 429 · webhook no-Origin → reaches HMAC (401 sig, not 403 CORS) · httpOnly cookies · no stack/token leak in prod.

---

## 4. React Native apps QA — iOS + Android simulators (macOS)
App: `mobile/` — Expo SDK **51**, React **18.2**, RN **0.74.5**, react-navigation **v6**, MMKV **v2**, old arch, Zustand + React Query, i18n en/hi/pa. Native dirs (`ios/`, `android/`) are committed → prebuilt dev clients. Bundle id `com.tricityshadi.app` (both).

### 4.1 Prerequisites (one-time on the MacBook)
- **Xcode** (App Store) + Command Line Tools (`xcode-select --install`) → iOS Simulator. Open one sim once: `open -a Simulator`.
- **Android Studio** → SDK + an **AVD** (e.g. Pixel 7, API 34). Ensure `ANDROID_HOME`/`adb` on PATH; start the emulator from Android Studio Device Manager or `emulator -avd <name>`.
- **Watchman** (`brew install watchman`) recommended.
- `cd mobile && npm install` (uses repo `node_modules`).
- Point the app at a reachable API: set `EXPO_PUBLIC_API_URL` (+ `EXPO_PUBLIC_*` feature keys). Simulators reach host `localhost`; a physical device needs the Mac's LAN IP.

### 4.2 Build & run (from `mobile/` only)
```bash
# JS/UI-only QA (fast) — native modules are STUBBED in Expo Go:
npx expo start --clear            # press i = iOS sim, a = Android emulator

# Full dev build (needed for native modules — Agora calls, Razorpay, Firebase
# messaging, expo-camera/av/document-picker/local-authentication):
npm run ios        # = expo run:ios       → builds + launches iOS simulator
npm run android    # = expo run:android   → builds + launches Android emulator

# Type safety (repo tsc is v4 in PATH — use the local v5):
node_modules/.bin/tsc --noEmit -p tsconfig.json
```
**Expo Go vs dev build:** use Expo Go for screen/layout/nav/state QA (native modules render their stub). Use `expo run:*` dev builds to exercise calls/payments/push/camera/biometrics. Test **both iOS and Android** every area (layout + native behavior differ).

### 4.3 Feature-area matrix (test each on iOS **and** Android)
`mobile/src/features/`:
- **auth** — Splash, Welcome, Login (biometric + 429 lockout), Signup (strength bar), Forgot/Reset, OTP (6-box)
- **onboarding** — 14 steps mirror web; OnboardingContext resume, progress bar
- **home** — feed, completeness strip, quick actions, new profiles
- **profile** — OwnProfile (gallery/ring/badges/preview/quiz CTA), ProfileDetail (sticky bar, accordions, compat sheet, horoscope, voice playback, ⋮ Block/Report), EditProfile, Selfie/BG verification, Verification (4 tiers)
- **search** — Search (infinite/sort/saved), FilterPanel (@gorhom sheet, ranges, gotra exclude, manglik, save), ProfileCard
- **matches** — 4 tabs (Mutual/Shortlisted/LikedMe/MyInterests), offline shortlist (MMKV)
- **chat** — Conversations (Plus+ gate), ChatThread (inverted, receipts, typing, optimistic, edit/del), FamilyGroups + group chat
- **calls** — Voice, Video (PiP), IncomingCall (30s) — **dev build + Agora creds**
- **subscription** — plans, Razorpay stub, history; AstrologerMarketplace, AstrologerDetail
- **notifications** — list (infinite, mark-read, deep-link), Settings (incognito, elder mode, language, dark mode, delete account)
- **admin** (role-gated) — AdminHome, VerificationQueue, ReportsQueue
- **bureau** (role-gated) — Home, ClientRoster, MatchProposal, Earnings, Support, SuccessStory
- **guardian** — Setup, View (RO), Candidates
- **horoscope** — HoroscopeMatch (guna/dosha/manglik), CompatibilityBreakdownSheet, Quiz (10q)

### 4.4 RN per-screen checklist (in addition to §2)
- **Safe areas:** content clears the notch/Dynamic Island (top) and the home indicator + bottom tab bar (bottom) on both platforms.
- **Both platforms:** verify on iOS sim **and** Android emulator — fonts, shadows (iOS shadow vs Android elevation), back gesture/hardware back (Android), keyboard avoidance.
- **Navigation:** stack push/pop, tab switches, role-gated stacks (admin/bureau), modal-outside-stack (IncomingCall). `nav.navigate('MainTabs',{screen:'X'})` from a stack. Elder mode hides the Chat tab.
- **Theme:** light + **dark mode** (uiStore `darkModeOverride`), **elder mode** (larger type). Use tokens `textPrimary`/`surfaceCard` (not `.text`/`.surface`).
- **Anti-slop §2** applies equally — no emoji-in-copy, no childish boxes/gradients, brand burgundy/gold, "TricityShadi".
- **Native module gracefulness:** in Expo Go, Agora/Razorpay/Firebase/camera show stubs without crashing.
- **Lists/perf:** inverted chat list, infinite scroll, optimistic sends, offline (MMKV) shortlist.

### 4.5 RN gotchas (from CLAUDE.md)
- `RouteProp` from `@react-navigation/native` (not native-stack).
- MMKV v2: `new MMKV({id})`; typed `.setString/.getString`.
- ProfileSummary has no `age`/`name` → derive age from `dateOfBirth`; name `[firstName,lastName].filter(Boolean).join(' ')`. Use `Match.MatchedProfile`.
- No `colours.text`/`.surface` → `textPrimary`/`surfaceCard`; no `borderRadius['2xl']` → literal 20.
- Admin routes: PUT `/admin/verifications/:id`, GET `/admin/analytics`, PUT `/admin/reports/:id`; FCM `/notifications/fcm-token`.
- Razorpay: `EXPO_PUBLIC_RAZORPAY_KEY_ID`; AuthUser has no `name` → prefill `user.email`.

---

## 5. Readiness gates (sign-off)
| Gate | Pass condition |
|------|----------------|
| No Critical / High bugs open | none |
| Security | headers, 401/403/429, IDOR, httpOnly, webhook HMAC, no stack/token leak in prod |
| User flows | signup→login→search→match→chat→logout + admin all pass |
| Console / network | 0 non-benign errors; only expected logged-out 401 probe |
| No dead UI | 0 TODO/dead-button/placeholder/lorem |
| Professionalism | §2 anti-slop clean across audited screens |
| Regression | FE 31/31 · BE 116/116 · build green |
| RN | iOS sim + Android emulator both pass per-area; `tsc --noEmit` clean |

**Pre-launch (config, not code) — revert/supply before real users:**
- Remove `ALLOW_INSECURE_PROD` + `OTP_BYPASS_CODES` from prod `.env`.
- Real keys: Razorpay · Email/SMTP · Google OAuth · SMS · FCM (+native build) · `VITE_AGORA_APP_ID`/Agora server.
- Cookies `Secure=true` over HTTPS · `npm run migrate` current · strong `.env.production` secrets.

---

## 6. History
Detailed prior-pass records (bug root-causes P001–P005, BUG-001/003, UX-001/003, web mobile-view + admin professionalism pass, prod launch validation) are preserved in **git history** and condensed in **CLAUDE.md → Audit History**. Audit-phase tracking stays in `review-progress.md`.
