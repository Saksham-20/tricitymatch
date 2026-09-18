import { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { spring } from '@shared/constants/motion';
import { useReduceMotion } from './useReduceMotion';

/**
 * Icon scale-pop (1 → `peak` → 1, `spring.press`) — the handoff like/shortlist
 * tap idiom (icon fill + scale-pop + success haptic; haptic fired by the
 * caller). Returns an animated style for the icon wrapper and a `pop()`
 * trigger. `peak=1.3` is doctrine §10 open question 8 (a 1.3× overshoot on a
 * non-gestural tap, against §4.4) — undecided; kept at its shipped value
 * pending that ruling, only the spring source was migrated here.
 */
export function usePop(peak = 1.3) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pop = () => {
    if (reduced) return;
    scale.value = withSequence(withSpring(peak, spring.press), withSpring(1, spring.press));
  };
  return { style, pop };
}
