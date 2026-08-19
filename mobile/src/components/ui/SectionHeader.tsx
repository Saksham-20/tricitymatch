import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colours, type, type ThemeColours } from '@shared/constants/theme';

interface SectionHeaderProps {
  title: string;
  /** Optional uppercase kicker above the title */
  eyebrow?: string;
  /** gold tick = premium section, burgundy (default) = standard */
  gold?: boolean;
  /** small count chip after the title, e.g. "12" */
  count?: number | string;
  /** trailing action (e.g. a "See all" link) */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Editorial section divider — accent tick bar + serif title (+ optional count / action). */
export default function SectionHeader({ title, eyebrow, gold, count, action, style }: SectionHeaderProps) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <View style={[styles.tick, gold && styles.tickGold]} />
        <View style={styles.textGroup}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {count != null ? (
              <View style={styles.countChip}>
                <Text style={styles.countText}>{count}</Text>
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
  eyebrow: {
    ...type.micro,
    color: c.g600,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    ...type.title3,
    color: c.fgStrong,
  },
  countChip: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { ...type.caption, color: c.accent },
});
