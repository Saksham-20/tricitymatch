import React from 'react';
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { type as typeScale, type ThemeColours } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

export type TypeRole = keyof typeof typeScale;

/**
 * Elder mode's real type-scale bump (doctrine §10.6). Matches the web's own
 * `html.elder` ratio (16→18.5px, see CLAUDE.md) rather than inventing a
 * separate RN bump — the same reasoning applies at every size in `type.*`,
 * not just body text.
 */
const ELDER_SCALE = 1.15625;

const scaleRole = (role: (typeof typeScale)[TypeRole], elder: boolean) =>
  elder
    ? {
        ...role,
        fontSize: Math.round(role.fontSize * ELDER_SCALE),
        lineHeight: Math.round(role.lineHeight * ELDER_SCALE),
      }
    : role;

/**
 * Text colours a `<Text>` may take. Deliberately excludes gold — gold is a
 * premium *signal* (locks, VIP, "Most Popular"), never a text colour
 * (doctrine §10.1/§10.8).
 */
const TEXT_COLOURS = (c: ThemeColours) => ({
  textPrimary: c.textPrimary,
  fgStrong: c.fgStrong,
  textSecondary: c.textSecondary,
  textMuted: c.textMuted,
  primary: c.primary,
  onPrimary: c.onPrimary,
  success: c.success,
  warning: c.warning,
  error: c.error,
  info: c.info,
});
export type TextColor = keyof ReturnType<typeof TEXT_COLOURS>;

export interface AppTextProps extends Omit<TextProps, 'style'> {
  variant?: TypeRole;
  color?: TextColor;
  /** Height-constrained rows only (e.g. a single-line pill) — caps OS text scaling past this multiplier. */
  maxScale?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * The only way words reach the screen (doctrine §10.6). Resolves the elder
 * type-scale bump and dark-mode colour internally, so screens never read
 * `useUIStore` or apply a manual font-size literal.
 */
export default function Text({
  variant = 'body',
  color = 'textPrimary',
  maxScale,
  style,
  ...rest
}: AppTextProps) {
  const { c, elder } = useTheme();
  const role = scaleRole(typeScale[variant], elder);
  const colours = TEXT_COLOURS(c);

  return (
    <RNText
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={maxScale}
      style={[
        { fontFamily: role.fontFamily, fontSize: role.fontSize, lineHeight: role.lineHeight, color: colours[color] },
        style,
      ]}
    />
  );
}
