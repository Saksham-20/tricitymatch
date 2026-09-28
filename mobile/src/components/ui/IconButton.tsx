import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius } from '@shared/constants/theme';
import { PressableScale } from '../motion';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  /** Soft circular background behind the glyph. */
  filled?: boolean;
  accessibilityLabel: string;
  /** A haptic belongs to a committed action (toggle, send), not to opening something. Off by default. */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 44pt (60pt in elder mode) circular icon button with the standard scale-pop press. */
export default function IconButton({
  icon,
  onPress,
  size = 22,
  color,
  filled = false,
  accessibilityLabel,
  haptic = false,
  style,
  testID,
}: IconButtonProps) {
  const { c, elder } = useTheme();
  const box = elder ? tapSize(true) : 44;
  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.btn, { width: box, height: box }, filled && { backgroundColor: c.surface2 }, style]}
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
