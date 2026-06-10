import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getBureauClients, getBureauProposals, getBureauEarnings } from '../../api/bureau';
import type { BureauClient, MatchProposal, BureauEarnings, ProposalStatus } from '../../types';
import type { BureauStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauHome'>;

const STATUS_COLOUR: Record<ProposalStatus, string> = {
  pending:  colours.warning,
  viewed:   colours.info,
  accepted: colours.success,
  declined: colours.error,
};

interface SummaryCardProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | number;
  color?: string;
  onPress?: () => void;
}

function SummaryCard({ icon, label, value, color = colours.primary, onPress }: SummaryCardProps) {
  return (
    <TouchableOpacity
      style={[s.summaryCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProposalRow({ proposal }: { proposal: MatchProposal }) {
  const statusColor = STATUS_COLOUR[proposal.status];
  return (
    <View style={s.proposalRow}>
      <View style={s.proposalNames}>
        <Text style={s.proposalClient} numberOfLines={1}>
          {[proposal.clientProfile?.firstName, proposal.clientProfile?.lastName].filter(Boolean).join(' ') || 'Client'}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={colours.textMuted} />
        <Text style={s.proposalMatch} numberOfLines={1}>
          {[proposal.proposedProfile?.firstName, proposal.proposedProfile?.lastName].filter(Boolean).join(' ') || 'Match'}
        </Text>
      </View>
      <View style={[s.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
        <Text style={[s.statusText, { color: statusColor }]}>{proposal.status}</Text>
      </View>
    </View>
  );
}

export default function BureauHomeScreen() {
  const nav = useNavigation<Nav>();

  const clientsQ = useQuery<BureauClient[]>({
    queryKey: ['bureau', 'clients'],
    queryFn: getBureauClients,
  });

  const proposalsQ = useQuery<MatchProposal[]>({
    queryKey: ['bureau', 'proposals'],
    queryFn: getBureauProposals,
  });

  const earningsQ = useQuery<BureauEarnings>({
    queryKey: ['bureau', 'earnings'],
    queryFn: getBureauEarnings,
  });

  const totalClients  = clientsQ.data?.length ?? 0;
  const totalProposals = proposalsQ.data?.length ?? 0;
  const pendingCount  = proposalsQ.data?.filter(p => p.status === 'pending').length ?? 0;
  const totalEarnings = earningsQ.data?.total ?? 0;

  const recentProposals = (proposalsQ.data ?? []).slice(0, 5);

  const isLoading = clientsQ.isLoading && proposalsQ.isLoading;

  const refetch = () => {
    clientsQ.refetch();
    proposalsQ.refetch();
    earningsQ.refetch();
  };

  return (
    <SafeAreaView style={s.safe} testID="BureauHomeScreen">
      <View style={s.header}>
        <Text style={s.title}>Bureau Console</Text>
        {isLoading && <ActivityIndicator size="small" color={colours.primary} />}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={clientsQ.isFetching} onRefresh={refetch} />}
      >
        <Text style={s.sectionTitle}>Overview</Text>
        <View style={s.summaryGrid}>
          <SummaryCard
            icon="people"
            label="Clients"
            value={totalClients}
            onPress={() => nav.navigate('ClientRoster')}
          />
          <SummaryCard
            icon="git-compare-outline"
            label="Proposals"
            value={totalProposals}
            color={colours.badgeEducation}
          />
          <SummaryCard
            icon="time-outline"
            label="Pending"
            value={pendingCount}
            color={colours.warning}
          />
          <SummaryCard
            icon="cash-outline"
            label="Earnings"
            value={`₹${totalEarnings.toLocaleString()}`}
            color={colours.success}
            onPress={() => nav.navigate('Earnings')}
          />
        </View>

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Recent Proposals</Text>
          <TouchableOpacity onPress={() => nav.navigate('MatchProposal', { profileId: '' })}>
            <Text style={s.sectionLink}>+ New</Text>
          </TouchableOpacity>
        </View>

        {proposalsQ.isLoading ? (
          <ActivityIndicator color={colours.primary} />
        ) : recentProposals.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No proposals yet</Text>
          </View>
        ) : (
          <View style={s.proposalsCard}>
            {recentProposals.map((p, i) => (
              <React.Fragment key={p.id}>
                {i > 0 && <View style={s.divider} />}
                <ProposalRow proposal={p} />
              </React.Fragment>
            ))}
          </View>
        )}

        <TouchableOpacity style={s.rosterBtn} onPress={() => nav.navigate('ClientRoster')}>
          <Ionicons name="people-outline" size={18} color={colours.primary} />
          <Text style={s.rosterBtnText}>View All Clients</Text>
          <Ionicons name="chevron-forward" size={16} color={colours.primary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  scroll: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionLink: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.primary,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    width: '47%',
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    gap: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
  },
  proposalsCard: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  proposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  proposalNames: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  proposalClient: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  proposalMatch: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    textAlign: 'right',
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semiBold,
    textTransform: 'capitalize',
  },
  divider: { height: 1, backgroundColor: colours.border, marginLeft: spacing.md },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
  },
  rosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colours.primary,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  rosterBtnText: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.primary,
  },
});
