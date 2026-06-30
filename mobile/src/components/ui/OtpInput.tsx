import React, { useRef, useState } from 'react';
import { NativeSyntheticEvent, StyleSheet, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { borderRadius, colours, type } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  /** called when all boxes are filled */
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  testID?: string;
}

/** 6-box OTP entry — auto-advance on type, backspace steps back, paste fills. */
export default function OtpInput({
  value,
  onChange,
  length = 6,
  onComplete,
  autoFocus = true,
  testID,
}: OtpInputProps) {
  const { c } = useTheme();
  const refs = useRef<Array<TextInput | null>>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const chars = value.split('').slice(0, length);

  const setAt = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    const next = value.split('');
    // paste support: fill forward from i
    for (let k = 0; k < digits.length && i + k < length; k++) next[i + k] = digits[k];
    const joined = next.join('').slice(0, length);
    onChange(joined);
    const focusIdx = Math.min(i + digits.length, length - 1);
    refs.current[focusIdx]?.focus();
    if (joined.length === length) onComplete?.(joined);
  };

  const onKey = (i: number) => (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && !chars[i] && i > 0) {
      const next = value.split('');
      next[i - 1] = '';
      onChange(next.join(''));
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <View style={styles.row} testID={testID}>
      {Array.from({ length }).map((_, i) => {
        const filled = !!chars[i];
        const isFocused = focused === i;
        return (
          <TextInput
            key={i}
            ref={(r) => (refs.current[i] = r)}
            value={chars[i] ?? ''}
            onChangeText={(t) => setAt(i, t)}
            onKeyPress={onKey(i)}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused((f) => (f === i ? null : f))}
            keyboardType="number-pad"
            maxLength={length} // allow paste
            autoFocus={autoFocus && i === 0}
            selectTextOnFocus
            style={[
              styles.box,
              { backgroundColor: c.surfaceCard, borderColor: c.border, color: c.fgStrong },
              filled && { borderColor: c.accent },
              // focus = burgundy ring (handoff): accent border + soft glow
              isFocused && { borderColor: c.accent, ...styles.focusRing, shadowColor: c.accent },
            ]}
            testID={testID ? `${testID}-${i}` : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 9, justifyContent: 'center' },
  box: {
    width: 46,
    height: 56,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    ...type.title2,
    fontFamily: 'Inter-Bold',
    color: colours.fgStrong,
  },
  focusRing: {
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
});
