# Deep QA Run — Master Plan (2026-07-08)

> **Authored by:** Claude Fable 5 (planning pass — research + plan only, no execution).
> **Executed by:** Claude Opus — one chunk (or small group of chunks) per session.
> **Companion document:** `docs/QA_DEEP_RUN_2026-07-08_CHECKLIST.md` — the living, element-level checklist. This plan explains *how* and *why*; the checklist is *what* gets ticked.
> **Base playbook:** `docs/QA.md` (method, severity legend, anti-slop rules). This plan does not replace it — it instantiates it into a concrete, chunked, cross-platform run.

---

## 1. Objective

A complete, end-to-end QA pass of the entire product surface:

1. **Web app** — every public, member, admin, and marketing page; every button, form, state, and viewport (375 / 768 / 1440).
2. **React Native apps** — every screen on **both** iOS simulator and Android emulator (dev builds).
3. **Backend** — every REST endpoint (all 17 route files), socket events, and the security posture around them.
4. **Web ↔ Mobile sync** — the same account, the same data, actions on one platform visible on the other. Feature parity verified against the expected-gaps map (§8); *unexpected* divergence is a bug.
5. **End-to-end depth** — each feature is tested as a full workflow (UI → API → DB → other platform), not as isolated screens.

Everything found is handled by the core method: **TEST → FAIL → root-cause → FIX → RETEST → VERIFY**, fix-on-discovery, one chunk at a time.

### Non-goals
- No new features (except fixes for bugs found; large reworks get flagged as work items, see §7).
- No dependency migrations (react 19, tailwind 4, express 5, etc. — held deliberately).
- No prod deployment during the run (optional read-only prod smoke at the very end, §15).
- No load/perf engineering beyond the checks in chunk C21.

---

## 2. Operating model (Fable plans, Opus executes)

- This plan + checklist were produced by Fable. **All execution sessions run on Opus** (user switches model).
- **One session = one chunk** (or 2–3 small chunks if context allows). Never attempt the whole run in one session.
- Session start ritual (every session):
  1. Read `CLAUDE.md` (per project rule), this plan's §3–§8, and the checklist's **current chunk section only**.
  2. Check the checklist "Run state" header to find the first non-✅ chunk.
  3. Bring up the environment per §4 (or verify still up).
- Session end ritual (every session):
  1. Update the checklist: tick items, set chunk status, append findings to the Findings Log with bug IDs.
  2. Run the relevant regression gate if code was changed (§12).
  3. Commit the chunk's fixes + checklist update (`qa(deep-run): C<N> <chunk name> — <n> fixed / <n> deferred`).
  4. If context is running low mid-chunk, update the checklist with exact resume point *first*, then stop.

---

## 3. Ground rules (binding for every chunk)

1. **Method:** TEST → FAIL → root-cause → FIX → RETEST → VERIFY. Fix-on-discovery for anything ≤ ~1 hour of work. Bigger than that → log as work item `W-xx` with severity, keep moving.
2. **Evidence for every finding:** URL/screen + viewport/platform + screenshot (or uiautomator dump / logcat excerpt) + `file:line` root cause.
3. **Live app is the source of truth**, not the source code.
4. **One chunk at a time.** Do not drift into another chunk's territory; if you find a bug belonging to a later chunk, log it in the Findings Log tagged with that chunk and move on.
5. **Severity:** 🔴 Critical (data loss, crash, auth/payment broken) · 🟠 High (feature broken for a class of users) · 🟡 Medium (workflow friction, wrong data shown) · ⚪ Low/Cosmetic.
6. **Bug IDs:** `DQ-001, DQ-002, …` (deep-run scheme, sequential across all chunks; keeps clear of old BUG-/P-/UX- schemes).
7. **Known-issues ledger (§7) and parity map (§8) are law:** do not re-report ledger items as new bugs; do not "fix" config-gated features by hacking around missing creds. Verify they degrade *gracefully* — a crash or white screen on a config-gated feature IS a bug.
8. **Anti-slop / professionalism** checks (`docs/QA.md` §2) apply to every screen on every platform: no emoji-in-copy, no unicode-as-icon, no rainbow gradients/pastel info boxes, brand is **TricityShadi**, burgundy `#8B2346` accent / gold `#C9A227` premium-only.
9. **All 4 data states** (default / loading / empty / error) verified wherever a view fetches data. Error state = kill backend or force 500 where practical.
10. **Console/network discipline:** web console 0 non-benign errors; RN logcat/Metro no redbox, no unhandled promise rejections; network tab no unexpected 4xx/5xx (logged-out 401 probe is expected).
11. **Screenshot honesty (web):** `react-countup` scroll-spy + `whileInView` render 0/blank in static fullPage shots — scroll element into view before judging (see CLAUDE.md "QA method notes").
12. **Data hygiene:** test accounts use `qa.deep.*@tricityshadi.com`; delete them in C22. Never send SMS to arbitrary numbers. Emails go to owned inboxes only.
13. **No destructive ops on shared infra.** Local dev DB is fair game (it's seeded/rebuildable); prod is read-only if touched at all (§15).

---

## 4. Environments & bring-up

### 4.1 Services (local dev — primary environment)

| Service | Where | Command | Check |
|---|---|---|---|
| Backend | :5001 | `npm run dev:backend` (repo root) | `curl -s localhost:5001/api/v1/subscription/plans` returns JSON |
| Frontend | :3000 | `npm run dev:frontend` | `curl -sI localhost:3000` → 200 |
| Postgres | :5432 | (already provisioned; migrations `npm run migrate` in `backend/` — through **000042**) | `SELECT 1` via psql, creds from `.env.development` |
| Redis | :6379 | optional — cache/lockout falls back to in-memory | note whether running (affects nothing functionally) |
| Metro | :8081 | `cd mobile && npx expo start --clear` | bundler ready |

### 4.2 Web driver
- **Playwright MCP** (`mcp__playwright__browser_*`). Viewports: **375×812**, **768×1024**, **1440×900**. Admin/marketing audited at 1440 primarily (spot-check 375).
- Console via `browser_console_messages`, network via `browser_network_requests` after each screen.

### 4.3 iOS simulator
- Dev client is prebuilt (`mobile/ios/` committed). `cd mobile && npm run ios` (first launch of a session) or reopen installed app + Metro.
- Simulator reaches the API at `http://localhost:5001` directly.
- Drive via `xcrun simctl` (+ `idb` if installed) and screenshots: `xcrun simctl io booted screenshot <path>`.
- Gotcha: iOS Strong-Password modal can hijack signup password fields — use "Choose My Own Password" / dismiss.

### 4.4 Android emulator
- AVD `qa_pixel` (exists from prior pass): `emulator -avd qa_pixel` (or Device Manager). `cd mobile && npm run android` first time, then Metro serves.
- **Port bridges (every emulator boot):** `adb reverse tcp:5001 tcp:5001 && adb reverse tcp:8081 tcp:8081` → app reaches `localhost:5001`.
- Drive via `adb input tap/text/swipe`, read UI via `adb exec-out uiautomator dump /dev/tty`, crashes via `adb logcat`.
- Screenshots: `adb exec-out screencap -p > <path>`.

### 4.5 Env keys (expected state — verify in C0, don't "fix")
- `EXPO_PUBLIC_API_URL=http://localhost:5001` for both sims (Android via adb reverse).
- Config-gated OFF in dev (expected): Razorpay (placeholder), Google OAuth, FCM push, Agora (`VITE_AGORA_APP_ID` / `EXPO_PUBLIC_*` unset).
- LIVE in dev (careful): **SMS OTP via MSG91** (real texts — never trigger to arbitrary numbers) and **Email via Resend** (real emails — only to owned inboxes).

### 4.6 OTP bypass procedure (for signup e2e without real SMS)
1. Add `OTP_BYPASS_CODES=000000` to `.env.development`.
2. `touch backend/server.js` — **nodemon does not reload on .env changes.**
3. Run the flow using OTP `000000`.
4. Revert the `.env` change + `touch backend/server.js` again. Leave `.env` exactly as found.

### 4.7 Native-module reality on the committed dev builds
Not in the current dev binaries (verified in the 2026-06-29 pass): **Agora, expo-camera, expo-haptics** (haptics is a safe no-op). Calls + RN selfie capture therefore can't be exercised natively on sim — verify graceful degradation only. Razorpay/Firebase are stub/config-gated.

---

## 5. Accounts & fixtures

| Role | Account | Notes |
|---|---|---|
| Admin (web + RN admin stack) | `admin@tricitymatch.com` / `Pass@1234` | seeded; re-seed `node backend/seeders/adminSeeder.js`. Login at `/login`. |
| Member A (premium) | pick a seeded member (password `Pass@1234`) | **Fix the known seed quirk first:** set plan via admin `PUT /api/v1/admin/users/:id/subscription` to `vip` with future endDate (seeded rows have invalid `elite`/expired dates). |
| Member B (free) | second seeded member | for gating tests + the A↔B match/chat pair |
| Member C (fresh) | `qa.deep.c1@tricityshadi.com` etc. | created during C2 signup tests via OTP bypass; delete in C22 |
| Marketing user | create via admin `POST /admin/marketing-users` in C18 | for `/marketing/*` portal |
| Bureau user (RN) | investigate in C19 — set `role='bureau'` on a test user via SQL if no seeder | RN-only stack |
| Prod QA member (only if §15 runs) | `globoniksprod@gmail.com` / `TricityQA@2026` | real prod account; OTP/emails land in that Gmail |

**A↔B pair setup (used by C6–C9, C12):** Member A likes B, B likes A → mutual → chat unlocked (A is premium). Keep these two logged in web (Playwright) + RN (sim) in whatever combination the chunk's sync tests need.

**DB inspection:** `psql` with creds from `.env.development` — verify writes for critical flows (signup row, subscription row, verification row, unlock count, group membership).

---

## 6. Tooling summary

| Layer | Tool |
|---|---|
| Web UI | Playwright MCP (snapshot → click/type → screenshot; console + network after each screen) |
| Android | `adb` (input/uiautomator/logcat/screencap) |
| iOS | `xcrun simctl` (+ `idb` if present) |
| API | `curl` + `jq` (scripts in scratchpad; cookie jar for auth: login → save cookies → reuse) |
| DB | `psql` |
| Regression | `cd backend && npm test` · `cd frontend && npm test` · `cd mobile && node_modules/.bin/tsc --noEmit -p tsconfig.json` · `npm run build` (frontend) · Playwright e2e (`npm run qa`, services up) |

**Jest 30 note:** `--testPathPatterns` (plural). **Mobile tsc:** repo PATH tsc is v4 — always use `mobile/node_modules/.bin/tsc`.

---

## 7. Known-issues ledger (verify graceful, do NOT re-report as bugs)

Config-gated (missing creds, not code):
1. Razorpay placeholder → order creation fails gracefully; web Subscription shows "payments opening soon" notice. Verify notice, don't wire payments.
2. Google OAuth off → button behavior graceful.
3. FCM push stub → no push; `POST /admin/push-smoke-test` returns a sane config-gated response.
4. Agora unset → web call buttons auto-hide (`VITE_AGORA_APP_ID` unset); RN call screens degrade without crash.
5. SMTP unwired → `documents` email channel falls back to Resend.

Known product gaps (documented, deliberate):
6. **RN verification screens stale** after 2026-07-02 selfie-only pivot — RN ID-tier submit would 400; tiers 3/4 "Coming soon"; RN live-selfie rework **deferred** (expo-camera not in dev binary). C10 verifies no-crash + honest messaging, and the final report re-flags this as work item **W-RN-SELFIE** (🟠).
7. Saved searches — no backend; RN UI hidden. If web Search still shows a save-search affordance, that's a real bug (check in C5).
8. Sent-interests ("My Interests") — no backend; RN tab removed.
9. Astrologer table unseeded — RN falls back to `STUB_ASTROLOGERS`; web shows empty/stub. Verify states, don't seed real data (unless a chunk needs one row to test booking UI — then delete it after).
10. RN i18n residual: 6 member screens hardcoded EN (Notifications, Astrologer×2, HoroscopeMatch, Support, SuccessStory); admin/bureau/call screens EN. Web i18n only Navbar/Login/feature pages ×3 langs.
11. Seed photos are relative `/uploads/*` paths with no files → initials fallback everywhere (prod uses Cloudinary absolute). Blank-avatar reports against seed data are noise; a broken avatar with a *real* Cloudinary URL is a bug.
12. Admin user detail "No profile created yet" for admin's own row; admin account name/email says "TricityMatch" (DB data, not code).
13. `emailService.js` legacy path (chat+match notices) — delegates to `email.js`; fine.
14. Dormant `bgCheck*` DB columns — feature removed 2026-07-07, columns intentionally left.
15. Backend integration tests (`auth.test.js`) need a live DB — not part of the unit gate.

---

## 8. Web ↔ RN parity map (expected divergence — anything ELSE is a bug)

| Feature | Web | RN | Sync expectation |
|---|---|---|---|
| Family group chat | **no UI** (backend + RN only) | full UI | RN↔RN + API only |
| Kundli match PDF | download button (premium) | not built (deferred) | web-only |
| Live selfie verification | getUserMedia live capture, no upload | stale screens (ledger #6) | web-only until W-RN-SELFIE |
| In-browser/app calls | config-gated hidden | config-gated stubs | neither testable natively |
| Matches hub | `/matches` — Saved / Mutual / Likes-You tabs | Matches — Mutual / Shortlisted / Liked Me (3 tabs) | same underlying lists must match |
| Admin | full panel (14 pages) | 3 screens (Home, VerificationQueue, ReportsQueue) | queues show same rows |
| Marketing portal | web only | — | — |
| Bureau | — | RN-only stack | — |
| Onboarding | 2-step self-signup (guardian mode = long path) | 14-step | `onboardingComplete` flag must round-trip identically |
| Theme/language/elder | per-device settings | per-device settings | **not** synced — expected |
| Profile Visitors / Recently viewed | Dashboard rails | OwnProfile rails | same data both sides |
| Success stories | public page + submit? (verify) | browse + submit screens | same published list |

Everything else (auth, profile CRUD, photos, search, matching, chat, notifications, subscription state, block/report, guardian, privacy) is expected to behave **identically** on both platforms against the same account.

---

## 9. Canonical cross-platform sync scenarios

Executed inside their owning chunks (referenced as SYNC-1…12):

1. **SYNC-1 (C2):** Account created on web logs into RN with same creds; account created on RN logs into web. Session revocation (`logout-all` / DEL session) kicks the other platform's refresh.
2. **SYNC-2 (C3):** `onboardingComplete` set by web onboarding → RN goes straight to Main (no re-onboarding), and vice versa.
3. **SYNC-3 (C4):** Profile field edited on RN → web shows it after reload (and reverse). Privacy toggles set on web round-trip into RN PrivacySettings.
4. **SYNC-4 (C4):** Photo uploaded on web (Cloudinary) → appears in RN gallery + as avatar; delete on RN → gone on web.
5. **SYNC-5 (C6):** A likes B on web → B's RN Liked-Me (premium view) + notification on both; B likes back on RN → mutual appears on BOTH Matches surfaces + both get notifications.
6. **SYNC-6 (C7):** Live socket: message sent from RN appears in open web chat without reload; typing indicator crosses platforms; edit + delete propagate live; online status dot.
7. **SYNC-7 (C9):** A blocks B on RN → B disappears from A's web search/chat; unblock restores.
8. **SYNC-8 (C10):** Admin approves verification → verified badge appears on web (search card, profile) AND RN (badges) for the same user.
9. **SYNC-9 (C11):** Admin changes user's subscription → web + RN premium gates flip accordingly (chat access, viewers rail, Likes-You tab).
10. **SYNC-10 (C12):** Notification marked read on web → RN unread badge count correct after refetch; deep links land on the right screen both sides.
11. **SYNC-11 (C13):** Guardian invite issued on web, resolved, then RN GuardianView sees the same candidate data (read-only).
12. **SYNC-12 (C8):** Compatibility/horoscope scores for the A↔B pair are the SAME numbers on web and RN (same API, no client-side drift).

---

## 10. Chunk map

> Statuses live in the checklist, not here. Order respects data dependencies (auth before profile before matching before chat…). Sizes: S ≈ ⅓ session, M ≈ ½–1 session, L ≈ 1 full session.

| ID | Chunk | Platforms | Size | Depends on |
|---|---|---|---|---|
| C0 | Environment bring-up, baseline, fixtures | all | M | — |
| C1 | Public web pages + SEO + RN Splash/Welcome | web ×3 viewports, RN ×2 | M | C0 |
| C2 | Auth end-to-end (signup/login/logout/reset/sessions/lockout/OTP) | web, RN ×2, API | L | C0 |
| C3 | Onboarding (web 2-step + guardian mode; RN 14-step; flag sync) | web, RN ×2 | L | C2 |
| C4 | Own profile: view/edit/photos/voice/video/privacy/completion/profile-code | web, RN ×2, API | L | C2 |
| C5 | Search + filters + suggestions + by-code | web, RN ×2, API | M | C4 |
| C6 | Matching lifecycle: daily/like/shortlist/pass/mutual + Matches hubs | web, RN ×2, API | L | C5 |
| C7 | Chat + sockets + family groups | web, RN ×2 (two clients), API | L | C6 |
| C8 | Profile detail + compatibility/horoscope/kundli PDF/quiz/PreferenceMatch | web, RN ×2 | M | C6 |
| C9 | Contact unlock + block/report (member side) | web, RN ×2, API | M | C6 |
| C10 | Verification (selfie) + admin review + badge propagation | web, RN ×2, admin | M | C2 |
| C11 | Subscription: plans/upgrade/history/invoice/payment pages/webhook security | web, RN ×2, API | M | C2 |
| C12 | Notifications: in-app both platforms + email templates | web, RN ×2, API | M | C6 |
| C13 | Guardian flows | web, RN ×2, API | M | C2 |
| C14 | Astrologers (stub-data states + booking UI) | web, RN ×2 | S | C2 |
| C15 | Calls (config-gated degradation) + call history API | web, RN ×2, API | S | C2 |
| C16 | Settings, i18n (en/hi/pa), dark + elder themes, delete account | web, RN ×2 | M | C2 |
| C17 | Admin panel (14 pages) + RN admin stack | web 1440, RN ×2 | L | C10, C11 |
| C18 | Marketing portal + admin marketing management | web 1440 | S | C17 |
| C19 | Bureau RN stack | RN ×2 | S | C0 |
| C20 | Full API sweep + security spot-checks (every endpoint) | API | L | C2 |
| C21 | Non-functional: states/offline/perf/SEO/a11y/monitoring | all | M | C1–C17 |
| C22 | Regression gates, e2e suite, cleanup, final report, doc updates | all | M | everything |

### Per-chunk briefs

**C0 — Environment + baseline.** Bring up backend/frontend/Postgres, boot both sims, adb reverses, verify dev builds launch and reach the API. Record baseline: backend unit count (expect ~155 green), frontend vitest (expect ~48), mobile tsc 0, `npm run build` green, migration head = 000042. Fix Member A's plan via admin subscription endpoint. Prepare curl cookie-jar login scripts in scratchpad. **Exit:** all services green, baseline recorded in checklist, A/B accounts confirmed working on all three clients.

**C1 — Public web + RN entry.** Home, About, Contact (form→DB+support email), Safety, Terms, Privacy, Success Stories (public), 404 handling, robots.txt/sitemap.xml, per-route Seo meta, Navbar/Footer/BottomNav chrome at 3 viewports. RN Splash + Welcome (branding, language). Anti-slop sweep. **Exit:** every public route ✅ at 375/768/1440, console clean.

**C2 — Auth.** Web: 2-step signup (SmartContactField email + phone variants, OTP boxes auto-verify, 409 on existing contact, create-after-verify, `emailVerified`/`phoneVerified` stamped in DB), progressive login (identifier→password recap chip, Change), forgot/reset (Resend email to owned inbox), change-password, sessions list + revoke, logout/logout-all, lockout (5 wrong → 429/lockout, message honest), google button graceful. RN: signup (no-names contract), login + biometric path, forgot/reset, OTP 4-box, 429 lockout UI. API: refresh rotation + family revoke, cookie flags. SYNC-1. **Exit:** full matrix in checklist ✅, fresh accounts created cleanly on both platforms.

**C3 — Onboarding.** Web self-signup 2-step (account+OTP → BasicInfo → preview card → dashboard); guardian `create_for_other` long path; edit-mode reuse (`/profile/edit` hydration — regression-watch the 2026-07-03 bug class); resume behavior; draft isolation. RN 14 steps: every step's inputs, validation, back/forward, DOB picker (date-only), progress bar, resume via OnboardingContext. SYNC-2 both directions. **Exit:** new accounts on each platform land correctly with `onboardingComplete` true and profiles populated.

**C4 — Own profile.** Web MyProfileView + ModernProfileEditor (all sections incl. height/weight, section deep-links `?section=photos`, save round-trip); photo upload/delete (Cloudinary, 6 max, face+gallery), voice intro, video intro record/playback/delete; privacy settings persistence (regression-watch the model-columns bug); completion meter parity web↔RN (same %); profile code visible + copyable. RN OwnProfile (ring %, badges, visitors + recently-viewed rails, inline edit), EditProfile (prefill, save), PrivacySettings. SYNC-3, SYNC-4. **Exit:** same profile data everywhere, all media flows work.

**C5 — Search.** Web Search: filters (all fields incl. religion/caste/income/motherTongue/gotra-exclude/manglik ranges), sorts, pagination, empty vs error states distinct, ProfileCard contents (badges, compat, boost ordering if VIP present), suggestions endpoint, by-code lookup `TCS-XXXXXXXX` (web UI + API), incognito behavior if toggled. RN Search: infinite scroll, FilterPanel sheet (gorhom v4 — crash-watch), sort, card parity. Confirm no save-search affordance web (ledger #7). **Exit:** same query → same result set web vs RN.

**C6 — Matching.** Daily matches (IST cache, free 5 / premium 15 — verify counts per plan), like / shortlist / pass actions + limiter, mutual creation, web `/matches` (Saved/Mutual/Likes-You premium gate + 403 upsell), RN Matches 3 tabs + offline shortlist (MMKV — airplane-mode check), Likes-You premium gating both sides, match notifications. SYNC-5. **Exit:** A↔B mutual established and visible identically on all clients (this pair feeds C7–C9).

**C7 — Chat + groups.** Premium gate (free B blocked appropriately — web gate + RN Plus+ gate), conversations list, thread (history, pagination, receipts, typing, optimistic send, edit, delete), socket room security (mutual+premium), online status. SYNC-6 with web+RN live simultaneously. Family groups (RN + API): create, invite by userId + phone, member add/remove/leave, group messages CRUD, membership gate (non-member 403 — API probe), socket broadcasts server-authoritative. Web correctly has no group UI (parity map). **Exit:** live bidirectional chat verified; group IDOR probes clean.

**C8 — Profile detail + compatibility.** Web ProfileDetail single-column redesign (no dead void, all tabs, sticky actions, contact section gating, social links), PreferenceMatch "do you fit" card (denominator excludes viewer-unfilled), compatibility endpoint + breakdown, horoscope-match (Ashtakoot gunas, dosha, manglik, numerology block), kundli PDF download (premium; valid PDF), RN ProfileDetail (accordions, compat sheet, horoscope screen, voice playback, ⋮ block/report entry), Quiz (10q) + quiz CTA. SYNC-12 (same scores). **Exit:** detail surfaces complete + consistent.

**C9 — Unlock + block/report.** Contact unlock: plan limits (basic 5 / plus 10 / vip unlimited), counter decrement, unlocked contact persists, free-user gate. Block: SYNC-7 effects (search/chat/matches hidden both platforms), unblock restores. Report: submit → row → appears in admin queue (full loop lands in C17). **Exit:** entitlements enforced exactly per plan table.

**C10 — Verification.** Web `/verification` + Settings tab: LiveSelfieCapture (getUserMedia — grant via Playwright fake-camera flags), no file-upload path anywhere, camera-denied message, submit → Cloudinary → pending; admin queue side-by-side selfie vs profile photos, zoom lightbox, approve + reject (+adminNotes) → member status + notification + email copy correct; badge derivation (SYNC-8). RN: Verification/SelfieVerification screens no-crash + honest state (ledger #6; record W-RN-SELFIE). API: submit validation (missing selfie → 400 clean). **Exit:** full approve loop + reject loop verified web-side; RN degradation documented.

**C11 — Subscription.** Plans display parity (₹0/₹1500/₹3000/₹7499, features per plan — RN uses shared PLANS + live price overlay); create-order gating: free→any OK, active→higher tier OK (TIER_RANK), same/lower → clear 409 (test via API since Razorpay is placeholder — expect the payments-opening-soon notice on web UI); verify-payment supersede logic (unit-tested — spot-check code path only); history, invoice PDF (GET invoice/:id — valid PDF, correct branding/email), payment success/failed pages render, cancel current subscription, admin subscription override (SYNC-9). Webhook: no-Origin request reaches HMAC (401 sig, not CORS 403). **Exit:** every gate matches the plan matrix; no way to double-subscribe.

**C12 — Notifications.** Generation points (like, mutual, message, verification, subscription) → list on web + RN, unread-count endpoint, mark one/all read, delete, deep links (web routes + RN screens), pagination/infinite scroll, empty states, SYNC-10. Email leg (Resend, owned inboxes only): trigger one of each reachable template — welcome, reset, verification approved/rejected, subscription confirmation — verify branding (burgundy header, no "TricityMatch", working CTAs, support footer). FCM: token register/delete endpoints respond; push itself config-gated. **Exit:** every notification type lands correctly on both platforms.

**C13 — Guardian.** Web `/guardian`: invite (email-based) → resolve-invite token flow → my-guardians / my-candidates lists, candidate matches + shortlist read-only views, revoke link. RN GuardianSetup / GuardianView (RO) / GuardianCandidates against same data (SYNC-11). Guardian-mode onboarding entry (`create_for_other`) already covered in C3 — just link results. **Exit:** full invite→resolve→view→revoke loop on both platforms.

**C14 — Astrologers.** Web listing/detail/bookings + RN marketplace/detail with **unseeded** table: correct empty/stub states (RN STUB_ASTROLOGERS fallback), booking flow UI up to payment gate (Razorpay-gated), my-bookings empty state. Optionally insert ONE test astrologer row via SQL to exercise detail/booking UI end-to-end, delete after. **Exit:** no crashes, honest states, booking flow gated cleanly.

**C15 — Calls.** Web: call buttons hidden (`VITE_AGORA_APP_ID` unset) — verify absent, CallOverlay dormant, no console errors from CallProvider. RN: call screens unreachable/graceful (Agora not in binary). API: agora-token endpoint returns DEV_STUB_TOKEN shape, initiate/accept/decline/end + history status codes sane between A↔B. **Exit:** zero crash paths; API contract verified.

**C16 — Settings/i18n/themes.** Web Settings: every tab (profile prefs, verification tab already C10, privacy, password, sessions, language switcher en/hi/pa — verify translated strings actually swap on Navbar/Login+feature pages, rest expected EN per ledger #10), dark mode class toggle across key pages, elder mode (18.5px base, AA contrast, ≥44px targets, layout unchanged), delete account (full e2e with a throwaway account — DB row gone, cookies cleared). RN Settings: sections, incognito, dark override, elder mode (Chat tab hides 5→4), language live-switch (hi/pa spot screens), delete account. **Exit:** all toggles round-trip + persist correctly per-device.

**C17 — Admin + RN admin.** All 14 web admin pages @1440: dashboard analytics, users list (search/filter/status), user detail (status + subscription changes — vocabulary matches backend enums), create user, verifications queue (already partly C10 — complete the tab states), subscriptions, revenue charts, reports queue (statuses Reviewing/Resolve work — regression-watch), marketing-users (+detail +stats), referral-codes (+toggle), leads, success-stories CRUD (create→publish→appears on public page + RN browse), invoice fetch, push-smoke-test button. Role guard: member hitting `/admin/*` bounced; admin API 403 for non-admin (overlaps C20 — just UI here). RN AdminHome/VerificationQueue/ReportsQueue against same queues. **Exit:** every admin control operates against real rows created earlier in the run.

**C18 — Marketing portal.** Create marketing user via admin; login → `/marketing/*` dashboard/leads/referral-codes; lead status updates; role guard (member + admin roles vs marketing routes per design). Known: portal is blue-themed (deferred restyle — ledger, don't fix). **Exit:** portal functional for marketing role only.

**C19 — Bureau (RN).** Set a test user `role='bureau'` (SQL). BureauHome, ClientRoster, MatchProposal 3-step, Earnings, Support, SuccessStory screens: render, navigate, states (likely stub-data heavy — document what's backend-less as work items rather than bugs if endpoints are missing). **Exit:** stack navigable without crashes; gaps cataloged.

**C20 — API sweep + security.** Walk the checklist's endpoint table (every route in all 17 route files): unauth → 401 (or public 200), wrong-role → 403, malformed → 400 validation, happy path → 2xx shape. IDOR probes: other-user's group, conversation, guardian candidate, notification, invoice, verification. Rate limiters spot-set (auth 5/15m, signup 3/hr, search 30/min, message 60/min, upload 20/hr, payment 10/hr, contact 5/hr) — trigger at least auth + search + contact 429s. Upload hardening: wrong-MIME/magic-byte reject on photo + selfie. Headers (helmet), CORS, httpOnly cookies, no stack traces in error bodies, webhook HMAC fail-closed. Socket security: join-room non-mutual rejected, group join non-member rejected, send-message spoof rejected. **Exit:** endpoint table 100% filled with actual observed codes.

**C21 — Non-functional.** Error-state sweep (stop backend → key pages show error cards with retry, not zeros/blank — Dashboard/Search/Matches/Chat/RN equivalents), RN offline shortlist (MMKV) + OfflineBanner, slow-network sanity (Playwright throttling on Dashboard/Search), web perf snapshot (Lighthouse-ish: LCP on Home/Dashboard, bundle chunk sizes from build output), SEO re-verify (robots, sitemap, canonical, OG on public routes), a11y spot-pass (labels on all forms, focus traps in modals, Esc closes, contrast in dark+elder), monitoring endpoints (`routes/monitoring.js` — inspect + hit), log hygiene (no PII/token in backend logs during a login+chat session). **Exit:** findings logged; anything 🟠+ fixed.

**C22 — Close-out.** Full regression: BE unit suite, FE vitest, mobile tsc, frontend build, Playwright e2e specs (9) against running stack — record counts vs C0 baseline. Delete `qa.deep.*` accounts + any test astrologer row; revert any `.env` toggles; confirm git tree contains only intended changes. Write final report section in the checklist (stats: screens covered, endpoints covered, bugs by severity, fixed vs deferred, work items W-*). Update `CLAUDE.md` Audit History + `docs/QA.md` pointers. Final commit. **Exit:** sign-off gates table (§12) all green or explicitly waived by user.

---

## 11. Execution protocol (per session, Opus)

```text
1. Read CLAUDE.md → this plan §3-§8 → checklist "Run state" → open chunk section.
2. Ensure env up (C0 §4 commands). Re-login fixtures as needed.
3. Walk the chunk's checklist items IN ORDER. Tick as you go ([x] pass, [F] fail→DQ-xxx).
4. On failure: reproduce → evidence → root cause (file:line) → fix if ≤1h → retest → [x]+note.
   Bigger: log W-item, mark [D] deferred, continue.
5. Cross-platform sync items need BOTH clients live — set that up before starting those rows.
6. End: findings log entries, chunk status flip, regression gate if code changed, commit.
```

**Commit message convention:** `qa(deep-run): C<N> <name> — <summary>` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` footer per repo rules. Fixes and checklist updates travel together per chunk.

**Do not:** push to prod, run `/ship`, modify `.env` beyond §4.6 (with revert), send SMS/email to non-owned addresses, bulk-fix across chunks, or "clean up" seed data other chunks depend on.

---

## 12. Regression & sign-off gates

Per-chunk gate (only when code changed): affected test suite + `tsc`/build for the touched workspace.

Final gates (C22):

| Gate | Pass condition |
|---|---|
| Backend unit | all green (baseline ~155/155, plus any tests added by fixes) |
| Frontend vitest | all green (baseline ~48/48) |
| Mobile | `tsc --noEmit` 0 errors |
| Frontend build | `npm run build` green |
| Playwright e2e | 9 specs green against running stack |
| Bugs | 0 open 🔴/🟠 (deferred W-items acknowledged by user) |
| Console/network | 0 non-benign across audited screens |
| Anti-slop | clean on every audited screen |
| Sync | SYNC-1…12 all verified |
| API sweep | endpoint table 100% observed |
| Cleanup | qa.deep.* deleted, .env as-found, docs updated |

---

## 13. Reporting & documentation rules

- **Checklist doc is the single live tracker.** Every session updates it. Never track in a third place.
- Findings Log format (checklist bottom): `DQ-xxx · severity · chunk · platform · title · root cause file:line · status · evidence path`.
- Screenshots to `docs/qa-artifacts/2026-07-08/<chunk>/` (create dir; name `<screen>-<viewport|platform>-<state>.png`). Keep only evidentiary shots (failures + key passes), not every frame.
- Work items `W-*` (too big to fix in-run) get: severity, effort estimate, and a one-paragraph spec in the final report.
- C22 updates CLAUDE.md (Audit History entry + Known Issues deltas) and QA.md (§6 History pointer).

---

## 14. Risks & cautions

1. **Live SMS (MSG91) + live email (Resend)** in dev — OTP bypass for SMS paths; emails only to owned inboxes (`globoniksprod@gmail.com`, `qa.deep.*@tricityshadi.com` which don't receive — accept non-delivery, verify via Resend response/logs when inbox not owned).
2. **Seeded data interdependence** — chunks C6–C9 share the A↔B pair; don't block/delete A or B permanently (unblock after C9; C16's delete-account uses a throwaway, never A/B).
3. **nodemon .env blindness** — any env change needs `touch backend/server.js`.
4. **gorhom bottom-sheet must stay v4** on SDK51 — if a fix touches mobile deps, do not bump reanimated/bottom-sheet.
5. **`mobile/node_modules/react-native` symlink** can vanish after `expo install` — restore if Metro breaks.
6. **Playwright fake camera** for C10: launch with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` (or grant `camera` permission in context) — otherwise LiveSelfieCapture blocks.
7. **fullPage screenshot lies** (CountUp/whileInView) — scroll first.
8. **Session context limits** — the checklist is the resume point; write it before you run out.

---

## 15. Optional appendix — prod smoke (only if user asks after C22)

Read-only + single QA account (`globoniksprod@gmail.com`): login, dashboard, search, own profile, one OTP email receipt, logout — on https://tricityshadi.com. **No admin mutations, no test-data creation, no docker/nginx commands** (shared VPS rules in CLAUDE.md apply in full). Anything found → report only, fix locally, deploy via the documented flow *only on user instruction*.
