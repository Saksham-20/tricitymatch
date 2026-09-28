import React from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { duration, EASE_OUT, spring } from '@shared/constants/motion';
import { haptics } from '../../utils/haptics';
import { useReduceMotion } from './useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Opacity press feedback under reduce-motion (doctrine §10.2 ruling 18). */
const REDUCED_PRESS_OPACITY = 0.6;

interface PressableScaleProps extends PressableProps {
  /** press-in target scale (handoff spec: 0.97 for cards/rows) */
  scaleTo?: number;
  /**
   * Fire a light selection haptic when the press COMMITS (finger lifts inside
   * the target, on the same frame as the caller's `onPress`). Never on
   * touch-down: a finger landing to scroll a chip row must not buzz, and a
   * press that drifts out and cancels must not buzz for nothing.
   */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Press-in scale-down + spring-back (`spring.press`) — the standard native
 * press idiom for cards, rows and CTAs. Under reduce-motion the scale drops
 * but the press still reads: opacity dims instead (doctrine §10.2 ruling 18
 * — "the press is the whole feedback" on a touch OS with no hover).
 */
export default function PressableScale({
  scaleTo = 0.97,
  haptic = false,
  style,
  children,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleIn = (e: GestureResponderEvent) => {
    if (reduced) {
      opacity.value = withTiming(REDUCED_PRESS_OPACITY, { duration: duration.press, easing: Easing.bezier(...EASE_OUT) });
    } else {
      scale.value = withSpring(scaleTo, spring.press);
    }
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    if (reduced) {
      opacity.value = withTiming(1, { duration: duration.press, easing: Easing.bezier(...EASE_OUT) });
    } else {
      scale.value = withSpring(1, spring.press);
    }
    onPressOut?.(e);
  };
  // Commit, not touch-down. A press with no handler is not a commitment, so it
  // stays silent even with `haptic` set.
  const handlePress = onPress
    ? (e: GestureResponderEvent) => {
        if (haptic) haptics.light();
        onPress(e);
      }
    : undefined;

  return (
    <AnimatedPressable
      {...rest}
      onPress={handlePress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
