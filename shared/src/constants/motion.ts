// ============================================================================
// Motion tokens — the RN mobile app's sole motion source (doctrine
// DOCTRINE_2026-09.md §10.3). No component hand-rolls a curve, a duration, a
// spring or a stagger; everything below is imported, never re-typed.
//
// Curves are cubic-bezier control points → feed to Reanimated
// `Easing.bezier(...EASE_OUT)`. Springs are Reanimated's Apple-style
// two-parameter form (`{ duration, dampingRatio }`, optionally `velocity`),
// never stiffness/damping/mass. Honour reduce-motion: when
// AccessibilityInfo.isReduceMotionEnabled, motion is gentler, not zero — keep
// opacity/colour, drop translation/scale/parallax/overshoot (doctrine §10.2
// ruling 18).
// ============================================================================

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
// No EASE_IN export: ease-in is banned on UI motion (doctrine §4.2) — its
// existence in the old `easing.in` was an invitation to misuse it.

export const duration = {
  press: 120,
  // hover has no RN equivalent — the key is deliberately absent, not zero.
  menu: 180,
  modal: 250,
  modalExit: 180,
  sheet: 320,
  sheetExit: 240,
  toast: 400,
  toastExit: 300,
  accordion: 200,
  content: 280,
  layout: 250,
  reveal: 280, // Operate surfaces only (e.g. ProfileDetail scroll-reveal)
} as const;

export const spring = {
  ui: { duration: 400, dampingRatio: 1 }, // default settle, no overshoot
  momentum: { duration: 400, dampingRatio: 0.8 }, // after a drag; pass `velocity`
  sheet: { duration: 300, dampingRatio: 0.8 }, // pass `velocity`
  press: { duration: 150, dampingRatio: 1 }, // press-in / press-out; also wins for any tap-triggered feedback (doctrine ruling 20)
} as const;

/** §4.3 stagger interval; caps at 6 siblings. */
export const STAGGER_MS = 50;

// expo-haptics method names — see mobile/src/utils/haptics.ts for the wrapper.
export const haptic = {
  light:   'selection',          // tab switch, chip/segmented toggle, slider step, send
  success: 'success',            // interest sent, mutual match, payment success
  warning: 'warning',            // form error shake, 429 lockout
  medium:  'medium',             // long-press reveal, incoming call
} as const;

export type HapticKind = keyof typeof haptic;
