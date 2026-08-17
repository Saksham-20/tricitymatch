import React, { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { spring } from '@shared/constants/motion';
import { useReduceMotion } from './useReduceMotion';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconName;
  size: number;
  color: string;
  focused: boolean;
}

/** Bottom-tab icon with a small spring pop when the tab gains focus. */
export default function TabIcon({ name, size, color, focused }: TabIconProps) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (focused && !reduced) {
      scale.value = 0.82;
      scale.value = withSpring(1, spring.pop);
    }
  }, [focused, reduced, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
