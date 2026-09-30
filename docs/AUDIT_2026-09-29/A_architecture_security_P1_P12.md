# TricityMatch — Audit A: Architecture Inventory (Phase 1) + Security & Infrastructure (Phase 12)

- Repo: `/Users/sakshampanjla/Desktop/REACT/tricitymatch`, branch `main`, HEAD `7b170f1` (2026-09-29).
- Mode: READ-ONLY. No repo file modified (scratch helpers live in the scratchpad only). No prod/VPS/SSH access, no OTP/SMS/email/payment actions. Local, in-process probes only (validator library, Express router, bcryptjs, a pure string-parsing simulation).
- `CLAUDE.md` claims were treated as leads. Evidence labels: **[CODE]** = read in source; **[RAN]** = reproduced with a local in-process probe; **[NOT VERIFIED]** = could not be checked read-only (prod host, third-party dashboards, hardware).
- Prior audits exist in `docs/` (`SECURITY_AUDIT_2026-08-21_R1/R2`, `SECURITY_LIVE_TEST_2026-08-21`). Their fixes were re-read in code; items they list as fixed and that I confirmed fixed are marked PASS. New findings below are not in those docs unless stated.

---------------------------------------------------------------------

## 1. INVENTORY / ARCHITECTURE MAP

### 1.1 Topology
| Layer | Tech | Where |
|---|---|---|
| API | Node 20 (Docker `node:20-alpine`), Express 4.22, Sequelize 6 / PostgreSQL 15, ioredis 5, Bull 4, Socket.io 4.8, umzug 2 (auto-migrate on prod boot, `server.js:332-349`) | `backend/` |
| Web | React 18 SPA, Vite (rolldown), react-router 7, AuthContext/OnboardingContext/SocketContext/CallContext, axios (`withCredentials`), service worker `public/sw.js` | `frontend/` |
| Mobile | Expo SDK52 / RN 0.76, react-navigation 6, Zustand + React Query, MMKV, `expo-secure-store` for refresh token | `mobile/` |
| Edge | Compose `nginx:1.27-alpine` (`nginx/nginx.conf`) exists but per CLAUDE.md/audit docs **prod uses a HOST nginx** (not in repo) proxying to 127.0.0.1:3002/5002 [NOT VERIFIED] | `nginx/`, docs |
| Data | Postgres container (no host port), Redis 7 container (`--requirepass`, no host port, `maxmemory 256mb allkeys-lru`, AOF on) | `docker-compose.yml` |
| Observability | Prometheus/Grafana/exporters (profile `monitoring`, loopback-bound), JSON logger with redaction, Bull-driven `utils/alerts.js` | `monitoring/`, `middlewares/logger.js` |
| CI/CD | `.github/workflows/ci.yml` (lint, tests, secret scan, `npm audit --omit=dev --audit-level=high`, docker build), `deploy.yml` (actions pinned by SHA, SSH deploy) | `.github/` |

### 1.2 Request pipeline (order in `server.js`)
requestId → extractIp (`trust proxy 1`) → helmet (CSP for API, HSTS, frameguard DENY) → per-path CORS (monitoring: `origin:false`; webhook/unsubscribe: no CORS; else strict allow-list delegate that 403s no-Origin **writes** unless `X-App-Client: mobile`) → cookieParser(signed) → compression → raw-body capture for `/subscription/webhook` (both prefixes) → `express.json(10mb)` + urlencoded → `sanitizeRequest` → metrics/perf → JSON request log (errors/slow only, `redactUrl`) → `apiLimiter` on `/api` (900 / 15 min, keyed by JWT user else IP, Redis-backed store with in-memory fallback) → `/uploads` static (nosniff + CSP none) → `/monitoring` (own limiter) → `/api/v1` and `/api` (dual mount) → `/api/marketing` → Swagger (dev or `ENABLE_SWAGGER`+`SWAGGER_TOKEN`) → 404 → error handler (masks non-operational errors in prod).

### 1.3 Endpoint inventory (measured by walking the live Express router stack, not by grep)
198 route handlers under `/api/v1` + `/api/marketing` + `/monitoring` (GET 89 · POST 62 · PUT 25 · DELETE 22); every `/api/v1` path is ALSO mounted at `/api` (legacy). Full dump: `scratchpad/routemap-A.txt`.

| Route file | Mount | Handlers | Gate summary |
|---|---|---|---|
| `authRoutes.js` | `/auth` | 22 | public: signup, login, refresh, forgot/reset, google, send/verify-otp (each with dedicated limiter + validator); rest `auth` |
| `profileRoutes.js` | `/profile` | 20 | all `auth`; premium: viewers, unlock-contact, kundli PDF; upload/expensive limiters |
| `searchRoutes.js` | `/search` | 6 | router-level `auth`; searchLimiter |
| `matchRoutes.js` | `/match` | 6 | router-level `auth`; likes = premium |
| `chatRoutes.js` | `/chat` | 8 | router-level `auth` + `requireChatAccess`; voice/reactions add `requirePremium` |
| `subscriptionRoutes.js` | `/subscription` | 13 | `plans` + `webhook` public (HMAC); rest `auth` + local paymentLimiter |
| `adminRoutes.js` | `/admin` | 60 | router-level `auth, adminAuth, adminLimiter`; **every** route carries `requireAdminScope(...)` |
| `verificationRoutes.js` | `/verification` | 2 | `auth`; uploadLimiter |
| `blockReportRoutes.js` | `/block`, `/report` | 4 | `auth`; matchActionLimiter |
| `notificationRoutes.js` | `/notifications` | 7 | `auth` (queries scoped `userId = req.user.id`) |
| `callRoutes.js` | `/calls` | 6 | `auth`; token/initiate `requirePremium` |
| `guardianRoutes.js` | `/guardian` | 7 | `auth`; per-link ownership checks inline |
| `astrologerRoutes.js` | `/astrologers` | 7 | `auth`; **404s when `ASTROLOGER_MARKETPLACE` off** (`routes/index.js:60-66`) |
| `groupRoutes.js` | `/groups` | 12 | router-level `auth`; membership check in controller |
| `inviteRoutes.js` | `/invite` | 2 | `my-link` auth; `/:token` public (inviteLimiter) |
| `statsRoutes.js` | `/stats` | 1 | `auth` |
| `emailRoutes.js` | `/email` | 3 | public, HMAC-signed link, local limiter |
| `routes/index.js` inline | — | 4 | public: success-stories GET/POST, contact, `/events` beacon (all limited) |
| `marketingRoutes.js` | `/api/marketing` | 7 | in-file `router.use(auth, marketingAuth)` |
| `monitoring.js` | `/monitoring`, `/api/monitoring` | 11 | 3 public probes; 8 `auth+adminAuth` |

Unauthenticated surface (15 handlers in the walk; 7 are the marketing router whose gate is a file-level `router.use`): success-stories GET/POST, contact, `/events`, signup/login/refresh/forgot/reset/google/send-otp/verify-otp, subscription `plans`, subscription `webhook` (HMAC), `email/*` (HMAC link), `invite/:token`, `/monitoring/health{,/live,/ready}`, `/health`, `/ready`.
**Routes with no `express-validator` chain on state-changing calls (validated inline in controller or not at all):** admin `POST/DELETE /users`, `PUT /users/bulk-status`, `POST /admins`, `POST /marketing-users`, `POST /referral-codes`, `PUT /launch-offer`, `POST|PUT /success-stories`, `DELETE /photos`; member `PUT /profile/privacy`, `POST /groups`, `POST /guardian/invite`, `POST /calls/initiate`, `POST /astrologers/book`, `POST /notifications/fcm-token`, `POST /search/saved`, `POST /subscription/claim-founding`, `DELETE /subscription/current`, `POST /auth/google`, `POST /events`. All I opened had inline checks; none was found to be exploitable on this basis alone.

### 1.4 Data layer
- 29 Sequelize models (`AnalyticsEvent, AppSetting, Astrologer, AstrologerBooking, AuditLog, Block, CallSession, ChatGrant, ContactMessage, ContactUnlock, Group, GroupMember, GroupMessage, GuardianLink, MarketingLead, MarketingPayout, Match, Message, Notification, Profile, ProfileView, ReferralCode, RefreshToken, Report, SuccessStory, Subscription, UnlockPurchase, User, Verification`), **64 migrations** (`…000064`; CLAUDE.md says 60).
- Integrity that exists: unique `(userId, matchedUserId)` on Matches; unique `(userId, targetUserId)` ContactUnlocks; unique `(blockerId, blockedUserId)`; unique `(groupId, userId)`; unique `(premiumUserId, freeUserId)` ChatGrants; unique `RefreshToken.tokenHash` (only hash stored, raw token nulled by hook); partial unique indexes on `Subscriptions.razorpayPaymentId` and `AstrologerBookings.razorpayPaymentId` (migration 000052); email/googleId/inviteToken unique. `statement_timeout 30s`, pool max 20-30.
- Not enforced by the DB: one-active-subscription-per-user (app-level supersede only); `UnlockPurchases.razorpayPaymentId` uniqueness; FK delete rules differ from migrations (5 FKs into Users are `NO ACTION` in the live DB although migrations say CASCADE — `utils/hardDeleteUsers.js:1-15`).
- Users PII columns: email, phone, googleId, fcmTokens, lastLogin; Profile PII: exact DOB, birthTime, placeOfBirth, income, caste, photos, voice/video URLs; Verification: selfie URL; Messages: content/mediaUrl; GuardianLinks: third-party name+phone; ContactMessages: name/email/phone/IP; MarketingLeads: name/phone/email; RefreshTokens: IP + user-agent.

### 1.5 Redis usage
| Purpose | Keys | TTL | Fail mode |
|---|---|---|---|
| Rate limiters (20 named limiters) | `rl:<name>:<key>` | window | falls back to per-process MemoryStore |
| Login lockout | `lockout:<identifier>` | 10 min | falls back to in-process Map |
| Phone OTP | `otp:<91…>`, `otp_rate:<91…>` (3/hr), `otp-verified:phone:*` (30 min) | 10 min / 1 h | cache miss = "OTP expired" (fail closed) |
| Email OTP / email-change | `otp:<email>`, `otp-verified:email:*`, `email-change:<email>` | 10-30 min | same |
| Cache | `daily-matches:v2`, `stats:community:v1`, profile payloads | 1 h / to IST midnight | in-memory Map |
| Bull queues | `bull:email|notification|cleanup:*` (same Redis DB 0) | none | in-memory array queue (jobs lost on restart) |
Presence is NOT in Redis: it is read from in-memory Socket.io rooms; no Redis adapter, so the realtime tier is single-process only.

### 1.6 Socket.io (`socket/socketHandler.js`)
Auth on handshake (`accessToken` cookie → `auth.token` → Bearer; JWT type=access; user must be `active`); status re-checked at most every 60 s per socket (`ensureStillActive`). Client events: `join-room` (mutual-match + `hasChatAccess` gated — **but see F-01**), `leave-room`, `typing` (mutual gated, relayed to pair room), `join-group` (GroupMember lookup), `leave-group`, `get-online-status` (mutual matches only, honours `showOnlineStatus`, ≤50 ids). Client write events (`send-message`, `message-edited`, `message-deleted`, `group-send-message`) are deliberate no-ops; all broadcasts originate from REST controllers (`emitToConversation`, group controller, `callController`, `notifyUser`). Per-socket rate limits are in-memory. CORS for the engine = `FRONTEND_URL` only; there is no `allowRequest` Origin check (cross-site WS hijack is blocked only by `SameSite=Strict` cookies).

### 1.7 Media / providers / jobs
- **Cloudinary** (folders `profile-photos`, `gallery`, `verification-docs`, `voice-intros`, `voice-messages`, `video-intros`): `resource_type` pinned per endpoint, `allowed_formats` decode-validation, MIME + extension filter, magic-byte check only for disk-fallback files. Delivery is **public unsigned URLs**; local `/uploads` disk fallback if Cloudinary unconfigured (not required by the prod env guard).
- **SMS**: MSG91 v5 (IPv4-forced) / Fast2SMS; OTP generated locally, verified against Redis; **Email**: Resend-first + SMTP fallback (`utils/email.js`), `EMAIL_DRY_RUN` default ON outside prod; **Payments**: Razorpay (orders, HMAC verify-payment, webhook `payment.captured`/`payment.failed`), Google Play (`purchases.subscriptions` API with service account); **Calls**: Agora RTC token (`agora-access-token`); **Push**: FCM (`firebase-admin`); **Google OAuth** `verifyIdToken`.
- **Cron (Bull, `utils/queue.js:590-628`)**: cleanup-expired-tokens (hourly), expire-subscriptions (hourly), cleanup-old-messages (03:00; **disabled unless `MESSAGE_RETENTION_MONTHS` set** → messages retained forever), cleanup-inactive-sessions (04:00), weekly-digest (Mon 10:00), saved-search-alerts (09:00), subscription-lifecycle + photo-nudge (:15/:45).
- **Admin/roles**: `user, marketing, marketing_manager, sub_admin, admin, super_admin`. 10 scopes (`users, subscriptions, verifications, pricing, revenue, reports, support, marketing, stories, team`) in `constants/adminScopes.js`; `admin`/`super_admin` hold all; `sub_admin` holds stored list (fails closed on malformed value).

### 1.8 Environment / deploy / backup
- `config/env.js` is the sole env reader (violations: `server.js:240,247`, `queue.js:203`, `updateProfile` dev logs, `adminSeeder`). Prod boot guard is strong: fatal on placeholder/short JWT/COOKIE/CSRF secrets, secret reuse, weak DB password, missing `REDIS_PASSWORD`, `OTP_BYPASS_CODES`, `ALLOW_INSECURE_PROD`, `DB_DISABLE_SSL` without acknowledgement, localhost CORS origin, dev DB name.
- Compose: containers `no-new-privileges`, backend `cap_drop: ALL`, memory limits, json-file log rotation 10m×3, loopback-only host ports, all secrets from env. Compose passes only vars in its explicit allowlist.
- Backups: `scripts/backup-db.sh` (age public-key encrypted, retention, `--verify` restore mode, optional rsync) exists in repo, but per `docs/SECURITY_LIVE_TEST_2026-08-21.md` prod was still running a **plaintext local-only** `pg_dump` cron and the least-privilege role script (`scripts/db-least-privilege.sql`) is "NOT APPLIED". Neither could be checked read-only → [NOT VERIFIED].

### 1.9 Feature inventory with implementation evidence and dependencies
| # | Feature | Implemented? / evidence | Depends on |
|---|---|---|---|
| 1 | Email/phone signup + login, refresh rotation, sessions list/revoke | Yes — `authController.js` signup 168, login 387, refresh 482, sessions 786-848 | Redis (lockout), bcrypt, JWT |
| 2 | Signup OTP (phone required, email optional) | Yes but see F-03/F-04/F-05/F-06 — `authController.js:244-251, 880-985`, `smsService.js` | MSG91/Fast2SMS, Redis |
| 3 | Google sign-in | Yes — `authController.js:1041-1149` (server verifies ID token) | `GOOGLE_CLIENT_ID` (unset in prod per CLAUDE.md) |
| 4 | Password reset (email link) | Yes — single-use via password-hash fingerprint `:609-723`; no path for phone-only accounts (F-22) | Resend |
| 5 | Profile CRUD w/ allow-listed fields, completion score, privacy toggles | Yes — `profileController.js:175-396`, `constants/profileFields.js` | Cloudinary |
| 6 | Photos / voice intro / video intro / live-selfie verification | Yes — `middlewares/upload.js`, `verificationController.js` | Cloudinary, admin review |
| 7 | Search + filters + saved searches + by-code lookup | Yes — `searchController.js`; excludes blocked/incognito/matches-only | Postgres |
| 8 | Like / shortlist / pass, mutual match, daily matches, "sent" | Yes — `matchController.js` (Block enforced here) | Redis cache |
| 9 | Compatibility, Ashtakoot/kundli PDF, numerology, biodata PDF | Yes — `utils/compatibility.js`, `kundli.js`, `biodata.js`; gated by `assertProfileVisible` | pdfkit |
| 10 | Chat (REST + socket broadcast), reply-quote, reactions, voice notes, free-reply window (live in prod) | Yes — `chatController.js`, `utils/entitlements.js`; **Block not enforced (F-02)** | Socket.io, Cloudinary |
| 11 | Voice/video calls (web+RN) | Yes — `callController.js`; token bound to session/booking (H-1 fix confirmed `:22-63`) | Agora creds |
| 12 | Family groups | Yes — `groupController.js` (membership gate) | Socket.io |
| 13 | Guardian co-pilot | Yes — `guardianRoutes.js` (inline handlers) | — |
| 14 | Astrologer marketplace | Built, **dark by flag** (404s) | Razorpay, Agora |
| 15 | Subscriptions: single launch plan, admin-editable offer, founding grant, upgrade/supersede, bundles, invoices, manual admin refund | Yes — `subscriptionController.js`, `utils/launchOffer.js`, `razorpay.js`; bundle webhook gap (F-17) | Razorpay live keys |
| 16 | Google Play billing | Yes — `verifyGooglePlay :360-515` (token-only idempotency, account-binding check) | Play service account |
| 17 | Contact unlock with anti-harvest (rolling 24h cap on unlimited) | Yes — `profileController.js:781-980`, `auth.js:296-335` | — |
| 18 | Notifications (in-app + FCM push + socket) | Yes — `notifyUser.js` | FCM |
| 19 | Lifecycle & digest email, opt-out (signed link) | Yes — `lifecycleMail.js`, `emailUnsubscribe.js` (HMAC of userId under JWT secret, RFC 8058 POST) | Bull, Resend |
| 20 | Admin panel: users (filters, bulk, export, hard delete), verifications, reports, photos, suspicious-account heuristics, pricing editor, support inbox+reply, team/scopes, audit log, funnel | Yes — `adminController.js`, `adminSafetyController.js`, `analyticsController.js` | Postgres |
| 21 | Marketing B2B: reps, referral codes, leads, commission, payout ledger | Yes — `marketingRoutes.js`, `utils/marketing*.js` | — |
| 22 | Member invites + unlock reward | Yes — `inviteController.js`, `utils/inviteReward.js` (cap 20/inviter) | — |
| 23 | Account erasure (self) / admin hard delete | Partial — DB anonymisation only (F-08) | Cloudinary (not called) |
| 24 | Analytics beacon + funnel | Yes — `POST /events` allow-listed names, no PII | — |
| 25 | SEO/public pages, PWA service worker, i18n en/hi/pa | Yes — `frontend/src`, `public/sw.js` | — |

---------------------------------------------------------------------

## 2. PHASE 12 CHECKLIST

Status: PASS / PARTIAL / FAIL / NOT VERIFIED / NOT APPLICABLE. Sev = highest severity of linked findings.

| ID | Requirement | Status | Sev | Findings |
|---|---|---|---|---|
| P12-01 | Password hashing & policy (bcrypt 12, 8+ w/ complexity, hash never returned) | PASS | Info | F-31 |
| P12-02 | Session/JWT/cookies (httpOnly, Secure, SameSite=Strict, 15m/7d, rotation + family revoke, hashed refresh tokens) | PARTIAL | Low | F-30 |
| P12-03 | Login brute-force controls (IP limiter + per-identifier lockout) | PARTIAL | Low | F-24 |
| P12-04 | Account-enumeration resistance | PARTIAL | Low | F-24, F-08, F-23 |
| P12-05 | OTP generation/verification strength | FAIL | Medium | F-06, F-07 |
| P12-06 | Signup identity-proof integrity (phone/email verification enforced server-side) | FAIL | Medium | F-04, F-05 |
| P12-07 | Login identifier canonicalisation matches signup | FAIL | **High** | F-03 |
| P12-08 | Password reset / recovery | PARTIAL | Medium | F-08, F-22 |
| P12-09 | OAuth (Google) handling | PARTIAL | Medium | F-04, F-08 |
| P12-10 | AuthN/limiter/validator coverage on EVERY route file | PASS (with notes) | Low | §1.3; F-21 |
| P12-11 | Admin/RBAC enforcement, MFA | PARTIAL | Medium | F-12, F-11 |
| P12-12 | Object-level access control (REST) | PASS | — | profiles, chat, groups, guardians, calls, invoices, notifications, sessions verified |
| P12-13 | Socket.io authorization | **FAIL** | **High** | F-01 |
| P12-14 | Block/report safety controls actually stop contact | **FAIL** | **High** | F-02 |
| P12-15 | SQL injection | PASS | — | all raw SQL parameterised / `sequelize.escape` |
| P12-16 | XSS / output encoding / CSP | PASS | Info | F-29 |
| P12-17 | CSRF | PASS | Info | F-33 |
| P12-18 | SSRF | PASS | Info | biodata fetch is server-derived Cloudinary URL (`profileController.js:1316`) |
| P12-19 | File-upload safety | PARTIAL | Medium | F-18, F-19 |
| P12-20 | Security headers / CORS / TLS | PASS (app) / NOT VERIFIED (host nginx TLS) | Info | F-33 |
| P12-21 | Secrets management, rotation | PARTIAL | Low | F-30 (c) |
| P12-22 | Secrets in git / history / bundles | PASS | Info | scanner: 1 false positive (`docker-compose.yml:455`), history: 1 unreachable 162-byte blob NOT VERIFIED |
| P12-23 | Dependency vulnerabilities | FAIL | Medium | F-15 |
| P12-24 | Runtime/base-image currency, reproducible builds | FAIL | Medium | F-16 |
| P12-25 | API schema validation / safe error responses | PARTIAL | Medium | F-09, F-21 |
| P12-26 | Data minimisation in responses | PARTIAL | Medium | F-10 |
| P12-27 | DB constraints / indexes | PARTIAL | Low | F-28 |
| P12-28 | Migrations & transaction boundaries | PARTIAL | Low | F-28 |
| P12-29 | DB least-privilege & network isolation | PARTIAL | Medium | F-14b, prior docs |
| P12-30 | Redis auth / isolation / key expiry | PARTIAL | Medium | F-14 |
| P12-31 | Payment flows & webhook integrity | PARTIAL | Medium | F-17 |
| P12-32 | Backups / restore test / DR | FAIL (per docs) / NOT VERIFIED | Medium | F-20 |
| P12-33 | Logging without PII; monitoring & alerting | PARTIAL | Low | F-26, F-27 |
| P12-34 | Health checks / resource limits | PASS | Low | F-26 |
| P12-35 | Graceful degradation (provider/DB/queue outage) | PARTIAL | Medium | F-15 (b), F-32 |
| P12-36 | Privacy: erasure, retention, DPDP | FAIL | Medium | F-08, F-13 |
| P12-37 | Host hardening (SSH, fail2ban, CDN) | NOT VERIFIED | (prior: High) | §5 |
| P12-38 | CI/CD supply-chain | PARTIAL | Low | F-34 |
| P12-39 | Mobile client security (token storage, ATS, permissions, signing) | PASS / PARTIAL | Low | F-35 |
| P12-40 | Abuse controls (SMS pumping, invite farming, beacon, contact-unlock harvest) | PARTIAL | Medium | F-05, F-07, F-36 |
| P12-41 | Sanitiser/middleware correctness (no silent data loss) | FAIL | Medium | F-09 |
| P12-42 | Moderation completeness (removed content actually removed) | PARTIAL | Low | F-13, F-19 |

---------------------------------------------------------------------

## 3. DETAILED FINDINGS (ranked)

Format per finding: Req · Status · Severity · Evidence · Actual · Expected · Safe repro · Impact · Fix.
Findings marked [RAN] were reproduced with a local in-process probe; [CODE] is code-reading only — I did not run them against a live database, so "exploitable" is stated only where the code path is unambiguous and its prerequisites are named.

---------------------------------------------------------------------
### HIGH
---------------------------------------------------------------------

#### F-01 — Socket `join-room` lets a member join ANY user pair's chat room and read their live messages
- **Req** P12-13 (socket authZ) / P12-12 · **Status** FAIL · **Severity** High (needs prerequisites below) · [CODE + RAN simulation of the parsing]
- **Evidence** `backend/socket/socketHandler.js:241-243`:
  `const userIds = roomId.split('_room_'); const otherUserId = userIds.find(id => id !== userId);` then `verifyMutualMatch(userId, otherUserId)` (`:251`), `hasChatAccess` (`:261`), and `socket.join(roomId)` (`:267)` — joins the **client-supplied string**, not a room derived from the two verified ids. REST fan-out targets the deterministic pair room: `chatController.js:62-70` `io.to([senderId,receiverId].sort().join('_room_')).emit('message:new'|legacy 'message', {message})`. No check that `userIds.length === 2` or that `userIds` includes the caller. No unit test covers this (`tests/unit/socketRevocation.test.js` only covers status revalidation).
- **Actual** With M = attacker, X = any member who is a **mutual match of M**, Y = any other user id, and roomId = `sorted([X,Y]).join('_room_')` where X sorts first: the server takes `otherUserId = X`, passes both gates (M↔X mutual + M has chat access), and `join`s room `X_room_Y`. Every later `message:new`/`message`/`message:edited`/`message:deleted`/`message:reaction`/`user_typing` on the X↔Y conversation is delivered to M. Local simulation of the parse: `otherUserId` resolves to the first id in the room string and `userIds.includes(M) === false` (no rejection).
- **Expected** Room id must be exactly `getRoomId(userId, otherUserId)` (two parts, caller is one of them) or the join must be refused.
- **Prerequisites** attacker has chat access (paid plan, or a free-reply grant with the flag on) and a mutual match with the lexicographically smaller of the two victim UUIDs; victim ids are obtainable from search/profile ids. Live interception only (no history backfill).
- **Safe repro** Dev DB, three seeded accounts A(attacker) mutual with X, plus X↔Y chatting; connect A's socket, `emit('join-room', [X,Y].sort().join('_room_'))`, then send an X→Y message via REST and observe A receives `message:new`.
- **Impact** Real-time disclosure of private conversations (and typing/edit/delete metadata) of any member who has at least one mutual match with the attacker; trust/privacy breach on a matrimonial platform.
- **Fix** In `join-room`: `const parts = roomId.split('_room_'); if (parts.length !== 2 || !parts.includes(userId) || roomId !== getRoomId(parts[0], parts[1])) → INVALID_ROOM`. Ideally stop trusting client room names: server computes `getRoomId(userId, otherUserId)` from an `otherUserId` payload. Add a regression test with a 3-account fixture.

#### F-02 — Blocking a user does not stop messaging, calls, group adds, or realtime delivery between existing mutual matches
- **Req** P12-14 (block/report) / P12-12 · **Status** FAIL · **Severity** High (user-safety) · [CODE]
- **Evidence** `controllers/blockReportController.js:11-33` `blockUser` only `Block.findOrCreate` — it does not touch `Matches.isMutual` or any conversation. `Block` is referenced only in `matchController.js:29` (blocks new like/pass), `searchController.js` (excluded from search) and `profileController.assertProfileVisible`. It is **absent** from `chatController.js` (`sendMessage :315`, `getMessages :249`, `getConversations :92`, voice `:579`, reactions), `callController.initiateCall :80-110`, `groupController.addMember :142`, and `socketHandler.verifyMutualMatch :142`. Routes gate sends with `verifyTargetUser` (`middlewares/auth.js:341-368`) which only checks target `status`.
- **Actual** After A blocks B, if A↔B were already a mutual match: B can still POST `/chat/messages` and `/chat/messages/voice`, can call A via `/calls/initiate`, can add A to a group, and both still list each other in `/chat/conversations`; A's socket still receives B's messages.
- **Expected** A block must sever every contact channel in both directions (and preferably clear or hide the match).
- **Safe repro** Two dev accounts, make them mutual, A `POST /block/:B`, then B `POST /chat/messages {receiverId:A}` → succeeds (200).
- **Impact** The primary harassment-mitigation control does not work for the highest-risk relationship (someone already matched). Also undermines the "report/block" claims in Safety/Terms.
- **Fix** One shared `assertNotBlocked(a,b)` used in chat send/read/voice/reactions, call initiate/accept, group add, `verifyMutualMatch` (socket + REST), notification fan-out; on block, set `isMutual=false`/soft-hide the conversation and revoke ChatGrants.

#### F-03 — Login does not canonicalise the identifier the way signup does: dotted / `+tag` Gmail addresses cannot log in
- **Req** P12-07 · **Status** FAIL · **Severity** High (availability of authentication; also breaks email-OTP "verified" stamping) · [RAN]
- **Evidence** `validators/index.js:54` signup `.normalizeEmail()` (default options strip Gmail dots and `+tag`, lower-case); `loginValidation` (`:118-129`) has no normaliser; `authController.login :396-400` looks up `email: loginLookupKey(req.body)` = lower-cased raw input (`middlewares/security.js:590-594`). Probe: signup chain turned `Jane.Doe+x@Gmail.com` into stored `janedoe@gmail.com`; login chain left `Jane.Doe+x@Gmail.com` → lower-cased `jane.doe+x@gmail.com` (no match). `forgotPasswordValidation` (`:158`) DOES normalise, so reset works but login with the typed address still fails.
- Same root cause: `sendOtp :908` stores `otp:${target}` with the raw (not lower-cased) target while `verifyOtp :942` looks up the lower-cased key (mixed-case emails → "OTP expired"); signup consumes marker `otp-verified:email:<normalised>` (`:235`) but `verifyOtp :976` wrote the marker for the typed address → Gmail-with-dots users' `emailVerified` never becomes true.
- **Actual** A member who signs up with `john.smith@gmail.com` is stored as `johnsmith@gmail.com`; typing the original address at login returns "Invalid credentials" (and counts toward lockout).
- **Expected** One canonical form applied at signup, login, OTP send/verify and lookup.
- **Repro** (dev only) signup `first.last@gmail.com`, then login with the same string.
- **Impact** Locks out a large class of real users (Gmail dots/plus are very common); prod has only ~15 users so it may not yet have been hit.
- **Fix** Apply the same `normalizeEmail` (or better: a plain lower-case + trim everywhere, and drop Gmail-specific rewriting) in `loginValidation`, `sendOtp`, `verifyOtp`, `checkAccountLockout`; add a regression test crossing signup→login.

---------------------------------------------------------------------
### MEDIUM
---------------------------------------------------------------------

#### F-04 — Account pre-hijacking: unverified email signup + Google sign-in auto-link keeps the attacker's password
- **Req** P12-06 / P12-09 · **Status** FAIL · **Severity** Medium · [CODE]
- **Evidence** `authController.signup :244-251` requires only the **phone** to be verified; the email is stored with `emailVerified: emailWasVerified` (false if the email OTP was skipped), and login never requires `emailVerified`. `googleAuth :1071-1081`: if a User with that email exists, it sets `googleId`, flips `emailVerified = true`, keeps the existing `password` and issues tokens — without clearing the password or revoking existing refresh tokens.
- **Actual** Attacker signs up with victim@gmail.com (own verified phone, own password). When the real owner later uses "Sign in with Google", the account is silently linked; attacker's password and any live refresh token (7 d) still work.
- **Expected** Link only when the existing account's email was verified; otherwise wipe the unverified credential (or refuse) and revoke sessions.
- **Repro** Dev: signup with target email + attacker phone (OTP bypass in dev), then simulate Google link path with a stubbed verified payload.
- **Impact** Silent long-lived access to a real person's matrimonial account/messages; also lets an attacker squat any email.
- **Fix** Require verified email before password login/any premium purchase; on Google link when `!emailVerified`: `password=null`, revoke all RefreshTokens.

#### F-05 — "Verified mobile is compulsory" is bypassable by a client-supplied header and by Google sign-in
- **Req** P12-06 / P12-40 · **Status** FAIL · **Severity** Medium · [CODE]
- **Evidence** `authController.js:248-251`: `isNativeClient = x-app-client === 'mobile'` → skips the `phoneWasVerified` requirement. That header is a plain request header any script can send (it is also the CORS escape hatch, `security.js:424`). `googleAuth :1085-1107` creates accounts with no phone at all. `unlockContact` hides unverified numbers (`profileController.js:820-825`), so it does not expose numbers, but the signup gate is what other controls (invite-reward farming cap comment `inviteReward.js:44-52`, fake-account cost, SMS cost) assume.
- **Actual** Unlimited-cost fake accounts: `POST /auth/signup` with `X-App-Client: mobile` needs no phone OTP; only `signupLimiter` (5 real signups/hr/IP, `skipFailedRequests`) applies. Each fake account under `?invite=<own token>` yields 3 unlocks (cap 20/inviter) → ≈60 unlocks per inviter = directory harvesting; and each new account is also a 48 h boosted profile if a referral code is supplied (`signup :195-205`).
- **Expected** Server-side rule independent of a spoofable header (e.g. require phone verification for everyone, or restrict native exemption via an attested build/version claim and sunset date).
- **Repro** curl signup with the header from a dev instance and observe 201 with `phoneVerified:false`.
- **Fix** Remove the exemption (old builds get an in-app prompt via `features` flag) or gate it on an app-attestation/`X-App-Version` allow-list with a hard sunset; require verified phone for Google-created accounts before discovery/likes.

#### F-06 — OTP entropy and brute-force resistance are weak (4-digit phone OTP, non-CSPRNG, non-atomic attempt counter, resend resets attempts)
- **Req** P12-05 · **Status** FAIL · **Severity** Medium (exploitability unproven; cost ~ distributed IPs) · [CODE]
- **Evidence** `smsService.js:20` `generateCode = 1000 + Math.random()*9000` (4 digits, V8 xorshift `Math.random`); email OTP `authController.js:906,1177` also `Math.random()`. `verifyOtp :226-248` and email branch `:949-960` do read → compare → write-back of `attempts+1` (not atomic) so N parallel guesses each read the same counter. `sendOtp` overwrites the entry (attempts reset to 0) up to 3×/hr/phone (`smsService.js:152-160`). Only per-IP `otpLimiter` (10 / 10 min) sits in front. `otp-verified:*` marker is not bound to the requester.
- **Actual** Per targeted phone: ≤3 fresh codes/hour × (5–10 guesses) → ≈0.15–0.3 %/hour success per hour for an attacker with enough source IPs; sustained 24 h ≈ 4–7 %. Success yields a "verified" claim on a number the attacker does not own (which then feeds `phoneVerified` and the unlock-contact reveal → a stranger's number shown under the attacker's profile).
- **Expected** `crypto.randomInt`, atomic Redis `INCR`-based attempt counter (or `SET NX`/Lua), and per-target (not just per-IP) verify budget; 6-digit for phone if the DLT template allows.
- **Repro** Dev: fire 10 concurrent wrong `verify-otp` requests and observe `attempts` increments < 10.
- **Fix** As above; also add a CAPTCHA/proof-of-work on `send-otp`.

#### F-07 — SMS pumping / toll-fraud exposure on `send-otp`
- **Req** P12-40 · **Status** PARTIAL · **Severity** Medium · [CODE]
- **Evidence** `authRoutes.js:101-117` accepts `+?[0-9]{10,15}`; `smsService.normalizePhone :30-42` keeps any 11–15 digit number as-is; `sendMSG91 :106` allows "plausible international" lengths. User model then requires an Indian 10-digit number (`User.js:42-47`), so a foreign number can never complete signup — it is pure send cost. Limits: `otpLimiter` 10/10 min per IP + 3/hr per phone; no CAPTCHA, no per-account/global budget; the `signup → /events` funnel shows real traffic is tiny so a spike is easy to spot only if monitored.
- **Expected** Reject non-Indian numbers before spending an SMS; global daily SMS ceiling with alert; challenge on send.
- **Fix** Validate `^[6-9]\d{9}$` (after normalising +91/91/0) in `otpTargetValidation`; add a global counter + kill-switch.

#### F-08 — Google-only accounts cannot delete their account, change password, or use forgot-password (HTTP 500), and `forgot-password` becomes an enumeration oracle
- **Req** P12-36 / P12-08 / P12-04 · **Status** FAIL · **Severity** Medium · [RAN]
- **Evidence** `User.js:192-194` `comparePassword` → `bcrypt.compare(pw, this.password)`; for `password = null` (Google-created, `authController.js:1088`) bcryptjs rejects: probe output `Illegal arguments: string, object`. Callers: `deleteAccount :860`, `changePassword :737` → unhandled → 500 "unexpected error". `forgotPassword :627-631` does `crypto.createHash('sha256').update(user.password)` — probe: `ERR_INVALID_ARG_TYPE` for null → 500, while an unknown email returns the generic 200 after a jitter delay (`:616-622`). `resetPassword :687-691` has the same null hazard.
- **Actual** (a) A Google-registered member has no working in-product account deletion (DPDP erasure right; Google Play policy); (b) `POST /auth/forgot-password` returns 500 iff the email belongs to a Google-only account → account-type oracle.
- **Expected** OAuth-only accounts delete via recent Google re-auth or an emailed confirmation link; forgot-password returns the generic response regardless.
- **Fix** Guard `if (!user.password)` in all four handlers; implement re-auth-based deletion.

#### F-09 — Global request sanitiser silently deletes any string value that starts with `$` (passwords, chat messages, bios)
- **Req** P12-41 / P12-25 · **Status** FAIL · **Severity** Medium (functional; correctness of auth) · [RAN]
- **Evidence** `middlewares/security.js:520-522` inside `sanitizeObject` (applied to `req.body/query/params` for every request): `if (obj[key].startsWith('$')) delete obj[key];` and arrays drop items starting with `$` (`:525-528`). Probe: `{password:'$Passw0rd!', content:'$500 is my budget', tags:['$x','y']}` → `{…}` with `password` and `content` removed, `tags:['y']`.
- **Actual** A user choosing a password that begins with `$` (one of the symbols the password rule *requires*, `[@$!%*?&]`) cannot sign up, log in, or reset ("Password is required"/"at least 8 characters"); a chat message "$500 …" fails as empty; profile bio starting with `$` is dropped silently. There is no NoSQL layer here (Postgres/Sequelize) so the rule buys nothing.
- **Fix** Remove value-level `$` stripping (keep prototype-key blocking); add a test with `$`-prefixed password.

#### F-10 — `GET /profile/:id` returns the entire Profile row to any authenticated viewer (no serializer)
- **Req** P12-26 · **Status** PARTIAL · **Severity** Medium (privacy/DPDP data-minimisation) · [CODE]
- **Evidence** `profileController.js:649` `profile.toJSON()`; `models/Profile.js` defines **no** `toJSON` override (User does; Profile does not). Returned to any logged-in viewer of a visible profile: exact `dateOfBirth`, `birthTime`, `placeOfBirth`, `income`, `familyLocation`, `quizAnswers`, `personalityValues`, `familyPreferences`, `lifestylePreferences` (**includes the target's `savedSearches`** — other members' saved partner filters), `incognitoMode`, `showPhone/showEmail/showOnlineStatus/showLastSeen`, `isActive`, `completionPercentage`. Only phone/email/photos/voice/video/social links are redacted.
- **Expected** Explicit response allow-list per viewer tier; `savedSearches`, `quizAnswers`, `incognitoMode` never leave the owner.
- **Fix** Serializer `toPublicProfile(profile, viewerCtx)`; unit-test the key set.

#### F-11 — No MFA / step-up for admin, sub-admin or marketing accounts; admin passwords set by admins have no policy check
- **Req** P12-11 · **Status** FAIL · **Severity** Medium · [CODE]
- **Evidence** Admin login is the ordinary `/auth/login` (15-min JWT, 7-day refresh). `createAdmin :1041-1099` / `createUser :587-633` accept any password ≥8 (model `len` only; no complexity check, `express-validator` chain absent) and set `emailVerified:true`. The admin surface includes member CSV export (`/admin/users/export`), hard delete, refunds (sub-admin cap constant), plan grants and pricing edits.
- **Expected** TOTP/WebAuthn for privileged roles, shorter admin sessions, optional IP allow-list, forced first-login password change.
- **Fix** Add TOTP for `ADMIN_ROLES` + `marketing*`; run the password policy in admin create paths.

#### F-12 — `PUT /admin/users/:id/status` has no rank/role guard: a `users`-scoped sub-admin can deactivate/ban admins (and the "last admin" guard is bypassed)
- **Req** P12-11 · **Status** PARTIAL · **Severity** Medium · [CODE]
- **Evidence** `adminController.js:225-255` loads any `User.findByPk(userId)` and sets `status` from the allow-list; no `rankOf(target.role) > rankOf(actor.role)` check (that guard exists only in `updateUserRole :1132`, and `bulkUpdateStatus adminSafetyController.js:181-186` correctly limits to `role:'user'`). `assertNotLastFullAdmin` is only called from role changes. A banned admin fails `auth` (`middlewares/auth.js:69`).
- **Actual** Any holder of scope `users` (default sub-admin scopes include it, `adminScopes.js`) can lock every full admin out of the panel.
- **Fix** Reuse the `bulkUpdateStatus` restriction (members only) or the rank check; call `assertNotLastFullAdmin` on status changes; forbid self-ban.

#### F-13 — Right-to-erasure gaps beyond the DB row (see also F-08)
- **Req** P12-36 · **Status** FAIL · **Severity** Medium · [CODE]
- **Evidence** `utils/accountErasure.js:76-158` anonymises rows but **never calls Cloudinary** (profile photos, gallery, selfie, voice/video intros and voice messages stay on public URLs), does not touch `MarketingLeads` (name/phone/email copy created at signup, `authController.js:299-307`), `ContactMessages` (name/email/phone/IP), `Reports.description`, `AuditLogs` emails, `Subscriptions` beyond retention rationale, or Redis/Bull payloads. Admin `removePhoto` (`adminSafetyController.js:224-247`) unlinks the URL from the profile but does not `destroy` the Cloudinary asset either, so a moderation removal leaves the image reachable. `MESSAGE_RETENTION_MONTHS` unset ⇒ message bodies kept indefinitely (`queue.js:189-209`).
- **Fix** Erasure job destroys Cloudinary public_ids (list before nulling), scrubs MarketingLeads/ContactMessages by email/phone, defines a retention schedule for dormant accounts and messages.

#### F-14 — Redis is configured `allkeys-lru` while holding OTP, lockout, rate-limit counters and Bull queues
- **Req** P12-30 · **Status** PARTIAL · **Severity** Medium · [CODE]
- **Evidence** `docker-compose.yml:56` `--maxmemory 256mb --maxmemory-policy allkeys-lru`; Bull uses the same instance (`utils/queue.js:29-37`); OTP/lockout in same DB (`smsService.js`, `security.js:596-646`). Bull documents `noeviction` as required.
- **Actual** Under memory pressure Redis may evict a pending OTP (user-visible "expired"), a lockout counter (brute-force budget resets), a rate-limit key, or **queued/delayed jobs** (emails, lifecycle mail) with no error. AOF persistence also writes plaintext OTPs to disk (`otp` payload holds the code).
- **Fix** Separate Redis (or DB index) for queues with `noeviction`; `volatile-lru` for cache; hash OTP codes before storing; alert on `evicted_keys > 0`.
- **F-14b** (P12-29) Compose defaults `DB_USER=postgres` (superuser) for the app; `scripts/db-least-privilege.sql` is documented as **not applied** and the app also runs DDL (umzug) at every boot with the same credentials. [NOT VERIFIED on prod.]

#### F-15 — Dependency vulnerabilities & the CI gate
- **Req** P12-23 / P12-35 · **Status** FAIL · **Severity** Medium · [RAN `npm audit --json`, 2026-09-29]
- **Backend** 21 vulns (4 high, 17 moderate). Production-reachable: **`nodemailer` (direct, HIGH)** — advisories: `resolveContent` bypasses `disableFileAccess/disableUrlAccess`, IDN allow-list bypass (fix: 10.x/9.1.x; we run 9.0.3 with server-controlled templates so exposure is low); `express`/`body-parser`/`qs` (moderate DoS advisories; fix available 4.22.3+), `firebase-admin` transitive chain (`google-gax`, `@google-cloud/*`, `uuid` moderate), `morgan` (log injection; morgan is a dependency but `logger.js` is used), `fast-uri` (HIGH, host-confusion/SSRF via Ajv chain — dev/tool path), `js-yaml`/`browserslist` (HIGH, tooling).
- **Frontend** 8 vulns (4 high): `dompurify` (direct, moderate — used in `utils/sanitize.js`, not on a `dangerouslySetInnerHTML` path), `postcss`/`undici`/`js-yaml`/`browserslist` (build/test tooling).
- **Root/mobile** 49 incl. 1 critical (`tar` via expo CLI — build tooling, not shipped).
- (a) `npm audit` finds **no** multer advisory; CLAUDE.md's claim holds *for the audit DB*. Separately note `multer 1.4.5-lts.2` vs latest 2.4.0; multer 1.x has published multipart DoS advisories in 2025 (from vendor knowledge — not reproduced here). (b) `server.js:476-488` treats any unhandled rejection as fatal (`gracefulShutdown`), so any parser bug reachable by an authenticated upload becomes a process-kill (single container ⇒ outage). (c) CI `security-scan` runs `npm audit --omit=dev --audit-level=high` and `node scripts/scan-secrets.mjs`: today the former would fail on `nodemailer`, and the latter exits 1 on a **false positive** (`docker-compose.yml:455` — `${PG_EXPORTER_PASSWORD:-}` not covered by the ALLOW regex), so CI is red for the wrong reasons and likely bypassed.
- **Fix** `nodemailer@^10`/9.1.x, `express@4.22.3`, upgrade multer (2.x) with an error-handling wrapper, add allow-list entry for the compose false positive, decide whether unhandled rejections should kill the process.

#### F-16 — Backend image is not reproducible and runs an EOL Node line
- **Req** P12-24 · **Status** FAIL · **Severity** Medium · [CODE]
- **Evidence** `backend/Dockerfile:8,14` `FROM node:20-alpine` (unpinned tag; Node 20 LTS reached end-of-life 2026-04-30 per the Node release schedule — verify) and `RUN npm install --omit=dev` with `backend/.npmrc legacy-peer-deps=true` and **no lockfile in the build context** (`backend/package-lock.json` is gitignored; the root lockfile is outside `context: ./backend`). Every rebuild resolves fresh transitive versions. Frontend uses `npm ci` (good) but `FROM nginx:alpine` unpinned and runs as root (documented deferral).
- **Fix** Node 22/24 LTS pinned by digest; build from repo root context with `npm ci --workspace=backend`; pin `nginx:alpine`.

#### F-17 — Unlock-bundle purchases have no webhook fallback and require an active plan at verify time
- **Req** P12-31 · **Status** PARTIAL · **Severity** Medium (money taken, credit not given) · [CODE]
- **Evidence** `subscriptionController.webhook :728-858` handles only `Subscription` order ids; `UnlockPurchase` orders are never activated by `payment.captured`. `verifyBundlePayment :1054-1103` is the only credit path and sits behind `requirePremium` (`subscriptionRoutes.js:143-150`) and `findActiveFiniteSubscription`; if the browser closes after payment or the plan lapsed, the customer is charged with no credit and no reconciliation job exists (also noted in CLAUDE.md "Bundle pending orders are not swept"). `verifyPayment` itself is HMAC-only (no capture-status fetch) — acceptable since only Razorpay/server hold the secret.
- **Fix** Handle bundle order ids in the webhook (same activation code), drop `requirePremium` from verify, add a stale-order reconciler that asks Razorpay for order status.

#### F-18 — Media privacy: verification selfies, voice notes and gated media are served from public, unsigned Cloudinary URLs
- **Req** P12-19 · **Status** PARTIAL · **Severity** Medium · [CODE]
- **Evidence** `middlewares/upload.js:129-137,197-249,288-297` — default `type: 'upload'` (public delivery); `getProfile :654-668` nulls `photos/profilePhoto/voiceIntroUrl/videoIntroUrl` only in the API response; the URLs are permanent bearer links (public_ids are random but any leak — logs, screenshots, a past response, Cloudinary listing — is permanent). Verification selfies (`verification-docs/`) and private chat voice messages have the same exposure. `photoBlurUntilMatch` is therefore an API-level, not media-level, control.
- **Fix** Use `type:'authenticated'` (or private) with short-lived signed URLs for selfies/voice messages/blurred photos; keep public only for photos the owner exposes to everyone.

#### F-19 — Upload pipeline correctness/robustness
- **Req** P12-19 / P12-42 · **Status** PARTIAL · **Severity** Low-Medium · [CODE]
- Files are streamed to Cloudinary by multer **before** route validation (`profileRoutes.js:65-78` order: limiter → multer → `validateUploadedFiles` → validators), so a request that later fails validation leaves orphaned assets; magic-byte checking (`upload.js:327-358`) only runs for disk-fallback files, video/audio never; the disk fallback activates silently if Cloudinary env is missing (prod guard does not require Cloudinary); admin photo removal leaves the asset (F-13).

#### F-20 — Backups / DR
- **Req** P12-32 · **Status** FAIL (per docs) / NOT VERIFIED · **Severity** Medium
- **Evidence** `docs/SECURITY_LIVE_TEST_2026-08-21.md:70,109`: prod = plaintext daily `pg_dump` to `/var/backups/tricitymatch`, local only; the encrypted `scripts/backup-db.sh` (with `--verify` restore) exists in repo but there is no evidence it is installed, that the age key is off-host, or that a restore has ever been rehearsed. My memory notes also flag `pg_dump | gzip` masking dump failures (script here uses `pipefail` and a size floor — good).
- **Fix** Install the encrypted script, off-box copy (`BACKUP_REMOTE_TARGET`), monthly `--verify` in a scratch DB, documented RPO/RTO.

#### F-21 — (Route coverage note) inline-only validation and unvalidated ids on admin routes
- **Req** P12-10 / P12-25 · **Status** PARTIAL · **Severity** Low
- `DELETE /admin/photos` takes `userId` unvalidated (`adminSafetyController.js:225-232`) → Postgres uuid cast error path; `POST /groups/:id/members` accepts `userId` without UUID check (`groupController.js:156`); search filters `diet/smoking/drinking/education` flow straight into `where` (`searchController.js:154-166`) → invalid enum value = 500 (driver error is masked in prod). Cheap to fix with `isIn`/`isUUID`.

---------------------------------------------------------------------
### LOW
---------------------------------------------------------------------

#### F-22 — Phone-only accounts have no password-recovery path
- `forgotPassword` requires an email (`authRoutes.js`, `authController.js:609-654`); signup makes the phone mandatory and the email optional, and "no OTP-login" is a product decision. A phone-only member who forgets the password is permanently locked out (support-only). Provide phone-OTP-based reset with the same safeguards.

#### F-23 — Group `addMember` is a phone→user oracle and needs no consent / block check
- **Req** P12-12/P12-04 · [CODE] `groupController.js:142-195`. The comment claims hits/misses are indistinguishable, but a hit returns **201 with the `member` row (including `userId`)** and a miss returns 400 — so any authenticated member can turn a phone number into an internal user id (then `GET /profile/:id`) at 60 req/min (`matchActionLimiter`). Target is added without consent and without a Block check (notification body embeds the owner-chosen group name). Fix: identical response for hit/miss, pending-invite + accept step, Block check, and do not echo ids.

#### F-24 — Authentication side channels
- `login` returns immediately when the account is not found but runs bcrypt(12) when it exists (`authController.js:403-433`): ~200-300 ms timing oracle; lockout is per raw identifier so any identifier can be locked for 10 min with 5 bad attempts (`security.js:596-646`; targeted DoS); signup 409 (`:185,189`) and `send-otp` 409 (`:891,897`) confirm registration by product decision, bounded by limiters (signup's `skipFailedRequests` makes 409 probes free of the 5/hr cap; only `apiLimiter` 900/15 min applies); guardian invite returns `method: direct|pending` (`guardianRoutes.js:96-127`) revealing whether an email is registered. Mitigate with dummy-hash compare, `(ip,identifier)` lockout keys, uniform responses.

#### F-25 — `getProfile` computes premium access without an `endDate` predicate
- `profileController.js:603-608` `Subscription.findOne({status:'active'})` (no expiry, no ordering) although `utils/entitlements.getActiveSubscription` exists precisely for this (its header explains the hourly sweep is cleanup only). Effect: an expired-but-unswept plan (or Redis-down where the sweep never runs) still reveals previously unlocked phone/email and voice/video intros and reports `hasPremiumAccess:true`.

#### F-26 — `requireChatAccess` cannot see route params; public health endpoints leak internals
- `chatRoutes.js:26` applies `requireChatAccess` via `router.use`, where `req.params` is `{}` [RAN: Express probe → `atRouterUse:{}` vs `atRoute:{userId}`], so `middlewares/auth.js:246` `req.params?.userId` is always undefined for `GET /chat/messages/:userId`. Result: `hasChatAccess(userId, null)` — a free member holding *any* ChatGrant passes the route gate for every thread (the controller still requires mutual match) and the free-reply `replyWindow` is never attached to message reads. Separately `/api/monitoring/health/ready` (unauth) returns DB error strings and pool stats (`healthCheck.js:38-56`), `/monitoring/health` returns pid/uptime, `/health` returns environment.

#### F-27 — Logging/monitoring
- PII in log message strings: phone numbers (`smsService.js:199,189`), emails (`guardianRoutes.js:120`, `contactController.js:47`, `authController.js` dev OTP logs gated to development), JSON logger redacts by key only. Monitoring config cannot work as committed: `monitoring/prometheus.yml` scrapes `api:5000` (compose service is `backend`) at `/monitoring/metrics`, which requires an admin cookie/Bearer (`monitoring.js:140`); `basic_auth` block is commented. No Sentry DSN (CLAUDE.md). Alert routing is unverified [NOT VERIFIED]. Grafana 10.1.0 / Prometheus 2.47 images are outdated (loopback-bound).

#### F-28 — DB drift and migration mechanics
- Live FK rules differ from migrations (`hardDeleteUsers.js:1-15`); prod boot runs `umzug.up()` in-process with the app's DB credentials and no advisory lock (single replica assumed); a failing migration aborts start (`process.exit(1)`), non-transactional DDL can leave a half-applied state; Razorpay order creation runs inside the DB transaction in `createOrder :70-121` (orphan provider order if COMMIT fails). No DB constraint enforcing one active subscription per user.

#### F-29 — Stored output encoding
- Chat/group messages are HTML-escaped before storage (`chatController.js:41-54`, `groupController.js:22-35`), contact/story fields use validator `.escape()`, so stored text contains `&amp;`-style entities (React re-escapes → double-encoded display) and the model is "sanitise on input" rather than "encode on output"; profile free text only strips `<…>` with a regex (`profileController.js:236-238`). No `dangerouslySetInnerHTML` exists in `frontend/src` (grep), so no live XSS sink was found — keep it that way.

#### F-30 — Token lifecycle details
- (a) Refresh rotation is not atomic (`authController.js:514-524` revoke then create): two concurrent refreshes with one token can both succeed; conversely a second tab replaying the just-rotated token triggers family revoke (`:494-503`) → surprise logout. (b) Access tokens (15 min) stay valid after logout/`logout-all`/password change because `auth` never checks the `sid` row (`middlewares/auth.js:79`). (c) One `JWT_SECRET` signs access, reset, and HMAC-unsubscribe links (domain-separated by claim/prefix); no rotation procedure (rotation kills every email link). (d) `signup/login/refresh/google` also return `refreshToken` in the JSON body for web (`authController.js:376-380`) — an XSS at login time could read it; web ignores it. (e) `x-request-id` from the client is echoed into logs/headers unvalidated (`security.js:657-661`).

#### F-31 — Password handling notes
- bcryptjs truncates at 72 bytes while the model allows 100 chars; validator has no max (10 MB body limit × bcrypt UTF-8 conversion = cheap CPU amplification); no breached-password check; `express.json` limit 10 MB globally where largest legitimate JSON is small (`config/env.js:163`).

#### F-32 — Provider outage behaviour
- Redis down → silently in-memory (single process) and Bull falls back to an in-memory array (`queue.js:20-40, 85-88`): queued emails/lifecycle jobs vanish on restart and limiter/lockout budgets reset; SMS failure correctly returns 503 and clears the OTP; email failures are non-fatal; Razorpay outage → 500 on create-order; DB outage → `/ready` 503 (compose healthcheck uses `/monitoring/health/ready` which returns 200 unless DB is down).

#### F-33 — Headers/CORS/CSRF/TLS observations (all PASS with notes)
- Cookies `httpOnly; Secure (prod); SameSite=Strict`; CORS is an allow-list with credentials, no-Origin writes rejected except webhook/unsubscribe/`X-App-Client`; helmet CSP on API, HSTS 1 y preload, frameguard DENY + `frame-ancestors 'none'`. `CSRF_SECRET` is required by the prod guard but **no CSRF middleware exists** (`grep csrf` → only env.js): protection is SameSite=Strict + Origin allow-list — adequate, but the secret is dead config. Compose `nginx.conf` has an `add_header` inheritance flaw (server-level HSTS `add_header` drops the http-level XFO/nosniff/CSP for `location /`), and its `/api/auth` zone (1 r/s, burst 5) would throttle `/auth/me` — irrelevant if prod truly uses the host nginx [NOT VERIFIED; per docs CSP lives on the host].

#### F-34 — CI/CD
- Actions pinned to commit SHAs (good), deploy via SSH secrets, coverage/test artifacts; see F-15(c) for the red security job. Deploy is actually manual per CLAUDE.md (git pull + compose), so CI status is advisory.

#### F-35 — Mobile
- `expo-secure-store` holds only the refresh token (access token in memory); iOS ATS arbitrary loads disabled; blocked Android permissions verified in manifest. Release `signingConfig` in `mobile/android/app/build.gradle:108-113` is the committed debug keystore (Expo template) — EAS overrides it, but a local `assembleRelease` would ship debug-signed; `android:allowBackup="true"` with custom backup rules (rules file not found at the path I checked). No certificate pinning [not required, noted]. `EXPO_PUBLIC_*` values are non-secret (client IDs/DSN/support contact).

#### F-36 — Invite-reward abuse / beacon growth
- See F-05 for reward farming; `POST /events` writes one DB row per call for anonymous callers (60/10 min/IP) — bloat only.

#### F-37 — Service worker caches authenticated API GETs
- `public/sw.js:120-126` `networkFirst` caches `/api/*` GET responses (profiles, chat pages, match lists incl. unlocked contact data) in Cache Storage as an offline fallback. `AuthContext` clears caches on logout/first-login (lines 41-75) — good — but not on session expiry, and the cache is per-browser-profile plaintext. Prefer `no-store` for authenticated API routes.

---------------------------------------------------------------------
## 4. CONFIRMED PASS (with evidence)
- **No SQL injection**: every raw query uses `replacements`/`sequelize.escape` (`adminController.js:99-135` allow-lists + escape, `matchController.js:114`, `profileController.js:839`, `chatController.js:146`, `searchController.js:223` static literal).
- **Mass assignment**: `PROFILE_EDITABLE_FIELDS` allow-list + validator stripper; `onboardingComplete`, `completionPercentage`, role/status never client-settable; admin `createUser` forces `role:'user'`.
- **Webhook**: HMAC over raw body with `timingSafeEqual`, secret must be a non-placeholder in prod, missing secret ⇒ discard, idempotent activation, revival rules for closed orders (`subscriptionRoutes.js:45-81`).
- **IDOR (REST)**: profile view/compat/horoscope/PDF go through `assertProfileVisible` (status, block, matches_only); invoices/sessions/notifications/guardian/groups scoped by owner id; Agora token bound to session/booking (`callController.js:22-63`); contact unlock validates target before spending quota, atomic quota update, rolling 24 h ceiling re-checked inside the txn.
- **Secrets**: `scripts/scan-secrets.mjs` (tracked files) 1 false positive only; `--history` (5,552 blobs) 6 hits: 3 are older/newer versions of `docker-compose.yml` (same `${…}` false-positive shape), 1 is an unreachable 162-byte blob that trips google/github/slack shapes [NOT VERIFIED — looks like a scanner fixture; not on any ref]. No `.env` files tracked; `frontend/dist` (untracked) contains only a public `rzp_test_` key id. Frontend never stores tokens in `localStorage` (only an auth hint flag).
- **Prod env guard**, JSON log redaction (`redactUrl`, key-pattern), no stack traces to clients in prod, Redis/Postgres/backend/frontend ports loopback-only in compose, resource limits and log rotation on all services, non-root backend user, `cap_drop: ALL`.

## 5. NOT VERIFIED (read-only limits)
- Live host nginx TLS/HSTS/CSP, SSH hardening (prior report: password + root SSH, no fail2ban, 1 vCPU, no CDN — owner declined hardening on 2026-08-18), off-box backups, whether `EMAIL_DRY_RUN`/flags in prod `.env` match compose allow-list, Razorpay dashboard `payment.failed` webhook subscription, prod DB role privileges, Cloudinary account settings (EXIF stripping, delivery type), Sentry/alert routing.

## 6. Suggested fix order
1. F-01 (socket room parse — 5-line fix) and F-02 (block enforcement) — user-safety/privacy regressions.
2. F-03 (login canonicalisation) and F-09 (`$` stripping) — they lock real users out of authentication.
3. F-04/F-05/F-06/F-07 — signup identity-proof and OTP hardening.
4. F-08/F-13 — erasure (Google users, Cloudinary, leads) before Play/DPDP review.
5. F-10, F-12, F-14, F-15/F-16, F-17, F-20.
