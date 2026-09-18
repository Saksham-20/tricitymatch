import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, Easing } from 'react-native-reanimated';
import { duration, EASE_OUT, STAGGER_MS } from '@shared/constants/motion';
import { useReduceMotion } from './useReduceMotion';

interface StaggeredEntranceProps {
  /** Position in the entrance sequence — STAGGER_MS (50ms) per index, capped ×6. */
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Screen-entrance choreography: fade-rise (translateY 16 → 0) over
 * duration.content with a 50ms stagger (doctrine §4.3). Doctrine: apply to a
 * screen's PRIMARY content blocks on first paint only — never to recycled
 * FlatList rows, never re-firing on tab refocus. Reduce-motion renders
 * statically.
 */
export default function StaggeredEntrance({ index = 0, children, style }: StaggeredEntranceProps) {
  const reduced = useReduceMotion();
  if (reduced) return <View style={style}>{children}</View>;
  return (
    <Animated.View
      entering={FadeInDown.duration(duration.content)
        .delay(Math.min(index, 6) * STAGGER_MS)
        .easing(Easing.bezier(...EASE_OUT).factory())}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
