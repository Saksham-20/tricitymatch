import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colours, spacing, typography } from '@shared/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text' | 'gold';

interface ButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  loaderTestID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// Brand gradients mirror the web Button (from-primary-500 to-primary-700 /
// from-gold-500 to-gold-700). Solid variants render without a gradient layer.
const GRADIENTS: Partial<Record<ButtonVariant, [string, string]>> = {
  primary: [colours.primary, colours.primaryDark],
  gold: [colours.secondary, '#A8861E'],
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  testID,
  loaderTestID,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = variantStyles[variant];
  const gradient = GRADIENTS[variant];

  const inner = loading ? (
    <ActivityIndicator color={variantStyle.spinnerColor} testID={loaderTestID} />
  ) : (
    <Text style={[styles.text, variantStyle.text]} numberOfLines={1}>
      {title}
    </Text>
  );

  return (
    <TouchableOpacity
      style={[
        gradient ? styles.gradientWrap : styles.base,
        gradient ? variantStyle.shadow : variantStyle.container,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.base}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={styles.fill}>{inner}</View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
  },
  fill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  // Gradient variants: the TouchableOpacity is just a rounded, clipped shell
  // that carries the shadow; the LinearGradient fills it.
  gradientWrap: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  disabled: { opacity: 0.6 },
  text: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
  },
});

type Variant = {
  container: ViewStyle;
  shadow?: ViewStyle;
  text: ViewStyle & { color: string; fontFamily?: string };
  spinnerColor: string;
};

const burgundyShadow: ViewStyle = {
  shadowColor: colours.primary,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
};

const goldShadow: ViewStyle = {
  shadowColor: colours.secondary,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 4,
};

const variantStyles: Record<ButtonVariant, Variant> = {
  primary: {
    container: { backgroundColor: colours.primary },
    shadow: burgundyShadow,
    text: { color: colours.onPrimary },
    spinnerColor: colours.onPrimary,
  },
  gold: {
    container: { backgroundColor: colours.secondary },
    shadow: goldShadow,
    text: { color: '#2D2D2D', fontFamily: typography.fontFamily.bold },
    spinnerColor: '#2D2D2D',
  },
  secondary: {
    container: {
      backgroundColor: colours.surfaceCard,
      borderWidth: 1,
      borderColor: colours.border,
    },
    text: { color: colours.textPrimary },
    spinnerColor: colours.primary,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: colours.primary },
    spinnerColor: colours.primary,
  },
  danger: {
    container: { backgroundColor: colours.error },
    text: { color: colours.onPrimary },
    spinnerColor: colours.onPrimary,
  },
  text: {
    container: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: 0 },
    text: { color: colours.textSecondary, fontFamily: typography.fontFamily.medium },
    spinnerColor: colours.primary,
  },
};
