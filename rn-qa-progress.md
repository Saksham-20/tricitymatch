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
