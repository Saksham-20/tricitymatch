# Deep Security Audit — Round 2

**Date:** 2026-08-21
**Branch:** `security/deep-audit-2026-08-21` (8 commits, **not merged, not deployed**)
**Scope:** the categories that only surface once the obvious layer is clean — business logic,
concurrency, long-lived connections, second-order injection, supply chain, and Round 1's own fixes
**Testing:** live exploitation against a local stack running this branch, plus non-destructive
production probes

Round 1 worked through an inventory. Round 2 assumed Round 1 was wrong until proven otherwise, and
went after what nobody has ever attacked.

---

## Headline

Two things matter most from this round.

**First: Round 1 shipped a fix that was never wired.** It added `sensitiveActionLimiter` to
`guardianRoutes.js`'s import list and added `/guardian/resolve-invite/` to the log-redaction
prefixes — and never put the limiter on the route. The import sat unused. The commit read as
complete. The 32-byte bearer token in that URL was still guessable at the global rate. This is the
second consecutive audit in which a fix contained its own defect, and it is the strongest argument
in this document for asserting on wiring rather than on intent.

**Second: the invite reward was a free-unlock printer.** `rewardInvite()` credited 3 contact
unlocks to both sides of an accepted invite with no eligibility conditions whatsoever. Signup does
not require a verified contact, and nothing capped how many invites one member could be rewarded
for — so a member could point their own invite link at throwaway signups and mint unlocks
indefinitely. Contact unlocks *are* phone numbers, so this is the same directory-export outcome the
unlimited-tier daily cap was added to prevent, reached by a different door.

**Still live in production and unfixed there:** everything on this branch, including Round 1's
High. Re-confirmed during this round against `https://tricitymatch.com`:

| Check | Production today |
|---|---|
| `GET /profile/:userId` → target's subscription rows | Still serialized (`User.Subscriptions` key present in the response) |
| Login response | Still returns `fcmTokens` and `googleId` |
| `GET /groups/not-a-uuid` | Still `500` |
| `/api/monitoring/health/full` unauthenticated | `401` — Round 1's earlier deploy holds |

---

## Method

The local stack (Postgres, Redis, backend) was run twice: the pre-existing process on `:5001` was
serving `main`, which made it a live baseline for reproducing bugs, and a second process on `:5055`
ran this branch to verify each fix. Every regression test added here was run against the pre-fix
file (restored with `git show HEAD:<path>`) and confirmed to fail before being accepted.

Production probes were read-only, used the project's own QA account, and were bracketed by
co-tenant checks: `edumapping.com`, `school.globoniks.com` and `tricitylifeinsurance.com` returned
`200` before and after.

**One operational mistake to disclose:** while cleaning up the alt-port process I killed the
long-running dev backend on `:5001` that was already there when this session started. I restarted
it immediately, but it now runs this branch's code rather than the `main` build it was serving
before. Nothing was lost; the process was simply replaced.

---

## Findings

Severity reflects exploitability against production as it stands.

### R2-1 · HIGH · Invite reward could be farmed without bound
`backend/utils/inviteReward.js` · `backend/controllers/authController.js:222-233, 297-304`

`rewardInvite(newUserId, inviterId)` credited `INVITE_REWARD_UNLOCKS()` (default 3) contact unlocks
to **both** parties, gated on nothing but `credits > 0`.

Two facts combine into the flaw:

1. **Signup does not require a verified contact.** The `otp-verified:*` markers are consumed
   opportunistically — if present the account is stamped verified, if absent the account is created
   anyway (`authController.js:222-233`). So a throwaway account costs nothing but an email address.
2. **No cap on rewarded invites.** `invitedBy` was set and the reward paid, however many times.

A member could therefore sign up accounts against their own invite link and collect 3 unlocks each,
forever. The signup limiter (3/hr/IP) sets the *rate*, not a ceiling, and does not survive address
rotation. Because a contact unlock reveals a phone number, this converts directly into the bulk
directory export that `UNLIMITED_DAILY_UNLOCK_CAP` exists to prevent.

**Fixed** with two gates, neither reachable by a genuine invited member:

- the new account must have a verified email or phone (both shipped clients create-after-verify, so
  a real invitee always passes);
- a lifetime ceiling per inviter, `INVITE_REWARD_MAX_PER_INVITER` (default 20).

The eligibility check **fails closed** — if it cannot run, nothing is paid out.

**Tests:** `backend/tests/unit/inviteRewardAbuse.test.js` (7). Five failed against the old file.

---

### R2-2 · MEDIUM · Rolling 24h unlock cap was bypassable by concurrency
`backend/middlewares/auth.js:281-297` · `backend/controllers/profileController.js:842-875`

For unlimited tiers (`contactUnlocksAllowed === null`), `checkContactUnlockLimit` counted the
member's last-24h `ContactUnlock` rows **before** the handler ran and **outside any transaction**,
then called `next()`. N parallel requests all read the same under-cap figure and all proceeded.

The finite-quota path was already race-safe — it consumes with a single conditional `UPDATE` and
inserts with `ON CONFLICT DO NOTHING ... RETURNING`, both added in an earlier pass. This is the
branch that returns early, and it was the one protecting the harvest ceiling.

**Fixed** by re-checking inside the transaction after taking a row lock on the member's own
subscription. The lock is held to commit, so a member's concurrent unlocks serialise and each one
counts what the previous committed. The row for the current request is already inserted at that
point, so the comparison is `> cap`, not `>= cap`.

---

### MEDIUM · Socket authorization was answered once, at connect
`backend/socket/socketHandler.js`

`authenticateSocket` rejects a non-active account when the socket opens. Sockets are long-lived and
never re-present their token, so a member banned, suspended or self-deleted **after** connecting
kept a fully privileged channel — joining rooms, relaying typing, receiving broadcasts, probing
presence — until they chose to disconnect. Not even the 15-minute access-token expiry bounded it,
because nothing re-read it.

**Fixed** with `ensureStillActive(socket)`: re-reads the row before any gated action, caches the
result 60 s per socket so a chatty client costs at most one lookup per window, disconnects on a
non-active status, and fails closed if the lookup itself errors.

**Also on this handler:**

- `join-group` ran a `GroupMember` lookup per emit with **no rate limit** — its config entry existed
  in `RATE_LIMITS` but nothing called `checkRateLimit` for it. Any authenticated socket was a
  database query amplifier. Now limited, as are `leave-room` and `leave-group`.
- `join-group` accepted any string as a group id, so every malformed emit cost a Postgres round-trip
  to raise `invalid input syntax for type uuid`. Now shape-checked first.
- `join-room` called `.split()` on whatever it was handed; a non-string threw into the catch. Now
  type-checked with a proper `INVALID_ROOM` response.

**Tests:** `backend/tests/unit/socketRevocation.test.js` (7). Five failed against the old file.

---

### MEDIUM · Round 1 imported a limiter and never applied it
`backend/routes/guardianRoutes.js:250`

Round 1 added `sensitiveActionLimiter` to this file's import list, and added
`/guardian/resolve-invite/` to `SECRET_PATH_PREFIXES` so the token stops appearing in logs. It never
applied the limiter to the route. `POST /guardian/resolve-invite/:token` kept only the global
`apiLimiter` — 200 requests per 15 minutes per address against a 404-vs-200 oracle on a bearer
secret.

An imported-but-unapplied middleware is invisible to any test that exercises behaviour through a
mocked chain, which is why this survived a full round. `backend/tests/unit/limiterCoverage.test.js`
now asserts on the wiring itself:

- named sensitive and expensive routes must carry their specific limiter;
- **no route file may import a `*Limiter` it does not use** — the exact shape of this miss.

---

### MEDIUM · `delPattern` ran `KEYS` on the profile-write path
`backend/utils/cache.js:172-193`

`redisClient.keys(pattern)` is O(N) over the entire keyspace and blocks Redis's single command
thread while it runs. `invalidateUser()` calls it twice per `PUT /profile/me`, so any authenticated
member could stall sessions, rate-limit counters, OTP state and every cached profile for all other
users by saving their own profile in a loop — and the cost grows precisely as the product grows.

**Fixed** with a cursor-walked `SCAN` (`COUNT 500`) and `UNLINK`, falling back to `DEL`.

The in-memory fallback had a second defect: the glob was compiled as
`new RegExp(pattern.replace(/\*/g, '.*'))` — **unanchored**, so `user:1:*` matched any key merely
*containing* that fragment, and any regex metacharacter in a key fragment widened the match further.
Now anchored and metacharacter-escaped.

The module's cleanup `setInterval` is now `unref`'d; it was holding Jest workers open.

**Tests:** `backend/tests/unit/cacheScan.test.js` (6). Five failed against the old file. The
source-level ban on `KEYS` is deliberate — a behavioural assertion would not catch it being
reintroduced behind a branch the suite does not enter.

---

### MEDIUM · Android App Link on the password-reset path
`mobile/app.json`

`app.json` declared an intent filter with `autoVerify: true` for
`https://tricitymatch.com/reset-password`.

Probed against production: **neither `/.well-known/assetlinks.json` nor
`/.well-known/apple-app-site-association` is served** — both return `403` from the host nginx.

An App Link that cannot verify does not fail safe. It degrades to an ordinary intent filter, so any
installed application declaring the same host and path can appear in the chooser for a link that
carries a single-use password-reset token.

**Fixed** by removing the reset path from the filter — it bought nothing while unverified, and
`/profile` (which carries no secret) stays. `ios.associatedDomains` was added so Universal Links
work once the AASA file is actually served. A placeholder `assetlinks.json` with a fake fingerprint
was deliberately **not** shipped; the runbook is below.

---

### LOW · Framing policy contradicted itself
`backend/middlewares/security.js:288-305` · `nginx/conf.d/security-headers.conf:24` · `nginx/nginx.conf`

Production sends `X-Frame-Options: DENY` **and** `frame-ancestors 'self'` in the CSP. CSP
frame-ancestors supersedes the header in every modern browser, so the effective policy was
"same-origin framing permitted" while the header advertised DENY. Helmet defaults the directive to
`'self'` and it had never been set explicitly. Two headers disagreeing about framing is also the
condition under which some browsers have historically dropped the protection entirely — the same
class of problem Round 1 found when the SPA container sent `SAMEORIGIN` against the host's `DENY`.

Nothing frames this application; Razorpay is framed **by** it, via `frame-src`.

**Fixed** to `'none'` in the backend CSP and in the shared nginx snippet; `nginx/nginx.conf`'s three
remaining `SAMEORIGIN` headers aligned to `DENY`. Note that the compose `nginx` service is not what
runs in production — the host site file is — so the host needs the same one-line change (runbook
below). **Tests:** `backend/tests/unit/frameAncestors.test.js` (4).

---

### LOW · Outbound email interpolated names into HTML unescaped
`backend/utils/email.js`

Seven branded templates put a member's name, a matched member's name, an admin's free-text
rejection reason, or a security-alert detail into an HTML document delivered to somebody else's
inbox.

**Not exploitable as shipped.** `signupValidation` and `updateProfileValidation` both restrict
`firstName` to `/^[a-zA-Z\s'-]+$/`, so no tag can be stored through either path.

But that regex was the *only* control on the path, and the Google sign-in branch writes `given_name`
straight off the ID token without ever running it (`authController.js:980`) — and the account holder
controls their own Google display name. A single-control dependency on a template that reaches other
people's inboxes is not somewhere to rely on validation alone.

**Fixed**: everything crossing into a template is escaped, and the Google path now holds names to the
same charset and length as a native signup. **Tests:**
`backend/tests/unit/emailTemplateEscaping.test.js` (9). Eight failed against the old file; the ninth
was `supportReply`, which already escaped.

---

### LOW · Malformed UUID returned 500 carrying the driver's message
`backend/routes/{astrologer,group,guardian}Routes.js` — 18 routes

Reproduced against the running `main` build:

```
GET /api/v1/groups/not-a-uuid
500 {"code":"INTERNAL_ERROR","message":"invalid input syntax for type uuid: \"not-a-uuid\""}
```

Production returns the same 500 with a generic message. Three route files had no param validation at
all. **Fixed** — verified live on this branch: both now return `400 Validation failed`.

---

### LOW · Expensive reads sat behind the global ceiling only
`backend/routes/profileRoutes.js`

`expensiveReadLimiter` was applied to `/me/biodata` alone. The kundli PDF
(`/:userId/horoscope-match/pdf`) is the heaviest request in the application — a full Ashtakoot
computation plus a pdfkit render, streamed — and it, `/compatibility` and `/horoscope-match` were all
reachable 200 times per 15 minutes per address. Now covered.

---

### LOW · Cloudinary file rejections were reported as 502
`backend/middlewares/errorHandler.js:181-203`

Reproduced live: `PUT /profile/me` with a `.jpg` whose bytes are HTML returned
`502 SERVICE_UNAVAILABLE`, plus (in development) a message telling the caller to check
`CLOUDINARY_CLOUD_NAME`.

Cloudinary answers `http_code` 400 when it rejects the **file** — its decode-validation working
exactly as intended. Reporting that as 502 tells the client the upload is retryable, and tells the
operator the provider is down when in fact a malicious upload was blocked.

**Fixed** by splitting on the provider's own status: 4xx becomes a 400 with a plain message, 5xx keeps
the existing 502 path. Verified live: the same request now returns 400.

---

### LOW · Unbounded FCM token length; report description type confusion
`backend/controllers/notificationController.js:94-110` · `backend/controllers/blockReportController.js:96`

`POST /notifications/fcm-token` checked a *minimum* length but no maximum, so a member could park ten
multi-megabyte strings in a JSONB column that every push fan-out reads. Capped at 512 (real tokens
are ~150-200 characters).

`reportUser` did `description?.substring(0, 1000)`; a JSON body can send a number or an array there,
and `.substring` on either is a TypeError → 500. Now a `typeof` guard.

---

### INFO · CSV export quoting
`backend/controllers/adminController.js:607-620`

`csvSafe` already prefixed cells starting `= + - @ |`. It did not treat a leading TAB or CR as a
formula lead-in, and did not RFC4180-quote. Every column it feeds today is a date, an enum or a
number, so this was not exploitable — but it is the function that gets reused for a user-supplied
column later. Hardened.

---

### INFO · Root `.npmrc` had a blanket suppression with no stated reason

`legacy-peer-deps=true` sat at the workspace root, silently suppressing peer conflicts in **every**
workspace rather than the one that needs it. Left in place — `npm install` fails without it while
mobile pins `react@18.2.0` — but the reason and the cost are now written down in the file.

---

## Verified clean — reported as not-found rather than silently dropped

These were on the Round 2 target list, were actually tested, and produced nothing.

**SSRF via the biodata photo fetch.** `fetchBiodataPhoto` does perform an outbound `fetch` of
`profile.profilePhoto` and returns the bytes inside a PDF the caller receives — a textbook read-SSRF
shape *if* the URL were attacker-controlled. It is not. `PROFILE_EDITABLE_FIELDS` excludes both
`photos` and `profilePhoto`, and the "set as profile photo" branch only accepts a URL already present
in the member's own gallery, which is populated exclusively from `req.files`
(`profileController.js:322-328`).

**Stored / DOM XSS on the web.** Zero occurrences of `dangerouslySetInnerHTML` anywhere in
`frontend/src`. Outbound social links are normalised server-side (`utils/socialLinks.js` `toSafeUrl`
rejects every non-`http(s)` scheme) and sanitised again client-side before becoming an `href`.

**Cross-token-type confusion.** `resetPassword` asserts `decoded.type === 'password_reset'`; the
`auth` middleware asserts `decoded.type === 'access'`. Both tokens are signed with the same secret,
so this is the control that matters, and it is present on both sides. Round 1's single-use
fingerprint check (`!decoded.pwdFp` now fatal) is intact.

**Contact-detail IDOR.** A premium viewer receives no phone or email for a member they have not
unlocked. Confirmed live against a target with `showPhone = true` and no `ContactUnlock` row. An
earlier apparent leak in testing was a pre-existing unlock row between that pair.

**Authorization matrix.** 43 routes × {anon, free, premium, marketing, admin}, machine-generated and
executed against a running build of this branch — including the premium-positive case, which
required repairing a seeded subscription row whose `endDate` had lapsed. No route was reachable by a
role that should not reach it. Admin routes refuse every non-admin with 403; the marketing portal
refuses members and admins alike outside its own role; an inactive marketing account cannot even log
in (403 at `/auth/login`).

**Upload polyglots.** Three payloads (`.jpg` containing HTML; `GIF89a` + HTML named `.gif`; JPEG
magic bytes + HTML) were all rejected — by the MIME/extension filter, by the magic-byte check on
disk-stored uploads, and by Cloudinary's decode validation respectively. `/uploads` is served with
`X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'`.

**Fail-open error handling.** The Google Play verification path, the Razorpay verification path and
the subscription webhook all throw on failure rather than defaulting to success. The only
swallowed error on a payment path is the confirmation *email*, which is explicitly after activation.

**TLS.** TLS 1.2 and 1.3 only (1.1 refused), valid Let's Encrypt certificate to 2026-10-26, HSTS
with `preload`, HTTP/2.

---

## Dependencies — attribution, not a headline number

`npm audit` at the workspace root reports **26 high + 1 critical**. Per workspace with `--omit=dev`:

| Workspace | high | critical |
|---|---|---|
| backend (production deps) | **0** | **0** |
| frontend (production deps) | **0** | **0** |
| mobile | 23 | 1 |

Every high and the single critical (`node-tar`) belongs to the mobile **build** toolchain —
`@expo/cli`, `metro`, `@expo/plist`, `postcss` — or to test tooling (`jsdom`'s `undici`,
`concurrently`'s `shell-quote`). The `expo-*` packages that do ship inherit their advisories from
build-time config parsing, not from runtime code paths.

Reported rather than force-upgraded. The fix path npm proposes is Expo SDK 57 — a major version
bump, immediately before a store submission. That is a release decision, not a security fix.

---

## Runbook — the two items that need a deploy, not a commit

### 1. Serve the app-association files

Both currently return 403. On the VPS, in
`/etc/nginx/sites-available/tricitymatch.com`, above any `.well-known` deny:

```nginx
location = /.well-known/assetlinks.json {
    alias /var/www/tricitymatch/.well-known/assetlinks.json;
    default_type application/json;
}
location = /.well-known/apple-app-site-association {
    alias /var/www/tricitymatch/.well-known/apple-app-site-association;
    default_type application/json;
}
```

`nginx -t` before reloading — a bad global config breaks all five co-tenant sites.

`assetlinks.json` needs the **release** signing certificate's SHA-256 fingerprint
(`keytool -list -v -keystore <release.keystore>`), which is why no placeholder was committed:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.tricityshadi.app",
    "sha256_cert_fingerprints": ["<RELEASE SHA-256>"]
  }
}]
```

`apple-app-site-association` needs `<TEAM_ID>.com.tricityshadi.app` under `applinks`.

Only after both verify should `/reset-password` be considered for re-adding to the intent filter —
and there is a good argument for never re-adding a path that carries a bearer token.

### 2. Align the host's framing policy

The production CSP is emitted by the **host** nginx, not the compose `nginx` service. Change
`frame-ancestors 'self'` to `frame-ancestors 'none'` in
`/etc/nginx/sites-available/tricitymatch.com` so it agrees with the `X-Frame-Options: DENY` already
being sent.

---

## Gates

| Suite | Result |
|---|---|
| backend unit | **463 passed**, 44 suites |
| frontend | **118 passed**, 14 files |
| mobile | **57 passed** · `tsc --noEmit` **0 errors** |
| eslint | **0 errors** |
| secret scan (tracked + full history) | clean |
| co-tenants before/after prod probes | 200 / 200 |

Five new suites this round: `inviteRewardAbuse`, `socketRevocation`, `cacheScan`,
`emailTemplateEscaping`, `limiterCoverage`, `frameAncestors`. Each was run against the pre-fix file
and confirmed to fail.

---

## Residual risk — deliberately not fixed

| Item | Why it was left | Who decides |
|---|---|---|
| Expo SDK 52 → 57 (the 23 high + 1 critical) | Build-toolchain only; a major bump immediately before a store submission is a release decision | Owner |
| `assetlinks.json` / AASA not served | Needs the release signing fingerprint and the Apple Team ID | Owner |
| Host nginx `frame-ancestors 'self'` | The file is not in this repo | Owner, at deploy |
| `legacy-peer-deps=true` at the root | Removing it breaks `npm install` while mobile pins react 18.2.0 | Blocked on the react 19 / RN upgrade |
| Signup does not require a verified contact | Changing it alters the funnel; the invite reward — the thing that made it exploitable — is now gated on verification instead | Owner |
| Unverified accounts can still consume a founding grant | Capped at 500 total, so bounded; worth revisiting if the cap is ever raised | Owner |
| The dead `sha256-ap57…` hash in the production CSP | Harmless — the inline script it pinned was moved into the bundle in Round 1 | Cosmetic |

---

## Rotation list — unchanged from Round 1

Round 2 found no new exposed credentials. The full list stands as written in
`SECURITY_AUDIT_2026-08-21_R1.md`; the git history remains clean of live secrets, re-verified by
`scripts/scan-secrets.mjs --history` this round.

---

## What should happen next

1. **Deploy this branch.** Round 1's High is still live in production, and so is everything above.
2. Do the two runbook items at the same deploy.
3. Rotate what the Round 1 list names — particularly the credentials sitting in a local
   `.env.development` and the admin password published in a tracked file.

Nothing here has been merged or deployed. That call is yours.
