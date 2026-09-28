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
import RowSeparator from '../../components/ui/RowSeparator';
import Screen from '../../components/layout/Screen';
import { getDailyFeed } from '../../api/matches';
import { getUnreadCount } from '../../api/notifications';
import { getCommunityStats } from '../../api/stats';
import { getMyProfile } from '../../api/profile';
import DiscoverCards from './DiscoverCards';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';
import { showToast } from '../../utils/toast';
import { tapSize } from '../../utils/elderTheme';
import { getAge } from '../../utils/dateUtils';
import { computeMissing, type MissingTarget } from '../../utils/profileMissing';
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
  const { t } = useTranslation();
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  // The compat chip is a translucent panel over a photo; Reduce Transparency swaps it for a solid one.
  const reduceTransparency = useReduceTransparency();
  // A photo URL that exists but will not load must not leave the photo layout in place: its
  // fallback is a giant initial under the same scrim as the name ("H" over "Harleen, 30"). The
  // failure is remembered against the URL that failed, so a new photo gets a fresh attempt.
  const [failedUri, setFailedUri] = React.useState<string | null>(null);
  const hasPhoto = !!resolveImageUri(profile.profilePhoto);
  const showPhoto = hasPhoto && failedUri !== profile.profilePhoto;
  const age = profile.dateOfBirth ? getAge(profile.dateOfBirth) : null;
  const name = `${profile.firstName}${age ? `, ${age}` : ''}`;
  const compat = profile.compatibilityScore ?? 0;
  const meta = [profile.city, profile.profession].filter(Boolean).join(' · ');
  const reason = profile.reasons && profile.reasons.length > 0 ? profile.reasons[0] : null;
  const matchText = t('home.matchPct', '{{pct}}% match', { pct: compat });
  // The tile is one element for a screen reader: say what the eye reads off it.
  const label = [
    name,
    meta || null,
    compat > 0 ? matchText : null,
    profile.isVerified ? 'Verified' : null,
    reason,
    hasPhoto ? null : 'No photo yet',
  ].filter(Boolean).join('. ');
  return (
    <PressableScale
      style={[
        styles.rail,
        showPhoto
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
      {showPhoto ? (
        <>
          <SmartImage
            uri={profile.profilePhoto}
            name={name}
            style={styles.railPhoto}
            initialSize={44}
            onFail={() => setFailedUri(profile.profilePhoto)}
          />
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
                <Text variant="micro" style={styles.railChipText} maxScale={1.3}>{matchText}</Text>
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
          {/* uri is null on purpose: a photo that already failed is not fetched a second time. */}
          <SmartImage uri={null} name={name} style={styles.railBareTile} initialSize={44} />
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
                <Text variant="micro" color="textSecondary" maxScale={1.3} style={styles.railChipNum}>{matchText}</Text>
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
  // The auth user's percentage is frozen at sign-in (0 for a fresh signup, which
  // the Profile tab then contradicted with 35%); the profile query is live.
  const { data: myProfile, isError: profileFailed } = useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  });
  const completionPct = myProfile?.completionPercentage ?? user?.Profile?.completionPercentage ?? 0;
  // The strip names the next thing worth doing, not "complete your profile" at every percentage.
  // No photo is always first: the server ranks a photoless profile last in search (-40), and the
  // journey it used to open puts the photo step last. Otherwise the first missing field from the
  // same list My profile uses, so the two never disagree about what is next.
  const hasPhoto = !!(myProfile?.profilePhoto || (myProfile?.photos?.length ?? 0) > 0);
  const nextMissing = computeMissing(myProfile, hasPhoto)[0];
  const pctText = t('home.nextComplete', 'Your profile is {{pct}}% complete.', { pct: completionPct });
  let nudge: { title: string; sub: string; target: MissingTarget } | null = null;
  if (completionPct < 100 && (myProfile || profileFailed)) {
    if (myProfile && !hasPhoto) {
      nudge = {
        title: t('home.nextPhotoTitle', 'Add your first photo'),
        sub: t('home.nextPhotoSub', 'Profiles without a photo are shown last in search.'),
        target: 'photos',
      };
    } else if (nextMissing) {
      nudge = { title: t(`home.missing.${nextMissing.key}`, nextMissing.label), sub: pctText, target: nextMissing.target };
    } else {
      // Every listed field is filled (or the profile failed to load): the journey resumes wherever the gap is.
      nudge = { title: t('home.completeTitle', 'Complete your profile'), sub: pctText, target: 'journey' };
    }
  }
  // Until the profile answers, hold the strip's place: a wrong message that flips is worse than a placeholder.
  const nudgePending = completionPct < 100 && !myProfile && !profileFailed;
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
  // reads `tab` as a one-shot event and clears it. `liked_me` is the tab key; members read it as "Received".
  const goToInterests = () => navigation.navigate('MainTabs', { screen: 'Matches', params: { tab: 'liked_me' } } as never);
  // Same destination and failure handling as My profile's completion card.
  const openNudge = () => {
    if (!nudge || nudge.target === 'journey') {
      startJourney().catch(() => showToast.error("Couldn't open your profile questions", 'Please try again.'));
      return;
    }
    navigation.navigate('EditProfile', { section: nudge.target } as never);
  };

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

      {/* Next-step strip: a tinted fill with no border, so it reads as the one nudge and not a fourth box */}
      {nudge && (
        <PressableScale
          style={[styles.completeCard, { backgroundColor: c.accentSoft }]}
          onPress={openNudge}
          testID="completeness-strip"
          accessibilityRole="button"
          accessibilityLabel={[nudge.title, nudge.sub, nudge.target === 'photos' ? pctText : null].filter(Boolean).join('. ')}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <CompletionRing value={completionPct} size={52} caption="" offColor={c.p200} />
          <View style={{ flex: 1 }}>
            <Text variant="headline" color="fgStrong">{nudge.title}</Text>
            <Text variant="footnote" color="textSecondary" style={styles.completeSub}>{nudge.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
        </PressableScale>
      )}
      {nudgePending && (
        <View style={styles.completeCard} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SkeletonBlock height={76} radius={borderRadius.lg} style={{ flex: 1 }} />
        </View>
      )}

      {/* Quick actions: search is not here, the tab bar directly below already opens it */}
      <View style={styles.quickRow}>
        <QuickTile icon="heart" label={t('home.interests', 'Interests')} onPress={goToInterests} testID="quick-liked-you" />
        <QuickTile icon="eye" label={t('home.visitors', 'Visitors')} onPress={goToOwnProfile} testID="quick-profile-views" />
      </View>

      {/* Today's Matches */}
      <SectionHeader
        title={t('home.todayMatches', "Today's Matches")}
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
        // The next-step strip above already asks for a fuller profile whenever there is one to ask
        // for; a second "complete your profile" card here made two of them on screen at once.
        <EmptyState
          icon="heart-outline"
          title="No matches yet"
          description="New matches arrive every day. You can browse profiles in the meantime."
          actionLabel="Browse profiles"
          onAction={goToSearch}
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
        : newProfiles.map((p, i) => {
            const age = p.dateOfBirth ? getAge(p.dateOfBirth) : null;
            const name = `${p.firstName} ${p.lastName}`.trim();
            const rowLabel = [
              `${name}${age ? `, ${age}` : ''}`,
              [p.profession, p.city].filter(Boolean).join(', ') || null,
              p.isVerified ? 'Verified' : null,
            ].filter(Boolean).join('. ');
            return (
              <React.Fragment key={p.userId}>
              {/* One inset hairline shared with Matches and Messages. A per-row border scaled with the press. */}
              {i > 0 && <RowSeparator />}
              <PressableScale
                style={styles.newRow}
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
              </React.Fragment>
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

function QuickTile({ icon, label, onPress, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID?: string;
}) {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  return (
    <PressableScale
      style={[styles.quickCard, { backgroundColor: c.surfaceCard, borderColor: c.border, minHeight: elder ? tapSize(elder) : 56 }]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name={icon} size={22} color={c.accent} />
      {/* two equal columns: one line that shrinks, so a longer hi/pa label never wraps the tile taller */}
      <Text variant="subhead" color="textPrimary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxScale={1.3} style={styles.quickLabel}>{label}</Text>
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

  // 12 inside the top group (strip, tiles), 28 before the next one (sectionPad).
  completeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    marginHorizontal: spacing.gutter, marginBottom: spacing.md,
    borderRadius: borderRadius.lg, paddingVertical: 12, paddingHorizontal: 14,
  },
  completeSub: { marginTop: 2 },

  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.gutter },
  quickCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: 14,
  },
  quickLabel: { flexShrink: 1 },

  sectionPad: { paddingHorizontal: spacing.gutter, marginTop: 28 },

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
  railChipText: { color: c.onPrimary, fontVariant: ['tabular-nums'] },
  railChipNum: { fontVariant: ['tabular-nums'] },

  newRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: spacing.gutter, paddingVertical: 11,
  },
  newDetail: { marginTop: 1 },
});
