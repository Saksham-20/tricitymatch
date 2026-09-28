import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, Easing } from 'react-native-reanimated';
import { duration, EASE_OUT, STAGGER_MS } from '@shared/constants/motion';
import { useUIStore } from '../../stores/uiStore';
import { useReduceMotion } from './useReduceMotion';

/** Reanimated's stock FadeInDown rises 25pt; doctrine §4.5 caps translation at 16. */
const RISE_PX = 12;

interface StaggeredEntranceProps {
  /** Position in the entrance sequence — STAGGER_MS (50ms) per index, capped ×6. */
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Screen-entrance choreography: fade-rise (translateY 12 → 0) over
 * duration.content with a 50ms stagger (doctrine §4.3). Doctrine: apply to a
 * screen's PRIMARY content blocks on first paint only, on RARE surfaces —
 * never to recycled FlatList rows, never re-firing on tab refocus, never on a
 * screen the member opens tens of times a day (the native push already
 * animates it). Reduce-motion renders statically.
 *
 * ONE element type in both branches: swapping View for Animated.View on the
 * reduce-motion flag would unmount and remount the whole subtree whenever the
 * flag resolved or flipped.
 */
export default function StaggeredEntrance({ index = 0, children, style }: StaggeredEntranceProps) {
  // Elder mode carries no motion beyond opacity, same as the OS setting: static here.
  const osReduced = useReduceMotion();
  const elderMode = useUIStore((s) => s.elderMode);
  const reduced = osReduced || elderMode;
  return (
    <Animated.View
      entering={
        reduced
          ? undefined
          : FadeInDown.duration(duration.content)
              .delay(Math.min(index, 6) * STAGGER_MS)
              .easing(Easing.bezier(...EASE_OUT).factory())
              .withInitialValues({ opacity: 0, transform: [{ translateY: RISE_PX }] })
      }
      style={style}
    >
      {children}
    </Animated.View>
  );
}
