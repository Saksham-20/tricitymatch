import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@shared/constants/theme';
import { useTheme } from '../../hooks/useTheme';

/** Left edge of the text column in a person row: gutter + 54pt avatar + 13pt gap. */
export const PERSON_ROW_INSET = spacing.gutter + 54 + 13;

/**
 * Hairline divider for person rows (Home recent, Matches, Messages). Inset to
 * the text column so the avatar column reads as one continuous strip. Stable
 * identity by design: an inline `ItemSeparatorComponent={() => ...}` is a new
 * component type each render, so React unmounts and remounts every separator.
 */
export default function RowSeparator() {
  const { c } = useTheme();
  return <View style={[s.line, { backgroundColor: c.hairline }]} />;
}

const s = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth, marginLeft: PERSON_ROW_INSET },
});
