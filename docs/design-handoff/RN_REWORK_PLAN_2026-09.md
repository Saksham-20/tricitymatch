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
sweep remain (Phase 4 has since shipped, 2026-09-21).

---

## Phase 4 — Chrome: sheets, lists, navigation — DONE 2026-09-21

Small, mechanical, high user-visible payoff. Gates: mobile tsc 0, jest 57/57, root lint 0 errors with the
mobile warning count unchanged at 182, slop-lint clean.

**4.1 One sheet mechanism per job** (§10.7). Rule applied: draggable/detented → gorhom (`FilterPanel`),
full-screen takeover → native-stack `presentation:'modal'`, single-select → the `PickerSheet` primitive.
`SearchScreen`'s sort sheet and `SettingsScreen`'s language picker were the hand-rolled `TouchableOpacity`
backdrops; both are now `PickerSheet`. **Deliberately kept:** the form/confirm RN `<Modal>` sheets (delete-account
confirm, report/block, note entry etc.). They own text inputs; converting them to gorhom reintroduces the
keyboard-avoidance and closed-backdrop-swallows-touches failure already hit once (2026-08-19, Search touch-dead),
for no gain. RN `<Modal>` renders in its own native window above the pill so it needs no `bottomSheetOpen`.

**4.2 Every long list configured.** New `mobile/src/constants/listPerf.ts`: `LIST_PERF` (initialNumToRender 8,
maxToRenderPerBatch 6, windowSize 7, `removeClippedSubviews` Android-only) and `CHAT_LIST_PERF` (bigger window;
no clipping on inverted lists, where it misplaces rows). Spread into 15 FlatLists: Conversations, ChatThread,
FamilyGroupChat, FamilyGroups, VerificationQueue, ReportsQueue, Matches, Search, AstrologerMarketplace,
GuardianView, GuardianCandidates, SuccessStoriesBrowse, Notifications, Step11, `PickerSheet`. **Not done, on
purpose:** `getItemLayout` (rows are not truly fixed-height: wrapped names, optional badges, elder-mode type
scale; a wrong layout is worse than none). Horizontal rails (few items) are exempt. Note for Phase 5 group C:
`ChatThreadScreen` still has an `entering` animation on a virtualized row.

**4.3 Navigation options.** Tabs stay `animation:'none'` (tabs never slide). `MainNavigator` now computes
`elderMode ? 'none' : reduceMotion ? 'fade' : <platform default>` through one `anim()` helper for the stack,
both `presentation:'modal'` screens (Subscription, SuccessStory) and the journey `Stack.Group`. Reduce Motion
previously still slid; elder mode keeps `'none'` per ruling 18. `AuthNavigator` sets no `animation` so it
inherits the OS default; left alone. Both modals are genuine takeovers (checkout, story submit).

**4.4 The pill's blur — decided: no blur** (open question 9). At ~95% opacity a blur is invisible, and a live
blur costs a compositing pass per scroll frame on mid-range Android. Reduce Transparency already forces an
opaque `c.surfaceCard`. The false "iOS gets real blur" claim is gone from the file header, replaced by the
decision.

---

## Phase 5 — Screen-by-screen §10.10 pre-flight — DONE at source level 2026-09-24 (NOT seen on a device)

Nine file groups (A money, B browse, C1 detail, C2 chat, D1 identity, D2 settings/legal/guardian, E1 auth, E2a and
E2b onboarding) each ran **build → cold audit by a fresh agent → fix → cold re-audit** (36 agents, one Workflow run).
No simulator was booted, so per standing rule 6 everything below is a source-read finding; the device pass is Phase 6.
**As the campaign predicted, every group failed its first audit** (10 to 19 findings each). After the fix pass five
groups re-audited clean of critical/major findings (C1, C2, D2, E2a, E2b); four still held one or two majors
(A, B, D1, E1), which were closed by hand afterwards and verified in source. Minor findings that remain are listed
below, not hidden.

**Alert.alert triage (ruling 22): 60 uses in 19 files → 23 in 14 files**, of which 7 are the deferred admin screens
and 1 is a comment. Every remaining member-surface use is a confirmation (discard, remove, leave, revoke, block,
sign out, unlock a phone number, delete a message). Choices became `PickerSheet`, errors became toast or inline
state with an announcement, informational notices became inline.

**Real bugs found and fixed** (not polish):
- **Email sign-up was uncompletable on mobile.** The server sends a 6-digit code to an email and 4 to a phone;
  `OtpInput` was hard-coded to 4 boxes and auto-submitted at 4, so an email code could never verify. `OtpInput` now
  takes `length` (6 for email, same split as the web); boxes flex and cap at 52pt so six fit a 320dp screen; copy
  parametrised with `{{digits}}` in en/hi/pa and the helper under the field no longer says "4-digit" before the kind
  is known.
- **Liked Me Decline did nothing visible.** `getLikes` returned every like aimed at the member, answered or not, so
  the refetch brought the same row back while the screen announced "Interest declined". The endpoint now also
  returns `myAction` per liker (additive: `like` | `pass` | `shortlist` | null, one extra query over the page's
  liker ids); the screen hides declined rows, swaps Accept/Decline for a chat button on accepted ones, shows
  "You're all caught up" when everyone is answered, and a like or pass made from Search or a profile refreshes the
  list. A local map still covers taps before the refetch lands and an older server. **Needs the backend deployed.**
- **Search and ProfileDetail like/shortlist never refreshed Matches**, which caches the shortlist for 30 minutes.
- **`DELETE /auth/account` was sent without the password and always 400ed** from the shared `deleteAccount()`;
  Settings had worked around it inline. Moved into `api/auth.ts` as `deleteAccount(password)`.
- **Login biometric sign-in could never succeed**: `logout()` and a failed `initialize()` both delete the stored
  refresh token, so a signed-out device has nothing for a Face ID check to exchange. Removed from Login, and the
  Settings switch that promised "Sign in without typing your password" (nothing read it) was removed with it.
- **`getPlans()` returned the entire static catalogue at regular prices** whenever the server sent no plans, and
  inherited the regular ladder's MRP strike-through for a live plan that carried none. Both fabrications are gone; an
  empty list renders the screen's existing "No plans available" state.
- **Fabricated or unsupported claims removed**: the astrologer duration price table (the app listed 15/30/45/60 min,
  the website sells 10/15/30/45) is now one true per-minute rate; "Vedic astrologer" hardcoded on every practitioner;
  quiz "Better match suggestions" and "Your answers help us find better matches" (nothing on the server reads
  `quizAnswers`); onboarding "5x more matches" (key deleted in all three locales).
- Photoless `ProfileCard` no longer leaves a void; onboarding progress bar no longer animates width; `RevealOnScroll`
  rise clamped to the 16px ceiling.

**Shared-primitive pass (Phase 5b)**, requested independently by several groups: light `textMuted` `#8B8B8B` →
`#6E6E6E` (3.4:1 → about 5:1, the value the web already adopted); `Button` gets the elder 60pt floor and wraps to two
lines instead of truncating; `Input` defaults its accessibility name to its label, announces errors, gets the elder
floor and an AA placeholder; `ListRow` switch rows are one labelled `switch` that toggles from the whole row;
`ScreenHeader` no longer buzzes on a navigation tap and sizes the back target for elder;
`IconButton` haptic is opt-in (the two voice-intro toggles opt in) and elder-sized; `PickerSheet` fades under Reduce Motion, has a solid scrim under
Reduce Transparency, drops its false grabber, opens on the selected row and honours the elder row floor; the two
remaining slide Modals (save-search, guardian invite) fade under Reduce Motion.

**Decisions taken here:** open question 2 (funnel vs the web's one-field-first gate) — the funnel already is
identifier + inline OTP, then basics, so it conforms and needed no rebuild; open question 7 (`RevealOnScroll`) —
kept and clamped to 16px; open question 8 (`usePop`) — retuned to 1.12, a plain tap earns no 1.3× overshoot.

**Owner and backend items surfaced (none fixed here):**
1. **`ensureSeeded()` in `backend/routes/astrologerRoutes.js` bulk-creates three invented practitioners** (342/198/571
   reviews, a "Certified by Bharatiya Vidya Bhavan" bio) into an empty Astrologers table in ANY environment. Masked
   only while `ASTROLOGER_MARKETPLACE` is off. Gate it to development before that flag is ever flipped.
2. **Google-sign-in accounts cannot delete their account**: they have `password: null` and `deleteAccount` runs
   bcrypt against it. In-app account deletion is a Play and App Store requirement.
3. **Onboarding collects answers the server has no column for and silently drops them**: Step 11 partner preferences
   (marital status, religion, diet, manglik), Step 8 exercise, Step 9 family values, Step 7 has-children. Add a
   dedicated JSONB (not `lifestylePreferences`, which saved searches use) or remove the questions.
4. **Deploy the `getLikes` `myAction` change** (`backend/controllers/matchController.js`); until then Liked Me
   answers are session-local. Also decide whether answered likers should stay in the list at all.
5. Astrologer booking cannot be paid in-app (no verify-payment client, `openRazorpay` lives inside
   `SubscriptionScreen`); the app hands off to the website. Each web-only booking tap on the API still creates a
   pending order. Wire payment before the flag is on, or keep it hidden.
6. Copy needing an owner or counsel decision: "Our safety team reviews reports within 24 hours" (RN sheet, web Safety
   and Help); the finale's staged-loader lines; income buckets stored as midpoints on RN and upper bounds on web.
7. The Android biodata "Share PDF" still ships only a caption (`Share.share` drops the file on Android).
8. `frontend/src/pages/Help.jsx:84` carries the false "horoscope never folded into the score" sentence the mobile
   side already corrected.

**Cold-audited after the fact** (a fresh agent audited the primitive batch): it caught `Input`'s new live region
doubling TalkBack speech against eight per-screen announcements (reverted, callers keep announcing), a 44→48pt drift
in `Button` text variant / `IconButton` / back button (restored to 44 outside elder mode), a picker scroll on a blind
timer (now on list layout), the switch row's label dropping its value, and stale comments.

**Known minors left open** (all source-level, low severity): `app.json` and `Info.plist` still carry the Face ID usage
string and `expo-local-authentication` is still a dependency though no biometric sign-in exists (drop at the next
native build); toasts are not announced to screen readers centrally
(screens announce per site; a central announce would double them, so it needs one owner at once); `Chip` is about
34pt tall with no hitSlop; `EmptyState`/`GoldLock` cannot carry a custom action testID; `useKeyboardUp` and
`useLiveSocket` are duplicated across the two chat screens; a raw `TextInput` remains in Search (Input has no
leading-icon slot); the toast host renders beneath iOS `<Modal>` windows; `FilterPanel` range fields do not
re-sync after a programmatic reset; the family-group Add-member button shows to non-owners though the server allows
only owners (the server's `myRole` is dropped by `mapGroup`); ~89 `t()` keys in the chat files have no locale entry
(English default shows in hi/pa); light `textMuted` is fixed but `c.warning`/`c.info` used as small text on white are
about 3:1.

**Gates:** mobile tsc 0, jest 57/57, root lint 0 errors (mobile warnings 182 → 69), slop-lint clean.

---

## Phase 6 — Verification and close — DONE 2026-09-24 (device sweep, both platforms)

**Method.** Built and drove the app on an API 35 Android emulator (`adb input` + `uiautomator` dumps, screenshots) and an
iPhone 17 Pro simulator (`idb`, POINTS not pixels), against a local backend, as two accounts (VIP `aman.singh2`, free
`priya.sharma1`). Two device agents ran in parallel per pass (one per platform) with the source frozen; findings were
fixed in one batch afterwards and re-verified on the device that found them. Coverage: every member screen at default
type size, dark mode, elder mode, max OS text size (Android font scale 2×, iOS AX5), Hindi and Punjabi, signed-out
door, cold-start restore, cross-account logout, a fresh email sign-up end to end, Settings, Filters, chat send, the
picker and confirmation sheets. **The phase caught what the Phase 5 source audit could not** — including a regression
that audit had passed (the OTP boxes).

**Real bugs found on device and fixed (all verified live):**
- **OTP boxes collapsed to slivers** (a Phase 5 regression: the row lost its width when the boxes went `flex`). The
  cold source audit passed it; both device agents failed it within a minute. `OtpInput` wrap is `alignSelf: 'stretch'`.
- **The next member to sign in saw the previous member's data.** `logout()` cleared the MMKV cache but not React Query,
  whose keys (`['profile','me']`) carry no user id. Aman → log out → Priya showed Aman's Home and Profile.
  `queryClient.clear()` in `authStore.logout()`.
- **The keyboard sat on top of the submit button on Android 15.** targetSdk 35 makes the window edge-to-edge and
  `adjustResize` stops resizing it, so `Screen keyboard` (KAV `behavior` undefined on Android) left Continue and Save
  behind the keyboard with nothing to scroll: create-account, basics, login, every journey step. KAV now uses
  `'height'` on Android in `Screen`, `OnboardingLayout` and `FamilyGroupChatScreen`; KAV measures overlap against its
  own frame so it adds nothing where the OS still resizes. RN `Modal` windows resize on their own (verified with the
  delete-account sheet) and were left alone.
- **Home's completion ring read 0% for a fresh sign-up** while the Profile tab said 35% and the journey said "a quarter
  done". Home read the auth user's `Profile.completionPercentage`, frozen at sign-in; it now reads the live
  `myProfile` query, and journey saves invalidate it.
- **Filters left the keyboard open** (and the tab bar hidden) after Apply; `Keyboard.dismiss()` on close and Apply.
- **Hindi/Punjabi button labels clipped** ("साइन इन करें" lost its last glyphs; Account Security's Sign out button
  swallowed the device name). Android measures Indic scripts narrower than it draws them, so a label that fits by
  measurement is cut. `Button` now fills its row only when it is a block (`variant !== 'text' && size !== 'sm'`),
  shrinks a single line to fit, and inline buttons size to their content again. Three earlier attempts (two-line
  label, `width: 100%`, `flexGrow` on all buttons) each broke a different screen; the notes are in `Button.tsx`.
- **`@gorhom/bottom-sheet` v5 crashed on a density or text-size change** ("Property 'window' doesn't exist" thrown
  inside a Reanimated worklet from a destructured `{ window }`). `scripts/patch-native-modules.cjs` patches
  `useAnimatedLayout` (idempotent, fails soft) alongside the existing patches.
- **Chat date separators drew below their day's first message.** An inverted FlatList draws cell children
  bottom-up; the separator now renders after the bubble in JSX.
- **Chat buttons were silent no-ops in elder mode on Matches** (elder mode hides the Chat *tab*; the thread is a
  stack screen and reachable). Gating removed.
- **Dark-mode avatar initials were about 1.2:1** (`p700` on a dark `p100` tile); `SmartImage` uses `p300` in dark and
  pins the glyph (`maxFontSizeMultiplier={1}`) because it sits in a fixed circle.
- **Max-text-size breakage:** the floating tab bar labels, the display and title `Text` variants and conversation row
  names overflowed or clipped at AX5/2×. Tab labels cap at 1.3 (height-constrained), row names and `ListRow` labels
  take two lines, and the single-word tab titles ("Messages", "Matches") are one line that shrinks to fit rather
  than breaking mid-word. A first attempt capped every display/title variant in `Text` by default; the cold audit
  rejected it against §10.6 (headings scale freely, and at 200% a capped title rendered smaller than body text), so
  it was removed.
- Smaller: a `t('home.todayMatches')` key typo showed the raw key; the switch off-state track had too little contrast
  (`c.n500`); the Welcome CTA sat too close to the gesture bar (`edges` now includes bottom); the picker scrim
  did not cover the Android status bar (`statusBarTranslucent`); notification dates now pin the `en-IN` locale;
  the password eye button is at least 44pt wide.

**Verified working on device, no change needed:** the 6-digit email OTP with auto-verify (dev master code), the
DOB slash mask, sign-up → Main → journey auto-present, journey exit and resume-at-first-incomplete, cold-start
session restore, system dark mode live-switch across every tab, elder mode round trip, hi/pa switching, the gorhom
Filters sheet open/close cycle, the delete-account confirmation (wrong password shows an inline error and keeps the
sheet open; the right one signs out to the Welcome door and the account can no longer sign in).

**Cold audit of this batch** (a fresh agent, source only, 91 tool calls) confirmed four defects, all fixed: the
journey save refreshed only one of the two profile caches (`me` and `myProfile`), so a Profile tab already open kept
the old ring and an Edit Profile save could post the stale form over the journey's answers — both keys now refresh
through `utils/profileCache.refreshProfileCaches()`, which Edit Profile shares; the photo step never refreshed either
(photos persist on upload and are worth 13 completion points); the group chat had the same inverted-list separator
bug the 1:1 chat was fixed for; and the default heading caps in `Text` (above). It also checked all 62 `<Button`
call sites, every changed KeyboardAvoidingView, the Step 8-11 hydration effects, import cycles, `queryClient.clear()`
and the gorhom patch's idempotency, and found them sound.

**Not exercised (recorded, not hidden):** VoiceOver and TalkBack were not run — the accessibility tree was the
proxy, so labels, roles, states and target sizes are checked but spoken order and rotor behaviour are not; release
builds (no signing identity for the hardware, open question 11) — every behaviour above is a debug build; the iOS
software keyboard (the simulator had a hardware keyboard attached, so the DOB mask was verified through the Android
keyboard and the Share-Your-Story date field only); Reduce Motion fade versus slide on Android; Liked Me Decline
(the seed data has no unanswered likers); an offline or backend-down pass.

**Device-found items left open** (each low severity, none blocks a store build): elder-mode ProfileDetail has no
persistent message CTA; the Search input measures about 38pt (iOS); the Subscription screen labels a hand-seeded
VIP holder's card "Premium — Current plan" (VIP is withdrawn under the single-plan launch, so only legacy or seeded
holders see it); bottom sheets are not edge-to-edge at the bottom on Android; the own-profile hero is blank for a
moment while the photo loads; the gallery viewer's "Try again" is stretched full width; iOS shows its "Save
Password?" system sheet after sign-up; several rows share identical accessibility labels; elder-mode docked tabs
are 56dp and "Open full profile preview" is 40dp.

**Owner and backend items surfaced by the sweep:** compatibility percentage differs between Liked Me (stored when the
like was made) and Mutual (recomputed) in `matchController.js`; deploy the `getLikes` `myAction` change; hi/pa
coverage (31 screens have no `t()`, about 97 chat keys are missing from the locales); the Face ID usage string and
`expo-local-authentication` are still shipped; the dev backend should also log the email OTP when `EMAIL_DRY_RUN` is
on (it would remove the need for the master bypass code to test sign-up). The earlier Phase 5 owner list stands.

**6.3 Docs.** `PROGRESS.md`, the CLAUDE.md audit history, `mobile/READINESS.md` and `CLAUDE.md`'s Nav line (it still
named the deleted Bureau stack) updated in the closing commit.

**Gates:** mobile tsc 0, jest 57/57, root lint 0 errors (mobile warnings 69), slop-lint clean.

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
