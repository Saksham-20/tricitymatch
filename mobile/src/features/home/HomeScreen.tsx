import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import SmartImage from '../../components/common/SmartImage';
import { getDailyFeed } from '../../api/matches';
import { getNotifications } from '../../api/notifications';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import type { MainStackParamList } from '../../navigation/types';
import type { ProfileSummary } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonPhoto} />
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '60%' }]} />
    </View>
  );
}

function ListItemSkeleton() {
  return (
    <View style={styles.skeletonListItem}>
      <View style={styles.skeletonAvatar} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[styles.skeletonLine, { width: '70%', marginBottom: 0 }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 10, marginBottom: 0 }]} />
      </View>
    </View>
  );
}

// ─── Match Card (horizontal scroll) ─────────────────────────────────────────

interface MatchCardProps {
  profile: ProfileSummary;
  onPress: () => void;
}

function MatchCard({ profile, onPress }: MatchCardProps) {
  const age = ageFromDob(profile.dateOfBirth);
  const title = age ? `${profile.firstName}, ${age}` : profile.firstName;
  const sub = [profile.city, profile.profession].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={onPress}
      testID={`match-card-${profile.userId}`}
      accessibilityLabel={`View profile of ${title}`}
    >
      <SmartImage uri={profile.profilePhoto} name={title} style={styles.matchPhoto} initialSize={40} />
      {profile.isVerified && (
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colours.success} />
        </View>
      )}
      <View style={styles.matchInfo}>
        <Text style={styles.matchName} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.matchSub} numberOfLines={1}>{sub}</Text>}
        {typeof profile.compatibilityScore === 'number' && (
          <View style={styles.compatRow}>
            <View style={styles.compatBar}>
              <View style={[styles.compatFill, { width: `${profile.compatibilityScore}%` }]} />
            </View>
            <Text style={styles.compatLabel}>{profile.compatibilityScore}%</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── New Profile List Item ───────────────────────────────────────────────────

interface NewProfileItemProps {
  profile: ProfileSummary;
  onPress: () => void;
}

function NewProfileItem({ profile, onPress }: NewProfileItemProps) {
  const age = ageFromDob(profile.dateOfBirth);
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const detail = [age ? `${age} yrs` : null, profile.profession, profile.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      style={styles.newProfileItem}
      onPress={onPress}
      testID={`new-profile-${profile.userId}`}
      accessibilityLabel={`View profile of ${name}`}
    >
      <SmartImage uri={profile.profilePhoto} name={name} style={styles.newAvatar} initialSize={18} />
      <View style={{ flex: 1 }}>
        <Text style={styles.newName} numberOfLines={1}>{name}</Text>
        {!!detail && <Text style={styles.newDetail} numberOfLines={1}>{detail}</Text>}
      </View>
      {profile.isVerified && (
        <Ionicons name="checkmark-circle" size={18} color={colours.success} />
      )}
      <Ionicons name="chevron-forward" size={16} color={colours.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);

  const {
    data: feed,
    isLoading: feedLoading,
    refetch: refetchFeed,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.dailyMatches,
    queryFn: getDailyFeed,
    staleTime: 5 * 60 * 1000,
  });

  const { data: notifData } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => getNotifications(),
    staleTime: 60 * 1000,
  });

  const unreadCount = notifData?.notifications.filter((n) => !n.isRead).length ?? 0;
  const completionPct = user?.Profile?.completionPercentage ?? 0;
  const firstName = user?.Profile?.firstName ?? user?.email?.split('@')[0] ?? 'there';
  const planLabel =
    user?.subscriptionPlan && user.subscriptionPlan !== 'free'
      ? user.subscriptionPlan.replace(/_/g, ' ').toUpperCase()
      : null;

  const onRefresh = useCallback(async () => {
    await refetchFeed();
  }, [refetchFeed]);

  const goToProfile = (userId: string) => navigation.navigate('ProfileDetail', { userId });
  const goToNotifications = () => navigation.navigate('Notifications');
  const goToOwnProfile = () => navigation.navigate('MainTabs', { screen: 'Profile' } as never);
  const goToMatches = () => navigation.navigate('MainTabs', { screen: 'Matches' } as never);

  const todaysMatches = feed?.slice(0, 10) ?? [];
  const newProfiles = feed?.slice(10) ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={colours.primary}
        />
      }
      testID="HomeScreen"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>TricityShadi</Text>
        <TouchableOpacity
          onPress={goToNotifications}
          testID="notif-bell"
          accessibilityLabel="Notifications"
          style={styles.bellBtn}
        >
          <Ionicons name="notifications-outline" size={24} color={colours.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Welcome + plan badge */}
      <View style={styles.welcomeRow}>
        <Text style={styles.welcomeText}>Welcome back, {firstName}</Text>
        {planLabel && (
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>{planLabel}</Text>
          </View>
        )}
      </View>

      {/* Profile completeness strip */}
      <TouchableOpacity
        style={styles.completenessCard}
        onPress={goToOwnProfile}
        testID="completeness-strip"
        accessibilityLabel={`Profile ${completionPct}% complete, tap to edit`}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.completenessLabel}>Profile completeness</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
          </View>
        </View>
        <Text style={styles.completenessPct}>{completionPct}%</Text>
        <Ionicons name="chevron-forward" size={18} color={colours.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {/* Today's Matches */}
      <Text style={styles.sectionTitle}>{t('home.todaysMatches', "Today's Matches")}</Text>
      {feedLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          <View style={styles.hScrollContent}>
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </View>
        </ScrollView>
      ) : todaysMatches.length > 0 ? (
        <FlatList
          data={todaysMatches}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <MatchCard profile={item} onPress={() => goToProfile(item.userId)} />
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hScrollContent}
          style={styles.hScroll}
        />
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="heart-outline" size={32} color={colours.textMuted} />
          <Text style={styles.emptyText}>
            No matches yet. Complete your profile for better suggestions.
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={goToMatches}
          testID="quick-liked-you"
          accessibilityLabel="Who liked you"
        >
          <Ionicons name="heart" size={24} color={colours.primary} />
          <Text style={styles.quickLabel}>Liked you</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={goToOwnProfile}
          testID="quick-profile-views"
          accessibilityLabel="Profile views"
        >
          <Ionicons name="eye" size={24} color={colours.secondary} />
          <Text style={styles.quickLabel}>Profile views</Text>
        </TouchableOpacity>
      </View>

      {/* New on TricityShadi */}
      {newProfiles.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>New on TricityShadi</Text>
          {newProfiles.map((p) => (
            <NewProfileItem key={p.userId} profile={p} onPress={() => goToProfile(p.userId)} />
          ))}
        </>
      )}
      {feedLoading && (
        <>
          <Text style={styles.sectionTitle}>New on TricityShadi</Text>
          {[0, 1, 2].map((i) => <ListItemSkeleton key={i} />)}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  content: { paddingTop: 52, paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
  },
  bellBtn: { padding: 4, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colours.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { fontSize: 10, color: '#fff', fontFamily: typography.fontFamily.bold },

  welcomeRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  welcomeText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    marginBottom: 4,
  },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colours.primaryLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colours.primary,
    fontFamily: typography.fontFamily.semiBold,
  },

  completenessCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colours.border,
  },
  completenessLabel: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    marginBottom: 6,
    fontFamily: typography.fontFamily.medium,
  },
  progressBar: {
    height: 6,
    backgroundColor: colours.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colours.primary,
    borderRadius: 3,
  },
  completenessPct: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    color: colours.primary,
    marginLeft: spacing.md,
  },

  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  hScroll: { marginBottom: spacing.xl },
  hScrollContent: { paddingHorizontal: spacing.lg, gap: spacing.md, flexDirection: 'row' },

  matchCard: {
    width: 160,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colours.border,
  },
  matchPhoto: { width: '100%', height: 180, backgroundColor: colours.border },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
  },
  matchInfo: { padding: spacing.sm },
  matchName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    marginBottom: 2,
  },
  matchSub: { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginBottom: 6 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compatBar: { flex: 1, height: 4, backgroundColor: colours.border, borderRadius: 2, overflow: 'hidden' },
  compatFill: { height: '100%', backgroundColor: colours.success, borderRadius: 2 },
  compatLabel: {
    fontSize: typography.fontSize.xs,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },

  emptyCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colours.border,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    textAlign: 'center',
  },

  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  quickCard: {
    flex: 1,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colours.border,
  },
  quickLabel: {
    fontSize: typography.fontSize.xs,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },

  newProfileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
  },
  newAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colours.border,
  },
  newName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
  },
  newDetail: { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginTop: 2 },

  skeletonCard: {
    width: 160,
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colours.border,
    padding: spacing.sm,
  },
  skeletonPhoto: {
    width: '100%',
    height: 180,
    backgroundColor: colours.border,
    borderRadius: borderRadius.sm,
    marginBottom: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: colours.border,
    borderRadius: 4,
    marginBottom: 6,
    width: '80%',
  },
  skeletonListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colours.border,
  },
});
