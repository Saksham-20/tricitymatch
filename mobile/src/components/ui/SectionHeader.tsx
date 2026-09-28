import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { type ThemeColours } from '@shared/constants/theme';
import Text from './Text';

interface SectionHeaderProps {
  title: string;
  /** gold tick = premium section, burgundy (default) = standard */
  gold?: boolean;
  /** small count chip after the title, e.g. "12" */
  count?: number | string;
  /** trailing action (e.g. a "See all" link) */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * List-section heading: accent tick bar + an Inter `title3` title (+ optional count / action).
 * This is the list-section role. A card inside a profile carries its own Playfair `title2`
 * heading instead (detail/SectionCard), so the two roles never share a size.
 */
export default function SectionHeader({ title, gold, count, action, style }: SectionHeaderProps) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <View style={[styles.tick, gold && styles.tickGold]} />
        <View style={styles.textGroup}>
          <View style={styles.titleRow}>
            <Text variant="title3" color="fgStrong" accessibilityRole="header">{title}</Text>
            {count != null ? (
              <View style={styles.countChip}>
                <Text variant="caption" color="primary">{count}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 11,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  tick: { width: 3, height: 18, borderRadius: 3, backgroundColor: c.accent },
  tickGold: { backgroundColor: c.g500 },
  textGroup: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countChip: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
