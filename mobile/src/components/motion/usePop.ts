import { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { spring } from '@shared/constants/motion';
import { useReduceMotion } from './useReduceMotion';

/**
 * Icon scale-pop (1 → `peak` → 1, `spring.pop`) — the handoff like/shortlist tap
 * idiom (icon fill + scale-pop + success haptic; haptic fired by the caller).
 * Returns an animated style for the icon wrapper and a `pop()` trigger.
 */
export function usePop(peak = 1.3) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pop = () => {
    if (reduced) return;
    scale.value = withSequence(withSpring(peak, spring.pop), withSpring(1, spring.pop));
  };
  return { style, pop };
}
