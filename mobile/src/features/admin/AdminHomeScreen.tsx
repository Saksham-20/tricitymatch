import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getAdminStats, getVerificationQueue, getReportsQueue } from '../../api/admin';
import type { AdminStackParamList } from '../../navigation/types';
import Text from '../../components/ui/Text';
import { PressableScale } from '../../components/motion';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminHome'>;

/**
 * Mirrors `GET /admin/analytics` → `stats`, field for field.
 *
 * The previous shape was invented: `signupsToday`, `activeSubscriptions` and
 * `revenueToday` are names the server has never sent. Combined with an API
 * helper that returned the `{ success, stats }` envelope instead of `stats`,
 * every tile read `undefined` — the console rendered blank figures and a
 * literal "₹undefined" where the day's revenue belongs.
 *
 * There is no "today" revenue or signup figure server-side (revenue is
 * month-to-date and registrations arrive as a dated series), so the tiles say
 * what the numbers actually are.
 */
interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscribers: number;
  revenueThisMonth: number;
  pendingVerifications: number;
  openReports: number;
}

interface StatCardProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | number;
  color?: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const { c } = useTheme();
  const tint = color ?? c.primary;
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <View style={[s.statCard, { borderLeftColor: tint }]}>
      <Ionicons name={icon} size={22} tint={tint} />
      <Text variant="title3" color="textPrimary">{value}</Text>
      <Text variant="footnote" color="textSecondary">{label}</Text>
    </View>
  );
}

interface QueueRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  count: number;
  color: string;
  onPress: () => void;
  testID?: string;
}

function QueueRow({ icon, label, count, color, onPress, testID }: QueueRowProps) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <PressableScale
      style={s.queueRow}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={[s.queueIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text variant="subhead" color="textPrimary" style={s.queueLabel}>{label}</Text>
      <View style={[s.badge, { backgroundColor: count > 0 ? color : c.textMuted }]}>
        <Text variant="caption" style={s.badgeText}>{count > 99 ? '99+' : count}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
    </PressableScale>
  );
}

export default function AdminHomeScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const nav = useNavigation<Nav>();

  const statsQ = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
  });

  const verifQ = useQuery<unknown[]>({
    queryKey: ['admin', 'verificationQueue'],
    queryFn: getVerificationQueue,
  });

  const reportsQ = useQuery<unknown[]>({
    queryKey: ['admin', 'reportsQueue'],
    queryFn: getReportsQueue,
  });

  const isLoading = statsQ.isLoading;
  const stats: AdminStats = statsQ.data ?? {
    totalUsers: 0,
    verifiedUsers: 0,
    activeSubscribers: 0,
    revenueThisMonth: 0,
    pendingVerifications: 0,
    openReports: 0,
  };

  const pendingVerif = verifQ.data?.length ?? stats.pendingVerifications;
  const openReports  = reportsQ.data?.length ?? stats.openReports;

  const refetch = () => {
    statsQ.refetch();
    verifQ.refetch();
    reportsQ.refetch();
  };

  return (
    <SafeAreaView style={s.safe} testID="AdminHomeScreen">
      <View style={s.header}>
        {/*
         * The console is the root of its own stack, so it has no back button of
         * its own and the iOS swipe-back gesture is swallowed by the nested
         * navigator: an admin who opened this screen could not get out of it
         * without force-quitting. Pop the parent stack explicitly.
         */}
        <PressableScale
          onPress={() => (nav.getParent() ?? nav).goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="admin-back"
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
        <Text variant="title2" color="textPrimary" style={s.title}>Admin Console</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : (
          <View style={s.headerSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={statsQ.isFetching} onRefresh={refetch} />}
      >
        <Text variant="caption" color="textSecondary" style={s.sectionTitle}>Overview</Text>
        <View style={s.statsGrid}>
          <StatCard icon="people" label="Total Users" value={(stats.totalUsers ?? 0).toLocaleString()} />
          <StatCard icon="card" label="Active Subs" value={(stats.activeSubscribers ?? 0).toLocaleString()} color={c.info} />
          <StatCard
            icon="cash"
            label="Revenue This Month"
            value={`₹${(stats.revenueThisMonth ?? 0).toLocaleString()}`}
            color={c.success}
          />
          <StatCard
            icon="shield-checkmark"
            label="Verified Users"
            value={(stats.verifiedUsers ?? 0).toLocaleString()}
            color={c.badgeEducation}
          />
        </View>

        <Text variant="caption" color="textSecondary" style={s.sectionTitle}>Action Queues</Text>
        <View style={s.queuesCard}>
          <QueueRow
            icon="shield-checkmark-outline"
            label="Verification Requests"
            count={pendingVerif}
            color={c.warning}
            onPress={() => nav.navigate('VerificationQueue')}
            testID="queue-verif"
          />
          <View style={s.divider} />
          <QueueRow
            icon="flag-outline"
            label="Reported Users"
            count={openReports}
            color={c.error}
            onPress={() => nav.navigate('ReportsQueue')}
            testID="queue-reports"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  title: {
    flex: 1,
  },
  headerSpacer: { width: 24 },
  scroll: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '47%',
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    gap: spacing.xs,
  },
  queuesCard: {
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  queueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueLabel: {
    flex: 1,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginLeft: spacing.md + 36 + spacing.sm,
  },
});
