import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { colours, type, spacing, borderRadius } from '@shared/constants/theme';
import SmartImage from '../../components/common/SmartImage';
import { Avatar, SectionHeader, SkeletonBlock, EmptyState, CompletionRing } from '../../components/ui';
import { getDailyFeed } from '../../api/matches';
import { getUnreadCount } from '../../api/notifications';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import type { MainStackParamList } from '../../navigation/types';
import type { ProfileSummary } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const scoreColour = (p: number) => (p >= 90 ? colours.success : p >= 75 ? colours.g500 : colours.p500);

// ─── Rail card (166×226 scrim photo) ─────────────────────────────────────────
function RailCard({ profile, onPress, c }: { profile: ProfileSummary; onPress: () => void; c: ReturnType<typeof useTheme>['c'] }) {
  const age = ageFromDob(profile.dateOfBirth);
  const name = `${profile.firstName}${age ? `, ${age}` : ''}`;
  const compat = profile.compatibilityScore ?? 0;
  return (
    <TouchableOpacity
      style={[styles.rail, { backgroundColor: c.surface2 }]}
      onPress={onPress}
      activeOpacity={0.9}
      testID={`match-card-${profile.userId}`}
      accessibilityLabel={`View profile of ${name}`}
    >
      <SmartImage uri={profile.profilePhoto} name={name} style={styles.railPhoto} initialSize={44} />
      <LinearGradient
        colors={['transparent', 'rgba(20,8,14,0.35)', 'rgba(20,8,14,0.88)']}
        locations={[0.35, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.railBody} pointerEvents="none">
        <View style={styles.railNameRow}>
          <Text style={styles.railName} numberOfLines={1}>{name}</Text>
          {profile.isVerified && <Ionicons name="checkmark-circle" size={14} color="#5DD27A" />}
        </View>
        <Text style={styles.railMeta} numberOfLines={1}>
          {[profile.city, profile.profession].filter(Boolean).join(' · ')}
        </Text>
        {compat > 0 && (
          <View style={styles.railChip}>
            <View style={[styles.railDot, { backgroundColor: scoreColour(compat) }]} />
            <Text style={styles.railChipText}>{compat}%</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);

  const { data: feed, isLoading: feedLoading, refetch: refetchFeed, isRefetching, isError } = useQuery({
    queryKey: queryKeys.dailyMatches,
    queryFn: getDailyFeed,
    staleTime: 5 * 60 * 1000,
  });

  const { data: countData } = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: getUnreadCount,
    staleTime: 60 * 1000,
  });

  const unreadCount = countData?.count ?? 0;
  const completionPct = user?.Profile?.completionPercentage ?? 0;
  const firstName = user?.Profile?.firstName ?? user?.email?.split('@')[0] ?? 'there';
  const photo = user?.Profile?.profilePhoto;

  const onRefresh = useCallback(async () => {
    haptics.light();
    await refetchFeed();
  }, [refetchFeed]);

  const goToProfile = (userId: string) => navigation.navigate('ProfileDetail', { userId });
  const goToNotifications = () => navigation.navigate('Notifications');
  const goToOwnProfile = () => navigation.navigate('MainTabs', { screen: 'Profile' } as never);
  const goToMatches = () => navigation.navigate('MainTabs', { screen: 'Matches' } as never);
  const goToSearch = () => navigation.navigate('MainTabs', { screen: 'Search' } as never);

  const todaysMatches = feed?.slice(0, 10) ?? [];
  const newProfiles = feed?.slice(10) ?? [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={c.accent} />}
      testID="HomeScreen"
    >
      {/* Greeting header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.greetRow} onPress={goToOwnProfile} activeOpacity={0.8}>
          <Avatar uri={photo} name={firstName} size={42} />
          <View>
            <Text style={[styles.greetSmall, { color: c.textMuted }]}>{greeting()},</Text>
            <Text style={[styles.greetName, { color: c.fgStrong }]} numberOfLines={1}>{firstName}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNotifications} testID="notif-bell" accessibilityLabel="Notifications" style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={24} color={c.fgStrong} />
          {unreadCount > 0 && <View style={[styles.bellDot, { borderColor: c.background }]} />}
        </TouchableOpacity>
      </View>

      {/* Completeness strip */}
      {completionPct < 100 && (
        <TouchableOpacity
          style={[styles.completeCard, { backgroundColor: c.surfaceCard, borderColor: c.border }]}
          onPress={goToOwnProfile}
          testID="completeness-strip"
          accessibilityLabel={`Profile ${completionPct}% complete, tap to edit`}
        >
          <CompletionRing value={completionPct} size={58} caption="" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.completeTitle, { color: c.fgStrong }]}>Complete your profile</Text>
            <Text style={[styles.completeSub, { color: c.textMuted }]}>
              A complete profile gets up to 5× more interest.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
      )}

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <QuickChip icon="heart" label="Liked you" tint={colours.accent} onPress={goToMatches} c={c} testID="quick-liked-you" />
        <QuickChip icon="eye" label="Visitors" tint={colours.g600} onPress={goToOwnProfile} c={c} testID="quick-profile-views" />
        <QuickChip icon="search" label="Search" tint={colours.accent} onPress={goToSearch} c={c} testID="quick-search" />
      </View>

      {/* Today's Matches */}
      <SectionHeader
        title={t('home.todaysMatches', "Today's Matches")}
        count={todaysMatches.length || undefined}
        style={styles.sectionPad}
        action={
          <TouchableOpacity onPress={goToMatches}>
            <Text style={[styles.seeAll, { color: c.accent }]}>See all</Text>
          </TouchableOpacity>
        }
      />
      {feedLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railScroll}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} width={166} height={226} radius={borderRadius.lg} style={{ marginRight: 12 }} />
          ))}
        </ScrollView>
      ) : isError ? (
        <EmptyState variant="error" title="Couldn't load matches" description="Check your connection and try again." actionLabel="Retry" onAction={onRefresh} />
      ) : todaysMatches.length > 0 ? (
        <FlatList
          data={todaysMatches}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => <RailCard profile={item} onPress={() => goToProfile(item.userId)} c={c} />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railScroll}
          snapToInterval={178}
          decelerationRate="fast"
        />
      ) : (
        <EmptyState
          icon="heart-outline"
          title="No matches yet"
          description="Complete your profile for better suggestions."
          actionLabel="Edit profile"
          onAction={goToOwnProfile}
        />
      )}

      {/* New near you */}
      {(newProfiles.length > 0 || feedLoading) && (
        <SectionHeader title="New near you" style={styles.sectionPad} />
      )}
      {feedLoading
        ? [0, 1, 2].map((i) => (
            <View key={i} style={styles.newRow}>
              <SkeletonBlock width={54} height={54} radius={borderRadius.pill} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBlock width="60%" height={14} />
                <SkeletonBlock width="40%" height={11} />
              </View>
            </View>
          ))
        : newProfiles.map((p) => {
            const age = ageFromDob(p.dateOfBirth);
            const name = `${p.firstName} ${p.lastName}`.trim();
            return (
              <TouchableOpacity
                key={p.userId}
                style={[styles.newRow, { borderBottomColor: c.border }]}
                onPress={() => goToProfile(p.userId)}
                testID={`new-profile-${p.userId}`}
              >
                <Avatar uri={p.profilePhoto} name={name} size={54} verified={p.isVerified} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.newName, { color: c.fgStrong }]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.newDetail, { color: c.textMuted }]} numberOfLines={1}>
                    {[age ? `${age} yrs` : null, p.profession, p.city].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </TouchableOpacity>
            );
          })}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function QuickChip({ icon, label, tint, onPress, c, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; tint: string;
  onPress: () => void; c: ReturnType<typeof useTheme>['c']; testID?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickCard, { backgroundColor: c.surfaceCard, borderColor: c.border }]}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={tint} />
      <Text style={[styles.quickLabel, { color: c.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 56, paddingBottom: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter, marginBottom: spacing.lg,
  },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  greetSmall: { ...type.footnote },
  greetName: { ...type.title2, fontFamily: 'PlayfairDisplay-Bold' },
  bellBtn: { padding: 4, position: 'relative' },
  bellDot: {
    position: 'absolute', top: 3, right: 3, width: 10, height: 10, borderRadius: 5,
    backgroundColor: colours.accent, borderWidth: 1.5,
  },

  completeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    marginHorizontal: spacing.gutter, marginBottom: spacing.xl,
    borderRadius: borderRadius.lg, borderWidth: 1, padding: 13,
  },
  completeTitle: { ...type.headline },
  completeSub: { ...type.footnote, marginTop: 2 },

  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.gutter, marginBottom: spacing.sm },
  quickCard: {
    flex: 1, borderRadius: borderRadius.md, borderWidth: 1, paddingVertical: 14,
    alignItems: 'center', gap: 6,
  },
  quickLabel: { ...type.caption },

  sectionPad: { paddingHorizontal: spacing.gutter, marginTop: 18 },
  seeAll: { ...type.subhead, fontFamily: 'Inter-SemiBold' },

  railScroll: { paddingHorizontal: spacing.gutter, paddingTop: 4, paddingBottom: 4 },
  rail: { width: 166, height: 226, borderRadius: borderRadius.lg, overflow: 'hidden', marginRight: 12 },
  railPhoto: { ...StyleSheet.absoluteFillObject, width: 166, height: 226 },
  railBody: { position: 'absolute', left: 11, right: 11, bottom: 11 },
  railNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  railName: { ...type.headline, fontFamily: 'PlayfairDisplay-Bold', color: '#fff', flexShrink: 1 },
  railMeta: { ...type.caption, color: 'rgba(255,255,255,0.9)', marginTop: 1 },
  railChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: borderRadius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  railDot: { width: 6, height: 6, borderRadius: 3 },
  railChipText: { ...type.micro, color: '#fff' },

  newRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: spacing.gutter, paddingVertical: 11, borderBottomWidth: 0.5,
  },
  newName: { ...type.headline },
  newDetail: { ...type.footnote, marginTop: 1 },
});
