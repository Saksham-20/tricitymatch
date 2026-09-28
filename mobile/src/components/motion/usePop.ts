import { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { spring } from '@shared/constants/motion';
import { useReduceMotion } from './useReduceMotion';

/**
 * Icon scale-pop (1 → `peak` → 1, `spring.press`) — the handoff like/shortlist
 * tap idiom (icon fill + scale-pop + success haptic; haptic fired by the
 * caller). Returns an animated style for the icon wrapper and a `pop()`
 * trigger. Open question 8 is settled: a like/shortlist is a plain tap that
 * carries no gesture momentum, so it does not earn a 1.3× overshoot (§4.4,
 * ruling 20); the default peak is a restrained 1.12.
 */
export function usePop(peak = 1.12) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pop = () => {
    if (reduced) return;
    scale.value = withSequence(withSpring(peak, spring.press), withSpring(1, spring.press));
  };
  return { style, pop };
}
