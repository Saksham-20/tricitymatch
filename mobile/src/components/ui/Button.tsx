import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { borderRadius, colours, spacing, typography } from '@shared/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text';

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

  return (
    <TouchableOpacity
      style={[styles.base, variantStyle.container, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.spinnerColor} testID={loaderTestID} />
      ) : (
        <Text style={[styles.text, variantStyle.text]} numberOfLines={1}>
          {title}
        </Text>
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
  disabled: { opacity: 0.6 },
  text: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
  },
});

const variantStyles: Record<
  ButtonVariant,
  { container: ViewStyle; text: ViewStyle & { color: string; fontFamily?: string }; spinnerColor: string }
> = {
  primary: {
    container: { backgroundColor: colours.primary },
    text: { color: colours.onPrimary },
    spinnerColor: colours.onPrimary,
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
