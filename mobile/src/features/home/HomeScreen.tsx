import React, { useCallback, useEffect } from 'react';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  AccessibilityInfo,
} from 'react-native';
import Text from '../../components/ui/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import SmartImage, { resolveImageUri } from '../../components/common/SmartImage';
import { scoreColour, PHOTO_SCRIM } from '../../components/cards/ProfileCard';
import { PressableScale, useReduceTransparency } from '../../components/motion';
import { Avatar, SectionHeader, SkeletonBlock, EmptyState, CompletionRing } from '../../components/ui';
import Screen from '../../components/layout/Screen';
import { getDailyFeed } from '../../api/matches';
import { getUnreadCount } from '../../api/notifications';
import { getCommunityStats } from '../../api/stats';
import DiscoverCards from './DiscoverCards';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import { showToast } from '../../utils/toast';
import { tapSize } from '../../utils/elderTheme';
import { getAge } from '../../utils/dateUtils';
import type { MainStackParamList } from '../../navigation/types';
import type { ProfileSummary } from '../../types';
import { useOnboarding, JOURNEY_DONE_KEY, JOURNEY_PROMPTED_AT_KEY } from '../onboarding/OnboardingContext';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Rail card (166×226) ─────────────────────────────────────────────────────
// A photo tile with text over a scrim, or, for a member with no photo, a card
// whose initials tile sits above the same facts in normal flow: white text over
// the pale initials fill never reaches 4.5:1 because the scrim is nearly clear
// there, and the initial itself collided with the name line.
function RailCard({ profile, onPress }: { profile: ProfileSummary; onPress: () => void }) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  // The compat chip is a translucent panel over a photo; Reduce Transparency swaps it for a solid one.
  const reduceTransparency = useReduceTransparency();
  const hasPhoto = !!resolveImageUri(profile.profilePhoto);
  const age = profile.dateOfBirth ? getAge(profile.dateOfBirth) : null;
  const name = `${profile.firstName}${age ? `, ${age}` : ''}`;
  const compat = profile.compatibilityScore ?? 0;
  const meta = [profile.city, profile.profession].filter(Boolean).join(' · ');
  const reason = profile.reasons && profile.reasons.length > 0 ? profile.reasons[0] : null;
  // The tile is one element for a screen reader: say what the eye reads off it.
  const label = [
    name,
    meta || null,
    compat > 0 ? `${compat}% match` : null,
    profile.isVerified ? 'Verified' : null,
    reason,
    hasPhoto ? null : 'No photo yet',
  ].filter(Boolean).join('. ');
  return (
    <PressableScale
      style={[
        styles.rail,
        hasPhoto
          ? { backgroundColor: c.surface2 }
          // Border only, no shadow: elevation is declared once, and a white tile on the
          // page background needs some edge.
          : { backgroundColor: c.surfaceCard, borderWidth: 1, borderColor: c.border },
      ]}
      onPress={onPress}
      testID={`match-card-${profile.userId}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens profile"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {hasPhoto ? (
        <>
          <SmartImage uri={profile.profilePhoto} name={name} style={styles.railPhoto} initialSize={44} />
          <LinearGradient
            colors={['transparent', PHOTO_SCRIM.mid, PHOTO_SCRIM.end]}
            locations={[0.35, 0.6, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Fixed 226pt tile: its text is capped (maxScale) instead of free to grow past the photo. */}
          <View style={styles.railBody} pointerEvents="none">
            <View style={styles.railNameRow}>
              <Text variant="title2" style={styles.railName} numberOfLines={1} maxScale={1.3}>{name}</Text>
              {profile.isVerified && <Ionicons name="checkmark-circle" size={14} color={c.successAccent} />}
            </View>
            <Text variant="caption" style={styles.railMeta} numberOfLines={1} maxScale={1.3}>
              {meta}
            </Text>
            {compat > 0 && (
              <View style={[styles.railChip, reduceTransparency && { backgroundColor: c.p800 }]}>
                <View style={[styles.railDot, { backgroundColor: scoreColour(compat, c) }]} />
                <Text variant="micro" style={styles.railChipText} maxScale={1.3}>{compat}%</Text>
              </View>
            )}
            {/* D4: the top "why this match" reason (server-derived, chips capped 3) */}
            {reason && (
              <Text variant="micro" style={styles.railReason} numberOfLines={1} maxScale={1.3}>{reason}</Text>
            )}
          </View>
        </>
      ) : (
        <>
          {/* The tile takes whatever height the text below leaves, so a larger OS text size
              shrinks the tile instead of pushing the score past the card's fixed 226pt. */}
          <SmartImage uri={profile.profilePhoto} name={name} style={styles.railBareTile} initialSize={44} />
          <View style={styles.railBareBody} pointerEvents="none">
            <View style={styles.railNameRow}>
              <Text variant="title2" color="fgStrong" numberOfLines={1} maxScale={1.3} style={styles.railNameShrink}>{name}</Text>
              {profile.isVerified && <Ionicons name="checkmark-circle" size={14} color={c.successAccent} />}
            </View>
            {meta ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1} maxScale={1.3}>{meta}</Text>
            ) : null}
            {compat > 0 && (
              <View style={[styles.railChip, { backgroundColor: c.surface2 }]}>
                <View style={[styles.railDot, { backgroundColor: scoreColour(compat, c) }]} />
                <Text variant="micro" color="textSecondary" maxScale={1.3}>{compat}%</Text>
              </View>
            )}
            {reason && (
              <Text variant="micro" color="textSecondary" numberOfLines={1} maxScale={1.3} style={styles.railReasonBare}>{reason}</Text>
            )}
          </View>
        </>
      )}
    </PressableScale>
  );
}

export default function HomeScreen() {
  const tabClearance = useTabBarClearance();
  const { t } = useTranslation();
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  // Elder mode's 60pt floor. The bell is a 32pt glyph box, so its hit area grows by slop
  // (nothing else sits beside it but the greeting, which the later sibling wins over).
  const bellSlop = elder ? Math.ceil((tapSize(elder) - 32) / 2) : 6;
  const { start: startJourney } = useOnboarding();

  // D6 auto-present: open the preferences journey once on first Main entry,
  // re-prompt after 7 days, never after completion. start({auto:true}) also
  // declines by itself when every required field is already filled.
  useEffect(() => {
    (async () => {
      try {
        if (await AsyncStorage.getItem(JOURNEY_DONE_KEY)) return;
        const promptedAt = Number((await AsyncStorage.getItem(JOURNEY_PROMPTED_AT_KEY)) ?? 0);
        if (Date.now() - promptedAt < 7 * 24 * 60 * 60 * 1000) return;
        const presented = await startJourney({ auto: true });
        if (presented) await AsyncStorage.setItem(JOURNEY_PROMPTED_AT_KEY, String(Date.now()));
      } catch {
        // Quiet — the completeness strip stays as the manual entry point.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Honest social proof — server-side count of profiles that joined this week.
  const { data: communityStats } = useQuery({
    queryKey: ['stats', 'community'],
    queryFn: getCommunityStats,
    staleTime: 60 * 60 * 1000,
  });

  const unreadCount = countData?.count ?? 0;
  const completionPct = user?.Profile?.completionPercentage ?? 0;
  const firstName = user?.Profile?.firstName ?? user?.email?.split('@')[0] ?? 'there';
  const photo = user?.Profile?.profilePhoto;

  const onRefresh = useCallback(async () => {
    haptics.light();
    const res = await refetchFeed();
    // A pull that fails must not look like a pull that found nothing new.
    if (res.isError) showToast.error("Couldn't refresh", 'Check your connection and try again.');
  }, [refetchFeed]);

  const goToProfile = (userId: string) => navigation.navigate('ProfileDetail', { userId });
  const goToNotifications = () => navigation.navigate('Notifications');
  const goToOwnProfile = () => navigation.navigate('MainTabs', { screen: 'Profile' } as never);
  const goToSearch = () => navigation.navigate('MainTabs', { screen: 'Search' } as never);
  // `Matches` declares no params in MainTabParamList, hence the cast. MatchesScreen
  // reads `tab` as a one-shot event and clears it.
  const goToLikedYou = () => navigation.navigate('MainTabs', { screen: 'Matches', params: { tab: 'liked_me' } } as never);

  // The error card swaps in with no tap on anything, so a screen-reader user hears nothing
  // unless we say it (iOS ignores accessibilityLiveRegion, so this is done by hand).
  const feedFailed = isError && !feed;
  useEffect(() => {
    if (feedFailed) AccessibilityInfo.announceForAccessibility("Couldn't load matches");
  }, [feedFailed]);

  const todaysMatches = feed?.slice(0, 10) ?? [];
  const newProfiles = feed?.slice(10) ?? [];

  return (
    <Screen edges={['top']}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: spacing.md, paddingBottom: tabClearance }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[c.accent]} tintColor={c.accent} />}
      testID="HomeScreen"
    >
      {/* Greeting header */}
      <View style={styles.header}>
        <PressableScale
          style={styles.greetRow}
          onPress={goToOwnProfile}
          accessibilityRole="button"
          // Starts with the words on screen so Voice Control's "tap Good morning" resolves.
          accessibilityLabel={`${greeting()}, ${firstName}. View your profile`}
          testID="home-greeting-tap44-hitslop"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Avatar uri={photo} name={firstName} size={42} />
          {/* flexShrink: the name (an email local-part when there is no first name) can be long,
              and without it the ellipsis is measured against the whole row and never shortens it. */}
          <View style={styles.greetText}>
            <Text variant="footnote" color="textMuted" numberOfLines={1}>{greeting()},</Text>
            <Text variant="title2" color="fgStrong" numberOfLines={1}>{firstName}</Text>
          </View>
        </PressableScale>
        <PressableScale
          scaleTo={0.9}
          onPress={goToNotifications}
          testID="notif-bell-tap44-hitslop"
          accessibilityRole="button"
          accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          style={styles.bellBtn}
          hitSlop={{ top: bellSlop, bottom: bellSlop, left: bellSlop, right: bellSlop }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="notifications-outline" size={24} color={c.fgStrong} />
          {unreadCount > 0 && <View style={[styles.bellDot, { borderColor: c.background }]} />}
        </PressableScale>
      </View>

      {/* Completeness strip */}
      {completionPct < 100 && (
        <PressableScale
          style={[styles.completeCard, { backgroundColor: c.surfaceCard, borderColor: c.border }]}
          onPress={() => startJourney()}
          testID="completeness-strip"
          accessibilityRole="button"
          accessibilityLabel={`Your profile is ${completionPct}% complete. Complete your profile`}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <CompletionRing value={completionPct} size={58} caption="" />
          <View style={{ flex: 1 }}>
            <Text variant="headline" color="fgStrong">Complete your profile</Text>
            <Text variant="footnote" color="textMuted" style={styles.completeSub}>
              A fuller profile helps the right families find you.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </PressableScale>
      )}

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <QuickChip icon="heart" label="Liked you" tint={c.accent} onPress={goToLikedYou} testID="quick-liked-you" />
        <QuickChip icon="eye" label="Visitors" tint={c.accent} onPress={goToOwnProfile} testID="quick-profile-views" />
        <QuickChip icon="search" label="Search" tint={c.accent} onPress={goToSearch} testID="quick-search" />
      </View>

      {/* Today's Matches */}
      <SectionHeader
        title={t('home.todaysMatches', "Today's Matches")}
        count={todaysMatches.length || undefined}
        style={styles.sectionPad}
      />
      {feedLoading ? (
        // One busy element instead of three unlabelled blocks (Search, Matches and
        // Notifications already do this).
        <View accessible accessibilityLabel="Loading matches" accessibilityState={{ busy: true }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false} contentContainerStyle={styles.railScroll}>
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} width={166} height={226} radius={borderRadius.lg} style={{ marginRight: 12 }} />
            ))}
          </ScrollView>
        </View>
      ) : feedFailed ? (
        <EmptyState
          variant="error"
          icon="cloud-offline-outline"
          title="Couldn't load matches"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => refetchFeed()}
          testID="HomeScreen-error"
        />
      ) : todaysMatches.length > 0 ? (
        <FlatList
          data={todaysMatches}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => <RailCard profile={item} onPress={() => goToProfile(item.userId)} />}
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
          description={
            completionPct < 100
              ? 'Complete your profile for better suggestions.'
              : 'New matches arrive every day. You can browse profiles in the meantime.'
          }
          actionLabel={completionPct < 100 ? 'Edit profile' : 'Browse profiles'}
          onAction={completionPct < 100 ? goToOwnProfile : goToSearch}
          testID="HomeScreen-empty"
        />
      )}

      {/* Matches ranked 11+ in today's set (not recency or distance, hence the neutral title) */}
      {(newProfiles.length > 0 || feedLoading) && (
        <SectionHeader title="More matches for you" style={styles.sectionPad} />
      )}
      {feedLoading
        ? (
          // Already announced by the rail's "Loading matches" above: hidden, not read a second time.
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.newRow}>
                <SkeletonBlock width={54} height={54} radius={borderRadius.pill} />
                <View style={{ flex: 1, gap: 6 }}>
                  <SkeletonBlock width="60%" height={14} />
                  <SkeletonBlock width="40%" height={11} />
                </View>
              </View>
            ))}
          </View>
        )
        : newProfiles.map((p) => {
            const age = p.dateOfBirth ? getAge(p.dateOfBirth) : null;
            const name = `${p.firstName} ${p.lastName}`.trim();
            const rowLabel = [
              `${name}${age ? `, ${age}` : ''}`,
              [p.profession, p.city].filter(Boolean).join(', ') || null,
              p.isVerified ? 'Verified' : null,
            ].filter(Boolean).join('. ');
            return (
              <PressableScale
                key={p.userId}
                style={[styles.newRow, { borderBottomColor: c.border }]}
                onPress={() => goToProfile(p.userId)}
                testID={`new-profile-${p.userId}`}
                accessibilityRole="button"
                accessibilityLabel={rowLabel}
                accessibilityHint="Opens profile"
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Avatar uri={p.profilePhoto} name={name} size={54} verified={p.isVerified} />
                <View style={{ flex: 1 }}>
                  <Text variant="headline" color="fgStrong" numberOfLines={1}>{name}</Text>
                  <Text variant="footnote" color="textMuted" style={styles.newDetail} numberOfLines={1}>
                    {[age ? `${age} yrs` : null, p.profession, p.city].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </PressableScale>
            );
          })}

      {/* Honest social proof + a reason to come back tomorrow */}
      {!!communityStats?.newThisWeek && (
        <View style={[styles.communityStrip, { backgroundColor: c.accentSoft }]} testID="community-strip">
          <Ionicons
            name="sparkles-outline"
            size={15}
            color={c.accent}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          {/* flexShrink: a longer hi/pa string wraps inside the strip instead of running off the edge */}
          <Text variant="footnote" color="primary" style={styles.communityText}>
            {t('home.newThisWeek', '{{count}} new Tricity profiles joined this week', { count: communityStats.newThisWeek })}
          </Text>
        </View>
      )}
      <Text variant="caption" color="textMuted" style={styles.midnightLine}>{t('home.midnight', 'Fresh matches drop every midnight')}</Text>

      {/* Stage-aware discovery cards fill the fold for thin dashboards */}
      <DiscoverCards />

      <View style={{ height: 32 }} />
    </ScrollView>
    </Screen>
  );
}

function QuickChip({ icon, label, tint, onPress, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; tint: string;
  onPress: () => void; testID?: string;
}) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  return (
    <PressableScale
      style={[styles.quickCard, { backgroundColor: c.surfaceCard, borderColor: c.border }]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name={icon} size={22} color={tint} />
      {/* three equal columns: one line, capped, so a long label never grows the chip */}
      <Text variant="caption" color="textPrimary" numberOfLines={1} maxScale={1.3}>{label}</Text>
    </PressableScale>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  communityStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.gutter, marginTop: spacing.lg,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  communityText: { flexShrink: 1 },
  midnightLine: { textAlign: 'center', marginTop: spacing.md },
  railReason: { color: PHOTO_SCRIM.meta, marginTop: 3 },
  railReasonBare: { marginTop: 3 },
  container: { flex: 1 },
  content: { paddingBottom: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter, marginBottom: spacing.lg,
  },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  greetText: { flexShrink: 1 },
  bellBtn: { padding: 4, position: 'relative' },
  bellDot: {
    position: 'absolute', top: 3, right: 3, width: 10, height: 10, borderRadius: 5,
    backgroundColor: c.accent, borderWidth: 1.5,
  },

  completeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    marginHorizontal: spacing.gutter, marginBottom: spacing.xl,
    borderRadius: borderRadius.lg, borderWidth: 1, padding: 13,
  },
  completeSub: { marginTop: 2 },

  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.gutter, marginBottom: spacing.sm },
  quickCard: {
    flex: 1, borderRadius: borderRadius.md, borderWidth: 1, paddingVertical: 14,
    alignItems: 'center', gap: 6,
  },

  sectionPad: { paddingHorizontal: spacing.gutter, marginTop: 18 },

  railScroll: { paddingHorizontal: spacing.gutter, paddingTop: 4, paddingBottom: 4 },
  rail: { width: 166, height: 226, borderRadius: borderRadius.lg, overflow: 'hidden', marginRight: 12 },
  railPhoto: { ...StyleSheet.absoluteFillObject, width: 166, height: 226 },
  railBareTile: { flex: 1, minHeight: 56 },
  railBareBody: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 11 },
  railBody: { position: 'absolute', left: 11, right: 11, bottom: 11 },
  railNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  railName: { color: c.onPrimary, flexShrink: 1 },
  railNameShrink: { flexShrink: 1 },
  railMeta: { color: PHOTO_SCRIM.meta, marginTop: 1 },
  railChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: PHOTO_SCRIM.glass, borderRadius: borderRadius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  railDot: { width: 6, height: 6, borderRadius: 3 },
  railChipText: { color: c.onPrimary },

  newRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: spacing.gutter, paddingVertical: 11, borderBottomWidth: 0.5,
  },
  newDetail: { marginTop: 1 },
});
