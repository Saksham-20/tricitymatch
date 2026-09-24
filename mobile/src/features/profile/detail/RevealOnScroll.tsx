import React, { useEffect } from 'react';
import { LayoutChangeEvent, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
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

/** Doctrine §4.5 / §10.3 ceiling: no variant moves more than 16px. */
const REVEAL_RISE = 16;
/** A block reveals once its top is this far inside the bottom of the viewport. */
const REVEAL_INSET = 88;

interface RevealOnScrollProps {
  /** The story scroll's scrollY shared value. */
  scrollY: SharedValue<number>;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fade-rise a block into view the first time it scrolls into the viewport.
 * Runs entirely on the UI thread; fires once; settled immediately under
 * reduce-motion (doctrine §4.6). Frequency: occasional. Purpose: preventing a
 * jarring pop-in as content arrives. This is the story scroll's only reveal
 * idiom (§10.3): opacity + a 16px rise on `duration.reveal` / `EASE_OUT`.
 *
 * One `Animated.View` for every setting. `useReduceMotion` reports `false` for
 * its first render and flips after an async read, so a reduce-motion user must
 * be handled by settling this same node, never by swapping it for a plain
 * `View` (a different element type at the same position remounts every child).
 */
export default function RevealOnScroll({ scrollY, children, style }: RevealOnScrollProps) {
  const reduced = useReduceMotion();
  const { height: viewportH } = useWindowDimensions();
  const layoutY = useSharedValue(0);
  // 0 until onLayout has reported a real `y`. Without this gate the reaction
  // below runs once at mount with `layoutY === 0`, reads "visible", and every
  // block on the page reveals immediately instead of on scroll.
  const measured = useSharedValue(0);
  const shown = useSharedValue(0);
  const progress = useSharedValue(0);
  // UI-thread mirror of `reduced`, so the reveal reaction and the style worklet
  // read the live setting without a re-render.
  const reducedSV = useSharedValue(0);

  useEffect(() => {
    reducedSV.value = reduced ? 1 : 0;
    if (reduced) {
      // Settle in place: fully visible, no rise, nothing left to animate.
      shown.value = 1;
      progress.value = 1;
    }
  }, [reduced, reducedSV, shown, progress]);

  const onLayout = (e: LayoutChangeEvent) => {
    layoutY.value = e.nativeEvent.layout.y;
    measured.value = 1;
  };

  useAnimatedReaction(
    () => measured.value === 1 && scrollY.value + viewportH - REVEAL_INSET > layoutY.value,
    (visible) => {
      if (visible && shown.value === 0) {
        shown.value = 1;
        progress.value =
          reducedSV.value === 1
            ? 1
            : withTiming(1, {
                duration: duration.reveal,
                easing: Easing.bezier(...EASE_OUT),
              });
      }
    },
    [viewportH],
  );

  const anim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reducedSV.value === 1 ? 0 : (1 - progress.value) * REVEAL_RISE }],
  }));

  return (
    <Animated.View onLayout={onLayout} style={[anim, style]}>
      {children}
    </Animated.View>
  );
}
