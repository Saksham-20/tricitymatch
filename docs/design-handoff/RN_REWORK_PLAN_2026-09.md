# TricityMatch RN Mobile UI/UX Rework — Plan (2026-09-18)

Planning lead: Opus. Implementation: one phase at a time, each independently audited.

**Inputs this plan is built on** (read them, do not re-derive):
- `DOCTRINE_2026-09.md` — the operating law, and especially **§10**, the mobile translation. Binding.
- `UIUX_REWORK_PLAN_2026-09-17.md` — the web campaign this mirrors. Its "Standing rules" section applies here
  with the substitutions in §10.
- `COMPETITOR_RESEARCH_2026-09-17.md` — Shaadi / Jeevansathi / BharatMatrimony, Sept 2026. Its M10 (floating
  pill — "we already ship it on RN"), M18 (swipe/stack — reject, it reads as a dating app) and the
  Betterhalf.ai finding (web abandoned, **app-only**, Play listing a year stale) are the mobile-relevant rows.
- `mobile/AGENTS.md` — the stack. **Not** the root `CLAUDE.md`, whose Mobile section is stale.
- CLAUDE.md audit history 2026-08-16, 2026-08-19 ×2 — what has already shipped on RN. Do not re-propose it.

**Method.** The same one that worked on web, because it is the only reason the web campaign found anything:
build the slice, then a **fresh agent with no memory of the build** re-reads §10 and the changed files cold
and reports pass/fail with `file:line`. Fix only what fails, then re-verify live. In the web campaign's final
sweep, **all ten** independently-audited groups failed their first audit. Assume the same here.

**One amendment to that method, taken from HomeKrafted's `docs/M29-MOBILE-PLAN.md`.** That plan's headline
finding was **false**: the CSS rule was real, its arithmetic was right, and nothing rendered it — caught in
about ten seconds by opening the deployed page, *after the fix had already shipped*. Its lesson is this
plan's governing rule:

> **A defect found by reading source is a hypothesis until a rendered screen confirms it.**

Every `[inferred]` item below carries the command that settles it. Nothing marked `[inferred]` is fixed
before it is seen.

---

## The thesis

**The RN app has the same disease the web had, further along.** The web thesis was "the design system is
good, documented, and unused." Here the primitives exist, are well written, and are close to **dead**:

| Primitive | Real uses | What is used instead |
| --- | --- | --- |
| `Input` | 3 uses, 1 file | raw `<TextInput>`: **50 uses, 29 files** |
| `Button` | 11 uses, 7 files | hand-rolled `TouchableOpacity` |
| `Card` | 5 uses, 2 files | inline card styles |
| `EmptyState` | 4 uses, 3 files | hand-rolled empties |
| `ListRow`, `Badge`, `Chip`, `IconButton` | **0** | inline everything |
| `components/layout/Screen.tsx` | **0 importers** | 28 files hand-rolling insets |
| `utils/elderTheme.ts` | 1 importer (`ListRow`), which has 0 users → **transitively dead** | — |

Press feedback tells the same story: `<TouchableOpacity>` 232 uses / 60 files against `<PressableScale>`
59 / 26. Motion tells it again: 23 files use Reanimated, 13 import the motion tokens.

**So this is adoption, scale, and truth — not a re-skin.** The palette, the brand, the copy law and the
product decisions are settled and carry over from the web doctrine untouched. What is missing on RN is
(a) the primitives actually being used, (b) a type scale that survives elder mode and OS Dynamic Type, and
(c) four screens' worth of states that were never built.

**What is already done and is not re-proposed:** the `makeStyles(c)` dark-mode sweep (verified — only 2
colour literals remain in module scope, `PickerSheet.tsx:88` and `Switch.tsx:48`; `DEFAULT_DARK_MODE_OVERRIDE`
is correctly `null`), the floating pill tab bar, the journey/chapter onboarding, skeletons, toasts,
`SmartImage`, the safe-area unification, `PressableScale` / `useReduceMotion` / `StaggeredEntrance`, and the
gorhom v5 filter sheet.

---

## Owner decisions — RESOLVED 2026-09-18

The web plan took four owner decisions up front. These are now decided; §10's rulings 21/22 reflected the
recommended answers already, so only two required an edit (both already matched).

1. **Elder mode: a real scale, or the tab-bar toggle it is today?** → **Real scale.** Phase 2 builds the
   `Text` primitive and adopts it across every screen — the largest diff in this campaign, taken deliberately
   because the RN app otherwise never satisfies doctrine §9/§10.10 "themes and scales". Matches the web's
   `html.elder` decision.
2. **Does the RN funnel mirror the web's one-field-first signup gate (web Phase 4)?** → **Not prejudged.**
   Phase 5 Group E audits the current funnel against doctrine with evidence and decides then, rather than
   assuming it needs a rebuild before anyone has looked.
3. **Radius: web's 12/16 scale, or RN's native 10/14/20/28?** → **RN keeps its own scale** (§10 ruling 21,
   confirmed as proposed).
4. **Is `Alert.alert` sanctioned?** → **Yes, destructive confirmation only** — never an error or success
   channel (§10 ruling 22, confirmed as proposed). Errors move to toast/inline state; successes to toast.
5. **Scope.** → **Member surfaces only**, mirroring the web campaign. Admin (3 screens) and the calls stack
   (3 screens) are deferred.
6. **i18n.** → **Its own pass, not this campaign.** §10.10 only requires that *existing* hi/pa strings don't
   clip; closing the 32-screen English gap is separate work.

**Can be answered during the phase they belong to:**

7. **`RevealOnScroll` on ProfileDetail** — an Operate surface, where §1 permits motion for feedback and
   continuity only. It is well built (UI thread, fires once, reduce-motion static) and breaches only the
   16px translate cap (it moves 20). Keep-and-clamp, or delete?
8. **`usePop(peak = 1.3)`** on the like/shortlist tap — a 1.3× overshoot on a non-gestural tap, against §4.4.
   The earned rare-tier exception, or retune to 1.12 with no overshoot?
9. **The pill tab bar's blur.** `FloatingTabBar.tsx:4-5` claims "iOS gets real blur"; the file contains no
   `BlurView`. Ship the blur, or correct the comment? Either way it needs a reduce-transparency fallback.
10. **Token location.** `shared/` currently has **zero** importers in `frontend/src` — it is RN-only in
    practice. Do the corrected motion tokens stay in `shared/src/constants/motion.ts` or move to
    `mobile/src/constants/`?
11. **Verification hardware.** §10.4 and `animate-expo` both say feel is judged on a **release build on the
    slowest supported device**. Per the 2026-08-16 entry, `eas init` still cannot run (`projectId` is the
    literal `tricityshadi-app`) and there is no Apple Developer account. If Phase 6 is simulator-only, that
    is written down as a known limitation, not discovered afterwards.

---

## Phase 0 — Truth and live money bugs (ship first, same day) — DONE 2026-09-18

Not design. One of these takes real money through live Razorpay against prices we do not sell.

All 6 items fixed and verified against real source before editing (each `file:line` re-read, not assumed
from the report). Gates: mobile `tsc` 0 errors · mobile jest 57/57 · root lint 0 errors (187 pre-existing
warnings, unchanged baseline, none in touched files were introduced by this pass). Not yet device-verified
(that's Phase 6's job); 0.1 in particular still needs a live check with the plans endpoint forced to fail.

| # | Defect | Evidence | Fix |
| --- | --- | --- | --- |
| 0.1 | 🔴 **The paywall falls back to a catalogue we withdrew.** If `GET /subscription/plans` fails or returns empty, the screen renders the full static ladder — Basic ₹1,299, Premium ₹2,499, Elite ₹3,999, VIP ₹5,999, NRI ₹9,999 — against a live catalogue of one ~₹1,199/90d plan. `isError` is **never destructured** (0 occurrences in the file), so the static ladder *is* the error state. The screen's own comment at `:601-604` says this exact fallback was removed; it was removed per-card and left at the list level. This is the web's Phase-0 defect 0.1, still live on RN. | `features/subscription/SubscriptionScreen.tsx:550` and `:389-393` | Delete the `?? Object.values(PLANS)`. Render loading, empty and **error** states. Reuse the `plansLoading` shape already present at `:598-600`. Never fall back to a static catalogue (§10.9). |
| 0.2 | **Content sits under the floating tab bar on every Face-ID iPhone.** `TAB_BAR_CLEARANCE = 92` is flat; the pill's real height is `max(insets.bottom, 12) + 8 + 52 + 8` = **102** when `insets.bottom = 34`. All five tab screens consume it. | `components/navigation/FloatingTabBar.tsx:25,55,110-135`; `hooks/useTabBarClearance.ts:11`; consumers: Home, Search, Matches, Conversations, OwnProfile | Compute from insets, per HomeKrafted's `mobile/src/components/dock.ts`. Write the arithmetic into the comment so it cannot silently drift again. |
| 0.3 | **Double haptic on every tab press.** The navigator's `screenListeners` and the custom tab bar's `onPress` both fire `haptics.light()`. Violates §10.4's "one per committed user action". | `navigation/MainNavigator.tsx:138`; `components/navigation/FloatingTabBar.tsx:67` | Keep one. The custom bar's, since elder mode does not use the custom bar and needs the navigator's. |
| 0.4 | **Tabs slide.** `animation: 'shift'` on the tab navigator — the pattern §10 names explicitly. | `navigation/MainNavigator.tsx:136` | `'none'`. |
| 0.5 | **Three comments that describe things the code does not do.** (a) `FloatingTabBar.tsx:4-5` claims "iOS gets real blur"; there is no `BlurView` in the file, `:118` is `c.surfaceCard + 'F2'` on both platforms. (b) `haptics.ts:1-2` claims expo-haptics "is NOT a declared dependency"; it is, `package.json:38`. (c) root `CLAUDE.md:84` says "Expo SDK51 · RN 0.74.5"; actual is SDK 52 / RN 0.76.9. | as cited | Make each true or delete it. A stale doc is how the web campaign's phantom "pre-existing lint failure" survived three passes. |
| 0.6 | **Six sites use a green that is documented as unreadable in dark mode.** `colours.success` (`#2E7D32`) as a compatibility-score colour and as the Switch "on" fill. `shared/src/constants/theme.ts:221` documents `darkColours.successAccent` as existing precisely because *"darkColours.success is unreadable as an accent on surfaceCard"*. | `HomeScreen.tsx:50`, `MatchesScreen.tsx:50`, `ProfileDetailScreen.tsx:56`, `TickRing.tsx:131`, `ProfileCard.tsx:52`, `Switch.tsx:34` | Take the colour from `useTheme()`. Rolled into 1.5 if not done here. |

**Gates:** `node_modules/.bin/tsc --noEmit -p tsconfig.json` from `mobile/`, `npm test` (jest 29, local),
`npm run lint`. Then **0.1 verified live on a device against prod**, signed in as the free QA account, with
the plans endpoint forced to fail. Not verified in source.

---

## Phase 1 — Motion foundation: one source, correct tokens

The highest-leverage phase. Nothing new is invented; §10.3 is enforced.

**1.1 Rewrite `shared/src/constants/motion.ts`** to §10.3: `EASE_OUT`/`EASE_IN_OUT`/`EASE_DRAWER`, the full
`duration` table, Apple two-parameter `spring` configs, `STAGGER_MS`. **Delete** `easing.in` (ease-in is
banned on UI) and `easing.spring` (`[0.34,1.56,0.64,1]` is a back-out overshoot bézier — springs are springs).
`duration.slow` at 360 exceeds the sub-300ms ceiling and does not survive the rewrite.

**1.2 Retune the motion primitives** in `components/motion/` against the new tables:
`PressableScale` (`spring.pop` → `spring.press`), `StaggeredEntrance` (40ms → 50ms stagger, cap 6 is already
right), `useFillAnimation`, `useShake`, `usePop` (pending open question 8), `TabIcon`.

**1.3 Bring the 10 hand-rolling files onto the token file.** `ChatThreadScreen.tsx:84-86`,
`SplashScreen.tsx:40-41`, `CompatibilityBreakdownSheet.tsx:42`, `MatchCelebration.tsx:47`,
`AudioIntroChip.tsx:43,51`, `SmartImage.tsx:61`, `useShake.ts:20-24`, `RevealOnScroll.tsx:44-47`,
`OnboardingLayout.tsx:68`, `Skeleton.tsx:36`. Every `Easing.inOut(Easing.quad)` and every literal `duration:`
goes.

**1.4 Add the three missing variants** so no screen hand-rolls them again: `useSheet`, `useToast`,
`useListRow`.

**1.5 Retire core `Animated`.** `components/ui/Switch.tsx` is the last file importing `Animated` from
`'react-native'`. Move to Reanimated.

**1.6 Fix the one animated layout property.** `OnboardingLayout.tsx:185` `progressFill` animates `width` on an
**in-flow** child of `progressTrack`. The §10.4 exception requires absolute positioning and no children;
make it absolute (`left/top/bottom: 0` + width), which also keeps the pill radius that `scaleX` would smear.

**1.7 Add `useReduceTransparency()`** beside `useReduceMotion()` and wire it to `GoldLock`'s `BlurView`
(`GoldLock.tsx:51`), the pill's `F2` alpha (`FloatingTabBar.tsx:118`) and every scrim. The app currently
subscribes to `reduceMotionChanged` only.

**1.8 Confirm the four sanctioned loops and ban a fifth.** `Skeleton.tsx:36`, `ChatThreadScreen.tsx:82`,
`SplashScreen.tsx:38`, `AudioIntroChip.tsx:41` — all opacity-only, reduce-motion-gated, cancelled on unmount.
**Verified, not assumed.** They stay; a fifth needs a written reason.

**Gates:** tsc, tests, lint, plus a live walk of Home / Search / Chat / Subscription with Reduce Motion **on**
and then **off**, both platforms.

---

## Phase 2 — Scale: the `Text` primitive and elder mode made real

**Blocked on owner decision 1.** The riskiest phase and the one with the largest diff; it goes second so
everything after it is built on the right foundation.

**2.1 `useTheme()` returns `{ isDark, c, elder }`.**

**2.2 Build `components/ui/Text.tsx`**, modelled on HomeKrafted's `mobile/src/components/Text.tsx`: a
`variant` from the `type` roles (`shared/src/constants/theme.ts:81-93`), a `color` from a **curated union
that omits gold**, an optional `maxScale`, and the elder bump resolved internally. Keeping
`allowFontScaling` on is the rule; capping it is the exception, and the cap's presence declares that the row
is height-constrained.

**2.3 Adopt it.** Every `<Text>` in `src/` goes through it. `utils/elderTheme.ts` either becomes its engine
or is deleted; it has one importer, which itself has no users.

**2.4 Audit fixed heights against 200% type** and fix what clips: `Button.tsx:46` (sm 38),
`FloatingTabBar.tsx:133,136` (52pt item, 10pt label), `HomeScreen.tsx:373` (rail card 226), every
`minHeight` in the settings and list rows. Where a height must be dynamic, `onLayout` measures it.

**2.5 Elder mode does the rest of its job:** targets from `tapSize(elder)` (48/60), docked tab bar,
navigation animation off. **Any tab it hides must stay reachable and every CTA pointing at it must still
work** — this was a live no-op bug fixed 2026-08-16 and the rule exists so it does not return.

**Gates:** tsc, tests, lint, plus a full walk at **maximum OS text size** in both themes, both platforms, with
elder mode on and off. This is the first time anybody will have looked at this app at 200% type.

---

## Phase 3 — Primitive adoption: press, targets, states

The bulk of the campaign, and the reason the app currently looks like several products.

**3.1 `PressableScale` replaces `TouchableOpacity`** — 232 uses across 60 files. Each gains
`accessibilityRole`, `accessibilityLabel`, `accessibilityState` where it has one, `hitSlop` where the visual
is under 44pt, and `pressRetentionOffset`. `hitSlop` appears in 5 files today; `pressRetentionOffset` in zero.

**3.2 Small targets declare themselves.** Adopt the `tap44-hitslop` `testID` marker (§10.8), because
`hitSlop` is invisible to the accessibility tree and to any sweep. Known offenders:
`HomeScreen.tsx:348` (`bellBtn` padding 4 around a 24pt icon → 32pt), `HomeScreen.tsx:219` ("See all",
text-only), `OnboardingLayout.tsx:169-171` (back / close / skip at 40×40), `Button.tsx:46` (`size="sm"` 38).

**3.3 The `Input` primitive becomes the only text field.** 50 raw `<TextInput>` across 29 files. This is why
label, helper and error treatment differ screen to screen.

**3.4 The `Screen` shell gets its first importer.** 28 files hand-roll `useSafeAreaInsets`.

**3.5 `Card` declares elevation once.** `Card.tsx:21,33-36` has `borderWidth: 1` **and** `shadows.e2/e3` —
the §3.4 ghost card, in the component every card inherits from. Same at `FloatingTabBar.tsx:110-127`.
`Button.tsx:151,157` hardcodes light-mode shadows in both themes.

**3.6 Eyebrows die.** Remove the `eyebrow` prop from `SectionHeader.tsx:9,28,57-62`, delete
`shared/src/constants/theme.ts:120-121`'s `letterSpacing.eyebrow`, delete the 15 hand-rolled
`textTransform: 'uppercase'` micro-labels.

**3.7 Gold gets its meaning back.** Gold currently marks a 75-89% compatibility score in five files
(`HomeScreen.tsx:50`, `MatchesScreen.tsx:50`, `ProfileDetailScreen.tsx:56`, `TickRing.tsx:131`,
`ProfileCard.tsx:52`) and a `SectionHeader` eyebrow. After this phase gold means premium and nothing else —
the same fix the web made in its Phase 1.7.

**3.8 `ListRow`, `Badge`, `Chip`, `IconButton` go from zero importers to being the only way those things are
built.**

**3.9 Every screen ships four states.** `EmptyState` has 4 uses in 3 files; `SkeletonBlock` has 43 uses in 5
files. The screens with neither, from the census: `ChatThreadScreen` (14 `TouchableOpacity`, no empty, no
error), `SubscriptionScreen` (no empty, no error — see 0.1), all 11 onboarding steps, `EditProfileScreen`,
`SettingsScreen`, `NotificationsScreen`, the family-group screens.

**Gates:** tsc, tests, lint, and each sub-step audited by a fresh agent against §10.11 before the next starts.

---

## Phase 4 — Chrome: sheets, lists, navigation

Small, mechanical, high user-visible payoff.

**4.1 One sheet mechanism per job** (§10.7). Three coexist: gorhom (1 file), RN `<Modal animationType="slide">`
(21 `<Modal>` across 18 files), and hand-rolled `TouchableOpacity` backdrops (`SearchScreen.tsx:97,140`).
Retire the hand-rolled ones. **Verified while looking:** RN `<Modal>` renders in its own native window above
the absolutely-positioned pill, so it does **not** need `uiStore.bottomSheetOpen`; only gorhom does
(`FilterPanel.tsx:272-277` is the reference).

**4.2 Configure every long list.** 20 `FlatList`s, **one** `getItemLayout`, zero `windowSize` /
`maxToRenderPerBatch` / `removeClippedSubviews` / `initialNumToRender`. On a mid-range Android this is the
main jank source in a browse product, and no screenshot will ever show it.

**4.3 Navigation options** reviewed against §10.4: `animation: 'none'` on tabs, `'fade'` (not `'none'`) under
reduce motion outside elder mode, `presentation: 'modal'` only where a screen is genuinely a takeover.

**4.4 The pill's blur question** (open question 9) resolved one way or the other, with its
reduce-transparency fallback.

---

## Phase 5 — Screen-by-screen §10.10 pre-flight

Five independent groups, each built then audited cold by a different agent. Based on the web campaign, expect
**every group to fail its first audit**.

| Group | Screens | Known going in |
| --- | --- | --- |
| **A — Money** | Subscription, payment history, unlock bundles, `GoldLock` gates | 0.1's aftermath; the premium gate must never fake a count or a photo; gold audit |
| **B — Browse** | Home, Search + `FilterPanel`, Matches, `ProfileCard`, `DiscoverCards` | Photoless profiles (the web's Phase 5 finding — check whether RN has the same void); list perf; all four states |
| **C — Detail and chat** | ProfileDetail + `detail/*`, ChatThread, Conversations, family groups, `BlockReportSheet` | `ChatThreadScreen` is 1,247 lines with 14 `TouchableOpacity`, no empty and no error state; `RevealOnScroll` ruling; composer + keyboard behaviour |
| **D — Identity** | OwnProfile (1,102 lines), EditProfile, Verification, Settings, Privacy, Guardian, Support | `SettingsScreen` is one of only two files that know elder mode exists; `OwnProfileScreen` has 13 `TouchableOpacity` |
| **E — Funnel** | Welcome, Login, CreateAccount, Basics, `OnboardingLayout`, Steps 2-12, JourneyFinale | Blocked on open question 2; 40×40 chrome buttons; zero states across all 11 steps; `LoginScreen` has 9 `TouchableOpacity` and 0 `PressableScale` |

Each group's audit uses §10.10 in full, on a device, with Reduce Motion, Reduce Transparency, maximum text
size, dark mode, elder mode, VoiceOver and TalkBack all exercised. Findings carry `file:line`.

---

## Phase 6 — Verification and close

**6.1 Build the sweep instrument.** Port HomeKrafted's `mobile/scripts/sim-sweep.mjs` shape: walk every route
by deep link, read the accessibility tree, assert per screen that (1) it rendered rather than sitting on a
loading line, (2) every control is reachable **by accessibility label** and measures ≥44pt or carries the
`tap44-hitslop` marker, (3) the signed-out state offers a door rather than a wall. Our existing `idb`/`adb`
harness (`docs/QA.md`, `rn-qa-progress.md`) is the driver. Method notes that cost time before and are written
down for the next person: **a Metro reload resets a debug build to its initial route** — a "screen didn't
open" can be that, not a bug; **React Query's cache survives Fast Refresh** — force-stop and relaunch before
believing a redbox; **idb wants POINTS, screenshots are PIXELS, divide by 3**.

**6.2 Full §10.10 pre-flight per screen**, both platforms, release build if the hardware exists (open
question 11) and a written limitation if it does not.

**6.3 Update `PROGRESS.md`, the CLAUDE.md audit history, and `mobile/READINESS.md`.** Correct root
`CLAUDE.md:84`'s stale stack line in the same commit.

---

## Explicitly not doing

- **A navigation-library migration.** Expo Router, `NativeTabs`, `presentation: 'formSheet'`, `Link.Menu`,
  `headerLargeTitleEnabled` are all `animate-expo` recommendations and all Expo Router APIs. §10 ruling 17:
  principles bind, packages do not.
- **New animation dependencies.** No `react-native-keyboard-controller`, no `lottie-react-native`, no
  `@shopify/react-native-skia`, no Moti. `KeyboardAvoidingView` stays.
- **Reanimated 4 / New Architecture.** A runtime migration, not a design campaign. It is also blocked by
  React 19 (held in the root dependency ledger as `[mobile-blocked]`).
- **Swipe-to-decide card stacks.** Competitor research M18: the gesture families read as "dating app".
  Rejected for web; rejected here for the same reason.
- **Re-doing the dark-mode sweep.** It is real. Verified: 2 colour literals remain in module-scope styles.
- **Re-deriving the palette, brand, pricing or copy law.** Settled; carried from the web doctrine.
- **The bureau stack.** Deleted 2026-08-19.
- **Store-listing screenshots / `imagegen-frontend-mobile`.** Out of scope; an owner-level decision of its
  own.

---

## Standing rules for every implementing agent

1. **§10 outranks your taste.** Read §10.2, §10.3, §10.10 and §10.11 before touching a file. If a change needs
   a rule broken, stop and say so; do not quietly break it.
2. **Adopt, do not invent.** `Screen`, `Text`, `Button`, `Input`, `Card`, `EmptyState`, `SkeletonBlock`,
   `ListRow`, `Badge`, `IconButton`, `PickerSheet`, `PressableScale` already exist. A new component needs a
   reason an existing one cannot serve.
3. **All motion comes from `shared/src/constants/motion.ts`.** No hand-rolled curve, no literal duration, no
   `Easing.inOut(Easing.quad)`.
4. **Every screen ships four states.** Default, loading skeleton, empty, error. Premium views add the locked
   state. A `useQuery` whose `isError` is never rendered has an invisible error state.
5. **No fabricated data, ever** — not a count, not a price, not a plan, not a person, not an offer. This has
   already gone wrong twice on this app (the astrologer marketplace's four invented practitioners, the
   subscription ladder). It is the product's entire value proposition.
6. **A source-read finding is a hypothesis.** Confirm it on a rendered screen before fixing it, and say which
   one you opened.
7. **Gates before done:** `node_modules/.bin/tsc --noEmit -p tsconfig.json` and `npm test` **from `mobile/`**
   (the `tsc` on PATH is v4; the root hoists jest 30 while mobile pins 29), `npm run lint`, and the screen
   seen on a device in both themes. Report what you actually ran.
