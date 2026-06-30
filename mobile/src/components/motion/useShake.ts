import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { haptics } from '../../utils/haptics';
import { useReduceMotion } from './useReduceMotion';

/**
 * Horizontal error-shake (translateX ±6, 3×) + warning haptic — handoff
 * form-field error idiom. Returns an animated style to spread on the field and
 * a `shake()` trigger. Reduce-motion skips the shake but still fires the haptic.
 */
export function useShake() {
  const reduced = useReduceMotion();
  const x = useSharedValue(0);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const shake = () => {
    haptics.warning();
    if (reduced) return;
    x.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  return { style, shake };
}
