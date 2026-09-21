import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { PressableScale } from '../../components/motion';
import Text from '../../components/ui/Text';
import { EmptyState, SkeletonBlock } from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { duration, EASE_OUT, STAGGER_MS } from '@shared/constants/motion';
import { getCompatibilityBreakdown } from '../../api/profile';
import type { CompatibilityCategory } from '../../api/profile';

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

const CATEGORY_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  community: { label: 'Community & Religion', icon: 'people' },
  age:       { label: 'Age Compatibility',    icon: 'calendar' },
  location:  { label: 'Location',             icon: 'location' },
  lifestyle: { label: 'Lifestyle',            icon: 'leaf' },
  horoscope: { label: 'Horoscope',            icon: 'star' },
};

function ScoreBar({ score, color, index = 0 }: { score: number; color: string; index?: number }) {
  const { c } = useTheme();
  const sb = React.useMemo(() => makeSb(c), [c]);
  // Koota-bar fill: 0 → value on mount, STAGGER_MS per row (handoff spec).
  const clamped = Math.max(0, Math.min(100, score));
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withDelay(
      index * STAGGER_MS,
      withTiming(1, { duration: duration.content, easing: Easing.bezier(...EASE_OUT) }),
    );
  }, [index, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${clamped * progress.value}%` }));
  return (
    <View style={sb.track}>
      <Animated.View style={[sb.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const makeSb = (c: ThemeColours) => StyleSheet.create({
  track: {
    flex: 1,
    height: 6,
    backgroundColor: c.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
});

function scoreColor(score: number, c: ThemeColours) {
  if (score >= 75) return c.success;
  if (score >= 50) return c.warning;
  return c.error;
}

function CategoryRow({ catKey, data, index = 0 }: { catKey: string; data: CompatibilityCategory; index?: number }) {
  const { c } = useTheme();
  const cr = React.useMemo(() => makeCr(c), [c]);
  const meta = CATEGORY_META[catKey] || { label: catKey, icon: 'ellipse' as keyof typeof Ionicons.glyphMap };
  const color = scoreColor(data.score, c);
  return (
    <View style={cr.row}>
      <View style={[cr.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={meta.icon} size={18} color={color} />
      </View>
      <View style={cr.content}>
        <View style={cr.labelRow}>
          <Text variant="caption" color="textPrimary">{meta.label}</Text>
          <Text variant="caption" style={{ color }}>{data.score}%</Text>
        </View>
        <ScoreBar score={data.score} color={color} index={index} />
        {!!data.detail && <Text variant="footnote" color="textMuted" style={cr.detail}>{data.detail}</Text>}
      </View>
    </View>
  );
}

const makeCr = (c: ThemeColours) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detail: {
    marginTop: 4,
  },
});

// Loading placeholder shaped like the loaded sheet body: overall card, the
// "Score Breakdown" title, then five category rows (icon, label + %, bar, detail).
function BreakdownSkeleton() {
  return (
    <View style={sk.wrap}>
      <View style={sk.overall}>
        <SkeletonBlock width={140} height={14} />
        <SkeletonBlock width={90} height={40} style={sk.gapSm} />
        <SkeletonBlock width="100%" height={8} radius={4} style={sk.gapSm} />
        <SkeletonBlock width="60%" height={12} style={sk.gapSm} />
      </View>
      <SkeletonBlock width={150} height={18} style={sk.title} />
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={sk.row}>
          <SkeletonBlock width={36} height={36} radius={18} />
          <View style={sk.rowBody}>
            <View style={sk.labelRow}>
              <SkeletonBlock width="45%" height={13} />
              <SkeletonBlock width={32} height={13} />
            </View>
            <SkeletonBlock width="100%" height={6} radius={3} />
            <SkeletonBlock width="70%" height={11} style={sk.gapSm} />
          </View>
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  overall: {
    padding: spacing.lg,
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  gapSm: { marginTop: spacing.sm },
  title: { marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  rowBody: { flex: 1 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
});

export default function CompatibilityBreakdownSheet({ visible, userId, onClose }: Props) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['compatibility', userId],
    queryFn: () => getCompatibilityBreakdown(userId),
    enabled: visible,
    staleTime: 10 * 60 * 1000,
  });

  const categories = (data?.breakdown?.categories ?? {}) as Record<string, CompatibilityCategory | undefined>;
  const overallScore = data?.overallScore ?? 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <PressableScale
        style={styles.backdrop}
        onPress={onClose}
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text variant="headline" color="textPrimary">Why This Match?</Text>
          <PressableScale
            onPress={onClose}
            testID="breakdown-close"
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={c.textSecondary} />
          </PressableScale>
        </View>

        {isLoading ? (
          <BreakdownSkeleton />
        ) : isError && !data ? (
          <EmptyState
            variant="error"
            icon="alert-circle-outline"
            title="Couldn't load breakdown"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="CompatibilityBreakdownSheet-error"
          />
        ) : (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Overall score */}
            <View style={styles.overallCard}>
              <Text variant="subhead" color="textSecondary" style={styles.overallLabel}>Overall Compatibility</Text>
              <Text variant="display" color="primary">{overallScore}%</Text>
              <View style={styles.overallBar}>
                <View style={[styles.overallFill, { width: `${overallScore}%` }]} />
              </View>
              <Text variant="footnote" color="textSecondary" style={styles.overallHint}>
                {overallScore >= 75
                  ? 'Excellent match across key dimensions'
                  : overallScore >= 50
                  ? 'Good match with some differences'
                  : 'Some differences worth discussing'}
              </Text>
            </View>

            {/* Category breakdown */}
            <View style={styles.breakdown}>
              <Text variant="headline" color="textPrimary" style={styles.breakdownTitle}>Score Breakdown</Text>
              {Object.entries(categories).length === 0 ? (
                <EmptyState
                  icon="analytics-outline"
                  title="No breakdown yet"
                  description="There isn't enough profile detail to score this match by category."
                  testID="CompatibilityBreakdownSheet-empty"
                />
              ) : (
                Object.entries(categories).map(([key, val], i) =>
                  val ? <CategoryRow key={key} catKey={key} data={val} index={i} /> : null,
                )
              )}
            </View>

            {/* Footer note */}
            <Text variant="footnote" color="textMuted" style={styles.footerNote}>
              Compatibility is calculated from community, lifestyle, location, and horoscope factors.
            </Text>
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: c.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  scroll: { paddingHorizontal: spacing.lg },
  overallCard: {
    backgroundColor: c.primaryLight + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  overallLabel: {
    marginBottom: 4,
  },
  overallBar: {
    width: '100%',
    height: 8,
    backgroundColor: c.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  },
  overallFill: {
    height: '100%',
    backgroundColor: c.primary,
    borderRadius: 4,
  },
  overallHint: {
    textAlign: 'center',
  },
  breakdown: { paddingTop: spacing.sm },
  breakdownTitle: {
    marginBottom: spacing.lg,
  },
  footerNote: {
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
});
