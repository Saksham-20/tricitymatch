/**
 * Motion standard — the ONLY allowed import path for framer-motion variants.
 *
 * Rules (2026-07 refinement pass):
 *  - Content entrances: opacity + rise ≤8px, 200–300ms, easeOut, animate once.
 *  - Exits: 150–200ms fade-only (no movement) so leaving content never bounces.
 *  - Stagger: ≤60ms between children; cap long lists with `staggerIndex()` so
 *    the 30th card never waits seconds to appear.
 *  - No bounce/spring/scale-pop on CONTENT. Springs remain the correct idiom
 *    for overlays, bottom sheets, and tab indicators — those live inline in
 *    their components (FilterPanel, BottomNav, Navbar), not here.
 *  - Reduced motion is handled globally (MotionConfig reducedMotion="user" in
 *    App.jsx + the prefers-reduced-motion CSS block in index.css).
 */

const EASE_OUT = [0.25, 0.46, 0.45, 0.94];

/** Standard content entrance: fade + 8px rise. */
export const fadeRise = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: EASE_OUT },
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
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
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

/** @deprecated legacy name — resolves to the standard entrance. */
export const fadeInUp = fadeRise;
