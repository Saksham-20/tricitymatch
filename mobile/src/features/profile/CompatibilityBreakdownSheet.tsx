import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
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

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <View style={sb.track}>
      <View style={[sb.fill, { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: color }]} />
    </View>
  );
}

const sb = StyleSheet.create({
  track: {
    flex: 1,
    height: 6,
    backgroundColor: colours.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
});

function scoreColor(score: number) {
  if (score >= 75) return colours.success;
  if (score >= 50) return colours.warning || '#f59e0b';
  return colours.error || '#ef4444';
}

function CategoryRow({ catKey, data }: { catKey: string; data: CompatibilityCategory }) {
  const meta = CATEGORY_META[catKey] || { label: catKey, icon: 'ellipse' as keyof typeof Ionicons.glyphMap };
  const color = scoreColor(data.score);
  return (
    <View style={cr.row}>
      <View style={[cr.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={meta.icon} size={18} color={color} />
      </View>
      <View style={cr.content}>
        <View style={cr.labelRow}>
          <Text style={cr.label}>{meta.label}</Text>
          <Text style={[cr.score, { color }]}>{data.score}%</Text>
        </View>
        <ScoreBar score={data.score} color={color} />
        {!!data.detail && <Text style={cr.detail}>{data.detail}</Text>}
      </View>
    </View>
  );
}

const cr = StyleSheet.create({
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
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  score: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
  },
  detail: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    marginTop: 4,
  },
});

export default function CompatibilityBreakdownSheet({ visible, userId, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
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
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Why This Match?</Text>
          <TouchableOpacity onPress={onClose} testID="breakdown-close" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colours.textSecondary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colours.primary} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={colours.textMuted} />
            <Text style={styles.errorText}>Could not load breakdown.</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Overall score */}
            <View style={styles.overallCard}>
              <Text style={styles.overallLabel}>Overall Compatibility</Text>
              <Text style={styles.overallScore}>{overallScore}%</Text>
              <View style={styles.overallBar}>
                <View style={[styles.overallFill, { width: `${overallScore}%` }]} />
              </View>
              <Text style={styles.overallHint}>
                {overallScore >= 75
                  ? 'Excellent match across key dimensions'
                  : overallScore >= 50
                  ? 'Good match with some differences'
                  : 'Some differences worth discussing'}
              </Text>
            </View>

            {/* Category breakdown */}
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>Score Breakdown</Text>
              {Object.entries(categories).length === 0 ? (
                <Text style={styles.errorText}>No breakdown data available.</Text>
              ) : (
                Object.entries(categories).map(([key, val]) =>
                  val ? <CategoryRow key={key} catKey={key} data={val} /> : null,
                )
              )}
            </View>

            {/* Footer note */}
            <Text style={styles.footerNote}>
              Compatibility is calculated from community, lifestyle, location, and horoscope factors.
            </Text>
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colours.border,
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
    borderBottomColor: colours.border,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'] || 48,
    gap: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colours.textMuted,
    textAlign: 'center',
  },
  scroll: { paddingHorizontal: spacing.lg },
  overallCard: {
    backgroundColor: colours.primaryLight + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  overallLabel: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 4,
  },
  overallScore: {
    fontSize: typography.fontSize['4xl'] || 36,
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
    lineHeight: 44,
  },
  overallBar: {
    width: '100%',
    height: 8,
    backgroundColor: colours.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  },
  overallFill: {
    height: '100%',
    backgroundColor: colours.primary,
    borderRadius: 4,
  },
  overallHint: {
    fontSize: typography.fontSize.xs,
    color: colours.textSecondary,
    textAlign: 'center',
  },
  breakdown: { paddingTop: spacing.sm },
  breakdownTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    marginBottom: spacing.lg,
  },
  footerNote: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
});
