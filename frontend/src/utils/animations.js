/**
 * Motion standard — the ONLY allowed import path for framer-motion variants.
 *
 * Rules (2026-09 doctrine pass — see docs/design-handoff/DOCTRINE_2026-09.md §4-5):
 *  - Content entrances: opacity + rise ≤8px, 200–300ms, EASE_OUT, animate once.
 *  - Exits: 150–200ms fade-only (no movement) so leaving content never bounces,
 *    and exits are always faster than the matching entrance.
 *  - Stagger: ≤60ms between children; cap long lists with `staggerIndex()` so
 *    the 30th card never waits seconds to appear.
 *  - No bounce/spring/scale-pop on CONTENT, ever. Springs are reserved for
 *    surfaces a finger actually drives — drag-to-dismiss, a draggable sheet,
 *    a swipe row — never for something that merely faded or slid in on its
 *    own. That is `SPRING` below; everything else here is duration-based.
 *  - No infinite loops, no parallax, no scroll-scrubbed values, no
 *    `transition: all`, and nothing that moves more than 16px. An element
 *    that breathes while the user reads it is noise, not motion.
 *  - Reduced motion is handled globally (MotionConfig reducedMotion="user" in
 *    App.jsx + the prefers-reduced-motion CSS block in index.css). Reduced
 *    motion means gentler, not zero — do not special-case it per variant here.
 *
 * EASE_OUT was corrected in the 2026-09 doctrine pass: the old value
 * [0.25, 0.46, 0.45, 0.94] was a weak quadratic that undersold every
 * entrance. [0.23, 1, 0.32, 1] is the strong ease-out the rest of the app's
 * durations were always tuned against. Durations did not change with it.
 */

export const EASE_OUT = [0.23, 1, 0.32, 1];

/** On-screen movement, layout shifts, tab indicators — things that move
 *  between two visible states rather than entering or exiting the page. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1];

/** Sheets and drawers only — the iOS-style curve that makes a bottom sheet
 *  feel like it is being pulled up rather than just faded into place. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1];

/**
 * Duration table, seconds, doctrine §4.3. One name per interaction class so
 * nobody hand-types a duration that drifts from the rest of the app. Every
 * value here is a ceiling reason, not a starting guess — UI motion stays
 * under 300ms; anything longer (`reveal`) is marketing-only and fires once.
 */
export const DUR = {
  press: 0.12,
  hover: 0.16,
  tooltip: 0.125,
  menu: 0.18,
  modal: 0.25,
  modalExit: 0.18,
  sheet: 0.32,
  sheetExit: 0.24,
  toast: 0.4,
  toastExit: 0.3,
  accordion: 0.2,
  content: 0.28,
  page: 0.18,
  layout: 0.25,
  reveal: 0.55,
};

/**
 * Springs — doctrine §4.4. Reserved for the narrow case a duration curve
 * can't serve: a value a finger is actively driving (drag-to-dismiss, a
 * draggable sheet, a thrown swipe row). `ui` is critically damped (no
 * overshoot) and is the correct default even for gesture surfaces that
 * settle on their own; `momentum` only follows an actual flick or throw,
 * because overshoot on something that merely faded in reads as a bug.
 */
export const SPRING = {
  ui: { type: 'spring', duration: 0.4, bounce: 0 },
  momentum: { type: 'spring', duration: 0.4, bounce: 0.2 },
  sheet: { type: 'spring', duration: 0.35, bounce: 0.15 },
};

/** Standard content entrance: fade + 8px rise. */
export const fadeRise = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.content, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
};

/** Fade only — for skeleton→content swaps and low-emphasis elements. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.24, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: 'easeOut' } },
};

/** Route/page-level fade for phase swaps inside AnimatePresence. */
export const pageFade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.page, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: 'easeOut' } },
};

/** Parent container that staggers `fadeRise` children. */
export const staggerContainer = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
  exit: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
};

/**
 * Per-item delay for manually staggered lists (grids that re-render on
 * filter/refetch). Caps the wave at 6 items so long pages never queue
 * second-long entrances, and re-sorted items don't ripple forever.
 */
export const staggerIndex = (index, step = 0.05, cap = 6) => (index % cap) * step;

/**
 * Directional step transition for wizards (onboarding Back vs Next).
 * Use with AnimatePresence custom={direction} where direction is 1 (next)
 * or -1 (back).
 */
export const stepSlide = {
  initial: (direction = 1) => ({ opacity: 0, x: 16 * direction }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.24, ease: EASE_OUT } },
  exit: (direction = 1) => ({ opacity: 0, x: -12 * direction, transition: { duration: 0.16, ease: 'easeOut' } }),
};

/**
 * Origin-aware menu, dropdown and popover entrance. The caller supplies
 * `transform-origin` (via style or the `motion.div style={{ transformOrigin }}`
 * prop) pinned to the trigger element — this variant only owns scale/opacity.
 * Modals are the doctrine's one exception and use `modal` below instead,
 * because they are not anchored to a trigger and stay centered.
 */
export const popIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: DUR.menu, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.14, ease: 'easeOut' } },
};

/** Same shape as `popIn`, faster — for tooltips and other small popovers
 *  that need to feel instant rather than deliberate. */
export const tooltip = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: DUR.tooltip, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: DUR.tooltip, ease: 'easeOut' } },
};

/** Modal content. Centered origin by design (doctrine's stated exception —
 *  a modal isn't anchored to a trigger the way a popover is). Pair with
 *  `backdrop` for the scrim. */
export const modal = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: DUR.modal, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: DUR.modalExit, ease: 'easeOut' } },
};

/** Modal backdrop/scrim — opacity only, stepped to the modal's own timing
 *  so the dim and the content never feel like two separate events. */
export const backdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.modal, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: DUR.modalExit, ease: 'easeOut' } },
};

/** Bottom sheet / drawer: rises from its own height on the drawer curve.
 *  Percentage transform so it works regardless of the sheet's actual
 *  height. Exit is faster and follows the same edge it entered. */
export const sheet = {
  initial: { transform: 'translateY(100%)' },
  animate: { transform: 'translateY(0%)', transition: { duration: DUR.sheet, ease: EASE_DRAWER } },
  exit: { transform: 'translateY(100%)', transition: { duration: DUR.sheetExit, ease: EASE_DRAWER } },
};

/** Draggable variant of `sheet` — once the surface is finger-driven (drag
 *  to dismiss, rubber-band past the open position), hand it off to
 *  `SPRING.sheet` instead of the duration curve, so a release carries the
 *  gesture's velocity instead of snapping to a fixed timeline. */
export const sheetDrag = {
  initial: { transform: 'translateY(100%)' },
  animate: { transform: 'translateY(0%)', transition: SPRING.sheet },
  exit: { transform: 'translateY(100%)', transition: SPRING.sheet },
};

/** Toast: enters and exits the SAME edge (doctrine — symmetric paths make
 *  the motion legible). `ease`, not EASE_OUT — a toast is announced, not
 *  urgently entering, and the plain browser ease reads calmer here. */
export const toast = {
  initial: { opacity: 0, transform: 'translateY(100%)' },
  animate: { opacity: 1, transform: 'translateY(0%)', transition: { duration: DUR.toast, ease: 'easeOut' } },
  exit: { opacity: 0, transform: 'translateY(100%)', transition: { duration: DUR.toastExit, ease: 'easeOut' } },
};

/**
 * Rows that appear and disappear in place — chat messages, notifications,
 * a shortlist toggling a card in and out. Deliberately transition-based
 * (a `transition` object, not a `@keyframes`-backed animation) so a user
 * sending a second message inside a second retargets the in-flight motion
 * instead of restarting it from zero — the same reason toasts use
 * transitions rather than keyframes.
 */
export const listRow = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.content, ease: EASE_OUT } },
  exit: { opacity: 0, y: 0, transition: { duration: 0.16, ease: 'easeOut' } },
};

/**
 * Marketing-only scroll reveal. Fires once, never re-triggers on scroll-back
 * (doctrine bans scroll-scrubbed/parallax motion entirely — this is a single
 * settle, not a scrub). Spread `revealOnce` onto a `motion.*` element:
 * `<motion.div {...revealOnce} />`. Never use outside Persuade surfaces
 * (Home, About, Safety, Success Stories, Help, city/community pages).
 */
export const revealOnce = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0, transition: { duration: DUR.reveal, ease: EASE_IN_OUT } },
  viewport: { once: true, amount: 0.3, margin: '-100px' },
};

/** @deprecated legacy name — resolves to the standard entrance. */
export const fadeInUp = fadeRise;
