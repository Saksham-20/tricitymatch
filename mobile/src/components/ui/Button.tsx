import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colours, shadows, darkShadows, spacing, type, type ThemeColours } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import { PressableScale } from '../motion';
import { tapSize } from '../../utils/elderTheme';
import Text, { type TypeRole } from './Text';

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
const makeGradients = (c: ThemeColours): Partial<Record<ButtonVariant, [string, string]>> => ({
  primary: [c.p500, c.p600],
  gold: [c.g400, c.g600],
});

const SIZES: Record<ButtonSize, { minHeight: number; radius: number; font: TextStyle }> = {
  sm: { minHeight: 44, radius: borderRadius.sm, font: type.subhead },
  md: { minHeight: 50, radius: borderRadius.md, font: type.headline },
  lg: { minHeight: 54, radius: borderRadius.md, font: type.body },
};

// Mirrors SIZES' `font` role by name, for the Text primitive's `variant` prop.
const SIZE_VARIANT: Record<ButtonSize, TypeRole> = {
  sm: 'subhead',
  md: 'headline',
  lg: 'body',
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
  const { c, isDark, elder } = useTheme();
  const isDisabled = disabled || loading;
  const sh = isDark ? darkShadows : shadows;
  const v = React.useMemo(() => makeVariantStyles(c, sh), [c, sh])[variant];
  const sz = SIZES[size];
  const gradient = React.useMemo(() => makeGradients(c), [c])[variant];

  const handlePress = (e: GestureResponderEvent) => {
    if (haptic) haptics.light();
    onPress(e);
  };

  const inner = loading ? (
    <ActivityIndicator color={v.spinnerColor} testID={loaderTestID} />
  ) : (
    <View style={styles.contentRow}>
      {icon ? <Ionicons name={icon} size={(sz.font.fontSize ?? 16) + 2} color={v.text.color} /> : null}
      {/* v.text.color is dynamic per button variant and sometimes non-curated (gold's goldText) — left as a style override */}
      {/* Two lines, not one: a long hi/pa label or a large OS text size must wrap
          inside the button rather than lose its tail to an ellipsis. */}
      <Text variant={SIZE_VARIANT[size]} style={[v.text, styles.title]} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );

  // Elder mode's floor is 60pt (doctrine 10.6). Outside elder mode the size's own minimum
  // stands (the text variant keeps its 44pt), so nothing shifts for everyone else.
  const minHeight = elder ? Math.max(sz.minHeight, tapSize(true)) : sz.minHeight;
  const radiusStyle = { borderRadius: sz.radius, minHeight };

  return (
    <PressableScale
      haptic={false}
      style={[
        gradient ? [styles.gradientWrap, radiusStyle] : [styles.base, radiusStyle],
        gradient ? v.shadow : v.container,
        // After the variant, so the elder floor also reaches the text variant's own 44pt.
        elder ? { minHeight } : undefined,
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
  title: { flexShrink: 1, textAlign: 'center' },
  gradientWrap: { overflow: 'hidden' },
  disabled: { opacity: 0.45 },
});

type Variant = {
  container: ViewStyle;
  shadow?: ViewStyle;
  text: { color: string; fontFamily?: string };
  spinnerColor: string;
};

const makeVariantStyles = (c: ThemeColours, sh: typeof shadows | typeof darkShadows): Record<ButtonVariant, Variant> => ({
  primary: {
    container: { backgroundColor: c.p500 },
    shadow: sh.e3,
    text: { color: c.onPrimary },
    spinnerColor: c.onPrimary,
  },
  gold: {
    container: { backgroundColor: c.g500 },
    shadow: sh.gold,
    text: { color: c.goldText, fontFamily: type.headline.fontFamily },
    spinnerColor: c.goldText,
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    text: { color: c.accent },
    spinnerColor: c.accent,
  },
  ghost: {
    container: { backgroundColor: c.surface2 },
    text: { color: c.fgStrong },
    spinnerColor: c.accent,
  },
  danger: {
    container: { backgroundColor: c.error },
    text: { color: c.onPrimary },
    spinnerColor: c.onPrimary,
  },
  text: {
    container: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: spacing.sm },
    text: { color: c.accent, fontFamily: type.subhead.fontFamily },
    spinnerColor: c.accent,
  },
});
