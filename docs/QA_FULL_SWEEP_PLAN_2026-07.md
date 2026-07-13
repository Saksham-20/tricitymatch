# Full-App QA Sweep Plan — live browse-driven, fix-on-discovery

Method reused from the onboarding fix (2026-07-13): stand up the local stack →
drive every screen with the `browse` skill → probe each edge case, rate limit,
button, and UX state → fix on discovery with single-source refactors → gate
(build + tests + lint) → commit → deploy frontend-only to the VPS → re-verify the
fix live on tricityshadi.com. One screen at a time, tracker updated after each.

Tracker: append findings to `rn-qa-progress.md` (web section) or a new
`web-sweep-progress.md`. Severity: 🔴 Critical (blocks a core flow / data loss /
security) · 🟠 High · 🟡 Medium · ⚪ Low/polish. Status: `[ ]` open · `[~]`
fixed-not-verified · `[x]` fixed+verified-live.

---

## 0. The loop (per screen)

```
1. browse goto <local url>            # http://localhost:3000
2. browse snapshot -i                 # enumerate every interactive @ref
3. For each button/link/input:
     - happy path  (valid input → expected state change, verify with snapshot -D)
     - empty       (submit blank → inline error, not a crash / silent no-op)
     - invalid     (bad format, out-of-range, wrong type)
     - boundary    (min/max length, 0, negative, huge, unicode, emoji, XSS string)
     - double-submit (rapid double-click → one request, guarded)
     - back-button / refresh mid-flow → state survives or degrades cleanly
4. Check the 4 view states: default · loading (skeleton) · empty · error+retry
5. Check reachability: is every control tappable at 375px (z-index, sticky nav,
   sheet under BottomNav)? keyboard focus order? disabled states honest?
6. Fix on discovery. Prefer single-source refactors (kill the drift, not the symptom).
7. Update tracker.
```

Screenshot evidence for every 🔴/🟠 (`browse screenshot` → Read the PNG).

## 1. Environment bring-up (once)

```bash
# probe stack
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000        # 200
curl -s -o /dev/null -w '%{http_code}' http://localhost:5001/api/v1/auth/me  # 401 = up

# seeded local creds (NOT prod): password is Pass@1234 (ACCOUNT_CREDENTIALS.md
# lies — it says Password@123). Probe before trusting any creds file:
for pw in Pass@1234 Password@123 password123; do
  curl -s -o /dev/null -w "$pw %{http_code}\n" -X POST \
    http://localhost:5001/api/v1/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"aman.singh2@example.com","password":"'"$pw"'"}'; done
```

Accounts to keep on hand:
- **Free member** — for upsell/gating states (a `free` seeded row).
- **Paid member** (`aman.singh2@example.com` / `Pass@1234`, elite) — premium views.
- **Admin** — `admin@tricitymatch.com` / `Pass@1234`.
- **Fresh signup** — created live per run (delete after) for the new-user path.
- **Prod QA member** — `globoniksprod@gmail.com` / `TricityQA@2026` — LIVE re-verify only.

Note seeded quirks (not bugs): relative `/uploads/*` photos show initials
fallback locally; some seeded premium rows have invalid `planType`/expired
`endDate` → `requirePremium` 403 (fix the row for premium QA).

## 2. Rate-limit / edge testing (the part usually skipped)

Every limiter in `middlewares/security.js` gets one deliberate trip test, driven
by curl loops (not browse) against local, asserting the **429 body + Retry-After
+ that the UI surfaces it** (not a silent hang or a generic 500):

| Limiter | Budget | Test |
|---|---|---|
| auth | 5 / 15m | 6 bad logins → 6th 429; UI shows lockout copy + countdown |
| signup | 3 / hr | 4 signups from one IP → 4th 429 |
| pwReset | 3 / hr | 4 forgot-password → 429 |
| send-otp | 3 / hr + existence-gate | 4 sends → 429; existing contact → **409** inline "log in" |
| search | 30 / min | loop → 429; UI keeps last results, shows "slow down" not a crash |
| message | 60 / min | rapid send → 429; optimistic bubble rolls back |
| matchAction | 60 / min | rapid like → 429 |
| profileUpdate | 10 / min | rapid Save → 429; editor keeps form data |
| upload | 20 / hr | loop photo upload → 429 |
| payment | 10 / hr | loop create-order → 429 |
| api (global) | 200 / 15m | sanity only |

Also test the Redis account-lockout (5 fails / 30 min) is distinct from the auth
limiter and both surface honestly. Confirm limiter responses don't leak stack
traces and DO set the right status (429, not 500).

Edge inputs to fire at every free-text field: empty, whitespace-only, 10k chars,
emoji/unicode, `<script>alert(1)</script>`, SQL-ish `' OR 1=1--`, leading/trailing
spaces, Windows/Unix newlines. Assert: sanitized, no reflected XSS, no 500,
correct validation message.

## 3. Screen coverage matrix

Public: `/ /login /signup /onboarding /forgot-password /reset-password /terms
/privacy /about /contact /safety /success-stories`
Member: `/dashboard /profile /profile/edit /profile/:id /search /matches /chat
/subscription /payment/* /settings /notifications /verification /guardian
/astrologers`
Admin: the 10 `/admin/*` routes.

Per-flow focus (beyond the generic loop):

- **Login** — progressive 2-phase (identifier → password), Change chip, wrong
  password, unknown account, lockout, Google button, `returnTo` deep-link round-trip,
  password-manager autofill (hidden username input present), Enter-key submit.
- **Signup / onboarding** — DONE 2026-07-13 (step-12 + horoscope). Re-check:
  create-after-verify, OTP auto-verify on last digit, existing-contact 409,
  guardian `create_for_other` 14-step path, draft persistence + `clearDraft` on
  complete, preview card deep-link, phone-only vs email signup.
- **Forgot/Reset** — token expiry, reused token, weak password (8+complexity
  message matches backend), mismatched confirm.
- **Dashboard** — first-run variant (<60% / <48h) vs populated; error banner+retry
  (not zeros); Who-Viewed lock for free; daily-matches ≠ curated dedup.
- **Search + FilterPanel** — apply/clear, empty vs error vs 404 states, infinite
  scroll (page cursor), sort, saved-search (hidden — no backend), Apply button
  tappable at 375px (the z-index bug class), filter round-trip on back.
- **Matches** — Saved/Mutual/Likes-You tabs; Likes-You 403→upgrade for free; empty
  states each tab.
- **Chat** — premium+mutual gate, conversation list (the `IN (:ids)` crash class),
  thread send/edit/delete, optimistic + rollback, typing, socket reconnect,
  message rate limit.
- **Subscription / payment** — plan capability flags per tier (shared `PLANS`),
  upgrade gate (target tier > active only), Razorpay-unconfigured notice, verify
  supersedes prior active sub, invoice.
- **Profile / edit** — DONE. Spot-check other sections hydrate + Save round-trips;
  photo upload (magic-byte reject on non-image), delete photo, privacy toggles persist.
- **Verification** — live-camera-only selfie (no upload path), camera-denied copy,
  admin queue side-by-side + approve/reject → member status + notification.
- **Settings** — theme/elder/language switch end-to-end (hi/pa render), delete
  account, incognito.
- **Admin** — all 10 routes render + CRUD + status dropdowns; brand/theme (burgundy,
  no rose); marketing portal blue (known).

## 4. Cross-cutting UX passes

- **375 / 768 / 1440** viewport pass on every screen — nothing clipped, no
  horizontal body scroll, sticky nav never covers a CTA, sheets above BottomNav.
- **4 states** shipped everywhere data loads (skeleton not spinner; empty = icon +
  line + CTA; error = icon + retry). Premium views = gold lock + unlock CTA.
- **Slop scan** — no emoji-as-icon, no rainbow info boxes, no rose/pastel washes;
  Avatar fallback = brand initials; gold = premium only.
- **Motion** — reduced-motion honored; no jank; `animations.js` variants only.
- **Screenshot lies** — scroll CountUp / `whileInView` sections into view before
  judging "0"/"blank" (artifact, not bug).
- **A11y quick** — focus visible, labels tied to inputs, aria-invalid on errors,
  hit targets ≥44px in elder mode.

## 5. Gate + deploy (per batch of fixes)

```bash
# gate
cd frontend && npx vitest run && npm run build && npx eslint <changed>
cd backend  && npm test                      # 155 unit

# commit frontend-only fixes, push
git add <files> && git commit && git push origin main

# deploy (frontend-only — matches the onboarding deploy)
ssh tricityshadi-vps 'cd /var/www/tricitymatch && git fetch origin && git reset --hard origin/main'
ssh tricityshadi-vps 'cd /var/www/tricitymatch && docker compose build frontend'
ssh tricityshadi-vps 'cd /var/www/tricitymatch && docker compose up -d --no-deps --force-recreate frontend'
# backend change → also build backend + --force-recreate backend (run migrate first)

# re-verify LIVE on https://tricityshadi.com with the prod QA account
```

VPS discipline: shared box — scope every command to `tricitymatch-*`, never global
`docker prune`/`down`, `nginx -t` before any reload, don't touch co-tenant sites.

## 6. Exit criteria

- Every screen: happy + empty + invalid + boundary + double-submit exercised.
- Every limiter: 429 tripped once, surfaced in UI (no silent hang / 500).
- Every data view: 4 states present.
- 375/768/1440 clean, no control unreachable.
- All 🔴/🟠 fixed + re-verified live with screenshot evidence.
- Gates green (FE build + vitest + eslint; BE unit); tracker fully `[x]`.

## Suggested order (highest blast radius first)

1. Auth + rate limits (login, signup, OTP, reset, lockout) — the front door.
2. Search + Matches + Chat — the core daily loop + the crash-prone list queries.
3. Subscription/payment — money path + tier gating.
4. Profile/verification/settings — already partly swept.
5. Admin — internal, lower risk.
6. Public/static pages — copy + SEO + responsive only.
