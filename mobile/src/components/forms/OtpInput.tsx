/**
 * OtpInput — segmented OTP entry. Phone codes are 4 digits (MSG91), email codes
 * are 6 (the server generates them separately), so `length` is a prop. Auto-fires onComplete
 * when the last digit lands (web OtpBoxes pattern); clears itself and takes the
 * caret back via the `resetKey` prop after a failed verify.
 *
 * One real TextInput sits OVER the four display boxes with transparent text.
 * It is the only accessibility element, so a screen reader lands on a
 * labelled, row-sized text field (the old 1x1 opacity-0 input was swallowed
 * by its accessible Pressable wrapper and announced nothing). The input is
 * transparent rather than `opacity: 0` on purpose: iOS does not deliver touches
 * to a view with alpha 0, and a live input gives native long-press paste and
 * the iOS SMS one-time-code suggestion for free.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { View, TextInput, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Text from '../ui/Text';
import { useShake } from '../motion';
import { spacing, borderRadius, type, type ThemeColours } from '@shared/constants/theme';

const DEFAULT_LENGTH = 4;

interface Props {
  /** Number of digits the server sent: 4 for a mobile number, 6 for an email. */
  length?: number;
  onComplete: (code: string) => void;
  /** Ignores input (a verify is in flight). The field keeps focus, so the keyboard stays up. */
  disabled?: boolean;
  /** Change to clear the boxes (e.g. bump a counter on verify failure). */
  resetKey?: number;
  /** Screen-reader label for the field. Pass the localized "enter the code" line. */
  label?: string;
  /** Red boxes while empty after a failed verify; clears as soon as they type. */
  error?: boolean;
  testID?: string;
}

export default function OtpInput({
  length = DEFAULT_LENGTH,
  onComplete,
  disabled = false,
  resetKey = 0,
  label,
  error = false,
  testID,
}: Props) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const st = React.useMemo(() => makeSt(c), [c]);
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const mounted = useRef(false);
  const { style: shakeStyle, shake } = useShake();

  const a11yLabel = label ?? t('auth.signup.otpLabel', { digits: length, defaultValue: `Enter the ${length}-digit code` });

  // A failed verify bumps resetKey. Clear the boxes and hand the caret back so
  // the retry needs no extra tap. Skipped on mount: autoFocus already did it.
  useEffect(() => {
    setCode('');
    if (mounted.current) inputRef.current?.focus();
    mounted.current = true;
  }, [resetKey]);

  // Once per failed verify: `error` goes off when the next attempt starts and on
  // again when it fails, so every wrong code re-arms this. Edge-triggered, so a
  // live Reduce Motion flip (which re-creates `shake`) cannot replay it.
  const wasError = useRef(false);
  useEffect(() => {
    if (error && !wasError.current) shake();
    wasError.current = error;
  }, [error, shake]);

  const handleChange = (txt: string) => {
    // Guarded here instead of with editable={false}: turning editable off drops
    // focus and the keyboard on both platforms, and autoFocus only runs at mount,
    // so a wrong code would cost the member a tap on the boxes before retrying.
    if (disabled) return;
    const digits = txt.replace(/\D/g, '').slice(0, length);
    setCode(digits);
    if (digits.length === length) onComplete(digits);
  };

  return (
    <View style={st.wrap} testID={testID ?? 'otp-input'}>
      <Animated.View
        style={[st.row, shakeStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length }).map((_, i) => {
          const filled = i < code.length;
          const active = focused && i === code.length && !disabled;
          const failed = error && code.length === 0;
          return (
            <View key={i} style={[st.box, active && st.boxActive, filled && st.boxFilled, failed && st.boxError]}>
              {/* Height-constrained box: the digit is capped so OS text size
                  cannot outgrow the fixed box geometry. */}
              <Text variant="title3" color="textPrimary" maxScale={1.5}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={inputRef}
        style={st.overlay}
        value={code}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        caretHidden
        selectionColor="transparent"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled }}
        testID="otp-hidden-input"
      />
    </View>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  // stretch: a parent with alignItems:'center' would otherwise shrink-wrap the wrapper and the
  // flex boxes inside it collapse to their borders (seen on device as thin slivers).
  wrap: { alignSelf: 'stretch', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  box: {
    // Six boxes at a fixed 52pt (plus gaps) overflow a 360dp phone inside the
    // screen gutters, so the boxes share the row and cap at 52pt.
    flex: 1, maxWidth: 52, minHeight: 60,
    borderWidth: 1.5, borderColor: c.border, borderRadius: borderRadius.md,
    backgroundColor: c.surfaceCard,
    alignItems: 'center', justifyContent: 'center',
  },
  boxActive: { borderColor: c.accent },
  boxFilled: { borderColor: c.accent, backgroundColor: c.accentSoft },
  boxError: { borderColor: c.error },
  // Covers the boxes; draws nothing but still owns the touch, focus and paste.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    ...type.title3,
    color: 'transparent',
    backgroundColor: 'transparent',
  },
});
