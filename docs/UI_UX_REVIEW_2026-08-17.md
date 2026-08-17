# UI/UX Review & Improvement — 2026-08-17

Professional design-critic pass across **web (desktop 1440 + mobile 375)** and the
**RN app (Android emulator live + iOS simulator live)**, benchmarked against
Shaadi.com / Jeevansathi.com patterns and an "Apple-smooth" motion bar.
Driver: `/ui-ux-pro-max` design intelligence + live Playwright (web) + adb/idb
(native). Brand tokens are **locked** (burgundy `#8B2346` accent-only, gold
`#C9A227` premium-only, Playfair display + Inter body) — this is refinement, not
a rebuild.

> The `/ui-ux-pro-max` generic recommendation for "matrimonial/wedding" was
> romantic-pink + Great Vibes script — **rejected**. The existing burgundy/gold
> editorial system is more tasteful and already cohesive; only the *smooth-like-
> Apple* cues were taken (fluid 240–360ms curves, ≥44px targets, focus states,
> reduce-motion).

---

## Verdict by surface

| Surface | State | Notes |
|---|---|---|
| **Web desktop** | ✅ Strong | Editorial hero, dark founding-members band, marquee, feature cards — mature. One minor: hero photo-stack clips at extremes (subjective/intentional fan). |
| **Web mobile (375)** | ✅ Strong | Hero photo-stack correctly hidden, chips stack, CTA prominent. 2026-06-18 mobile pass holds. |
| **RN onboarding** | ✅ Improved this pass | Was the real polish gap — see fixes below. Verified live on Android; iOS parity confirmed. |
| **RN member core** | ✅ Good | `ProfileCard` already uses PressableScale + usePop + scrim + score-colouring; polished across prior QA passes (2026-06/08). |
| **iOS parity** | ✅ Confirmed | Welcome renders identically (logo, language pills, carousel, CTA, safe areas). Shared RN code → onboarding fixes apply. |

---

## The #1 cross-cutting finding: press feedback

The shared `Button` already wraps `PressableScale` (spring + haptics + reduce-
motion) — so **every `<Button>` CTA is already Apple-smooth**. But **68 files used
raw `TouchableOpacity`** (opacity flash) for tiles/pills/chips vs **3** using
`PressableScale`. Discrete tappable objects (tiles, pills, cards, icon-buttons)
should spring; full-width **rows** correctly stay opacity/dim (iOS convention —
`ListRow` left as-is on purpose).

The onboarding funnel — the most-travelled RN flow, and where Shaadi/Jeevansathi
invest most — was the worst offender and got fixed first.

---

## Applied & verified this pass (committed `0a63d62`)

| File | Change | Verified |
|---|---|---|
| `OnboardingLayout.tsx` | Progress bar **glides** to the new step (Reanimated `withTiming`, measured track); reduce-motion jumps. | ✅ Android (bar filled on Step 1) |
| `Step0Screen.tsx` | Registering-for tiles → `PressableScale` spring + selection haptic + **checkmark badge** on active; taller tiles + `headline` label for balance. | ✅ Android (selected "My Son") |
| `Step1Screen.tsx` | Gender pills → spring + haptic + **✓** on active. | ✅ Android (selected "Woman") |
| `Step3Screen.tsx` | Manglik pills → spring + haptic. | tsc/lint |
| `Step7Screen.tsx` | Marital rows + yes/no toggles → spring + haptic. | tsc/lint |
| `Step8Screen.tsx` | Diet/drink/smoke/exercise RadioGroup (4 groups) → spring + haptic; 40→**44px** tap target. | tsc/lint |

Gates: **mobile tsc 0 · eslint 0 errors** (7 pre-existing `any` warnings untouched).

---

## Backlog — prioritised (not yet applied)

### RN — high value
1. **Finish the funnel's press idiom** — the SelectSheet-based steps (2,4,5,6,9)
   use modal pickers; their rows are fine (opacity), but any inline tiles there
   should match Steps 0/1/3/7/8. Steps 10–13 (photos/OTP/review) worth a look.
2. **Full-width selectable rows → right-aligned checkmark** (Step7 marital,
   any tier/plan rows) — iOS selection convention; currently fill-only.
3. **Two typography systems** (`type.*` named scale vs legacy `typography.*`).
   The `type.*` scale is the good one (HIG-like). Migrate remaining
   `typography.fontSize/fontFamily` call sites → `type.*` for consistency.
   *Tech-debt, low visible impact — do incrementally.*
4. **Dark-lock decision.** App ships `userInterfaceStyle: light` yet carries a
   full `darkColours` path + `useTheme` reads system scheme; some screens mix
   static `colours.*` with theme `c.*`. **Not user-visible while light-locked** —
   decide: drop the dark path, or finish theming every screen. (Owner call.)

### Web — low value (already strong)
5. Hero photo-stack (desktop) clips "97%"/badge at extremes — contain or nudge
   the fan; **subjective**, has a bespoke mobile responsive block (regression
   risk), left intentionally.

### Cross-cutting
6. Shaadi/Jeevansathi parity ideas worth considering: sticky "compare" bar on
   search, more prominent verified-badge chips on cards (web card already has
   them), partner-preference "you fit X's criteria" reverse-match (web
   `PreferenceMatch` exists — port to RN ProfileDetail).

---

## Deep pass — Profile tab + full member-screen sweep (driven live as seeded VIP)

**🔴 Native crash fixed (real prod risk):** the Matches → **Shortlisted** tab
hard-crashed the app — `FastImage.preload` → Glide `IllegalArgumentException:
"Must not be null or empty"`. `useOfflineShortlist.prewarmImages` filtered photo
URLs with a bare truthy check, so a whitespace string or relative `/uploads` seed
path reached Glide and killed the process. Now only absolute http(s) URLs preload.
(`9d292cd`)

**Profile-completion redesign (`18cba75`):** three stacked completion elements
(ring + generic CTA + a fixed milestone strip whose 70% tip still said "Upload
Kundli", a removed feature) → one **CompletionCard** that lists the specific
missing high-value fields, each tappable. Member name → Playfair. Empty photo →
real tappable "Add photos". Shared `CompletionRing` font/tick now scale with size
(the 58pt Home mini-ring's "%" was overflowing the ticks — user-reported).

**PreferenceMatch ported to RN** (`18cba75`): Jeevansathi-style "do you fit what
they're looking for?" checklist on ProfileDetail — verified live (2/4 on a seeded
profile).

**Missing back buttons** (`18cba75`): Notifications (user-reported dead-end),
Login, ResetPassword — all pushed screens under a global `headerShown:false`.

**Settings brand tiles** (`d53f7a7`): rainbow icon tiles (blue Appearance, gold
scattered on Privacy/Family/Support) → all burgundy; only Subscription keeps gold,
so gold reads as "premium" again.

**Chat send button** (`b3fd586`): disabled state was near-white on white — now a
visible muted grey circle.

**Swept clean** (no fix needed): Home, Conversations, Subscription, EditProfile,
Verification, Search + FilterPanel (gorhom v4 holds), all 3 Matches tabs.

## Method notes
- iOS sim: existing DerivedData debug `.app` loads latest JS from the running
  Metro — install + launch, no rebuild. idb taps take **points** (screenshot px ÷ 3).
- Android: reload with `adb shell input keyevent 46 46`; a Metro reload can reset
  a debug build to the initial route.
- Web: `/ui-ux-pro-max` `--design-system` is a starting point, not gospel — its
  generic palette lost to the purpose-built brand (same lesson as magic-mcp).

---

## Complete UI overhaul — executed same day (commits `331345c` → `cdec5ca`, unpushed)

Owner requested a full overhaul plan (modern-dating-app-inspired but strictly
matrimonial, GenZ + parents). Plan approved (incl. prompts backend + dark mode);
executed in phases, each an independent commit, live-driven on qa_api35:

| Phase | Commit | What shipped |
|---|---|---|
| P0a | `331345c` | 🔴 **Inter fonts were never loaded** (whole app rendered system font) — fixed; branded toast system; Reanimated skeletons + SkeletonFade; layout/Screen + IconButton; SmartImage→FastImage (cache + fade, Glide-safe resolver) |
| P0b | `2fd1349` | Outcome feedback Alert→toast on hot member paths (confirmations stay native) |
| P0c | `c47e6bf` | Shared PickerSheet kills 5 duplicated onboarding sheets; PressableScale across Home/Matches/Subscription/Chat tap targets |
| P1 | `c02527c` | Per-layout skeletons on every member screen; ListFooter unifies pagination |
| P2 | `167ec74` | Android slide-from-right, modal rise for Subscription/SuccessStory, tab haptic + icon pop, StaggeredEntrance doctrine |
| P3 | `2f61bef` | **Flagship: ProfileDetail rebuilt as photo-forward story scroll** — parallax hero (monogram fallback for 0-photo profiles), 4:5 photos with warm caption bands, editorial cards replace accordions, scroll-reveal, floating Playfair header |
| P3b | `ad1793a` | Full-screen photo gallery viewer (arrows + counter + swipe; hero count chip) — user request |
| P4 | `5559297` | AudioIntroChip waveform pill; long-press "appreciate" → warm ChatThread draft prefill; match-seal ring pulse; animated breakdown bars; "open my full profile preview" |
| P5 | `e89f59b` | Chat typing dots + new-message entrance + optimistic opacity; splash 3-dot loader; quiz progress glide |
| P7 | `bb515f1` | Profile prompts: backend already existed (mig 000008) — shipped the product's first prompt **editor** + "Get to know {name}" story card |
| P8 | `cdec5ca` | Last member full-screen spinners → skeletons; grep gates |

**Deliberate calls:** gorhom sheet consolidation parked (existing Modal sheets
already match the spec; migration risk > gain). **Dark mode NOT enabled** —
discovery: no Dark Mode toggle exists in Settings and ~40 member files still
use static `colours.*`; enabling now would ship the historic mixed-theme
illegibility. All NEW overhaul components consume `useTheme`, so the follow-up
is wiring legacy screens + native `userInterfaceStyle` + dev-client rebuild.

**Still open:** iOS sim drive of the new story scroll; elder + hi/pa passes;
haptics activation needs a dev-client rebuild; push/deploy decision.
