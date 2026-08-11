import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colours, type } from '@shared/constants/theme';

/**
 * Rough 0–4 strength score.
 *
 * The symbol point only counts symbols the server accepts (@$!%*?&). Counting
 * any non-alphanumeric made `Passw0rd#` read "Strong" a line above the error
 * saying it was invalid — the meter has to agree with the rule it sits under.
 */
export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[@$!%*?&]/.test(pw)) s++;
  return Math.min(s, 4);
}

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const segColour = [colours.border, colours.error, colours.warning, colours.g500, colours.success];

interface Props {
  /** pass either a raw password or a precomputed 0–4 score */
  password?: string;
  score?: number;
  showLabel?: boolean;
}

/** 4-segment password-strength bar — fills red → amber → gold → green. */
export default function PasswordStrength({ password, score, showLabel = true }: Props) {
  const s = score ?? scorePassword(password ?? '');
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[styles.seg, { backgroundColor: n <= s ? segColour[s] : colours.surface2 }]}
          />
        ))}
      </View>
      {showLabel && s > 0 ? (
        <Text style={[styles.label, { color: segColour[s] }]}>{LABELS[s]}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  bar: { flexDirection: 'row', gap: 5 },
  seg: { flex: 1, height: 4, borderRadius: 3 },
  label: { ...type.caption, marginTop: 5, alignSelf: 'flex-end' },
});
