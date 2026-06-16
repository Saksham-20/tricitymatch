# Project Audit Tracker

> **SINGLE SOURCE OF TRUTH.** Never rely on conversation memory. Read this file before
> starting any review chunk. Update it after every completed chunk. Every finding cites
> exact `file:line` evidence — never assume or hallucinate code.
>
> Methodology + skill mapping: [docs/09_Audit_System.md](docs/09_Audit_System.md)

## Project Overview

- **Project Name:** TricityShadi (TricityMatch) — hyperlocal matrimonial (Chandigarh/Mohali/Panchkula)
- **Tech Stack:** React 18 + Vite (web) · Express CommonJS + Sequelize/PostgreSQL + Redis + Socket.io (backend) · React Native Expo SDK51 (mobile) · shared TS types · Docker Compose + Nginx · Prometheus/Grafana
- **Repository:** local `/Users/sakshampanjla/Desktop/REACT/tricitymatch` (branch `main`)
- **Scale (verified 2026-06-15):** 11 controllers · 16 route files · 5 middlewares · 19 models · 37 migrations · 29 web pages · 48 web components · 9 Playwright e2e specs
- **Last Updated:** 2026-06-15 (**🏁 ALL 9 PHASES ✅ — AUDIT COMPLETE.** Phase 9: MF-1 (High — Family/Group Chat no backend, mobile 404s = SOCK-1), MF-2 web↔mobile parity, MF-3 OTP validation parity. 3 Highs total: SOCK-1/WH-1/MF-1 (SOCK-1 & MF-1 are the same root). Final deliverables: see bottom of file.)

---

# Review Plan & Execution Order

Audit in **small chunks**, one item at a time, finish an area before moving on.
Recommended order (dependencies first, surface area last):

| # | Phase | gstack skill to drive it | Est. chunks |
|---|-------|--------------------------|-------------|
| 1 | Architecture | `/health`, `/investigate` (for unknowns) | 4 |
| 2 | Backend (API/controllers/logic) | `/code-review`, `/security-review` | 6 |
| 3 | Database (schema/index/migrations) | `/health`, manual SQL review | 4 |
| 4 | Security (OWASP) | `/security-review`, `/cso` | 12 |
| 5 | Frontend | `/design-review`, `/code-review` | 6 |
| 6 | SEO | manual + `/browse` | 6 |
| 7 | Performance | `/benchmark`, `/browse`, `/qa` | 5 |
| 8 | QA (functional/edge/flows) | `/qa-only` then `/qa` to fix | 4 |
| 9 | Missing / Incomplete Features | `/spec`, PRD diff (docs/01_PRD.md) | 6 |

**Skill rule:** never do manually what a skill does. Run the report-only variant first
(`/qa-only`, `/code-review` no `--fix`), record findings here, then run the fixing
variant in a separate chunk.

## Resume Protocol (read on every new session)

1. Open this file. Find the first phase whose Status is not `✅ Done`.
2. Inside it, find the first unchecked `[ ]` item.
3. Audit **only that item**. Cite `file:line` evidence.
4. Append findings to the phase block **and** the relevant master table below.
5. Update the phase Status + `Last Updated` date. Then stop or continue to next item.

**Severity scale:** Critical (exploitable/data-loss/prod-down) · High (broken core flow / likely incident) · Medium (degraded UX/perf/maintainability) · Low (polish/nice-to-have).
**Status values:** `⬜ Not Started` · `🟡 In Progress` · `✅ Done`.

---

# Audit Progress

## Phase 1 — Architecture Review
Skill: `/health` · `/investigate`

- [x] Folder Structure (backend/frontend/mobile/shared boundaries)
- [x] Module Boundaries (controllers ↔ utils ↔ models; no service layer — logic lives in `backend/controllers/` + `backend/utils/`)
- [x] Dependency Review (npm workspaces, version drift, unused deps)
- [x] Coupling / Circular Imports
- [x] Config & Env source-of-truth (`backend/config/env.js` is sole reader)
- [x] Technical Debt (dead files: `frontend/src/pages/Profile.jsx`, `frontend/src/pages/Signup.jsx`, `backend/utils/emailService.js`)

**Status:** ✅ Done
**Findings (Folder Structure — 2026-06-15):**
- ✅ **Positive — clean cross-workspace boundaries.** No deep relative imports between workspaces. Evidence: `grep -rE "(\.\./)+(backend|mobile)"` in `frontend/src` = 0; `(frontend|mobile)` in `backend/{controllers,routes,utils,middlewares,models,config}` = 0; `(backend|frontend)` in `mobile/src` = 0. Each tier self-contained.
- **ARCH-1 (Medium):** `shared` workspace is **not actually shared** — only `mobile` consumes it. Problem: top-level `shared/` (10 TS type files, `shared/src/index.ts`) is presented as cross-cutting (CLAUDE.md: "`shared/` TS types @shared"), but only mobile imports it. Impact: type contracts (`profile.ts`, `match.ts`, etc.) drift silently from web/backend reality — no compile-time enforcement on 2 of 3 tiers; "shared" name misleads. Evidence: `grep -rn "@shared" mobile/src` = 82 hits; `frontend/src` = 0; `backend` = 0 (frontend is `.jsx`/JS, backend CommonJS — neither can import TS types). Fix: either rename to `mobile-types` to reflect reality, or generate JS/JSDoc validators from shared types so web+backend share contracts; accept as mobile-only and document.
- **ARCH-2 (Medium):** Three tracked lockfiles defeat workspace hoisting → version-drift / non-reproducible installs. Problem: root declares npm `workspaces: [backend,frontend,mobile,shared]` (hoist model) yet `backend/package-lock.json` + `frontend/package-lock.json` are git-tracked alongside root `package-lock.json`, with isolated nested `node_modules` (backend 9.8M, frontend 181M, mobile 34M). Impact: nested locks are stale (Mar 15) vs root lock (Jun 14) — `npm ci` resolution differs by cwd; bloated/duplicated installs. Evidence: `git ls-files backend/package-lock.json frontend/package-lock.json` both tracked; `du -sh */node_modules`. Fix: remove nested lockfiles + nested `node_modules`, install once from root, add `*/package-lock.json` to `.gitignore`.
- **ARCH-3 (Low):** `shared` workspace linkage is vestigial — no workspace declares `@tricityshadi/shared` as a dependency. Problem: `grep -l "tricityshadi/shared"` across all three `package.json` = none; mobile resolves `@shared/*` purely via tsconfig paths + metro alias. Impact: npm workspace symlink for `shared` is unused; package membership gives a false sense of dependency wiring. Evidence: `shared/package.json` name `@tricityshadi/shared`, not referenced as dep anywhere. Fix: either declare it as a real dependency where consumed, or drop it from `workspaces` and keep alias-only.
**Severity:** Medium (highest this item: ARCH-1, ARCH-2)

**Findings (Module Boundaries — 2026-06-15):**
- ✅ **Positive — tier direction respected.** No model→upper-tier leak (`grep "require.*\.\./\(controllers\|utils\)" models/*.js` = 0); no controller↔controller coupling (= 0). util→model coupling limited to infra utils only (`utils/notifyUser.js`, `utils/queue.js`) — acceptable.
- **ARCH-4 (Medium):** Split-brain boundary — 5 route files embed model access + business logic **inline in route handlers**, bypassing the controller layer that the other domains use. Problem: project convention is thin routes → controllers (11 controllers exist), but `routes/{guardian,astrologer,verification,marketing,admin}Routes.js` do CRUD/logic directly. Worst: `routes/guardianRoutes.js:22-231` — full `GuardianLink`/`Match`/`User` CRUD inline; `routes/verificationRoutes.js` is **half-and-half** (delegates `/status`,`/submit` to `verificationController` at lines 28/31, but inlines `/selfie` 42, `/bg-check/initiate` 80, `/verify-payment` 128, `/status` 190, `/webhook` 206). Impact: two coexisting conventions; inline handlers can't be unit-tested like exported controller fns, inconsistent error handling, logic hidden in routers. Evidence: `grep -ln "require.*\.\./models" routes/*.js` → guardian/astrologer/verification/marketing/admin; route file sizes 235/208/261/181/167 lines vs thin `matchRoutes.js` 57. Fix: extract inline handlers into `guardianController`/`astrologerController`/`marketingController` and finish moving `verificationController`; keep routes declarative.
- **ARCH-5 (Low-Medium):** Fat controllers — no service layer (by design) concentrates all logic in a few large files. Evidence: `wc -l controllers/*.js` → `adminController.js` 954, `profileController.js` 932, `authController.js` 741, `subscriptionController.js` 542 (5050 total / 11). Impact: review/maintenance burden, high-churn merge conflict surface. Fix (optional): split admin/profile controllers by sub-domain (users vs verifications vs marketing) or introduce light service helpers in `utils/`.

**Findings (Dependency Review — 2026-06-15):**
- **DEP-1 (Low):** Unused declared dependencies (dead weight in install graph). Evidence: `concat-stream` in `backend/package.json` appears only in package.json + package-lock (0 `require` across backend `*.js`); frontend `react-spring` + `react-swipeable` have 0 imports across all `frontend/**/*.{js,jsx,ts,tsx}`. Impact: needless install size + audit surface. Fix: `npm rm` the three (backend concat-stream; frontend react-spring, react-swipeable).
- **DEP-2 (Low-Medium):** `react-is@^19.2.7` pinned in `frontend/package.json` while `react`/`react-dom` are `^18.2.0` — a **React 19** package forced into an 18 tree, and 0 imports in `frontend/src`. Likely a manual pin to satisfy a recharts peer; risks a mixed-major react-is at runtime. Evidence: `frontend/package.json` deps; `grep react-is frontend` (excl. node_modules) = 0. Fix: drop the explicit `react-is` pin and let recharts resolve its own, or pin to `^18` to match React.
- **DEP-3 (Medium):** Cross-workspace version drift on shared libraries. Evidence (`*/package.json`): `axios` 1.6.2 (frontend) vs 1.17.0 (mobile); `socket.io-client` 4.6.1 (frontend) vs 4.8.3 (mobile) against backend `socket.io` server 4.6.1; `i18next` 26 (frontend) vs 23 (mobile); `react-i18next` 17 (frontend) vs 14 (mobile). Impact: web and mobile diverge in HTTP/socket/i18n behavior; same bug fixed twice or only once. socket.io stays compatible within v4 but the 4.6.1-server / 4.8.3-mobile-client skew should be verified before relying on newer client features. Fix: align axios + socket.io-client across web/mobile; treat i18next major gap as deliberate but document.
- **DEP-4 (Medium, cross-ref ARCH-2):** Stale nested lockfiles confirmed — root `package-lock.json` committed 2026-06-15, but `backend/package-lock.json` 2026-02-05 and `frontend/package-lock.json` 2026-01-15. `npm ci` run from a workspace dir resolves against a 4-month-old graph → non-reproducible installs. Reinforces REF-3.
**Severity:** Medium (highest: DEP-3, DEP-4)

> Note: `npm audit` (CVE scan) deferred to Phase 4 — Dependency Vulnerabilities, per OWASP checklist.

**Findings (Coupling / Circular Imports — 2026-06-15):**
- ✅ **Positive — no circular dependencies detected.** Backend layering holds: models loaded centrally via `models/index.js:2-20` (single registry, associations there); 0 controller↔controller requires; 0 util→controller upward leaks (re-verified). Frontend contexts are strictly one-way: `SocketContext.jsx:3` → `AuthContext`; `AuthContext.jsx:2` → `api/axios`; `api/axios.js:1` imports only `axios` (no context back-edge — refresh-queue is self-contained). No web cycle.
- **ARCH-6 (Low):** `utils/queue.js` defends against a *latent* cycle with function-scoped lazy `require`s (`./notifyUser` at lines 155/311, `./email` 87-121/469, `./fcm` 135/281) rather than top-level imports. Verified no hard cycle exists today — `fcm.js`/`socket.js`/`email.js` do not require `queue` or `notifyUser` back — so the pattern is defensive/lazy-load, not a fix for a real back-edge. Impact: low; only a readability/consistency cost (two import styles in one file) and the wiring is fragile. Evidence: `notifyUser` is a delicate **named** export guarded by a dedicated test `tests/unit/notifyUserImports.test.js` (would break if imported as default). Fix (optional): document the lazy-require intent inline, or hoist to top-level since no cycle blocks it.
**Severity:** Low

**Findings (Config & Env source-of-truth — 2026-06-15):**
- ✅ **Positive — central env module exists with prod guard.** `config/env.js` (346 lines) defines `isProduction`/`isDevelopment` (72-73), validates `JWT_SECRET` (129), and runs a production startup guard (`if (isProduction)` at 78 + 285). It already exports the values the rest of the app needs: `config.cloudinary.{cloudName,apiKey,apiSecret}` (181-184) + `isConfigured()` (186-189), `config.monitoring.alertEmails` (277), `isDevelopment/isProduction` (93-94).
- **ENV-1 (Medium):** The "sole env source" invariant (CLAUDE.md: *"never read process.env elsewhere"*) is violated — modules read `process.env` directly even though `env.js` already exposes the same values:
  - `config/cloudinary.js:5-7` reads `process.env.CLOUDINARY_{CLOUD_NAME,API_KEY,API_SECRET}` raw instead of `config.cloudinary.*`. **Worst case:** the Cloudinary SDK is configured from a different read path than `env.js`'s `isConfigured()` + startup log → they can silently disagree about whether Cloudinary is set.
  - `controllers/profileController.js:153,243,313` and `routes/verificationRoutes.js:57,166` branch on `process.env.NODE_ENV` instead of `config.isDevelopment`/`config.isProduction`.
  - `utils/alerts.js:487` reads `process.env.ALERT_EMAILS` despite `config.monitoring.alertEmails` (277).
  - `server.js:197,204` reads `ENABLE_SWAGGER` / `SWAGGER_TOKEN` — not modeled in `env.js` at all (uncentralized dev-only toggle).
  Impact: duplicated/uncentralized config reads escape `env.js` validation + prod guard; behavior can diverge from what the central module reports. Evidence: `grep -rn "process.env" backend --include=*.js` excl. node_modules/tests/env.js → 14 non-test hits across the files above. **Accepted/benign:** `npm_package_version` (healthCheck.js:225, monitoring.js:167 — Node built-in) and `seeders/adminSeeder.js:12,20,21` (standalone script run outside server).
  Fix: route cloudinary.js, profileController, verificationRoutes, alerts through `config`; add `swagger.{enabled,token}` to `env.js`.
**Severity:** Medium

**Findings (Technical Debt / dead files — 2026-06-15):**
- **DEBT-1 (Low):** `frontend/src/pages/Profile.jsx` **does not exist** (`ls` → No such file). It is listed as a deletable dead file in CLAUDE.md (Known Issues) and tracker REF-1 — already removed, references are stale. Fix: drop it from CLAUDE.md + REF-1.
- **DEBT-2 (Low):** `frontend/src/pages/Signup.jsx` confirmed dead — file exists (8399 B) but has **0 importers**; `App.jsx` routes `/signup` to an inline `SignupRedirect` (`App.jsx:4,127`), never this page. Safe to delete.
- **DEBT-3 (Low-Medium):** `backend/utils/emailService.js` (legacy duplicate of `email.js`) — CLAUDE.md/REF-2 claim *"only chatController uses it"*, but it now has **two** consumers: `chatController.js:9` (`sendMessageNotification`) and `matchController.js:11` (`sendMatchNotification`). Migration is **not** a clean delete: `email.js` exports `sendMatchNotification` (`email.js:395`) but has **no `sendMessageNotification`** (`module.exports` 411-421). Fix: port `sendMessageNotification` + its template into `email.js`, repoint both controllers to `email.js`, then delete `emailService.js`. (Updates REF-2.)
**Severity:** Low-Medium

---
**Phase 1 complete (2026-06-15).** All 6 items audited. Net: structure/layering/cycles healthy (positives logged); debt items ARCH-1..6, DEP-1..4, ENV-1, DEBT-1..3. Highest severity = Medium (ARCH-1/2/4, DEP-3/4, ENV-1).

---

## Phase 2 — Backend Review
Skill: `/code-review` · `/security-review`

- [x] API surface (`backend/routes/` 16 files; `/api/v1` + `/api` + `/api/marketing`)
- [x] Controllers (11) — fat-controller smell, error paths
- [x] Business logic utils (compatibility, numerology, profileCode, agoraToken, razorpay, queue)
- [x] Validation (`backend/validators/index.js` — coverage per route)
- [x] Error Handling (AppError, asyncHandler, errorHandler middleware)
- [x] Socket layer (`backend/socket/socketHandler.js`)
- [x] Webhooks (Razorpay, BG-check HMAC)

**Status:** ✅ Done (7/7 items — 2026-06-15)
**Findings (API surface — 2026-06-15):**
- ✅ **Positive — auth + limiter + validation discipline is consistent.** Discovery routers gate globally (`searchRoutes.js:16` `router.use(auth)`; `matchRoutes.js:21`; `chatRoutes.js:27` `router.use(auth, requirePremium)`); sensitive routes attach a dedicated limiter + validator + `handleValidationErrors` (auth/payment/search/match/upload). Param IDs validated as UUIDv4 (`notificationRoutes.js:21`, `blockReportRoutes.js:13`, `subscriptionRoutes.js:109`). Webhook HMAC is timing-safe with length guard (`subscriptionRoutes.js:60-71`).
- **BE-1 (Medium):** **Entire API double-mounted** at `/api/v1` and `/api` (`server.js:186-187`). Every endpoint has two live URLs → doubled attack/limiter surface, ambiguous canonical path, and forces every cross-cutting concern (raw-body, limiter) to be registered twice or drift (see BE-2/BE-4). Impact: callers can hit either path; security middleware keyed to one path silently misses the other. Evidence: `app.use('/api/v1', routes); app.use('/api', routes);`. Fix: pick `/api/v1` as canonical; if legacy `/api` must stay, 301-redirect or thin-alias it rather than re-running the full stack twice.
- **BE-2 (Medium):** **Webhook raw-body capture is asymmetric vs the double-mount → broken HMAC on legacy path.** `server.js:103-104` captures rawBody for BOTH `/api/v1/subscription/webhook` and `/api/subscription/webhook`, but `server.js:105` captures bg-check webhook ONLY for `/api/v1/verification/bg-check/webhook`. Since the router is also mounted at `/api`, `POST /api/verification/bg-check/webhook` reaches the handler with no `req.rawBody`; it then falls back to `Buffer.from(JSON.stringify(req.body))` (`verificationRoutes.js:213`) which ≠ raw bytes → `verifyBgCheckWebhook` signature check fails for a legitimately-signed call. Impact: provider configured against the non-versioned URL silently rejects all callbacks. Evidence: `server.js:103-105`, `verificationRoutes.js:213-218`. Fix: add `/api/verification/bg-check/webhook` to `rawBodyCapture`, or drop the `/api` mount (BE-1).
- **BE-3 (Low-Medium):** **Path-based auth exemption is fragile.** `verificationRoutes.js:22-25` runs `auth` for the whole router EXCEPT `if (req.path === '/bg-check/webhook') return next();` — an unauthenticated hole punched into an otherwise-protected router by exact string match. Impact: brittle (any future path normalization / trailing slash / re-mount shifts the exemption); the public webhook should live on its own no-auth sub-router (as block/report split routers) instead of a conditional skip. The endpoint is still HMAC-gated, so not currently exploitable. Evidence: `verificationRoutes.js:22-25`. Fix: extract the webhook to a standalone router mounted before the auth-guarded one.
- **BE-4 (Low-Medium):** **Unauthenticated monitoring health endpoints, double-mounted, outside rate limiting.** `server.js:182-183` mounts `monitoringRoutes` at `/monitoring` AND `/api/monitoring`; `routes/monitoring.js:49-100` exposes `/health`, `/health/live`, `/health/ready`, `/health/full` with no auth (metrics/info/debug ARE admin-gated, `:135-287`). `/health/full` & `/health/ready` disclose DB/Redis dependency status. apiLimiter is bound to `/api` only (`server.js:164`), so the `/monitoring/*` mount has no rate limit at all. Impact: infra-status info disclosure + unthrottled health probes. Evidence: `server.js:164,182-183`, `routes/monitoring.js:80,100`. Fix: keep only `/api/monitoring` (or apply limiter to `/monitoring`); restrict `/health/full` detail or gate it.
- **BE-5 (Low, cross-ref Phase 4):** **Razorpay order creation without a payment limiter.** `POST /verification/bg-check/initiate` (`verificationRoutes.js:80`) calls `createGenericOrder` with NO rate limiter, whereas `subscription/create-order` is guarded by `paymentLimiter` 10/hr (`subscriptionRoutes.js:82-88`). Impact: order-creation spam / provider quota abuse. Evidence: `verificationRoutes.js:80-125` (no limiter in chain). Fix: attach `paymentLimiter` to bg-check initiate.
- ⚪ **Note (Low):** Duplicate route alias — `chatRoutes.js:44` `POST /messages` and `:53` `POST /send` map to the same `sendMessage` (frontend-compat). Harmless but two public spellings of one action; consolidate when web client is updated.
**Severity:** Medium (highest: BE-1, BE-2)

**Findings (Controllers — 2026-06-15):**
- ✅ **Positive — error-path discipline is strong.** `asyncHandler` wraps virtually every handler (adminController 26, profileController 17, authController 16; only verificationController inline routes are the exception — see ARCH-4); errors thrown via `AppError`/`createError` not ad-hoc `res.status(500)` (0 manual 500s in controllers). Critical multi-write paths are transactional: signup (`authController.js:114`), Google sign-up (`:697`), subscription create/verify/cancel (`subscriptionController.js:36,116,352`). Best-effort side-effects (reset email `authController.js:413`, match email `matchController.js:131-134`, refund `subscriptionController.js:529`, Cloudinary delete `profileController.js:344`) are intentionally swallowed **with** `log.error` — correct. Debug `console.log`s are all `NODE_ENV==='development'`-gated (`profileController.js:153,243,312`) → no prod stdout leak.
- **CTRL-1 (Medium, logic bug):** **Incognito check reads the wrong user → inverted privacy semantics + wasteful create-then-destroy.** In `getProfile`, the viewer's visit is written (`profileController.js:463-464` `ProfileView.create({viewerId, viewedUserId:userId})`), then immediately deleted if `profile.incognitoMode` is true (`:490-494`). But `profile` is the **target** (viewed) user; the viewer's own profile is `viewerProfile` (`:470`). Incognito is a *viewer's* "browse privately" choice — the gate must read `viewerProfile.incognitoMode`, not the target's. As written: a user who turns on incognito stops appearing in *their own* viewers list (nonsense), while a true incognito browser is still recorded. Plus the create→destroy round-trip is two writes + a race where the target briefly sees the view. Evidence: `profileController.js:463-464,470,487-494`; comment at `:487-488` admits the awkwardness. Fix: check `viewerProfile.incognitoMode` and **skip the create** rather than create-then-destroy.
- **CTRL-2 (Low):** **Over-broad dedup catch swallows real DB errors.** `profileController.js:465` `catch (err) { // Ignore duplicate errors }` discards *every* error from `ProfileView.create`, not just unique-constraint violations — an FK error, validation error, or DB outage is silently lost (and the empty catch has no log, unlike every other swallow in the file). Evidence: `profileController.js:463-467`. Fix: catch and rethrow unless `err.name === 'SequelizeUniqueConstraintError'`; at minimum `log.warn`.
- ⚪ **Reaffirms ARCH-5 (fat controllers):** adminController 954 / profileController 932 / authController 741 lines — error handling is clean but the size remains a maintenance/merge-conflict surface; split recommendation stands (REF-7).
**Severity:** Medium (highest: CTRL-1)

**Findings (Business logic utils — 2026-06-15):**
- ✅ **Positive — utils are pure, deterministic and fail-safe.** `numerology.js` is side-effect-free with correct master-number (11/22/33) preservation in `reduceToCore` (`:11-17`) and DOB validity guard (`:36-38`). `agoraToken.js:16-19` returns `null` (dev stub) when unconfigured instead of throwing. `razorpay.js:8-28` lazily constructs the SDK and **placeholder-guards** (`!keyId.includes('xxxxxxxx')`, `keyId.startsWith('rzp_')`) so it won't init with dummy keys. `profileCode.parseProfileCode` validates against `^[0-9a-f]{8}$` (`profileCode.js:12,30`) so no LIKE-metacharacter reaches the query. `queue.js` cron schedules are valid with bounded retention (`removeOnComplete:100/removeOnFail:500`) + `attempts:3` exp-backoff (`:35-38`).
- **UTIL-1 (Medium, security — cross-ref Phase 4):** **Payment signature compared non-timing-safe.** `razorpay.js:121` `verifyPayment` returns `expectedSignature === razorpaySignature` — a plain string `===` on an HMAC. This is the **client-facing** verify used by `subscription/verify-payment` AND `bg-check/verify-payment` (`verificationRoutes.js:140`). Inconsistent with the webhook path, which correctly uses `crypto.timingSafeEqual` + length guard (`subscriptionRoutes.js:65-67`). Impact: timing side-channel on payment-confirmation signatures. Evidence: `razorpay.js:110-122`. Fix: `crypto.timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(sig,'hex'))` behind a length check, mirroring the webhook.
- **UTIL-2 (Low, cross-ref Phase 3/7):** **`by-code` lookup is an unindexed full scan + silent collision pick.** `searchController.js:484` matches `LOWER(CAST("userId" AS text)) LIKE '<prefix>-%'` — the function-wrapped cast defeats the PK/btree index → seq-scan of `Profiles` per call (throttled only by `searchLimiter` 30/min). And `findOne` returns an **arbitrary** row if two UUIDs share the first 8 hex, despite `profileCode.js:8` advertising "collision-safe" (never enforced). Evidence: `searchController.js:480-489`, `profileCode.js:6-8`. Fix: range-scan on the indexed UUID (`userId >= lo AND userId < hi`) or add a functional index, and assert single-match.
- ⚪ **Cross-ref CTRL-1 (incognito semantics muddled):** `searchController.js:69` also **excludes** incognito users from all search results (`incognitoMode: {[Op.ne]: true}`) — i.e. incognito = "hidden from search," which conflicts with the viewer-side "browse privately" intent assumed in CTRL-1. The product meaning of `incognitoMode` is implemented two different ways; reconcile in Phase 9.
**Severity:** Medium (highest: UTIL-1)

**Findings (Validation — 2026-06-15):**
- ✅ **Positive — strong validation where it counts; no mass-assignment.** `updateProfile` builds `updateData` from an explicit `PROFILE_UPDATABLE_FIELDS` allowlist and NEVER spreads `req.body` (`profileController.js:164-178,191-192`) — mass-assignment closed. Auth/payment/search/match all carry dedicated schemas + `handleValidationErrors` (signup/login/reset/refresh/createOrder/verifyPayment/search/matchAction). Handlers without a schema still validate inline robustly: `updatePrivacySettings` whitelists enum + type-checks booleans (`profileController.js:769-777`); `registerFcmToken` checks type+length and caps to 10 tokens (`notificationController.js:96-105`). `paginationRules` is shared (`validators/index.js:24`, exported `:502`).
- **VAL-1 (Medium, abuse — cross-ref Phase 4):** **`send-otp`/`verify-otp` have no format validation → email path is an open relay vector.** `authRoutes.js:90-91` attach only `otpLimiter` (no validator). `sendOtp` (`authController.js:622-645`) takes `target` from body and, for `type==='email'`, sends a server-generated code to **any attacker-supplied address** with zero email-format/ownership check — usable to mail-bomb arbitrary recipients via your SES/SMTP reputation (throttled only by `otpLimiter` 10/10min). Phone path passes `target` to `smsService` which merely strips non-digits (`smsService.js:29,75`) — no E.164/length validation, so garbage numbers hit the provider. `verifyOtp` also doesn't constrain `code` to 6 digits and reflects `type` into the message. Evidence: `authController.js:622-657`, `smsService.js:29,75`. Fix: add express-validator (`isEmail` / `isMobilePhone('en-IN')`, `code` `isLength(6).isNumeric()`, `type` `isIn`) to both OTP routes.
- **VAL-2 (Low, cross-ref ARCH-4):** **Inline-route validation gap.** The five controller-bypassing routers (guardian/astrologer/marketing/admin + bg-check handlers) accept request bodies with **no express-validator schemas** — validation is ad-hoc inside handlers, inconsistent with the declarative `validators/index.js` convention used elsewhere (e.g. guardian invite, astrologer book, bg-check `consent`). Evidence: `routes/{guardian,astrologer,marketing}Routes.js` import models not validators; `validators/index.js` exports nothing for these domains. Fix: add schemas as part of the ARCH-4 controller extraction (REF-6).
**Severity:** Medium (highest: VAL-1)

**Findings (Error Handling — 2026-06-15):**
- ✅ **Positive — error pipeline is well-structured and prod-safe.** `AppError` (operational flag + statusCode/code/details) + `createError` factory (`errorHandler.js:11-45`); `asyncHandler` correctly funnels promise rejections to `next` (`:219-221`); wiring order correct — `notFoundHandler` then `errorHandler` last, after all route mounts (`server.js:271,274`). Dedicated mappers normalize Sequelize/JWT/Multer/body-parser(`entity.parse.failed`/`too.large`)/Cloudinary errors into AppError (`:144-182`). Prod hardening verified: stack trace dev-only (`:205`), validation `details` dev-only (`:200`), non-operational messages sanitized to generic in prod (`:48-54`). `req.id` is genuinely populated (`security.js:379` `requestId` mounted `server.js:70`), so error logs carry a real correlation id. Inline controller-bypass routers (ARCH-4) DO wrap their async handlers in `asyncHandler` (guardian/astrologer 8 each, verification/marketing 6, admin 2 — counts ≥ async handler count), so rejected promises there are still caught — no hung requests.
- **ERR-1 (Medium, observability):** **errorHandler bypasses the project's structured logger.** `logError` calls raw `console.error`/`console.warn` with `JSON.stringify(errorLog, null, 2)` (`errorHandler.js:75,77`) — **multi-line pretty-printed** JSON — instead of `middlewares/logger.js`, which exports `log`/`logError` emitting **single-line** `JSON.stringify(entry)` (`logger.js:43,226`). Impact: every server error is emitted as a multi-line blob → line-based log aggregators (Loki/CloudWatch/Docker json-file) parse each line as a separate record, fragmenting the error; also skips the logger's leveling/format. CLAUDE.md advertises a JSON logger — this path diverges from it. Evidence: `errorHandler.js:57-79` vs `logger.js:43,222-226`. Fix: route through `require('./logger').logError`/`.log`; drop the `null, 2` pretty-print.
- **ERR-2 (Low):** **`let error = { ...err }` shallow-spreads an Error → prototype + non-enumerable props lost.** `errorHandler.js:139` spreads the caught error into a plain object; `Error.message`/`.stack`/`.name` are non-enumerable, so they vanish — `message`/`stack` are re-added manually (`:140-141`) but `name` and any non-enumerable custom fields are dropped, and the result is no longer an `Error`/`AppError` instance. For errors not matched by a specific handler the pipeline then works only by duck-typing. Evidence: `errorHandler.js:139-141`. Fix: operate on `err` directly, or reassign the matched AppError to a fresh var without the spread.
- **ERR-3 (Low):** **Over-broad Cloudinary classification.** `errorHandler.js:171` remaps **any** error whose lowercased message merely `includes('cloudinary')` to a 502 `SERVICE_UNAVAILABLE`, masking unrelated bugs (e.g. a validation/app error that happens to mention a cloudinary URL gets hidden behind "Image upload temporarily unavailable"). Evidence: `errorHandler.js:170-182`. Fix: gate on the SDK's `err.http_code`/`err.name`, not a substring.
- **ERR-4 (Low):** **Inconsistent fatal-error policy.** `uncaughtException` triggers `gracefulShutdown` (`server.js:411-414`) but `unhandledRejection` only logs and **keeps the process running** (`server.js:417-425`), leaving it in a possibly-corrupt state after an unhandled rejection. The keep-alive exists to swallow multer-cloudinary rejections — but that also masks genuine rejections. Evidence: `server.js:411-425`. Fix: shut down (or restart) on both, or narrowly swallow only the known Cloudinary rejection and re-throw/shutdown otherwise.
**Severity:** Medium (highest: ERR-1)

**Findings (Socket layer — 2026-06-15):**
- ✅ **Positive — 1:1 chat path is well-guarded.** `io.use(authenticateSocket)` gates every connection; JWT verified + `type==='access'` enforced + `logSecurityEvent` on every failure (`socketHandler.js:90-115`); token read from httpOnly cookie first (`:66-87`). `join-room` enforces **mutual match AND active premium** before joining (`:200-218`). `send-message` is anti-spoof: it re-loads the message from DB and rejects unless `dbMessage.senderId === userId`, logging `socket_message_spoofing` (`:266-274`) — socket only broadcasts, REST creates (correct trust model). Per-event rate limits with periodic cleanup + per-socket cleanup on disconnect (`:17-63,404-415`). `get-online-status` caps at 50 ids and type-checks (`:393-398`).
- **SOCK-1 (High, broken authorization — IDOR):** **Family-group chat has ZERO authorization, and the enforcement it claims to rely on does not exist.** `join-group` (`socketHandler.js:351-360`) joins `group_<groupId>` for ANY authenticated user with the comment *"Membership enforcement is handled at REST API level (POST /chat/groups/:id/join)"* — but **that endpoint does not exist** (`grep "groups" routes/` = 0) and there is **no Group/GroupMember model at all** (`ls models/ | grep group` = 0). So any authenticated user can `emit('join-group',{groupId})` for any id and receive every `group-message-received` broadcast (`:367-380`). Impact: full read access to any family group's messages by guessing/knowing a groupId; the feature has no server-side membership concept whatsoever. Evidence: `socketHandler.js:351-360,367-380`; absent model + route. Fix: add a Group/GroupMember model + membership check in `join-group` and `group-send-message` (mirror `join-room`'s gate), or disable the group events until the backend feature is built.
- **SOCK-2 (Medium, message forgery):** **`group-send-message` performs NO ownership/persistence check** — unlike `send-message`. It broadcasts the client-supplied `message` object verbatim to the group (`socketHandler.js:367-380`) with only `message.id` presence checked. Combined with SOCK-1, any user can inject arbitrary/forged messages (any `id`, any embedded sender identity) into any group. Evidence: `socketHandler.js:367-380` vs the `dbMessage.senderId===userId` guard at `:266-274`. Fix: load the message, verify it exists and `senderId===userId` and that the user is a group member, before relaying.
- **SOCK-3 (Low-Medium, griefing):** **`message-deleted` broadcasts with no ownership check.** `socketHandler.js:330-347` accepts client `roomId`/`messageId`/`receiverId` and emits a deletion to the room with a comment admitting *"can't verify ownership since the message is deleted."* A user already in a room can emit `message-deleted` for **any** `messageId` → the partner's UI removes that message (client-side spoof/griefing). Scope limited by `join-room`'s mutual+premium gate. Evidence: `socketHandler.js:330-347`. Fix: have the REST delete emit the socket event server-side (authoritative), instead of trusting a client `message-deleted` event.
- **SOCK-4 (Medium, scale — cross-ref Deploy):** **No socket.io Redis adapter → single-process only.** Rate-limit state is an in-process `Map` (`socketHandler.js:14`) and online-status is read from `io.sockets.adapter.rooms` (local memory, `:396`); no `io.adapter(createAdapter(...))` is wired (`grep createAdapter/io.adapter` = 0). Impact: under `docker-compose --scale` / multi-instance prod, (a) socket rate limits are per-node → bypass by reconnecting to another node, and (b) online-status and room broadcasts only see locally-connected sockets → users on different nodes appear offline and miss cross-node messages. Evidence: `socketHandler.js:14,396`; no adapter in `initializeSocket`. Fix: add `@socket.io/redis-adapter` + a shared rate-limit store before horizontal scaling.
- **SOCK-5 (Low, dead code + divergent "premium" definition):** **`checkSubscription` (`socketHandler.js:119-137`) is defined but never called** (`grep` = 1 def, 0 calls); `join-room` instead inlines a *different* query (`planType:{[Op.ne]:'free'}`, `endDate:{[Op.gt]:now}` — no null-endDate allowance) at `:207-214`, while `checkSubscription` uses an explicit plan `[Op.in]` enum and **allows `endDate:null`**. Two definitions of "premium" that disagree on lifetime/null-end subscriptions. Evidence: `:119-137` vs `:207-214`. Fix: call `checkSubscription` in `join-room`; delete the duplicate.
- **SOCK-6 (Low, spoofed typing):** `typing` (`socketHandler.js:288-301`) does not verify the receiver is a mutual match — it computes the deterministic `getRoomId` and `socket.to(room).emit('user_typing')`. A user can push fake typing indicators to any user by computing the (sorted-join) room id. Low griefing. Evidence: `:288-301,158-160`. Fix: gate on mutual match or restrict to rooms the socket has actually joined.
**Severity:** High (highest: SOCK-1 — group chat has no authorization and references a non-existent REST/model)

**Findings (Webhooks — 2026-06-15):**
- ✅ **Positive — Razorpay webhook is hardened.** `subscriptionRoutes.js:38-74`: missing secret → 200 ack (avoids retry storm) + WARN log; missing signature → 401; absent `rawBody` → 500 with diagnostic; HMAC compared **timing-safe with a length guard** (forces an empty buffer on length mismatch so `timingSafeEqual` can't throw, `:65-67`). The controller is **idempotent + race-safe**: transaction + active-subscription short-circuit + `lock:true` row lock on the pending row + unknown-planType guard + `logAudit` (`subscriptionController.js:352-403`). BG-check webhook is also idempotent (already-`passed`/`failed` short-circuit `:237-239`), 200s on unknown providerRef to stop retries (`:232-235`), 400s on unparseable payload (`:223-226`), and notifies the user.
- **WH-1 (High, security — fail-open):** **BG-check signature verification fails OPEN when the secret is unset, with no production guard.** `verifyBgCheckWebhook` returns `true` if `config.bgCheck.webhookSecret` is missing (`bgCheckService.js:202-206`) — logged as "dev only" but **never enforced**: `config/env.js`'s prod `process.exit(1)` guard covers JWT/COOKIE/DB/FRONTEND_URL but **not** `BG_CHECK_WEBHOOK_SECRET`. If a prod deploy omits the secret, `POST /verification/bg-check/webhook` accepts **any unsigned payload** → an attacker forges `{providerRef, status:'passed'}` to self-grant the **Background Verified** badge (a trust signal shown to other users). Evidence: `bgCheckService.js:202-206`; absent from the env prod guard. Fix: in production, fail closed (return `false`, or `process.exit(1)` at startup when the provider is enabled but the secret is unset).
- **WH-2 (Medium, reaffirms BE-2):** **BG-check webhook raw body not captured on the legacy `/api` mount → HMAC fails for a legitimately-signed call.** `server.js:105` captures rawBody only for `/api/v1/verification/bg-check/webhook`, but the router is double-mounted (BE-1), so `POST /api/verification/bg-check/webhook` arrives with no `req.rawBody` and falls back to `Buffer.from(JSON.stringify(req.body))` (`verificationRoutes.js:213`), which ≠ the provider's exact raw bytes (key order/whitespace differ) → signature mismatch → 401 on a valid callback. Evidence: `server.js:103-105`, `verificationRoutes.js:213`. Fix: capture rawBody for the `/api` path too, or drop the legacy mount (BE-1). The re-serialize fallback should be removed entirely (it can never produce a valid signature).
- **WH-3 (Low-Medium):** **BG-check adapter HMAC compare has no length guard → `RangeError` instead of clean 401.** `authBridgeVerifyWebhook` (`bgCheckService.js:94-98`) and `signzyVerifyWebhook` (`:147-150`) call `crypto.timingSafeEqual(expected, sig)` directly; if an attacker sends a signature of different byte length, `timingSafeEqual` throws `RangeError` → bubbles to a 500 rather than a deterministic 401 (the Razorpay path guards against this, `subscriptionRoutes.js:65-67`). Not a bypass (throw still denies) but inconsistent + noisy. Evidence: `bgCheckService.js:94-98,147-150`. Fix: guard `expected.length === sig.length` (and validate hex) before `timingSafeEqual`, return `false` otherwise.
- **WH-4 (Low):** **Signature header not bound to the configured provider.** The webhook accepts `x-authbridge-signature || x-signzy-signature || x-signature` (`verificationRoutes.js:207-211`) but verifies with whichever single adapter `config.bgCheck.provider` selects. A request can present any of the three headers and still be checked against the configured provider's HMAC — header source isn't validated against the active provider. Harmless while the shared secret holds, but loosens the contract. Evidence: `verificationRoutes.js:207-211` + `getAdapter()`. Fix: read only the header matching the configured provider.
- ⚪ **Note:** Razorpay webhook handles only `payment.captured`; other events are silently 200-acked — acceptable (verify-payment REST is the primary path; webhook is the fallback).
**Severity:** High (highest: WH-1 — bg-check fail-open self-grants Background Verified badge if secret unset in prod)

---
**Phase 2 complete (2026-06-15).** All 7 items audited. Net: backend discipline strong (asyncHandler/AppError, validation allowlists, timing-safe Razorpay webhook, idempotent payment activation). Highest-severity findings: **SOCK-1 (High)** group-chat zero authz + **WH-1 (High)** bg-check webhook fail-open. Mediums: BE-1/2, CTRL-1, UTIL-1, VAL-1, ERR-1, SOCK-2/4, WH-2.

---

## Phase 3 — Database Review
Skill: `/health` · manual SQL

- [x] Schema (19 models in `backend/models/`)
- [x] Indexes (esp. search filters, ProfileView, Match)
- [x] Relationships / FK integrity / cascade rules
- [x] Migrations (000001–000037 in `backend/migrations/`)
- [x] ⚠️ Known drift: `Profile.quizAnswers` JSONB has NO migration (ALTER manual) — **RESOLVED: claim is FALSE, migration 000028 adds it** (see DB-1)
- [x] N+1 / query patterns (cross-ref Phase 7)

**Status:** ✅ Done (6/6 items — 2026-06-15)
**Findings (Schema + Relationships/FK — 2026-06-15):**
- ✅ **Positive — referential integrity is solid; user deletion won't orphan.** Every child table that references `Users` cascades on delete at the **migration** level (the authoritative layer): matches/messages/profile-views/blocks/reports/contact-unlocks/notifications/refresh-tokens/call-sessions/guardian-links/marketing-leads/astrologer-bookings all `onDelete: 'CASCADE'` (`grep onDelete migrations/*create*.js` → every FK except admin back-refs). Intentional non-cascade refs: `Verifications.verifiedBy` (admin), `Reports.reviewedBy` (admin), `MarketingLeads.convertedUserId` — deleting an admin/converted user must NOT delete the verification/report/lead. `create-users/astrologers/success-stories` have 0 FKs (correct — roots/standalone). So `DELETE /auth/account` won't leave orphan rows. Integrity guards: `Match`/`Message` `beforeCreate` reject self-pairs (`Match.js:44-48`, `Message.js:56-60`); `Match` unique `(userId,matchedUserId)` (`Match.js:51-54`); `ProfileView` unique `(viewerId,viewedUserId)` via `idx_profile_views_viewer_viewed_unique` (`migration 000012:28`) backs the CTRL-2 dedup catch.
- **DB-1 (Medium, doc/ops drift — RESOLVES known issue):** **The repeatedly-documented "`quizAnswers` has NO migration, ALTER manually" claim is FALSE.** Migration `000028-add-quiz-answers-voice-intro.js:7-12` adds `quizAnswers` JSONB (guarded by `describeTable` so re-run-safe), alongside `voiceIntroUrl`. Yet CLAUDE.md (Migrations section + Known Issues 🟡 + Audit History R2) and this tracker's Phase 3 header all instruct an operator to run `ALTER TABLE "Profiles" ADD COLUMN "quizAnswers" JSONB` manually. Impact: stale operational guidance — an operator may skip `npm run migrate` believing a manual ALTER is required (leaving 000028 unrun → `voiceIntroUrl`, and migration-tracking row, also missing), or run a manual ALTER that then makes 000028's `describeTable` guard skip silently (benign but confusing). Evidence: `migrations/20240101000028-add-quiz-answers-voice-intro.js:7-19`; contradicting `CLAUDE.md` Known Issues + Migrations. Fix: delete the "no migration / ALTER manually" notes from CLAUDE.md (Migrations + Known Issues + R2 history) and this tracker.
- ✅ **Positive — schema/migration column parity otherwise complete.** All Profile model columns trace to a migration: enhanced fields → 000008, horoscope/manglik → 000013, privacy → 000014, quiz/voice → 000028, videoIntro → 000037. No other undocumented model↔migration column gap found.

**Findings (Indexes — 2026-06-15):**
- **DB-2 (Medium, dev/prod index parity):** **Model-declared `indexes:[]` arrays are dead on any migrate-built database.** `server.js:286` runs `sequelize.sync({ alter: false })`, which only creates *missing tables* — it never adds indexes to a table that already exists (and in prod every table is created by `migrate`, not sync). So the index arrays in `Profile.js:307-316`, `Match.js:50-59`, `Message.js:62-69`, `ProfileView.js:27-31`, `SuccessStory.js:49-51` are **only** materialized if a table is first created by `sync` on a blank dev DB. Concrete divergence: `Profile.js:313` declares composite `(isActive, gender, city)`, but **no migration creates it** — the live search index is migration 000034's `(gender, isActive, createdAt)` instead. Impact: false belief that a `(isActive,gender,city)` index backs search; dev (sync-built) and prod (migrate-built) carry different index sets → "works in dev" query plans that regress in prod. Evidence: `server.js:286`; `Profile.js:307-316` vs `migrations/000012,000034`. Fix: treat migrations as the sole index source; drop or sync the model `indexes` arrays into migrations to end the dual source of truth.
- **DB-3 (Low-Medium, redundant index = write amplification):** **Duplicate index on the hot `Messages` table.** Migration `000012:41` creates `idx_messages_sender_receiver_created` on `(senderId, receiverId, createdAt)`; migration `000025:6-9` then creates `messages_sender_receiver_created_at` on the **same three columns** — its comment "not in any prior migration" is incorrect. Two identical btrees double the write/maintenance cost and storage on the highest-churn table. Evidence: `migrations/000012:41` vs `migrations/000025:6-9`. Fix: drop one (keep the named `messages_sender_receiver_created_at` or the 000012 one) in a new migration.
- **DB-4 (Medium, perf — cross-ref Phase 7):** **Competitive-R1 search filters run unindexed → seq scans on `Profiles`.** `searchController.js` filters on columns with NO index: `income` range (`:159-162`, `Op.gte/lte`), `height` range (`:103-105`), `manglikStatus` equality/in (`:175-183`), and `interestTags` (`:131-132`, `Op.overlap` — needs a **GIN** index, none exists; the migration grep for `gin` matched only substrings). Indexed filters are fine: dateOfBirth/maritalStatus/education/diet + `LOWER(religion)`/`LOWER(motherTongue)` (migration 000034). `city`/`profession`/`caste` use `Op.iLike '%...%'` (leading wildcard — un-indexable by btree regardless). Impact: each filtered search seq-scans Profiles (throttled only by `searchLimiter` 30/min); degrades as the table grows. Evidence: `searchController.js:103-105,131-132,159-162,175-183`; `migrations/000034` (these columns absent). Fix: add btree indexes on `income`, `height`, `manglikStatus`; add a GIN index on `interestTags` for `Op.overlap`; consider `pg_trgm` GIN for the iLike columns if those filters stay hot.
- ⚪ **Cross-ref UTIL-2 (Phase 2):** `by-code` lookup `LOWER(CAST("userId" AS text)) LIKE '<prefix>-%'` (`searchController.js:484`) is an unindexed functional seq-scan — already logged; fix via indexed UUID range (REF-17).

**Findings (Migrations — 2026-06-15):**
- ✅ **Positive — migrations are sequential, idempotent and reversible.** 37 files `000001`→`000037`, all `20240101`-prefixed and ordered by numeric suffix. Re-run-safe patterns throughout: `CREATE INDEX IF NOT EXISTS` (000012/000034), `describeTable` column guards (000028), `ADD COLUMN IF NOT EXISTS` + `DO $$ … EXCEPTION WHEN duplicate_object` enum guards (000013). Every `up` has a matching `down`. No destructive data ops except the intentional dedup `DELETE` before the unique ProfileView index (000012:20-27).
**Severity:** Medium (highest: DB-1, DB-2, DB-4)

---
**Phase 3 complete (2026-06-15).** All 6 items audited. Net: **FK/referential integrity is solid** (full cascade on user delete, no orphans; positives logged) and migrations are idempotent/reversible. Debt: DB-1 (quizAnswers "no migration" claim is false — doc fix), DB-2 (model `indexes:[]` dead under `sync({alter:false})` → dev/prod parity drift), DB-3 (duplicate Messages index), DB-4 (income/height/manglik/interestTags search filters unindexed). Highest severity = Medium.

---

## Phase 4 — Security Review (OWASP)
Skill: `/security-review` · `/cso`

- [x] Authentication (JWT httpOnly access 15m + refresh 7d hashed, rotation + family revoke)
- [x] Authorization (adminAuth, requirePremium/VIP, role gates)
- [x] IDOR (profile `:id`, match `:id`, chat, admin resources)
- [x] Session Management (lockout 5/30min Redis, logout-all)
- [x] JWT Security (secret strength, prod guard in `config/env.js`)
- [x] Input Validation / sanitization (express-validator + sanitize middleware)
- [x] SQL / NoSQL Injection (Sequelize param usage, raw queries)
- [x] XSS (stored/reflected; profile bio, messages)
- [x] CSRF (cookie auth + SameSite + CORS)
- [x] SSRF (Cloudinary/webhook/outbound fetches)
- [x] File Upload Security (Multer magic-byte, size caps, voice/video MP4)
- [x] Secrets Exposure (grep repo for keys; `.env*` not committed)
- [x] Rate Limiting (9 limiters — coverage per sensitive route)
- [x] CORS config (hardened 2026-03-12 — re-verify)
- [x] Webhook signature (timing-safe HMAC, raw body) — cross-ref Phase 2 WH-1..4

**Status:** ✅ Done (15/15 items — 2026-06-15)

**Findings (Authentication / JWT / Session — 2026-06-15):**
- ✅ **Positive — token lifecycle is strong.** Access JWT carries `type:'access'` and is re-checked on every request (`auth.js:51`); user re-loaded + `status==='active'` enforced (`auth.js:64`). Refresh tokens are **hashed at rest** (`RefreshToken.hashToken`, `authController.js:45,272`), **rotated** on every use (old `revoke('rotated')` then new issued, `:296-305`), and **reuse triggers family revoke** with a `token_reuse_detected` security log (`:278-282`) — textbook rotation+family-revoke. `logout-all` revokes all user tokens (`:350`). JWT secret prod-guarded: ≥32 chars + placeholder rejection (`env.js:80,83`) + startup validation refusing `dev-secret` (`env.js:289`); `COOKIE_SECRET` likewise (`env.js:294-297`). Account lockout is **Redis-backed** (survives restart / multi-process) with in-mem fallback, IP-keyed, 5 attempts / 30 min (`security.js:325-367`). bcrypt rounds 12.
- **SEC-1 (Medium):** **Access JWT accepted as a URL query parameter on every REST route.** `extractToken` falls back to `req.query.token` (`auth.js:29-31`) and is used by the main `auth` middleware (`auth.js:41`), not just the socket handshake — so `GET /api/v1/profile/me?token=<JWT>` authenticates. Tokens in URLs leak into nginx/access logs, proxy logs, browser history, and the `Referer` header sent to third-party origins (Cloudinary images, Razorpay). Impact: short-lived (15 m) but a logged access token is replayable until expiry. Evidence: `auth.js:16-34,41`. Fix: read the query token **only** in the socket auth path (`socketAuth` already reads `handshake.auth.token`), and drop the `req.query.token` branch from the REST `extractToken`.

**Findings (Authorization / IDOR — 2026-06-15):**
- ✅ **Positive — resource access is gated where it matters.** Chat is mutual-match-gated server-side: `getMessages`/`sendMessage` call `verifyMutualMatch` before returning or writing (`chatController.js:199-202,272-276`), independent of the socket layer. Discovery/match/chat routers apply `auth` (+`requirePremium` for chat) globally (confirmed Phase 2). `getProfile` applies privacy: incognito + `photoBlurUntilMatch` honored vs non-mutual viewers (`profileController.js:490-497`), block-list excluded (`:712`). Admin/marketing gated by role middleware (`auth.js:119-147`), super_admin+admin only.
- **SEC-3 (Low):** **The centralized IDOR guard `ownsResource` is dead code.** Defined + exported (`auth.js:249-259`) but **0 usages** across routes/controllers (`grep` = 0). Ownership is instead enforced ad-hoc inside each controller — which works today but means the one reusable, auditable guard is unused, so a new route author has no enforced pattern to reach for. Evidence: `auth.js:249`; `grep ownsResource routes/ controllers/` = 0. Fix: either adopt `ownsResource` on `:id` resource routes (profile photo delete, etc.) or delete it to avoid false assurance.
- ⚪ **Cross-ref SOCK-1/2/3 (Phase 2, High/Med):** the socket layer's group-chat path has **no** authorization (`socketHandler.js:351-380`) — the most serious authz gap in the codebase, already logged. REST chat is safe; socket group chat is not.

**Findings (Input Validation / Injection / XSS — 2026-06-15):**
- ✅ **Positive — parameterized everywhere; no string-built SQL.** Every raw query uses bind `replacements` or constant `literal`s: `chatController.js:95-116` (conversation list, `:userId`/`:matchedUserIds`), `adminController.js:250-267,529-552,738-740` (analytics/revenue, `:thirtyDaysAgo`/`:userId`), `marketingRoutes.js:27-29` (`:userId`). No user input is interpolated into SQL. NoSQL/proto-pollution closed by `sanitizeRequest`: strips `$`-prefixed keys, `__proto__`/`constructor`/`prototype`, null bytes, depth-capped at 10 (`security.js:252-284`). Mass-assignment closed via `PROFILE_UPDATABLE_FIELDS` allowlist (Phase 2 VAL). Messages sanitized via `sanitizeMessage` (`chatController.js:262`). Stored XSS surface (bio, prompts, messages) is mitigated by React's default escaping — re-verify no `dangerouslySetInnerHTML` in Phase 5.
- ⚪ **Cross-ref VAL-1 (Phase 2, Medium):** `send-otp`/`verify-otp` lack `isEmail`/`isMobilePhone` validators → open-mailer / SMS-abuse vector (already logged, REF-18).

**Findings (CSRF / CORS — 2026-06-15):**
- ✅ **Positive — CSRF defended by SameSite, not a token theater.** Auth cookies are `httpOnly` + `secure` (HTTPS-gated) + **`sameSite:'strict'` in production** (`authController.js:18-26`) — cross-site requests never carry the cookie, so state-changing CSRF is blocked at the cookie layer (the `X-CSRF-Token` allowed header is unused but harmless). CORS uses a credentialed allowlist with http/https + www/non-www variants (`security.js:159-234`); rejects unknown origins with a 403.
- **SEC-2 (Low-Medium):** **CORS allows requests with no `Origin` header in production.** `corsOptions.origin` returns `callback(null, true)` for `!origin` even when `!isDevelopment` (`security.js:189-193`), justified for Docker health checks / internal cron. Browsers always send `Origin` on cross-site/credentialed requests, so this does not open a browser CSRF path (SameSite also guards), but it means the origin allowlist is not enforced for any Origin-less (server-side/scripted) caller. Evidence: `security.js:185-194`. Fix: scope the no-origin allowance to the health/monitoring paths (or loopback IP) rather than the whole API; everything else should require a recognized Origin in prod.

**Findings (File Upload — 2026-06-15):**
- **SEC-4 (Medium, contradicts CLAUDE.md):** **No magic-byte / content-sniff validation on uploads — only spoofable MIME + filename extension are checked.** `upload.js:58` explicitly comments "Multer sets file.mimetype from the Content-Type header which can be spoofed," yet the only checks are `ALLOWED_*_TYPES.includes(file.mimetype)` + `hasAllowedExtension(originalname, mimetype)` (`upload.js:86-100,176-180,213-217`). There is **no** `file-type`/magic-byte buffer inspection anywhere (`grep magic|file-type|fromBuffer` = comment only), because storage streams straight to Cloudinary (`resource_type:'auto'/'video'`, `:127,193,230`) with no buffer access. CLAUDE.md advertises "Multer+Cloudinary, **magic-byte**" — this control does not exist. Impact: a client can upload a polyglot/disguised file by setting a permitted Content-Type + extension; images are largely neutralized by Cloudinary re-encoding, but `resource_type:'auto'` + the document path (PDF, `MAX_FILE_SIZE*2`, `:252`) are weaker. Evidence: `upload.js:58,86-100,127,252-267`; contradicting CLAUDE.md upload note. Fix: validate magic bytes before/at upload (e.g. `file-type` on a buffered first chunk, or use Cloudinary's `allowed_formats` + `format`-pinned transformations), and pin `resource_type` per endpoint instead of `'auto'`. Update CLAUDE.md to match reality.
- ✅ **Positive — size caps present per type:** `MAX_FILE_SIZE` for images, `MAX_AUDIO_SIZE`/`MAX_VIDEO_SIZE` for voice/video, `*2` for documents (`upload.js:151,208,245,252`); upload limiter 20/hr (Phase 2).

**Findings (Secrets / SSRF — 2026-06-15):**
- ✅ **Positive — no secrets in source; env files gitignored.** Grep for inlined high-entropy secrets = 0 hits. `.gitignore:18-25` covers `.env`, `.env.*`, `.env.development/production/local` (allowlisting only `*.example`); `git ls-files | grep .env` shows only `mobile/ios/.xcode.env` (a path-config stub, no secrets). SSRF surface is minimal: no user-supplied URL is fetched server-side — uploads stream client bytes to Cloudinary (no fetch-by-URL), webhooks are inbound-only, outbound calls go to fixed provider hosts (Razorpay/SMS/BG-check) from config, not request data.

**Findings (Rate Limiting / Webhooks — 2026-06-15):**
- ✅ **Positive — limiter coverage is broad and IPv6-safe.** 11 limiters via `ipKeyGenerator` (IPv6-correct) keyed by user-id-or-IP, IP-only for auth/signup/otp/pwreset (`security.js:43-122`). Sensitive routes each carry a dedicated limiter (Phase 2 API-surface positives).
- ⚪ **Cross-ref (already logged):** BE-4 unauthenticated/unthrottled `/monitoring` mount; BE-5 bg-check initiate without `paymentLimiter`; UTIL-1 non-timing-safe `verifyPayment`; WH-1 bg-check webhook fail-open; WH-3 adapter HMAC length guard. Webhook signature review completed in Phase 2 (Razorpay hardened + timing-safe; bg-check has WH-1..4).
**Severity:** Medium (highest new: SEC-1, SEC-4; cross-refs SOCK-1/WH-1 remain the High items)

---
**Phase 4 complete (2026-06-15).** All 15 OWASP items audited. Net: **auth/session/JWT/CSRF/injection discipline is strong** (rotation+family-revoke, SameSite-strict, fully parameterized SQL, proto-pollution sanitizer, no committed secrets). New findings: SEC-1 (query-param token on REST → log leakage), SEC-2 (CORS no-origin in prod), SEC-3 (dead `ownsResource` guard), SEC-4 (no magic-byte on uploads — contradicts CLAUDE.md). Highest unresolved security risks remain the **Phase 2 Highs** SOCK-1 (group-chat zero authz) and WH-1 (bg-check webhook fail-open).

---

## Phase 5 — Frontend Review
Skill: `/design-review` · `/code-review`

- [x] Components (48) — reuse, prop drilling, dead components
- [x] State Management (AuthContext, OnboardingContext, SocketContext)
- [x] Routing (`App.jsx` — public/Protected/Admin/Marketing guards, 31 pages)
- [x] Forms (14-step onboarding, validation parity with backend)
- [x] Error States (error boundaries, axios 401→refresh queue)
- [x] Loading / Empty States
- [x] Dead code: `pages/Signup.jsx` (Profile.jsx already removed — DEBT-1)

**Status:** ✅ Done (7/7 items — 2026-06-15)

**Findings (Routing / Authorization guards — 2026-06-15):**
- ✅ **Positive — routing is clean, lazy-split, and guarded.** Every page is `React.lazy` code-split (`App.jsx:26-79`) under a `Suspense` fallback; `ErrorBoundary` wraps both the app root (`App.jsx:477`) and `<main>` (`:437`); a11y skip-to-content link (`:425-430`); explicit 404 catch-all (`:384`). Three guard tiers: `ProtectedRoute`, `AdminProtectedRoute`, `MarketingProtectedRoute`. Client guards are correctly **advisory only** (backend `auth`/`adminAuth` enforce) — a bypass just renders a page whose API calls 401/403.
- **FE-1 (Medium, broken access for a real role):** **`super_admin` is locked out of the entire admin UI.** `AdminProtectedRoute.jsx:16` redirects unless `user?.role === 'admin'` (excludes `super_admin`); `ProtectedRoute.jsx:25` `adminOnly` does the same. But `Login.jsx:39,118` routes `role === 'admin' || role === 'super_admin'` → `/admin/dashboard`, `MarketingProtectedRoute.jsx:6` allows `super_admin`, and backend `adminAuth` allows both `admin` + `super_admin` (`auth.js:124`). So a `super_admin` logs in, is sent to `/admin/dashboard`, and `AdminProtectedRoute` immediately bounces them to `/admin/login` → `/login`. Impact: the highest-privilege role cannot use the admin panel at all. Evidence: `AdminProtectedRoute.jsx:16`, `ProtectedRoute.jsx:25` vs `Login.jsx:39,118` + `auth.js:124`. Fix: accept `['admin','super_admin'].includes(user?.role)` in both guards.
- **FE-4 (Low):** **Redirect-to-a-redirect.** `AdminProtectedRoute.jsx:17` navigates to `/admin/login`, which is itself `<Navigate to="/login" replace />` (`App.jsx:358`). Works but does an extra hop. Fix: redirect straight to `/login`.

**Findings (State Management / Error States — 2026-06-15):**
- ✅ **Positive — AuthContext is well-designed.** httpOnly-cookie session checked via `/auth/me` on mount, gated by a non-sensitive `localStorage` auth-hint + protected-route-prefix check so public pages skip a needless `/auth/me` round-trip (`AuthContext.jsx:104-116`); `useCallback`-memoized `checkAuth`; a safe `authFallback` context if a consumer renders outside the provider (`:46-68`); 401 treated as expected-not-error. `ErrorBoundary` is complete: `getDerivedStateFromError` + `componentDidCatch`, dev-only technical details, prod error reporting behind `VITE_ERROR_REPORTING_URL`, retry + go-home (`ErrorBoundary.jsx:18-63`). Axios 401→refresh is queue-based (single in-flight refresh, others await; `axios.js:59-80`) with loop guards on `/auth/me` + `/auth/refresh`.
- **FE-2 (Low, perf/UX):** **Login and signup each fire two sequential auth requests.** Both `login` and `signup` `POST` then immediately `GET /auth/me` to fetch the profile (`AuthContext.jsx:120,129,154,163`), doubling perceived auth latency, even though the login/signup response already returns a `user`. Fix: have the backend login/signup include the Profile (single round-trip), or only call `/auth/me` when the initial payload lacks the profile.

**Findings (Forms / Loading-Empty states / Dead code — 2026-06-15):**
- ✅ **Positive — forms use shared validators + surface backend field errors.** `Login.jsx` validates via shared `validateEmail`/`validatePassword` (`utils/validators`), shows field-level errors, clears on input (`Login.jsx:5,85-95,295-302`); `AuthContext.signup` maps backend `error.details[]` into field messages (`AuthContext.jsx:180-188`) → client/server validation parity surfaced to the user. Loading states present (ProtectedRoute spinner, `Suspense` fallback, `PageSkeleton`).
- **FE-3 (Low, dead code — confirms DEBT-2/REF-1):** `pages/Signup.jsx` has **0 importers** (`/signup` routes to the inline `SignupRedirect`, `App.jsx:4-8,127`). `pages/Profile.jsx` already removed (DEBT-1). Safe to delete `Signup.jsx`; drop both from CLAUDE.md.
- ⚪ **Cross-ref Phase 4 (XSS):** no `dangerouslySetInnerHTML` anywhere in `frontend/src` (`grep` = 0) → stored-XSS surface (bio/prompts/messages) closed by React's default escaping, as assumed in Phase 4.
**Severity:** Medium (highest: FE-1)

---
**Phase 5 complete (2026-06-15).** All 7 items audited. Net: **frontend is well-architected** — lazy-split routing, robust ErrorBoundary + reporting, thoughtful cookie-session AuthContext, queue-based 401 refresh, shared validators, no XSS sink. One functional access bug: **FE-1 (Medium)** super_admin locked out of admin UI (guard role mismatch). Low: FE-2 double auth request, FE-3 dead Signup.jsx, FE-4 redirect-to-redirect. Highest severity = Medium.

---

## Phase 6 — SEO Review
Skill: manual + `/browse`

- [x] Meta tags (title/description per route — SPA; check `frontend/index.html` + react-helmet?)
- [x] **robots.txt — ❌ MISSING** (`frontend/public/robots.txt` does not exist) → SEO-1
- [x] **sitemap.xml — ❌ MISSING** (`frontend/public/sitemap*` not found) → SEO-2
- [x] Open Graph / Twitter cards
- [x] Structured data (JSON-LD for org / breadcrumbs)
- [x] Canonical URLs / SPA prerender (public pages: `/ /about /success-stories` etc.)
- [x] Performance SEO (cross-ref Phase 7, Core Web Vitals)

**Status:** ✅ Done (7/7 items — 2026-06-15)
**Findings:**
- ✅ **Positive — base meta is comprehensive (single static document).** `index.html` carries title + `description` + keywords + `author`, `robots: index,follow`, a `canonical`, full Open Graph (`og:type/url/title/description/image`, `:38-42`) + Twitter `summary_large_image` (`:45-49`), and rich JSON-LD `@graph` (Organization + WebSite `SearchAction`, `:79-108`). PWA manifest + theme-color + apple touch icons; perf hints (`preconnect`/`dns-prefetch` to fonts+Cloudinary, inline critical CSS); `<noscript>` fallback. Strong foundation for the landing page.
- **SEO-1 (Medium, confirmed):** No `frontend/public/robots.txt` (`ls` → not found). Crawlers get no directives and no sitemap pointer. Fix: add robots.txt with `Sitemap:` ref + `Disallow: /admin /marketing /api`.
- **SEO-2 (Medium, confirmed):** No `frontend/public/sitemap*.xml` (`ls` → no match). Public routes (`/ /about /contact /safety /privacy /terms /success-stories`) aren't enumerated for crawlers. Fix: generate a static `sitemap.xml` of public routes at build.
- **SEO-3 (Medium):** **No per-route meta — every page shares the landing page's title/description/canonical.** No `react-helmet`/helmet-async anywhere (`grep` = 0), no `document.title` updates per page (`grep` = 0). All 11 public routes render under the single `index.html`: identical `<title>`, identical `description`, and a **`canonical` hard-pinned to `https://tricityshadi.com/`** (`index.html:13`) — so `/about`, `/success-stories`, etc. all declare the homepage as their canonical → crawlers may treat them as duplicates of `/` and drop them from the index. Impact: only the homepage ranks; content pages are SEO-invisible. Evidence: `index.html:7-13`; no helmet in `src`. Fix: add `react-helmet-async` and set per-route `title`/`description`/`canonical` on each public page.
- **SEO-4 (Medium):** **Client-only rendering — public content not in initial HTML.** `#root` ships only a loading spinner (`index.html:120-124`); all page content is JS-rendered. Non-JS-executing crawlers and social scrapers (Facebook/LinkedIn/WhatsApp/Twitter card fetchers) see only the static index.html — so per-page OG/Twitter previews are impossible and content indexing relies entirely on Googlebot's deferred JS render. Impact: weaker discoverability + generic social cards for every shared URL. Evidence: `index.html:120-124`; no SSR/prerender in build (cross-ref Phase 7 bundle). Fix: prerender public routes at build (e.g. `vite-plugin-prerender`/`react-snap`) or SSR the marketing pages; pairs with SEO-3.
- **SEO-5 (Low, broken asset):** **`og:image` / `twitter:image` point to a non-existent file.** Both reference `https://tricityshadi.com/og-image.png` (`index.html:42,49`) but `public/` has **no `og-image.png`** (root listing: favicon.svg, icons/, images/, manifest.json, screenshots/, sw.js). Impact: social shares render with a missing/blank preview image. Evidence: `index.html:42,49`; `ls frontend/public`. Fix: add `public/og-image.png` (1200×630) or repoint to an existing asset.
**Severity:** Medium (highest: SEO-1/2/3/4)

---

## Phase 7 — Performance Review
Skill: `/benchmark` · `/browse` · `/qa`

- [x] Bundle size (Vite terser, chunks vendor-react/ui/utils, es2020 — verify split)
- [x] Lazy Loading (route-level code split; below-fold images A-002 already done)
- [x] Database Queries (N+1, missing indexes — cross-ref Phase 3)
- [x] API Performance (search 30/min limiter, daily-match caching)
- [x] Caching (Redis cache util + in-mem fallback; daily set TTL→midnight)
- [x] Image pipeline (Cloudinary 500²/1200², `scripts/optimize-home-images.mjs`)
- [x] Socket / realtime load

**Status:** ✅ Done (7/7 items — 2026-06-15)
**Findings:**
- ✅ **Positive — bundle + code-split config is solid.** `vite.config.js` uses terser with `drop_console`/`drop_debugger`/`pure_funcs` in prod, manual vendor chunks (`vendor-react`/`vendor-ui`/`vendor-utils`) for long-term caching, `chunkSizeWarningLimit:500`, content-hashed asset/font/js naming, and `dedupe:['react','react-dom','react-router-dom','recharts']` to prevent duplicate copies. Route-level `React.lazy` split confirmed Phase 5. Source maps prod-off unless explicitly enabled.
- ✅ **Positive — N+1 avoided on the hot list paths.** Search loads the page of profiles once, then batch-fetches match/subscription/verification state via a single `Promise.all` of `Op.in` queries and builds lookup `Map`s (`searchController.js:202-247`) — no per-row query. `matchController` daily/likes/mutual follow the same batch-then-map pattern (`matchController.js:180-240`). Chat conversation list uses one `DISTINCT ON` raw query (Phase 2). No `await`-in-`.map` anywhere (`grep` = 0).
- ✅ **Positive — caching is real and bounded.** `utils/cache.js` `getOrSet(key, fetchFn, ttl)` (Redis `setex` + in-mem fallback w/ TTL eviction); daily matches cached per `userId:IST-day` with TTL = seconds-to-next-IST-midnight so the set rolls over at local midnight (`matchController.js:276-278`). Image pipeline: Cloudinary face/gallery caps + below-fold lazy-load (A-002) already shipped.
- **PERF-1 (Medium):** **Search over-fetches — every result row returns the full Profile, including heavy JSONB.** `Profile.findAll` in search has **no `attributes` allowlist** (`searchController.js:188-199`), so each of up to `limit` rows serializes every column: `bio` (TEXT) plus `personalityValues`, `familyPreferences`, `lifestylePreferences`, `profilePrompts`, `socialMediaLinks`, `quizAnswers` (all JSONB) and several arrays — none of which a search card renders. Impact: inflated query cost, JSON serialization, and response bandwidth on the most-hit endpoint (30/min/user). Evidence: `searchController.js:188-199` (no `attributes`) vs the User include which *is* scoped to 4 columns (`:192`). Fix: add an `attributes` allowlist of card fields (name/age/city/photo/profession/education/verified/boost) to the search query.
- **PERF-2 (Low-Medium):** **Offset pagination on search/listings degrades on deep pages.** `searchController.js:198` uses `offset: parseInt(offset)`; Postgres still scans+discards all preceding rows, so cost grows linearly with page depth — and this compounds with the DB-4 unindexed filters (seq scan + large offset). Impact: slow deep pages as the Profiles table grows. Evidence: `searchController.js:198`. Fix: keyset/seek pagination (`WHERE createdAt < :cursor ORDER BY createdAt DESC LIMIT n`) for the infinite-scroll list; offset is acceptable only for shallow admin tables.
- ⚪ **Cross-refs (already logged):** DB-4 (income/height/manglik/interestTags search filters unindexed → seq scans) and UTIL-2 (`by-code` `LOWER(CAST(userId))` LIKE scan) are the main DB-perf items; SOCK-4 (no `@socket.io/redis-adapter` → realtime can't scale horizontally) is the realtime-load item; SEO-4 (client-only render) affects landing TTFB/CWV.
**Severity:** Medium (highest: PERF-1; compounding cross-refs DB-4/UTIL-2/SOCK-4)

---

## Phase 8 — QA Review
Skill: `/qa-only` (report) → `/qa` (fix)

- [x] Functional testing (9 Playwright specs: auth/crawl/visual/ux/errors/a11y/perf/assets/features)
- [x] Edge cases (nil/empty/expired-token/concurrent match)
- [x] User flows (signup→onboarding 14-step→match→chat→subscribe→pay)
- [x] Accessibility (e2e/06-accessibility + @axe-core; A-003 keyboard/ARIA done)
- [x] Mobile responsiveness (375/768px; Home.jsx done 2026-06-02)
- [x] Regression checks (re-run e2e after fixes)
- [x] ⚠️ Test coverage gap: `frontend/src/tests/` only `setup.js` + `utils/` — confirmed → QA-1

**Status:** ✅ Done (7/7 items — report-only `/qa-only`, 2026-06-15)
**Findings:**
- ✅ **Positive — e2e breadth + a11y tooling is real.** `playwright.config.js` + 9 specs (`01-auth` … `09-features`) with `@axe-core/playwright` WCAG-AA scans (`06-accessibility.spec.js`), plus crawler/visual/ux/error-detection/perf/broken-asset suites and shared `utils/helpers` + `fixtures`. Auth spec asserts page loads, empty-submit + invalid-credential validation, protected-route redirects, and one login→dashboard happy path (`01-auth-flow.spec.js:30-180`). Backend has Jest unit coverage for the pure utils (numerology, profileCode, sanitize, validators, errorHandler, notifyUserImports).
- **QA-1 (High, confirmed):** **Frontend has effectively no component/page tests.** `frontend/src/tests/` holds only `setup.js` + `utils/validators.test.js` — 0 `*.test.jsx` for 31 pages / 48 components, despite Vitest + RTL + user-event + coverage-v8 being installed and wired (`package.json` test scripts). Evidence: `find frontend/src/tests`. Fix: add Vitest+RTL tests for the critical surfaces (Login/auth forms, onboarding steps, ProtectedRoute/AdminProtectedRoute guards — would have caught FE-1, payment screens).
- **QA-2 (Medium):** **Backend integration coverage is auth-only — the highest-risk paths are untested.** `backend/tests/integration/` contains a single `auth.test.js`; there is **no** integration/Supertest coverage for the socket layer (SOCK-1 group-chat authz), the bg-check webhook (WH-1 fail-open), payment verify/webhook (UTIL-1 timing-safe), or the match/chat/subscription/search controllers. So the two audit Highs and the payment-security Mediums have zero automated regression protection. Evidence: `find backend/tests -name '*.test.js'` = 6 unit + 1 integration. Fix: add Supertest integration tests for payment verify/webhook, bg-check webhook signature, and socket join-room/join-group authz.
- **QA-3 (Medium):** **Core authenticated journeys aren't covered end-to-end.** The e2e suite is mostly public-page loads + validation + a11y/visual/perf, and `09-features` is largely endpoint-existence / 401-without-auth smoke (`09-...spec.js:33-187`). No test drives the revenue/retention journeys: 14-step onboarding completion, search→like→mutual→premium chat, or subscribe→Razorpay→payment-success. Only the single login→dashboard path exercises an authenticated flow. Impact: the most business-critical flows can regress silently. Evidence: `grep` across `e2e/tests/*.spec.js` — onboarding/chat/payment appear only as smoke/existence assertions. Fix: add authenticated Playwright journeys (seeded test user) for onboarding completion, match→chat, and the payment happy path.
- ✅ **Positive — a11y + responsive groundwork shipped:** axe WCAG-AA scan on public pages (06), keyboard/ARIA fixes (A-003), Home responsive 375/768 (2026-06-02).
**Severity:** High (QA-1)

> Report-only (`/qa-only`). No code changed. Live functional QA (`/qa`) + fixes deferred to a separate chunk and require the app running (`npm run dev`).

---

## Phase 9 — Missing / Incomplete Features
Skill: `/spec` · diff against [docs/01_PRD.md](docs/01_PRD.md)

- [x] Product requirements review (PRD vs shipped)
- [x] User journey gaps (missing screens / dead ends)
- [x] Missing APIs (endpoints referenced by UI but absent)
- [x] Missing validation (frontend vs backend parity)
- [x] Missing security controls (cross-ref Phase 4)
- [x] Known incomplete (verified each — see table)
- [x] Mobile parity (RN feature areas vs web)

**Status:** ✅ Done (7/7 items — 2026-06-15)
**Findings:**
- **MF-1 (High, feature has no backend — UI calls 404):** **Family/Group Chat (PRD F-05) is implemented on mobile + socket but has zero backend.** `mobile/src/api/chat.ts:59-86` calls five REST endpoints — `GET/POST /chat/family-groups`, `POST /chat/family-groups/:id/invite`, `DELETE /chat/family-groups/:id/leave`, `GET/POST /chat/family-groups/:id/messages` — and the socket layer relays `join-group`/`group-send-message` (`socketHandler.js:351-380`). **None of it exists server-side:** no `Group`/`GroupMember` model (`ls models | grep -i group` = 0), no group routes (`grep groups chatRoutes.js` = 0). So every family-group action in the mobile app 404s, and the socket events run with no membership concept (this is the same defect as **SOCK-1/SOCK-2**, viewed as a feature gap). Impact: a whole shipped-looking mobile feature is non-functional + insecure. Evidence: `mobile/src/api/chat.ts:59-86`, `socketHandler.js:351-380`, absent model/routes. Fix: build `Group`/`GroupMember` models + `/chat/family-groups*` routes with membership authz (resolves SOCK-1/2), or hide the mobile FamilyGroups UI until the backend exists.
- **MF-2 (Medium, web↔mobile parity gaps):** Three PRD features exist on mobile but are absent/deferred on web: **(a) in-browser audio/video calls** — mobile has `calls` (Agora Voice/Video/IncomingCall); web Astrologers/Guardian are booking-only (intentionally DEFERRED per R1, confirmed). **(b) Family-group chat** — mobile screens exist; web has no equivalent (and no backend, MF-1). **(c) Bureau Console (PRD F-14)** — mobile `BureauStack` (ClientRoster/MatchProposal/Earnings) exists; web has only Marketing routes, no bureau UI. Impact: feature set differs by platform; PRD F-05/F-14 only partially delivered. Evidence: `mobile/src/features/{calls,chat,bureau}` vs `frontend/src` (no calls/groups/bureau pages). Fix: track each as an explicit roadmap item (web calls already deferred); confirm bureau backend coverage before exposing.
- **MF-3 (Medium, validation parity — cross-ref VAL-1):** Backend OTP routes lack format validators while the frontend validates client-side → parity gap that doubles as the VAL-1 open-mailer/SMS-abuse vector (`send-otp`/`verify-otp`, REF-18). Other forms have good parity (signup/login validators on both sides, backend `error.details[]` surfaced — Phase 5).
- ✅ **Known-incomplete — verified each (CLAUDE.md/PRD diff):**
  | Item | Claimed | Verified state | Evidence |
  |------|---------|----------------|----------|
  | Razorpay | 🔴 placeholder | Config wired + placeholder-guarded; payments non-functional until real keys | `env.js:156-167`, `razorpay.js` (Phase 2) |
  | Email | 🟡 off | `optionalString` user/host, sends only if configured | `env.js:169-172` |
  | Google OAuth | 🟡 off | Backend `/auth/google` present; needs `VITE_GOOGLE_CLIENT_ID` + secret | env + authController |
  | SMS OTP | 🟡 needs key | Dev logs OTP; live needs `SMS_API_KEY` | `smsService.js` (Phase 2) |
  | FCM push | 🟠 stub | Needs creds + native build | CLAUDE.md / queue |
  | Web in-browser calls | DEFERRED | Confirmed absent on web (mobile-only) | `frontend/src` no calls |
  | Kundli PDF | missing | Confirmed — only **invoice** PDF exists (`utils/invoice.js`), no kundli generation | `grep kundli\|PDF` = invoice only |
  | Full web i18n | partial | Only new pages use `useTranslation`; existing pages English-only | CLAUDE.md i18n note |
- ⚪ **Missing security controls:** all surfaced in Phase 4 — SOCK-1 (group authz, = MF-1), WH-1 (bg-check fail-open), SEC-1..4. No new ones in Phase 9.
**Severity:** High (MF-1)

---
**Phase 9 complete (2026-06-15).** PRD diff done. Headline: **MF-1 (High)** — Family/Group Chat ships in mobile UI + socket but has no backend (models/routes absent) → 404s + the SOCK-1 authz hole. MF-2 web↔mobile parity (calls/groups/bureau), MF-3 OTP validation parity (= VAL-1). Known-incomplete list verified — all match reality except DB-1 (quizAnswers migration exists) and SEC-4 (magic-byte absent) already corrected in earlier phases. **All 9 phases ✅ — audit complete; final deliverables next.**

---

# Critical Findings

| ID | Severity | Area | Description | Status |
|----|----------|------|-------------|--------|
| SOCK-1 | High | Backend/socket authz | Family-group chat has no membership check; `join-group`/`group-send-message` (socketHandler.js:351-380) cite a REST endpoint + Group model that don't exist → any authed user reads/writes any group | ☑ FIXED — group socket events disabled (reject `FEATURE_UNAVAILABLE`) until backend built; closes IDOR |
| WH-1 | High | Backend/webhook auth | BG-check webhook verify fails OPEN if `BG_CHECK_WEBHOOK_SECRET` unset (bgCheckService.js:203-205); no prod guard → forge `status:passed` to self-grant Background Verified badge | ☑ FIXED — fail-closed in prod (bgCheckService.js) + env prod guard requires secret when provider enabled (env.js) |
| MF-1 | High | Missing feature | Family/Group Chat has no backend — mobile calls 5 `/chat/family-groups*` endpoints + socket join-group that don't exist (no Group model/routes); same defect as SOCK-1 → mobile feature 404s | ☑ MITIGATED — insecure socket path disabled (SOCK-1). Building Group backend OR hiding mobile UI still tracked (REF-51) |

---

# Bugs Found

| ID | Severity | Module | Bug | Fixed |
|----|----------|--------|-----|-------|
| BE-2 | Medium | Backend/webhooks | bg-check webhook rawBody captured only at `/api/v1` path (server.js:105) but router double-mounted → HMAC fails on `/api/...` legacy path | ☐ |
| CTRL-1 | Medium | Backend/profile | Incognito reads target's `incognitoMode` not viewer's (profileController.js:490) → inverted privacy + create-then-destroy ProfileView | ☐ |
| CTRL-2 | Low | Backend/profile | Empty dedup `catch` (profileController.js:465) swallows all errors, not just unique-constraint; no log | ☐ |
| DB-3 | Low-Med | Database/index | Duplicate Messages index — migration 000012 `idx_messages_sender_receiver_created` and 000025 `messages_sender_receiver_created_at` both on (senderId,receiverId,createdAt) → 2× write cost | ☐ |
| DB-4 | Medium | Database/perf | Search filters income/height/manglikStatus (btree) + interestTags (GIN for Op.overlap) unindexed → seq scans on Profiles (searchController.js:103-105,131-132,159-183) | ☐ |
| FE-1 | Medium | Frontend/authz | super_admin locked out of admin UI — AdminProtectedRoute.jsx:16 + ProtectedRoute.jsx:25 check `role==='admin'` only, but Login routes super_admin to /admin/dashboard → bounce to /login | ☐ |
| FE-2 | Low | Frontend/perf | Login + signup each fire POST then GET /auth/me (AuthContext.jsx:120,129,154,163) → double auth round-trip | ☐ |
| PERF-1 | Medium | Backend/perf | Search `Profile.findAll` has no `attributes` allowlist (searchController.js:188-199) → over-fetches bio + 6 JSONB cols per card on 30/min endpoint | ☐ |
| PERF-2 | Low-Med | Backend/perf | Offset pagination on search (searchController.js:198) → deep-page cost grows linearly; compounds with DB-4 seq scans | ☐ |

---

# Security Findings

| ID | Severity | Vulnerability | Risk | Fixed |
|----|----------|--------------|------|-------|
| UTIL-1 | Medium | Non-timing-safe HMAC compare in `razorpay.verifyPayment` (razorpay.js:121, `===`) | Timing side-channel on payment-confirmation signatures (subscription + bg-check verify-payment) | ☐ |
| VAL-1 | Medium | `send-otp` email path sends code to any unvalidated `target` (authController.js:629-641) | Open-mailer / mail-bomb via SMTP reputation; garbage phone numbers hit SMS provider | ☐ |
| SOCK-1 | High | Group chat socket has no authz; no Group model / `/chat/groups/:id/join` route exists (socketHandler.js:351-380) | Any authed user joins+reads+writes any family group by groupId (IDOR) | ☐ |
| SOCK-2 | Medium | `group-send-message` no ownership/persistence check (socketHandler.js:367-380) | Forged/spoofed messages injected into any group | ☐ |
| SOCK-3 | Low-Med | `message-deleted` broadcast with no ownership check (socketHandler.js:330-347) | Partner-scoped message-deletion spoof/griefing | ☐ |
| WH-1 | High | BG-check webhook fail-open when secret unset (bgCheckService.js:203-205), no prod guard | Forge `bg-check/webhook` payload → self-grant Background Verified badge | ☐ |
| WH-3 | Low-Med | BG-check adapter HMAC compare lacks length guard (bgCheckService.js:94-98,147-150) | Malformed signature → RangeError → 500 instead of 401 | ☐ |
| SEC-1 | Medium | Access JWT accepted as `?token=` on every REST route (auth.js:29-31,41) | Token leaks to access/proxy logs, browser history, Referer → replayable until 15m expiry | ☐ |
| SEC-2 | Low-Med | CORS allows no-`Origin` requests in production (security.js:189-193) | Origin allowlist not enforced for Origin-less/scripted callers (not a browser CSRF path; SameSite guards) | ☐ |
| SEC-3 | Low | Centralized IDOR guard `ownsResource` exported but unused (auth.js:249, 0 usages) | No enforced ownership pattern for new routes; false assurance | ☐ |
| SEC-4 | Medium | Uploads validated by spoofable MIME + extension only; no magic-byte (upload.js:58,86-100) | Polyglot/disguised file upload; contradicts CLAUDE.md "magic-byte" claim; `resource_type:'auto'` + PDF path weakest | ☐ |

---

# Refactoring Tasks

| ID | Priority | Area | Task |
|----|----------|------|------|
| REF-1 | Low | Frontend | DEBT-2/FE-3: delete dead `pages/Signup.jsx` (0 importers, confirmed Phase 5). NOTE: `pages/Profile.jsx` already gone (DEBT-1) — drop both from CLAUDE.md |
| REF-2 | Low-Med | Backend | DEBT-3: emailService.js has **2** consumers (chat+match); `email.js` lacks `sendMessageNotification` — port it + template, repoint both, then delete |
| REF-3 | Medium | Architecture | ARCH-2: drop nested `backend/`+`frontend/` lockfiles & node_modules; install from root; gitignore `*/package-lock.json` |
| REF-4 | Medium | Architecture | ARCH-1: `shared` consumed only by mobile — rename to mobile-types or generate JS/JSDoc contracts for web+backend |
| REF-5 | Low | Architecture | ARCH-3: declare `@tricityshadi/shared` as real dep where used, or drop from `workspaces` (alias-only) |
| REF-6 | Medium | Backend | ARCH-4: extract inline route logic (guardian/astrologer/marketing + rest of verification) into controllers; keep routes thin |
| REF-7 | Low | Backend | ARCH-5: split fat controllers (admin 954, profile 932, auth 741 lines) by sub-domain or via util helpers |
| REF-8 | Low | Deps | DEP-1: remove unused deps — backend `concat-stream`; frontend `react-spring`, `react-swipeable` |
| REF-9 | Low | Deps | DEP-2: drop frontend `react-is@^19` pin (React-19 pkg in 18 tree, unused in src) |
| REF-10 | Medium | Deps | DEP-3: align cross-workspace lib versions (axios, socket.io-client) web↔mobile |
| REF-11 | Medium | Backend | ENV-1: route cloudinary.js / profileController / verificationRoutes / alerts through `config`; model swagger toggle in `env.js` |
| REF-12 | Medium | Backend | BE-1: collapse `/api/v1`+`/api` double-mount (server.js:186-187) to one canonical path; alias/redirect legacy |
| REF-13 | Low-Med | Backend | BE-3: move bg-check webhook to a standalone no-auth sub-router instead of `req.path` string skip (verificationRoutes.js:22-25) |
| REF-14 | Low-Med | Backend | BE-4: drop `/monitoring` mount or apply limiter; gate/trim `/health/full` dependency disclosure |
| REF-15 | Low | Backend | BE-5: add `paymentLimiter` to `POST /verification/bg-check/initiate` |
| REF-16 | Medium | Backend/security | UTIL-1: make `razorpay.verifyPayment` timing-safe (`crypto.timingSafeEqual`), matching the webhook path |
| REF-17 | Low | Backend/perf | UTIL-2: replace `by-code` `LOWER(CAST(userId))` LIKE scan with indexed UUID range; assert single match |
| REF-18 | Medium | Backend/validation | VAL-1: add `isEmail`/`isMobilePhone` + `code`/`type` validators to send-otp & verify-otp |
| REF-19 | Low | Backend/validation | VAL-2: add express-validator schemas to guardian/astrologer/marketing/admin/bg-check routes (with ARCH-4 extraction) |
| REF-20 | Medium | Backend/observability | ERR-1: route errorHandler `logError` through `middlewares/logger`'s single-line JSON logger; drop `JSON.stringify(...,null,2)` pretty-print (errorHandler.js:75,77) |
| REF-21 | Low | Backend | ERR-2: stop shallow-spreading the caught Error (`{...err}`, errorHandler.js:139) — operate on `err` / a fresh AppError to preserve prototype + non-enumerable props |
| REF-22 | Low | Backend | ERR-3: classify Cloudinary errors by `err.http_code`/`err.name`, not `message.includes('cloudinary')` (errorHandler.js:171) |
| REF-23 | Low | Backend | ERR-4: align fatal-error policy — shutdown/restart on `unhandledRejection` too, or narrowly swallow only the known Cloudinary rejection (server.js:417-425) |
| REF-24 | High | Backend/socket security | SOCK-1: add Group/GroupMember model + membership check to `join-group`/`group-send-message`, or disable group events until backend feature exists (socketHandler.js:351-380) |
| REF-25 | Medium | Backend/socket security | SOCK-2: verify message persistence + `senderId===userId` in `group-send-message` (mirror send-message) |
| REF-26 | Low-Med | Backend/socket | SOCK-3: emit `message-deleted` server-side from REST delete instead of trusting client event |
| REF-27 | Medium | Backend/scale | SOCK-4: add `@socket.io/redis-adapter` + shared rate-limit store before multi-instance deploy |
| REF-28 | Low | Backend/socket | SOCK-5: use `checkSubscription` in `join-room`; remove divergent inline premium query / dead fn |
| REF-29 | Low | Backend/socket | SOCK-6: gate `typing` on mutual match / joined-room membership |
| REF-30 | High | Backend/webhook security | WH-1: bg-check webhook fail-closed in prod when secret unset; add `BG_CHECK_WEBHOOK_SECRET` to env prod guard when provider enabled (bgCheckService.js:202-206) |
| REF-31 | High | Backend/webhook | WH-2/BE-2: capture rawBody for `/api/verification/bg-check/webhook` (or drop legacy `/api` mount); remove `JSON.stringify(req.body)` fallback (verificationRoutes.js:213) |
| REF-32 | Low-Med | Backend/webhook | WH-3: add length+hex guard before `timingSafeEqual` in bg-check adapters (bgCheckService.js:94-98,147-150) |
| REF-33 | Low | Backend/webhook | WH-4: bind accepted signature header to configured provider (verificationRoutes.js:207-211) |
| REF-34 | Medium | Docs | DB-1: remove false "quizAnswers has no migration / ALTER manually" guidance from CLAUDE.md (Migrations + Known Issues + R2 history) + this tracker — migration 000028 adds it |
| REF-35 | Medium | Database | DB-2: make migrations the sole index source — drop or migrate the model `indexes:[]` arrays (dead under `sync({alter:false})`, server.js:286); reconcile Profile `(isActive,gender,city)` vs live `(gender,isActive,createdAt)` |
| REF-36 | Low-Med | Database | DB-3: drop the duplicate Messages index (migration 000012 vs 000025, same 3 columns) |
| REF-37 | Medium | Database/perf | DB-4: add btree on Profiles income/height/manglikStatus + GIN on interestTags (Op.overlap); consider pg_trgm GIN for hot iLike columns |
| REF-38 | Medium | Security/auth | SEC-1: drop `req.query.token` from REST `extractToken` (auth.js:29-31) — keep query token only on the socket handshake path |
| REF-39 | Low-Med | Security/CORS | SEC-2: scope CORS no-origin allowance to health/monitoring (or loopback) instead of whole API in prod (security.js:189-193) |
| REF-40 | Low | Security | SEC-3: adopt `ownsResource` on `:id` resource routes, or delete the unused guard (auth.js:249) |
| REF-41 | Medium | Security/upload | SEC-4: add magic-byte validation (file-type on buffered chunk or Cloudinary allowed_formats); pin `resource_type` per endpoint; fix CLAUDE.md upload claim |
| REF-42 | Medium | Frontend/authz | FE-1: accept `['admin','super_admin']` in AdminProtectedRoute.jsx:16 + ProtectedRoute.jsx:25 (super_admin currently locked out of admin UI) |
| REF-43 | Low | Frontend/perf | FE-2: include Profile in login/signup response (or only call /auth/me when payload lacks profile) to drop the double round-trip |
| REF-44 | Low | Frontend | FE-4: AdminProtectedRoute redirect straight to `/login` instead of `/admin/login` (which itself redirects) |
| REF-45 | Medium | SEO | SEO-1/2: add `frontend/public/robots.txt` (Sitemap ref + Disallow /admin /marketing /api) + build-time `sitemap.xml` for public routes |
| REF-46 | Medium | SEO | SEO-3: add react-helmet-async, set per-route title/description/canonical (canonical currently hard-pinned to `/`) |
| REF-47 | Medium | SEO | SEO-4: prerender/SSR public marketing routes so crawlers + social scrapers see content (vite-plugin-prerender / react-snap) |
| REF-48 | Low | SEO | SEO-5: add `public/og-image.png` (1200×630) or repoint og:image/twitter:image (currently 404) |
| REF-49 | Medium | Backend/perf | PERF-1: add `attributes` allowlist of card fields to search `Profile.findAll` (searchController.js:188) — stop returning bio + 6 JSONB cols per result |
| REF-50 | Low-Med | Backend/perf | PERF-2: switch search/listing to keyset/seek pagination (cursor on createdAt) instead of offset |
| REF-51 | High | Missing feature | MF-1: build Group/GroupMember model + `/chat/family-groups*` routes with membership authz (resolves SOCK-1/2), OR hide mobile FamilyGroups UI until backend exists |
| REF-52 | Medium | Parity | MF-2: track web↔mobile parity items (web calls [deferred], family-groups, bureau console) as explicit roadmap; confirm bureau backend before exposing |
| REF-53 | Low | Docs | MF-3/known-incomplete: reconcile CLAUDE.md Known Issues with verified state (DB-1 quizAnswers migration exists; SEC-4 magic-byte absent; kundli PDF still missing) |

---

# Master Findings Log (SEO/QA pre-seeded 2026-06-15)

| ID | Severity | Phase | Evidence | Fix |
|----|----------|-------|----------|-----|
| SEO-1 | Medium | 6 | `frontend/public/robots.txt` missing (confirmed) | Add robots.txt + Sitemap ref + Disallow /admin /marketing /api |
| SEO-2 | Medium | 6 | `frontend/public/sitemap*` missing (confirmed) | Generate sitemap.xml of public routes at build |
| SEO-3 | Medium | 6 | No per-route meta; canonical hard-pinned to `/` (index.html:13); no react-helmet | Add react-helmet-async, per-route title/description/canonical |
| SEO-4 | Medium | 6 | Client-only render — public content not in initial HTML (index.html:120-124) | Prerender/SSR public routes for crawlers + social scrapers |
| SEO-5 | Low | 6 | og:image/twitter:image → og-image.png 404 (index.html:42,49; no file in public/) | Add public/og-image.png 1200×630 or repoint |
| QA-1 | High | 8 | `frontend/src/tests/` has no component tests (confirmed; Vitest+RTL installed, unused) | Add Vitest+RTL suite (auth forms, onboarding, route guards, payment) |
| QA-2 | Medium | 8 | Backend integration tests = auth.test.js only; SOCK-1/WH-1/payment/match/chat untested | Add Supertest tests for payment verify/webhook, bg-check webhook, socket authz |
| QA-3 | Medium | 8 | e2e covers public pages + endpoint-existence smoke; no e2e for onboarding/match→chat/payment journeys | Add authenticated Playwright journeys (seeded user) |
| MF-1 | High | 9 | Family/Group Chat: mobile calls 5 `/chat/family-groups*` endpoints + socket join-group; no Group model/routes (chat.ts:59-86, socketHandler.js:351-380) | Build group model+routes+authz, or hide mobile UI |
| MF-2 | Medium | 9 | web↔mobile parity: calls (web deferred), family-groups, bureau console mobile-only | Roadmap each; confirm bureau backend |
| MF-3 | Medium | 9 | OTP routes lack backend validators (= VAL-1) while FE validates | Add backend OTP validators (REF-18) |

---

# Production Readiness Score

> 0–10 per area. Filled as phases complete. `—` = not yet audited.

| Area | Score | Notes |
|------|-------|-------|
| Architecture | 7 | Phase 1 ✅ — clean boundaries + no cycles; debt: shared-not-shared, lockfile drift, split-brain routes, env-read drift |
| Backend | 6 | Phase 2 ✅ — strong error/validation/payment-webhook discipline; 2 High (SOCK-1 group-chat authz, WH-1 bg-check fail-open) + several Mediums (double-mount, incognito bug, OTP open-mailer, timing-safe verify) |
| Database | 7 | Phase 3 ✅ — FK/referential integrity solid (full cascade, no orphans), migrations idempotent/reversible; debt: docs-vs-migration drift (quizAnswers), dead model indexes under sync, duplicate Messages index, unindexed competitive search filters |
| Security | 7 | Phase 4 ✅ — strong auth/session/JWT/CSRF (rotation+family-revoke, SameSite-strict), fully parameterized SQL, proto-pollution sanitizer, no committed secrets; debt: SEC-1 query-token, SEC-2 CORS no-origin, SEC-4 no magic-byte upload; **High risks remain from Phase 2: SOCK-1, WH-1** |
| Frontend | 8 | Phase 5 ✅ — lazy-split routing, robust ErrorBoundary+reporting, cookie-session AuthContext, 401-refresh queue, shared validators, no XSS sink; one access bug FE-1 (super_admin locked out of admin UI), minor FE-2/3/4 |
| SEO | 5 | Phase 6 ✅ — strong static base meta/OG/Twitter/JSON-LD on landing; but SPA has no per-route meta (canonical pinned to `/`), no robots/sitemap, client-only render hurts crawlers/scrapers, og-image 404 |
| Performance | 7 | Phase 7 ✅ — solid bundle/code-split, N+1 avoided via batch Promise.all, real bounded caching (getOrSet + IST-midnight TTL); debt: PERF-1 search over-fetch, PERF-2 offset pagination, + DB-4/UTIL-2/SOCK-4 cross-refs |
| Testing | 4 | Phase 8 ✅ — real e2e breadth (9 Playwright specs + axe a11y) + backend util unit tests; but 0 FE component tests (QA-1 High), backend integration = auth only (QA-2), no e2e for core authenticated journeys (QA-3) |
| Features/Parity | 5 | Phase 9 ✅ — core journeys shipped; MF-1 (High) Family/Group Chat has no backend (mobile 404s), MF-2 web↔mobile parity gaps, several known-incomplete items config-gated (Razorpay/Email/OAuth/SMS/FCM) |
| **Overall** | **6** | All 9 phases ✅. Solid engineering fundamentals (auth/CSRF/SQL/error/caching/bundle) dragged down by 3 Highs (SOCK-1=MF-1 group chat, WH-1 bg-check fail-open), thin test coverage, and SPA-SEO + launch-config gaps. Not prod-ready until the 3 Highs + payment/upload security mediums are fixed. |

---

# Final Deliverables (all 9 phases ✅ — 2026-06-15)

## 1. Executive Summary

TricityShadi is a **well-engineered** codebase with strong fundamentals: clean tier boundaries + no circular deps (Phase 1), disciplined error/validation/transaction handling and a hardened Razorpay webhook (Phase 2), solid referential integrity + idempotent migrations (Phase 3), textbook auth (refresh rotation + family-revoke, SameSite-strict CSRF, fully parameterized SQL, no committed secrets — Phase 4), a lazy-split React SPA with a robust ErrorBoundary and no XSS sink (Phase 5), and good bundle/caching/N+1 hygiene (Phase 7).

It is **not production-ready** as-is. **3 High-severity issues** must be fixed first, and two of them are the same root defect:
- **SOCK-1 / MF-1** — Family/Group Chat ships in the mobile UI + socket layer but has **no backend** (no Group model, no `/chat/family-groups*` routes). Every mobile group action 404s, and the socket `join-group`/`group-send-message` events run with **zero membership authorization** (any authed user can read/write any group).
- **WH-1** — the background-check webhook **fails open** when `BG_CHECK_WEBHOOK_SECRET` is unset (no prod guard), letting an attacker forge `status:passed` to self-grant the "Background Verified" trust badge.

Secondary risk clusters: payment-path security mediums (UTIL-1 non-timing-safe verify, VAL-1 OTP open-mailer, SEC-4 no upload magic-byte), an access bug (FE-1 super_admin locked out of admin UI), thin automated test coverage (QA-1 zero FE component tests; QA-2 backend integration = auth only), and SPA-SEO gaps (no robots/sitemap, no per-route meta, client-only render).

**Tallies:** 3 High · ~22 Medium · ~25 Low across 53 refactor tasks (REF-1..53). Overall production-readiness **6/10**.

## 2. Security Report (OWASP) — Phase 4
Strong: auth/session/JWT/CSRF, parameterized SQL, proto-pollution sanitizer, secrets hygiene. Open: **SOCK-1** (High, group authz), **WH-1** (High, webhook fail-open), UTIL-1 (timing-safe payment verify), VAL-1 (OTP validation), SEC-1 (query-token leak), SEC-2 (CORS no-origin), SEC-4 (upload magic-byte), WH-2/3/4, BE-3/4/5.

## 3. Architecture Report — Phase 1
Clean boundaries, no cycles, central env module. Debt: ARCH-1 (`shared` only used by mobile), ARCH-2/DEP-4 (lockfile drift), ARCH-4 (split-brain inline-route logic), ARCH-5 (fat controllers), ENV-1 (process.env reads bypass `env.js`).

## 4. Bug Report
**High:** FE-1 (super_admin admin-UI lockout). **Medium:** CTRL-1 (inverted incognito semantics), BE-2/WH-2 (bg-check rawBody on legacy mount), DB-3 (duplicate index), PERF-1 (search over-fetch). **Low:** CTRL-2, ERR-2/3/4, FE-2/4, SEO-5, SOCK-5.

## 5. Missing Features Report — Phase 9
**MF-1 (High):** Family/Group Chat backend absent. **MF-2:** web↔mobile parity (calls deferred, family-groups, bureau console mobile-only). **MF-3:** OTP validation parity. Config-gated launch items: Razorpay (placeholder), Email/Google-OAuth/SMS (off), FCM (stub). Genuinely missing: kundli PDF, full web i18n, web in-browser calls.

## 6. Technical Debt Report
Lockfile/version drift (ARCH-2, DEP-1/2/3), dead code (Signup.jsx, emailService.js, `ownsResource`), env-read drift (ENV-1), dead model indexes under `sync` (DB-2), double API mount (BE-1), docs-vs-reality drift (DB-1 quizAnswers, SEC-4 magic-byte, CLAUDE.md upload/migration claims).

## 7. Production Readiness Report
**6/10.** Blockers: fix 3 Highs (SOCK-1/MF-1, WH-1) + payment/upload mediums; supply real Razorpay/Email/OAuth/SMS/FCM creds; run `npm run migrate`; add robots/sitemap; resolve FE-1. Strong: deploy tooling, monitoring, prelaunch script, security headers.

## 8. Prioritized Action Plan
1. **P0 (before any deploy):** REF-30 (WH-1 fail-closed + env guard), REF-24 (SOCK-1 / MF-1 group authz or disable), REF-16 (UTIL-1 timing-safe verify), REF-42 (FE-1 super_admin).
2. **P1 (launch hardening):** REF-18 (OTP validators), REF-41 (upload magic-byte), REF-31 (bg-check rawBody), REF-12 (collapse double-mount), REF-38 (drop query token), REF-37 (search-filter indexes), REF-49 (search over-fetch).
3. **P2 (quality/SEO/tests):** REF-45/46/47 (robots+sitemap+per-route meta+prerender), QA-1/2/3 (FE component tests, backend integration for payment/webhook/socket, authed e2e journeys).
4. **P3 (debt cleanup):** REF-3/4/6/7/11/35 + the Low-severity remainder.

All findings evidence-cited (`file:line`) and derived only from verified source files.

---

# npm audit triage (2026-06-16)

Ran `npm audit` on backend + frontend after the dependency cleanup.

**Fixed / improved:**
- **socket.io 4.6.1 → 4.8.3** (backend) + **socket.io-client 4.6.1 → 4.8.3** (frontend) — newer engine.io, and aligns web/backend with mobile's 4.8.3 (also closes **DEP-3 / REF-10**). Build + all tests green after.
- Added root `overrides: { "ws": "^8.21.0" }` — the patched ws (8.21.0 is outside the vulnerable `8.0.0–8.20.1` range).

**Backend `ws` DoS (high, GHSA-96hv-2xvq-fx4p) — FIXED (2026-06-16):**
- Resolved together with **REF-3**. Removed nested `backend/`+`frontend/` lockfiles + node_modules, regenerated a single root `package-lock.json`, and **scoped** the override to the socket.io chain only — `overrides: { "engine.io": {ws:^8.21.0}, "engine.io-client": {ws:^8.21.0}, "socket.io-adapter": {ws:^8.21.0} }` — so react-native's ws@6 and react-devtools' ws@7 are left untouched (a blanket `ws` override would have broken mobile). Verified: socket-chain ws now **8.21.0** (6 instances), GHSA-96hv advisory count **0**, RN ws@6.2.4 + devtools ws@7.5.11 intact, `require('socket.io')`=4.8.3 + `require('ws')`=8.21.0 load clean. Backend highs 6→3.

**More runtime fixes (2026-06-16):**
- **nodemailer 6.9.7 → 9.0.0** — clears the SMTP-command-injection + addressparser-DoS + email-misdelivery highs (GHSA-mm7p / rcmh / c7w3). `createTransport`/`getTestMessageUrl` API unchanged; module loads clean.
- **cloudinary 1.41.3 → 2.10.0** (direct) **+ scoped override** `multer-storage-cloudinary > cloudinary ^2.10.0` — clears the arg-injection-via-ampersand high (GHSA-g4mf). upload.js already passes its own v2 instance to `CloudinaryStorage`, so the adapter uses the patched instance; the old vulnerable v1 is fully gone from the tree. upload.js loads + wires storage OK.
- **dompurify 3.4.8 → 3.4.10** (frontend runtime XSS sanitizer, used in `src/utils/sanitize.js`) — clears GHSA. **Also fixed `vite.config.js`:** removed the hardcoded `dompurify`/`clsx` aliases pointing at root `node_modules` (an ARCH-2 hoisting workaround that broke once REF-3 moved deps into `frontend/node_modules`) — replaced with `dedupe` entries (path-agnostic). Build ✅.

**Result: backend `npm audit` = 0 high, 0 critical** (30 left: 1 low + 29 moderate, all transitive uuid-chain via firebase-admin/google-gax/sequelize/jest-junit — `--force`/breaking-only).

**react-router 6 → 7 — DONE (2026-06-16):** bumped `react-router-dom` to **7.17.0**, clearing the `@remix-run/router` XSS-open-redirect high (the package was merged into RR7). App uses only the component/hook API (BrowserRouter/Routes/Route/Link/NavLink/Navigate/Outlet/useLocation/useNavigate/useParams/useSearchParams) — no data-router/loaders — so RR7 is a drop-in re-export; build + all 31 FE tests green, `@remix-run/router` gone from the tree.

**Frontend remaining highs/criticals — now 100% dev-build/test toolchain (NOT shipped, ~zero runtime exposure):**
- **vitest / @vitest/coverage-v8 (critical), esbuild / vite / glob / minimatch (high)** — vitest UI file-read + esbuild dev-server CVEs only matter in local dev/CI, never in the production bundle. Fix needs a breaking **vite 5 → 8 + vitest 1 → 3** (3-major) upgrade. Deliberately deferred: high breakage risk to the currently-green build/test pipeline for zero production-security benefit. Revisit as a standalone toolchain chunk.

**Net: no runtime/shipped npm vulns remain in either workspace.** Backend 0 high/0 critical; frontend high/crit are all dev-tooling.

---

# Full dependency-update sweep (2026-06-16)

Updated everything safely-updatable in verified tiers (build + tests after each).

**Updated:**
- *Dev toolchain (clears FE critical CVEs):* vite 5→8 (rolldown — `manualChunks` converted to function form in vite.config), vitest 1→4, @vitejs/plugin-react 4→6, @vitest/coverage-v8 1→4, jsdom 23→29, @testing-library/react 14→16.
- *Frontend libs:* react-router-dom 6→7, react-icons 4→5, lucide-react 0.344→1, framer-motion 10→12, typescript 5→6, axios→1.18, postcss→8.5.15, radix-ui, autoprefixer, tailwind-merge (2.x), tailwindcss (3.4.19), @types/*.
- *Backend libs:* helmet 7→8, bcryptjs 2→3 (hash/compare smoke-verified), dotenv 16→17, cross-env 7→10, jest 29→30, jest-junit 16→17, supertest 6→7, express-validator 7.3.2, morgan 1.11, nodemon 3.1.14, sequelize-cli 6.6.5, pdfkit 0.19.1; removed unused direct `cookie`.

**Result:** build ✅, FE 31/31, BE 99 pass (9 pre-existing/stale). **Backend audit 0 high/0 critical** (27 moderate transitive uuid-chain). **Frontend** only 2 dev-only highs (glob/minimatch — no patched in-range version; needs glob 11/minimatch 10 forced on dev tooling, not worth the risk).

**Held — need a running-app migration, not a blind bump (each a focused chunk):**
- **react 18 → 19** (+ @types/react 19) — **ATTEMPTED 2026-06-16, reverted. Blocked at the monorepo level:** mobile (RN 0.74) hard-pins `react@18.2.0`, so npm workspace hoisting keeps 18.2.0 at root for mobile while frontend gets a nested `react@19` → **dual-React** ("Invalid hook call" / "Cannot read properties of null (reading 'useRef')" in tests; the bundle build masked it via vite dedupe). Frontend code itself is React-19-clean (no legacy ReactDOM.render/defaultProps/propTypes/string-refs; helmet-async 3 + framer 12 + RR7 all support 19). To upgrade web to 19 you must first decouple it from the RN workspace (separate install / move mobile out of `workspaces`, or wait for an RN version that supports React 19). Reverted to react 18.3.1→18.2.0 (single deduped copy); build + 31/31 tests green.
- **tailwindcss 3 → 4** — CSS-first config rewrite (drop `tailwind.config.js` → `@theme`); visual-regression risk.
- **express 4 → 5** — routing/middleware + path-to-regexp v8 breaking across 16 route files.
- **multer 1 → 2** — upload-pipeline breaking (pairs with the deferred memory-storage/magic-byte refactor).
- **umzug 2 → 3** — `server.js:303-317` uses the v2 API; v3 is a full rewrite of the constructor/storage.
- **eslint 8 → 10** (+ eslint-plugin-react-hooks 7) — flat-config (`eslint.config.js`) migration.
- **react-helmet-async 2 → 3** — just integrated v2; defer to avoid re-breaking SEO without testing.

---

# Remediation Log (2026-06-15) — "fix all the problems" pass

All backend changes syntax-checked (`node --check`) clean. Pre-existing unit-test
failures (errorHandler AppError-signature + validators age tests, 9 tests) confirmed
present on the clean baseline via `git stash` — **not introduced by this pass**.

## P0 — fixed
- **WH-1 / REF-30** — `verifyBgCheckWebhook` now fails **closed** in production when the secret is unset (`bgCheckService.js`); env prod guard requires `BG_CHECK_WEBHOOK_SECRET` when a real provider is enabled (`config/env.js`).
- **SOCK-1 / SOCK-2 / MF-1 / REF-24** — group socket events (`join-group`/`group-send-message`) **disabled** (emit `FEATURE_UNAVAILABLE`); `leave-group` no-op. Closes the IDOR + message forgery until a real Group backend exists.
- **UTIL-1 / REF-16** — `razorpay.verifyPayment` now uses `crypto.timingSafeEqual` + length guard (`razorpay.js`).
- **FE-1 / REF-42 / FE-4** — `AdminProtectedRoute` + `ProtectedRoute` accept `['admin','super_admin']`; admin guard redirects straight to `/login`.

## P1 — fixed
- **VAL-1 / MF-3 / REF-18** — `send-otp`/`verify-otp` now validate `type`/`target` (email or E.164 phone) + 6-digit `code` (`authRoutes.js`).
- **SEC-1 / REF-38** — REST `extractToken` no longer accepts `?token=` (socket handshake unaffected) (`auth.js`).
- **WH-2 / BE-2 / REF-31** — rawBody captured for legacy `/api/verification/bg-check/webhook`; the unusable `JSON.stringify(req.body)` fallback removed (now 500s if rawBody missing).
- **WH-3 / REF-32** — bg-check adapters use a hex+length-guarded `safeHexEqual` before `timingSafeEqual`.
- **WH-4 / REF-33** — webhook reads only the configured provider's signature header (+ generic `x-signature`).
- **BE-5 / REF-15** — `paymentLimiter` (10/hr) added to `POST /verification/bg-check/initiate`.
- **PERF-1 / REF-49** — search `Profile.findAll` excludes 7 heavy JSONB cols unused by cards/compatibility (`searchController.js`).
- **UTIL-2 / REF-17** — `by-code` lookup uses an indexed UUID range (`Op.between`) + asserts a single match instead of a `LOWER(CAST())` seq scan.
- **DB-4 / REF-37 + DB-3 / REF-36** — migration **000038**: btree on income/height/manglikStatus + GIN on interestTags; drops the duplicate Messages index.
- **SEC-4 / REF-41** (partial) — `resource_type` pinned per endpoint (no more `'auto'`); `allowed_formats` tightened (images-only for photos). Cloudinary content-validates by decoding. *Full buffered magic-byte check still deferred (needs memory-storage refactor) — noted in CLAUDE.md.*
- **SEO-1/2 / REF-45** — `robots.txt` + `sitemap.xml` added to `frontend/public`.
- **SEO-5 / REF-48** — og:image/twitter:image repointed to existing `images/hero-couple.png` (was 404).

## P3 / cleanup — fixed
- **CTRL-1** — incognito now reads the **viewer's** preference and **skips** the view create (no create-then-destroy) (`profileController.js`).
- **CTRL-2** — view-dedup catch only swallows `SequelizeUniqueConstraintError`, rethrows the rest.
- **SOCK-3 / REF-26** — message deletion broadcast **authoritatively from REST** (`chatController.deleteMessage` via `app.set('io')`); client `message-deleted` event ignored.
- **SOCK-5 / REF-28** — `join-room` uses shared `checkSubscription` (single premium definition).
- **SOCK-6 / REF-29** — `typing` gated on mutual match.
- **SEC-2 / REF-39** — prod CORS rejects no-origin requests to the API; `/monitoring*` exempted for health probes (`server.js` + `security.js`).
- **SEC-3 / REF-40** — dead `ownsResource` guard removed.
- **ERR-1 / REF-20** — errorHandler routes through the structured single-line JSON logger.
- **ERR-2 / REF-21** — stopped shallow-spreading the caught Error (`let error = err`).
- **ERR-3 / REF-22** — Cloudinary errors classified by `http_code`/name, not message substring.
- **ERR-4 / REF-23** — `unhandledRejection` now shuts down (except the known recoverable Cloudinary rejection).
- **FE-2 / REF-43** — login/signup return the full user (with Profile); client skips the second `/auth/me` round-trip.
- **FE-3 / REF-1** — dead `frontend/src/pages/Signup.jsx` deleted.
- **DEP-1 / REF-8** — removed unused `concat-stream` (backend), `react-spring` + `react-swipeable` (frontend).
- **DEP-2 / REF-9** — dropped the `react-is@^19` pin from the React-18 frontend.
- **DB-1 / REF-34 + SEC-4 + REF-53** — CLAUDE.md corrected: quizAnswers migration (000028) exists, upload "magic-byte" claim fixed, Known Issues refreshed, migration count → 000038.

## Follow-up pass 2 (2026-06-15) — installs, migration, SEO, tests

- **Dependencies** — `npm install` run in backend + frontend (network available). Frontend pruned 9 pkgs (react-spring/react-swipeable/react-is + transitives); `concat-stream` confirmed now only a multer transitive (direct dep removed). Frontend `npm run build` ✅ — recharts works without the react-is pin.
- **Migrations applied to live DB** — `npm run migrate` ran 000034→000038. Verified: `idx_profiles_income/height/manglik_status/interest_tags_gin` present, duplicate `idx_messages_sender_receiver_created` dropped (DB-3/DB-4 live).
  - **Bonus fix:** migration **000036** (`create-success-stories`) had a non-idempotent `addIndex` that crashed on a drifted DB (`relation … already exists`). Made it `CREATE INDEX IF NOT EXISTS` — matches the rest of the codebase's re-run-safe pattern; unblocked 000037/000038.
- **SEO-3 / REF-46 — DONE** — added `react-helmet-async` (installed), `HelmetProvider` in `main.jsx`, reusable `components/common/Seo.jsx` (per-route title/description/**canonical**/og/twitter). Wired into 8 public pages (Home, About, Contact, Safety, Privacy, Terms, SuccessStories, Login). Removed the now-duplicated static canonical/og/twitter title-description-url + name=description from `index.html` (kept title fallback, og:type, og:site_name, twitter:card, JSON-LD). Fixes the canonical-pinned-to-`/` deindexing. Build ✅.
- **QA-1 (partial) — DONE** — `frontend/src/tests/components/routeGuards.test.jsx`: 7 RTL tests for AdminProtectedRoute + ProtectedRoute, including explicit **FE-1 super_admin regression** coverage. Frontend suite now 31/31 green.
- **QA-2 (partial) — DONE** — `backend/tests/unit/razorpay.test.js` (timing-safe verify, length guard — UTIL-1) + `backend/tests/unit/bgCheckWebhook.test.js` (fail-open dev vs **fail-closed prod** — WH-1). 7 new tests, all green (backend unit now 99 passing; the 9 failures are the pre-existing stale suites).

## Deferred (with reason) — still tracked
- **SEO-4 / REF-47** prerender/SSR — `react-helmet` only helps JS-rendering crawlers (Googlebot); social scrapers still need prerender. Deferred (flaky tooling, lower ROI than the canonical fix).
- **QA-1/2/3 remainder** — broader FE page tests, full payment/webhook/socket integration (needs test DB seeding), authed e2e journeys — large net-new authoring; seeded the highest-value regression tests above.
- **npm audit vulns — TRIAGED (2026-06-16)** — see dedicated section below.
- **REF-3 (ARCH-2/DEP-4) — DONE (2026-06-16):** removed nested backend/frontend lockfiles + node_modules, reinstalled hoisted from root (single `package-lock.json`), gitignored `*/package-lock.json`. Unblocked the scoped `ws` override → fixed the ws DoS high. Build + all tests green after.
- **REF-12 (BE-1)** collapse `/api`+`/api/v1` double-mount — risky for live web/mobile clients; rawBody asymmetry (the actual bug) fixed via REF-31 instead.
- **REF-13 (BE-3)** standalone webhook sub-router, **REF-14 (BE-4)** monitoring mount/limiter — low-value infra churn; health-probe behavior must be preserved.
- **REF-27 (SOCK-4)** socket.io Redis adapter — needs new dependency + multi-instance infra.
- **REF-41** full buffered magic-byte — needs memory-storage upload-pipeline refactor.
- **REF-46/47 (SEO-3/4)** react-helmet-async per-route meta + prerender/SSR — needs new deps (`npm install` unavailable here) + per-page edits.
- **REF-3/4/5/6/7/10/11 (ARCH/ENV)** lockfile/shared/version-align/controller-extraction/env-centralization — larger refactors; install-affecting.
- **QA-1/2/3** net-new FE component tests, backend integration (payment/webhook/socket), authed e2e journeys — large net-new test authoring.
- Pre-existing stale unit tests (errorHandler AppError signature, validators age range) — predate this pass; left for a dedicated test-fix chunk.
