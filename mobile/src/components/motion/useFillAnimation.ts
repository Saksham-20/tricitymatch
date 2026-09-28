import { useEffect, useRef } from 'react';
import { Easing, SharedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { useReduceMotion } from './useReduceMotion';

interface FillOpts {
  /** ms; defaults to `duration.content` (280) */
  durationMs?: number;
  /** ms delay before the FIRST fill begins — used to stagger guna bars (40ms each) */
  delayMs?: number;
}

/**
 * Animates a shared value up to `toValue` — from empty on first mount, then
 * from wherever it currently is whenever `toValue` changes. `duration.content`
 * ease-out — the "fill on view" idiom for the compat ring, completion ring,
 * guna bars and password-strength bar. Reduce-motion jumps straight to the end
 * value. Consume the returned SharedValue in a
 * `useAnimatedStyle`/`useAnimatedProps`.
 *
 * Only the first fill starts from zero. A ring that is seeded from a cached
 * figure and then corrected by the live query used to fill, empty and refill;
 * it now simply eases from the seed to the corrected value. Only the first
 * fill carries `delayMs` (the stagger is an entrance idiom, not an update one).
 */
export function useFillAnimation(toValue: number, opts: FillOpts = {}): SharedValue<number> {
  const { durationMs = duration.content, delayMs = 0 } = opts;
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  const filled = useRef(false);

  useEffect(() => {
    if (reduced) {
      progress.value = toValue;
      filled.current = true;
      return;
    }
    const first = !filled.current;
    filled.current = true;
    if (first) progress.value = 0;
    progress.value = withDelay(
      first ? delayMs : 0,
      withTiming(toValue, { duration: durationMs, easing: Easing.bezier(...EASE_OUT) }),
    );
  }, [toValue, durationMs, delayMs, reduced, progress]);

  return progress;
}
