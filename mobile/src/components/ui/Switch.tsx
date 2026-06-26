import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { colours, shadows } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';

interface SwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

/** iOS-style toggle — green when on, burgundy-tinted thumb shadow. */
export default function Switch({ value, onValueChange, disabled, testID }: SwitchProps) {
  const { c } = useTheme();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [value, x]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptics.light();
        onValueChange(!value);
      }}
      style={[
        styles.track,
        { backgroundColor: value ? colours.success : c.border },
        disabled && { opacity: 0.5 },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
    >
      <Animated.View style={[styles.thumb, shadows.e2, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 51, height: 31, borderRadius: 16, justifyContent: 'center' },
  thumb: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#fff' },
});
