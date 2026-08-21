# Deep Security Audit — Round 1

**Date:** 2026-08-21
**Branch:** `security/deep-audit-2026-08-21` (4 commits, **not merged, not deployed**)
**Scope:** full-stack — backend, database, infrastructure, CI/CD, secrets, git history, client code
**Testing:** local exploitation with real proof-of-concept; non-destructive production probes only

This is the second security pass on this codebase. The first (2026-08-20, 34 findings) fixed
what it looked at. This one asks what it did not look at.

---

## Headline

**One live High-severity data disclosure is currently in production.** `GET /profile/:userId`
returns the target member's entire subscription row — including `razorpaySignature`,
`razorpayPaymentId`, `razorpayOrderId`, the amount paid and their remaining contact-unlock
quota — to any authenticated viewer who opens their profile. Confirmed against
`https://tricitymatch.com` during this audit. **The fix is on this branch and is not deployed.**

Everything else found here is either not currently exposed, or is a hardening gap rather than a
live hole.

---

## Method

Reconnaissance ran as three parallel read-only inventories (backend authorization surface,
secrets/infrastructure, database/PII) plus a full git-history secret scan over every blob.
Findings were then reproduced against a local stack before being fixed; each regression test
was confirmed to **fail** against the pre-fix code, so no test in this branch is vacuous.

**Environment constraint, stated plainly:** there is no Docker CLI on this machine. Postgres,
Redis and the backend run natively, so the application and database work is fully exercised —
but the compose and monitoring-stack changes are **reviewed configuration that could not be
booted here**. Each is marked accordingly below. They need `docker compose config` on a host
with Docker before deploy.

---

## What was verified CLEAN

Stating these explicitly, because a clean result is a finding too:

| Area | Result |
|---|---|
| **Git history** | **No live credential has ever been committed.** Four `.env` files existed in the initial commit and were deleted; all values were placeholders apart from `DB_PASSWORD=root` and a dev JWT secret. Verified twice — by hand and by a scanner run over every blob in history. |
| **SQL injection** | All 11 raw-SQL call sites use bound `replacements`. No string interpolation of user input anywhere. |
| **Mass assignment** | Zero occurrences of `...req.body`, `Model.create(req.body)`, `instance.update(req.body)` or `Object.assign` in controllers, routes, utils or middlewares. `PROFILE_EDITABLE_FIELDS` is enforced in two independent places. |
| **Code execution / traversal** | No `eval`, `new Function`, `child_process`, or dynamic `require` of user input. Every `path.join` uses constants. |
| **Payment integrity** | Webhook HMAC is timing-safe over the raw body; plan and price are read from the locked pending row, never from the client; idempotency and replay protection are in place with partial unique indexes on both `razorpayPaymentId` columns. |
| **IDOR on param routes** | Every `:id`/`:userId` handler resolves ownership server-side. No unguarded route found. |
| **Production TLS** | TLS 1.2/1.3 only; 1.0 and 1.1 refused; valid Let's Encrypt certificate (expires 2026-10-26). |
| **Production auth gates** | admin, marketing, profile, search, chat and `monitoring/health/full` all return 401 unauthenticated. |
| **Production cookies** | `HttpOnly; Secure; SameSite=Strict`, 15-minute access / 7-day refresh. |
| **Co-tenant safety** | The five co-tenant sites returned 200 before, during and after every probe. |

---

## Findings

Severity reflects real exposure, not theoretical worst case.

### H-1 · Subscription and payment disclosure on every profile view · **LIVE IN PRODUCTION**

`GET /profile/:userId` built its query with a `Subscription` association nested under `User`.
Nothing read it — the target's plan is re-fetched separately later as `targetSubscription` —
but the handler returns `profile.toJSON()`, so Sequelize serialised the whole row into the
response.

Every authenticated viewer opening any profile received that member's `planType`, `amount`,
`startDate`, `endDate`, `autoRenew`, `razorpayOrderId`, `razorpayPaymentId`,
`razorpaySignature`, `contactUnlocksAllowed` and `contactUnlocksUsed`.

`razorpaySignature` is the HMAC over `orderId|paymentId`. Returning it beside both identifiers
discloses the complete verified triple.

**Reproduced** over HTTP locally against a seeded VIP member: the vulnerable build returned
the full row (`planType: "vip"`, `amount: "7499.00"`); the fixed build returns
`User` keys `["id","status"]` and nothing else. **Confirmed live in production** — the response
shape still contains `profile.User.Subscriptions`.

**Fixed** — association removed; `getProfile` now calls the shared `assertProfileVisible`
helper it had been duplicating. Regression test verified to fail on the old code.

### H-2 · Monitoring stack published six unauthenticated services, one mounting the host filesystem

`monitoring/docker-compose.monitoring.yml` bound Prometheus, Grafana, Alertmanager and three
exporters to `0.0.0.0` with no authentication; ran Prometheus with `--web.enable-lifecycle`
(unauthenticated `POST /-/quit` and `/-/reload`); defaulted Grafana to `changeme`; and mounted
`/:/rootfs:ro` into node-exporter — the entire host filesystem, on a VPS shared with five
co-tenant sites, exposed to anything that could reach port 9100.

**Not currently deployed** (nothing in the repo references this file; every document points at
the root compose's `--profile monitoring`, which was already correctly hardened). It was a
loaded gun on the shelf, not a wound.

**Fixed** — file deleted, the three exporters ported into the root compose with loopback binds,
no host-root mount, `cap_drop: ALL`, `read_only`, and a dedicated `pg_monitor` role instead of
the application's superuser credentials. *Reviewed, not booted — no Docker here.*

### H-3 · Raw refresh tokens stored in the database

`RefreshTokens.token` held the **raw** refresh token beside its SHA-256 hash. Every lookup
already used `tokenHash`, so the column was dead weight with a live blast radius: any database
dump yielded directly replayable session credentials for their full 7-day lifetime. The code
comment asserted "raw token exposure on DB breach is limited" — it was not.

**Reproduced:** 733 rows on the development database, including unrevoked and unexpired ones.

**Fixed** — migration `000056` nulls every value and makes the column nullable; the model hook
now derives the hash and discards any raw token supplied. Verified live: login, refresh
rotation and authenticated requests all work with zero raw tokens stored.

### H-4 · `DELETE /auth/account` deleted nothing

It set `User.status='deleted'` and destroyed refresh tokens. Everything else persisted
indefinitely: the profile (exact date of birth, birth time, place of birth, caste, sub-caste,
gotra, income, photos, voice and video intro URLs), the KYC selfie and liveness video, every
message, and `GuardianLinks` holding the name and phone number of a parent or relative **who
never signed up and never consented to an account at all**.

For an endpoint that tells the member their account is deleted, and under a statute (DPDP) that
grants a right to erasure, this is the most serious non-exploit finding in the audit.

**Fixed** — `utils/accountErasure.js` performs real erasure in one transaction. Verified end to
end on a throwaway account seeded across every table.

### M-1 · Admin seeder reset the live admin password to a published value

`adminSeeder.js` defaulted `ADMIN_PASSWORD` to `Pass@1234` — a value published in tracked
project documentation — and re-hashed it onto an **existing** admin on every run. A routine
`node backend/seeders/adminSeeder.js` silently reset the production admin login to a public
password. Separately, the data seeders had no production guard at all: `db:seed:all` against
production would have created 30+ accounts sharing one published password.

**Fixed** — production requires an explicit strong password with no default; an existing
password is never touched unless `ADMIN_SEED_RESET_PASSWORD=true`; data seeders refuse to run
in production. All four behaviours proven.

### M-2 · Seven production environment guards missing

`config/env.js` had no validation whatsoever for `CSRF_SECRET` (and compose never passed it
through, so production ran with it empty), no bcrypt cost floor, no rejection of the
development database name, no signal when `DB_DISABLE_SSL=true` turned off database TLS, no
rejection of a localhost `CORS_ORIGIN`, no `REDIS_PASSWORD` requirement, and no check that the
three signing secrets differ.

Worse, the `COOKIE_SECRET` shipped in `.env.example`
(`another-secure-random-string-for-cookies`) contained none of the placeholder tokens and
cleared the 32-character bar, so **copying the template into production booted with a
publicly-known cookie secret.**

**Fixed** — all seven guards added and each proven to fire, then proven to boot clean once
satisfied. Placeholder detector widened. 19 tests now pin this file.

### M-3 · Redis ran with no password by default

`docker-compose.yml` defaulted `REDIS_PASSWORD` to empty, which silently dropped
`--requirepass`. Redis holds plaintext OTP codes, login-lockout counters and cached profile
payloads, readable by any container on the same bridge network.

**Fixed** — required in compose and fatal at boot in production. *Compose change reviewed, not booted.*

### M-4 · Socket presence probe across the entire user table

`get-online-status` answered for any user id, with no relationship check and without honouring
the target's own `showOnlineStatus` setting. Any authenticated socket could build a live
activity profile of a chosen member.

**Fixed** — limited to mutual matches with the setting enabled; unauthorised ids are omitted
rather than reported `false`, so the reply cannot distinguish "offline" from "not allowed".

### M-5 · Rate limiting gaps

- `/monitoring` is mounted **outside** `app.use('/api', apiLimiter)` and was entirely
  unthrottled, while `/health/ready` performs a live database `authenticate()` plus a Redis
  round trip per call. **Not currently exposed in production** — verified during this audit
  that the host nginx proxies only `/api/`, so `/monitoring/*` on the public domain falls
  through to the SPA and never reaches the backend. Real in code, and it would bite immediately
  under the compose topology or if anyone adds a proxy rule.
- No limiter at all on `DELETE /auth/account` (a password oracle), `POST /astrologers/book`
  (mints a live Razorpay order per call), `GET /profile/me/biodata` (PDF render plus an
  outbound fetch), `GET /match/daily`, `PUT|DELETE /chat/messages/:id`, `PUT /calls/:id/*`,
  `POST /guardian/invite` and the saved-search writes.
- All limiters used the library's in-process `MemoryStore`, so every counter reset on restart
  and the effective ceiling multiplied by replica count — while the account-lockout control had
  already been moved to Redis for exactly that reason.

**Fixed** — all gaps closed; counters moved to Redis with automatic fallback. Verified: 120
requests pass then 429; Redis store counts correctly, pins the window from the first hit, and
is shared across instances.

### M-6 · Dependency vulnerabilities, and a stale clean bill of health

`npm audit` reported **31 high + 1 critical**, against a `CLAUDE.md` claim of "0 high / 0
critical". Attribution matters more than the number: most are the Expo/React Native toolchain
and build tools. But **`ip-address` reaches the backend at runtime through `express-rate-limit`**,
and its advisory is IP-parsing confusion (leading-zero octets, CIDR suffixes, IPv4-mapped IPv6)
enabling trust-boundary bypass — in an application where every limiter and the account lockout
key off IP.

**Fixed** — same-major patched versions pinned via `overrides` (the pattern already used here
for `ws`/`cloudinary`). **Backend production high 4 → 0. Frontend 3 → 0.** Verified no
platform-specific packages were dropped from the lockfile, which is a known hazard in this repo.

### M-7 · Log redaction bypasses

- `/guardian/resolve-invite/` carries a 32-byte bearer token in the URL path and was missing
  from `SECRET_PATH_PREFIXES`, so every 4xx/5xx logged it verbatim.
- The production request logger wrote `req.originalUrl` **raw**, bypassing `redactUrl`
  entirely — precisely the case that function exists for.
- OTP and email-change codes are interpolated into the log *message string*, where the redactor
  cannot reach them. The gates were `!isProduction`, which is also true for `staging`, `qa` or
  any unrecognised `NODE_ENV`.

**Fixed** — all three.

### M-8 · Reset-token single-use check was optional

The password-reset fingerprint check was `if (decoded.pwdFp)`, so a token that simply **omitted
the claim** skipped it entirely and stayed reusable for its full hour.

**Fixed** — absence of the claim is now fatal, and the comparison is timing-safe.

### M-9 · Message retention job had never deleted a single row

The nightly cleanup filtered on `Messages.deletedAt` — a column that does not exist and that no
migration ever created. Chat bodies, voice-note URLs and reply quotes are retained forever.

**Fixed** — job corrected and made opt-in via `MESSAGE_RETENTION_MONTHS`. Deliberately opt-in:
retention is a policy decision, and silently destroying conversation history is not a change to
make unprompted.

### M-10 · No database-level integrity constraints

Every invariant lived in JavaScript. The self-match rule in particular was a `beforeCreate`
hook that the **actual** insert path — a raw `INSERT ... ON CONFLICT` in `matchController` —
never ran.

**Fixed** — five CHECK constraints added, each proven to reject its violation including through
the raw-SQL path. Added `NOT VALID` so they enforce on new rows without scanning legacy ones,
because production auto-runs migrations on boot and a failing validation would take the service
down. The `subscriptions_active_has_end_date` constraint closes a real hole: an active row with
a NULL `endDate` was a permanent paid plan the hourly expiry job could never see.

### M-11 · Unencrypted database backups on the database host

The backup path produced a plaintext dump — a complete copy of every unencrypted PII column in
the system — on the same host as the database, on a shared VPS. gzip is compression, not
encryption.

**Fixed** — `scripts/backup-db.sh` encrypts to an age **public** key (the server can back up but
cannot decrypt), never writes plaintext to disk, refuses to run without a recipient, and has a
`--verify` mode that restores into a scratch database. Verified end to end with a stubbed `age`
binary; **the real age crypto round trip is untested here — `age` is not installed on this machine.**

### M-12 · Application connects to Postgres as the database owner

Any injection or RCE in the Node process yields `DROP DATABASE`, `COPY ... TO PROGRAM` and an
unrestricted `UPDATE "Users" SET role='super_admin'`. This audit found no injection; least
privilege is what decides how bad the next one is. `scripts/init-db.sql` already had the right
idea commented out — and its `GRANT ALL` was too broad anyway.

**Written, NOT applied** — `scripts/db-least-privilege.sql` splits owner / runtime / metrics
roles with post-cutover verification queries. Requires a deliberate cutover.

### L-1 · Weak referral-code entropy

`Math.random().toString(36)` — roughly 20 bits from a non-cryptographic PRNG, for a value that
carries attribution and reward credit. **Fixed** — `crypto.randomBytes` over a 32-symbol
unambiguous alphabet (30 bits).

### L-2 · Unbounded queries

The verified-only search `SELECT`ed every approved verification in the system into an `IN (...)`
list — linear in the user base, reachable at 30 requests/minute. **Fixed** with a correlated
`EXISTS`; verified the result count is unchanged against ground truth.

`getConversations` parsed `limit` with no clamp. **Corrected from the recon report: this was NOT
exploitable** — the route's `paginationRules` already rejects >100 with a 400, confirmed live.
Clamped anyway as defence in depth.

### L-3 · CI/CD is broken and, where it is not, ungated

`deploy.yml` calls `ci.yml` as a reusable workflow, but `ci.yml` declares no `workflow_call`
trigger, so **neither workflow can run**. `ci.yml` also requires `backend/package-lock.json`,
which is gitignored and absent. Every quality and security gate is suffixed `|| true`, so the
"Security Scan" job is incapable of failing. `deploy.yml` hands the production SSH private key
to a mutable-tag third-party action and runs `docker system prune -f` on the shared VPS, in
direct violation of the project's own operating rules.

**Not fixed in Round 1 — carried into Round 2.** These are latent (nothing runs), but must be
fixed before the pipeline is ever revived.

### L-4 · Minor

- `X-Frame-Options: DENY` and CSP `frame-ancestors 'self'` disagree in production; browsers
  prefer the CSP, so same-origin framing is permitted despite the header.
- The production CSP still pins an inline script by `sha256-ap57…` that no longer exists —
  harmless dead config, confirmed live.
- `/api/monitoring/health` exposes `uptime` and `pid` unauthenticated.
- UUID shape validation was missing on several param routes, turning malformed input into an
  unmapped 500 instead of a 400. **Fixed** for call and saved-search routes.

---

## Key rotation

**Rotate now — live values in reachable places:**

| Credential | Why |
|---|---|
| **Cloudinary API secret** | Live production-tenant secret in a file named `.env.development` |
| **Resend API key** | Same file — this key sends mail as your domain |
| **MSG91 `SMS_API_KEY`** | Same file — SMS billed to you |
| **Hostinger API token** | Pasted in chat during the 2026-08-20 session; still open |
| **Admin password** `Pass@1234` | Published in tracked `CLAUDE.md`, was the seeder default, used by three scripts |
| **Prod QA account** `TricityQA@2026` | Published in tracked `CLAUDE.md` |
| **Seeded account password** | Was tracked in four seeder files (now untracked) |

**Hygiene, no evidence of exposure:** production `JWT_SECRET` and `COOKIE_SECRET`. Note
`JWT_SECRET` also signs password-reset tokens, so one compromise is total; rotation logs
everyone out.

**No rotation needed:** Razorpay live keys, Agora certificate, Firebase credentials, Google
OAuth secret. None ever touched the repository or its history — verified against every blob.

---

## Owner actions

1. **Deploy this branch** — H-1 is live in production right now.
2. Rotate the seven credentials above.
3. Run `docker compose config` on a host with Docker to validate the compose changes.
4. Decide on `MESSAGE_RETENTION_MONTHS` (currently retains forever, but now says so).
5. Schedule the least-privilege database cutover (`scripts/db-least-privilege.sql`).
6. Provision an age keypair for backups; keep the private key **off** the server.
7. Move the operational half of `CLAUDE.md` (VPS IP, root login, co-tenant inventory, bound
   ports, both passwords) into an untracked ops note. As it stands the file is a targeting
   package.

---

## Gates

| Gate | Result |
|---|---|
| Backend Jest | **413 passed** (up from 393; 20 new security tests) |
| Frontend Vitest | **118 passed** |
| eslint | 0 errors |
| Secret scan — tracked | clean |
| Secret scan — full history | clean |
| Migration `000056` | applied and verified on dev |
| Production probes | all gates 401; co-tenants 200 throughout |

The 4 failing backend integration tests require a live test database and fail identically on
unmodified code. Verified by running them against a clean checkout.
