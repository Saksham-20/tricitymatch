# EPIC — Competitive Parity & Gap Closure

> Filed: 2026-06-14 · Branch: main · Source: docs/07_Competitive_Benchmark.md
> `gh` unavailable in env → spec archived locally, no GitHub issue. Children below are 1-3 day units.

## Context
Benchmark vs Shaadi.com / Jeevansathi.com found TricityShadi meets/beats core, but with two gap classes: (a) **web is missing whole feature areas the backend + mobile already ship** (astrologers, guardian, calls, standalone verification), and (b) a few **true feature gaps** vs competitors (daily curated matches, recently-viewed, real success stories). This epic closes them.

## Locked decisions (2026-06-14)
- **Web voice/video calls: DEFERRED.** Agora Web SDK integration out of scope this round. Astrologer page ships marketplace + booking only; in-browser call replaced with "continue in mobile app" CTA. Standalone web Calls page deferred.
- **Daily matches: cached daily set per user**, Redis-backed (TTL to next local midnight), scalable. Light gating: free 5/day, premium more.
- **Success stories: admin-created only.** No public submission form. Model + admin CRUD + public web page, replacing the static `stories` array in Home.jsx.
- **Web i18n: scaffold** react-i18next (en/hi/pa) wired into NEW pages only; existing pages stay English (tracked separately).

## Child issues

| # | Title | Priority | Effort (CC) | Deps |
|---|---|---|---|---|
| C1 | Web: standalone Verification page | High | ~20m | — |
| C2 | Web: Guardian/Family page | High | ~40m | — |
| C3 | Web: Astrologer marketplace + booking (no call) | High | ~50m | — |
| C4 | Recently viewed (backend + web/mobile) | High | ~30m | — |
| C5 | Daily matches (backend cache + web/mobile) | High | ~50m | — |
| C6 | Success stories (model + admin CRUD + public page) | Med | ~50m | — |
| C7 | Web i18n scaffold (react-i18next en/hi/pa) | Med | ~30m | before C1-C3 ideally |

Dependency graph:
```
C7 i18n scaffold ──> (C1, C2, C3 use it for new strings)
C4 recently-viewed ─┐
C5 daily-matches ───┴─ both touch match/profile area (independent, parallel-safe)
C6 success stories ── independent
```

---

## C1 — Web: standalone Verification page
**Current:** Verification only reachable inside onboarding step 14. Backend `verificationRoutes.js` exposes GET `/status`, POST `/submit`, POST `/selfie`, POST `/bg-check/initiate|verify-payment|status`. No web route after onboarding.
**Change:** Add ProtectedRoute `/verification` → `pages/Verification.jsx`. Surface: current tier/status (GET status), document submit (reuse onboarding VerificationStep component), selfie capture, bg-check initiate+pay+status. Link from Settings + profile completeness strip.
**Files:** `frontend/src/pages/Verification.jsx` (new), `frontend/src/App.jsx` (+route), `frontend/src/api/verificationApi.js` (new thin wrapper), link in `pages/Settings.jsx`.
**Acceptance:**
1. Authenticated user visits `/verification`, sees live status from GET `/verification/status`.
2. Can submit docs + selfie; bg-check initiate→pay→status works end-to-end against existing backend.
3. Reachable from Settings and completeness strip.

## C2 — Web: Guardian/Family page
**Current:** `guardianRoutes.js` live: GET `/my-guardians`, POST `/invite`, DEL `/:linkId`, GET `/my-candidates`, GET `/candidate/:id/matches|shortlisted`, POST `/resolve-invite/:token`. Mobile has GuardianSetup/View/Candidates. No web page.
**Change:** ProtectedRoute `/guardian` → `pages/Guardian.jsx` with tabs: My Guardians (invite by email, list, revoke), My Candidates (read-only view of candidate matches/shortlist). Resolve-invite handled by a `/guardian/invite/:token` route.
**Files:** `frontend/src/pages/Guardian.jsx` (new), `frontend/src/api/guardianApi.js` (new), `App.jsx` (+2 routes), nav link in Settings/Dashboard.
**Acceptance:**
1. User invites a guardian by email → POST `/invite` → invite created + notified.
2. Guardian opens invite link → POST `/resolve-invite/:token` → linked.
3. Guardian sees candidate's matches/shortlist read-only; cannot act on candidate's behalf.
4. Revoke link works (DEL `/:linkId`).

## C3 — Web: Astrologer marketplace + booking (call deferred)
**Current:** `astrologerRoutes.js` live: GET `/`, GET `/:id`, GET `/my-bookings`, POST `/book`, POST `/book/:id/verify-payment|start-call|end-call`. No web page.
**Change:** ProtectedRoute `/astrologers` (list + filters), `/astrologers/:id` (detail + book), booking flow with Razorpay verify. **Skip start-call/end-call on web** — after a confirmed booking show "Join your call in the TricityShadi mobile app." Add `/astrologers/bookings` (my bookings).
**Files:** `frontend/src/pages/Astrologers.jsx`, `AstrologerDetail.jsx`, `MyBookings.jsx` (new), `frontend/src/api/astrologerApi.js` (new), `App.jsx` (+3 routes), nav entry.
**Acceptance:**
1. `/astrologers` lists astrologers from GET `/`.
2. Detail page books via POST `/book` → Razorpay → verify-payment marks booking paid.
3. Confirmed booking shows app-handoff CTA, NOT an in-browser call.
4. `/astrologers/bookings` lists my bookings.
**Out of scope:** in-browser Agora call (deferred with web calls).

## C4 — Recently viewed
**Current:** `ProfileView` model `{viewerId, viewedUserId, createdAt}` already records views (profileController getProfile:463). GET `/profile/me/viewers` returns who viewed ME (premium). No reverse ("profiles I viewed").
**Change:** Add GET `/profile/me/recently-viewed` → distinct `viewedUserId` where `viewerId = me`, newest first, paginated, hydrated to ProfileSummary (same shape as viewers). Available to all tiers (own activity). Web: section on Dashboard + `/search` empty-state. Mobile: HomeScreen strip.
**Files:** `backend/controllers/profileController.js` (+`getRecentlyViewed`), `backend/routes/profileRoutes.js` (+route), `frontend/src/pages/Dashboard.jsx` (+section), `mobile/src/features/home/*` (+strip), api wrappers.
**Schema:** none new (reuse ProfileView). Add index `(viewerId, createdAt)` migration for scale.
**Acceptance:**
1. GET `/profile/me/recently-viewed` returns distinct profiles I viewed, newest first, paginated.
2. Excludes self, blocked, deleted users.
3. Web Dashboard + mobile Home show the strip; tapping opens profile.
4. New migration adds `(viewerId, createdAt)` index.

## C5 — Daily matches ("matches of the day")
**Current:** only on-demand `search/suggestions` (compatibility-ranked). No daily, no persistence.
**Change:** GET `/match/daily` → top-N compatible un-interacted opposite-gender profiles, **computed once per user per local day and cached in Redis** (`daily-matches:{userId}:{YYYY-MM-DD}`, TTL = seconds to next midnight IST). On cache miss, compute via existing compatibility ranking (reuse `getSuggestions` core), store, return. Gating: free `count=5`, premium/vip `count=15`. Scalable: pure Redis, no new table; compute is the existing query capped + ordered by compatibility, excluding already-liked/passed/blocked.
**Files:** `backend/controllers/matchController.js` (+`getDailyMatches`, factor shared ranking out of searchController.getSuggestions into a util), `backend/routes/matchRoutes.js` (+`GET /daily`), `backend/utils/dailyMatches.js` (cache helper using existing `utils/cache`), `frontend/src/pages/Dashboard.jsx` (+"Today's Matches" card row), `mobile/src/features/home/*`.
**Acceptance:**
1. GET `/match/daily` returns same set for a user across repeated calls within one IST day (cache hit).
2. Set refreshes after IST midnight.
3. Free users get 5, premium/vip get 15.
4. Excludes liked/passed/blocked/self; ranked by compatibility desc.
5. Cache miss path recomputes and repopulates; Redis-down falls back to live compute (in-mem cache fallback per `utils/cache`).

## C6 — Success stories
**Current:** `Home.jsx` has a hardcoded `stories` array (3 entries, lines 407-410). No model, no admin, no public page.
**Change:**
- **Model** `SuccessStory` `{id, coupleNames, location, marriedOn (date), quote, photoUrl, tag, status enum('draft','published') default 'draft', displayOrder int, createdAt, updatedAt}` + migration `000034`.
- **Admin CRUD** under `/admin`: GET `/admin/success-stories`, POST (create w/ Cloudinary photo upload), PUT `/:id` (edit/publish), DEL `/:id`. Admin web page `/admin/success-stories`.
- **Public** GET `/api/v1/success-stories?status=published` (no auth) → ordered by displayOrder. New public page `/success-stories` + Home.jsx carousel reads from API (falls back to nothing if empty), replacing the static array.
**Files:** `backend/models/SuccessStory.js`, `backend/migrations/000034-create-success-stories.js`, `backend/controllers/adminController.js` (+CRUD), `backend/routes/adminRoutes.js` + new public route in `routes/index.js`, `frontend/src/pages/SuccessStories.jsx` (public), `frontend/src/pages/admin/SuccessStories.jsx` (admin), `frontend/src/pages/Home.jsx` (fetch instead of static), api wrappers, `App.jsx` (+2 routes).
**Acceptance:**
1. Admin creates a story w/ photo → status draft → publish → appears on `/success-stories` and Home carousel.
2. Public endpoint returns only published, ordered by displayOrder.
3. Home.jsx static array removed; gracefully renders nothing if API empty.
4. Migration `000034` runs clean; admin-only write routes enforce adminAuth.

## C7 — Web i18n scaffold
**Current:** mobile has i18n en/hi/pa; web is English-only, no i18n lib.
**Change:** Add `react-i18next` + `i18next`, `frontend/src/i18n/` with `en/hi/pa` JSON, `<I18nextProvider>` in `main.jsx`, language switcher in Settings + header. Wire NEW pages (C1-C3, C6 public) via `useTranslation`. Existing pages untouched (separate issue).
**Files:** `frontend/src/i18n/index.js` + `locales/{en,hi,pa}.json`, `frontend/src/main.jsx`, language switcher component, new pages use `t()`.
**Acceptance:**
1. Switching language in Settings changes new-page strings to hi/pa.
2. Choice persists (localStorage), survives reload.
3. Existing pages unaffected (no regression).
**Out of scope:** translating existing pages (Home/Search/Chat/etc.) — tracked separately.

---

## Global acceptance / testing
- All new web routes behind correct guards (ProtectedRoute / AdminProtectedRoute).
- `npm run lint` + `npm run build` clean; `npm run test` green.
- Backend: unit test for `getRecentlyViewed`, `getDailyMatches` cache hit/miss, success-story publish filter.
- No regression to existing onboarding verification, search suggestions, Home render.

## Rollback
Each child is an isolated PR. Revert PR to undo. C6 migration `000034` reversible via `migrate:undo`. C5 is cache-only (no schema). C4 index migration reversible.

## Deferred (separate scope)
- Web voice/video calls (Agora Web SDK) + astrologer in-browser call.
- Full web i18n of existing pages.
- Kundli PDF generation, settlement guarantee, relationship-manager web surface.

---

# ADDENDUM — Round 2 (2026-06-14): final buildable-gap closure

After R1 (C1–C7) shipped, a re-benchmark vs Shaadi/Jeevansathi left three buildable gaps. R2 closes them; everything else is intentionally deferred/business (see `docs/07` resolution log).

## C8 — Search by profile ID
**Current (pre-R2):** no way to find a specific profile shared offline; competitors expose a profile ID + search.
**Change:** deterministic public code `TCS-XXXXXXXX` derived from the user's UUID first segment (no DB column/migration — `backend/utils/profileCode.js`). New `GET /search/by-code?code=` resolves the code to a single profile (block-aware). Web: "Search by ID" input on `/search` → navigates to profile; shareable, copyable code chip on own-profile (`MyProfileView`).
**Files:** `backend/utils/profileCode.js`, `backend/controllers/searchController.js` (+`getProfileByCode`), `backend/routes/searchRoutes.js` (+`/by-code`), `frontend/src/utils/profileCode.js`, `frontend/src/pages/Search.jsx`, `frontend/src/pages/MyProfileView.jsx`.
**Acceptance:** valid code → that profile; invalid/blocked → 404/400; own code is copyable. Unit test `profileCode.test.js`.

## C9 — Video intro
**Current (pre-R2):** voice-intro exists (backend+mobile); no video intro; competitors offer video profiles.
**Change:** `videoIntroUrl` column (migration **000037**), Cloudinary `resource_type:'video'` upload (`uploadVideoIntro`, MP4/MOV/WebM ≤25MB), `POST`/`DELETE /profile/video-intro`. Web: `VideoIntroManager` component on own profile (upload/replace/remove) + read-only `<video>` playback on `ProfileDetail`.
**Files:** `backend/migrations/20240101000037-add-video-intro-url.js`, `backend/models/Profile.js`, `backend/middlewares/upload.js`, `backend/controllers/profileController.js`, `backend/routes/profileRoutes.js`, `frontend/src/components/profile/VideoIntroManager.jsx`, `MyProfileView.jsx`, `ProfileDetail.jsx`.
**Acceptance:** upload/replace/remove round-trips; playback on others' profiles; size/type rejected client+server. Migration reversible.

## C10 — Numerology
**Current (pre-R2):** Ashtakoot guna-milan only; competitors include numerology.
**Change:** `backend/utils/numerology.js` — life-path number from DOB (master numbers preserved) + pairwise compatibility. Added as a `numerology` block on the shared `GET /profile/:id/horoscope-match` response (mobile HoroscopeMatch already calls it). Web: numerology card on `ProfileDetail` astro section (best-effort fetch).
**Files:** `backend/utils/numerology.js`, `backend/controllers/profileController.js` (horoscope-match), `frontend/src/pages/ProfileDetail.jsx`.
**Acceptance:** two DOBs → both life paths + score/label/note; missing DOB → null (no crash). Unit test `numerology.test.js`.

## R2 deferred (intentional)
- **SMS match alerts — WONT-DO.** FCM push + email already deliver match alerts; per-event SMS is recurring cost for marginal lift. OTP SMS unchanged.
- Kundli PDF, full web i18n, web calls, settlement guarantee, RM web surface — unchanged from R1 deferral.
