import { useEffect } from 'react';
import { Easing, SharedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { duration, easing } from '@shared/constants/motion';
import { useReduceMotion } from './useReduceMotion';

interface FillOpts {
  /** ms; defaults to handoff `duration.slow` (360) */
  durationMs?: number;
  /** ms delay before fill begins — used to stagger guna bars (40ms each) */
  delayMs?: number;
}

/**
 * Animates a shared value 0 → `toValue` once on mount (and on value change),
 * `duration.slow` ease-out — the handoff "fill on view" idiom for the compat
 * ring, completion ring, guna bars and password-strength bar. Reduce-motion
 * jumps straight to the end value. Consume the returned SharedValue in a
 * `useAnimatedStyle`/`useAnimatedProps`.
 */
export function useFillAnimation(toValue: number, opts: FillOpts = {}): SharedValue<number> {
  const { durationMs = duration.slow, delayMs = 0 } = opts;
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = toValue;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withTiming(toValue, { duration: durationMs, easing: Easing.bezier(...easing.out) }),
    );
  }, [toValue, durationMs, delayMs, reduced, progress]);

  return progress;
}
