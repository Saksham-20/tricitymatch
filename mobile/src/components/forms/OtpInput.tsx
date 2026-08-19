/**
 * OtpInput — 4-box OTP entry (MSG91 sends 4 digits). Auto-fires onComplete
 * when the last digit lands (web OtpBoxes pattern); clears itself via the
 * `resetKey` prop after a failed verify.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';

const LENGTH = 4;

interface Props {
  onComplete: (code: string) => void;
  disabled?: boolean;
  /** Change to clear the boxes (e.g. bump a counter on verify failure). */
  resetKey?: number;
  testID?: string;
}

export default function OtpInput({ onComplete, disabled = false, resetKey = 0, testID }: Props) {
  const { c } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const [code, setCode] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => { setCode(''); }, [resetKey]);

  const handleChange = (txt: string) => {
    const digits = txt.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (digits.length === LENGTH) onComplete(digits);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} testID={testID ?? 'otp-input'}>
      {/* One hidden input drives four display boxes — keeps paste + keyboard
          management trivial and screen-reader friendly. */}
      <TextInput
        ref={inputRef}
        style={st.hidden}
        value={code}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={LENGTH}
        editable={!disabled}
        autoFocus
        accessibilityLabel={`Enter the ${LENGTH}-digit code`}
        testID="otp-hidden-input"
      />
      <View style={st.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: LENGTH }).map((_, i) => {
          const filled = i < code.length;
          const active = i === code.length && !disabled;
          return (
            <View key={i} style={[st.box, active && st.boxActive, filled && st.boxFilled]}>
              <Text style={st.digit}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  box: {
    width: 52, height: 60,
    borderWidth: 1.5, borderColor: c.border, borderRadius: borderRadius.md,
    backgroundColor: c.surfaceCard,
    alignItems: 'center', justifyContent: 'center',
  },
  boxActive: { borderColor: c.primary },
  boxFilled: { borderColor: c.primary, backgroundColor: '#FDF2F5' },
  digit: { fontSize: typography.fontSize.xl, fontWeight: '700', color: c.textPrimary },
});
