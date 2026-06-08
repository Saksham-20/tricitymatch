import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getBureauEarnings } from '../../api/bureau';
import type { BureauEarnings } from '../../types';

export default function EarningsScreen() {
  const nav = useNavigation();

  const { data, isLoading, refetch, isFetching } = useQuery<BureauEarnings>({
    queryKey: ['bureau', 'earnings'],
    queryFn: getBureauEarnings,
  });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <SafeAreaView style={s.safe} testID="EarningsScreen">
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Earnings</Text>
        {isLoading && <ActivityIndicator size="small" color={colours.primary} />}
      </View>

      {isLoading ? (
        <ActivityIndicator style={s.loader} color={colours.primary} />
      ) : (
        <FlatList
          data={data?.breakdown ?? []}
          keyExtractor={(_, i) => String(i)}
          ListHeaderComponent={
            <>
              {/* Summary cards */}
              <View style={s.summaryRow}>
                <View style={[s.summaryCard, { borderLeftColor: colours.success }]}>
                  <Text style={s.summaryLabel}>Total Earned</Text>
                  <Text style={[s.summaryValue, { color: colours.success }]}>{fmt(data?.total ?? 0)}</Text>
                </View>
                <View style={[s.summaryCard, { borderLeftColor: colours.warning }]}>
                  <Text style={s.summaryLabel}>Pending</Text>
                  <Text style={[s.summaryValue, { color: colours.warning }]}>{fmt(data?.pending ?? 0)}</Text>
                </View>
              </View>
              <View style={s.paidRow}>
                <View style={[s.paidCard, { borderLeftColor: '#3B82F6' }]}>
                  <Text style={s.summaryLabel}>Paid Out</Text>
                  <Text style={[s.summaryValue, { color: '#3B82F6' }]}>{fmt(data?.paid ?? 0)}</Text>
                </View>
              </View>

              <Text style={s.sectionTitle}>Transaction History</Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={s.txRow} testID="tx-row">
              <View style={s.txLeft}>
                <Text style={s.txDesc}>{item.description}</Text>
                <Text style={s.txDate}>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <Text style={[s.txAmount, { color: colours.success }]}>+{fmt(item.amount)}</Text>
            </View>
          )}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="cash-outline" size={48} color={colours.textMuted} />
              <Text style={s.emptyText}>No transactions yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  loader: { marginTop: spacing.xl },
  list: { padding: spacing.lg, gap: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  paidRow: { marginBottom: spacing.sm },
  summaryCard: {
    flex: 1,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    gap: spacing.xs,
  },
  paidCard: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  txLeft: { flex: 1, gap: 3 },
  txDesc: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  txDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  txAmount: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textMuted,
  },
});
