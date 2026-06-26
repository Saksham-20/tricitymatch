// ============================================================================
// Motion tokens — ported from the native handoff. Reanimated-buildable.
// Durations in ms; easing as cubic-bezier control points; springs as
// react-native-reanimated `withSpring` configs.
// Honour reduce-motion: when AccessibilityInfo.isReduceMotionEnabled, skip
// entrance animations and jump to the end state.
// ============================================================================

export const duration = {
  fast: 120,
  base: 240,
  slow: 360,
} as const;

// cubic-bezier control points → feed to Reanimated `Easing.bezier(...EASING.std)`
export const easing = {
  std: [0.2, 0.0, 0.0, 1.0] as const,
  in:  [0.4, 0.0, 1.0, 1.0] as const,
  out: [0.0, 0.0, 0.2, 1.0] as const,
  spring: [0.34, 1.56, 0.64, 1.0] as const,
} as const;

// withSpring configs
export const spring = {
  pop:   { stiffness: 380, damping: 18, mass: 1 },
  sheet: { stiffness: 240, damping: 28, mass: 1 },
} as const;

// expo-haptics method names — see mobile/src/utils/haptics.ts for the wrapper.
export const haptic = {
  light:   'selection',          // tab switch, chip/segmented toggle, slider step, send
  success: 'success',            // interest sent, mutual match, payment success
  warning: 'warning',            // form error shake, 429 lockout
  medium:  'medium',             // long-press reveal, incoming call
} as const;

export type HapticKind = keyof typeof haptic;
