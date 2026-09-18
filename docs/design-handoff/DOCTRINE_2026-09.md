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

## 10. React Native: the mobile translation

The mobile rework follows this doctrine. Sections 1, 2, 3.1, 3.2 (values), 7 and 8's *principles* carry
unchanged — the product read, every conflict ruling, the burgundy/gold system, the copy law. What changes is
**mechanism**: RN has no cascade, no hover, no media queries, no `:focus-visible`, and a layout engine that
charges for things CSS gives away. This section says what each web mechanism becomes.

**Precedence is unchanged.** Product truth and legal copy > accessibility > this doctrine > the committed
visual world (`shared/src/constants/theme.ts`) > any individual skill.

**Our stack, verified against `mobile/package.json` 2026-09-18:** Expo SDK 52, React Native 0.76.9,
React 18.3.1, old architecture, bare workflow. Reanimated 3.16.1, gesture-handler 2.20.2,
react-navigation v6 (`native-stack` + `bottom-tabs`), `@gorhom/bottom-sheet` 5.1.6, expo-haptics 14.0.1,
expo-blur 14.0.3, expo-linear-gradient 14.0.2, `@expo/vector-icons` 14, react-native-fast-image,
react-native-toast-message, Zustand, React Query, i18next. **Read `mobile/AGENTS.md`, not the root
`CLAUDE.md`, for the stack** — the root file's Mobile section is stale (it says SDK 51 / RN 0.74.5).

### 10.1 Skill sources and their substitutions

The RN law is merged from `animate-expo` (primary), plus `apple-design`, `impeccable`, `emil-design-eng`,
`find-animation-opportunities`, `review-animations` and `improve-animations` as the audit instruments. The
web merge's other skills keep their §2 rulings and add nothing new here.

`animate-expo` is written for **Reanimated 4 + Expo Router**, which we do not run. Three substitutions are
mandatory and non-negotiable:

- Use `runOnJS`, **not** `scheduleOnRN` (which does not exist in Reanimated 3).
- Use `.value`, **not** `.get()` / `.set()`.
- Screen transitions come from **react-navigation v6 native-stack options**; sheets from **gorhom v5**.
  `presentation: 'formSheet'`, `NativeTabs`, `Link.Menu`, `Link.Preview` and `headerLargeTitleEnabled` are
  Expo Router APIs and are **out of scope**. `react-native-keyboard-controller`, `lottie-react-native` and
  `@shopify/react-native-skia` are new dependencies and are **not added** in this campaign.

Everything else in `animate-expo` — the frequency gate, the thread rules, the property table, the Apple
spring parameters, the press rules, the haptic rules, the "Never Ship" table — binds as written.

### 10.2 New conflict rulings (RN only)

These extend Section 2. Numbering continues from it.

| # | Conflict | Ruling | Why the loser lost |
| --- | --- | --- | --- |
| 17 | `animate-expo` §3 routes half the app to Expo Router APIs and three new native packages. | **Principles bind, packages do not.** Incumbents stay: react-navigation v6, gorhom v5, `KeyboardAvoidingView`. | A navigation-library migration is a rewrite wearing a design campaign's clothes. Nothing a user can see improves. |
| 18 | HomeKrafted's RN `motion.ts:45-47` makes reduced motion **zero** ("a 40ms version of a slide is still a slide"). Our §4.6 and `animate-expo` §9 say **gentler, not zero**. | **Gentler, not zero.** Keep opacity and colour; drop translation, scale, parallax and overshoot. Screen transitions become `animation: 'fade'`, never `'none'` outside elder mode. | The user still needs to see that the interface heard them. But adopt HomeKrafted's nuance verbatim: **reduced motion keeps the press opacity and drops the press scale** — on a phone there is no hover, so the press is the whole feedback and removing it entirely reads as a dead control. |
| 19 | HomeKrafted mobile ships an `Eyebrow.tsx` primitive and an eyebrow letter-spacing token; `shared/src/constants/theme.ts:120` ships `letterSpacing.eyebrow: 1.2`; `SectionHeader.tsx:9,28,57-62` ships an `eyebrow` prop in gold. | **Ruling 2 is unchanged: zero eyebrows.** The `eyebrow` prop is removed from `SectionHeader`, the token is deleted, and the 15 hand-rolled `textTransform: 'uppercase'` micro-labels are deleted with it. | A decorative micro-label above a heading is the AI signature on any platform. Gold on a free surface is separately a §3.1 bug. |
| 20 | `apple-design`: springs for anything touchable. §2 ruling 8: durations by default. | **Ruling 8 stands, narrowed on RN: springs also win for press feedback.** A finger is literally on the element. Everything non-gestural stays on a duration. | The ruling-8 reasoning was "most of our motion is non-gestural state change". Press is the one case where that premise is false. `PressableScale` already does this correctly. |
| 21 | Web §3.4 radius system (12/16/8-12) vs the native handoff scale in `shared/src/constants/theme.ts:138-145` (sm 10 / md 14 / lg 20 / xl 28 / pill). | **RN keeps its own scale.** One system *per platform*; larger radii are the native idiom and the scale is already consistent internally. | Forcing web radii onto RN buys cross-platform pixel parity nobody asked for and costs a 68-screen diff. What §3.4 actually forbids is *multiple* systems inside one platform. |
| 22 | Web §8 bans `alert(` / `confirm(`. RN uses `Alert.alert` in 60 places across 19 files. | **`Alert.alert` is sanctioned for destructive confirmation only.** Never as an error channel (that is a toast or an inline error state), never as a success channel, never for anything the user can recover from by reading the screen. | `window.alert` is a browser artefact that blocks the page; `Alert.alert` is a real, OS-localised, VoiceOver-correct native dialog. Banning it would push destructive confirmations into hand-rolled modals, which is strictly worse. |
| 23 | `imagegen-frontend-mobile` proposes generated app-screen imagery. | **Out of scope in-app.** Ruling 15's imagery override governs web marketing surfaces. The RN app has no editorial-imagery surface. Store-listing screenshots are a separate, owner-level decision. | An interim that exists to warm up a marketing page has no equivalent inside a logged-in product. |

### 10.3 What replaces `utils/animations.js`

**`shared/src/constants/motion.ts` is the single sanctioned motion source on RN.** No component hand-rolls a
curve, a duration, a spring or a stagger. It is imported by 13 files today while 23 use Reanimated; that gap
is the Phase 1 job.

The file's current values are **wrong against this doctrine and are replaced**, not extended:

| Key | Today | Becomes | Why |
| --- | --- | --- | --- |
| `easing.std` | `[0.2, 0, 0, 1]` | — (retire; ambiguous) | Material's curve, not ours. |
| `easing.out` | `[0, 0, 0.2, 1]` | `[0.23, 1, 0.32, 1]` | §4.2's `--ease-out`. The current value is the weak built-in shape §4.2 rejects. |
| `easing.inOut` | — | `[0.77, 0, 0.175, 1]` | §4.2's `--ease-in-out`, absent today. |
| `easing.drawer` | — | `[0.32, 0.72, 0, 1]` | §4.2's `--ease-drawer`, absent today. |
| `easing.in` | `[0.4, 0, 1, 1]` | **deleted** | §4.2: ease-in is banned on UI. Its existence is an invitation. |
| `easing.spring` | `[0.34, 1.56, 0.64, 1]` | **deleted** | A back-out overshoot curve. §5 bans bounce on content; springs are springs, not béziers. |
| `duration` | `{fast:120, base:240, slow:360}` | the full table below | Three buckets cannot express thirteen interaction classes, and 360 breaks the sub-300ms ceiling. |
| `spring` | `{pop:{stiffness,damping,mass}, sheet:{…}}` | Apple two-parameter form below | `animate-expo` §5 and §10.4. |

The replacement tables:

```ts
export const EASE_OUT    = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

export const duration = {
  press: 120, hover: 0,          // there is no hover on RN; the key is absent, not zero-valued
  menu: 180, modal: 250, modalExit: 180,
  sheet: 320, sheetExit: 240,
  toast: 400, toastExit: 300,
  accordion: 200, content: 280, layout: 250,
  reveal: 280,                   // Operate surfaces only; the web's 550ms is a marketing figure
} as const;

export const spring = {
  ui:       { duration: 400, dampingRatio: 1   },            // default settle, no overshoot
  momentum: { duration: 400, dampingRatio: 0.8 },            // after a drag; pass `velocity`
  sheet:    { duration: 300, dampingRatio: 0.8 },            // pass `velocity`
  press:    { duration: 150, dampingRatio: 1   },            // press-in / press-out
} as const;

export const STAGGER_MS = 50;   // §4.3; capped at 6 siblings
```

`overshootClamping: true` wherever a hard edge must not be crossed.

**The variant layer.** `mobile/src/components/motion/` is the RN equivalent of the web's variant exports and
is the **only** place a screen gets motion from. It grows; it is not replaced:

- `PressableScale` — keep. Correct today (`spring.pop` → `spring.press`, reduce-motion-aware).
- `useReduceMotion` — keep. Subscribes live; correct.
- `useFillAnimation`, `useShake`, `usePop`, `TabIcon`, `StaggeredEntrance` — keep, retuned to the tables
  above (`StaggeredEntrance`'s 40ms stagger → 50ms; `usePop`'s 1.3 peak is an open ruling).
- **Add** `useSheet`, `useToast` and `useListRow` so no screen hand-rolls a sheet, a toast or a row
  enter/exit again.
- `RevealOnScroll` stays in `features/profile/detail/` as the **only** scroll-driven idiom in the app, and
  its translate clamps to 16px (§4.5's ceiling; it is 20 today).

**Banned inside that folder and everywhere else on RN:** core `Animated` for anything a finger touches
(`Switch.tsx` is the last holdout), `PanResponder`, bounce or elastic on content, scale-pop entrances,
parallax, scroll-scrubbed values, any variant that moves more than 16px, and infinite loops. The **only**
sanctioned loops are the four that exist: `Skeleton.tsx:36` shimmer, `ChatThreadScreen.tsx:82` typing dots,
`SplashScreen.tsx:38` loading pulse (spinner-equivalent, no skeleton is possible there),
`AudioIntroChip.tsx:41` waveform while `playing` is true. Each is opacity-only, reduce-motion-gated and
cancelled on unmount. A fifth needs a written reason.

### 10.4 Motion mechanics (carries from the original §10)

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
  re-run Yoga for the node and its siblings every frame. The one exception is an **absolutely positioned,
  childless** element such as a tab pill or a progress fill — and "absolutely positioned" is load-bearing:
  `OnboardingLayout.tsx:185` animates `width` on an in-flow child and does not qualify.
- **Android shadow is `elevation` and re-renders every frame when animated;** crossfade a pre-shadowed layer
  instead. Never animate `BlurView` intensity; crossfade a static blur (`GoldLock.tsx:51` does this correctly).
- **Tabs never slide.** They are peers, and the user pays for that motion dozens of times a session.
  `MainNavigator.tsx:136` currently sets `animation: 'shift'`; it becomes `'none'`. Elder mode keeps the
  docked tab bar, not the floating pill.
- **Springs use Reanimated's Apple-style parameters** (§10.3), never stiffness/damping/mass. Easings are
  `Easing.bezier(...EASE_OUT)`, `Easing.bezier(...EASE_IN_OUT)`, `Easing.bezier(...EASE_DRAWER)`.
- **Haptics** fire once per committed user action, on the same frame as the visual, and never as the only
  feedback: they are off system-wide for many users and silent on most Android hardware. Our
  `utils/haptics.ts` probes the native module before requiring it; keep that shape, since a static require of
  an absent native module redboxes in dev. **One emitter per action** — a custom `tabBar` that fires a haptic
  and a navigator `screenListeners` that fires another is two, and both are live today
  (`FloatingTabBar.tsx:67`, `MainNavigator.tsx:138`).
- **Verification means a release build on the slowest device we support.** Expo Go and the simulator hide
  exactly the problems this section exists to catch, and a Metro reload resets a debug build to its initial
  route, which reads as a navigation bug that is not there.

### 10.5 What replaces `dark:` classes and the `html.dark` toggle

**`useTheme()` → `makeStyles(c)` is the sanctioned mechanism and it already works.** Every screen builds its
stylesheet through `const styles = React.useMemo(() => makeStyles(c), [c])` with
`makeStyles = (c: ThemeColours) => StyleSheet.create({…})`. `useTheme()` reads the explicit override from
`uiStore` and falls back to `useColorScheme()`; `DEFAULT_DARK_MODE_OVERRIDE` is `null`, so dark follows the
system. This is settled; do not redesign it.

Three rules keep it honest:

1. **A module-scope `StyleSheet.create` may contain no colour.** Layout, spacing, radius and flex only.
   Colour arrives through `makeStyles(c)` or as an inline `{ color: c.x }`. Two leaks remain
   (`PickerSheet.tsx:88`, `Switch.tsx:48`).
2. **Never import `colours` (the light palette) into a component.** It is the light half of a pair; in dark
   mode it is simply wrong. Twelve sites do (`HomeScreen.tsx:50`, `MatchesScreen.tsx:50`,
   `ProfileDetailScreen.tsx:56`, `TickRing.tsx:131`, `ProfileCard.tsx:52`, `Switch.tsx:34`,
   `GoldLock.tsx:65,70`, `JourneyFinaleScreen.tsx:155-156`, `RootNavigator.tsx:63,67`). Six of them use
   `colours.success` — which `shared/src/constants/theme.ts:221` documents as *"unreadable as an accent on
   surfaceCard"*, which is precisely why `darkColours.successAccent` exists.
3. **Shadows are paired too.** `shadows` is burgundy-tinted for light; `darkShadows` is black-based because
   a burgundy tint disappears on navy. `Card.tsx:15` picks correctly; `Button.tsx:151,157` hardcodes the
   light `shadows.e3` / `shadows.gold` in both themes.

**Reduced transparency.** §4.6's `prefers-reduced-transparency` clause becomes
`AccessibilityInfo.isReduceTransparencyEnabled()` with a `reduceTransparencyChanged` subscription, in a
`useReduceTransparency()` hook beside `useReduceMotion()`. Any translucent or blurred surface — `GoldLock`'s
`BlurView`, the tab pill's `F2` alpha, every scrim — ships its opaque fallback in the same commit. Today the
app subscribes to `reduceMotionChanged` only.

### 10.6 What replaces `html.elder` and the type scale

This is the largest structural gap between the two platforms, and it has two halves.

**Half one: the OS already scales our type and nobody has looked.** RN's `allowFontScaling` defaults to
**on**, so every `<Text>` in the app already grows with iOS Dynamic Type and Android font size. That is
correct and must not be turned off — refusing it is an accessibility failure, and unlike the web there is no
16px-zoom problem to solve because RN does not zoom the page. What it breaks is any **fixed height**. The
app has `maxFontSizeMultiplier` in zero places.

**Half one's rule:** `maxFontSizeMultiplier` is used **only** on text inside a height-constrained row, and
its presence is a declaration that the row is height-constrained. Body copy, headings and descriptions scale
freely. Where a container must survive 200% type, `onLayout` measures it — a hardcoded height is a bug.

**Half two: elder mode is currently a tab-bar toggle, not a scale.** `elderMode` appears in 11 files and
changes tab-bar height, icon size, navigation animation and the Chat tab's presence. `utils/elderTheme.ts`
(`fontSize(elder, key)`, `tapSize(elder)`) has **one** importer, `ListRow`, which itself has **zero** users.
`useTheme()` returns `{ isDark, c }` with no scale, so `makeStyles(c)` cannot express elder type at all.

**The mechanism, when the owner approves it (see the plan's open question 1):**

- `useTheme()` returns `{ isDark, c, elder }`.
- A `<Text>` primitive at `mobile/src/components/ui/Text.tsx` is the **only** way words reach the screen. It
  takes a `variant` (the `type` roles in `shared/src/constants/theme.ts:81-93`), a `color` from a curated
  union, and an optional `maxScale`. It resolves the elder bump internally.
- The `color` union deliberately **omits gold**. Gold is a fill, a border and a rule; it is 2.9-3.2:1 as text
  and §3.1 already says gold means premium, not decoration. Making it unavailable is cheaper than
  remembering.
- Tap targets come from `tapSize(elder)` (48 / 60), not from a literal.
- Elder mode continues to drop navigation animation and keep the docked tab bar. It does **not** continue to
  hide the Chat tab silently: any tab it removes must remain reachable and every CTA pointing at it must
  still work (this was a live no-op bug, fixed 2026-08-16; the rule exists so it does not come back).

### 10.7 Safe areas, docks and chrome

- **`useSafeAreaInsets`, never `SafeAreaView` from `react-native`** (a no-op on Android). This was unified
  2026-08-16 and must not regress. `react-native-safe-area-context`'s `SafeAreaView` is acceptable where a
  whole screen is padded.
- **`components/layout/Screen.tsx` is the screen shell and currently has zero importers.** Every
  custom-header screen adopts it rather than hand-rolling insets; 28 files hand-roll them today.
- **Bottom-dock clearance is computed, never a constant.** A floating bar is inset from the bottom edge, so
  "clear of the tab bar" is not "sit at the bottom". The padding a tab screen's scroll content owes is
  `insets.bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT + trailing gap`, resolved at render because the inset is only
  known then. `useTabBarClearance.ts:11` returns a flat `92`; the pill's real height is
  `max(insets.bottom, 12) + 68`, which is **102 on every Face-ID iPhone**. Every one of the five tab screens
  hides its last ~10pt today.
- **One sheet mechanism per job, and they are named.** Three coexist:
  `@gorhom/bottom-sheet` (1 file), RN `<Modal animationType="slide">` (21 `<Modal>` across 18 files), and
  hand-rolled `TouchableOpacity` backdrops (`SearchScreen.tsx:97,140`). The law:
  **a draggable, detented sheet is gorhom**; **a full-screen takeover is native-stack `presentation: 'modal'`**;
  **a simple single-select list is `PickerSheet`** — and nothing hand-rolls a backdrop again.
  A gorhom sheet sets `uiStore.bottomSheetOpen` so the absolutely-positioned pill does not draw over its
  footer CTAs (`FilterPanel.tsx:272-277` is the reference implementation). An RN `<Modal>` renders in its own
  native window above the pill and does **not** need the flag — verified, not assumed.
- **Icons: `@expo/vector-icons` Ionicons only, one family, one weight.** The web's `react-icons/fi` does not
  cross over. No emoji as an icon, ever.

### 10.8 Component law (RN)

Everything in Section 6 carries. These are the RN-specific additions and amendments.

**Pressables.** `PressableScale` is the default; `TouchableOpacity` is legacy and is retired
(232 uses / 60 files today). An opacity fade is not press feedback on a custom-designed app — `scale: 0.97`
takes the label and the icon with it, which is what reads as physical. Android ripple only in a
Material-styled app; we are not one. Every pressable carries `accessibilityRole`, an `accessibilityLabel`,
`accessibilityState` where it has one, `hitSlop` where the visual is under 44x44pt, and
`pressRetentionOffset`.

**Hit targets.** 44x44pt minimum (48dp Android), 60pt in elder mode. If the visual is smaller, **pad the
target with `hitSlop`, do not grow the mark.** Because `hitSlop` is invisible to the accessibility tree and
to any measuring sweep, a control that pays for its target in `hitSlop` **declares it** with the
`tap44-hitslop` marker in its `testID`, so the audit can count it as a claim rather than report it as a
violation. Only tag a control whose `hitSlop` genuinely reaches 44pt in both directions.

**Buttons.** One `Button` primitive. `size="sm"` is 38pt tall today and either grows to 44 or carries
`hitSlop`. Haptics do not default to on for every press — a light haptic on a navigation tap is noise; it
belongs on commits.

**Cards.** `Card` declares elevation **once**: border **or** shadow. `Card.tsx` declares both, which makes
every card in the app a ghost card. Same at `FloatingTabBar.tsx:110-127`.

**Inputs.** The `Input` primitive is the only way a text field is built. 50 raw `<TextInput>` across 29 files
are the reason error, helper and label treatment differ screen to screen. Label above the input, always;
helper text present in markup even when empty; error below the input naming the problem and the recovery;
validate on blur and on submit.

**Section headers.** `SectionHeader` loses its `eyebrow` prop (ruling 19).

**Loading.** Skeletons that match the final layout's shape. `SkeletonBlock` has 43 uses in 5 files; every
other list and detail screen needs one. Shimmer freezes to a flat tint under reduced motion.

**Lists.** Every `FlatList` over ~20 rows declares `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`
and `removeClippedSubviews`, and `getItemLayout` wherever row height is fixed. The app has 20 `FlatList`s and
**one** `getItemLayout`. A browse product that janks on a mid-range Android has failed, whatever it looks
like in a screenshot. `entering` animations never go on a virtualized row — animate the container, or use
`itemLayoutAnimation`.

**Dialogs.** `Alert.alert` for destructive confirmation only (ruling 22). Errors are toasts or inline error
states; successes are toasts. A flow that ends in an error alert is non-functional UI and store reviewers
treat it as such.

**Gestures.** Any gesture-dependent action ships a visible tap fallback. A swipe-to-reply with no tap
equivalent excludes users with motor impairments and is invisible to VoiceOver.

### 10.9 Copy and data law on RN

Section 7 carries unchanged. Two RN-specific additions:

- **Never fall back to a static catalogue.** A price, a plan, a count or an offer comes from the server or
  the screen shows its loading and error states. `SubscriptionScreen.tsx:550`'s
  `plans ?? Object.values(PLANS)` renders five withdrawn tiers at their regular prices against a live
  single-plan catalogue — buyable in the UI, refused at checkout. This is the same defect the web fixed in
  its Phase 0, and it is the reason the rule is written as an absolute.
- **A screen with no error branch has an invisible error state.** `isError` is destructured and rendered, or
  the screen is not done.

### 10.10 Pre-flight checklist (the RN §9)

No screen is done until every line is honestly ticked, **on a device or simulator**, not from source. Source
reading produces hypotheses; a rendered screen produces findings.

**States**
- [ ] Default, loading (skeleton matching the layout), empty (icon + line + action), error (icon + cause +
      working retry) all exist and were **seen**.
- [ ] Premium-gated views additionally have the locked state, and the gate never fakes a count or a photo.
- [ ] Offline was tested: airplane mode on, then off. `OfflineBanner` shows, retry recovers.
- [ ] Long content, missing content, and a 30% longer hi/pa string all render without clipping or wrapping a
      control onto a second line.

**Motion**
- [ ] Every animation's frequency tier and purpose word can be stated in one line.
- [ ] Curve, duration, spring and stagger come from `shared/src/constants/motion.ts`. Nothing hand-rolled.
- [ ] Motion runs on the UI thread: no `setState` in a gesture or scroll handler, no `runOnJS` in `onUpdate`,
      no shared-value read or write during render, `'worklet'` on every worklet-called function.
- [ ] No layout property is animated on an in-flow node.
- [ ] Exits are faster than entrances and follow the entry path.
- [ ] **Reduce Motion toggled on in OS settings** and the screen still explains itself. Press feedback
      survives as opacity.
- [ ] Press feedback exists on every pressable; nothing relies on hover.
- [ ] One haptic per committed action, on the same frame as the visual, never the only feedback.

**Themes and scales**
- [ ] Dark mode checked by flipping the **system** setting, not the in-app override. Headings, muted text,
      borders, shadows and every semantic colour still read.
- [ ] Elder mode checked: nothing overlaps, every target ≥60pt, no tab or CTA became a no-op.
- [ ] **OS text size at maximum** checked. Nothing clips, no fixed-height row swallows its label.
- [ ] **Reduce Transparency toggled on**: every blur and translucent surface is solid.
- [ ] Checked on the smallest supported screen and on a tablet-width window; both platforms.
- [ ] Bottom content clears the floating pill; top content clears the status bar and the notch.

**Access**
- [ ] **VoiceOver on iOS and TalkBack on Android**: every control is reachable and announces a meaningful
      label, a correct `accessibilityRole`, and its `accessibilityState` where it has one. Focus-visible does
      not exist on a touch OS — this replaces it, and it is not optional.
- [ ] Decorative groups are hidden (`accessibilityElementsHidden` +
      `importantForAccessibility="no-hide-descendants"`), so the screen reader does not read the wallpaper.
- [ ] Anything that updates without a tap announces (`accessibilityLiveRegion`, or
      `AccessibilityInfo.announceForAccessibility`).
- [ ] Every target ≥44x44pt, or it carries `hitSlop` **and** the `tap44-hitslop` marker.
- [ ] Every gesture has a visible tap fallback.
- [ ] Contrast measured on the real surfaces, including text over photo scrims and inside gold and burgundy
      fills.
- [ ] Squint test: primary, secondary and groups still identifiable in order.

**Craft**
- [ ] No pattern from §10.11 was introduced.
- [ ] Copy re-read against §7 and §10.9. No fabricated number, price, person or offer.
- [ ] Elevation declared once per element; radius from the RN system; one accent; one icon family.
- [ ] Built with the shared primitives. A new component needs a reason an existing one cannot serve.
- [ ] Console clean, no redbox, no yellowbox, no `key` warning, and the screen was seen in a **release**
      build before it is called done.

### 10.11 Banned patterns on RN

Counts are the census taken 2026-09-18 against `mobile/src`. They are the size of the cleanup, not a licence.

| Pattern | Grep | Today | Replace with |
| --- | --- | --- | --- |
| Opacity-fade press | `<TouchableOpacity` | 232 in 60 files | `PressableScale` |
| Raw text field | `<TextInput` outside `ui/Input.tsx` | 50 in 29 files | the `Input` primitive |
| Hand-rolled screen shell | `useSafeAreaInsets` outside `layout/Screen.tsx` | 28 files | the `Screen` primitive |
| Hand-rolled motion | `withTiming(` / `withSpring(` with a literal duration or `Easing.*` not from the token file | 10 files | `shared/src/constants/motion.ts` |
| Light palette in a component | `colours.` (not `darkColours`, not `ThemeColours`) | 12 sites | `const { c } = useTheme()` |
| Light shadow in dark mode | `shadows.` without an `isDark` branch | `Button.tsx:151,157` | `isDark ? darkShadows : shadows` |
| Ghost card | `borderWidth` and a shadow or `elevation` on one element | `Card.tsx`, `FloatingTabBar.tsx` | pick one |
| Eyebrow label | `textTransform: 'uppercase'` on a micro-label; `SectionHeader` `eyebrow` prop | 15 + 1 prop | delete |
| Gold outside premium | `g300`–`g700` on a score, a meter, a free-tier badge or any text | 5 files | `c.accent` or a neutral |
| Tab slide | `animation: 'shift'` / `'slide'` on a tab navigator | `MainNavigator.tsx:136` | `'none'` |
| Duplicate haptic | two emitters for one action | tab press | one emitter |
| Core `Animated` | `Animated` imported from `'react-native'` | `Switch.tsx` | Reanimated |
| Animated layout property | `width`/`height`/`margin`/`padding`/`flex` in a `useAnimatedStyle` on an in-flow node | `OnboardingLayout.tsx:185` | absolute + childless, or `transform` |
| Flat dock constant | a literal bottom padding for the tab bar | `useTabBarClearance.ts:11` | computed from `insets.bottom` |
| Hand-rolled sheet | a `TouchableOpacity` backdrop | `SearchScreen.tsx:97,140` | gorhom, `presentation:'modal'`, or `PickerSheet` |
| Unconfigured long list | `<FlatList` with no `windowSize` / `maxToRenderPerBatch` / `removeClippedSubviews` | ~20 | configure it |
| Uncapped scaling in a fixed row | a `height`/`minHeight` with no `maxFontSizeMultiplier` on its text | app-wide | measure, or cap |
| Static catalogue fallback | `?? PLANS`, `?? DEFAULT_*` for anything priced | `SubscriptionScreen.tsx:550` | loading + error states |
| Missing error branch | a `useQuery` whose `isError` is never rendered | many | render it |
| `Alert.alert` as an error or success channel | `Alert.alert` outside destructive confirmation | 60 in 19 files | toast or inline state |
| Emoji as icon | any emoji in JSX | — | Ionicons |
| `scale(0)` entrance | `scale: 0` in an initial value | — | `0.95` + `opacity: 0` |
| Untagged small target | a pressable under 44pt with `hitSlop` and no `tap44-hitslop` marker | — | tag it |
| Comment that describes an intention | e.g. `FloatingTabBar.tsx:4-5` claims a blur the file does not implement | 3 known | make it true or delete it |
