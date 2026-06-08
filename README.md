# TricityShadi — Matrimonial Platform

<p align="center">
  A production-grade, secure, and scalable matrimonial platform for the Tricity area (Chandigarh, Mohali, Panchkula).
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#api-reference">API</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#subscription-plans">Plans</a> •
  <a href="#testing">Testing</a>
</p>

---

## Overview

TricityShadi is a hyperlocal matrimonial platform targeting Chandigarh, Mohali, and Panchkula. Full-stack monorepo: React 18 SPA + Express.js REST API + PostgreSQL + Redis + Socket.io real-time messaging. Deployed via Docker Compose behind Nginx.

**Live site:** [tricityshadi.com](https://tricityshadi.com)

---

## Features

### Core Platform
- **Smart Compatibility Matching** — Algorithm scoring compatibility based on preferences, lifestyle, personality, horoscope, and location
- **14-Step Onboarding** — Guided profile creation: Welcome → Creating For → Basic Info → Account → About → Location → Education → Marital Status → Religion → Lifestyle → Family → Preferences → Photos → Verification
- **Advanced Search & Filters** — Filter by age, height, education, profession, religion, caste, mother tongue, income range, marital status, and location
- **Real-time Chat** — Socket.io powered instant messaging (premium users + mutual matches only). WhatsApp-style read receipts, message edit (15-min window), and delete
- **Identity Verification** — Aadhaar/PAN document submission with admin approval workflow and verified badge on profile
- **Subscription System** — 4-tier plans with Razorpay integration (Free → Basic Premium → Premium Plus → VIP)

### Matching & Discovery
- **Like / Shortlist / Pass** — Three-way match actions with mutual-match detection
- **Who Liked You** — See incoming interest (premium feature)
- **Profile Views** — Track who viewed your profile
- **Smart Suggestions** — Curated matches on dashboard
- **Profile Boost** — VIP members get boosted sort ranking in search results (`+8` score, auto-expires)

### Privacy & Safety
- **Incognito Mode** — Hide profile from search results
- **Photo Blur Until Match** — Photos blurred for non-mutual viewers
- **Contact Unlock** — Unlock phone/contact details (per-plan quota)
- **Block & Report** — Block users or report abuse
- **Account Lockout** — Redis-backed brute-force protection (5 attempts, 30-min lockout)

### Communication
- **In-App Notifications** — Real-time Socket.io push to `user_${userId}` room
- **Email Notifications** — Welcome, password reset, match notification, subscription confirmation, verification approval/rejection
- **Weekly Digest** — Monday 10 AM cron: re-engagement email if ≥1 new match
- **Socket.io Events** — join-room, send-message, typing indicators, message-edited, message-deleted, online status

### Admin Panel
- User management, verification approvals, subscription overrides
- Revenue dashboard with CSV export
- Referral codes management
- Marketing leads tracking
- Admin-gated Prometheus metrics at `/monitoring/metrics`

### Developer & Ops Features
- **Structured Logging** — JSON logger with `log.error/warn/info/debug/security/audit/performance` levels
- **Prometheus Metrics** — HTTP request rates, latency (p50/p95/p99), business metrics (signups, logins, matches, messages), cache hit/miss, queue stats
- **Grafana Dashboards** — Pre-configured monitoring stack
- **Health Checks** — Liveness, readiness (DB), and full health (DB + Redis + memory)
- **Background Jobs** — Bull queues: email, notification, cleanup. In-memory fallback when Redis unavailable
- **PWA Ready** — Service worker, manifest (icons directory pending population)

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, Socket.io Client, react-router-dom, axios, lucide-react, react-icons, recharts, dompurify, @radix-ui |
| **Backend** | Node.js 20, Express.js, Socket.io, JWT (httpOnly cookies), CommonJS |
| **Database** | PostgreSQL 15, Sequelize ORM (22 migrations) |
| **Cache** | Redis 7 (ioredis, with in-memory fallback) |
| **Queue** | Bull (Redis-based job queues) |
| **Payments** | Razorpay (orders, signature verify, webhook) |
| **Storage** | Cloudinary (magic-byte validated, face-crop for profile photo) |
| **Monitoring** | Prometheus, Grafana, custom metrics middleware |
| **Deployment** | Docker, Docker Compose, Nginx (rate-limited reverse proxy) |
| **Testing** | Jest + Supertest (backend), Vitest + RTL (frontend), Playwright (E2E) |

---

## Quick Start

### Prerequisites
- **Docker** >= 20.10 + **Docker Compose** >= 2.0
- OR: **Node.js** >= 20, **PostgreSQL** >= 15, **Redis** >= 7 (optional)

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/your-org/tricitymatch.git
cd tricitymatch

# Copy environment template and fill in values
cp .env.example .env.development
nano .env.development

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

Access:
- Frontend: http://localhost:3000
- API: http://localhost:5001/api
- Health: http://localhost:5001/monitoring/health

### Option 2: Manual Setup

```bash
# Install dependencies (npm workspaces)
npm install

# Run both services concurrently
npm run dev

# Or individually:
npm run dev:backend    # nodemon → port 5001
npm run dev:frontend   # Vite → port 3000
```

### Database Setup

```bash
cd backend
npm run migrate          # run all pending migrations
node seeders/adminSeeder.js  # create admin user
```

---

## Environment Variables

### Backend (`.env.development` at repo root)

| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | Yes | Default `5001` |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | Yes | Default `5432` |
| `DB_USER` | Yes | PostgreSQL user |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Min 32 chars |
| `FRONTEND_URL` | Yes | For CORS (e.g. `http://localhost:3000`) |
| `CLOUDINARY_CLOUD_NAME` | Optional | Image uploads |
| `CLOUDINARY_API_KEY` | Optional | Image uploads |
| `CLOUDINARY_API_SECRET` | Optional | Image uploads |
| `RAZORPAY_KEY_ID` | Optional | Payments disabled if missing |
| `RAZORPAY_KEY_SECRET` | Optional | Payments |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Webhook signature verify |
| `EMAIL_USER` | Optional | Gmail SMTP — emails fail silently if missing |
| `EMAIL_PASSWORD` | Optional | Gmail app password |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth — button hidden if missing |
| `REDIS_URL` | Optional | Falls back to in-memory |
| `ADMIN_EMAIL` | Optional | Default `admin@tricitymatch.com` |
| `ADMIN_PASSWORD` | Optional | Default `Pass@1234` |

### Frontend (`frontend/.env`)

| Variable | Notes |
|----------|-------|
| `VITE_API_URL` | e.g. `http://localhost:5001/api` |
| `VITE_WS_URL` | e.g. `http://localhost:5001` |
| `VITE_RAZORPAY_KEY_ID` | Must start with `rzp_` |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_GOOGLE_CLIENT_ID` | Must end with `.apps.googleusercontent.com` |

> Restart dev server after any `.env` change.

---

## Project Structure

```
/
├── backend/
│   ├── config/           # env.js (single env source), database.js, swagger
│   ├── controllers/      # Auth, Profile, Match, Chat, Admin, Subscription,
│   │                     # Verification, Search, Notification, BlockReport
│   ├── middlewares/      # security.js (9 rate limiters), auth.js, errorHandler.js,
│   │                     # logger.js, upload.js (Multer+Cloudinary)
│   ├── migrations/       # 22 migration files (000001–000022)
│   ├── models/           # User, Profile, Match, Message, Subscription, Verification,
│   │                     # Notification, Block, Report, ContactUnlock, MarketingLead,
│   │                     # ReferralCode, RefreshToken, ProfileView
│   ├── routes/           # index.js mounts all routes under /api/v1
│   ├── seeders/          # adminSeeder.js
│   ├── socket/           # socketHandler.js (Socket.io events + per-socket rate limits)
│   ├── tests/            # unit/ + integration/ (Jest + Supertest)
│   ├── utils/            # cache.js, queue.js, metrics.js, notifyUser.js, razorpay.js,
│   │                     # email.js, emailService.js, invoice.js, healthCheck.js,
│   │                     # alerts.js, performance.js, socket.js, compatibility.js
│   ├── validators/       # All express-validator schemas
│   └── server.js         # Entry point
├── frontend/
│   └── src/
│       ├── api/          # axios.js (withCredentials, auto-refresh), apiClient.js
│       ├── components/
│       │   ├── common/   # Navbar, BottomNav, ProtectedRoute, ErrorBoundary,
│       │   │             # LoadingSpinner, UpgradeModal, BlockReportModal, Logo
│       │   ├── cards/    # MatchCard, ProfileCard
│       │   ├── search/   # FilterPanel
│       │   ├── profile/  # FloatingActionBar, ProfileCompletionMeter, ProfilePrompts,
│       │   │             # InterestTags, SpotifyIntegration, SocialMediaLinks
│       │   ├── matching/ # CompatibilityMeter, MatchPopup
│       │   └── ui/       # Button, Input, Select, Badge, Avatar, Progress,
│       │                 # ImageLightbox, FormField, Checkbox, Card (JSX + TSX)
│       ├── context/      # AuthContext, OnboardingContext, SocketContext
│       ├── pages/        # All route-level page components
│       ├── hooks/
│       └── utils/
├── e2e/                  # Playwright — 8 test suites
├── nginx/                # nginx.conf (rate-limit zones, upstream backend:5000)
├── monitoring/           # Prometheus config, Grafana dashboards, alert rules
├── scripts/              # Image optimization, utility scripts
├── docs/                 # API docs
├── docker-compose.yml
└── package.json          # npm workspaces root
```

---

## API Reference

All routes under `/api/v1` (also `/api` for backward compat).

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | Public | Register new user |
| POST | `/auth/login` | Public | Login — sets httpOnly cookies |
| POST | `/auth/logout` | Auth | Revoke tokens |
| POST | `/auth/refresh-token` | Public | Rotate access token |
| GET | `/auth/me` | Auth | Get current user |
| POST | `/auth/forgot-password` | Public | Send reset email |
| POST | `/auth/reset-password` | Public | Set new password |
| POST | `/auth/google` | Public | Google OAuth login/signup |
| POST | `/auth/verify-otp` | Auth | Phone OTP verification |

### Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profile/me` | Auth | Get own profile |
| PUT | `/profile/me` | Auth | Update profile |
| GET | `/profile/:userId` | Auth | View another profile |
| POST | `/profile/photo` | Auth | Upload profile photo |
| POST | `/profile/gallery` | Auth | Upload gallery photos |
| DELETE | `/profile/gallery/:photoId` | Auth | Delete gallery photo |
| GET | `/profile/viewers` | Auth | Who viewed my profile |

### Search & Match

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/search` | Auth | Search with filters (age, height, education, religion, caste, income, motherTongue, maritalStatus, location) |
| POST | `/match/:userId` | Auth | `{ action: 'like' | 'shortlist' | 'pass' }` |
| GET | `/match/matches` | Auth | Mutual matches |
| GET | `/match/liked-me` | Auth | Who liked me |
| GET | `/match/shortlisted` | Auth | My shortlisted profiles |

### Chat

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/conversations` | Auth + Premium | List conversations |
| GET | `/chat/:userId` | Auth + Premium | Get message thread |
| POST | `/chat/send` | Auth + Premium | Send message |
| PUT | `/chat/message/:id` | Auth + Premium | Edit message (15-min window) |
| DELETE | `/chat/message/:id` | Auth + Premium | Delete message |

### Subscription

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/subscription/plans` | Public | List plans + prices |
| POST | `/subscription/create-order` | Auth | Create Razorpay order |
| POST | `/subscription/verify-payment` | Auth | Verify signature + activate |
| POST | `/subscription/webhook` | Public | Razorpay async webhook |
| GET | `/subscription/history` | Auth | Payment history |
| GET | `/subscription/invoice/:id` | Auth | Download PDF invoice |

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | Auth | Get notifications (paginated) |
| PUT | `/notifications/:id/read` | Auth | Mark as read |
| PUT | `/notifications/read-all` | Auth | Mark all read |

### Monitoring & Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Liveness check |
| GET | `/ready` | Public | DB readiness check |
| GET | `/monitoring/health` | Public | Basic health |
| GET | `/monitoring/health/full` | Admin | Full health (DB + Redis + memory) |
| GET | `/monitoring/metrics` | Admin | Prometheus metrics |

---

## Subscription Plans

| Feature | Free | Basic Premium | Premium Plus | VIP |
|---------|------|---------------|--------------|-----|
| **Price** | ₹0 | ₹1,500 | ₹3,000 | ₹7,499 |
| **Duration** | — | 15 days | 30 days | 90 days |
| **Contact Unlocks** | 0 | 5 | 10 | Unlimited |
| Basic Search | ✓ | ✓ | ✓ | ✓ |
| Chat | ✗ | ✓ | ✓ | ✓ |
| See Who Liked You | ✗ | ✓ | ✓ | ✓ |
| Profile Boost | ✗ | ✗ | ✗ | ✓ |
| Priority in Search | ✗ | ✗ | ✗ | ✓ |

VIP plan auto-sets `isBoosted=true` + `boostExpiresAt` on activation.

---

## Security

- **Auth:** JWT httpOnly cookies — `accessToken` (15m) + `refreshToken` (7d, hashed in DB). Token rotation on refresh; family-based revocation on reuse detection
- **Rate Limiting:** 11 rate limiters — general API (200/15min), auth (5/15min), signup (3/hr), password reset (3/hr), search (30/min), messages (60/min), profile update (10/min), match actions (60/min), uploads (20/hr), admin (100/min), payments (10/hr)
- **Account Lockout:** Redis-backed, 5 attempts → 30-min lockout
- **Input Validation:** express-validator schemas for all endpoints
- **SQL Injection:** Sequelize parameterized queries
- **XSS:** Helmet headers + DOMPurify + HTML-tag stripping on free-text profile fields
- **CSRF:** Token-based protection
- **Password:** Bcrypt (12 rounds)
- **Webhook Signature:** `crypto.timingSafeEqual` comparison
- **CORS:** Hardened regex, no-origin requests allowed (server-side health checks)
- **RefreshToken:** `toJSON()` strips `token` + `tokenHash` from API responses

---

## Deployment

### Development

```bash
docker-compose up -d
```

### Production (full stack)

```bash
docker-compose --profile full up -d --build
```

### Production with Monitoring

```bash
docker-compose --profile full --profile monitoring up -d --build
```

> **Important:** Use `--force-recreate` when rebuilding backend — `docker compose up -d` alone does NOT replace running containers with new images.

```bash
docker compose build --no-cache backend
docker compose up -d --force-recreate backend
```

### Production Checklist

1. Set real `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (both backend + frontend envs)
2. Set real `EMAIL_USER`, `EMAIL_PASSWORD`
3. Set `GOOGLE_CLIENT_ID` (optional — disables Google Sign-In button if absent)
4. Create `.env.production` from `.env.production.example`
5. Set `FRONTEND_URL` to production HTTPS domain
6. Set strong `JWT_SECRET` (≥32 chars), `COOKIE_SECRET`, `CSRF_SECRET`
7. Set `DB_DISABLE_SSL: true` in `docker-compose.yml` for Docker-internal Postgres
8. Run migrations: `cd backend && npm run migrate`
9. Run admin seeder: `node backend/seeders/adminSeeder.js`
10. HTTPS required for httpOnly cookies + PWA install

**Production startup validation:** `config/env.js` calls `process.exit(1)` if JWT_SECRET/COOKIE_SECRET/DB_PASSWORD/FRONTEND_URL contain dev defaults.

---

## Testing

```bash
# All tests
npm run test

# Backend only (Jest + Supertest)
npm run test:backend

# Frontend only (Vitest + RTL)
npm run test:frontend

# Single test file
cd backend && npx jest tests/unit/authController.test.js
cd frontend && npx vitest run src/tests/SomeComponent.test.jsx

# E2E (Playwright)
npm run qa              # all 8 suites
npm run qa:auth         # 01-auth-flow
npm run qa:visual       # 03-visual-ui
npm run qa:headed       # with browser UI
npm run qa:full         # tests + HTML report
npm run qa:ui           # open HTML report
```

E2E suites: `01-auth-flow`, `02-crawler`, `03-visual-ui`, `04-ux-interactions`, `05-error-detection`, `06-accessibility`, `07-performance`, `08-broken-assets`

---

## Admin Access

| Field | Value |
|-------|-------|
| Email | `admin@tricitymatch.com` (or `ADMIN_EMAIL` env) |
| Password | `Pass@1234` (or `ADMIN_PASSWORD` env) |
| Login URL | `/login` (NOT `/admin/login` — that redirects) |

Re-seed / reset: `node backend/seeders/adminSeeder.js`

---

## Monitoring

| Endpoint | Description |
|----------|-------------|
| `/health` | Liveness |
| `/ready` | DB readiness |
| `/monitoring/health/full` | DB + Redis + memory |
| `/monitoring/metrics` | Prometheus scrape endpoint (admin-gated) |

With monitoring profile:
- **Grafana:** http://localhost:3001 (admin / changeme)
- **Prometheus:** http://localhost:9090

Metrics collected: HTTP rates + latency (p50/p95/p99), signups, logins, matches, messages, cache hit/miss, queue stats, memory/CPU.

---

## Known Limitations

| Issue | Severity | Notes |
|-------|----------|-------|
| Razorpay keys placeholder | Blocker | Payments disabled until real keys configured |
| Email not configured | Risk | `EMAIL_USER` placeholder — emails fail silently |
| Google OAuth disabled | Risk | `GOOGLE_CLIENT_ID` placeholder — button hidden |
| OTP accepts `123456`/`000000` | Risk | Phone verification is dummy |
| PWA icons missing | Low | `/public/icons/` empty — PWA install fails, app works |
| Push notifications stub | Low | FCM/APNs not implemented — in-app + email only |
| Redis not in dev env | Degraded | Account lockout + queues fall back to in-memory |

---

## Troubleshooting

**Backend crash on startup (production):**
Ensure `DB_DISABLE_SSL: true` is set in `docker-compose.yml` — Docker-internal Postgres has no SSL cert.

**Login blocked for existing users:**
Password complexity check was incorrectly applied at login. Confirmed fixed — complexity validation only runs at signup.

**Container running old code after rebuild:**
```bash
docker compose build --no-cache backend
docker compose up -d --force-recreate backend
```

**Redis not available:**
Application gracefully falls back to in-memory cache. Account lockout resets on backend restart.

**Webhook signature failures:**
Webhook raw body must be captured before JSON parsing. Configured at `/api/v1/subscription/webhook` (not `/api/subscription/webhook`).

---

## License

ISC License — see [LICENSE](LICENSE) for details.

---

## Support

- **Issues:** Open a GitHub issue
- **Email:** support@tricityshadi.com

---

<p align="center">Built with love for Tricity</p>
