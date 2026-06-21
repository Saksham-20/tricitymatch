import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import SmartImage from '../../components/common/SmartImage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import {
  getMutualMatches,
  getShortlisted,
  getLikedMe,
  performMatchAction,
} from '../../api/matches';
import { queryKeys } from '../../constants/queryKeys';
import { useOfflineShortlist } from '../../hooks/useOfflineShortlist';
import OfflineBanner from '../../components/common/OfflineBanner';
import type { MainStackParamList } from '../../navigation/types';
import type { Match, MatchAction } from '../../types';
import { useAuthStore, selectPlan } from '../../stores/authStore';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type TabKey = 'mutual' | 'shortlisted' | 'liked_me';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'mutual',      label: 'Mutual' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'liked_me',    label: 'Liked Me' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <View style={sk.row}>
      <View style={sk.avatar} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={sk.line} />
        <View style={[sk.line, { width: '55%' }]} />
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  avatar: { width: 64, height: 64, borderRadius: borderRadius.md, backgroundColor: colours.border },
  line: { height: 14, backgroundColor: colours.border, borderRadius: 7, width: '75%' },
});

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={em.container}>
      <Ionicons name={icon as any} size={56} color={colours.border} />
      <Text style={em.title}>{title}</Text>
      <Text style={em.sub}>{sub}</Text>
    </View>
  );
}
const em = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  title: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginTop: spacing.lg, textAlign: 'center' },
  sub: { fontSize: typography.fontSize.base, color: colours.textSecondary, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.sm },
});

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <View style={ug.container}>
      <View style={ug.lockIcon}>
        <Ionicons name="lock-closed" size={32} color={colours.primary} />
      </View>
      <Text style={ug.title}>Premium Feature</Text>
      <Text style={ug.sub}>See who liked your profile. Upgrade to Plus or higher.</Text>
      <TouchableOpacity style={ug.btn} onPress={onUpgrade} accessibilityLabel="Upgrade plan">
        <Ionicons name="flash" size={18} color="#fff" />
        <Text style={ug.btnText}>Upgrade Now</Text>
      </TouchableOpacity>
    </View>
  );
}
const ug = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  lockIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colours.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  sub: { fontSize: typography.fontSize.base, color: colours.textSecondary, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colours.primary, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  btnText: { color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.bold },
});

// ─── InterestStatus Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; label: string }> = {
    pending:  { color: colours.warning, label: 'Pending' },
    accepted: { color: colours.success, label: 'Accepted' },
    declined: { color: colours.error,   label: 'Declined' },
  };
  const cfg = configs[status] ?? configs.pending;
  return (
    <View style={[sb.badge, { backgroundColor: cfg.color + '20' }]}>
      <Text style={[sb.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  text: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold },
});

// ─── Match Row (shared list item) ─────────────────────────────────────────────

interface MatchRowProps {
  match: Match;
  mode: TabKey;
  onPress: () => void;
  onChat?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onRemove?: () => void;
}

function MatchRow({ match, mode, onPress, onChat, onAccept, onDecline, onRemove }: MatchRowProps) {
  const profile = match.MatchedProfile;
  const name = profile
    ? `${profile.firstName} ${profile.lastName}`
    : 'Unknown';
  const age = profile?.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const photoUri = profile?.profilePhoto ?? profile?.photos?.[0];
  const compat = match.compatibilityScore ?? profile?.compatibilityScore ?? 0;

  return (
    <TouchableOpacity style={mr.row} onPress={onPress} activeOpacity={0.85} accessibilityLabel={`${name} match`}>
      <View style={mr.photoWrap}>
        <SmartImage uri={photoUri} name={name} style={mr.photo} initialSize={24} />
        {profile?.isVerified && (
          <View style={mr.verifiedDot}>
            <Ionicons name="checkmark-circle" size={14} color={colours.success} />
          </View>
        )}
      </View>

      <View style={mr.body}>
        <Text style={mr.name} numberOfLines={1}>{name}{age ? `, ${age}` : ''}</Text>
        <Text style={mr.sub} numberOfLines={1}>
          {[profile?.profession, profile?.city].filter(Boolean).join(' · ')}
        </Text>
        {compat > 0 && (
          <View style={mr.compatRow}>
            <View style={mr.compatBar}>
              <View style={[mr.compatFill, { width: `${compat}%` }]} />
            </View>
            <Text style={mr.compatPct}>{compat}%</Text>
          </View>
        )}
      </View>

      <View style={mr.actions}>
        {mode === 'mutual' && onChat && (
          <TouchableOpacity style={mr.chatBtn} onPress={onChat} accessibilityLabel="Chat">
            <Ionicons name="chatbubble" size={16} color="#fff" />
            <Text style={mr.chatText}>Chat</Text>
          </TouchableOpacity>
        )}
        {mode === 'liked_me' && (
          <View style={mr.acceptRow}>
            {onAccept && (
              <TouchableOpacity style={mr.acceptBtn} onPress={onAccept} accessibilityLabel="Accept interest">
                <Ionicons name="heart" size={18} color={colours.success} />
              </TouchableOpacity>
            )}
            {onDecline && (
              <TouchableOpacity style={mr.declineBtn} onPress={onDecline} accessibilityLabel="Decline interest">
                <Ionicons name="close" size={18} color={colours.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {mode === 'shortlisted' && onRemove && (
          <TouchableOpacity style={mr.removeBtn} onPress={onRemove} accessibilityLabel="Remove from shortlist">
            <Ionicons name="bookmark" size={18} color={colours.secondary} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-forward" size={16} color={colours.textMuted} />
      </View>
    </TouchableOpacity>
  );
}
const mr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    gap: spacing.md,
  },
  photoWrap: { position: 'relative' },
  photo: { width: 64, height: 64, borderRadius: borderRadius.md, backgroundColor: colours.surfaceCard },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  verifiedDot: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: colours.background,
    borderRadius: borderRadius.full,
  },
  body: { flex: 1, gap: 3 },
  name: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  sub: { fontSize: typography.fontSize.sm, color: colours.textSecondary, fontFamily: typography.fontFamily.regular },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  compatBar: { flex: 1, height: 4, backgroundColor: colours.border, borderRadius: borderRadius.full, overflow: 'hidden' },
  compatFill: { height: 4, backgroundColor: colours.primary, borderRadius: borderRadius.full },
  compatPct: { fontSize: typography.fontSize.xs, color: colours.textMuted, fontFamily: typography.fontFamily.medium, minWidth: 28 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colours.primary, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
  },
  chatText: { color: '#fff', fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold },
  acceptRow: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colours.success + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colours.error + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colours.secondaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Tab Content ──────────────────────────────────────────────────────────────

function TabContent({ activeTab }: { activeTab: TabKey }) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  // "Liked Me" reveal is gated to paid plans (mirrors web). Any non-free tier unlocks it.
  const hasPlus = useAuthStore(selectPlan) !== 'free';

  const mutualQuery   = useQuery({ queryKey: queryKeys.mutualMatches,  queryFn: getMutualMatches,  enabled: activeTab === 'mutual' });
  const likedMeQuery  = useQuery({ queryKey: queryKeys.likedMe,        queryFn: getLikedMe,        enabled: activeTab === 'liked_me' });

  // Shortlisted uses offline-aware hook
  const {
    shortlist: offlineShortlist,
    isOffline,
    isStale,
    lastSyncedLabel,
    refetch: refetchShortlist,
  } = useOfflineShortlist();

  const actionMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: MatchAction }) =>
      performMatchAction(userId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likedMe });
      queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      performMatchAction(userId, 'pass'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shortlisted }),
  });

  const queryMap = {
    mutual:   mutualQuery,
    liked_me: likedMeQuery,
  };

  // For shortlisted tab, use offline hook data; for others use React Query
  let matches: Match[];
  let isLoading: boolean;
  let refetch: () => void;

  if (activeTab === 'shortlisted') {
    matches = offlineShortlist;
    isLoading = false;
    refetch = refetchShortlist;
  } else {
    const q = queryMap[activeTab as keyof typeof queryMap];
    matches = (q.data as Match[]) ?? [];
    isLoading = q.isLoading;
    refetch = q.refetch;
  }

  const emptyConfigs: Record<TabKey, { icon: string; title: string; sub: string }> = {
    mutual:      { icon: 'heart-circle',    title: 'No mutual matches yet',       sub: 'When you both like each other, you\'ll appear here.' },
    shortlisted: { icon: 'bookmark',        title: 'Your shortlist is empty',     sub: 'Shortlist profiles to revisit them anytime.' },
    liked_me:    { icon: 'heart',           title: 'No one has liked you yet',    sub: 'Improve your profile to attract more attention.' },
  };

  if (activeTab === 'liked_me' && !hasPlus) {
    return (
      <UpgradeGate onUpgrade={() => navigation.navigate('Subscription')} />
    );
  }

  if (isLoading) {
    return (
      <FlatList
        data={[1, 2, 3, 4]}
        keyExtractor={(i) => String(i)}
        renderItem={() => <RowSkeleton />}
        scrollEnabled={false}
      />
    );
  }

  if (matches.length === 0) {
    const cfg = emptyConfigs[activeTab];
    return <EmptyState icon={cfg.icon} title={cfg.title} sub={cfg.sub} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {activeTab === 'shortlisted' && isOffline && (
        <OfflineBanner
          lastSyncedLabel={lastSyncedLabel}
          isStale={isStale}
          onRefresh={refetchShortlist}
        />
      )}
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            mode={activeTab}
            onPress={() =>
              item.matchedUserId &&
              navigation.navigate('ProfileDetail', { userId: item.matchedUserId })
            }
            onChat={
              activeTab === 'mutual'
                ? () => navigation.navigate('MainTabs', { screen: 'Chat' } as any)
                : undefined
            }
            onAccept={
              activeTab === 'liked_me'
                ? () => actionMutation.mutate({ userId: item.userId, action: 'like' })
                : undefined
            }
            onDecline={
              activeTab === 'liked_me'
                ? () => actionMutation.mutate({ userId: item.userId, action: 'pass' })
                : undefined
            }
            onRemove={
              activeTab === 'shortlisted'
                ? () => removeMutation.mutate({ userId: item.matchedUserId })
                : undefined
            }
          />
        )}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colours.primary} />
        }
        contentContainerStyle={{ paddingBottom: spacing['5xl'] }}
        testID={`matches-list-${activeTab}`}
      />
    </View>
  );
}

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('mutual');

  return (
    <View style={s.container} testID="MatchesScreen">
      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityLabel={tab.label}
            testID={`tab-${tab.key}`}
          >
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <TabContent activeTab={activeTab} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.background,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    backgroundColor: colours.background,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colours.primary,
  },
  tabText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colours.textMuted,
  },
  tabTextActive: {
    color: colours.primary,
    fontFamily: typography.fontFamily.semiBold,
  },
});
