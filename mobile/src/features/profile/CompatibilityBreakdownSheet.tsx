import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, useFillAnimation, useReduceMotion } from '../../components/motion';
import Text from '../../components/ui/Text';
import { EmptyState, SkeletonBlock } from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { STAGGER_MS } from '@shared/constants/motion';
import { getCompatibilityBreakdown } from '../../api/profile';
import type { CompatibilityCategory } from '../../api/profile';

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

const CATEGORY_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  community: { label: 'Community and religion', icon: 'people' },
  age:       { label: 'Age compatibility',      icon: 'calendar' },
  location:  { label: 'Location',               icon: 'location' },
  lifestyle: { label: 'Lifestyle',              icon: 'leaf' },
  horoscope: { label: 'Horoscope',              icon: 'star' },
};

/** §4.3: stagger is capped at 6 siblings. */
const staggerDelay = (index: number) => Math.min(index, 5) * STAGGER_MS;

/** Production masks any non-operational server error with this line; it names nothing. */
const MASKED_SERVER_MESSAGE = /unexpected error occurred/i;

/**
 * One sentence naming why a request failed and what to do next (copy law 7).
 * "Check your connection" is only true when no response came back at all: a 403,
 * a rate limit and a 5xx each need their own words, or the member retries a
 * request that can never succeed. Shared by the profile-detail surfaces (the
 * action bar, the block/report sheet, this sheet and the Kundli screen).
 */
export function describeFailure(err: unknown): string {
  const e = err as {
    retryAfter?: number;
    response?: { status?: number; data?: { message?: unknown; error?: { message?: unknown } } };
  } | null;
  // api/client.ts rewrites a 429 into a plain Error carrying `retryAfter`, with no `response`.
  if (typeof e?.retryAfter === 'number') return 'Too many requests just now. Wait a moment and try again.';
  const status = e?.response?.status;
  if (!status) return 'Check your connection and try again.';
  if (status >= 500) return 'Something went wrong on our side. Try again in a moment.';
  const message = e?.response?.data?.error?.message ?? e?.response?.data?.message;
  if (typeof message === 'string' && message.trim() && !MASKED_SERVER_MESSAGE.test(message)) {
    const said = message.trim();
    return /[.!?]$/.test(said) ? said : `${said}.`;
  }
  return 'Try again in a moment.';
}

function ScoreBar({ score, color, index = 0 }: { score: number; color: string; index?: number }) {
  const { c } = useTheme();
  const sb = React.useMemo(() => makeSb(c), [c]);
  // Bar fill: 0 → value on mount, staggered per row. The shared hook owns the
  // curve, the duration and the Reduce Motion jump-to-end.
  const clamped = Math.max(0, Math.min(100, score));
  const progress = useFillAnimation(clamped, { delayMs: staggerDelay(index) });
  const fill = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return (
    <View style={sb.track}>
      <Animated.View style={[sb.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const makeSb = (c: ThemeColours) => StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: c.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  // Absolute and childless: the one shape whose animated width does not re-run
  // layout for its siblings (doctrine §10.4).
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
});

// successAccent is the green that stays legible on a dark surface; `success` is not.
function scoreColor(score: number, c: ThemeColours) {
  if (score >= 75) return c.successAccent;
  if (score >= 50) return c.warning;
  return c.error;
}

function CategoryRow({ catKey, data, index = 0 }: { catKey: string; data: CompatibilityCategory; index?: number }) {
  const { c } = useTheme();
  const cr = React.useMemo(() => makeCr(c), [c]);
  const meta = CATEGORY_META[catKey] || { label: catKey, icon: 'ellipse' as keyof typeof Ionicons.glyphMap };
  const color = scoreColor(data.score, c);
  return (
    <View
      style={cr.row}
      accessible
      accessibilityLabel={`${meta.label}, ${data.score} percent${data.detail ? `. ${data.detail}` : ''}`}
    >
      <View style={[cr.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={meta.icon} size={18} color={color} />
      </View>
      <View style={cr.content}>
        <View style={cr.labelRow}>
          <Text variant="caption" color="textPrimary" style={cr.label}>{meta.label}</Text>
          {/* The number carries the meaning; colour lives on the icon and bar,
              where a low-contrast tone is a fill rather than text. */}
          <Text variant="caption" color="textPrimary">{data.score}%</Text>
        </View>
        <ScoreBar score={data.score} color={color} index={index} />
        {!!data.detail && <Text variant="footnote" color="textSecondary" style={cr.detail}>{data.detail}</Text>}
      </View>
    </View>
  );
}

const makeCr = (_c: ThemeColours) => StyleSheet.create({
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
    gap: spacing.sm,
    marginBottom: 6,
  },
  label: { flexShrink: 1 },
  detail: {
    marginTop: 4,
  },
});

// Loading placeholder shaped like the loaded sheet body: overall card, the
// "Score breakdown" title, then five category rows (icon, label + %, bar, detail).
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
  const insets = useSafeAreaInsets();
  const reducedMotion = useReduceMotion();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['compatibility', userId],
    queryFn: () => getCompatibilityBreakdown(userId),
    enabled: visible,
    staleTime: 10 * 60 * 1000,
  });

  const categories = (data?.breakdown?.categories ?? {}) as Record<string, CompatibilityCategory | undefined>;
  // A response with no score is "no data", not a 0% match.
  const hasScore = typeof data?.overallScore === 'number';
  const overallScore = hasScore ? (data?.overallScore as number) : 0;
  const hint =
    overallScore >= 75
      ? 'Excellent match across key dimensions'
      : overallScore >= 50
        ? 'Good match with some differences'
        : 'Some differences worth discussing';

  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? 'fade' : 'slide'}
      transparent
      // Android: without this the scrim stops below the status bar and leaves a bright strip.
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <PressableScale
        style={[styles.backdrop, { backgroundColor: c.scrim }]}
        onPress={onClose}
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={[styles.sheet, { backgroundColor: c.sheetBg }]}>
        {/* No grabber: this is a plain slide-up Modal that does not drag, so a handle
            would advertise a swipe that does nothing. The backdrop, Close and
            Android back are the dismiss paths. */}
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headline" color="textPrimary" accessibilityRole="header">Why this match?</Text>
          <PressableScale
            onPress={onClose}
            testID="breakdown-close-tap44-hitslop"
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
        ) : (isError && !data) ? (
          <EmptyState
            variant="error"
            icon="alert-circle-outline"
            title="Couldn't load breakdown"
            description={describeFailure(error)}
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="CompatibilityBreakdownSheet-error"
          />
        ) : !hasScore ? (
          <EmptyState
            icon="analytics-outline"
            title="No breakdown yet"
            description="There isn't enough profile detail to score this match."
            testID="CompatibilityBreakdownSheet-empty"
          />
        ) : (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Overall score */}
            <View
              style={styles.overallCard}
              accessible
              accessibilityLabel={`Overall compatibility ${overallScore} percent. ${hint}`}
            >
              <Text variant="subhead" color="textSecondary" style={styles.overallLabel}>Overall compatibility</Text>
              <Text variant="display" color="primary">{overallScore}%</Text>
              <View style={styles.overallBar}>
                <View style={[styles.overallFill, { width: `${overallScore}%` }]} />
              </View>
              <Text variant="footnote" color="textSecondary" style={styles.overallHint}>{hint}</Text>
            </View>

            {/* Category breakdown */}
            <View style={styles.breakdown}>
              <Text variant="headline" color="textPrimary" style={styles.breakdownTitle} accessibilityRole="header">
                Score breakdown
              </Text>
              {Object.entries(categories).length === 0 ? (
                <EmptyState
                  icon="analytics-outline"
                  title="No breakdown yet"
                  description="There isn't enough profile detail to score this match by category."
                  testID="CompatibilityBreakdownSheet-categories-empty"
                />
              ) : (
                Object.entries(categories).map(([key, val], i) =>
                  val ? <CategoryRow key={key} catKey={key} data={val} index={i} /> : null,
                )
              )}
            </View>

            {/* Footer note */}
            <Text variant="footnote" color="textSecondary" style={styles.footerNote}>
              Compatibility is calculated from age, community, lifestyle, location, and horoscope factors.
            </Text>
            <View style={{ height: insets.bottom + spacing.xl }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingTop: spacing.lg,
    maxHeight: '80%',
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
    backgroundColor: c.accentSoft,
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
