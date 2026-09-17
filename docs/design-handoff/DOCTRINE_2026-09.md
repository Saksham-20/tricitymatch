# TricityMatch Design Doctrine (2026-09)

Merged operating law for the web rework, distilled from `impeccable` (v4.3.1), `design-taste-frontend`,
`high-end-visual-design`, `emil-design-eng`, `apple-design`, `animate`, `find-animation-opportunities`,
`redesign-existing-projects`, `minimalist-ui`, `gpt-taste` and `stitch-design-taste`.

This file is the law for implementers. The source skills are reference; where they disagree, Section 2 says
who won and why. Read Sections 2, 4, 8 and 9 before touching any UI file.

**Precedence, highest first:** product truth and legal copy > accessibility (elder mode, WCAG AA, reduced
motion) > this doctrine > the committed visual world in `index.css` / `tailwind.config.js` > any individual
skill. A skill rule that contradicts a higher line loses without discussion.

---

## 1. What we are designing

**Product read:** a hyperlocal Indian matrimonial service for Chandigarh, Mohali and Panchkula. Two distinct
audiences use the same account: the member (25-40, phone-first, mid-range Android, hi/en/pa) and the parent or
guardian (50-70, larger type, often the one who decides). Money changes hands on trust, and the decision is the
highest-stakes one the user will make this year.

**This sets the tone floor:** calm, credible, unhurried. Not a dating app, not a SaaS dashboard, not an
Awwwards portfolio. An interface that looks clever at the expense of looking trustworthy has failed.

**Surface modes** (from `impeccable`; the mode picks the rules, the product does not):

| Surface | Mode | What wins |
| --- | --- | --- |
| `/`, `/about`, `/safety`, `/success-stories`, `/help`, `/matrimony/:city/:community`, `/contact` | **Persuade** | Earn attention and one action. A bounded amount of authored motion is allowed here and nowhere else. |
| Dashboard, Search, Matches, Profile, Chat, Settings, Subscription, Verification, Onboarding, all `/admin/*` and `/marketing/*` | **Operate** | Scanability, consistency, speed. Motion serves feedback and continuity only. |
| `/terms`, `/privacy`, `/refund-policy`, `/delete-account` | **Read** | Structure for comprehension. Effectively zero motion. |

There is no Experience surface on this product. Anything proposed as one is rejected.

---

## 2. Conflict rulings

Every row is a place the source skills contradict each other. The ruling is binding; the reason is one line.

| # | Conflict | Ruling | Why the loser lost |
| --- | --- | --- | --- |
| 1 | `gpt-taste` / `high-end-visual-design` demand GSAP pinning, scroll hijack, horizontal pan, card stacking. `emil-design-eng` and `animate` demand motion be justified per instance. | **Banned product-wide.** No pinning, no scroll hijack, no scrubbed scroll, no card stacking. No GSAP dependency is added. | Scroll hijack steals the scrollbar from a 60-year-old parent on a mid-range Android. Cost is certain, benefit is decorative. |
| 2 | `high-end-visual-design`: eyebrow pill above every H1/H2. `impeccable` craft-floor: eyebrows are an outright ban. `design-taste-frontend`: max 1 per 3 sections. | **Zero eyebrows.** The heading carries itself. | craft-floor is the strictest and this is a trust product; a decorative micro-label above a heading is pure AI signature. |
| 3 | `design-taste-frontend` and `stitch` ban Inter. | **Overruled. Inter stays as body.** | The skill's own override covers accessibility-first products; elder mode plus Devanagari and Gurmukhi fallbacks make a boring, hinted, wide-coverage face correct. |
| 4 | `design-taste-frontend` calls serif display "very discouraged". | **Overruled. Playfair Display stays for h1-h3.** | It lists Playfair in its own justified-serif pool, the brand world was committed in the 2026-06-23 redesign, and heritage voice is the point for a matrimonial brand. |
| 5 | `high-end-visual-design` "Double-Bezel" nested card architecture. `impeccable` craft-floor: nested cards are always wrong; declare elevation once. | **Nested decorative bezels banned.** Concentric radius math (`calc(var(--radius) - 4px)`) is allowed only where a real inner surface exists, such as a photo inside a profile card. | A card inside a card is elevation theatre; our cards already carry meaning as profile units. |
| 6 | `high-end-visual-design`: primary CTAs are `rounded-full` pills. `minimalist-ui`: never pill large containers or primary buttons. craft-floor: pills are for small controls. | **`rounded-xl` (12px) for buttons and cards. Pills only for chips, badges, tier labels, filter tokens.** | Shape consistency lock: 342 `rounded-full` usages already exist, most are correctly small; letting CTAs join makes the radius system meaningless. |
| 7 | `stitch`: every active component gets a perpetual micro-loop (pulse, float, shimmer). `emil-design-eng` frequency gate; `motion-doctrine` idle-wobble ban. | **No idle loops.** Exceptions, each semantic: skeleton shimmer while loading, chat typing indicator, spinner where no skeleton is possible. | An element that breathes while the user reads it is noise that costs battery and attention forever. |
| 8 | `apple-design`: springs for anything touchable. `emil-design-eng` / `animate`: durations by default, springs for gestures and momentum. | **Durations by default; springs only where a finger drives the value** (drag-to-dismiss, bottom sheet, swipe). | Most of our motion is non-gestural state change; a spring there is an unpredictable duration for no gain. |
| 9 | `design-taste-frontend` section 9.G: zero em-dashes anywhere visible. | **Narrowed.** Zero em-dashes in UI chrome: headings, labels, buttons, chips, form hints, error text, empty states, toasts, email subject lines. Existing prose in legal, help and blog-style pages is left alone. | 580 em-dashes exist in JSX today; a retro-sweep of legal and policy copy carries compliance cost and zero design benefit. New copy obeys the ban. |
| 10 | `design-taste-frontend` Tailwind v4 guidance, `motion/react` import path, shadcn install commands. | **Ignored as written.** We are on Tailwind 3.4.19, `framer-motion@12` imported from `framer-motion`, no shadcn, no GSAP. | Version-specific advice for a stack we do not run produces broken imports. |
| 11 | `minimalist-ui` / `stitch`: no gradients anywhere. Our `btn-primary`, `btn-gold` and `scroll-progress` use them. | **Gradients survive only as the brand's own two-stop burgundy and gold button fills and the progress bar.** No gradient text, no mesh, no aurora, no rainbow info panels, no pastel washes. | The button gradient is a committed brand asset and reads as depth, not decoration; everything else was already killed in the 2026-06-18 pass and stays dead. |
| 12 | `design-taste-frontend` / `redesign-existing-projects`: ban `lucide-react`, use Phosphor. | **Overruled on the library, upheld on the principle: one family.** `react-icons/fi` (Feather) is the incumbent in 83 files; `lucide-react` appears in 16 and is the one being retired. | Swapping 83 files of icons buys nothing a user can see; mixing two families is the actual defect. |
| 13 | `high-end-visual-design`: section padding `py-24` to `py-40`. `stitch`: gallery-airy, massive whitespace. | **Marketing sections `py-16 md:py-24`. App surfaces `py-6 md:py-8`.** | Our marketing pages carry dense trust content (pricing, FAQ, safety) that a parent scrolls on a phone; `py-40` turns one screen of answers into five. |
| 14 | `gpt-taste`: centered heroes preferred. `stitch`: centered heroes banned at this variance level. | **Centered hero is permitted on `/` only**, because the message is the product. Every other Persuade section uses an asymmetric or split composition. | A matrimonial promise is a manifesto, not a feature demo; elsewhere, centering everything is the templated look. |
| 15 | `design-taste-frontend`: real photography required on marketing pages, hand-rolled decorative SVG discouraged. | **Upheld as the default, amended 2026-09-17 with an owner-approved interim override — see "Ruling 15 — imagery override" below.** Real member photos still never appear in marketing without written consent; that half of the ruling is unchanged. | Legal and dignity risk outranks visual richness; a fabricated "couple" photo on a matrimonial site is a trust breach. This is still true — it is why the override below carries the guardrails it does. |
| 16 | `stitch` / `high-end-visual-design`: hover-driven affordances (dock magnification, magnetic buttons, spotlight borders). | **Banned.** No affordance may exist only in hover. | Half our traffic is touch, and elder mode users often navigate by keyboard or large-target tap. |

### Ruling 15 — imagery override (owner decision, 2026-09-17)

The default above stands: real, consented photography or nothing. The owner has chosen AI-generated
imagery as an **interim** measure, real photography to follow. The override does not repeal the default's
reasoning, it departs from it under guardrails that are **not optional**, because they are what keeps the
interim honest rather than deceptive:

- AI imagery is **ambient art direction only.** A generated human may set mood in a hero or a section backdrop.
- **Never** captioned or framed as a member, a couple who met here, a testimonial, or a success story.
- **Never** carries a name, a quote, an age, a city, a "verified" tick, or a match percentage.
- **Never** placed inside or adjacent to a trust claim, a verification badge, a real-member proof rail, or the
  success-stories surface. Those surfaces show real consented people or they show nothing.
- Every generated asset lands under `frontend/public/images/editorial/` and is referenced only through a
  single manifest module, so the swap to licensed or consented photography is one commit.
- Faces are not the only option and often not the best one. Wedding detail, mehendi hands, phulkari texture,
  marigold, a Chandigarh streetscape all carry warmth without impersonating a person who does not exist.

---

## 3. Tokens: the numbers

These bind to `frontend/src/index.css` (`:root`, `html.dark`, `html.elder`) and `frontend/tailwind.config.js`.
Do not fork them, do not add a parallel scale.

### 3.1 Color

- Burgundy `#8B2346` is **accent only**: primary CTA fill, active nav, focus ring, links, selection. Never a
  flat background for a large region.
- Gold `#C9A227` is **premium only**: paid-tier badges, upgrade CTAs, verified-premium marks. Gold on a free
  surface is a bug.
- One accent, locked, page-wide. No rose, purple, teal or blue accents. Semantic colors
  (`success #2E7D32`, `info #1565C0`, `warning #F57C00`, `destructive #C62828`) are for state only, never decoration.
- No pure `#000` or `#fff` as a surface. Light canvas `#FAFAFA`, cards `#FFFFFF` only as an elevated surface.
- Secondary text on a colored surface is tinted from that hue or from the foreground. Never neutral gray on a
  burgundy panel.
- Contrast: body and placeholder >= 4.5:1, large text (>= 18px or 14px bold) >= 3:1, focus ring >= 3:1 against
  both the control and the page.

### 3.2 Type

Playfair Display (h1-h3, `.font-display`), Inter (everything else). No third family. No monospace as costume;
`tabular-nums` for money, counts and dates instead.

| Role | Size / line-height | Tracking | Weight |
| --- | --- | --- | --- |
| Display (hero h1) | `clamp(2rem, 5vw, 3.5rem)` / 1.1 | `-0.02em` | 600 |
| h2 | 30-36px / 1.25 | `-0.02em` | 600 |
| h3 | 24px / 1.3 | `-0.01em` | 600 |
| h4-h6 (Inter) | 18-20px / 1.4 | 0 | 600 |
| Body | 16px / 1.6 | 0 | 400 |
| Secondary | 14px / 1.5 | 0 | 400 |
| Label / chip | 12px / 1.5 | `+0.02em` | 500 |

- Tracking floor is `-0.04em` and we never reach it; `-0.02em` reads better at our sizes.
- Body measure 65-75ch. `max-w-[65ch]` on prose blocks; `text-wrap: balance` on headings (already global),
  `text-wrap: pretty` on lead paragraphs.
- 16px is the body floor. Never below 16px on form inputs: iOS Safari force-zooms a focused input under 16px
  and the layout breaks.
- Light text on dark: one notch more line-height and a hair more tracking. Dark mode headings need their own
  color token, not an inherited one.
- Hindi and Punjabi expand roughly 20-30%. Every label must survive that without wrapping into a second line
  or clipping.

### 3.3 Space

4px base. Rhythm comes from the contrast between tight and generous, not from repeating one value.

- Inside a group: 8px / 12px. Between groups: 24px / 32px. Between sections: 48px (mobile) / 64-96px (desktop).
- **More space above a heading than below it.** A heading belongs to what follows.
- Marketing section padding `py-16 md:py-24`. App surface padding `py-6 md:py-8`. Page gutter 16px at 375px.
- Grid over flex percentage math. `grid grid-cols-1 md:grid-cols-3 gap-6`, never `w-[calc(33%-1rem)]`.

### 3.4 Shape and depth

- Radius: cards and buttons 12px (`--radius`), large containers 16px (`rounded-2xl`), inputs 8-12px,
  pills only for chips and badges. One system, no exceptions.
- **Elevation is declared once: border OR shadow, never both on the same element.** A 1px border under a wide
  soft shadow is the ghost card. There are 16 instances today; each one picks a side.
- Shadows carry offset and blur and are tinted burgundy (already in `tailwind.config.js`):
  resting `shadow-card` = `0 4px 20px rgba(139,35,70,0.08)`, raised `shadow-card-hover` = `0 8px 30px rgba(139,35,70,0.15)`.
  A zero-offset colored halo is decoration and is banned.
- Cards exist only where elevation means something (a profile, a plan, a conversation). Otherwise group with
  space or a hairline `divide-y`.

### 3.5 Targets and chrome

- Hit target >= 44x44px, elder mode >= 48px. If the visual mark is smaller, pad the target, do not grow the mark.
- Focus-visible is a 2px burgundy outline at 2px offset plus the existing 4px soft ring. It is never removed.
- Browser surfaces are ours: selection, caret, scrollbar, focus ring and tabular numerals are all themed
  already. Any new surface keeps them.
- Z-index only from the documented scale (60 nav, 70 sheet, 80 modal, 90 toast, 100 skip-link). No `z-[9999]`.

---

## 4. Motion law

### 4.1 The gate (run before writing any motion)

1. **Frequency.** 100+/day: no animation, ever. Tens/day: under 150ms or nothing. Occasional: standard.
   Rare or first-time: the delight budget lives here and nowhere else.
2. **Purpose, named in one word:** feedback, spatial consistency, state indication, preventing a jarring
   change, explanation, or delight (rare tier only). Cannot name it: do not build it.
3. **Function.** Data the user is reading or acting on does not move for style.

Keyboard-initiated actions are a disqualifier, not a judgment call.

### 4.2 Easing tokens

Add to `:root` in `index.css`, and mirror as arrays in `animations.js`:

```css
--ease-out:     cubic-bezier(0.23, 1, 0.32, 1);   /* entrances, exits, the default */
--ease-in-out:  cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement, layout, tab indicator */
--ease-drawer:  cubic-bezier(0.32, 0.72, 0, 1);   /* sheets and drawers */
```

`ease` (the browser default) is correct for hover and color only. **`ease-in` is banned on UI**: it delays the
exact moment the user is watching. Built-in `ease-out` is too weak for anything deliberate; use the token.

The current `EASE_OUT = [0.25, 0.46, 0.45, 0.94]` in `animations.js` is the weak quadratic curve and is
replaced by `[0.23, 1, 0.32, 1]`. Durations do not change with it.

### 4.3 Duration table

| Interaction class | Duration | Curve |
| --- | --- | --- |
| Press feedback (`:active`) | 120ms | `--ease-out` |
| Hover, color, border | 160ms | `ease` |
| Tooltip | 125ms enter, instant for neighbours once one is open | `--ease-out` |
| Dropdown, menu, select, popover | 180ms | `--ease-out` |
| Modal + backdrop | 250ms enter / 180ms exit | `--ease-out` |
| Bottom sheet, drawer | 320ms enter / 240ms exit | `--ease-drawer` |
| Toast | 400ms enter / 300ms exit, same edge both ways | `ease` |
| Accordion (height + opacity) | 200ms | `--ease-out` |
| Content entrance (`fadeRise`) | 280ms | `--ease-out` |
| Route / page swap | 180ms (matches the shipped view-transition) | `--ease-out` |
| Layout shift (FLIP, `layout`) | 250ms | `--ease-in-out` |
| Marketing scroll reveal | 500-600ms, fires once | `--ease-in-out` |

Ceiling: **UI motion stays under 300ms.** Exits are faster than entrances. Anything longer needs a named
reason written in the PR.

Stagger: 50-60ms between siblings, capped at 6 items (`staggerIndex`). Stagger is decorative and must never
block interaction. Never reinterpret a scrolled page as a staggered list.

### 4.4 Springs

Only where a finger drives the value: drag-to-dismiss, bottom sheet, swipe row, pull gesture.

```js
const SPRING = {
  ui:       { type: 'spring', duration: 0.4,  bounce: 0    }, // critically damped, default
  momentum: { type: 'spring', duration: 0.4,  bounce: 0.2  }, // only after a flick or throw
  sheet:    { type: 'spring', duration: 0.35, bounce: 0.15 },
};
```

Bounce stays in 0.1-0.3 and only when the gesture itself carried momentum. Overshoot on a menu that faded in
is wrong; overshoot on a card the user flicked is right.

Gesture rules that ship with any drag: pointer capture on `pointerdown`; respect the grab offset; ignore
additional touch points once dragging; dismiss on distance **or** velocity (`Math.abs(distance) / elapsedMs > 0.11`);
rubber-band past boundaries rather than hard-stopping (`(overshoot * dim * 0.55) / (dim + 0.55 * |overshoot|)`);
hand the release velocity to the spring; set `transform` on the dragged element directly, never through a CSS
variable on its parent.

### 4.5 Properties

- `transform` and `opacity` only. `clip-path` is the sanctioned fourth (reveals, tab indicators, hold-to-confirm).
  `height` is tolerated for accordions alone.
- Never `scale(0)`. Entrances start at `scale(0.95-0.97)` with `opacity: 0`.
- `transform-origin` sits at the trigger for popovers, menus, dropdowns and tooltips. **Modals are exempt**
  and stay centered.
- Percentages in `translate()` over hardcoded pixels: `translateY(100%)` moves an element by its own height.
- In framer-motion, hot paths use the full transform string. `animate={{ x: 100 }}` is not hardware accelerated
  and drops frames while the page is loading; `animate={{ transform: 'translateX(100px)' }}` is.
- Transitions, not keyframes, for anything a user can fire twice in a second (toasts, toggles, likes,
  message sends). Keyframes restart from zero; transitions retarget.
- Exit along the entry path. A sheet that rose from the bottom leaves through the bottom.

### 4.6 Reduced motion

The current global block in `index.css` sets `transition-duration: 0.01ms !important` on everything and kills
`.btn-primary`, `.card` and `.nav-link` transitions outright. **That is wrong and must be rewritten.** Reduced
motion means fewer and gentler, not zero: the user still needs to see that the interface heard them.

The replacement block keeps opacity and color transitions at about 150ms, removes translation, scale, parallax
and scroll reveals, sets scroll reveals to their settled state immediately, freezes skeleton shimmer to a flat
tint, turns the chat typing indicator into the word "typing", and leaves press feedback as an instant state
change. `MotionConfig reducedMotion="user"` at the App root stays and covers framer-motion.

Reduced transparency (`prefers-reduced-transparency: reduce`) makes every translucent surface solid and drops
its blur. Any new glass surface ships that fallback in the same commit.

### 4.7 Pointer gating

`:hover` motion is gated behind `@media (hover: hover) and (pointer: fine)`. Touch fires a false hover on tap,
which leaves a card stuck in its raised state after the finger lifts. There are 32 `whileHover` usages today;
each needs either the gate or removal. `:active` needs no gate: a press is a press everywhere.

---

## 5. What `animations.js` must become

`frontend/src/utils/animations.js` stays the single sanctioned source of motion variants. It grows; it is not
replaced, and no component hand-rolls a curve or a duration.

**Add:**

```js
export const EASE_OUT    = [0.23, 1, 0.32, 1];
export const EASE_IN_OUT = [0.77, 0, 0.175, 1];
export const EASE_DRAWER = [0.32, 0.72, 0, 1];

export const DUR = {
  press: 0.12, hover: 0.16, tooltip: 0.125, menu: 0.18,
  modal: 0.25, modalExit: 0.18, sheet: 0.32, sheetExit: 0.24,
  toast: 0.4, toastExit: 0.3, accordion: 0.2,
  content: 0.28, page: 0.18, layout: 0.25, reveal: 0.55,
};

export const SPRING = { ui: ..., momentum: ..., sheet: ... };   // Section 4.4
```

Then, as variants:

- `popIn` - origin-aware menu, dropdown and popover: `scale(0.95)` + opacity, 180ms, caller supplies
  `transform-origin`.
- `tooltip` - 125ms variant of the same shape.
- `modal` + `backdrop` - `scale(0.96)` to 1, centered origin, 250ms in / 180ms out, backdrop opacity in step.
- `sheet` - `translateY(100%)` to 0 on `--ease-drawer`; `sheetDrag` uses `SPRING.sheet` when the sheet is
  draggable.
- `toast` - `translateY(100%)` + opacity, 400ms `ease`, exits the same edge.
- `listRow` - enter and exit for rows that appear and disappear in place (chat messages, notifications,
  shortlist). Transition-based so rapid sends retarget instead of restarting.
- `revealOnce` - marketing only: `whileInView` with `{ once: true, amount: 0.3, margin: '-100px' }`,
  8-16px rise, 550ms, `--ease-in-out`.

**Stays banned inside that file and everywhere else:** bounce or elastic on content, scale-pop entrances,
infinite loops, parallax, scroll-scrubbed values, `transition: all`, any variant that moves more than 16px.

**Retire from `tailwind.config.js`** (each is an idle loop or a bounce-by-reflex, and each has 0-3 usages today):
`glow`, `float`, `pulse-soft`, `bounce-in`, `gradient-shift`, `sparkle`, `heart-pulse`, `spin-slow`.
**Keep:** `shimmer` (skeletons), `accordion-down` / `accordion-up`, `fade-in`, `scale-in`, `slide-in-left` /
`slide-in-right`, `typing-bounce` (real semantic state), `confetti` (the single earned celebration on
MatchPopup, already tuned to 18 particles over 1.8s).

**Fix in `index.css`:** `.btn-primary`, `.btn-secondary`, `.btn-gold`, `.card` and `.nav-link` all use
`transition-all duration-300`. Each becomes a named property list at the Section 4.3 duration, for example
`transition: transform 120ms var(--ease-out), box-shadow 160ms ease, background-color 160ms ease`. The gold
button's infinite sweep pseudo-element is removed; a premium badge does not need to shine forever.

---

## 6. Component law

**Buttons.** Every pressable gets `:active { transform: scale(0.97) }` at 120ms. Label fits one line at desktop;
primary CTA labels are 1-3 words. One label per intent across the whole page: "Express interest" or "Send
interest", not both. Contrast is checked against the actual button fill, including ghost buttons over photos.

**Cards.** Border or shadow, never both. No card inside a card. Buttons in a card group align to a common
baseline regardless of content length above them.

**Forms.** Label above the input, always; no placeholder-as-label. Helper text present in markup even when
empty. Error below the input, inline, naming the problem and the recovery. Validate on blur and on submit,
never only on submit. Inputs stay >= 16px.

**Popovers, menus, sheets.** Origin at the trigger. Sheets and modals trap focus, restore it on close, and
close on Escape and on backdrop click unless data would be lost.

**Toasts.** Transient only. Anything the user must act on is inline, not a toast. Enter and exit the same edge.

**Loading.** Skeletons that match the final layout's shape, not spinners. A spinner is allowed only where the
shape is genuinely unknowable (a payment redirect). Skeleton shimmer stops under reduced motion.

**Empty states.** Icon, one line of what is missing, one action that fills it. Never "No data found".

**Error states.** Icon, what failed, a retry that actually retries. A failed fetch never renders as zeros.

**Premium gates.** Blurred content plus a gold lock and an upgrade CTA. The gate never fakes a count or a
photo the user has not paid for.

**Icons.** `react-icons/fi` only, one stroke weight. `lucide-react` is retired from the 16 files that still
import it and then removed from `package.json`. No emoji as an icon, ever. No hand-drawn SVG illustration.

---

## 7. Copy law

- Product language, not marketing language. Banned: "Elevate", "Seamless", "Unleash", "Next-Gen",
  "Revolutionize", "Delve", "Discover the power of".
- Controls name their action. Errors name the problem and the recovery: "Connection failed. Try again", not
  "Oops! Something went wrong".
- No exclamation marks in success copy. Confident, not loud.
- Sentence case for headings and buttons. Not Title Case On Everything.
- No invented precision. A number on screen comes from real data or is visibly labelled as an example.
- No fabricated people. Names, photos and stories in any surface are real and consented, or they are absent.
- No em-dash in UI chrome (Section 2, ruling 9). Use a period, a comma, a colon or a line break.
- Every visible string is re-read before ship. If a phrase is cute and the meaning is uncertain, replace it
  with the plain functional sentence.

---

## 8. Banned patterns (a reviewer can grep or spot these)

Counts are the web source census taken 2026-09-17; they are the size of the cleanup, not a licence to keep them.

| Pattern | Grep | Today | Replace with |
| --- | --- | --- | --- |
| Unnamed transitions | `transition-all` | 104 | Named properties at the Section 4.3 duration |
| Ungated hover motion | `whileHover` | 32 | CSS hover behind `@media (hover: hover) and (pointer: fine)` |
| iOS viewport jump | `min-h-screen`, `h-screen` | 50 + 3 | `min-h-[100dvh]` |
| Scroll listeners | `addEventListener('scroll'` | 5 | `IntersectionObserver`, `useScroll`, or CSS `animation-timeline` |
| Idle loops | `animate-float`, `animate-glow`, `animate-pulse-soft` | 5 | Delete. Motion performs, it does not breathe |
| Bounce entrance | `animate-bounce-in` | 1 | `fadeRise` |
| Gradient text | `bg-clip-text` | 1 | Weight or size for emphasis |
| Ghost card | `border ... shadow-` on one element | 16 | Pick one |
| Second icon family | `lucide-react` | 16 files | `react-icons/fi` |
| Eyebrow label | `uppercase tracking-[0.` above a heading | - | Delete the label |
| Section numbers | `01 /`, `02 /` above headings | - | Delete |
| Arbitrary z-index | `z-[9` | - | The documented 60/70/80/90/100 scale |
| Pure black or white surface | `#000`, `#fff` as a page or card background | - | `#FAFAFA` canvas, `#FFFFFF` only as elevation |
| Rainbow info panels | `bg-blue-50`, `bg-green-50`, `bg-purple-50`, `bg-amber-50` as info boxes | - | One `bg-neutral-100` panel |
| Off-brand accent | `rose-`, `purple-`, `teal-`, `indigo-` | - | `primary-` or `gold-` |
| Emoji as icon | any emoji in JSX | - | `react-icons/fi` glyph |
| `scale(0)` entrance | `scale-0`, `scale: 0` in an initial state | - | `scale(0.95)` + `opacity: 0` |
| Alert dialogs | `alert(`, `confirm(` | - | Inline error or a real dialog |
| Placeholder as label | `placeholder=` with no `<label>` | - | Label above the input |
| Nested cards | a `.card` inside a `.card` | - | Flatten |
| Scroll cues | "Scroll", "Scroll to explore", bouncing chevron | - | Delete |
| Fake screenshots | `<div>` rectangles imitating a product UI | - | Real screenshot or nothing |

---

## 9. Pre-flight checklist

No screen is done until every line is honestly ticked. This runs per screen, not per PR.

**States**
- [ ] Default, loading (skeleton matching the layout), empty (icon + line + action), error (icon + cause + retry) all exist and were seen.
- [ ] Premium-gated views additionally have the locked state.
- [ ] Long content, missing content, and a 30% longer hi/pa translation all render without clipping or a second-line wrap on a control.

**Motion**
- [ ] Every animation's frequency tier and purpose word can be stated in one line.
- [ ] Curve and duration come from Sections 4.2 and 4.3, imported from `animations.js`. Nothing hand-rolled.
- [ ] Exits are faster than entrances and follow the entry path.
- [ ] `prefers-reduced-motion` was toggled on and the screen still explains itself.
- [ ] Hover motion is pointer-gated; press feedback exists on every pressable.

**Themes and scales**
- [ ] Dark mode checked, not assumed. Headings, muted text and borders all still read.
- [ ] Elder mode (`html.elder`) checked: nothing overlaps at 18.5px base, every target >= 48px.
- [ ] 375px checked with no horizontal scroll; 768px and 1440px checked.
- [ ] Browser zoom to 200% does not break the layout.

**Access**
- [ ] Keyboard path complete: tab order matches visual order, focus-visible never removed, Escape closes overlays, focus returns to the trigger.
- [ ] Contrast measured on the real surfaces, including text over photos and inside gold and burgundy fills.
- [ ] Images have meaningful `alt`; decorative images have `alt=""`.
- [ ] Squint test: the primary element, the secondary element and the groups are still identifiable in order.

**Craft**
- [ ] No pattern from Section 8 was introduced.
- [ ] Copy re-read against Section 7.
- [ ] Elevation declared once per element; radius from one system; one accent; one icon family.
- [ ] Console clean, no layout shift on load, images have reserved aspect ratios.

---

## 10. React Native: what carries

The mobile rework follows this doctrine, translated through `animate-expo`. Our stack is **Expo SDK 52,
React Native 0.76.9, Reanimated 3.16, gesture-handler 2.20, react-navigation v6, @gorhom/bottom-sheet v5,
expo-haptics**. The skill is written for Reanimated 4 and Expo Router, so three substitutions are mandatory:
use `runOnJS`, not `scheduleOnRN`; use `.value`, not `.get()` / `.set()`; screen transitions come from
react-navigation v6 native-stack options, and sheets from gorhom v5, not `presentation: 'formSheet'`.

**Carries unchanged from the web doctrine:** the frequency gate, the purpose word, the sub-300ms ceiling,
`transform` and `opacity` only, never `scale(0)`, exit along the entry path, 50-60ms stagger, reduced motion
meaning gentler rather than zero, the token set, the copy law, the 4-state rule and the banned-pattern list.

**Changes on mobile:**

- **There is no hover.** Every affordance that lives in hover on the web must be redesigned into press,
  position, or nothing.
- **Press feedback is `scale: 0.97` over 100-150ms** on every pressable, plus `hitSlop` where the visual mark
  is under 44x44pt (48dp Android) and `pressRetentionOffset` so a drifting finger does not cancel.
- **Keep motion off the JS thread.** Never `setState` in a gesture or scroll handler; shared value plus
  `useAnimatedStyle`. Never call back to JS inside `onUpdate`; that belongs in `onEnd` or a
  `useAnimatedReaction` threshold. Never read or write a shared value during render. Worklet functions carry
  the `'worklet'` directive.
- **Layout properties are more expensive than on web.** `width`, `height`, `margin`, `padding`, `flex`, `gap`
  re-run Yoga for the node and its siblings every frame. The one exception is an absolutely positioned,
  childless element such as a tab pill or a progress fill.
- **Android shadow is `elevation` and re-renders every frame when animated;** crossfade a pre-shadowed layer
  instead. Never animate `BlurView` intensity; crossfade a static blur.
- **Tabs never slide.** They are peers, and the user pays for that motion dozens of times a session.
  Elder mode keeps the docked tab bar, not the floating pill.
- **Springs use Reanimated's Apple-style parameters:** `{ duration: 400, dampingRatio: 1 }` for a default
  settle, `{ duration: 400, dampingRatio: 0.8, velocity }` after a drag, `{ duration: 300, dampingRatio: 0.8, velocity }`
  for a sheet, `overshootClamping: true` where a hard edge must not be crossed. Easings are
  `Easing.bezier(0.23, 1, 0.32, 1)`, `Easing.bezier(0.77, 0, 0.175, 1)`, `Easing.bezier(0.32, 0.72, 0, 1)`.
- **Haptics** fire once per committed user action, on the same frame as the visual, and never as the only
  feedback: they are off system-wide for many users and silent on most Android hardware. Our
  `utils/haptics.ts` probes the native module before requiring it; keep that shape, since a static require of
  an absent native module redboxes in dev.
- **Verification means a release build on the slowest device we support.** Expo Go and the simulator hide
  exactly the problems this section exists to catch, and a Metro reload resets a debug build to its initial
  route, which reads as a navigation bug that is not there.
