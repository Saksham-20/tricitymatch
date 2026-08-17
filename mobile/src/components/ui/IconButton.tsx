import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius } from '@shared/constants/theme';
import { PressableScale } from '../motion';
import { useTheme } from '../../hooks/useTheme';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  /** Soft circular background behind the glyph. */
  filled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 44pt circular icon button with the standard scale-pop press. */
export default function IconButton({
  icon,
  onPress,
  size = 22,
  color,
  filled = false,
  accessibilityLabel,
  style,
  testID,
}: IconButtonProps) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.btn, filled && { backgroundColor: c.surface2 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? c.textPrimary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
