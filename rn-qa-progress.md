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
