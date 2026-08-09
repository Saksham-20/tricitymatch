<!-- /autoplan restore point: /Users/sakshampanjla/.gstack/projects/Saksham-20-tricitymatch/main-autoplan-restore-20260809-115518.md -->
# UI Improvement + Refinement + Workflow-Mistake Plan — 2026-08-09

Built from: `qa-audit-2026-08-09.md` (3 rounds, F-001…F-027, score 89/100), `qa-evidence/` screenshots,
CLAUDE.md Known Issues, and `docs/design-handoff/PROGRESS.md`. Ordered by dependency, then impact.

**Execution note (user directive 2026-08-09): implement on Opus** — run implementation sessions
with `/model opus` (or spawn implementation agents with model: opus); planning/review ran on Fable.

Tracker convention: check items off here; each phase ends with a regression gate —
all backend + frontend suites green with counts ≥ baseline (183 BE / 60 FE at plan start)
and `vite build` green — before the next starts.

---

## Phase 0 — Land the audit (nothing new until this ships)

The 3-round audit left 22 modified + 4 untracked files **uncommitted**, and three fixes only take
effect on production after a deploy.

- [x] **P0.1 Commit in file-compatible groups.** Grouping strictly by finding collides with shared
      files (`profileController.js` carries money F-014/15 AND privacy F-016; `security.js` carries
      rate-limiting AND CSP F-025) and interactive hunk-staging is unavailable — so group by files
      that change together, with multi-finding commit messages naming every F-id they carry.
      `/review` before commit per CLAUDE.md.
- [x] **P0.1b Truth in the same deploy (F-004 resolved 2026-08-09, D8.1: option b + narrative).**
      In `Home.jsx` (already carries the F-002 edit): drop the fabricated stats band ("1190+
      marriages / 50K+ / 92% / 15yr" + 28K/14K/8K city counts), the three named parent
      testimonials, and the false badge claims ("every profile manually reviewed", "selfie
      verification before any profile goes live" → "photo-verified badge available on every
      profile"). ALSO (found in CEO review, missed by the audit's F-004 list): the `Est. 2011` /
      `15 years` ticker chip (`Home.jsx:677`) and the SEED parent-testimonials — the section
      already has a real-stories data path (`Home.jsx:12` comment), so remove only the fabricated
      seed fallback; real published stories keep rendering. Replace stats band with
      founding-member positioning: "Tricity's newest, most carefully verified matchmaking
      community — founding members join free." **Deploy-1 page map (design review F1 — spec the
      page, not the diff):** ticker slot → true chips only ("Live selfie verification ·
      Chandigarh · Mohali · Panchkula"); cities section → keep the three-city panels as COVERAGE
      statements, counts removed; parents/testimonials section → `hidden` while zero published
      real stories (seed fallback deleted; real-stories data path kept); hero keeps its CTA,
      gains the founding sub-line. **P0.1b copy promises NOTHING un-granted** — no premium-period
      claim until Phase S ships the grant mechanic (F5). Full founding band lands in Phase S.
- [x] **P0.2 Deploy** — push main, VPS `git pull`, rebuild backend **with `--force-recreate`** +
      frontend, scoped to `tricitymatch-*` containers only (shared VPS rules).
- [x] **P0.3 Prod data fix** — run `scripts/rebrand-stored-data.sql` against `tricitymatch-db`
      (idempotent; covers Notifications + SuccessStories).
- [x] **P0.4 Post-deploy verification** (these were unverifiable in dev):
      - Redis actually connects: backend logs show "Redis connected", `redis-cli --scan` shows
        `lockout:` / `daily-matches:` keys appearing.
      - CSP `frameSrc` (F-025): the checkout iframe never mounts on prod while Razorpay keys are
        placeholders, so verify via headers — and check the RIGHT response: the iframe is governed
        by the CSP on the HTML document (served by the frontend container / nginx site file), not
        the helmet header on API responses. Run both:
        `curl -sI https://tricitymatch.com/ | grep -i content-security` (document — record which
        CSP, if any, governs it) and `curl -sI https://tricitymatch.com/api/v1/auth/me | grep -i
        content-security` (proves the backend fix deployed).
      - **Fix the landmine while there:** `nginx/conf.d/security-headers.conf:5` has a
        commented-out page-level CSP still carrying the OLD `frame-src https://api.razorpay.com`
        only — update it to include `checkout.razorpay.com` so uncommenting it later can't
        resurrect F-025.
      - Support Inbox reachable at `/admin/contact-messages` and its row count equals
        `SELECT COUNT(*) FROM "ContactMessages"` on the prod DB (dev showed 5 real + the audit's
        own test row; the prod count is unknown until checked — don't hardcode 6).
      - Spot-check: login, refresh, search, unlock on prod as `globoniksprod@gmail.com`.

**PHASE 0 COMPLETE — 2026-08-09.** 9 commits (57762c9..702e108) deployed to prod. Verified:
Redis connected for cache AND Bull queues (queue.js had the same REDIS_URL-only gate — fixed as
F-026 sibling, `bull:cleanup:*` keys now in prod redis); document + API CSP both carry
`checkout.razorpay.com`; Support Inbox live, count 0 == prod ContactMessages 0 (the "6 enquiries"
were dev rows); rebrand SQL: 0 stale rows on prod; member login/me/search/refresh + admin
login/inbox all 200; prod bundle scan: fabrications=0 in Home/About/Login chunks (About + Login
carried the same fake stats in source — swept in the same deploy); co-tenants all 200.
Real prod numbers: 9 profiles, 0 contact messages. ⚠️ Prod admin password is the seeded default —
rotate (owner: pick a password, then update the User row / re-seed with ADMIN_PASSWORD env).

**Exit gate:** prod healthy, no co-tenant disruption, fixes pushed to `main` (solo repo — commits
land on main directly, matching the standing deploy flow), and zero "TricityShadi" strings
rendering on prod pages (P0.3 verified by re-running the SQL's preview SELECT → 0 rows).

---

## Phase 0.5 — Thin funnel baseline (demoted 2026-08-09, D8.2: dual-voice challenge accepted)

Both outside voices called the original spec false precision at current traffic. Thin version keeps
measurement self-hosted (DPDP posture) without dashboard/ingest infrastructure — read by SQL until
traffic earns a UI (~2-3 hrs total):

- [x] **Event table** — migration `AnalyticsEvents (id, eventType STRING(32) app-validated —
      NOT a PG ENUM: Phase S already adds `invited_signup`, and ALTER TYPE ADD VALUE migrations
      are irreversible friction for an internal table — userId NULLABLE FK, createdAt)` + btree
      on (eventType, createdAt). No metadata blob.
- [x] **Five SERVER-SIDE emissions (semantics corrected by eng review — both voices):**
      `send-otp`/`verify-otp` run PRE-account in the 2-step signup (`authController.js:713/:756`),
      so those rows have `userId NULL` and Postgres unique indexes treat NULLs as distinct — no
      dedupe possible without storing contact data. Decision: the two pre-account events are
      **raw counters**, named honestly `otp_send_attempted` / `otp_verify_succeeded` (resend
      inflation documented in `funnel-report.sql`). The three account-bound events
      (`account_created`, `profile_60pct`, `first_interest_sent`) dedupe via **partial unique
      index** `(userId, eventType) WHERE userId IS NOT NULL` + `ON CONFLICT DO NOTHING`.
      `profile_60pct` captures the OLD completion before save (the existing old-vs-new flow at
      `profileController.js:~330`) so the crossing is detectable.
      All via ONE `trackEvent(userId, type)` util — fire-and-forget: never awaited on the
      response path, failures `log.warn`ed; an analytics insert must never 500 a signup.
- [x] **Read path = SQL**, committed as `scripts/funnel-report.sql` (stage counts +
      week-over-week; comments document: pre-account counters are inflated by resends, and
      account deletion CASCADE rewrites history retroactively — acceptable, DPDP-first).
- [x] **Privacy bounds**: no metadata stored at all; `userId` FK ON DELETE CASCADE.
- [x] **Unit tests**: emission points fire (test awaits the flushed fire-and-forget promise —
      not a vacuous pass); duplicate suppression on repeated profile-save/match actions;
      NULL-userId rows accepted for the two counters; insert failure swallowed + logged.
- CUT (build when >100 signups/week): client ingest route, admin funnel card, retention queue.

**PHASE 0.5 COMPLETE — 2026-08-09** (Opus agent, gated + deployed; commit a6d8364; prod migration
000047 applied on boot). Emission semantics proven at util+DB layer (live dedupe smoke: 2 raw
counter rows kept, account-bound rows collapse to 1; reversibility tested). Full HTTP walkthrough
deferred to the P2.2 payment e2e session (needs OTP bypass env); suite 178/178.

**Exit gate:** one scripted dev walkthrough produces all 5 rows; `funnel-report.sql` returns the
funnel; regression gate green.

---

## Phase 1 — Brand + UI refinement

**STATUS 2026-08-09 (both Opus agents died at the session limit ~95% done; completed + gated here):**
DONE + DEPLOYED: P1.1 full (TM monogram SVG + favicon cut + all PWA/apple icons + mobile assets via
committed `scripts/generate-brand-assets.mjs`) · P1.2 full (fixes + `scripts/tap-target-probe.mjs`,
all 8 public routes PASS: 0 <24px) · E2 OG card wired · E6 sitemap/robots · one MORE fabricated
About claim removed. Phase S BACKEND also done + deployed (migration 000048 on prod; grant/invite
live; founding window CLOSED until FOUNDING_PERIOD_ENDS is set in prod env).
REMAINING in Phase 1: E1 slop-lint script · P1.3a ref warning · P1.3b Support-Inbox chip merge ·
P1.3c admin user-detail dead end · P1.3d marketing portal (owner call). Phase S remaining: frontend
half (founding band refinement, invite send/receive UI, city pages) + grant/invite unit tests.

### P1.1 Logo mark refresh (found via screenshot review — the audit under-fixed F-011)
`frontend/public/images/logo.svg` is still the **old TS monogram on an off-brand `#B60D2F` red
square** (brand burgundy is `#8B2346`). F-011 only changed the admin *text* badge to "TM"; the SVG
renders "TS" beside the word "TricityMatch" in the member navbar, onboarding rail, auth pages,
footer — everywhere `Logo.jsx` is used — plus favicon/PWA icons and `mobile/assets/*.png`
(exported from this same SVG).
- [ ] New TM monogram SVG, burgundy `#8B2346` field (keep the serif style; Playfair-consistent).
      **Three cuts (design review F8):** full lockup (mark + wordmark), standalone mark, and a
      simplified favicon cut (heavier strokes — a two-letter Playfair monogram is illegible at
      16px). Dark treatment: burgundy field holds on dark surfaces; verify letterform contrast.
- [ ] Regenerate: favicon + PWA icons (`frontend/public/`), `mobile/assets/{logo,icon,adaptive-icon,splash}.png`
      via the existing sharp pipeline.
- [ ] Grep sweep for any hardcoded inline "TS" marks left in JSX (AdminLayout was one; there may be others).
- [ ] Email templates (`utils/email.js` brandLayout) — text-only header today; confirm no TS asset.
- Note: mobile *bundle IDs* stay `com.tricityshadi.app` per the domain-migration memory — do not touch.

### P1.2 Tap-target pass to ≥44px (F-013 remainder)
`/profile` fixed in round 3 (pattern: pad + negative margin, zero layout shift). Remaining measured
at 375px: **/dashboard 21 elements, /settings 6, / (home) 3**.
- [ ] Apply same pattern; re-measure all audited routes (member routes + public `/`). The audit's
      measurement was ad-hoc Playwright evaluation that died with that session — re-implement it and
      **commit it as `scripts/tap-target-probe.mjs`** so the check is repeatable. Target 0 under
      24px (WCAG 2.5.8 floor), ≥44px on primary actions.

### P1.3 Small UI defects
- [ ] React `ref` warning on `/profile/edit` (noted in round 1, never chased) — find + fix.
- [ ] Support Inbox polish: "Status" chip column and "Actions" dropdown are redundant (screenshot
      `c10`) — merge into one interactive status chip (interaction: chip click → menu; keyboard:
      Enter/Space opens, arrows navigate, Esc closes; optimistic update with failed-update
      revert + toast); add relative timestamps.
- [ ] Admin user detail "No profile created yet" state (CLAUDE.md known issue) — replace the dead
      end with what exists: account fields (email/phone/created/status), subscription row,
      verification rows.
- [ ] Marketing portal (`pages/marketing/*`) still blue — recolor to brand or explicitly accept as a
      separate-portal identity. One decision, applied consistently.

### P1.4 Homepage truthfulness — RESOLVED, moved to P0.1b (D8.1, 2026-08-09)
Decision made: option (b) + founding-member narrative, shipping with Phase 0's deploy (fake stats,
testimonials, and false badge claims all come down in the same commit set as the security fixes).
Phase S refines the replacement copy; nothing remains here.

### P1.5 Accepted expansions (CEO review 2026-08-09, SELECTIVE EXPANSION cherry-pick)
- [ ] **E1 Slop-lint script** — node script scanning `frontend/src` + `mobile/src` for off-token hex
      colors and non-sanctioned gradients, wired into `npm run lint` (no new linter — color drift
      recurred in 3 successive audits; this makes the Phase 1 brand pass permanent).
- [ ] **E2 OG/social share cards** — brand-correct share image via the same sharp pipeline P1.1
      runs for the logo; wire `og:image`/`twitter:image` in `Seo.jsx` + `index.html`.
- [ ] **E6 Sitemap/meta refresh** — add `/matches` (added 2026-07-07) and any other new public
      routes to `public/sitemap.xml`; verify per-route `Seo.jsx` coverage.

**Exit gate:** design-review pass @375/768/1440 light+dark on changed screens; FE tests + build green.

---

## Phase S — Supply, code-shaped parts (NEW 2026-08-09, D8.5: dual-voice challenge, middle form)

Liquidity is the binding constraint (both outside voices; TODOS P1 since July). This phase builds
only the code-shaped substrate — outreach itself stays owner work with a named target
(**100 real Tricity profiles / 30 days** as the north star, owner-executed).

- [ ] **Founding-member landing copy** — extend the P0.1b positioning into a proper section on `/`
      (+ signup touchpoint): what founding members get (free premium period per TODOS memo),
      why now, invite framing. Honest numbers only.
- [ ] **Invite mechanics** — shareable invite link per member (reuse the `profileCode` util
      PATTERN — do NOT reuse the marketing `ReferralCode` table: its `marketingUserId` FK is
      ON DELETE CASCADE to a marketing user, wrong semantics for member invites). Design: invite
      param on the signup URL + nullable `Users.invitedBy` UUID column; landing shows the
      inviter's FIRST NAME only (never profile data; invalid/forged codes silently ignored —
      normal signup proceeds). Tracked via the Phase 0.5 event table (add `invited_signup` to
      the enum). Invite-chip states: valid / silently-absent (invalid) / loading.
- [ ] **Tricity SEO content pages** — 3 landing pages (Chandigarh / Mohali / Panchkula matrimony),
      brand-correct, `Seo.jsx` meta + sitemap entries (rides E6), honest community-first copy.
- [ ] **Bureau-stack decision memo** — the codebase carries a dormant Bureau feature stack (RN
      BureauStack: client roster, match proposals, earnings — flagged dead in deep-QA). Write the
      one-page memo: USE (bureau partnership channel) / PARTNER (manual, no code) / DELETE.
      Owner decides; memo has a decide-by date 2 weeks out.

### Phase S surface spec (decided in design review 2026-08-09 — both voices demanded it)
- **Trust strategy (F10):** exclusivity + verification-specificity + hyperlocality, in that order;
  register = community/family language ("founding families of the Tricity community"), never SaaS
  growth-speak. Wireframe composition reference:
  `~/.gstack/projects/Saksham-20-tricitymatch/designs/founding-member-20260809/wireframe.png`
  (asymmetric editorial band: mono eyebrow / serif headline w/ burgundy italic / one CTA / gold-tick
  pledge column).
- **Founding offer mechanics (F5 + eng review F7/F9/F3 — the entitlement bundle is EXPLICIT,
  never defaulted):** signup-time Subscription row `planType: founding_premium`, end-date
  `FOUNDING_PERIOD_ENDS`, **`contactUnlocksAllowed` set explicitly (basic_premium-grade, e.g. 5
  — NEVER NULL: NULL means UNLIMITED per `auth.js:230`, and a naive grant hands every
  self-signup unlimited phone-number unlocks = scriptable contact harvest)**; excluded from
  `UNLIMITED_PLANS`. Offer closes at date OR member-count cap (read-then-insert overshoot by a
  few accepted + documented), whichever first; post-close the band converts to "founding
  families" retrospective copy, and admin `updateSubscription` may NOT mint founding rows
  post-close. Grant paths: email signup, `googleAuth` signup, AND guardian-created accounts —
  all grant while open (silence = inconsistent grants). **Founding-ness persists independently
  of the sub row**: `Users.isFoundingMember` boolean (the badge must survive `verifyPayment`
  superseding the founding row on upgrade, and herd expiry at the deadline).
  **Enum-ripple checklist (both voices — the plan under-scoped this):** migration `ALTER TYPE
  ADD VALUE` (precedent 000044; never seed rows in the same transaction) · `models/Subscription.js:19`
  · `constants/plans.js` — add to `PAID_PLANS` + `TIER_RANK.founding_premium: 0` + **NEW
  `PURCHASABLE_PLANS` split** (feeds `createOrderValidation` at `validators/index.js:501` +
  createOrder, so posting `founding_premium` → 400, not a razorpay 500; entitlement gates keep
  reading `PAID_PLANS`) · `shared/src/types/subscription.ts` union + `shared/src/constants/plans.ts`
  PLANS record entry (else mobile `tsc` breaks — note in store-launch TODOS) ·
  `Subscription.jsx` founding banner (raw `founding_premium` matches no PLAN_CONFIG — the F14
  ladder rewrite includes it) · admin analytics note: founding members inflate "active premium
  subscribers" count (revenue sum unaffected, amount NULL).
  Only AFTER this ships may any surface say "free premium period." Invited signups DO get the
  offer while the period is open.
- **Founding echo (F12):** "Founding member" badge on dashboard + own-profile — gold (legitimate:
  founding ⇒ premium period), rendered via existing Badge component.
- **Founding placement (F2):** hero sub-line + one dedicated band in the old stats-band slot;
  exactly one meaning of "free" per surface — the true one (premium period, once grantable).
- **Invite SEND (F6):** Dashboard card + Settings row; copy-link button with "Copied" state;
  `navigator.share` sheet where available.
- **Invite RECEIVE (F4):** invite promotes to the signup page header — "{FirstName} invited you
  to TricityMatch" as H1 kicker (chip styling per row 27); form unchanged; dead-inviter folds
  into the silently-absent state.
- **Invite token security (F15, hardened by eng review — both voices):** invite codes MUST NOT
  reuse the `profileCode` derivation — profileCode resolves to a full profile via
  `GET /search/by-code` (auth'd, but any member account can resolve it; separation stands). The
  "distinct-salt derivation" alternative is KILLED (no revocation, no dead-inviter handling).
  Design: `Users.inviteToken` (unique, ≥128-bit random) + `Users.invitedBy` self-FK
  **ON DELETE SET NULL**, indexed, written in the signup transaction with the inviter
  re-validated at signup time (not just landing). Public resolve endpoint `GET /invite/:token →
  {firstName}` ONLY, behind a named rate limiter (contactLimiter precedent). Signup param is
  **`invite`** — NOT `ref` (marketing referral flow already consumes `ref`/`referralCode` at
  `authController.js:106`; both present → both honored independently). Unit test: invite token
  never resolves through `/search/by-code`.
- **City page template (F3):** ONE shared template, 3 content instances; routes
  `/matrimony/chandigarh|mohali|panchkula` (named BEFORE E6 sitemap entries — indexed URLs don't
  move). Section order: H1 "Matrimony in {city}, built for {city}" → founding band → how
  verification works → locality specifics (sectors/communities — the honest differentiator) →
  FAQ → CTA. BAN: member counts, "browse profiles" promises. Distinct per-city copy blocks
  (duplicate-content risk). Dark + elder-mode parity required (public pages must match the
  app's theme system).
- **E3 supply-aware empty states — PULLED IN (both design voices, F11):** Search/Matches empty
  states become the founding story told inside the product: "You're a founding member —
  new Tricity profiles are verified every week" + invite CTA (reuses F6 link). Kills the
  honest-landing→dishonest-interior break.
- **OG card content (F9):** logo + "Tricity's own matrimonial community" + founding line,
  burgundy/gold, no numbers.

**Exit gate:** landing + city pages live and truthful; founding grant round-trips (signup →
`founding_premium` row with end-date → badge renders); invite link round-trips to a tracked
signup in dev; invite-token/profileCode collision test green; memo delivered; regression gate
green.

---

## Phase 2 — Workflow-mistake hunt, Round 4 (chat + money + notifications)

Method unchanged: TEST → SCREENSHOT → ANALYZE → FIX → RETEST. These are the surfaces the audit
itself listed as not exhaustively driven.

### P2.1 Chat workflows (deepest remaining gap)
- [ ] **FIRST: free-chat-for-mutuals flag (D8.4; entitlements design CORRECTED by eng review —
      both voices).** The "shared premium helper" does not exist: `requirePremium`
      (`auth.js:154`) and the socket's LOCAL `checkSubscription` (`socketHandler.js:120`) are two
      parallel implementations sharing only `PAID_PLANS`; and `requirePremium` also gates calls,
      likes-you, viewers, contact unlock, kundli PDF, invoices — branching the flag there frees
      ALL of it. Correct shape:
      - NEW `backend/utils/entitlements.js`: `getActiveSubscription(userId)` +
        `hasChatAccess(userId, otherUserId)` = paid OR (`FREE_CHAT_FOR_MUTUALS` && mutual).
      - NEW `requireChatAccess` middleware swapped in ONLY at `chatRoutes.js:27`
        (verified safe: chatController never reads `req.subscription`); per-thread mutual checks
        stay in controllers; `GET /conversations` passes on flag alone (no other-user).
      - Socket `join-room` (`socketHandler.js:209`) branches through the SAME function.
      - `requirePremium` is NEVER modified.
      **State table additions (eng):** calls-in-chat row — voice/video buttons stay premium-gated
      (affordance hidden for free users via the features block, not a 403 surprise); flag-flip
      does NOT eject already-joined socket rooms (join-room checks once) — document, revisit only
      if abuse shows.
      **Env plumbing (F12 — the CORS_ORIGIN failure class, already happened once):**
      `FREE_CHAT_FOR_MUTUALS`, `FOUNDING_PERIOD_ENDS`, founding-cap var wired through BOTH
      `config/env.js` (sole env source) AND docker-compose's explicit `environment:` allowlist;
      post-deploy verify via the features probe on `/auth/me`.
      Contact-unlock and every other premium perk stays gated. Subscription page plan-feature copy
      updated to match. **Rollout: ship the flag DARK (default OFF = fail-closed), QA both
      configs, then flip ON as a deliberate config change.** Reversible two-way door. All P2.1
      items below are QA'd in BOTH flag states.
- [ ] **Fix existing prod bug found in eng review (F8):** `withDerivedUserFields`
      (`authController.js:32`) filters `status:'active'` with NO `endDate` check → between a
      sub's expiry and the hourly Bull sweep, `/auth/me` claims premium while every gate 403s
      (and if Redis/Bull is down the sweep never runs). Add the endDate filter; the sweep is
      cleanup, not correctness. Herd-expiry of founding rows at `FOUNDING_PERIOD_ENDS` makes
      this visible at scale.
      **Frontend flag exposure (design review F13):** server exposes the flag in a `features`
      block on `/auth/me` — frontend branches ONLY on that. Never a `VITE_` env var (build-baked
      → backend/frontend drift → plan copy sells premium chat that's actually free).
      **Chat state table (F7 — designed BEFORE QA, then QA'd):** Chat × {flag ON, OFF} ×
      {free, premium} × {0 mutuals, N mutuals, mid-thread revocation}. Decisions: flag-ON free
      user with 0 mutuals sees the explainer empty state "Chat opens when you both match" (the
      gold premium gate becomes unreachable); mid-thread revocation (expiry or flag-off) →
      composer disables with inline notice + upgrade CTA, thread history stays readable.
      **Subscription ladder, flag-ON world (F14 — write it, don't improvise it):** free tier
      gains "Chat with your mutual matches"; `basic_premium` drops "Unlimited messages" and
      re-leads with contact-unlock + visibility value; re-derive every "Everything in X, plus"
      chain across the six PLAN_FEATURES lists in `Subscription.jsx:13` + shared `PLANS`.
- [ ] Premium expiry **mid-conversation**: sub expires while thread open — what do send, socket,
      and UI each do? (server re-checks per message?)
- [ ] Block user mid-conversation: existing thread visibility, socket room membership, typing events.
- [ ] Edit/delete windows: edit own vs other's (403 verified via API — now verify the **UI** hides
      the affordance), deleted-message rendering on the other side live.
- [ ] Socket drop/reconnect: kill network 30s mid-thread → reconnect → missed messages appear?
      duplicate sends? optimistic-message reconciliation.
- [ ] Unread counts: badge accuracy after reading in another tab, after socket-only delivery.
- [ ] Family-group chat **UI** end-to-end (backend authz verified in round 3; web UI never driven):
      create group, invite by phone, post/edit/delete, member leaves, non-member deep-link.
- [ ] Empty/error states in Conversations for a free user (gate copy) and a premium user with zero
      mutuals.

### P2.2 Payment e2e with a real test card
Unblocked: `rzp_test_` keys already present in `.env.development` + `frontend/.env` (verified
2026-08-09; prod keys remain placeholders). Webhook leg needs a public URL — use a tunnel
(e.g. `ssh -R` via the VPS or ngrok) or drive the webhook handler directly with a signed payload.
- [ ] Razorpay test-mode card through hosted checkout: order → pay → `verify-payment` → webhook →
      entitlement flips → invoice downloadable → `/payment/success` (F-023 fix) confirms correctly.
- [ ] Failure leg: abandon checkout → `pending` row → F-018 fix keeps plan `free` → retry works.
- [ ] Upgrade leg live: basic → premium_plus with the round-2 TIER_RANK gate.

### P2.3 Notification deep-links
- [ ] Every notification `type` → click → correct destination with correct state (match, message,
      verification result, subscription, view). Dead links = findings.

### P2.4 Cross-cutting mistake sweeps (patterns that caught F-015/F-023)
- [ ] Double-submit on every remaining mutating form (guardian invite, group create, astro booking,
      report, story submit).
- [ ] Back-button + refresh mid-flow: onboarding step 2, payment pending, selfie capture.
- [ ] Stale-tab actions: act on a profile in tab B after blocking it in tab A.
- [ ] Direct-URL access on the newest routes (`/matches` tabs, `/admin/contact-messages`) for each role.

**Exit gate:** all findings fixed at root cause, adjacent-workflow regression per fix, audit doc
appended as Round 4 with score update.

---

## Phase 3 — A11y, signup-funnel sliver (TRIMMED 2026-08-09, D8.6)

Acquisition-facing slice only; the full audit (VoiceOver, contrast sweep, all routes both themes,
token-decision gate) moves to a dated TODOS cycle for when real users exist.

- [ ] axe-core (`@axe-core/playwright`) on the signup funnel: `/` → `/signup` → onboarding steps →
      post-signup preview. 0 critical/serious, light theme.
- [ ] Full keyboard traversal of the same funnel (incl. OTP boxes, DOB selects, Terms checkbox,
      focus order, Enter-to-advance).

---

## Phase 4 — Home LCP sliver (TRIMMED 2026-08-09, D8.6)

Acquisition-facing only. Deferred to the dated TODOS perf cycle: Agora chunk fetch verification,
BarChart admin-only check, API p95 baselines.

- [ ] Home LCP at 375px on throttled 4G — **budget ≤2.5s** (design review: the acquisition page
      gets a target, not a vibes check); record the number, fix to budget. **First suspect (eng
      review): `Home.jsx` FontLoader injects Google Fonts via a runtime `@import` in a `<style>`
      tag (~line 21) — render-blocking external fetch; self-host the fonts.

---

## Phase 5 — REMOVED (D8.3, 2026-08-09)

Both outside voices: the apps are in no store, so this work served zero users and had no delivery
mechanism. RN work re-enters as a dedicated **store-launch initiative** (TODOS entry) that starts
from `mobile/launch-prep` (7 commits ahead, incl. Expo SDK 51→52 / targetSdk 35) and its two known
store blockers (Android targetSdk 35 review, Apple guideline 4.8), and includes the selfie-only
verification rework + TM asset drop + backend-changes smoke — planned when the owner says go.

---

## Standing decisions needed from owner
1. ~~F-004~~ — **RESOLVED** (D8.1): drop band + founding-member narrative, ships in P0.1b.
2. Marketing portal identity (brand burgundy vs keep-blue) — blocks P1.3's recolor item only.
3. **Razorpay live-key KYC — START NOW** (business task, days of lead time; the moment a family
   wants to pay is unrepeatable). SMTP creds timing unchanged.
4. **Pricing memo is 9 days past its decide-by (2026-07-31)** — re-date or decide; free-chat memo
   is now decided (D8.4, flag ON for mutuals).
5. Bureau-stack memo decision (produced in Phase S; decide within 2 weeks of delivery).

## Sequencing
Phase 0 first, alone (deploy risk isolation — and it now carries the truth fix). Phase 0.5 next
(thin, hours). Phase 1 and Phase S can interleave (S reuses P1.1 brand assets + E6 sitemap work).
Phase 2 after the free-chat flag lands. Phases 3/4 slivers ride whichever session touches those
surfaces. RN = separate future initiative.

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Premises confirmed via office-hours gate (D2), #2 revised (D4): funnel analytics promoted into plan as Phase 0.5 | User-decided | — | Both models flagged unmeasured polish; user approved minimal revision | Keep-original |
| 2 | CEO | Approach B (Full Plan, 7 stages) selected | User-decided (D5) | P1 | Complete, per-phase shippable, matches stated goal | A (defer a11y/perf/RN), C (trust-wedge reframe) |
| 3 | CEO | E1 slop-lint script → Phase 1 | Mechanical | P2 | In blast radius (protects P1 files), S effort, no new linter | — |
| 4 | CEO | E2 OG share cards → Phase 1 | Mechanical | P2/P3 | Same sharp pipeline as P1.1, 2 files | — |
| 5 | CEO | E6 sitemap/meta refresh → Phase 1 | Mechanical | P2 | SEO hygiene in radius, 2-3 files | — |
| 6 | CEO | E3 supply-aware empty states | TASTE → final gate | P1 vs P3 | Borderline new UX behavior; answers liquidity concern | — |
| 7 | CEO | E4 funnel digest → TODOS | Mechanical | P3 | Baseline doesn't need push delivery | In-plan |
| 8 | CEO | E5 AI bio writer stays TODOS | Mechanical | P4/P2 | Outside blast radius, new feature | In-plan |
| 9 | CEO | E7 trust-engine/concierge → TODOS memo | Mechanical | P2 | Same reasoning that parked Approach C | In-plan |
| 10 | CEO | Deploy order backend→frontend | Mechanical | P5 | Admin page depends on new backend route | Frontend-first |
| 11 | CEO | Logo = hand-authored SVG monogram | Mechanical | P5 | No external tool dependency; simple mark | Design-tool export |
| 12 | CEO | axe via @axe-core/playwright | Mechanical | P4 | Reuses installed Playwright | Standalone axe CLI |
| 13 | CEO | Webhook e2e = directly-driven signed payload (tunnel optional) | Mechanical | P5 | No new tooling; HMAC path already timing-safe-tested | Tunnel-required |
| 14 | CEO | UC: F-004 removal moved into P0.1b, option b + founding-member narrative | USER CHALLENGE — accepted (D8.1) | — | Both voices: live legal/reputational exposure; option (a) self-defeating at tiny N | Wait-for-decision, real-counts |
| 15 | CEO | UC: Phase 0.5 demoted to thin server-side-only version | USER CHALLENGE — middle (D8.2) | — | Both voices: false precision; middle keeps DPDP-safe self-hosted measurement | Full spec, full demotion |
| 16 | CEO | UC: Phase 5 RN cut → store-launch initiative in TODOS | USER CHALLENGE — accepted (D8.3) | — | Apps in no store = zero users served; launch-prep branch is the right vehicle | Keep in plan |
| 17 | CEO | UC: free-chat-for-mutuals flag ON; P2.1 QAs both configs | USER CHALLENGE — accepted (D8.4) | — | Expired memo decided; two-way door; liquidity over gate at zero payments | Flag-off, no-flag |
| 18 | CEO | UC: thin Phase S added (landing, invites, SEO pages, bureau memo) | USER CHALLENGE — middle (D8.5) | — | Third ask, both voices; code-shaped parts only, outreach stays owner-led | Full Phase S, keep parked |
| 19 | CEO | UC: Phases 3/4 trimmed to signup-funnel a11y + Home LCP | USER CHALLENGE — accepted (D8.6) | — | Audit-grade work on unvisited surfaces deferred to dated cycle | Full audits now |
| 20 | CEO | Razorpay live-key KYC promoted to START-NOW owner task; pricing memo re-dating flagged | Mechanical | P6 | Days of lead time; expired memo queue visible | Leave as-was |
| 21 | CEO §1 | Flag lives in shared premium-definition helper (REST+socket single-source) | Mechanical | P5 | SOCK-5 precedent; two parallel checks drift | Two checks |
| 22 | CEO §1 | Invite = profileCode-pattern param + Users.invitedBy col; NOT marketing ReferralCode | Mechanical | P4 | ReferralCode FK CASCADE to marketing user = wrong semantics | ReferralCode reuse |
| 23 | CEO §1/2 | trackEvent util fire-and-forget, swallow+log, never on response path | Mechanical | P1 | Analytics must never 500 a signup | Inline awaited inserts |
| 24 | CEO §4 | Milestone-event dedupe via unique (userId,eventType) + ON CONFLICT | Mechanical | P1 | Same race class as F-015 | Exists-check read |
| 25 | CEO §9 | Flag ships DARK, flip ON after both-config QA | Mechanical | P6 | Fail-closed rollout; preserves D8.4 decision | Ship ON day one |
| 26 | CEO §11 | P0.1b also removes Est-2011 chip + seed testimonials (audit missed both) | Mechanical | P1 | Same fabrication class as F-004; real-stories path kept | Leave for later |
| 27 | CEO §11 | Invite-landing states specced (valid/absent/loading) | Mechanical | P1 | 4-states rule applies to new UI | Unspecced |

---

## CEO REVIEW — Required Outputs (2026-08-09, via /autoplan)

### NOT in scope (this plan)
- RN mobile work of any kind → future **store-launch initiative** (D8.3; starts from `mobile/launch-prep` + targetSdk35/Apple-4.8 blockers + selfie rework + TM assets + backend smoke).
- Full a11y audit (VoiceOver, contrast sweep, all-routes axe both themes, token gate) and full perf verification (Agora/BarChart chunks, API p95) → dated TODOS cycle (D8.6).
- Client analytics ingest route, admin funnel card, retention queue → re-enter at >100 signups/week (D8.2).
- Supply OUTREACH itself (gurdwaras, vendors, WhatsApp) → owner-led with the 100-profiles/30-days target; only code-shaped parts are in Phase S (D8.5).
- AI bio writer (E5), funnel digest email (E4), trust-engine surfaces/concierge (E7) → TODOS.
- Pricing revision → expired memo re-dated as Standing Decision 4, not code scope.

### What already exists (leverage map)
- `/admin/analytics` page + endpoint → would host the future funnel card (cut for now).
- `createRateLimiter` factory, `profileCode` util, sharp asset pipeline, Bull queue, `calculateCompletion` (profileController.js:43) → all reused, nothing rebuilt.
- Real-testimonials data path in Home.jsx (line 12) → P0.1b removes only the fake seed fallback.
- `rzp_test_` keys in dev env → payment e2e unblocked (corrected premise 5).
- Race-safe `ON CONFLICT` pattern (F-014/15) → reused for event dedupe.
- e2e two-phase login helpers, Playwright install → P2/P3' reuse; `@axe-core/playwright` is the only new dev-dep.

### Dream state delta
CURRENT: audited-but-undeployed fixes, fake claims live, TS logo, zero measurement, premium-gated chat nobody can buy, RN unshippable.
THIS PLAN: prod truthful + secure, TM brand, 5-event funnel readable by SQL, free-chat-for-mutuals QA'd both ways, founding-member + invite + city-SEO substrate, signup funnel accessible.
12-MONTH IDEAL: liquid Tricity marketplace, live payments, RN in stores, real testimonials replacing the seed slots, funnel card earned by traffic. Plan moves toward ideal on every axis; the one axis it deliberately only scaffolds (supply) now at least has its code substrate + owner target.

### Error & Rescue Registry
| Codepath | Failure | Class | Rescued | Action / user sees |
|---|---|---|---|---|
| trackEvent() | insert fails | SequelizeError | Y | log.warn(type,userId); user sees nothing |
| flag read | unset/garbage | — | Y | default OFF (fail-closed) |
| invite param | forged/missing inviter | — | Y | silently ignored; normal signup |
| chat send @ flag-off flip | 403 mid-thread | AppError 403 | Y | premium-expiry UI path (P2.1 QA) |
| funnel-report.sql pre-migration | psql error | — | N-ok | operator-only, fails loudly |

### Failure Modes Registry
| Mode | Likelihood | Impact | Mitigation |
|---|---|---|---|
| P0 deploy disrupts co-tenant | Low | High | scoped `tricitymatch-*` commands only; nginx -t before reload |
| Fake-claim removal tanks homepage conversion | Med | Med | founding-member narrative ships same deploy; Phase S strengthens it |
| Flag-ON spam via mutual matches | Low-Med | Med | 60/min message limiter, block/report, sanitize; watch reports after flip |
| Event table silently empty (emission bug) | Low | Low | unit spec on all 5 emission points + walkthrough exit gate |
| Invite attribution gamed | Low | Low | analytics-only signal; inviter-exists validation |
| launch-prep drifts further from main | Med | Med (future) | store-launch initiative TODOS entry names it; no RN edits from this plan |

### Completion Summary (CEO phase)
Mode SELECTIVE EXPANSION · premises confirmed then REVISED under 6 accepted cross-model user challenges (D8.1–6) · expansions: 3 accepted (E1/E2/E6), 1 taste pending (E3 supply-aware empty states → final gate), 3 deferred, 1 rejected · sections 1–11 executed, 7 findings all auto-decided and folded into the plan (rows 21–27) · dual voices ran (Codex + Claude subagent), consensus table 6/6 CONFIRMED-challenge → resolved through the D8 gate · registries + leverage map + dream delta above · tasks JSONL written.
| 28 | Design F1 | Deploy-1 homepage specced as a page map (ticker→true chips, cities→coverage, parents→hidden-at-zero) | Structural auto-fix | P5 | Both voices: deletions ≠ design; interim state is real production | Ship the diff |
| 29 | Design F5 | Founding grant mechanic added (founding_premium row + end-date + cap + sunset); no premium promise until it ships | Structural auto-fix | P1 | Prevents replacing fake stats with a fake offer | Promise-first |
| 30 | Design F15 | Invite tokens: random/distinct-salt, collision test vs /search/by-code | Structural auto-fix (security) | P1 | profileCode publicly resolves to full profile | Pattern reuse |
| 31 | Design F13 | Flag exposed via /auth/me features block; VITE_ env banned for it | Structural auto-fix | P5 | Build-baked flag = copy drift | VITE_ var |
| 32 | Design F14 | Six PLAN_FEATURES lists re-derived for flag-ON in the plan | Structural auto-fix | P1 | Pricing repositioning must be explicit | Edit-array-later |
| 33 | Design F11/E3 | E3 pulled INTO Phase S (was taste-gated) | Auto-decided, both voices | P1/P2 | Honest landing needs honest interior; reuses invite link | Keep at gate |
| 34 | Design F6/F4 | Invite send = Dashboard card + Settings row; receive = header kicker | Structural auto-fix | P5 | Send side had zero design; invite = strongest trust signal | Chip-under-form |
| 35 | Design F3 | One city template, /matrimony/{city} routes, counts banned, dark+elder parity | Structural auto-fix | P5 | Thin-content + drift risk; routes precede sitemap | 3 bespoke pages |
| 36 | Design F7 | Chat×flag×tier×mutuals state table decided before QA | Structural auto-fix | P1 | Can't QA an undesigned state | QA-discovers-design |
| 37 | Design F8/F9/F12/F16 | Logo 3 cuts + dark; OG card content; founding badge; chip-menu interaction; admin fields | Structural auto-fix | P5 | One-line ambiguities that haunt implementation | Ad-hoc |
| 38 | Design (Codex) | Home LCP budget ≤2.5s replaces "fix if >4s" | Structural auto-fix | P1 | Acquisition page gets a target | Vibes check |
| 39 | Eng #1/F1 | Flag via NEW requireChatAccess + utils/entitlements.js; requirePremium never modified | Structural auto-fix (corrects row 21) | P5 | "Shared helper" doesn't exist; branching requirePremium frees calls/viewers/unlocks/PDF | Flag-in-requirePremium |
| 40 | Eng F7 | Founding grant bundle explicit: contactUnlocksAllowed=N never NULL, out of UNLIMITED_PLANS | Structural auto-fix (CRITICAL) | P1 | NULL = unlimited (auth.js:230) → scriptable contact harvest | Naive Subscription.create |
| 41 | Eng #2/F9 | PURCHASABLE_PLANS split from PAID_PLANS; TIER_RANK.founding_premium:0; full enum-ripple checklist | Structural auto-fix | P1/P5 | plans.js:15 warns adding a tier auto-extends all gates; validator would 500 | Single PAID_PLANS |
| 42 | Eng #3/F6 | Pre-account events = raw counters (renamed); partial unique index WHERE userId IS NOT NULL; eventType STRING not ENUM | Structural auto-fix | P1 | NULLs distinct in PG unique indexes — dedupe claim was false for 2/5 events | Blanket index, ENUM |
| 43 | Eng #4/F4 | Invite: Users.inviteToken random + invitedBy SET NULL + public GET /invite/:token limiter + param `invite` not `ref` | Structural auto-fix | P5 | ref consumed by marketing flow (authController:106); derivation alt killed | Salt-derivation |
| 44 | Eng F3 | Users.isFoundingMember persists badge across upgrade/expiry | Structural auto-fix | P1 | verifyPayment supersedes + hourly sweep expire the row | Derive-from-active-row |
| 45 | Eng F8 | EXISTING bug: withDerivedUserFields missing endDate filter → /auth/me premium drift | Auto-fix, folded into P2 | P1 | Found in review; herd expiry makes it visible; solo repo = fix it | Leave |
| 46 | Eng F12 | Env plumbing: env.js + docker-compose allowlist + post-deploy features probe | Structural auto-fix | P1 | CORS_ORIGIN precedent — this failure class already shipped once | Assume passthrough |
| 47 | Eng F2 | Calls-in-chat row in state table; call affordance hidden for free users | Structural auto-fix | P5 | Flag-ON free mutuals would hit 403 call buttons | 403 surprise |
| 48 | Eng tests | Capability matrix + founding caps + create-order 400 + features contract + flushed trackEvent tests added | Structural auto-fix | P1 | Backend flag coverage was zero; CI must go red on entitlement regressions | UI-QA-only |
| 49 | Eng perf | FontLoader runtime Google-Fonts @import named first LCP suspect; self-host | Structural auto-fix | P1 | Render-blocking external fetch on the acquisition page | Leave to discovery |
| 50 | Eng #6 | profile_60pct captures old completion pre-save | Structural auto-fix | P1 | Emission after save sees new==new, crossing undetectable | Post-save check |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (via /autoplan) | 6 user challenges accepted, 3 expansions in, 13 section findings auto-decided |
| Codex Review | `/codex` voices | Independent 2nd opinion | 4 calls | CLEAR (via /autoplan) | office-hours cold read + CEO/design/eng voices; every finding absorbed |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN via /autoplan) | 12 findings incl. 1 critical (founding caps) + 1 existing prod bug (F8) — all folded in |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL via /autoplan) | score 6/10 → 9/10, 16 decisions |
| DX Review | `/plan-devex-review` | Developer experience | 0 | SKIPPED | no developer-facing scope |

**CODEX:** 4 invocations (cold read, CEO, design, eng) — challenged premise 2 (accepted-revised), demanded the entitlements split, caught the NULL-userId dedupe break and the marketing-`ref` collision.
**CROSS-MODEL:** Claude + Codex converged independently in every phase; consensus tables CEO 6/6, design 7/7, eng 6/6. Zero cross-model disagreements survived to the gate.
**VERDICT:** CEO + DESIGN + ENG CLEARED — plan APPROVED 2026-08-09 (D9); implement on Opus, Phase 0 first.

**UNRESOLVED DECISIONS:**
- Marketing-portal identity (burgundy vs keep-blue) — owner call, blocks only P1.3's recolor item (Standing Decision 2)
- Pricing memo re-dated to 2026-08-23 (Standing Decision 4) — owner call, blocks nothing in this plan
