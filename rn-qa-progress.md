# RN Apps QA — iOS + Android Simulators (progress tracker)

> Fix-on-discovery, one screen at a time. Plan: approved RN QA plan · reference `docs/QA.md §4`.
> Status: OPEN · FIXING · FIXED-VERIFIED · DEFERRED · WONTFIX. Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low/Cosmetic.
> Screenshots → `/tmp/rnqa/` (never committed). Captures: `xcrun simctl io booted screenshot` (iOS) · `adb exec-out screencap -p` (Android).

## Environment
| Item | State |
|------|-------|
| Backend `:5001` | ✅ nodemon dev server |
| iOS sim | ✅ iPhone 17 Pro; dev build via `expo run:ios` (Expo Go unusable — MMKV/fast-image hard native deps). Welcome render verified |
| Android | ✅ `qa_pixel` AVD (arm64 API34, bootstrapped); dev build installed; **live adb walkthrough done** |
| Driver | adb (`shell input tap/text`, `exec-out screencap`) + Metro reverse tunnels `adb reverse tcp:8081`+`tcp:5001` (no `.env` edit — Android reaches host `localhost`) |
| Test user | `aman.singh2@example.com`/`Pass@1234` (seed, elite/VIP, 86% profile) |

## Setup / infra findings (blocked before any screen QA — all fixed)
| # | Finding (sev) | Root cause | Fix |
|---|---------------|-----------|-----|
| S1 | 🟠 App would not bundle — `Unable to resolve "warn-once"/"query-string"/"use-latest-callback"/"color"/"react-freeze"` | Root lockfile missing react-navigation v6 + react-native-screens transitive deps (incomplete install) | Installed missing deps at root (`warn-once query-string color use-latest-callback react-freeze` + query-string subtree) via `--legacy-peer-deps`; full-tree scan now 0 missing |
| S2 | 🟡 iOS dev build fails `xcodebuild` 65 | RNCAsyncStorage pods out of sync / codegen | `pod install` in `ios/` (then dev client runs; JS served by Metro) |
| S3 | 🟡 Android SDK incomplete | no cmdline-tools/system-image/AVD | bootstrapped cmdline-tools + arm64 API34 image + `qa_pixel` AVD |
| S4 | 🟡 Android gradle fails `No Java compiler` | default Java is JRE | `JAVA_HOME=Android Studio jbr` (JDK 21) |
| S5 | ⚪ Pre-existing tsc errors (not this pass) | `Button.tsx onPrimary` ×4, `SectionHeader letterSpacing` ×1 — theme tokens absent | LOGGED — pre-existing tech debt, not introduced here |

## Run log (Phase 1 — slop removal, source verified `tsc` clean)
| # | Screen | Status | Finding (sev) | Fix (file) |
|---|--------|--------|---------------|------------|
| 1 | Welcome | FIXED-VERIFIED (iOS) | ⚪ emoji card icons (✅🔒💑) render as broken glyph + 3 pastel card bgs (pink/green/gold) | Ionicons (shield/lock/heart) in primaryLight circle; unified white bordered card `WelcomeScreen.tsx` |
| 2 | Login | FIXED (src) | ⚪ emoji eye toggle 🙈/👁, 🔍 Google, 🔐 biometric ×2 | Ionicons eye/logo-google/finger-print `LoginScreen.tsx` |
| 3 | Signup | FIXED (src) | ⚪ emoji eye ×2 + `✓` terms checkmark | Ionicons eye + checkmark `SignupScreen.tsx` |
| 4 | OTP | FIXED (src) | ⚪ 📱 header emoji | Ionicons phone-portrait in circle `OTPScreen.tsx` |
| 5 | ForgotPassword | FIXED (src) | ⚪ 📧/🔑 emoji + `←` back arrow | Ionicons mail/key/chevron-back `ForgotPasswordScreen.tsx` |
| 6 | ResetPassword | FIXED (src) | ⚪ ✅/🔒 + emoji eye ×2 | Ionicons checkmark-circle/lock/eye `ResetPasswordScreen.tsx` |
| 7 | Onboarding Step0 | FIXED (src) | ⚪ 6 emoji tiles (🙋👦👧…) | Ionicons person/man/woman/people/happy `Step0Screen.tsx` |
| 8 | Onboarding Step13 | FIXED (src) | ⚪ hard-coded error bg `#FEF2F2` | `colours.errorBg` token `Step13Screen.tsx` |
| 9 | Home | FIXED (src) | ⚪ 👋 in "Welcome back" | removed `HomeScreen.tsx` |
| 10 | Quiz | FIXED (src) | ⚪ 🎉 alert + `✓` submit btn | removed `QuizScreen.tsx` |
| 11 | AstrologerDetail | FIXED (src) | ⚪ 🎉 alert | removed `AstrologerDetailScreen.tsx` |
| 12 | SelfieVerification | FIXED (src) | ⚪ `✓` countdown done | Ionicons checkmark `SelfieVerificationScreen.tsx` |
| 13 | ChatThread | FIXED (src) | ⚪ `✓✓`/`✓` read receipts | Ionicons checkmark-done/checkmark `ChatThreadScreen.tsx` |
| 14 | Subscription | FIXED (src) | ⚪ plan emoji 👤⭐💎👑 | Ionicons person/star/diamond/trophy `SubscriptionScreen.tsx` |
| 15 | AstrologerMarketplace | FIXED (src) | ⚪ 6 specialty emoji + 🔮 banner | Ionicons planet/heart/briefcase/calculator/home/diamond `AstrologerMarketplaceScreen.tsx` |
| 16 | Verification | FIXED (src) | ⚪ tier emoji 📱🪪🎓💰 | Ionicons phone/card/school/cash (keeps per-tier badgeColor) `VerificationScreen.tsx` |
| 17 | ProfileDetail | FIXED (src) | ⚪ `✓ Mobile/ID/…` chips + 🎉 match | Ionicons checkmark-circle chips; removed 🎉 `ProfileDetailScreen.tsx` |

> Slop fixes all FIXED-VERIFIED live on Android (Welcome, Login, Step0, Home, Matches, Chat, Search, Filters, Profile show Ionicons + brand burgundy/gold, no emoji/pastel). iOS Welcome verified. `tsc --noEmit` fully clean (0 errors — incl. the 5 prior pre-existing).

## Phase 2 — functional bugs found in live walkthrough (Android dev build) + fixed
| # | Bug (sev) | Root cause | Fix | Verified |
|---|-----------|-----------|-----|----------|
| B1 | 🟠 Android status bar off-brand **rose** (`#E11D48`) on every screen | legacy pre-burgundy colour baked into native theme + app.json splash/icon; no runtime `StatusBar` | app.json splash+adaptiveIcon→`#8B2346`; native `colors.xml`/`styles.xml` statusBar→light `#FAFAFA`+`windowLightStatusBar`; runtime `AppStatusBar` (RN core, dark/light-aware) in `App.tsx` | ✅ light bar + dark icons, matches iOS |
| B2 | 🔴 **Search crashes** (`layoutState.get is not a function`) — whole screen + all bottom-sheets dead | `@gorhom/bottom-sheet` **v5.2.14** needs reanimated ≥3.16 `.get()`; Expo SDK51 pins reanimated **3.10.1** | downgrade `@gorhom/bottom-sheet`→`^4.6.4` (v4 API matches FilterPanel usage); Metro `--clear` | ✅ Search renders + Filters sheet opens (Age/Height/Marital/sections) |
| B3 | 🔴 **Returning users re-onboarded every login** — Main app unreachable | backend never returns `onboardingComplete`; authStore overwrites cached flag with flagless `/auth/me` | backend `withDerivedUserFields` now derives `onboardingComplete` (profile has gender+DOB) on login/signup/getMe; `RootNavigator` client fallback to same | ✅ login lands on Home |
| B4 | 🔴 **Chat dead for all users**, incl. paying — "Plus+ Feature" gate always shown | `ConversationsScreen` line 134 + `MatchesScreen` line 340 hard-code `hasPlus = false` (never wired) | both → `useAuthStore(selectPlan) !== 'free'` (any paid tier, mirrors web `requirePremium`) | ✅ elite user reaches real Chat empty-state |
| B5 | 🔴 **`subscriptionPlan` never sent by backend** → whole app treats every user as free (Home badge, Subscription current-plan, premium gates) | login/signup/getMe serialize User+Profile only, no plan | `withDerivedUserFields` attaches `subscriptionPlan` from active Subscription (else `free`) | ✅ ELITE badge shows on Profile; Chat unlocks |
| B6 | 🟠 **OwnProfile shows "undefined undefined" + 0%** (data garbage) — also EditProfile/ProfileDetail | `getMyProfile`/`getProfile`/`updateMyProfile` return whole `{success,profile}` envelope typed as `Profile`; callers read `.firstName` etc. | unwrap to `res.data.profile` (typed) | ✅ "Aman Singh / 31 yrs · Chandigarh · Software Engineer / 86%" |
| B7 | 🟡 **CompletionRing renders as starburst/spokes** not a ring | 10 segments are 50px bars pivoted around ring centre → full-radius spokes | short 14px ticks at rim (top 6, translateY 37 pivot); empty ticks → border grey | ✅ clean 10-tick segmented ring |
| B8 | ⚪ Pre-existing tsc errors (theme tokens missing) | `colours.onPrimary` ×4, `typography.letterSpacing.eyebrow` ×1 absent | added tokens to `shared/.../theme.ts` (light+dark) | ✅ tsc 0 errors |

## Open findings (noted, not fixed — out of slop/UI scope or seed-only)
- ⚪ ProfileCard/avatars blank + `ReactImageView: "/uploads/photos/default-*.jpg" doesn't exist` LogBox warnings — seed/default avatars use **relative** paths native can't resolve (prod uploads are absolute Cloudinary URLs). Mobile could prefix relative paths defensively; affects photo-less users' fallback avatar. Low.
- ⚪ Search header shows "No profiles found" **above** populated profile cards — empty-state/count logic. Low cosmetic.
- 🟡 Root cause behind B3/B5 is the same backend gap (`/auth/me` shape). Derivation added in `authController` is the minimal fix; a persisted `User.onboardingComplete` column + explicit plan-on-Subscription serializer would be the durable version. Seed `Subscription.planType` uses `elite`/`premium` which aren't in the model ENUM (`free/basic_premium/premium_plus/vip`) — dev seed-data mismatch (prod uses valid enum via Razorpay).

## Phase 3 — "make it work like the website" (API contract + logo + i18n + polish)
Root cause: RN `api/*.ts` never integration-tested → wrong **paths** + wrong **unwrap** app-wide. Fixed every member module + consumers:
| Module | Fix | Verified live |
|--------|-----|---------------|
| matches | paths `/match/matches→/mutual`, `/shortlisted→/shortlist`, `/liked-me→/likes`, `/matches/feed→/match/daily`; unwrap `.mutualMatches/.shortlisted/.likes/.matches` | ✅ Home "Today's Matches" populated; Matches 3 tabs load |
| chat | `/chat/${id}→/chat/messages/:id` (thread/edit/delete); `getConversations→.conversations` | ✅ Chat empty-state (was envelope) |
| search | cursor→page; return `{profiles, nextCursor}` from `pagination` | ✅ "15 profiles found" + cards + scroll |
| subscription | `getPlans` object→array (**was crashing Plans tab**); `verifyPayment→.subscription`, history→`.subscriptions`, `createOrder→.order.id` | ✅ Settings "Current: elite" |
| notifications | cursor→page; `{notifications, unreadCount, nextCursor}` | — |
| verification | `/verification/me→/status` + tier mapping; upload sends `documentType`+`documentFront`; tiers 3/4 → "Coming soon" (ID-only backend) | — |
| guardian | real paths (`/my-guardians`,`/my-candidates`,`/candidate/:id/matches\|shortlisted`); **email** invite not phone; minimal-shape→ProfileSummary mappers | — |
| calls/astrologers | `getCallHistory→.calls`; `getAstrologers→.astrologers`, `getMyConsultations→.bookings` | — |
| profile (prior) | `getMyProfile/getProfile/updateMyProfile→.profile` | ✅ Profile + EditProfile real data |

**Dead-ends hidden + documented** (CLAUDE.md Known Issues): sent-interests tab removed, save-search UI hidden, education/income verification "Coming soon", astrologer marketplace stub-data.
**Logo:** real website mark — `frontend/public/images/logo.svg` → `mobile/assets/{logo,icon,adaptive-icon,splash}.png` (sharp); `Logo.tsx` `<Image>` replaces "TS" text badge. ✅ verified on Welcome. (icon/splash apply on next `expo run:android`.)
**i18n:** language switch verified working end-to-end (Login + Welcome full Hindi); added missing `welcome.*` keys ×3 langs.
**Avatar polish:** shared `SmartImage` (resolve relative `/uploads/*` + initials fallback) wired into `ProfileCard` + Home cards → ✅ burgundy initials replace blank boxes; broken-image LogBox spam gone.

## Notes
- Native modules (Agora/Razorpay/Firebase/camera/biometric) dynamic-require; unconfigured = config-gated stub, not a bug.
- No `.env` edits made (used `adb reverse`). Regression after Phase 3: BE 116 unit + FE 31 green; mobile `tsc` 0 errors. No commit (not requested).
- Scope = member app (Admin/Bureau stacks deferred). Residual i18n: 6 member screens still hardcoded EN (Notifications/Astrologer×2/Horoscope/Support/SuccessStory).

## 2026-06-21 — "Work like the website" finish pass (committed to `main`)
Committed the prior uncommitted RN work (~95 files) + closed remaining gaps via a live **Android dev-build** walkthrough (iOS build verified + Welcome spot-checked; iOS has no programmatic tap so visual-only).

**API contract (modules the earlier pass missed):**
- `auth.ts`: `/auth/refresh-token`→`/refresh`; `getMe` unwrap `.user`; `deleteAccount`→`/auth/account`; read `tokens.{accessToken,refreshToken}` from body; dropped dead `/auth/device-token` (FCM = `notifications/fcm-token`). `client.ts` interceptor matched + persists rotated refresh token.
- `profile.ts`: `uploadPhoto`→multipart `PUT /profile/me` (no standalone route); `deletePhoto` by `photoUrl`→`DELETE /profile/me/photo`.
- `block.ts`: report→`POST /report/:userId { reason }` (enum-mapped in BlockReportSheet).

**Backend (additive, web unaffected):** login/signup/refresh/google return `refreshToken` in body (+ `user` on refresh) → native cold-start restore works (verified: force-stop → auto-relogin). Public `POST /success-stories` (rate-limited, `draft`) wires the dead RN submit screen.

**🔴 Real bugs found in live QA (prod-affecting, incl. web):**
- B9 `chatController.getConversations`: `= ANY(:ids)` + Sequelize replacements → `malformed array literal` crash for any user with mutual matches → `IN (:ids)`. (Web chat hit this too.)
- B10 RN `chat.ts`: backend conversation `{ user:{name} }` ≠ screen `{ profile }` → "Cannot read firstName of undefined" crash → mapper added.
- B11 RN `matches.ts`: flat `/match` list items ≠ `{ MatchedProfile }` → Matches showed "Unknown" + missing react keys → mapper added.
- B12 RN `subscription.getPlans`: spread marketing-only API object over `planType`, shadowing shared `PLANS` capability flags → **every plan showed all features excluded (even VIP)** → use `PLANS` + overlay live price.

**Visual parity (native idioms ~85-90%):** gradient `Button` (primary + `gold`) via `expo-linear-gradient` (added; re-link `mobile/node_modules/react-native` symlink after `expo install`); ProfileCard burgundy shadow + photo scrim + gold high-compat star + score-coloured bar; CompatibilityMeter green/gold/burgundy; Subscription "Most Popular"/"Best Value" badges; raw `<Image>` avatars (Matches/Chat/OwnProfile)→`SmartImage`; web `ProfileCompletionMeter` rose `#be123c`→brand.

**Dead-ends removed:** Step3 kundli upload (no backend).

**Verified live (Android):** Welcome/Login (gradient)→cold-start restore→Home (VIP/86%/matches)→Search (15 found, scrim+compat colour)→Matches (3 tabs, real names)→Chat (list+thread+send)→Settings→Subscription (badges + correct per-plan features). **iOS:** Build Succeeded, gradient module links, Welcome renders.

**Dev-seed quirk (not app bug):** premium test accounts had invalid planType `elite` + expired `endDate` → `requirePremium` 403; set `vip` + future `endDate` for premium QA.

Regression: BE **116 unit** + FE **35** + mobile `tsc` **0**. Commits on `main`.

---

## 2026-06-21 (pass 3) — remaining mobile→web parity workflows

Explore sweep + per-endpoint verification found 4 member workflows present on the website but missing/stubbed on mobile — all backed by shipped endpoints (≈zero backend change). Built (member app, native idioms):

1. **Profile Visitors + Recently Viewed** rails on OwnProfile (mirrors web Dashboard). `GET /profile/me/viewers` (premium → upsell card for free tier) + `GET /profile/me/recently-viewed` (all tiers). Horizontal `FlatList` of `SmartImage` avatar cards; tap→ProfileDetail. New `api/profile.ts` `getProfileViewers`/`getRecentlyViewed` (flat item→ProfileSummary mapper, same idiom as `matches.ts`).
2. **Privacy Controls** — new `PrivacySettingsScreen`, replaces the dead `Alert('Photo Privacy','Coming soon')` at `SettingsScreen:351`. Visibility segmented (everyone/matches_only) + online-status + last-seen toggles; hydrates from `getMyProfile`, saves via `PUT /profile/privacy` (`updatePrivacy`).
3. **Success Stories browse** — new `SuccessStoriesBrowseScreen` reads public `GET /success-stories`; linked from Settings ("Success Stories"), submit via header +. New `getSuccessStories`.

**🔴 Real bug found + fixed (web-affecting):** migration `20240101000014` added `profileVisibility`/`showOnlineStatus`/`showLastSeen` columns, but `models/Profile.js` **never declared them** → `save()` silently dropped them and `GET /profile/me` never serialized them → privacy settings never persisted (web + mobile). Declared the 3 columns on the model → persists + round-trips. (nodemon auto-restarted; verified via curl: PUT→GET returns the values.)

**Verified live on Android (seeded VIP, adb):** seeded 3 viewers (GET /profile/:id logs the view) → Visitors rail shows Rohit/Arjun/Karan; Recently-Viewed shows Simran/Priya; card tap→ProfileDetail (Rohit Gupta 25, 85%). Privacy: set server everyone/online-off/lastSeen-off → cold-start → screen hydrates to that exact state; toggle+save shows "Saved ✓". Success Stories: seeded a published story → list renders (tag/quote/names/location). adb tip: pixel-math from scaled screenshots is unreliable — use `uiautomator dump` + element `bounds` for exact tap centers.

**Out of scope (verified not buildable):** saved-searches/sent-interests (no backend), education/income verification tiers (enum ID-only), astrologer reviews/slots stubs (no data), horoscope-match PDF (RN cookie-auth + file-share heavy, deferred).

Regression: BE **116 unit** + FE **35** + mobile `tsc` **0**. 2 commits on `main` (model fix + mobile features).

---

## 2026-06-22 — FULL live QA pass, iOS + Android (real taps both platforms)

First pass driving **both** sims programmatically: Android via adb `input`/`uiautomator`, **iOS via `fb-idb`** (`idb ui tap/text` + `describe-all` for bounds — pip `fb-idb` on Python 3.12; 3.14 breaks asyncio). Method: per screen render → "professional? 1000-user-safe?" → fix-on-discovery → re-verify both. Test user `aman.singh2@example.com`/`Pass@1234` (VIP).

**Env:** iOS dev build rebuilt fresh (`expo run:ios`, Build Succeeded) on iPhone 17 Pro; Android dev client **rebuilt + reinstalled** (gradle BUILD SUCCESSFUL, fresh APK) on `qa_pixel`. Metro on 8081, `adb reverse` 8081+5001, backend `:5001`.

| # | Bug (sev) | Platform | Root cause | Fix | Verified |
|---|-----------|----------|-----------|-----|----------|
| F1 | 🟠 `ExpoLinearGradient` native view manager not exported → gradient `Button` may not render | Android (stale dev client) | `expo-linear-gradient` added to JS but installed Android dev client predated the native module | Rebuilt + reinstalled Android dev client (native module now linked); **+ defensive solid-brand `backgroundColor` behind the gradient** in `Button.tsx` so it degrades gracefully on any device/stale build | ✅ warning gone on Android; gradient renders both platforms |
| F2 | 🟡 ProfileDetail hero photo **blank white** for photoless/seed profiles | iOS + Android | hero used raw `<Image>` with relative `/uploads/*` URI (native can't resolve); fallback branch only fired when `photos` array was empty, not on load failure | new `HeroPhoto` component: `resolveImageUri` + `onError`→person-icon fallback, keeps blur + lock overlay (`ProfileDetailScreen.tsx`) | ✅ person-icon fallback both platforms |
| F3 | 🟠 ProfileDetail compatibility **fabricated** (`completionPercentage * 0.85`) → showed 85% while Home/Search card showed real 57% for same profile | iOS + Android | screen never fetched real compat; faked a number from profile completeness | added `useQuery(['compatibility', userId], getCompatibilityBreakdown)` (shares breakdown-sheet key) → render real `overallScore` | ✅ shows 57% matching cards, both platforms |

**Verified clean both platforms so far:** Welcome (brand/logo/lang switch, gradient btn, no emoji, safe areas), Login (validation "Email address is required", gradient Sign In, Google, eye toggle), Home (VIP badge, 86% ring, Today's Matches w/ real compat bars, SmartImage initials, Quick Actions, New-on list, 5 tabs incl Chat for paid user — B4/B5 hold), ProfileDetail (after fix). Android status bar light + dark icons (B1 holds). iOS keychain "Save Password?" = benign OS dialog.

| F4 | 🟡 Tab screens (**Search, Matches, Notifications**) render under the status bar / Dynamic Island on iOS (no top safe-area inset) — header/search-bar overlapped by clock + notch | iOS | screens had no `useSafeAreaInsets`; Home/OwnProfile used a hardcoded `paddingTop: 52` but these three had nothing | added `useSafeAreaInsets()` → `paddingTop: insets.top` on container (`SearchScreen.tsx`, `MatchesScreen.tsx`; Notifications pending its own visit) | ✅ Search + Matches clear the notch, both platforms |
| F5 | 🟡 Conversations list jammed under the notch on iOS + **no header/title at all** (bare list, looked unfinished) | iOS (safe-area) + both (missing header) | `ConversationsScreen` rendered a raw `FlatList` from y=0, no safe-area, no title | added safe-area inset + a **"Messages" header** with a Family Groups shortcut icon (route exists, was only reachable from Settings) | ✅ header + clears notch both platforms |

**Verified working both platforms:** Search (15 profiles, real compat, sort/filter), FilterPanel (gorhom v4 accordions/ranges/chips — B2 holds), Matches (Mutual/Shortlisted/Liked Me tabs, real names+compat), Conversations (Messages header, real list), **ChatThread (date separators, burgundy sent bubbles + read-receipt icons, optimistic send verified — "Hello from QA test" sent + synced cross-platform iOS→Android), request-phone action, call/video header icons**. iOS dev HMR websocket flaky → disabled Fast Refresh + reload via Cmd+R (dev-tooling only, not an app bug). Android emulator crashed once under build load → rebooted.

| F6 | 🟡 OwnProfile photo header **blank white** (~480px) for photoless/seed user | iOS + Android | own gallery used raw `<Image>` (relative seed path 404s), empty branch only on `photos.length===0` | `OwnGalleryPhoto` component: `resolveImageUri` + `onError` → "Add photos" camera prompt (`OwnProfileScreen.tsx`) | ✅ shows "Add photos" prompt |
| F7 | 🟠 **Dark Mode toggle 100% dead** — flips state but nothing re-themes (0 of 61 files consume `useTheme()`; all bake static light `colours` into `StyleSheet.create()`) | both | dark mode never wired app-wide; `useTheme`/`darkColours` are dead code | **per user decision: removed the dead toggle** from Settings (no dead UI) — full theming deferred to a feature pass. Elder Mode kept (partially wired: tab bar size, hides Chat tab) | ✅ toggle gone; Settings clean |
| F8 | 🔴 **Notifications screen crashes** on open — RedBox `Cannot read property 'length' of undefined` (`infiniteQueryBehavior` `pages.length`) | both | **query-key collision**: HomeScreen `useQuery(['notifications'])` stores a flat shape for the bell badge; NotificationsScreen `useInfiniteQuery(['notifications'])` then reads it as `InfiniteData` → `data.pages` undefined. Home always loads first → always crashes | Home now uses the dedicated `getUnreadCount` endpoint with its own `queryKeys.unreadCount` key (also lighter at scale); wired `unreadCount` into socket + mark-read invalidations (the old `['unreadCount']` invalidation key was also wrong) | ✅ Notifications renders ("It's a Match!" item); badge still works |

**Safe-area sweep (F4/F5 class).** Source-audited every screen: OnboardingLayout (`SafeAreaView`), auth (`paddingTop:60`), ChatThread (`paddingTop:56`), Home/OwnProfile (`paddingTop:52`), FamilyGroups/Guardian-view (`paddingTop:80`) all already handle the notch. The genuinely-bare screens got `useSafeAreaInsets()` → `paddingTop: insets.top`:
`SearchScreen`, `MatchesScreen`, `ConversationsScreen`, `NotificationsScreen`, `SubscriptionScreen`, `VerificationScreen`, `SelfieVerificationScreen`, `BackgroundCheckScreen`, `HoroscopeMatchScreen`, `QuizScreen`, `GuardianSetupScreen`, `AstrologerMarketplaceScreen`, `AstrologerDetailScreen`, `EditProfileScreen`. Live-verified clean (no double-padding) on Search/Matches/Conversations/Notifications/Subscription/Verification.

**Also noted (not fixed):** ⚪ "It's a Match! 🎉" notification copy contains an emoji (backend-generated `notify()` title — affects web too; debatable for a celebratory match alert). ⚪ Subscription "Plus" tier uses a blue accent vs brand gold (cosmetic tier-coding). ⚪ ProfileCard initials + grey photo-scrim looks slightly off (scrim designed for real photos; fine at scale).

### Verified live this pass (iOS primary w/ real taps, Android parity spot-checks)
Welcome, Login (+empty validation), Home, Search, FilterPanel, Matches (3 tabs), Conversations, ChatThread (send verified, synced iOS→Android), ProfileDetail, OwnProfile (all sections), Settings (+Language picker, Dark removed), Notifications, Subscription (per-plan features), Verification, FamilyGroups (empty state). Cold-start session restore works both platforms.

### NOT live-tested this pass (documented, deferred)
- **Onboarding** 14-step signup flow (wrapper safe-area confirmed via source; not walked live).
- **Calls** (Voice/Video/IncomingCall) — config-gated on Agora (stub; not exercised).
- **Horoscope match / Quiz / Guardian (setup/view/candidates)** — safe-area fixed via source; screens not walked live.
- **Admin stack** (AdminHome/VerificationQueue/ReportsQueue) — needs an admin-role test user (seed `aman.singh2` is a member).
- **Bureau stack** (Home/ClientRoster/MatchProposal/Earnings/Support/SuccessStory) — needs a bureau-role test user.
- **i18n** hi/pa beyond the picker (verified working in prior passes); **Elder mode** larger-type pass.

Regression at checkpoint: mobile `tsc` **0**, BE unit **116/116**, FE untouched (**35**).

---

## 2026-06-25 — Form autofill/keyboard ergonomics + untested-screen live walk (iOS + Android)

Focus: the one area no prior pass touched — **native form autofill** (iOS keychain / strong-password + Android autofill) — plus live-walking the screens the 2026-06-22 pass listed as "NOT live-tested" (Guardian, Horoscope, Quiz, Elder mode). Both dev clients already built (iOS iPhone 17 Pro, Android `qa_pixel`); Metro 8081, backend 5001, `adb reverse` 8081+5001. Test user `aman.singh2@example.com`/`Pass@1234` (VIP). iOS driven via `idb ui`, Android via `adb input` + `uiautomator` bounds.

### Part A — autofill/keyboard metadata (code; was 100% absent app-wide)
Prior forms had `keyboardType` + `returnKeyType` chaining but **no** `textContentType`/`autoComplete`/`autoFocus` → iOS never offered keychain/strong-password, Android never offered autofill. Added per field type:
| File | Change |
|------|--------|
| `auth/LoginScreen.tsx` | email `textContentType=emailAddress`+`autoComplete=email`+`autoFocus`; password `password`/`current-password` |
| `auth/SignupScreen.tsx` | email (+autoFocus); password `newPassword`/`new-password`+`passwordRules`; confirm `newPassword`/`new-password` |
| `auth/ForgotPasswordScreen.tsx` | email `emailAddress`/`email`+`autoFocus` |
| `auth/ResetPasswordScreen.tsx` | both passwords `newPassword`/`new-password` (+`passwordRules` on first) |
| `auth/OTPScreen.tsx` | first box `textContentType=oneTimeCode`+`autoComplete=sms-otp` (SMS auto-fill; other boxes `none`/`off` to avoid dup) |
| `onboarding/Step1Screen.tsx` | first/last name `givenName`/`familyName`+`name-given`/`name-family`; **ref-chaining** first→last `returnKeyType=next`; `autoCorrect=false` |
| `onboarding/Step3Screen.tsx` | place-of-birth `addressCity`/`postal-address-locality` |
| `onboarding/Step10Screen.tsx` | bio multiline `autoCapitalize=sentences` |
| `profile/EditProfileScreen.tsx` | `FieldEditor` now threads optional `textContentType`/`autoComplete`/`autoCapitalize` props + multiline newline behaviour (`blurOnSubmit={!multiline}`, `returnKeyType` default/done); wired name→given/family, city→addressCity, state→addressState |

**Live-verified (iOS):** Login renders with email **auto-focused** (keyboard up on mount) + the iOS QuickType **"Passwords" keychain key** present; navigating Login→Signup fired the native **"Save Password?"** dialog → confirms keychain/autofill wiring is now active (was absent before). Android autofill is OS/profile-driven (no saved Google autofill profile on the emulator to demo the dropdown) — code present, no crash.

### Part B — untested-screen live walk + a real bug
| # | Bug (sev) | Platform | Root cause | Fix | Verified |
|---|-----------|----------|-----------|-----|----------|
| A1 | 🟡 OwnProfile "Basic Details" **Date of Birth shows raw ISO** `1995-05-03T18:30:00.000Z` (unprofessional; same class as the 2026-06-19 web admin DOB bug) | both | `OwnProfileScreen` passed `profile.dateOfBirth` straight to `SectionRow` value | reuse existing `utils/dateUtils.formatDate` → `value={formatDate(profile.dateOfBirth)}` | ✅ Android live: now **"04 May 1995"** |

**Verified clean live (Android real taps; iOS render spot-checks):**
- **Guardian Co-Pilot** — shield header, "What guardians can do" green-✓/red-✗ permissions card, gradient "Invite a Guardian", "No guardians invited yet" empty state.
- **Elder Mode** — toggles on; **Chat tab correctly hidden** (5→4 tabs), layout intact, no clipping; reversible.
- **Kundli/Horoscope Match** — graceful incomplete-data handling (N/A ring, "Nakshatra details missing" moon empty-state, guidance + Vedic disclaimer); no crash on seed profiles lacking nakshatra.
- **Compatibility Quiz** — 1/10 progress bar, Q1 + 4 radio options, Next disabled-until-select.
- **ProfileDetail** (Isha Bedi) — person-icon fallback (F2 holds), real **57%** compat matching Home card (F3 holds), accordions, sticky Pass/Shortlist/Interested bar.
- **Home / OwnProfile / Settings** — VIP badge, 84% **10-tick** ring (B7 holds), "Add photos" prompt (F6 holds), **Visitors/Recently-Viewed rail populated** (Isha/Anjali/Harleen/Rohit), Settings has **no Dark toggle** (F7 holds) + "Current: vip".

**Noted, not fixed:** ⚪ Kundli Manglik "status unknown for one or both profiles" renders with a green ✓ + green bg (neutral/unknown state styled as positive) — low cosmetic. ⚪ Full **Onboarding 14-step** live walk not completed (iOS scripted-input coordinate friction); Step1/Step3/Step10 changes source+`tsc`-verified and the Signup/CreateAccount screen + Step1 autofill render confirmed live on iOS.

Regression: mobile `tsc` **0 errors**; backend untouched (BE **116** unchanged); FE untouched. Scope: member app (Admin/Bureau deferred). No commit (not requested).

### Round 2 — deeper screen-by-screen sweep + fixes (Android real taps)
Walked the remaining member surface (Quiz, Search, FilterPanel, Matches×3, Conversations, ChatThread, Notifications, Verification, Privacy, Subscription, Success Stories). 4 more fixes:

| # | Bug (sev) | Where | Root cause | Fix | Verified |
|---|-----------|-------|-----------|-----|----------|
| A2 | 🔴 **ChatThread messages in reverse order** — newest at top, oldest pinned above the composer; new sends would land at top not bottom | both | backend `chatController.getMessages` returns **oldest-first** (`reverse()` after `DESC` — correct for web's normal scroll), but RN thread uses an **inverted** FlatList + optimistic-prepend-at-[0] which needs **newest-first** (group chat backend already returns newest-first w/ matching comment) | reverse to newest-first in RN `api/chat.ts getThread` (`messages.slice().reverse()`) — RN-only, web/backend untouched, now consistent w/ group chat | ✅ Android live: oldest-top → newest ("Hello from QA test", Jun 22) just above composer |
| A3 | 🟡 Manglik "status unknown" rendered with **green ✓ + green bg** (neutral/unknown state styled as positive/compatible) | both | `HoroscopeMatchScreen` branched only on boolean `manglikCompatible` (defaults true when unknown) | added 3rd neutral state (`/unknown/i` test → `help-circle` icon, grey `border` chip, `textSecondary`) | ✅ tsc; renders neutral |
| A4 | 🟡 **Subscription tier colours off-brand** — Plus = blue `#1565C0`, Premium = purple `#6A1B9A` (design system = burgundy standard + gold VIP only, never blue/purple) | both | `theme.ts` `planPlus`/`planPremium` tokens were blue/purple (light+dark) | recolour to brand burgundy ramp: Plus→`#8B2346`/`#E5A3B8`, Premium→`#6B1D3A`/`#C77B92`; VIP gold + Free mauve unchanged | ✅ Android live: Plus + Premium burgundy, "Most Popular" burgundy, VIP gold |
| A5 | ⚪ Match notification title **"It's a Match! 🎉"** carried an emoji in the in-app feed | both (in-app) | `matchController.js` `notify()` titles | dropped 🎉 from the two in-app `notify()` titles (kept the celebratory emoji in the **email** channel — industry-standard there) | ✅ source |

**Walked clean (no fix needed):** Compatibility Quiz (option select highlights burgundy, Next enables), Search (15 found, 64% bar, sort), FilterPanel (gorhom v4 ranges/chips/accordions — B2 holds), Matches (Mutual/Shortlisted/Liked Me — My Interests correctly removed, real names B11, per-row Chat btn), Conversations (Messages header F5, family-groups icon), Notifications (no crash — F8 holds), Verification (4 tiers + Elite framing, per-tier icons intentional), Privacy Controls (segmented + toggles + save), Subscription per-plan features (B12), Success Stories (published card renders). Elder-mode toggle verified **reversible** (off → Chat tab returns, 4→5 tabs).

Regression after round 2: mobile `tsc` **0**, backend **unit 128/128** (matchController string-only change; integration still needs live DB). FE untouched. No commit.

### Round 3 — full visual + HCI sweep (iOS + Android dev builds, fix-on-discovery)
Complete-coverage pass per user request ("check every page, all workflows, HCI/UX, easy + nice to use"). Driver: Android `adb input` + `uiautomator` text-dumps + iOS `idb`/`simctl`; live screenshots early, then text-dump + `logcat` crash-smoke once image budget hit. **3 new bugs found + fixed (mobile-only, `tsc` 0):**

| # | Bug (sev) | Where | Root cause | Fix | Verified |
|---|-----------|-------|-----------|-----|----------|
| R3-1 | 🔴 **Haptics crash on every button press (dev)** — first haptic call (e.g. Search→Filters) threw `Requiring unknown module "undefined"` redbox (`haptics.ts:22`), blocking the UI | both (dev) | `expo-haptics` is **not installed / not a declared dep**; a *static* `require('expo-haptics')` is resolved by Metro at build time and emits the unknown-module overlay on first call even though the throw is caught (prod = silent no-op, but degraded + scary in dev/QA) | rewrote `utils/haptics.ts` to resolve the native module via `expo-modules-core` `requireOptionalNativeModule('ExpoHaptics')` (returns null, never throws) — **no static expo-haptics require** → no overlay; real haptics light up automatically once `expo install expo-haptics` + rebuild | ✅ Android live: Filters press → FilterPanel opens, redbox gone, logcat clean app-wide |
| R3-2 | 🟠 **Signup/Reset password rule understated → server rejects valid-looking passwords** — placeholder "Min. 6 characters" + client-validates `<6`, but backend requires **8 + upper/lower/digit/symbol** → a client-valid password fails signup with a confusing 400 | both | mobile client validation + placeholder + `passwordRules` never matched backend `validators/index.js` (8 + complexity) | `SignupScreen` + `ResetPasswordScreen`: client validation → 8 + complexity regex; placeholder → "Min. 8 chars, with a number & symbol"; `passwordRules` → `minlength:8;required:lower;upper;digit;special` | ✅ iOS live: placeholder updated; iOS Strong-Password offer now fires correctly |
| R3-3 | 🟡 **Paid tier (VIP/premium) plan badge not gold** — OwnProfile plan chip used burgundy `accentSoft`/`primary` for ALL tiers; design reserves gold `#C9A227` for premium/VIP | both | `OwnProfileScreen` plan badge hardcoded burgundy regardless of `subscriptionPlan` | badge bg/fg now tier-aware: paid → `goldSoft`/`secondary` (gold), free → burgundy + Upgrade | ✅ Android live: VIP badge renders gold |

**Walked clean (live, no fix):** Welcome, Login, Signup, Forgot Password (iOS); Home (84% ring, quick actions, Today's Matches, New-near-you), Search (15 found, Pass/Shortlist/Interested), FilterPanel (gorhom v4), Matches×3 (color-coded compat 66%/93%), Conversations + ChatThread (tick receipts as icons, bubbles, date separators) + FamilyGroups (empty state), OwnProfile (Visitors rail Rohit/Arjun/Karan + Recently-viewed + completion ring + inline-edit rows), EditProfile (DOB formatted), Notifications, Settings (sectioned Account/Privacy/Appearance/Family/Notifications/Support; "Current: vip"), ProfileDetail (compat ring + About + Basic Details), CompatibilityBreakdownSheet (Age/Location/Lifestyle %), Verification (4 tiers), PrivacySettings (visibility segmented + toggles + save), Support (WhatsApp/Email + FAQ accordion), Success Stories. **Elder mode round-trip re-verified** (on → Chat tab hidden 5→4; off → Chat returns). Dark/elder toggles crash-safe (logcat clean). Subscription tier colours + "Current: vip" confirmed via code (planPlus burgundy `#8B2346`, VIP gold — R2/A4 holds).

**Notes / not-bugs:** in-app "It's a Match! 🎉" still shows for a **6-day-old** notification = pre-A5 stored row (new match notifications carry no emoji — A5 holds). Safe-area handled app-wide (OnboardingLayout `SafeAreaView` wraps all 14 Steps; auth screens manual `paddingTop:60`). No emoji / no off-brand pastel hex anywhere in member-screen JSX (prior slop removal holds).

**Not live-smoked this session (env-blocked, code-verified clean):** onboarding Step0–14 live walk (iOS Strong-Password system modal blocks idb signup automation; Android fresh-signup would destroy the restored VIP session) — code clean + safe-area via OnboardingLayout; Calls (Voice/Video/Incoming) + SelfieVerification (Agora/expo-camera not in dev-client native binary — config-gated, degrade-clean by design); Guardian×3, Astrologer×2, Quiz, HoroscopeMatch (reachable, code-clean — same consistent clean pattern). Android emulator (swiftshader) crashed twice mid-session; rebooted, no app-side cause.

Regression after round 3: mobile `tsc` **0**; backend + frontend **untouched** (changes are 4 mobile files only → BE 116/FE 35 unaffected). Scope: member app (Admin/Bureau deferred). No commit (not requested).

### Round 3 (cont.) — onboarding live walk (fresh signup) + 3 more bugs
Resumed by walking the full new-user path live on Android (cleared app data → Welcome → Get Started → Signup → onboarding). This exposed that **signup→onboarding was completely broken** — never caught before because every prior live pass logged in with the seeded account instead of registering.

| # | Bug (sev) | Where | Root cause | Fix | Verified |
|---|-----------|-------|-----------|-----|----------|
| R3-4 | 🔴 **RN signup 100% broken** — every registration `400 Validation failed`; no new user could sign up | backend (RN-facing) | `validators/index.js signupValidation` hard-required `firstName`+`lastName` (`.notEmpty()`), but RN `api/auth.ts signup()` posts only `{email,password}` (name is collected later in onboarding Step 1). Web sends names at signup so web was unaffected | made `firstName`/`lastName` `.optional({checkFalsy:true})` (still format-checked when present); `authController` Profile.create defaults `firstName/lastName → ''` (NOT NULL), welcome-email guards `firstName \|\| 'there'` | ✅ API: email+pw-only → **201**; web-style (name+gender+dob) → **201**. Live: Android signup → onboarding Step 0 |
| R3-5 | 🟠 **New signup skipped onboarding → empty Home** | backend | once R3-4 let signup through, the account landed straight on Home with "?" name + 0%: `onboardingComplete` was derived from `gender && dateOfBirth`, but signup seeds NOT-NULL **placeholder** defaults (`gender:'other'`, `dob:2000-01-01`) → gate read true | re-keyed `withDerivedUserFields.onboardingComplete` (+ RN `RootNavigator` fallback) off **firstName** (empty until onboarding Step 1; web sends it at signup) | ✅ API: mobile-style → `onboardingComplete:false`; web-style → `true`. Live: fresh signup now enters onboarding, returning/seeded users still go straight to Home |
| R3-6 | 🟡 **Onboarding Step 1 DOB field showed garbage** "01T00:00:0…" | mobile | `Step1Screen` formatted `data.dateOfBirth.split('-')` but the profile returns a full ISO ts (`2000-01-01T00:00:00.000Z`) → split mangled the time portion | normalise to date-only (`.split('T')[0]`) before `DD/MM/YYYY` formatting (applied to both `dobDisplay` and `dob`) | ✅ Android live: field now shows `01/01/2000` |

**Onboarding live walk (Android, fresh account):** Step 0 (Who are you registering for? — 6 options + icons), Step 1 (Basic Information — name/DOB/gender/height, DOB now clean, gender pills), Step 2 (Your Community — religion modal picker Hindu/Sikh/Muslim/Christian/Jain/Buddhist/Other, caste/sub-caste/gotra). Validation gating works (Step 2 blocks without religion). Modal pickers + step transitions crash-free (logcat clean). Steps 3–14 share the same `OnboardingLayout` (`SafeAreaView` + progress) — code-clean, not each tapped through.

**Known residual (noted, not fixed — needs migration/bigger change):** signup seeds placeholder `gender:'other'` + `dob:2000-01-01` (Profiles columns are NOT NULL), so Step 1 pre-selects "Other"/"01/01/2000" for new users; display is now clean but the placeholder still pre-fills (user can edit). Proper fix = make those columns nullable + a real `onboardingComplete` flag set at onboarding end. Also `onboardingComplete` still flips true after Step 1 (gender+dob+firstName all set there) — pre-existing gate limitation, unchanged.

Regression after round 3 (cont.): mobile `tsc` **0**; backend **unit 116/116** (auth/validators unaffected — name-required assertions are integration-only, need live DB); frontend untouched. Backend changes are additive + web-safe (web still sends names at signup).
