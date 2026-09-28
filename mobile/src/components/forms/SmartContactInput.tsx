/**
 * SmartContactInput — RN port of the web SmartContactField (D6 door).
 * One box that detects email vs 10-digit Indian mobile as the member types;
 * a live +91 pill appears for phone input. Reports the parsed identity up.
 *
 * Not built on the `Input` primitive because the +91 pill is an inline
 * adornment `Input` has no slot for (primitive request: give `Input` a left
 * adornment slot, then rebuild this on it). Until then it copies `Input`'s
 * label, focus ring, error and helper treatment by hand so a contact field and
 * a password field on one screen read as one form. If `ui/Input.tsx` changes,
 * change this file in the same commit.
 */
import React, { forwardRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import {
  AccessibilityInfo,
  Platform,
  View,
  TextInput,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import Text from '../ui/Text';
import { spacing, borderRadius, type, type ThemeColours } from '@shared/constants/theme';
import { tapSize } from '../../utils/elderTheme';

export type ContactKind = 'email' | 'phone' | null;

export interface ContactValue {
  raw: string;
  kind: ContactKind;
  /** Normalized value to submit: lowercased email, or bare 10-digit phone. */
  value: string | null;
}

export const parseContact = (raw: string): ContactValue => {
  const trimmed = raw.trim();
  if (!trimmed) return { raw, kind: null, value: null };
  // Phone: strip spaces/dashes, then an optional +91 / 91 / 0 prefix, but ONLY
  // when digits are left over beyond the 10 national ones. Stripping "91"
  // unconditionally rejected real numbers that simply begin with 91
  // (9123456789 became 23456789). Mirrors the web's phoneDigits().
  const compact = trimmed.replace(/[\s-]/g, '');
  if (/^\+?\d+$/.test(compact)) {
    let digits = compact.replace(/^\+/, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (/^[6-9]\d{9}$/.test(digits)) return { raw, kind: 'phone', value: digits };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { raw, kind: 'email', value: trimmed.toLowerCase() };
  }
  return { raw, kind: null, value: null };
};

interface Props {
  value: string;
  onChange: (raw: string, parsed: ContactValue) => void;
  /** False greys the field (a code was sent to this contact, or a send is in flight). */
  editable?: boolean;
  testID?: string;
  /** Label above the field. Also the accessibility label. */
  label?: string;
  /** Inline error below the field; replaces the helper text while set. Announced when it appears. */
  error?: string;
  helper?: string;
  placeholder?: string;
  autoFocus?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  /** Fires when the field loses focus, so the screen can validate on blur. */
  onBlur?: () => void;
  /** Defaults to `username` (sign-in). The signup door passes `off` so a new-account form does not offer saved logins. */
  autoComplete?: TextInputProps['autoComplete'];
  /** iOS counterpart of `autoComplete`; the signup door passes `none`. */
  textContentType?: TextInputProps['textContentType'];
}

const SmartContactInput = forwardRef<TextInput, Props>(function SmartContactInput(
  {
    value,
    onChange,
    editable = true,
    testID,
    label,
    error,
    helper,
    placeholder,
    autoFocus,
    returnKeyType,
    onSubmitEditing,
    onBlur,
    autoComplete = 'username',
    textContentType = 'username',
  },
  ref,
) {
  const { c, elder } = useTheme();
  const { t } = useTranslation();
  const st = React.useMemo(() => makeSt(c), [c]);
  const [focused, setFocused] = useState(false);
  const parsed = parseContact(value);
  const fallbackLabel = t('auth.emailOrPhone', 'Email or mobile number');
  const a11yLabel = label ?? fallbackLabel;

  // Android reads the error through accessibilityLiveRegion on the text below;
  // iOS ignores that prop, so speak it explicitly there.
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  return (
    <View style={st.group}>
      {label ? <Text variant="footnote" color="textPrimary" style={st.label}>{label}</Text> : null}
      <View
        style={[
          st.wrap,
          { minHeight: Math.max(50, tapSize(elder)) },
          focused && st.wrapFocused,
          !!error && st.wrapError,
          !editable && st.wrapDisabled,
        ]}
      >
        {parsed.kind === 'phone' && (
          // Decorative: the phone hint below carries the same fact for a screen reader.
          <View style={st.pill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text variant="subhead" color="primary">+91</Text>
          </View>
        )}
        <TextInput
          ref={ref}
          style={st.input}
          value={value}
          onChangeText={(txt) => onChange(txt, parseContact(txt))}
          placeholder={placeholder ?? fallbackLabel}
          placeholderTextColor={c.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          editable={editable}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          accessibilityLabel={a11yLabel}
          accessibilityHint={parsed.kind === 'phone' ? t('auth.signup.phoneHint', 'Read as an Indian mobile number, country code 91.') : undefined}
          accessibilityState={{ disabled: !editable }}
          testID={testID ?? 'smart-contact-input'}
        />
      </View>
      {error ? (
        <Text variant="caption" color="error" style={st.errorText} accessibilityLiveRegion="polite">{error}</Text>
      ) : helper ? (
        // textSecondary: the helper is copy the member must read and it sits directly
        // under the field, so it takes the stronger of the two readable tones.
        <Text variant="caption" color="textSecondary" style={st.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
});

export default SmartContactInput;

const makeSt = (c: ThemeColours) => StyleSheet.create({
  // Same outer rhythm as the Input primitive's group.
  group: { marginBottom: 15 },
  label: { fontFamily: type.headline.fontFamily, marginBottom: 6 },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.md,
    backgroundColor: c.surfaceCard,
    paddingHorizontal: 14,
  },
  // Mirrors Input's `inputFocused`.
  wrapFocused: {
    borderColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  wrapError: { borderColor: c.error },
  wrapDisabled: { backgroundColor: c.surface2 },
  pill: {
    backgroundColor: c.accentSoft2,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...type.body,
    paddingVertical: 13,
    color: c.fgStrong,
  },
  // Mirrors Input's `errorText` weight.
  errorText: { fontFamily: 'Inter-Medium', marginTop: 5 },
  helperText: { marginTop: 5 },
});
