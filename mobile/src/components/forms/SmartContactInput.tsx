/**
 * SmartContactInput — RN port of the web SmartContactField (D6 door).
 * One box that detects email vs 10-digit Indian mobile as the member types;
 * a live +91 pill appears for phone input. Reports the parsed identity up.
 */
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';

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
  // Phone: strip spaces/dashes and an optional +91/91/0 prefix; 10 digits starting 6-9.
  const digits = trimmed.replace(/[\s-]/g, '').replace(/^(\+?91|0)/, '');
  if (/^[6-9]\d{9}$/.test(digits)) return { raw, kind: 'phone', value: digits };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { raw, kind: 'email', value: trimmed.toLowerCase() };
  }
  return { raw, kind: null, value: null };
};

interface Props {
  value: string;
  onChange: (raw: string, parsed: ContactValue) => void;
  editable?: boolean;
  testID?: string;
}

export default function SmartContactInput({ value, onChange, editable = true, testID }: Props) {
  const parsed = parseContact(value);
  return (
    <View style={st.wrap}>
      {parsed.kind === 'phone' && (
        <View style={st.pill} accessibilityElementsHidden>
          <Text style={st.pillText}>+91</Text>
        </View>
      )}
      <TextInput
        style={st.input}
        value={value}
        onChangeText={(txt) => onChange(txt, parseContact(txt))}
        placeholder="Email or mobile number"
        placeholderTextColor={colours.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        editable={editable}
        accessibilityLabel="Email or mobile number"
        testID={testID ?? 'smart-contact-input'}
      />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    backgroundColor: colours.surfaceCard,
    paddingHorizontal: spacing.md,
  },
  pill: {
    backgroundColor: '#F8E8EC',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: spacing.sm,
  },
  pillText: { fontSize: typography.fontSize.sm, color: colours.primary, fontWeight: '600' },
  input: {
    flex: 1,
    minHeight: 50,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
  },
});
