import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { shadows, darkShadows } from '@shared/constants/theme';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { useReduceMotion } from '../motion';
import { haptics } from '../../utils/haptics';

interface SwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

const THUMB_OFF = 2;
const THUMB_TRAVEL = 20;

/** iOS-style toggle — green when on, thumb slides on the UI thread. */
export default function Switch({ value, onValueChange, disabled, testID }: SwitchProps) {
  const { c, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const x = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    x.value = reduceMotion
      ? target
      : withTiming(target, { duration: duration.menu, easing: Easing.bezier(...EASE_OUT) });
  }, [value, reduceMotion, x]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: THUMB_OFF + x.value * THUMB_TRAVEL }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptics.light();
        onValueChange(!value);
      }}
      style={[
        styles.track,
        // `success` is documented as unreadable as an accent on a dark
        // surfaceCard — `successAccent` is the theme-reactive pair.
        { backgroundColor: value ? c.successAccent : c.border },
        disabled && { opacity: 0.5 },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
    >
      <Animated.View style={[styles.thumb, isDark ? darkShadows.e2 : shadows.e2, thumbStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 51, height: 31, borderRadius: 16, justifyContent: 'center' },
  thumb: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#fff' },
});
