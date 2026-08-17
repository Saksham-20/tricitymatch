import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, Easing } from 'react-native-reanimated';
import { duration, easing } from '@shared/constants/motion';
import { useReduceMotion } from './useReduceMotion';

interface StaggeredEntranceProps {
  /** Position in the entrance sequence — 40ms stagger per index (capped ×6). */
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Screen-entrance choreography: fade-rise (translateY 16 → 0) over dur.base
 * with a 40ms stagger. Doctrine: apply to a screen's PRIMARY content blocks on
 * first paint only — never to recycled FlatList rows, never re-firing on tab
 * refocus. Reduce-motion renders statically.
 */
export default function StaggeredEntrance({ index = 0, children, style }: StaggeredEntranceProps) {
  const reduced = useReduceMotion();
  if (reduced) return <View style={style}>{children}</View>;
  return (
    <Animated.View
      entering={FadeInDown.duration(duration.base)
        .delay(Math.min(index, 6) * 40)
        .easing(Easing.bezier(...easing.std).factory())}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
