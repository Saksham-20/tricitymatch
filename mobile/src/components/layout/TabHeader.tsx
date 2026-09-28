import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@shared/constants/theme';
import Text from '../ui/Text';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';

interface TabHeaderProps {
  title: string;
  /**
   * Optional trailing control (a settings or family-groups button). Give it a
   * real `tapSize(elder)` box; TabHeader pulls it into the gutter with a
   * negative margin so the glyph sits on the gutter line, not inset by the
   * box padding.
   */
  trailing?: React.ReactNode;
  testID?: string;
}

/**
 * The one header for every tab root (Matches, Messages, My profile). Three
 * screens drew three different title sizes, offsets and gutters; this fixes
 * the role (`title1`), the gutter (`spacing.gutter`) and the row height (a
 * trailing 48pt / 60pt elder button never changes the title's baseline).
 */
export default function TabHeader({ title, trailing, testID }: TabHeaderProps) {
  const { elder } = useTheme();
  return (
    <View style={[s.row, { minHeight: tapSize(elder) + spacing.md }]} testID={testID}>
      <Text
        variant="title1"
        color="fgStrong"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={s.title}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.xs,
  },
  // flexShrink keeps a long Hindi/Punjabi title from pushing the trailing
  // button off the row (adjustsFontSizeToFit needs a bounded width).
  title: { flexShrink: 1 },
  trailing: { marginRight: -12 },
});
