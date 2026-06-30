import React from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from '@shared/constants/motion';
import { haptics } from '../../utils/haptics';
import { useReduceMotion } from './useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  /** press-in target scale (handoff spec: 0.97 for cards/rows) */
  scaleTo?: number;
  /** fire a light selection haptic on press-in */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Press-in scale-down + spring-back (handoff `spring.pop`) — the standard
 * native press idiom for cards, rows and CTAs. Honours reduce-motion (no scale).
 */
export default function PressableScale({
  scaleTo = 0.97,
  haptic = false,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleIn = (e: GestureResponderEvent) => {
    if (!reduced) scale.value = withSpring(scaleTo, spring.pop);
    if (haptic) haptics.light();
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    if (!reduced) scale.value = withSpring(1, spring.pop);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
