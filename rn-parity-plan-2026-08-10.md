# RN Apps — Store-Launch + Parity Plan (2026-08-10)

Planning on Fable (CEO + design + eng voices). Implementation on Opus.
Codex unavailable this pass (usage limit until Sep 8) → **`[subagent-only]`** on all three phases.

**Goal.** Get the iOS + Android member apps doing everything the website does, on the same
data, at the same quality bar — and actually submittable, because parity on a binary
nobody can install is inventory, not product.

**Owner decisions locked (2026-08-10):**
1. **Vehicle: `mobile/launch-prep`.** Merge main into it; all RN work happens there.
2. **Sequence: store blockers before parity**, then craft.
3. **No server-side onboarding draft.** Deep links + cache sync only.
4. **Dark mode: light-lock now** (`darkModeOverride=false` default), retrofit in RN-G.
   Ship to store review on the theme that actually works.
5. **Onboarding: converge RN to the web 2-step flow** (combined account+OTP,
   create-after-verify). One funnel, one set of copy, one set of bugs.

---

## Ground truth — measured, not assumed

Measured on `main` unless stated. **Re-measure after RN-A**; `mobile/launch-prep` is 41
commits behind main and 7 ahead.

### Blocking / structural

| # | Finding | Evidence |
|---|---------|----------|
| **G0** | **`mobile/launch-prep` has never compiled.** Its "Expo SDK 51→52" commit `a42cfcf` changed **zero** files under `mobile/android/` or `mobile/ios/`. `Podfile.lock` still pins `React-Core (= 0.74.5)` while `package.json` declares `react-native 0.76.9`. `react-native-iap` and `react-native-razorpay` were added there with no native linking — both require it. The locked vehicle is a paper upgrade. | `git diff --name-only 86c78b7f..mobile/launch-prep \| grep -cE '^mobile/(android\|ios)'` → **0** |
| **G10** | **targetSdk 35 blocker is OPEN and believed closed.** Commit `a42cfcf` subject claims it "Clears the Google Play targetSdk-35 launch blocker"; `mobile/android/build.gradle:8` still reads `targetSdkVersion … ?: '34'`, no `gradle.properties` override. Native folders are committed (bare workflow), so nothing regenerates silently. Play rejects new apps below 35. | build.gradle:7-8 |
| **G13** | **launch-prep predates the 2026-07-29 rebrand.** 10+ hardcoded `tricityshadi.com` refs in files that are *new on that branch*, so main's rename never touched them and the merge won't either: iOS payment redirect `https://tricityshadi.com/subscription`, Signup Terms/Privacy links, `PrivacyScreen`/`TermsScreen` including the statutory **`grievance@tricityshadi.com`**, `ContactScreen`, `SupportScreen`. These are the screens that exist to satisfy store review. | `git grep tricityshadi.com mobile/launch-prep -- mobile/src` |
| **G14** | **`shared/src/constants/routes.ts` is a loaded gun.** Exported from `shared/src/index.ts`, **0 consumers**, and encodes the pre-2026-06-20 wrong contract — `/auth/refresh-token` (real: `/auth/refresh`), `/auth/device-token` (removed), `/search/saved` (never existed), `/verification/me` (real: `/status`), `/stories` (real: `/success-stories`), plus wrong match/chat/photo paths. Anyone "adopting shared route constants" as the structural fix reinstalls every historical bug at once. | routes.ts:6,12,23,59,72 |
| **G1** | **mobile `tsc` RED.** `founding_premium` missing from two `Record<SubscriptionPlanType,…>` maps. | `SubscriptionScreen.tsx:63,72` |
| **G8** | **`mobile` is outside every gate.** Root declares workspaces `[backend, frontend, mobile, shared]`, but `npm run lint` = backend+frontend+slop-lint and `npm run test` = backend+frontend. `lint-staged` globs cover only `backend/**`, `frontend/**`. This is *why* G1 rotted — no check anyone runs could fail. | root `package.json` |
| **G2** | **Zero working RN tests.** `mobile/__tests__/App.js` only; `npx jest` → `TypeError: this._moduleMocker.clearMocksOnScope is not a function`. Root hoists jest **30.4.2**; `mobile` declares no jest, and its `jest-expo` preset needs jest 29. | measured |

### Correctness

| # | Finding | Evidence |
|---|---------|----------|
| **G3** | **Chat entitlement diverges from server.** RN gates on `useAuthStore(selectPlan) !== 'free'`; web derives from `user.features.freeChatForMutuals`. Flag ON → web free user chats, same account blocked in app. | `ConversationsScreen.tsx:91`, `MatchesScreen.tsx:151` |
| **G7** | `AuthUser` has no `features` — the server's flag block is dropped on the floor. | `shared/src/types/user.ts` |
| **G6** | RN verification posts documentType + doc files → **400**. Backend selfie-only since 2026-07-02; web live-camera-only since 2026-07-07. | — |
| **G15** | **Offline = forced logout.** `client.ts` refresh `catch` calls `logout()` for *any* failure including plain network error. Open the app in a lift, get signed out. | `mobile/src/api/client.ts:91-95` |
| **G16** | **ProfileDetail's trust row is dead code.** `<VerificationRow />` is called with **no props**; the component returns `null` unless `phoneVerified`. The one trust signal on the decisive screen of a trust product never renders. Its `BADGES` array still models the govt-ID/education/income tiers **removed from the product**. | `ProfileDetailScreen.tsx:122,432` |
| **G17** | **Search reports network failure as "No profiles found."** No `isError` branch anywhere in the file. On a thin-supply launch this is the difference between "app broke" and "nobody here" — and it tells the wrong one. | `SearchScreen.tsx:316,333` |
| **G18** | **Photo galleries hardcode width 375 in 4 places.** Letterboxes and desyncs paging dots on any device that isn't a 375pt iPhone — i.e. most of them. | `ProfileDetailScreen.tsx:398,643`; `OwnProfileScreen.tsx:522,796` |
| **G5** | Invite + founding surfaces absent (backend `/invite/my-link`, `/invite/:token` live; web has `InviteLink`, `FoundingBadge`, `useFoundingWindow`). | — |
| **G9** | api holes: `/invite/*`, `/search/by-code`, `/search/suggestions`, `/auth/change-password`, `/auth/sessions`, `/subscription/my-subscription`, `/subscription/invoice/:id`, `/contact`, `horoscope-match/pdf`. | — |
| **G4′** | Deep links: **JS half already exists** (`RootNavigator.tsx:17` linking map, prefixes incl. both domains). Missing is the **native** half — no `scheme`, no `ios.associatedDomains`, no `android.intentFilters` in `app.json`, and no AASA/assetlinks served. *(Original G4 overstated this.)* | app.json |
| **G19** | Push tap is a no-op — notification taps route nowhere. | `useNotificationHandler.ts:66-71` |

### Quality

| # | Finding | Evidence |
|---|---------|----------|
| **G11** | **Tokens exist, discipline does not.** `shared/src/constants/theme.ts` ships a named type scale, `spacing` (4/8/12/16/20/24/32/40/48 + gutter 18), e1–e4 shadow ramps light+dark; `motion.ts` ships `duration.fast 120 / base 240 / slow 360`, `easing.std [0.2,0,0,1]`, `spring.pop {380,18}` / `spring.sheet {240,28}`, haptics. Across 88 `.tsx`: 72 import `spacing.*` but **219 raw padding/margin literals** remain; **9/88** import motion helpers; **4** screens use `Skeleton`, **4** use `EmptyState`; **`PressableScale` 0 uses** against **589** `TouchableOpacity`; **`tapTarget` token 0 uses**; elder mode has **2** consumers app-wide. | measured |
| **G20** | **Dark mode is systemically broken and default-on.** `useTheme` falls back to the system scheme, so any phone set to dark hits it at first launch — including App Store reviewers. 84/88 files reference `colours.*`, largely baked into module-scope `StyleSheet.create`, which evaluates once at import and **cannot** respond to theme. Confirmed illegible: `EmptyState.tsx` (near-black `fgStrong` title + light-pink icon circle on a dark ground — and it is the shared primitive behind all four "done" screens), `SubscriptionScreen` chrome, both Search sheets, `SectionHeader`. `darkColours.goldText #3D2914` on `goldSoft #221C0D` is brown-on-black at the token level. | `useTheme.ts`, `EmptyState.tsx:55-80` |
| **G12** | No crash reporting, no OTA. Nothing Sentry-shaped; `expo-updates` installed but unconfigured, no `runtimeVersion`, no `updates` block. A field crash is invisible; any JS fix needs a full review cycle. | app.json |
| **G21** | `mobile/AGENTS.md` instructs every agent to read **Expo SDK 41** docs — three years stale. Actively poisons anyone working this plan. | AGENTS.md |

### Already sound — do not rebuild
- **Multi-device sessions.** `RefreshToken` scopes each login to its own `family`; rotation preserves it, reuse-detection revokes only that family (`authController.js:411`). A phone login does not evict the desktop. Password reset revokes all — correct exception.
- **One backend, one database.** Profile, matches, chat and subscription data are *already* shared across devices. The gap is presentation freshness and link routing, not storage.
- **Invite tokens.** `inviteController.js:33` shape-checks `[0-9a-f]{16,128}`, returns `firstName` only, uniform 404s, rate-limited.
- **Server entitlements.** `backend/utils/entitlements.js` fails closed on DB error. Server stays the enforcer; the RN helper is display-gating only.

---

## Workflow inventory (web route → RN screen)

✱ = already built on `mobile/launch-prep`, lands at RN-A.

| Web workflow | RN screen | Status |
|---|---|---|
| `/login`, `/forgot-password`, `/reset-password` | Login, ForgotPassword, ResetPassword | present |
| `/signup` + `/onboarding` | Signup + Onboarding (14 step) | **divergent** — web is a 2-step combined account+OTP page. Decision forced in RN-B. |
| `/dashboard` | Home | present |
| `/search` | Search | present; **no error state (G17)**; no by-code, no suggestions |
| `/matches` | Matches | present; tab set differs |
| `/chat` | Chat, ChatThread, FamilyGroups | present; **wrong entitlement gate (G3)**; dead call buttons (Agora out of scope, web hides them, RN doesn't) |
| `/profile`, `/profile/edit`, `/profile/:id` | Profile, EditProfile, ProfileDetail | present; **dead trust row (G16)**, **375pt galleries (G18)** |
| `/subscription` | Subscription | present; no founding tier; ✱unlock-bundle UI on LP; success is an `Alert.alert`, not a receipt |
| `/payment/success`, `/failed`, `/history` | — | **MISSING** |
| `/notifications` | Notifications | present; **taps go nowhere (G19)** |
| `/settings` | Settings | present; no change-password, no active-sessions |
| `/verification` | Verification, SelfieVerification | **BROKEN (G6)** |
| `/guardian` | GuardianSetup/View/Candidates | present |
| `/astrologers`, `/:id`, `/bookings` | Marketplace, Detail | bookings missing; stub data |
| `/success-stories` | SuccessStoriesBrowse, SuccessStory | present |
| `/terms`, `/privacy`, `/safety`, `/about`, `/contact` | ✱ built on LP (`5157ebe`) | store requirement — **but wrong domain (G13)** |
| invite / founding | — | **MISSING (G5)** |
| `/matrimony/:city` | — | N/A (SEO); **must be excluded from AASA** |

---

---

## EXECUTION STATUS — 2026-08-10

Branch `mobile/launch-prep`. Commits `885129d` (plan) → `aa6f3fb` (merge) → `661ecfd` (gate + harness).
**Nothing pushed. Nothing deployed.** Web production is untouched by this branch.

**RN-A DONE:**
- Merge landed. 4 conflicts resolved; lockfile regenerated rather than trusted.
- Gates green: backend **247/247** · frontend **97/97** · mobile **4/4** · mobile `tsc` **0** ·
  root `lint` 0 · slop-lint clean (294 files) · frontend build OK.
- `mobile` is inside root `lint` + `test` + `lint-staged` (G8 closed, **probe-verified**:
  clean tree exits 0, adding a tier to the shared enum exits 1 with the same TS2741 that
  shipped unnoticed on main).
- Jest harness works (G2 closed) — jest 29 nested under `mobile`, native modules mocked.
- G1 closed, G13 closed, G14 partially (legacy prefixes dropped), G21 closed.
- Two bugs found and fixed that predate this plan: `isPlanAtLeast` ranked a founding
  member **below free**, and the Play-products test would have let a granted tier be sold.
- Root `npm test` had been failing at its first leg on backend's coverage threshold
  (60% configured vs 19.32% actual), so frontend and mobile legs never ran — the new gate
  would have been dead on arrival. Correctness and coverage are now separate commands.

**RN-A EXIT GATE MET — the app builds and boots on both platforms.**
- **iOS:** Build Succeeded, 0 errors, launches on an iPhone 17 Pro simulator to the
  Welcome screen. G0 closed — `Podfile.lock` now pins React-Core 0.76.9.
- **Android:** BUILD SUCCESSFUL, installs, `MainActivity` reaches `topResumedActivity`,
  Welcome renders with the light status bar, logcat clean of FATAL/AndroidRuntime.
- **G10 closed:** generated `gradle.properties` carries `android.targetSdkVersion=35`.
  Caveat: the emulator is API 34, so targetSdk-35 *runtime* behaviour (edge-to-edge,
  permission changes) is asserted by config but not yet exercised → RN-B.
- Native config is now **declarative** (`app.json` + `expo-build-properties` + a local
  `withIapStoreFlavor` plugin), so `prebuild --clean` no longer destroys it. Two
  third-party toolchain gaps are patched self-healingly: fmt's consteval failure under
  Xcode 26 (Podfile `post_install`) and expo-localization's non-exhaustive switch against
  the iOS 26 SDK (`scripts/patch-native-modules.cjs`, postinstall).
- **G14 closed** — stale `routes.ts` deleted.

**RN-A COMPLETE.** The remainders are done:
- **API contract harness.** `backend/tests/unit/routeManifest.test.js` walks the live
  Express router → `shared/src/constants/api-manifest.json` (137 routes);
  `mobile/src/api/apiConformance.test.ts` asserts every client call site against it.
  Probe-verified: reintroducing the historical `/match/matches` fails with the file and
  path named. **Found three real bugs on first run** — a `POST /profile/:id/view` that
  never existed and 404'd behind a `.catch()` on every profile open; `eas.json` missing
  `/api/v1` on all three build profiles (EAS env overrides `.env`, so **every EAS binary
  including a store submission would 404 on every request**); and `api/bureau.ts` calling
  four endpoints with no backend at all.
- **The `as unknown as` casts were hiding missing required fields**, not style. Four in
  the api layer bridged partial shapes to `ProfileSummary`/`Message` — `photos`, `city`,
  `height`, `completionPercentage` genuinely arrive undefined, so `profile.photos.map()`
  throws. Replaced with an explicit `toProfileSummary`. Removing them immediately
  surfaced a real hidden type error: the API returns `gender` as a plain string against
  a `Gender` union.
- **Mobile eslint** wired into the root gate, pinned to the eslint 8 line, banning the
  `unknown` double-cast in `src/api`. `no-unused-vars` is WARN with a recorded count —
  **62 unused bindings across 32 files** (19 dead imports, 43 dead locals). That number
  is the contract and should only go down; RN-G flips the rule to error.

Gates now: root lint 0 (backend + frontend + **mobile eslint + mobile typecheck** +
slop-lint) · root test 0 — backend **250** · frontend **97** · mobile **9**.

Still to smoke on a device: the changed mappers (Matches / Chat / Profile rows). The
edits are JS-only and typecheck clean, but they have not been seen rendering.

**Toolchain requirements discovered (write these down, they cost an hour):**
- Gradle and `sdkmanager` need JDK 17+; the only JVM on PATH here is Java 8. Use
  `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.
- `platforms;android-35` had to be installed — only 34 and 36.1 were present.
- CocoaPods needs `LANG=LC_ALL=en_US.UTF-8` (already in the repo notes).

**RN-C IN PROGRESS** — commits `b92ec6e`, `d4e84a1`, `1f30565`, `3d10f3c`. Still unpushed.

Done:
- **G3/G7 entitlements**, **G15** offline logout, **G16** dead trust row, **G17** Search
  error state, **G18** 375pt galleries (`b92ec6e`).
- **G6 verification** — the app advertised four tiers and a Video Verified Badge against a
  server that has one selfie review. Converged on the web flow; deleted the liveness screen
  and the `POST /verification/selfie` route behind it, which was mounted with no upload
  middleware and could only ever answer 400. Rejection reasons (`adminNotes`) now surface —
  they were being dropped, so a rejected member resubmitted the same photo.
- **G9 (part)** — account security: change password + signed-in devices. Required a server
  fix: session identity was cookie-only, so on native nothing was marked "this device" and
  `change-password` revoked *every* session including the caller's. Access tokens now carry
  an optional `sid` claim; when the current session can't be resolved, change-password
  revokes nothing rather than everything.
- **G9 (part)** — profile-ID search both ways: lookup surfaced inside the existing search
  box when the text parses as a code, and the member's own code on OwnProfile with the
  native share sheet.
- Three password rules across Signup/Reset/new screen collapsed into one that mirrors the
  server's *actual* regex (they all accepted symbols the server rejects), pinned by a test
  that reads the server's pattern out of `authRoutes.js`. Same technique pins
  `profileCode` against the backend module.

Gates now: root lint 0 · backend **259** · frontend **97** · mobile **57** · mobile `tsc` 0.

Still open in RN-C: invite/founding surfaces (G5), payment result/history + my-subscription
+ invoices (waiting on the iOS payment ruling), ProfileDetail hierarchy, RN-C0 rails, and
device smoke for everything since RN-A — the camera capture and the share sheet in
particular are hardware paths no simulator run has exercised.

---

## Phases

### RN-A — Reconcile the vehicle and make it real

**Merge procedure** (measured: `git merge-tree` reports exactly **4** content conflicts —
`backend/constants/plans.js`, `backend/controllers/subscriptionController.js`,
`frontend/src/pages/Subscription.jsx`, `mobile/app.json`):

```
0  git branch backup/launch-prep-pre-merge mobile/launch-prep        # rollback point
1  git checkout mobile/launch-prep && git merge --no-commit --no-ff main
2  Resolve the 4:
   - plans.js + subscriptionController.js: keep BOTH main's founding/supersede AND
     LP's IAP/web-redirect. The LP payment leg predates the supersede rule — verify it
     supersedes. Backend payment tests green before continuing.
   - Subscription.jsx: main is newer pricing UI; port LP deltas onto it.
   - app.json: union; keep LP plugins + BILLING; DROP READ/WRITE_EXTERNAL_STORAGE
     (dead since sdk33, Play flags WRITE_).
3  git checkout mobile/launch-prep -- package-lock.json   # DISCARD the textual auto-merge
4  npm install                                            # regenerate; inspect the diff
5  git commit
6  cd mobile && npx expo prebuild --clean
   diff regenerated native against backup branch's native; re-apply manual edits
   (AppStatusBar native theme, google-services, proguard); commit the regenerated folders
7  LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install (ios/)
8  Debug build BOOTS on iOS sim + Android 15 emulator
```

**Why step 3 matters:** both sides changed `package-lock.json` since merge-base yet git
reports no conflict — it will textually splice two machine-generated dependency graphs.
An auto-merged npm lockfile is corrupt by construction.

**The merge also changes the web app.** LP bumped root `overrides` react 18.2.0→18.3.1 and
`@gorhom/bottom-sheet` ^4.6.4→^5.1.6. Auto-merge keeps LP's values, so **frontend starts
running React 18.3.1**. Post-merge frontend tests + build + a live-site smoke are
mandatory, and the SDK-51 hoisting hack must be re-justified or removed.

Then, in RN-A:
- **Fix the gate (G8):** `mobile` scripts `typecheck` / `lint` / `test`; root `lint` and
  `test` gain the mobile workspace **unconditionally**; `lint-staged` gains
  `mobile/**/*.{ts,tsx}` and — the actual failure vector — a `shared/**/*.ts` hook that
  runs the mobile typecheck. Conditional gates are how this broke.
- **Jest harness (G2):** pin `jest ~29.7.0` + `react-test-renderer` (exact react match) +
  `@testing-library/react-native` inside `mobile/`, so npm nests it under
  `mobile/node_modules` and backend keeps 30 at root. Run from `mobile/`, never root.
- **Regenerate or delete `routes.ts` (G14)** before anyone reaches for it.
- **Kill the stale brand (G13)** across LP's new screens.
- **Fix `AGENTS.md` (G21).**
- **API contract harness** (moved up from RN-F — it is small and everything downstream
  depends on it): backend route-manifest snapshot → regenerates `routes.ts` → mobile
  conformance test asserting every `api/*.ts` function's method + path against it. Plus
  zod envelope parsing (`zod` is already a mobile dependency and **unused** in the api
  layer). Unit tests with mocked axios cannot catch wrong paths — *the mock is the thing
  that's wrong*.
- `tsc` 0 (G1).

**Gate: a debug build BOOTS on both platforms.** Not "Metro bundles" — Metro proves
nothing about a bare-workflow app whose native shell is for a different RN major.

### RN-B — Store blockers and the decisions that shape RN-C
**STATUS: the verifiable half is DONE** (commits 6c36d9b, a4d7ebd, 33ebf85). Posture
written up in `docs/STORE_READINESS_2026-08-10.md`. Closed: targetSdk 35 verified in the
installed artifact · edge-to-edge verified on a real API 35 emulator for Welcome + Login ·
Apple 4.8 confirmed not to apply · dead UI (Google button, call buttons) hidden behind
working config gates · dark mode light-locked · Sentry wired and dark · OTA
`runtimeVersion: fingerprint` + channels. Still open and owner-blocked: the iOS payment
ruling, the Play Console account type, the Sentry DSN, Razorpay live keys. Still open in
code: edge-to-edge on the authed screens.

- **targetSdk 35 (G10)** — properly in the committed `android/build.gradle`, verified on an
  Android 15 emulator (edge-to-edge + permission changes are what break apps).
- **iOS payment ruling.** Does LP's web-redirect survive App Store review under 3.1.1, or
  is IAP required? **If IAP: this is plausibly the largest single item in the plan** — App
  Store Connect products for a 5-tier ladder incl. founding pricing, `react-native-iap`
  server-side receipt validation, a `Subscription` writer for a non-Razorpay source,
  restore-purchases, Apple-mandated management links. Not a memo.
- **Play Console account type** — a personal developer account created after Nov 2023
  needs a closed test with **12 testers for 14 consecutive days** before production
  access. Calendar blocker; the clock starts the day RN-B yields an installable build.
- **Apple 4.8** (Sign in with Apple, given Google sign-in) + data-safety declarations.
- **Dark-mode call (G20):** light-lock (`darkModeOverride=false`, one line) until the
  retrofit lands, or fix before review. Reviewers commonly run dark.
- **Onboarding convergence call:** keep RN 14-step, converge to web's 2-step, or a minimal
  OTP-first port. Forced here, not discovered mid-RN-C.
- **Sentry install lands here**, not RN-E — RN-B already forces a native rebuild, so it is
  free now, and every QA build from that day reports crashes instead of someone watching
  logcat.

### RN-C — Launch-critical parity (with rails first)

**RN-C0, the rails (2–3 days, before any new screen):** themed-style factory so styles can
respond to theme; a `Screen`/`DataView` scaffold with the four states baked in;
`PressableScale` inside `Button`; one sheet component (gorhom, `spring.sheet`,
drag-to-dismiss) replacing today's three idioms; eslint rules banning `colours.*` inside
`StyleSheet.create`, banning `as unknown as` casts in `api/`, and banning ad-hoc
`fontSize`. RN-C then builds ~10 new screens **born correct** instead of being retrofitted.

Then:
- **Entitlements (G3, G7):** `features` on shared `AuthUser` → `authStore` → one client
  helper mirroring `backend/utils/entitlements.js`. `/auth/me` is the source of truth
  **plus** re-check on 403. Cached `features` is a hint with a TTL, never a grant.
- **Verification (G6):** selfie-only, live camera, matching the web contract.
- **Correctness fixes misfiled as polish:** G16 dead trust row + stale badge tiers, G17
  Search error state, G18 the 375pt galleries, G15 offline-logout, dead Agora call buttons.
- **New api modules + screens (G9):** invite, search-by-code/suggestions, change-password,
  sessions, my-subscription, invoices, contact, payment result/history, founding surfaces.
  Each lands **with its conformance + envelope test in the same commit.**
- **ProfileDetail hierarchy:** details up, Community/Family/Horoscope not collapsed behind
  accordions. Parents evaluating a rishta want religion, caste, family and manglik before
  the bio. Today it is a Tinder-shaped page selling a Shaadi-shaped product.
- Every remaining inventory row: build it, or write down why not.

### RN-D — Cross-device continuity
Native half only (the JS linking map exists): `scheme`, `ios.associatedDomains`,
`android.intentFilters`, plus `apple-app-site-association` and `assetlinks.json` from
nginx — `location` above the SPA catch-all, correct content-type, **no redirect** (Apple's
CDN won't follow the legacy 301), `nginx -t` before reload on a box hosting six other
production sites.

- **AASA path exclusions:** `/payment/*` (an app-side bounce mid web-checkout breaks the
  very flow the iOS posture depends on), `/admin/*`, `/matrimony/*` and the marketing
  routes, `/login`.
- **Token-bearing links ride verified App Links / universal links only.** On Android any
  app can register `tricitymatch://`; a password-reset token over a custom scheme is
  interceptable. Drop `tricityshadi.com` from the prefixes — zero shipped builds means no
  legacy to honour, and an unverifiable domain in the intent filter degrades verification.
- **Pending-link capture:** a link tapped while logged out or mid-onboarding targets an
  unregistered screen and React Navigation drops it **silently** — which is exactly the
  invite flow's most common case. Stash the URL, replay after Main mounts.
- **Push tap routing (G19):** whitelisted `data.type → route` table, `relatedId` untrusted,
  never `Linking.openURL` a payload URL. Pinned by a test mirroring web's
  `notificationLinks.test.jsx`. Every destination needs its 403/404/"no longer available"
  state — a push for revoked chat or a blocked profile must not dead-end.
- Refetch on focus / reconnect so a desktop edit shows up without a relaunch.
- **No server-side onboarding draft.**

FCM still has no credentials, so routing is testable, delivery is not.

### RN-E — Observability, OTA, store collateral
Sentry already installed in RN-B; wire releases + source maps. **EAS Update with
`runtimeVersion` fingerprinting** so a JS update can never land on an incompatible binary —
bare workflow means part of this config is native and must survive the RN-A prebuild.
Review demo account, screenshots, data-safety forms, phased rollout.

### RN-F — Probes
44pt tap-target probe, screen-reader pass, cold-start budget as the mobile analogue of the
web LCP budget. (The contract harness moved to RN-A; per-module tests moved into RN-C.)

### RN-G — Craft retrofit sweep (legacy screens)
The rails shipped in RN-C0; this is the sweep across the ~80 existing screens.

- **Dark mode:** convert baked `StyleSheet.create` palettes to the themed factory. 84 files.
  This is weeks, not an audit bullet, and it is why RN-B has to make the light-lock call.
- **Spacing:** the plan's original "replace 219 literals with tokens" was naive — the
  literals are largely handoff values the scale doesn't contain (11 row padding, 13 row
  gaps, 14, 10, 6, 2–3 micro gaps). Either extend the scale with micro steps and bless
  11/13 as `rowY`/`rowGap` semantic tokens, **or** publish a literal→token mapping table
  and accept a 1–2px density change. Ship the table either way; without it, 219 individual
  judgment calls land inconsistently.
- **Motion spec** (not vibes). Animate: press feedback `PressableScale 0.97` + `spring.pop`
  on every card/row/CTA; list entrance fade + ≤8px rise, `duration.base`, `easing.std`,
  stagger ≤60ms capped at ~6 items; sheets `spring.sheet` + 240ms scrim fade;
  skeleton→content crossfade `duration.base`; accordion open `duration.fast`–`base`;
  MatchCelebration keeps `duration.slow` + `haptic.success` as the one sanctioned
  celebration. **Must not animate:** chat messages in the inverted list (reads as lag), tab
  content swaps beyond a crossfade, anything on scroll, data tables, nav headers. All
  behind `useReduceMotion`, which exists and is used by exactly one component.
- **Elder mode is architecture, not audit** — 2 consumers today. An elder-aware text
  primitive so 88 files inherit it, mirroring web's global `html.elder`.
- **Dynamic type policy:** no `maxFontSizeMultiplier`/`allowFontScaling` anywhere today,
  against absolute lineHeights and fixed-height containers. Cap on chrome, unlimited on
  body, in the shared Text primitive.
- **Tap targets:** `tapTarget` token has 0 uses; Matches accept/decline are 38px, chat 42px,
  Home bell ~32px, `hitSlop` appears 4 times app-wide.
- **Per-screen definition of done:** 0 baked palette refs, 0 raw `fontSize`, 4 states
  present, targets ≥ `tapTarget.default`, PressableScale on interactives, elder + dark
  verified. Without a checklist, "clean and professional" is unfalsifiable.

---

## NOT in scope
Admin + Bureau RN stacks · Agora calls (config-gated; **but hide the dead buttons**) ·
astrologer marketplace (unseeded) · React 19 and other held dep migrations · supply
outreach (owner-led).

## Risks
- **RN-A is the real risk, and it is native, not textual.** 4 text conflicts is easy; a
  never-compiled SDK-52 branch with a 0.74 native shell is not.
- RN-B may invalidate subscription UI assumptions — which is why it precedes RN-C.
- The Play 12-tester/14-day clock is a calendar dependency no amount of code removes.
- Launching into a marketplace with very few live profiles earns permanent 1-star
  "no matches here" reviews. **Submission should be gated on supply, not just on code.**

## Review consensus (Fable ×3, `[subagent-only]` — Codex at usage limit)

| Dimension | Verdict |
|---|---|
| Premises valid | **DISAGREE → resolved by owner.** CEO rejected parity-first; owner locked store-blockers-first. |
| Right problem | **CONFIRMED after restructure.** Parity on an unshippable binary is inventory. |
| Scope calibration | **CONFIRMED.** Missing items added: crash reporting, OTA, store collateral, contract harness, rails. |
| Architecture sound | **DISAGREE → fixed.** No structural fix existed; `routes.ts` was a trap. Manifest + conformance + zod now specified. |
| Test coverage | **DISAGREE → fixed.** Harness moved to RN-A; unit-with-mocked-axios cannot catch the historical bug class. |
| Error paths | **DISAGREE → fixed.** Offline logout, dropped deep links, push to revoked resources, Search error-as-empty all added. |
| Sequencing | **DISAGREE → fixed.** Craft split into rails-before-RN-C and sweep-last; Sentry to RN-B; harness to RN-A. |
| Design quality | Hierarchy 4/10 · states 3/10 · native idiom 5/10 · motion 4/10 · spacing 5/10 · a11y 3/10 · RN-G executability 3/10 (as originally written). |
