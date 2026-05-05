# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**TricityShadi** — hyperlocal matrimonial platform for Chandigarh / Mohali / Panchkula. Full-stack monorepo: React 18 SPA + Express.js REST API + PostgreSQL + Redis + Socket.io real-time. Deployed via Docker Compose behind Nginx.

---

## Commands

From repo root (npm workspaces):

```bash
# Dev (both services concurrently)
npm run dev

# Individual services
npm run dev:backend       # nodemon on port 5001
npm run dev:frontend      # Vite on port 3000

# Tests
npm run test              # Jest (backend) + Vitest (frontend)
npm run test:backend
npm run test:frontend

# Single test file
cd backend && npx jest tests/unit/authController.test.js
cd frontend && npx vitest run src/tests/SomeComponent.test.jsx

# Lint
npm run lint
npm run lint:fix

# DB (run from backend/)
cd backend && npm run migrate              # run pending migrations
cd backend && npm run migrate:undo         # undo last migration
cd backend && npm run db:reset             # drop + create + migrate + seed
cd backend && npm run db:create
cd backend && npm run db:drop

# Admin seeder (run after migrations)
cd backend && node seeders/adminSeeder.js

# E2E (Playwright)
npm run qa                  # all suites
npm run qa:auth             # 01-auth-flow
npm run qa:visual           # 03-visual-ui
npm run qa:headed           # with browser UI
npm run qa:full             # tests + generate HTML report
npm run qa:ui               # open HTML report

# Frontend build
npm run build
```

Backend on port **5001** (`PORT` env). Frontend dev server on **3000** (Vite proxies `/api` and `/socket.io` to 5001).

---

## Architecture

### Monorepo Structure

```
/
├── backend/          Express.js API (CommonJS)
├── frontend/         React + Vite (ESM, JSX + some TSX)
├── e2e/              Playwright test suites (8 spec files)
├── nginx/            Reverse proxy config
├── monitoring/       Prometheus / Grafana config + alert rules
├── scripts/          Utility scripts (image optimization etc.)
├── docs/             API docs
├── docker-compose.yml
└── package.json      npm workspaces root
```

---

## Backend (`backend/`)

### Entry Point

`server.js` → Express setup, Socket.io, middleware stack, routes, startup sequence.

### Key Directories

| Dir | Purpose |
|-----|---------|
| `config/env.js` | **Single source of truth** for all env vars. Never read `process.env` directly elsewhere. |
| `config/database.js` | Sequelize instance (PostgreSQL, pool, optional SSL). |
| `routes/index.js` | Mounts all route files under `/api/v1` and `/api` (legacy). |
| `controllers/` | Auth, Profile, Match, Chat, Admin, Subscription, Verification, Search, Notification, BlockReport |
| `models/` | User, Profile, Match, Message, Subscription, Verification, Notification, Block, Report, ContactUnlock, MarketingLead, ReferralCode, RefreshToken, ProfileView |
| `middlewares/security.js` | Helmet, CORS, rate limiters (9 types), account lockout (Redis-backed), request sanitization, requestId, extractIp |
| `middlewares/auth.js` | JWT cookie auth, adminAuth, marketingAuth, requirePremium, requireVIP, checkContactUnlockLimit, verifyTargetUser, socketAuth |
| `middlewares/errorHandler.js` | AppError class, createError factory, asyncHandler wrapper, handleValidationErrors, Sequelize/JWT/Multer error translators |
| `middlewares/logger.js` | Structured JSON logger (log.error/warn/info/debug/security/audit/performance), devLogger |
| `middlewares/upload.js` | Multer + CloudinaryStorage, magic-byte + extension validation, deleteFromCloudinary |
| `socket/socketHandler.js` | Socket.io events: join-room, send-message, typing, message-edited, message-deleted, get-online-status. Per-socket rate limits. |
| `utils/cache.js` | Redis (ioredis) with in-memory fallback. Used for account lockout, session state. |
| `utils/queue.js` | Bull job queues (email, cleanup, push-stub). Weekly digest cron scheduled on startup. |
| `utils/metrics.js` | Prometheus metrics middleware + gauge helpers |
| `utils/notifyUser.js` | `notify(userId, type, title, body, relatedId)` → DB Notification + Socket.io emit to `user_${userId}` |
| `utils/razorpay.js` | Lazy-init Razorpay instance, plan config (PLANS object), `createOrder`, `verifyPayment`, `getPlanDetails` |
| `utils/email.js` | Primary email util — nodemailer pooled transporter, HTML templates, `sendWelcomeEmail`, `sendPasswordResetEmail`, `sendMatchNotification`, `sendSubscriptionConfirmation`, `sendVerificationApproved`, `sendVerificationRejected`, `sendWeeklyDigest` |
| `utils/emailService.js` | Legacy email util (used by chatController). Only exports `sendMatchNotification`, `sendMessageNotification`, `sendSubscriptionReminder`. |
| `utils/invoice.js` | PDFKit invoice generation |
| `utils/healthCheck.js` | `livenessCheck`, `readinessCheck`, `fullHealthCheck` (DB + Redis + memory) |
| `utils/alerts.js` | Alert tracking with Redis dedup |
| `utils/performance.js` | Request profiler middleware |
| `utils/socket.js` | `getIO()` / `setIO()` singleton for accessing io outside socket handler |
| `utils/compatibility.js` | Compatibility score calculation between two Profile objects |
| `validators/index.js` | All express-validator schemas: auth, profile, match, chat, search (incl. religion/caste/income/motherTongue), subscription, admin, verification |

### Auth Model

- **httpOnly cookies** — `accessToken` (15m JWT) + `refreshToken` (7d, stored hashed in `RefreshToken` DB table)
- Token rotation: each refresh issues new token, revokes old. Family-based revocation on reuse detection.
- Account lockout: Redis-backed, `MAX_LOGIN_ATTEMPTS` (default 5) per email, `LOCKOUT_DURATION_MINUTES` (default 30)
- Google OAuth: `POST /api/v1/auth/google` — verifies Google ID token via `google-auth-library`, creates/links account
- `RefreshToken.toJSON()` strips `token` and `tokenHash` — never serialized to API responses

### Rate Limiters (security.js)

| Limiter | Window | Max | Applied to |
|---------|--------|-----|-----------|
| `apiLimiter` | 15 min | 200 | All `/api` routes |
| `authLimiter` | 15 min | 5 | Login, refresh, OTP, Google OAuth |
| `signupLimiter` | 1 hr | 3 | Signup |
| `passwordResetLimiter` | 1 hr | 3 | Forgot/reset password |
| `searchLimiter` | 1 min | 30 | Search |
| `messageLimiter` | 1 min | 60 | Chat send |
| `profileUpdateLimiter` | 1 min | 10 | Profile PUT |
| `matchActionLimiter` | 1 min | 60 | Match actions |
| `uploadLimiter` | 1 hr | 20 | File uploads |
| `adminLimiter` | 1 min | 100 | Admin routes |
| `paymentLimiter` | 1 hr | 10 | Payment create/verify |

### API Routes

All routes under `/api/v1` (also `/api` for backward compat):

| Prefix | Router file | Auth |
|--------|------------|------|
| `/auth` | authRoutes.js | public + protected |
| `/profile` | profileRoutes.js | auth required |
| `/search` | searchRoutes.js | auth required |
| `/match` | matchRoutes.js | auth required |
| `/chat` | chatRoutes.js | auth + requirePremium |
| `/subscription` | subscriptionRoutes.js | public (plans, webhook) + auth |
| `/admin` | adminRoutes.js | auth + adminAuth + adminLimiter |
| `/verification` | verificationRoutes.js | auth required |
| `/block` | blockReportRoutes.js | auth required |
| `/report` | blockReportRoutes.js | auth required |
| `/notifications` | notificationRoutes.js | auth required |
| `/api/marketing` | marketingRoutes.js | auth + marketingAuth |
| `/monitoring` | routes/monitoring.js | public (liveness) + admin-gated |

Monitoring/health endpoints: `/health` (liveness), `/ready` (DB check), `/monitoring/health`, `/monitoring/metrics` (Prometheus).

### Subscription Plans (razorpay.js)

| Plan | Price | Duration | Contact Unlocks |
|------|-------|----------|----------------|
| `free` | ₹0 | — | 0 |
| `basic_premium` | ₹1,500 | 15 days | 5 |
| `premium_plus` | ₹3,000 | 30 days | 10 |
| `vip` | ₹7,499 | 90 days | unlimited (null) |

VIP plan auto-sets `isBoosted=true` + `boostExpiresAt` on user at activation (via payment verify, webhook, and admin override).

### DB Migrations (22 files)

```
000001 create-users
000002 create-profiles
000003 create-subscriptions
000004 create-matches
000005 create-messages
000006 create-verifications
000007 create-profile-views
000008 add-enhanced-profile-fields
000009 add-delivered-at-to-messages
000010 add-edit-fields-to-messages
000011 create-refresh-tokens
000012 add-performance-indexes
000013 add-matrimony-horoscope-fields
000014 add-privacy-settings
000015 create-notifications
000016 create-blocks
000017 create-reports
000018 create-contact-unlocks
000019 update-subscription-plans
000020 sync-users-with-user-model
000021 add-deleted-to-user-status
000022 add-google-oauth-to-users
```

### Background Jobs (queue.js)

Uses Bull (requires Redis). Falls back to in-memory queue if Redis unavailable.

- `email` queue: `send-email`, `send-welcome-email`, `send-password-reset`, `send-match-notification`, `send-subscription-confirmation`
- `notification` queue: `send-push-notification` (stub — FCM/APNs not implemented), `send-in-app-notification`
- `cleanup` queue: `cleanup-expired-tokens`, `cleanup-old-messages`, `cleanup-expired-subscriptions`
- **Weekly digest**: cron every Monday 10 AM → `send-weekly-digest` job → sends re-engagement email if ≥1 new match

### Key Flows

**Auth:** `POST /auth/login` → httpOnly `accessToken` + `refreshToken` cookies → frontend reads user from `/auth/me`.

**Onboarding:** New users → `/onboarding` → 14-step flow → profile built via `PUT /profile/me`.

**Matching:** `POST /match/:userId` with `{ action: 'like'|'shortlist'|'pass' }`. Mutual match detected, both records updated. In-app + email notifications sent async.

**Chat:** Requires premium + mutual match. REST API creates messages; Socket.io broadcasts. WhatsApp-style read receipts, edit (15 min limit), delete.

**Payment:** `POST /subscription/create-order` → Razorpay frontend checkout → `POST /subscription/verify-payment` (signature check) → subscription activated. Webhook at `/subscription/webhook` as async fallback (raw body captured at `/api/v1/subscription/webhook` AND `/api/subscription/webhook`).

**Photo Upload:** Multer → Cloudinary (magic-byte + extension validation). Local disk fallback when Cloudinary unconfigured. Profile photo: 500×500 face crop. Gallery: 1200×1200 limit. Max 6 gallery photos.

**Incognito / Photo Blur:** `incognitoMode=true` hides user from search. `photoBlurUntilMatch=true` returns null photos for non-mutual viewers.

**Boost:** Active boost (`isBoosted=true`, `boostExpiresAt` in future) adds +8 sort score in search results.

**Verification:** Submit docs → pending → admin approve/reject → `isVerified` badge on profile. `isVerified` included in search results.

**Notifications:** `notify(userId, type, title, body, relatedId)` → DB insert + Socket.io emit to `user_${userId}`.

**Admin Login:** Use standard `/login` (not `/admin/login` — that redirects). Role `admin` required.

---

## Frontend (`frontend/src/`)

### Entry & Providers

`main.jsx` → `App.jsx` → `AuthProvider` > `OnboardingProvider` > `SocketProvider`.

### Context

| Context | Hook | Purpose |
|---------|------|---------|
| `AuthContext.jsx` | `useAuth()` | Auth state, user object, setUser. localStorage hint `tricitymatch-auth-hint` skips `/auth/me` on non-protected routes. |
| `OnboardingContext.jsx` | `useOnboarding()` | 14-step onboarding state machine |
| `SocketContext.jsx` | `useSocket()` | Socket.io connection lifecycle |

### Path Aliases (vite.config.js)

| Alias | Resolves to |
|-------|-----------|
| `@` | `src/` |
| `@components` | `src/components/` |
| `@pages` | `src/pages/` |
| `@context` | `src/context/` |
| `@api` | `src/api/` |
| `@utils` | `src/utils/` |
| `@hooks` | `src/hooks/` |
| `@assets` | `src/assets/` |

### HTTP Client (`api/axios.js`)

Axios instance with `withCredentials: true` (httpOnly cookies). Automatic 401 → token refresh queue. FormData requests auto-delete `Content-Type` header (multer needs multipart boundary). Also: `api/apiClient.js` — re-export alias used by some admin pages.

### Pages

| Route | Component | Guard |
|-------|-----------|-------|
| `/` | Home | public |
| `/login` | Login | public |
| `/onboarding` | ModernOnboarding | public |
| `/forgot-password` | ForgotPassword | public |
| `/reset-password` | ResetPassword | public |
| `/terms` | Terms | public |
| `/privacy` | Privacy | public |
| `/signup` | → `/onboarding` redirect | — |
| `/dashboard` | Dashboard | ProtectedRoute |
| `/profile` | MyProfileView | ProtectedRoute |
| `/profile/edit` | ModernProfileEditor | ProtectedRoute |
| `/profile/:userId` | ProfileDetail | ProtectedRoute |
| `/search` | Search | ProtectedRoute |
| `/chat` | Chat | ProtectedRoute |
| `/subscription` | Subscription | ProtectedRoute |
| `/payment/success` | PaymentSuccess | ProtectedRoute |
| `/payment/failed` | PaymentFailed | ProtectedRoute |
| `/payment/history` | PaymentHistory | ProtectedRoute |
| `/settings` | Settings | ProtectedRoute |
| `/notifications` | Notifications | ProtectedRoute |
| `/admin/*` | AdminLayout + children | AdminProtectedRoute |
| `/marketing/*` | MarketingLayout + children | MarketingProtectedRoute |

**Dead files (not routed, safe to delete):**
- `pages/Profile.jsx` — superseded by `MyProfileView.jsx`
- `pages/Signup.jsx` — route redirects to `/onboarding`

### Onboarding Steps (14 steps)

`WelcomeStep` → `CreatingForStep` → `BasicInfoStep` → `CreateAccountStep` → `AboutYourselfStep` → `LocationStep` → `EducationStep` → `MaritalStatusStep` → `ReligionStep` → `LifestyleStep` → `FamilyStep` → `PreferencesStep` → `PhotosStep` → `VerificationStep`

### Key Components

| Dir | Notable Components |
|-----|--------------------|
| `components/common/` | Navbar, BottomNav, ProtectedRoute, ErrorBoundary, LoadingSpinner, UpgradeModal, BlockReportModal, OfflineIndicator, Logo |
| `components/cards/` | MatchCard, ProfileCard |
| `components/search/` | FilterPanel |
| `components/profile/` | FloatingActionBar, ProfileCompletionMeter, ProfilePrompts, InterestTags, SpotifyIntegration, SocialMediaLinks |
| `components/matching/` | CompatibilityMeter, MatchPopup |
| `components/ui/` | Button, Input, Select, Badge, Avatar, Progress, ImageLightbox, FormField, Checkbox, Card |
| `components/ui/` (TSX) | `button.tsx`, `input.tsx`, `label.tsx`, `multistep-form.tsx`, `profile-multistep-form.tsx`, `signup-multistep-form.tsx` |

### Frontend Config (`config/index.js`)

- `razorpay.isConfigured` — true only if `VITE_RAZORPAY_KEY_ID` starts with `rzp_` and has no placeholder
- `google.isConfigured` — true only if `VITE_GOOGLE_CLIENT_ID` ends with `.apps.googleusercontent.com`
- `features.enablePushNotifications` — only if browser supports Notification + ServiceWorker

### Key Frontend Dependencies

`react-router-dom`, `axios`, `socket.io-client`, `framer-motion`, `react-hot-toast`, `lucide-react`, `react-icons`, `recharts`, `dompurify`, `clsx`, `tailwind-merge`, `@radix-ui/react-label`, `@radix-ui/react-slot`, `react-swipeable`, `react-spring`

### Build Notes

- Vite terser: `drop_console: true` in production. `console.log/info/debug` stripped at build time.
- Manual chunks: `vendor-react`, `vendor-ui`, `vendor-utils`
- Targets: `es2020`, `edge88`, `firefox78`, `chrome87`, `safari14`
- Source maps: off in production unless `VITE_ENABLE_SOURCE_MAPS=true`

---

## Environment Setup

### Backend env

File: `.env.development` at **repo root** (one level above `backend/`). `config/env.js` looks here first, then falls back to `backend/.env.development`.

**Note:** The `.env.development` filename has a trailing space in the filesystem — quirk, use exact filename from shell.

Required for dev:
```
PORT=5001
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=root
DB_NAME=matrimony_dev
JWT_SECRET=<min 32 chars>
FRONTEND_URL=http://localhost:3000
```

Optional / needed for full functionality:
```
CLOUDINARY_CLOUD_NAME=...   # real values present in dev env ✅
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx   # ❌ placeholder — payments broken
RAZORPAY_KEY_SECRET=...                  # ❌ placeholder
RAZORPAY_WEBHOOK_SECRET=...              # ❌ needed for webhook signature verify
EMAIL_USER=your-email@gmail.com          # ❌ placeholder — emails fail silently
EMAIL_PASSWORD=...                       # ❌ placeholder
GOOGLE_CLIENT_ID=...                     # ❌ placeholder — Google Sign-In disabled
REDIS_URL=redis://localhost:6379         # optional — falls back to in-memory
ADMIN_EMAIL=admin@tricitymatch.com
ADMIN_PASSWORD=Pass@1234
```

### Frontend env

File: `frontend/.env`

```
VITE_API_URL=http://localhost:5001/api
VITE_WS_URL=http://localhost:5001
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx   # ❌ placeholder
VITE_CLOUDINARY_CLOUD_NAME=duywipohs          # ✅ real value
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com  # ❌ placeholder
```

**Must restart dev server after any `.env` change.**

### Production startup validation

`config/env.js` calls `process.exit(1)` in production if:
- `JWT_SECRET` contains dev placeholder
- `COOKIE_SECRET` is dev default
- `DB_PASSWORD` is `root`
- `FRONTEND_URL` starts with `http://localhost`

---

## Deployment

### Docker Compose

Services: `postgres` (15-alpine), `redis` (7-alpine), `backend`, `frontend` (Nginx-served build), `nginx` (reverse proxy), optional `prometheus` + `grafana`.

```bash
# Dev
docker-compose up -d

# Full production (all profiles)
docker-compose --profile full up -d

# With monitoring
docker-compose --profile full --profile monitoring up -d
```

Nginx config: `nginx/nginx.conf`. Rate-limit zones: `api` 10r/s, `auth` 1r/s. Upstream: `backend:5000` (Docker internal port).

**Note:** nginx.conf upstream still points to port 5000, but backend container maps `5001:5000`. Internal Docker communication uses 5000 — this is correct.

### Production Checklist

1. Set real Razorpay keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) in both backend + frontend envs
2. Set real email credentials (`EMAIL_USER`, `EMAIL_PASSWORD`)
3. Set real Google OAuth Client ID in both envs (optional — disables Google Sign-In button if missing)
4. Create `.env.production` from `.env.production.example` at repo root
5. Set `FRONTEND_URL` to actual production HTTPS domain
6. Set strong `JWT_SECRET` (≥32 chars random), `COOKIE_SECRET`, `CSRF_SECRET`
7. Run migrations: `cd backend && npm run migrate`
8. Run admin seeder: `node backend/seeders/adminSeeder.js`
9. Generate PWA icons: `npx pwa-asset-generator frontend/public/favicon.svg frontend/public/icons`
10. HTTPS required for httpOnly cookies + PWA install

---

## Admin Access

| Field | Value |
|-------|-------|
| Email | `admin@tricitymatch.com` (or `ADMIN_EMAIL` env) |
| Password | `Pass@1234` (or `ADMIN_PASSWORD` env) |
| Login URL | `/login` (not `/admin/login` — that redirects) |

Re-seed / reset password: `node backend/seeders/adminSeeder.js`

Test user passwords (seeded): `Pass@1234`

---

## Testing

| Layer | Framework | Location |
|-------|-----------|---------|
| Backend unit | Jest + Supertest | `backend/tests/unit/` |
| Backend integration | Jest + Supertest | `backend/tests/integration/` |
| Frontend unit | Vitest + RTL | `frontend/src/tests/` |
| E2E | Playwright | `e2e/tests/` |

E2E suites: `01-auth-flow`, `02-crawler`, `03-visual-ui`, `04-ux-interactions`, `05-error-detection`, `06-accessibility`, `07-performance`, `08-broken-assets`.

---

## Known Issues / Remaining Risks

| Issue | Severity | Notes |
|-------|----------|-------|
| Razorpay keys placeholder | 🔴 BLOCKER | Payments disabled until real keys set — graceful "not configured" toast shown to user |
| Email not configured | 🟡 Risk | `EMAIL_USER` placeholder — all transactional emails fail silently |
| Google OAuth disabled | 🟡 Risk | `GOOGLE_CLIENT_ID` placeholder — button hidden on login page |
| OTP accepts `123456`/`000000` | 🟡 Risk | Phone verification is dummy — OK for launch but must note |
| PWA icons missing | 🟠 Low | `/public/icons/` directory empty — PWA install fails, app still works |
| `pages/Profile.jsx` dead file | ⚪ Cleanup | Not routed, not used |
| `emailService.js` legacy duplicate | ⚪ Cleanup | Two email utils exist; chatController uses legacy one |
| Push notifications stub | 🟠 Low | FCM/APNs not implemented — in-app + email only |
| Redis not in dev env | 🟠 Degraded | Account lockout + job queues fall back to in-memory |
| Profile editor "Auto-saving" text misleading | ⚪ UX | Says "Auto-saving as you edit" but only saves on final Save button click at step 10 |
| Admin user detail "No profile created yet" | ⚪ Bug | Shows even when user has a profile — Profile association may be missing in admin detail query |
| Account lockout is in-memory | 🟠 Degraded | Lockout resets on backend restart when Redis unavailable |

---

## Audit & Fix History

### Security Audit — 2026-03-12

All critical/high/medium issues resolved per `SECURITY_AUDIT.md`. CORS regex-hardened.

### Backend Hardening — 2026-04-28

9 bugs fixed (CSP, webhook, email config, notifications, blocked-user exclusion, boost ranking, validators). See commit history.

### Workflow Audit — 2026-04-28

11 end-to-end workflows traced. 8 bugs fixed (email password field, welcome email, like notifications, verify notifications, blocked user exclusion, verificationRejected template, boost search ranking). See commit history.

### Competitive Feature Pass — 2026-04-28

6 features added: religion/caste/income/motherTongue search filters, photo blur enforcement, incognito mode enforcement, verified badge in search, weekly new-match digest email, VIP profile boost auto-activation.

### UI Fixes — 2026-04-30

Dark mode, broken chat route, profile completion meter click, password standardization, MarketingLayout import, apiClient alias, AdminReferralCodes icon. Google Sign-In added (backend + frontend).

### Backend Production Hardening — 2026-05-01

16 issues fixed:
- **CRITICAL:** Webhook raw body captured at wrong path (was `/api/subscription/webhook`, routes use `/api/v1/...`) — all signature verifications were failing silently
- Webhook 500 on missing secret → changed to 200+discard to prevent Razorpay retry storms
- Webhook signature: string equality → `crypto.timingSafeEqual`
- OTP endpoints had no rate limiting
- Invoice UUID validator not wired to `handleValidationErrors`
- Admin `getUsers` Subscription include broken in `findAndCountAll` — added `separate: true`
- Chat message content sent as email notification preview (PII leak)
- `getVerifications` unbounded — added pagination
- Production startup validation (`process.exit(1)` on placeholder config)
- Search validator missing religion/caste/motherTongue/maritalStatus/incomeMin/incomeMax
- `parseInt(incomeMin)` without NaN guard
- Admin CSV revenue export injection protection
- Free-text profile fields stored without HTML-tag stripping (stored XSS)
- `getProfileViewers` missing pagination cap
- `RefreshToken.toJSON()` added to strip `token`/`tokenHash`
- `console.error/warn` in controllers replaced with structured `log.*`

### Full Production QA — 2026-05-04

Live end-to-end QA on tricityshadi.com. 6 bugs fixed:

- **CRITICAL:** Backend crash after container rebuild — new code defaults SSL=ON in production, Docker-internal Postgres has no SSL. Fixed by `DB_DISABLE_SSL: true` in `docker-compose.yml` + `.env.production`.
- **CRITICAL:** Missing DB migrations 23–26 (ReferralCodes, MarketingLeads, indexes, FCM tokens) — container was running old image. Fixed by `docker compose build --no-cache backend && docker compose up -d --force-recreate backend`.
- **HIGH:** CORS blocking health checks — loopback requests (no Origin header) got 500 "CORS: Origin header required". Fixed `security.js` to allow no-origin universally (real browser requests always send Origin; server-side calls never do).
- **HIGH:** Login page ran `validatePassword()` complexity check on login form — blocked users with pre-existing simpler passwords. Removed complexity check from `Login.jsx` validate function (complexity only needed at signup).
- **MEDIUM:** Login error not displayed — `AuthContext.login()` returns `{ error }` but `Login.jsx` read `result.message`. Fixed to `result.error || result.message || fallback`.
- **MEDIUM:** 404 routes silently redirected to homepage. Replaced `<Navigate to="/" />` with proper 404 page in `App.jsx`.

**Deployment note:** Must use `--force-recreate` flag when new backend image is built, or running container stays on old image. Regular `docker compose up -d` does NOT replace containers with new images unless they were stopped.

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).
