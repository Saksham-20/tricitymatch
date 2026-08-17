# Production-Readiness Audit — 2026-08-17

Scope: security + code + design + load/stress for web + RN, per owner request. Driver: inline
sequential passes (background opus agents stalled on the 600s watchdog twice; inline is reliable).

## 1. Load & Stress Testing

### Prod (tricitymatch.com, capped + staged, co-tenant-safe)
- Script: `scripts/load-test-1k.js` (public read endpoints only, `abortOnFail` guards).
- Result: **p95 76ms** overall (home 174ms, api 57ms). Auto-aborted at 32s when the per-IP
  api limiter (900/15m) began shedding a single-source flood as 429 (k6 counts 429 as failure).
- **Co-tenants unharmed** (edumapping/school.globoniks baselined before + after, unchanged).
- Caveat: a single load-gen host = one source IP, so per-IP limiters cap sustained throughput
  far below 1000 *distinct* users. Prod's edge is fast and the limiter works; true
  distinct-user capacity needs distributed load gen or a test-window limiter bump.

### Local saturation (limiter off, `DISABLE_RATE_LIMITS=true`, second backend on :5055)
- Script: scratchpad `load-local.js`, staged ramp to 1000 VU over 3m20s.
- Result: **1000 concurrent VU · 6,728 req/s · 1.35M requests · 0 interrupted iterations.**
  p95 **413ms** overall, p95 **465ms** on the DB-backed endpoint.
- The "33.33% error rate" = exactly 1 of 3 endpoints/iteration is `/search`, which 401s
  unauthenticated (k6 scores 401 as failed). `/health` + `/success-stories` were 200 throughout.
  Real failure ≈ 0.
- **Verdict: app tier + DB reads hold at 1000 concurrent on a single dev instance.** Prod
  (multi-container + clustering) exceeds this.

## 2. Security

### 16-commit RN diff (this branch, unpushed)
- **No new vuln.** Client-side RN only.
- Payment: `openRazorpay` no longer fabricates success — fake stub only under `__DEV__` +
  missing module; release throws `PaymentsUnavailableError`; real checkout outcomes propagate.
  (Net **security improvement** vs prior fake-success-on-cancel.)
- Permissions: dropped `SYSTEM_ALERT_WINDOW`, `WRITE_EXTERNAL_STORAGE`, `READ_PHONE_STATE`
  from release APK. Attack surface reduced.
- No hardcoded secrets. `key: CONFIG.RAZORPAY_KEY_ID` = publishable key (client-safe).
- Deep-link intent filters added but `assetlinks.json` not served → links fall to browser.
  Not exploitable (no app-verified handler to hijack). Informational.

### Backend core (server-side) — verified present, not just claimed
- `middlewares/auth.js`: no query-param token fallback; JWT type-checked; adminAuth/marketingAuth
  role gates; requirePremium/VIP filter endDate in-query.
- `utils/razorpay.js` verifyPayment: timing-safe HMAC w/ length guard. ✅
- subscription webhook: HMAC-SHA256 over raw body, timing-safe compare, 401 on bad/missing sig,
  prod env guard requires secret. ✅
- `groupController`: requireMembership authz on every read/write, owner-only mutations. IDOR-closed. ✅
- `chatController.getConversations`: raw SQL uses parameterized `IN (:ids)` — array-expansion safe. ✅
- `middlewares/upload.js`: MIME + extension + magic-byte validation, resource_type pinned. ✅
- **IDOR tail — verified clean:** guardian `candidate/:id/matches|shortlisted` require an active
  `GuardianLink` (403 else); astrologer `book/:id/verify-payment|start-call|end-call` all scope
  `{id, userId: req.user.id}`; unlock-contact = `requirePremium` + `checkContactUnlockLimit` quota
  + `verifyTargetUser`, rejects self-unlock; profile viewers premium-gated; match action validated
  + `verifyTargetUser`. No IDOR found. **Backend security: production-ready.**

## 3. Code Correctness (RN)
- API envelope-unwrap bug class (`return res.data` when server sends `{success,<key>}`): checked
  notifications, match-action, compatibility, horoscope, voice-intro. All server responses put
  fields at the **top level** of the envelope → `res.data.<field>` resolves. **No remaining
  unwrap bugs** beyond the ones the 16 commits already fixed (admin stats, astrologer booking).
- `bureau.ts` = known-dead stack (no `/bureau` routes). `calls.ts` = Agora config-gated.

## 4. Design / Phone UI

### Applied (safe, mobile tsc 0 errors)
- `ProfileCard.tsx`: verified badge off-palette `#5DD27A` → `colours.success`; gold (`g600`) on the
  **standard** shortlist action → `colours.accent` (brand: gold = premium/VIP only); compact
  icon button 40×40 → 44×44 (touch-target min).
- `HomeScreen.tsx`: verified badge `#5DD27A` → `colours.success`.
- Skipped Home "Visitors" chip gold — profile-viewers is premium-gated, so gold there is a likely
  intentional premium signal, not a violation.

### Reported, not applied (too broad for safe-auto — need owner sign-off)
- **Two typography systems coexist** (`type.*` named scale vs `typography.fontSize/fontFamily.*`)
  → inconsistent adherence across screens. Consolidate to one.
- **Light-locked brand ships full `darkColours` + `useTheme` respects system scheme.** Screens split
  between static `colours.*` and theme-aware `c.*` (e.g. SearchScreen sort/save modals use static
  → wrong in dark mode while the rest of the screen is theme-aware). Single biggest consistency
  fault. Decide: commit to light-lock (drop dark path) or finish theming every screen.

## 5. Web — Live Prod Findings (mobile viewport, Playwright)

### 🔴 FIXED (needs frontend deploy to take effect): site-wide font regression
- **Symptom:** on prod, `document.fonts` shows Playfair **not loaded**; headings compute to
  `Georgia, serif` fallback; body to system-ui. Every brand font (Playfair, Inter, Instrument
  Serif, Cormorant) fails to load for 100% of visitors.
- **Root cause:** `frontend/index.html:82` used the `media="print" onload="this.media='all'"`
  async-CSS trick. The site CSP (`script-src 'self' …`, no `unsafe-hashes`) **blocks inline event
  handlers**, so `onload` never fired → the stylesheet stayed `media="print"` → fonts applied only
  to print, never screen. Console: *"Executing inline event handler violates … Content Security
  Policy"* at `/:82`. The `<noscript>` fallback only helped JS-disabled visitors (i.e. nobody).
- **Fix:** converted to a plain render-blocking `<link rel="stylesheet">` (CSP-safe, guaranteed) +
  added `preconnect` to fonts.googleapis.com and fonts.gstatic.com to offset the block. `display=swap`
  keeps text painting in fallback then swapping. **Requires a frontend rebuild + deploy to land on prod.**
- Other homepage console errors (`/api/auth/me` 401, `/api/auth/refresh` 400) are expected for a
  logged-out visitor — not bugs.

### Web slop scan — clean
- 39 `bg-<color>-50/100` hits are all **semantic** (admin status chips + onboarding verified/success
  green), not the rainbow info-box slop the doctrine removes. No fix needed.

## 6. Web Authed Workflow QA (prod, Playwright @375px, QA member account)
Walked the core member journey after login (progressive identifier→password flow works):
- **Dashboard** — "Good morning, QA", Playfair heading (font fix confirmed authed), no error, no h-scroll.
- **Search** — "9 profiles", results render, no error/empty.
- **Matches** — 3 tabs (Saved/Mutual/Likes You), real data (Nikita Chadha 25), no error.
- **Settings** — Account/Password/Privacy/Visibility sections, 0 console errors.
- **Own Profile** — 35% strength, "10 fields missing", no `undefined`, no error.
- **Verdict: clean.** No new defects. Only console noise = transient Cloudinary image 503s
  (verified transient — same URL returns 200 on retry; `SmartImage` degrades to initials anyway).
- Not exercised (mutating/destructive): chat send, payment/subscription purchase.

## 6b. 🔴 CRITICAL — Mobile app cannot authenticate against production (CORS)

Found by driving the Android build live against prod.

- **Symptom:** RN app login shows "Something went wrong." App builds/installs/renders fine; device
  reaches prod over HTTPS (browser loaded `/api/v1/success-stories` → JSON). Bundle verified pointing
  at `https://tricitymatch.com/api/v1` (no localhost).
- **Root cause:** `backend/middlewares/security.js:319-327` (`corsDelegate`). In production it **blocks
  requests with no `Origin` header on state-changing methods** (POST/PUT/DELETE) — an intentional CSRF
  guard for the cookie-auth SPA (SEC-2/BUG-P005). But **React Native sends no `Origin` on any request**,
  so every mobile write — including `/auth/login` and `/auth/signup` — is 403 "Not allowed by CORS".
- **Proof:** `POST /auth/login` with `Origin: https://tricitymatch.com` → `success:true` (+ body tokens);
  same POST with **no** Origin → `{"code":"FORBIDDEN","message":"Not allowed by CORS"}`. GET no-Origin
  is allowed (safe method), which is why reads/browser-nav worked.
- **Why latent:** prior app testing ran against the LOCAL backend via `adb reverse 5001` (dev branch
  allows no-Origin). This is the first time the app was driven against **prod** — surfacing it.
- **Impact:** the shipped mobile app cannot log in, sign up, or perform any write against prod. Launch-blocking for mobile.
- **Recommended fix (safe, preserves the browser CSRF guard):** have the RN client send a custom header
  (e.g. `X-App-Client: mobile`) on all requests, and in the `!origin` state-changing branch allow the
  request when that header is present. Browsers cannot set custom headers cross-origin without a CORS
  preflight (which enforces the allowlist), so a cross-site attacker cannot forge it — the cookie-auth
  CSRF protection stays intact, and the token-auth mobile app is unblocked. Two small changes: backend
  1-line in corsDelegate + mobile axios default header. Needs a backend redeploy.
  - Alternative (simpler, weaker): exempt only `/auth/login|signup|refresh` from the no-Origin block.
  - NOT recommended: allow all no-Origin writes (reopens the CSRF hole the guard closed).

## 7. Shipped This Session
- **Font-CSP fix committed + deployed to prod** (`48d7241`), frontend container rebuilt + recreated
  (`--no-deps`, co-tenants unaffected). Live-verified: Playfair/Inter/Instrument Serif now load.
- RN brand fixes + this audit doc committed. All 19 commits pushed to origin/main.

## 8. Still Open (owner decision)
- RN larger design refactors: two coexisting typography systems; light-lock-vs-dark-theme screen
  split (static `colours.*` vs theme `c.*`). Note: app is light-locked (`userInterfaceStyle: light`),
  so the split is currently **not user-visible** — it's dead-weight risk, not a live bug. Decide:
  remove the dark path, or finish theming every screen.
- RN selfie live-camera rework; dark-mode retrofit; EAS `projectId` (still literal `tricityshadi-app`
  → no EAS build can run) — from prior RN review, unchanged.
