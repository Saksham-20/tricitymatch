import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, View, ViewStyle, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { useReduceMotion } from '../../../components/motion';

interface RevealOnScrollProps {
  /** The story scroll's scrollY shared value. */
  scrollY: SharedValue<number>;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fade-rise a block into view the first time it scrolls into the viewport
 * (bottom 88px threshold). Runs entirely on the UI thread; fires once; static
 * under reduce-motion. This is the story scroll's only reveal idiom.
 */
export default function RevealOnScroll({ scrollY, children, style }: RevealOnScrollProps) {
  const reduced = useReduceMotion();
  const { height: viewportH } = useWindowDimensions();
  const [measured, setMeasured] = useState(false);
  const layoutY = useSharedValue(0);
  const shown = useSharedValue(0);
  const progress = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    layoutY.value = e.nativeEvent.layout.y;
    if (!measured) setMeasured(true);
  };

  useAnimatedReaction(
    () => scrollY.value + viewportH - 88 > layoutY.value,
    (visible) => {
      if (visible && shown.value === 0) {
        shown.value = 1;
        // duration.reveal is reserved for exactly this: the story scroll's
        // only reveal idiom (doctrine §10.3).
        progress.value = withTiming(1, {
          duration: duration.reveal,
          easing: Easing.bezier(...EASE_OUT),
        });
      }
    },
  );

  const anim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 20 }],
  }));

  if (reduced) {
    return <View style={style}>{children}</View>;
  }
  return (
    <Animated.View onLayout={onLayout} style={[anim, style]}>
      {children}
    </Animated.View>
  );
}
