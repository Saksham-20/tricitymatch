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

## Phase 1 — Motion foundation: one source, correct tokens — DONE 2026-09-18

The highest-leverage phase. Nothing new is invented; §10.3 is enforced.

All 8 sub-steps done. Notable judgment calls made during the sweep (each documented inline where applied):
`PressableScale` under reduce-motion previously gave literally zero press feedback (scale locked, no opacity
substitute) — fixed to match ruling 18's own rationale, since the ruling existed for exactly this gap.
Several choreographed micro-sequences (typing-dot bounce, shimmer sweep, waveform pulse, splash loader pulse,
error shake, match-celebration pulse ring) don't map to any named interaction duration — kept as local named
constants with a comment rather than force-fit onto an unrelated bucket. Doctrine's own §10.3 claim that all
4 sanctioned loops are "opacity-only" was independently re-verified and found wrong for 3 of 4 (typing dots =
translateY, shimmer = translateX, waveform = scaleY) — corrected in the doctrine text itself rather than left
standing; not redesigned here (scope discipline — Phase 5 territory). `MatchCelebration`'s spring mapped to
`spring.momentum` (closest genuine-overshoot bucket) as RN's earned-celebration exception. Gates: mobile tsc
0 errors · mobile jest 57/57 · root lint 0 errors, 187 baseline unchanged.

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

## Phase 2 — Scale: the `Text` primitive and elder mode made real — DONE 2026-09-18

Built `components/ui/Text.tsx` (variant = the 11 `type` roles, curated 10-key `TextColor` union excluding
gold, `maxScale`, elder bump = ×1.15625 on every role — the same ratio as the web's `html.elder` 16→18.5px,
resolved internally via `useTheme()`). `utils/elderTheme.ts` slimmed to just `tapSize(elder)` (correctly
sourced off `tapTarget`); its dead `fontSize()`/`elderFontSize` (which operated on the wrong, unused
`typography.fontSize` scale) deleted. `ListRow.tsx` — the util's one importer — migrated onto the new
primitive as the pilot.

**2.3 adoption** ran as 9 parallel builder agents (91 files, every raw `<Text>` in `src/` except 3 documented
exceptions — `SmartImage`'s avatar-initial glyph, `TickRing`'s `CompletionRing` percentage glyph, and
`ProfileDetailScreen`'s `Animated.Text` floating header, none of which can safely route through a
non-forwardRef primitive or a fixed 11-role scale). Verified myself afterward, not just trusted the builders'
self-reports: grepped every file for leftover `fontSize:`/`fontFamily:`/`color:` that could silently override
the primitive (the #1 failure mode flagged in the builder brief) — every hit traced to a TextInput field, an
Ionicons glyph, dead/orphaned styling, or the 3 documented exceptions, zero real leaks. tsc 0, mobile jest
57/57, lint 0 errors (187 warnings, back to baseline after cleaning up import stragglers the migration
orphaned), slop-lint clean.

**Flagged, not "fixed" — genuine judgment calls for a design pass, not bugs:** `Logo.tsx`'s wordmark now
renders serif at lg/xl and sans at sm/md (no serif role exists below 22px); the admin console header and
several legal/contact page titles moved from sans-bold to serif Playfair (no large sans-bold role exists in
the canonical scale); `PhotoBlock.tsx`'s photo caption lost its deliberate `PlayfairDisplay-Italic` styling
(no italic role exists); `HomeScreen`'s rail-card name moved from 17px to 22px over a 166×226 photo tile
(mitigated by `numberOfLines={1}` + the card's own `overflow:'hidden'`, but worth a look at very large OS
text sizes). None of these are doctrine violations — every one followed the "map to the nearest canonical
role" rule — they're visible consequences of collapsing forked ad-hoc styling onto one real scale, which is
what this phase was for.

**2.4** — checked the plan's 4 named offenders directly: `Button.tsx`'s `sm` size and `FloatingTabBar`'s tab
item already used `minHeight` (safe, no clip risk); `HomeScreen`'s rail card is a fixed-aspect photo tile with
an absolutely-positioned, `numberOfLines`-guarded overlay (graceful degradation at extreme scale, not a hard
clip); "every list row" was already covered by the `ListRow.tsx` fix above. Then swept the whole app for
`height:` (not `minHeight`) literals wrapping actual text content: found and fixed 9 real risks — the
`selectBtn`/`optionBtn`/`yesNoBtn` pattern repeated across 8 onboarding steps (Step2–7, 9, 11) plus Step12's
`continueBtn`, all converted `height`→`minHeight`. Every other `height:` hit checked was a circular icon/avatar
container (`width === height`, correctly fixed) or a TextInput field (out of scope).

**2.5** — verified rather than rebuilt: the docked elder-mode tab bar already sources tap targets from
`tapTarget.elder` (`MainNavigator.tsx:126`), stack + tab navigation animation is already off for elder mode,
and the 2026-08-16 "Chat tab hides → CTA becomes a silent no-op" regression is still correctly guarded —
`MatchesScreen` hides the chat CTAs entirely under elder mode (with an inline comment explaining why) rather
than pointing them at a tab the navigator no longer mounts. No new code needed here.

**Not verified — genuinely needs a device/simulator, noted rather than skipped:** a live walk at maximum OS
text size in both themes/both platforms with elder mode on/off. Everything above was checked from source; the
visual judgment calls flagged two paragraphs up, and any real clipping the `height:`→`minHeight` sweep might
have missed, need actual rendering to confirm. Owed, same as other device-verification items in this
campaign.

---

## Phase 2 (original plan text)

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

## Phase 3 — Primitive adoption: press, targets, states — DONE (3.1–3.7, 3.9), 3.8 PARTIAL

The bulk of the campaign, and the reason the app currently looked like several products. 3.1–3.8 shipped as
8 gated, individually-committed slices on `design/rework-2026-09`. Each ran `tsc`/`npm test`/root `lint`
clean before commit; 3.4's 25-file migration additionally ran through a Workflow build+verify pipeline (25
build agents + 25 fresh-verify agents, 0 failures) with 5 of those agents personally re-verified by the
implementing session after a safety-classifier rate-limit.

**3.1 `PressableScale` replaces `TouchableOpacity` — DONE.** 232 uses across 57 files (`d7e718a`). Each
gained `accessibilityRole`, `accessibilityLabel`, `accessibilityState` where applicable, `hitSlop` under
44pt, and universal `pressRetentionOffset`. Found and fixed one pre-existing mislabel along the way
(`ReportsQueueScreen.tsx` Suspend button was announcing "Block user").

**3.2 Small targets declare themselves — DONE (`28995cd`).** `tap44-hitslop` `testID` marker adopted on
Home's notif-bell + "See all" link and onboarding's back/close/skip chrome (`OnboardingLayout.tsx` and
`Step12Screen.tsx`'s duplicated copy). `Button.tsx`'s `size="sm"` grew 38pt → 44pt instead of relying on
`hitSlop`, per the doctrine's own preferred remedy.

**3.3 The `Input` primitive becomes the only text field — DONE (`0e64ab8`).** 26 files migrated via a
Workflow pipeline; `OtpInput.tsx` and `SmartContactInput.tsx` deliberately excluded (structurally don't fit
a single-bordered-box shape — read in full before dispatch to avoid a forced-fit migration).

**3.4 The `Screen` shell gets its first importer — DONE (`a2467f1`).** 23 of 25 candidate screens migrated;
`PhotoGalleryViewer.tsx` and `ProfileDetailScreen.tsx` correctly left alone (deliberate full-bleed layouts
that render under the status bar and never hand-padded `insets.top` for their own shell — verified agents
caught this rather than forcing an ill-fitting wrap).

**3.5 `Card` declares elevation once — DONE (`b15bf38`).** `Card.tsx` and `FloatingTabBar.tsx` each dropped
their `borderWidth` (kept the shadow). `Button.tsx`'s primary/gold shadows now branch `isDark ? darkShadows
: shadows` instead of hardcoding the light-mode table in both themes.

**3.6 Eyebrows die — DONE (`2b994a0`).** `eyebrow` prop removed from `SectionHeader.tsx` (zero consumers
found on removal); `shared/src/constants/theme.ts`'s `letterSpacing.eyebrow` deleted (zero consumers across
web+mobile); all 12 hand-rolled `textTransform: 'uppercase'` micro-labels stripped.

**3.7 Gold gets its meaning back — DONE (`74f9b8c`).** The 75–89% compat-score gold band in all 5 named
files (Home/Matches/ProfileDetail rails, `TickRing`, `ProfileCard`) now reads `c.accent`; the low band moved
off a hardcoded static `colours.p500` onto theme-reactive `c.textMuted` in the same edit (closes a
light-palette-in-component violation on the same line).

**3.8 `ListRow`, `Badge`, `Chip`, `IconButton` — PARTIAL (`7ea338c`).** `ListRow` and `Chip` both used
`TouchableOpacity` internally (the primitives themselves shipped the banned pattern) — fixed to
`PressableScale`. `ListRow` extended with `sublabel`/`iconColor` to match the settings-row shape the app
actually needs, then `SettingsScreen`'s local 25-usage `SettingRow` duplicate was deleted in favour of the
shared primitive (its first real importer). `IconButton` already used `PressableScale`, no fix needed.
**Not done:** a broader sweep for `Badge`/`Chip`/`IconButton` duplicates elsewhere in the app was censused
and found low-yield — most candidate sites (composer send buttons, avatar circles, branded CTA pills) are
semantically distinct branded elements, not settings-row/status-pill duplicates, and forcing them into the
existing primitives' APIs without extending those APIs first would be a forced fit, not an adoption. Left
open for a follow-up pass with its own scoping, rather than churned blind.

**3.9 Every screen ships four states — DONE in code 2026-09-21 (commit below), device pass owed.**
Census first: loading skeletons and empty states mostly existed already; the systematic gap was the
**error branch** (`isError` never destructured or never rendered on ~17 query screens, so a failed fetch
rendered as zeros, a blank form, or a fake "empty" list). Correction to the earlier note: `NotificationsScreen`
was *not* at zero coverage (it had a skeleton and an empty component; only error was missing).
Shipped via a Workflow build+verify pipeline over 26 screens (17 with known gaps + 9 believed compliant, all
26 needed at least an error/guard/copy fix), 3 of 26 failed their first fresh verify and were fixed by hand:
`AstrologerDetailScreen` (generic list skeleton over a centered-profile layout: replaced with an in-file
`SkeletonBlock` skeleton that matches), `MatchesScreen` (empty states had no action; shortlist "Try again"
was a silent no-op offline; em dash in copy), `ChatThreadScreen` (new thread empty-state i18n keys collided
with `ConversationsScreen`'s `chat.emptyTitle/emptyAction`: renamed `chat.threadEmpty*`).
The pattern, now uniform: `EmptyState variant="error"` + "Couldn't load <noun>" / "Check your connection and
try again." / "Try again" → `refetch()`, shown only when `isError && no cached data` so a failed background
refetch never blanks a list; testID `<Screen>-error`; error branches placed after every hook (rules of hooks).
Also fixed: `OnboardingContext.saveAndNext` swallowed save failures and advanced anyway ("backend syncs on next
open" was false, nothing re-sends), silently dropping a step's answers; it now toasts and stays on the step,
Continue is the retry (covers all 11 onboarding steps in one place).
**Deliberately left / known follow-ups:** `DiscoverCards` (3 decorative queries, silent-omit by design);
`MatchesScreen` `liked_me` for a client-side-premium/server-403 mismatch shows a retryable error that will
keep 403ing (not distinguished from transient); no `onlineManager`/NetInfo wiring, so a first fetch paused
offline shows the skeleton until reconnect (and the shortlist tab shows the empty card for ~3s of retries);
`ChatThreadScreen`'s loading branch has no header/back button (pre-existing). Doctrine §10.10 wants every
state *seen on a device*: not done, folded into the Phase 6 sim sweep.

**Phase 3 closing census (2026-09-21), DOCTRINE §10.11 greps over `mobile/src`:**
`<TouchableOpacity` **0** (was 232) · `textTransform: 'uppercase'` **0** · raw `<TextInput` only in
`OtpInput`, `SmartContactInput` and `SearchScreen`'s search bar (all three deliberate: none fits `Input`'s
single-bordered-box shape). The census found things earlier phases had marked done or missed, fixed the same day:
`Switch.tsx` **still imported core `Animated`** although Phase 1.5 was recorded as done (now Reanimated + token
duration + reduce-motion; note `ui/Switch` has no consumers, `ListRow` and `PrivacySettingsScreen` use RN's
native `Switch`); light `shadows.*` without an `isDark` branch in `SubscriptionScreen` plan cards, `toastConfig`,
`GoldLock`; gold on non-premium things beyond the five named files (`VerificationScreen` trust ring/percent/
"why verified" panel, both Shortlist buttons, the `PasswordStrength` meter's third segment) → `c.accent`/neutral;
two literal ALL-CAPS eyebrow labels (`STATUS`, `WHY GET VERIFIED`) plus `TickRing`'s default `'COMPLETE'` that a
`textTransform` grep cannot see, and leftover `letterSpacing` on them; `✓`/`✕` text glyphs used as icons
(`PrivacySettingsScreen`, `Step10Screen`) → Ionicons. **Left open, not Phase 3:** `Alert.alert` is still **60
uses in 19 files** (ruling 22: destructive confirmation only; errors/successes must be toast or inline) and no
later phase currently owns triaging them, so it needs an explicit owner before Phase 5; `MatchCelebration`'s gold
seal (celebration, not on the doctrine's score/meter/free-tier/text list, left as-is); plan-card border+shadow on
`SubscriptionScreen` (selection border is a state indicator, left).

**Gates:** tsc, tests, lint, and each sub-step audited by a fresh agent against §10.11 before the next
starts — met for 3.1–3.8 via the Workflow verify stages (3.1, 3.3, 3.4) or direct gate runs (3.2, 3.5, 3.6,
3.7, 3.8, 3.9). The Phase 3 closing full-doctrine audit (§10.11) and 3.8's deferred Badge/Chip/IconButton
sweep remain before Phase 4.

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
