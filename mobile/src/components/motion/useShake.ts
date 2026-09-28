import { useCallback } from 'react';
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { haptics } from '../../utils/haptics';
import { useReduceMotion } from './useReduceMotion';

// A choreographed micro-sequence, not a single named interaction from the
// shared duration table (doctrine §10.3) — kept as its own named constant
// rather than mis-mapped onto an unrelated bucket.
const SHAKE_STEP_MS = 50;

/**
 * Horizontal error-shake (translateX ±6, 3×) + warning haptic — handoff
 * form-field error idiom. Returns an animated style to spread on the field and
 * a `shake()` trigger (referentially stable, so it can sit in an effect's
 * dependency list). Reduce-motion skips the shake but still fires the haptic.
 */
export function useShake() {
  const reduced = useReduceMotion();
  const x = useSharedValue(0);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const shake = useCallback(() => {
    haptics.warning();
    if (reduced) return;
    x.value = withSequence(
      withTiming(-6, { duration: SHAKE_STEP_MS }),
      withTiming(6, { duration: SHAKE_STEP_MS }),
      withTiming(-6, { duration: SHAKE_STEP_MS }),
      withTiming(6, { duration: SHAKE_STEP_MS }),
      withTiming(0, { duration: SHAKE_STEP_MS }),
    );
  }, [reduced, x]);

  return { style, shake };
}
