import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colours, shadows, spacing, type } from '@shared/constants/theme';
import { haptics } from '../../utils/haptics';
import { PressableScale } from '../motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Leading Ionicons glyph */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Fire a light selection haptic on press (default true) */
  haptic?: boolean;
  testID?: string;
  loaderTestID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// Brand gradients (handoff): primary burgundy p500→p600, gold g400→g600.
const GRADIENTS: Partial<Record<ButtonVariant, [string, string]>> = {
  primary: [colours.p500, colours.p600],
  gold: [colours.g400, colours.g600],
};

const SIZES: Record<ButtonSize, { minHeight: number; radius: number; font: TextStyle }> = {
  sm: { minHeight: 38, radius: borderRadius.sm, font: type.subhead },
  md: { minHeight: 50, radius: borderRadius.md, font: type.headline },
  lg: { minHeight: 54, radius: borderRadius.md, font: type.body },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  haptic = true,
  testID,
  loaderTestID,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const v = variantStyles[variant];
  const sz = SIZES[size];
  const gradient = GRADIENTS[variant];

  const handlePress = (e: GestureResponderEvent) => {
    if (haptic) haptics.light();
    onPress(e);
  };

  const inner = loading ? (
    <ActivityIndicator color={v.spinnerColor} testID={loaderTestID} />
  ) : (
    <View style={styles.contentRow}>
      {icon ? <Ionicons name={icon} size={(sz.font.fontSize ?? 16) + 2} color={v.text.color} /> : null}
      <Text style={[sz.font, v.text]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );

  const radiusStyle = { borderRadius: sz.radius, minHeight: sz.minHeight };

  return (
    <PressableScale
      haptic={false}
      style={[
        gradient ? [styles.gradientWrap, radiusStyle] : [styles.base, radiusStyle],
        gradient ? v.shadow : v.container,
        // Solid brand fallback if the gradient native view is unavailable.
        gradient ? { backgroundColor: gradient[0] } : undefined,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, radiusStyle]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={styles.fill}>{inner}</View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  fill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  contentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gradientWrap: { overflow: 'hidden' },
  disabled: { opacity: 0.45 },
});

type Variant = {
  container: ViewStyle;
  shadow?: ViewStyle;
  text: { color: string; fontFamily?: string };
  spinnerColor: string;
};

const variantStyles: Record<ButtonVariant, Variant> = {
  primary: {
    container: { backgroundColor: colours.p500 },
    shadow: shadows.e3,
    text: { color: colours.onPrimary },
    spinnerColor: colours.onPrimary,
  },
  gold: {
    container: { backgroundColor: colours.g500 },
    shadow: shadows.gold,
    text: { color: colours.goldText, fontFamily: type.headline.fontFamily },
    spinnerColor: colours.goldText,
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colours.accent,
    },
    text: { color: colours.accent },
    spinnerColor: colours.accent,
  },
  ghost: {
    container: { backgroundColor: colours.surface2 },
    text: { color: colours.fgStrong },
    spinnerColor: colours.accent,
  },
  danger: {
    container: { backgroundColor: colours.error },
    text: { color: colours.onPrimary },
    spinnerColor: colours.onPrimary,
  },
  text: {
    container: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: spacing.sm },
    text: { color: colours.accent, fontFamily: type.subhead.fontFamily },
    spinnerColor: colours.accent,
  },
};
