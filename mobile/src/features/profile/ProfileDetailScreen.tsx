import React, { useEffect, useRef, useState } from 'react';
import { requestNotifPrime } from '../../utils/notifPrime';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { showToast } from '../../utils/toast';
import { haptics } from '../../utils/haptics';
import { spacing, borderRadius } from '@shared/constants/theme';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { CompatRing, EmptyState, MatchCelebration } from '../../components/ui';
import { ProfileDetailSkeleton } from '../../components/ui/skeletons';
import { PressableScale, useReduceMotion, useReduceTransparency } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import { tapSize } from '../../utils/elderTheme';
import { getProfile, getCompatibilityBreakdown, getMyProfile } from '../../api/profile';
import PreferenceMatch from '../../components/profile/PreferenceMatch';
import AudioIntroChip from '../../components/profile/AudioIntroChip';
import { fromProfilePrompts } from '../../constants/prompts';
import { performMatchAction } from '../../api/matches';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore, selectPlan } from '../../stores/authStore';
import BlockReportSheet from './BlockReportSheet';
import CompatibilityBreakdownSheet, { describeFailure } from './CompatibilityBreakdownSheet';
import HeroBlock from './detail/HeroBlock';
import PhotoBlock from './detail/PhotoBlock';
import SectionCard from './detail/SectionCard';
import RevealOnScroll from './detail/RevealOnScroll';
import PhotoGalleryViewer from './detail/PhotoGalleryViewer';
import type { MainStackParamList } from '../../navigation/types';
import type { MatchAction } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'ProfileDetail'>;

/** Decorative glyphs sit beside text that already says the same thing. */
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

/** Solid stand-in for the translucent on-photo button fill (Reduce Transparency). */
const SOLID_SCRIM = '#1a1a1a';

/** Touch may drift this far off a control before the press cancels (doctrine §10.8). */
const RETENTION = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/** Human-readable failure per action, so the toast names what did not happen. */
const ACTION_ERROR: Record<MatchAction, string> = {
  like: "Couldn't send your interest",
  shortlist: "Couldn't shortlist this profile",
  pass: "Couldn't pass on this profile",
};

// ─── Small pieces ────────────────────────────────────────────────────────────

/** Round icon button that sits over the hero photo (and over the state screens). */
function FloatBtn({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { elder } = useTheme();
  const reduceTransparency = useReduceTransparency();
  const size = tapSize(elder);
  return (
    <PressableScale
      scaleTo={0.9}
      onPress={onPress}
      style={[
        s.iconBtn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          // Dark enough that the white glyph keeps 3:1 over a light page as
          // well as over a photo.
          backgroundColor: reduceTransparency ? SOLID_SCRIM : 'rgba(0,0,0,0.55)',
        },
      ]}
      pressRetentionOffset={RETENTION}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color="#fff" {...HIDE_FROM_A11Y} />
    </PressableScale>
  );
}

/** Loading / error / not-found frame: same page, same way back. */
function StateShell({ testID, children }: { testID: string; children: React.ReactNode }) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return (
    <View style={[s.wrapper, { backgroundColor: c.background }]} testID={testID}>
      {children}
      <View style={[s.floatHeader, { paddingTop: insets.top + spacing.xs }]} pointerEvents="box-none">
        <FloatBtn icon="arrow-back" label="Go back" onPress={() => navigation.goBack()} testID="back-btn" />
      </View>
    </View>
  );
}

/** Compact stat chip for the essence band (height · education · community…). */
function StatChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { c } = useTheme();
  return (
    <View style={[s.statChip, { backgroundColor: c.surface2 }]}>
      <Ionicons name={icon} size={13} color={c.primary} {...HIDE_FROM_A11Y} />
      {/* flexShrink: a chip wider than its 240pt cap ellipsizes instead of poking past the pill. */}
      <Text variant="caption" color="textPrimary" numberOfLines={1} style={s.statChipText}>
        {label}
      </Text>
    </View>
  );
}

/** Enum-ish values arrive as `non_vegetarian` / `nuclear`; show them as words. */
const formatValue = (value: string) => {
  const spaced = value.replace(/_/g, ' ');
  return /^[a-z]/.test(spaced) ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : spaced;
};

/** "Non manglik" already names the field; only "Not sure" needs the prefix to mean anything. */
const manglikLabel = (value: string) =>
  /manglik/i.test(value) ? formatValue(value) : `Manglik: ${formatValue(value)}`;

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const { c } = useTheme();
  const { fontScale } = useWindowDimensions();
  if (!value) return null;
  const text = formatValue(value);
  // At large OS text sizes the fixed label column squeezes the value; stack them.
  const stacked = fontScale > 1.3;
  return (
    <View
      style={[s.detailRow, stacked && s.detailRowStacked, { borderBottomColor: c.hairline }]}
      accessible
      accessibilityLabel={`${label}: ${text}`}
    >
      <Text variant="footnote" color="textSecondary" style={stacked ? undefined : s.detailLabel}>{label}</Text>
      <Text variant="footnote" color="textPrimary" style={s.detailValue}>{text}</Text>
    </View>
  );
}

/** Decorative glyph + label for one action-bar button; the label is the meaning. */
function BarGlyph({
  pending,
  tight,
  icon,
  color,
}: {
  pending: boolean;
  tight: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  if (pending) return <ActivityIndicator size="small" color={color} />;
  // When text is scaled up the label needs the room more than the glyph does.
  if (tight) return null;
  return <Ionicons name={icon} size={22} color={color} {...HIDE_FROM_A11Y} />;
}

// One-line label that shrinks before it wraps: a control must not break onto a
// second line, and the three buttons share a fixed-width row.
// `flexShrink` lets the label take only the room left beside the glyph, which is
// what gives `adjustsFontSizeToFit` a width to fit into.
const BAR_LABEL = {
  numberOfLines: 1,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.8,
  maxScale: 1.3,
  style: { flexShrink: 1 },
} as const;

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProfileDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const user = useAuthStore((st) => st.user);
  // Viewing your own profile ("see it as others do"): no actions, no compat, no
  // partner-preference check. Known from the route alone, so those reads never
  // fire (the API would happily score you against yourself).
  const isSelfId = !!user?.id && user.id === userId;
  // `selectPlan` defaults to 'free', so a missing user or plan fails closed: the
  // gates below never open for someone whose plan we do not actually know.
  const isPaid = useAuthStore(selectPlan) !== 'free';
  const { c, elder } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW, fontScale } = useWindowDimensions();
  const reducedMotion = useReduceMotion();

  const [mutualMatch, setMutualMatch] = useState(false);
  // `mutualMatch` is the celebration's visibility and clears on close; the bar has to keep
  // saying (and offering) the match after that, so it reads its own flag.
  const [matched, setMatched] = useState(false);
  const [actionDone, setActionDone] = useState<MatchAction | null>(null);
  // D3 like-with-note (DS5): opened from the visible "Add a note" button or a long-press.
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [blockReportVisible, setBlockReportVisible] = useState(false);
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [appreciateOpen, setAppreciateOpen] = useState(false);

  // A block drops this profile from the cache once the screen has unmounted:
  // removing it while this screen still observes it would flash the loading
  // state through the back transition.
  const blockedRef = useRef(false);
  useEffect(
    () => () => {
      if (blockedRef.current) {
        queryClient.removeQueries({ queryKey: queryKeys.profile(userId), exact: true });
      }
    },
    [queryClient, userId],
  );

  const tap = tapSize(elder);
  const heroH = Math.max(380, Math.round(winH * 0.56));
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Floating header: transparent over the hero, solid + titled once past it.
  // A threshold-triggered crossfade, not a scroll-scrubbed value (doctrine
  // §10.3): frequency occasional, purpose state indication. Leaving is faster
  // than arriving.
  const headerSolid = useSharedValue(0);
  useAnimatedReaction(
    () => scrollY.value > heroH - 100,
    (past, prev) => {
      if (past === prev) return;
      headerSolid.value = withTiming(past ? 1 : 0, {
        duration: past ? duration.menu : duration.press,
        easing: Easing.bezier(...EASE_OUT),
      });
    },
    [heroH],
  );
  const headerBgStyle = useAnimatedStyle(() => ({ opacity: headerSolid.value }));
  const headerTitleStyle = useAnimatedStyle(() => ({ opacity: headerSolid.value }));

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getProfile(userId),
    staleTime: 5 * 60 * 1000,
  });

  // Real compatibility — shares the breakdown sheet's query key so it's fetched
  // once and stays consistent with the score on Home/Search cards. Secondary
  // read: if it fails the card and the hero chip are simply omitted.
  const { data: compat } = useQuery({
    queryKey: ['compatibility', userId],
    queryFn: () => getCompatibilityBreakdown(userId),
    staleTime: 5 * 60 * 1000,
    enabled: !isSelfId,
  });

  // Viewer's own profile — feeds the reverse partner-preference checklist.
  const { data: myProfile } = useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
    enabled: !isSelfId,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, note }: { action: MatchAction; note?: string }) =>
      performMatchAction(userId, action, note ? { note } : undefined),
    onSuccess: (data, { action }) => {
      setActionDone(data.match.action);
      if (data.isMutualMatch) {
        setMutualMatch(true);
        setMatched(true);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyMatches });
      queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
      // Same reasoning as Search: Matches caches these lists for minutes, so a saved
      // or liked profile must be pushed in rather than waiting for a pull to refresh.
      if (action === 'shortlist') queryClient.invalidateQueries({ queryKey: queryKeys.shortlisted });
      if (action === 'like') queryClient.invalidateQueries({ queryKey: queryKeys.sentInterests });
      // A like can make this pair mutual, which unblurs media and offers the chat on a later visit.
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      if (action === 'like' || action === 'pass') queryClient.invalidateQueries({ queryKey: queryKeys.likedMe });

      // One haptic per commit, one announcement (the pressed button may have
      // just been replaced, so focus has nowhere to read the result from).
      const first = profile?.firstName ?? 'this member';
      if (action === 'like') {
        // The note has been sent with the like; it is only cleared on success so a
        // failed send does not cost the member what they typed.
        setNoteText('');
        // First like = the moment push notifications become genuinely useful. Only
        // once the like has actually landed, never on top of a failure toast.
        requestNotifPrime();
        // A mutual match plays MatchCelebration, which fires its own success haptic.
        if (!data.isMutualMatch) haptics.success();
        AccessibilityInfo.announceForAccessibility(
          data.isMutualMatch ? `It's a match with ${first}` : `Interest sent to ${first}`,
        );
      } else if (action === 'shortlist') {
        showToast.success('Shortlisted', `${first} is on your shortlist.`);
        AccessibilityInfo.announceForAccessibility(`${first} shortlisted`);
      } else {
        haptics.light();
        showToast.info(`You passed on ${first}`);
        AccessibilityInfo.announceForAccessibility(`Passed on ${first}`);
      }
    },
    onError: (err, { action }) => {
      // The toast is silent to a screen reader, and the pressed button is still
      // there but unchanged, so the failure has to be spoken as well as shown.
      const reason = describeFailure(err);
      showToast.error(ACTION_ERROR[action], reason);
      AccessibilityInfo.announceForAccessibility(`${ACTION_ERROR[action]}. ${reason}`);
    },
  });

  const handleAction = (action: MatchAction, note?: string) => {
    // Interest already sent, the same action already done, or one in flight.
    // Shortlist or pass followed by Like is a real second action and goes through.
    if (actionMutation.isPending || actionDone === 'like' || actionDone === action) return;
    actionMutation.mutate({ action, note });
  };

  const goUpgrade = () => navigation.navigate('Subscription');

  // No data yet and no error: still loading, or a first fetch paused offline.
  // Either way this is not "profile not found".
  if (isLoading || (!profile && !isError)) {
    return (
      <StateShell testID="ProfileDetailLoading">
        <View accessible accessibilityLabel="Loading profile" accessibilityLiveRegion="polite">
          <ProfileDetailSkeleton />
        </View>
      </StateShell>
    );
  }

  // A failed fetch is not a missing profile. 404 (absent/inactive) and 403
  // (blocked / matches_only) are real answers from the server and fall through
  // to "Profile not found" below; anything else (network, timeout, 5xx) is
  // retryable. With cached data a failed background refetch never lands here.
  const failStatus = (error as { response?: { status?: number } } | null)?.response?.status;
  if (!profile && isError && failStatus !== 404 && failStatus !== 403) {
    return (
      <StateShell testID="ProfileDetailErrorScreen">
        <View style={s.errorBody}>
          <EmptyState
            variant="error"
            icon="person-circle-outline"
            title="Couldn't load this profile"
            description={describeFailure(error)}
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="ProfileDetail-error"
          />
        </View>
      </StateShell>
    );
  }

  if (!profile) {
    return (
      <StateShell testID="ProfileDetailNotFound">
        <View style={s.errorBody}>
          <EmptyState
            icon="person-outline"
            title="Profile not found"
            description="It may have been removed, or it isn't available to you."
            actionLabel="Go back"
            onAction={() => navigation.goBack()}
            testID="ProfileDetail-empty"
          />
        </View>
      </StateShell>
    );
  }

  const photos: string[] = profile.profilePhoto
    ? [profile.profilePhoto, ...(profile.photos || []).filter((p) => p !== profile.profilePhoto)]
    : profile.photos || [];
  const heroPhoto: string | null = photos[0] ?? null;
  const restPhotos = photos.slice(1);

  // Viewing your own profile ("see it as others do") — no actions, no compat.
  const isSelf = user?.id === profile.userId;
  // The server already unblurs photos and intros for a mutual match; `profile.isMutual` is that
  // fact, so a profile opened after the match no longer shows padlocks over media that arrived.
  const isMutualMatch = matched || profile.isMutual === true;
  const isMutualOrPremium = isSelf || actionDone === 'like' || isPaid || profile.isMutual === true;
  // Free viewers only get the primary photo in the gallery; the rest stay locked.
  const viewablePhotos = isMutualOrPremium ? photos : photos.slice(0, 1);
  const canAppreciate = isMutualOrPremium && !isSelf;

  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const promptPairs = fromProfilePrompts(profile.profilePrompts as Record<string, string> | null);
  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  // Essence chips — the at-a-glance matrimonial facts.
  const essence: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [];
  if (profile.height) essence.push({ icon: 'resize-outline', label: `${profile.height} cm` });
  if (profile.education) essence.push({ icon: 'school-outline', label: profile.education });
  if (profile.religion) {
    essence.push({
      icon: 'people-outline',
      label: [profile.religion, profile.caste].filter(Boolean).join(' · '),
    });
  }
  if (profile.maritalStatus) essence.push({ icon: 'heart-outline', label: formatValue(profile.maritalStatus) });
  if (profile.manglikStatus) essence.push({ icon: 'moon-outline', label: manglikLabel(profile.manglikStatus) });

  // A story photo: index `i` into `restPhotos` (photo number i + 2 of the set).
  const photoBlock = (i: number) => (
    <PhotoBlock
      uri={restPhotos[i]}
      caption={`Photo ${i + 2} of ${photos.length}`}
      locked={!isMutualOrPremium}
      onLockedPress={goUpgrade}
      onPress={isMutualOrPremium ? () => setGalleryIndex(i + 1) : undefined}
      onAppreciate={canAppreciate ? () => setAppreciateOpen(true) : undefined}
    />
  );
  // Interleave: photo after every other content stretch (max one per two blocks).
  const photoAt = (i: number) =>
    restPhotos[i] ? <RevealOnScroll scrollY={scrollY}>{photoBlock(i)}</RevealOnScroll> : null;

  const hasFamily =
    profile.familyType || profile.fatherOccupation || profile.motherOccupation || profile.numberOfSiblings;
  const hasLifestyle = profile.diet || profile.smoking || profile.drinking;
  const hasCareer = profile.education || profile.degree || profile.profession || profile.city || profile.state;
  const hasCommunity = profile.religion || profile.caste || profile.subCaste || profile.motherTongue;
  const hasAstro =
    profile.manglikStatus || profile.rashi || profile.nakshatra || profile.placeOfBirth || profile.birthTime;

  // The action bar is absolutely positioned, so the scroll owes it clearance:
  // computed from the real inset, never a constant.
  const barPadBottom = Math.max(insets.bottom, spacing.md);
  const barHeight = spacing.md + tap + barPadBottom;
  const scrollClearance = (isSelf ? insets.bottom : barHeight) + spacing.lg;
  // Buttons lose their glyph before their label loses its room: at large text, in
  // elder mode, and on any phone under 400pt wide. There the confirmed states
  // ("Shortlisted", "Passed") cannot fit beside a 22pt glyph even at the label's
  // smallest scale, so they would clip or ellipsize. Once tight, the flex is
  // rebalanced too (the row also holds a 48pt note button), so the longest label
  // is not the one starved of width.
  const tight = fontScale > 1.15 || elder || winW < 400;
  const barFlex = tight ? { pass: 0.75, shortlist: 1.05, like: 1 } : { pass: 0.8, shortlist: 1, like: 1.25 };
  const pendingAction = actionMutation.isPending ? actionMutation.variables?.action : undefined;
  const passed = actionDone === 'pass';
  const shortlisted = actionDone === 'shortlist';
  const sentText = matched ? "It's a match" : 'Interest sent';
  // The thread itself carries the gate (paywall or the free-reply window), exactly as it does
  // from Matches, so a match never detours through Subscription before the member sees it.
  const openChat = () => navigation.navigate('ChatThread', { userId, name, photo: heroPhoto ?? undefined });
  const sheetAnim = reducedMotion ? 'fade' : 'slide';
  const sheetPad = { paddingBottom: Math.max(insets.bottom, spacing.lg) };

  return (
    <View style={[s.wrapper, { backgroundColor: c.background }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: scrollClearance }}
        testID="ProfileDetailScreen"
      >
        <HeroBlock
          photoUri={heroPhoto}
          name={name}
          age={age}
          city={profile.city}
          profession={profile.profession}
          verified={profile.isVerified}
          compatScore={!isSelf && typeof compat?.overallScore === 'number' ? compat.overallScore : null}
          height={heroH}
          chipTop={insets.top + spacing.xs + tap + spacing.sm}
          photoCount={viewablePhotos.length}
          onOpenGallery={() => setGalleryIndex(0)}
        />

        {/* Essence band — at-a-glance facts */}
        {essence.length > 0 && (
          <View style={s.essenceBand}>
            {essence.map((e) => (
              <StatChip key={e.label} icon={e.icon} label={e.label} />
            ))}
          </View>
        )}

        {/* Compatibility card */}
        {!isSelf && typeof compat?.overallScore === 'number' && (
          <RevealOnScroll scrollY={scrollY}>
            <PressableScale
              onPress={() => setBreakdownVisible(true)}
              testID="compatibility-bar"
              accessibilityRole="button"
              accessibilityLabel={`Compatibility ${compat.overallScore} percent. See the full breakdown`}
              pressRetentionOffset={RETENTION}
            >
              <SectionCard style={s.compatCard}>
                <View style={s.compatRow}>
                  <CompatRing value={compat.overallScore} size={64} />
                  <View style={s.compatInfo}>
                    <Text variant="headline" color="fgStrong">Compatibility</Text>
                    <Text variant="footnote" color="textSecondary" style={s.compatHint}>
                      Tap to see the full breakdown
                    </Text>
                  </View>
                  <View style={s.compatWhy}>
                    <Text variant="subhead" color="primary">Why</Text>
                    <Ionicons name="chevron-forward" size={16} color={c.primary} {...HIDE_FROM_A11Y} />
                  </View>
                </View>
              </SectionCard>
            </PressableScale>
          </RevealOnScroll>
        )}

        {/* Voice intro — modern audio chip */}
        {profile.voiceIntroUrl && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title={`Hear from ${profile.firstName}`} icon="mic-outline">
              <AudioIntroChip
                url={profile.voiceIntroUrl}
                isPremiumViewer={isMutualOrPremium}
                onLockedPress={goUpgrade}
              />
            </SectionCard>
          </RevealOnScroll>
        )}

        {/* About — editorial pull-quote card */}
        {profile.bio && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title={`About ${profile.firstName}`} icon="book-outline">
              <Text variant="callout" color="textPrimary">{profile.bio}</Text>
              {(profile.interestTags?.length ?? 0) > 0 && (
                <View style={s.tagsRow}>
                  {profile.interestTags.map((tag) => (
                    <View key={tag} style={[s.tag, { backgroundColor: c.accentSoft }]}>
                      <Text variant="caption" color="primary">{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>
          </RevealOnScroll>
        )}

        {photoAt(0)}

        {/* Family & values — the parent-friendly heart of the story */}
        {(hasFamily || hasLifestyle) && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title="Family & values" icon="home-outline" tinted>
              <DetailRow label="Family type" value={profile.familyType ?? undefined} />
              <DetailRow label="Father's occupation" value={profile.fatherOccupation ?? undefined} />
              <DetailRow label="Mother's occupation" value={profile.motherOccupation ?? undefined} />
              <DetailRow label="Siblings" value={profile.numberOfSiblings ? `${profile.numberOfSiblings}` : undefined} />
              <DetailRow label="Diet" value={profile.diet ?? undefined} />
              <DetailRow label="Smoking" value={profile.smoking ?? undefined} />
              <DetailRow label="Drinking" value={profile.drinking ?? undefined} />
            </SectionCard>
          </RevealOnScroll>
        )}

        {photoAt(1)}

        {/* Prompts — "get to know them" Q&As */}
        {promptPairs.length > 0 && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title={`Get to know ${profile.firstName}`} icon="chatbubble-ellipses-outline">
              {promptPairs.map(({ prompt, answer }) => (
                <View key={prompt} style={s.promptItem}>
                  <Text variant="callout" color="primary" style={s.promptQ}>{prompt}</Text>
                  <Text variant="callout" color="textPrimary">{answer}</Text>
                </View>
              ))}
            </SectionCard>
          </RevealOnScroll>
        )}

        {/* Reverse partner-preference checklist */}
        {!isSelf && (
          <RevealOnScroll scrollY={scrollY}>
            <PreferenceMatch target={profile} viewer={myProfile} targetName={profile.firstName} />
          </RevealOnScroll>
        )}

        {/* Education & career + community details. A card with no rows would be
            a bare title, so each renders only when it has something to show. */}
        {hasCareer && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title="Education & career" icon="school-outline">
              <DetailRow label="Education" value={profile.education ?? undefined} />
              <DetailRow label="Degree" value={profile.degree ?? undefined} />
              <DetailRow label="Profession" value={profile.profession ?? undefined} />
              <DetailRow label="City" value={profile.city} />
              <DetailRow label="State" value={profile.state} />
            </SectionCard>
          </RevealOnScroll>
        )}

        {hasCommunity && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title="Community" icon="people-outline">
              <DetailRow label="Religion" value={profile.religion ?? undefined} />
              <DetailRow label="Caste" value={profile.caste ?? undefined} />
              <DetailRow label="Sub-caste" value={profile.subCaste ?? undefined} />
              <DetailRow label="Mother tongue" value={profile.motherTongue ?? undefined} />
            </SectionCard>
          </RevealOnScroll>
        )}

        {photoAt(2)}

        {/* Horoscope */}
        {hasAstro && (
          <RevealOnScroll scrollY={scrollY}>
            <SectionCard title="Horoscope" icon="moon-outline">
              <DetailRow label="Manglik" value={profile.manglikStatus?.replace(/_/g, ' ')} />
              <DetailRow label="Rashi" value={profile.rashi ?? undefined} />
              <DetailRow label="Nakshatra" value={profile.nakshatra ?? undefined} />
              <DetailRow label="Birth place" value={profile.placeOfBirth ?? undefined} />
              <DetailRow label="Birth time" value={profile.birthTime ?? undefined} />
              <Button
                title="View Kundli match"
                variant="text"
                icon="moon-outline"
                haptic={false}
                style={s.kundliBtn}
                onPress={() =>
                  navigation.navigate('HoroscopeMatch', {
                    userId: profile.userId,
                    name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
                  })
                }
                testID="view-kundli-match"
              />
            </SectionCard>
          </RevealOnScroll>
        )}

        {/* Remaining photos flow out the story */}
        {restPhotos.slice(3).map((uri, i) => (
          <RevealOnScroll key={`${uri}:${i}`} scrollY={scrollY}>
            {photoBlock(3 + i)}
          </RevealOnScroll>
        ))}

        {/* Quiet safety footer */}
        {!isSelf && (
          <PressableScale
            style={[s.safetyFooter, { minHeight: tap }]}
            onPress={() => setBlockReportVisible(true)}
            accessibilityLabel={`Report or block ${profile.firstName}`}
            accessibilityRole="button"
            pressRetentionOffset={RETENTION}
          >
            <Ionicons name="shield-outline" size={14} color={c.textSecondary} {...HIDE_FROM_A11Y} />
            <Text variant="footnote" color="textSecondary">Report or block {profile.firstName}</Text>
          </PressableScale>
        )}
      </Animated.ScrollView>

      {/* Floating header — transparent over hero, solid + titled after */}
      <View style={[s.floatHeader, { paddingTop: insets.top + spacing.xs }]} pointerEvents="box-none">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, headerBgStyle]}
          pointerEvents="none"
        />
        <FloatBtn icon="arrow-back" label="Go back" onPress={() => navigation.goBack()} testID="back-btn" />
        {/* The hero already carries the name as this screen's header; opacity alone
            leaves this copy in the accessibility tree, so hide it. */}
        <Animated.View
          style={[s.floatTitleWrap, headerTitleStyle]}
          pointerEvents="none"
          {...HIDE_FROM_A11Y}
        >
          <Text variant="headline" color="fgStrong" numberOfLines={1} maxScale={1.3} style={s.floatTitle}>
            {name}
          </Text>
        </Animated.View>
        {/* Report/block is for other people's profiles; keep the title centred. */}
        {isSelf ? (
          <View style={{ width: tap, height: tap }} />
        ) : (
          <FloatBtn
            icon="ellipsis-vertical"
            label="More options"
            onPress={() => setBlockReportVisible(true)}
            testID="menu-btn"
          />
        )}
      </View>

      {/* Sticky bottom action bar */}
      {!isSelf && (
        <View
          style={[
            s.actionBar,
            {
              backgroundColor: c.background,
              borderTopColor: c.border,
              paddingBottom: barPadBottom,
            },
          ]}
        >
          {isMutualMatch ? (
            // Once matched the bar's job is the next step. It used to say "Start chatting" with
            // nothing to press, and in elder mode (no Chat tab) that was the only cue.
            <Button
              title={`Message ${profile.firstName}`}
              icon="chatbubble-ellipses-outline"
              haptic={false}
              onPress={openChat}
              style={{ flex: 1 }}
              testID="action-message"
            />
          ) : actionDone === 'like' ? (
            // Spoken once, by the mutation's onSuccess: a live region is Android-only
            // and would make TalkBack repeat it.
            <View
              style={[s.mutualHint, { minHeight: tap }]}
              accessible
              accessibilityLabel={sentText}
            >
              <Ionicons name="heart" size={20} color={c.primary} {...HIDE_FROM_A11Y} />
              <Text variant="headline" color="primary" style={s.mutualText}>{sentText}</Text>
            </View>
          ) : (
            <>
              <PressableScale
                style={[
                  s.actionBtn,
                  {
                    flex: barFlex.pass,
                    minHeight: tap,
                    backgroundColor: passed ? c.surface2 : c.surfaceCard,
                    borderWidth: 1,
                    borderColor: c.border,
                  },
                ]}
                onPress={() => handleAction('pass')}
                disabled={actionMutation.isPending || passed}
                pressRetentionOffset={RETENTION}
                testID="action-pass"
                accessibilityRole="button"
                accessibilityLabel={passed ? 'Passed' : 'Pass'}
                accessibilityState={{ disabled: actionMutation.isPending || passed, selected: passed, busy: pendingAction === 'pass' }}
              >
                <BarGlyph pending={pendingAction === 'pass'} tight={tight || passed} icon="close" color={c.textSecondary} />
                <Text variant="subhead" color="textSecondary" {...BAR_LABEL}>{passed ? 'Passed' : 'Pass'}</Text>
              </PressableScale>

              <PressableScale
                style={[
                  s.actionBtn,
                  {
                    flex: barFlex.shortlist,
                    minHeight: tap,
                    backgroundColor: shortlisted ? c.accentSoft2 : c.accentSoft,
                    borderWidth: 1,
                    borderColor: shortlisted ? c.accent : c.accent + '40',
                  },
                ]}
                onPress={() => handleAction('shortlist')}
                disabled={actionMutation.isPending || shortlisted}
                pressRetentionOffset={RETENTION}
                testID="action-shortlist"
                accessibilityRole="button"
                accessibilityLabel={shortlisted ? 'Shortlisted' : 'Shortlist'}
                accessibilityState={{ disabled: actionMutation.isPending || shortlisted, selected: shortlisted, busy: pendingAction === 'shortlist' }}
              >
                <BarGlyph
                  pending={pendingAction === 'shortlist'}
                  tight={tight || shortlisted}
                  icon={shortlisted ? 'bookmark' : 'bookmark-outline'}
                  color={c.accent}
                />
                <Text variant="subhead" color="primary" {...BAR_LABEL}>{shortlisted ? 'Shortlisted' : 'Shortlist'}</Text>
              </PressableScale>

              {/* The visible way to send a note: long-pressing Interested does the
                  same thing, but a gesture cannot be the only path. */}
              <PressableScale
                style={[
                  s.noteBtn,
                  { width: tap, height: tap, backgroundColor: c.surfaceCard, borderColor: c.accent + '40' },
                ]}
                onPress={() => setNoteSheetOpen(true)}
                disabled={actionMutation.isPending}
                pressRetentionOffset={RETENTION}
                testID="action-note"
                accessibilityRole="button"
                accessibilityLabel="Add a note"
                accessibilityHint="Sends your interest with a personal note"
                accessibilityState={{ disabled: actionMutation.isPending }}
              >
                <Ionicons name="create-outline" size={22} color={c.accent} {...HIDE_FROM_A11Y} />
              </PressableScale>

              <PressableScale
                style={[s.actionBtn, { flex: barFlex.like, minHeight: tap, backgroundColor: c.p500 }]}
                onPress={() => handleAction('like')}
                onLongPress={() => setNoteSheetOpen(true)}
                delayLongPress={350}
                disabled={actionMutation.isPending}
                pressRetentionOffset={RETENTION}
                testID="action-like"
                accessibilityRole="button"
                accessibilityLabel="Interested"
                accessibilityHint="Sends your interest. Touch and hold to add a note."
                accessibilityState={{ disabled: actionMutation.isPending, busy: pendingAction === 'like' }}
              >
                <BarGlyph pending={pendingAction === 'like'} tight={tight} icon="heart" color={c.onPrimary} />
                <Text variant="subhead" color="onPrimary" {...BAR_LABEL}>Interested</Text>
              </PressableScale>
            </>
          )}
        </View>
      )}

      <MatchCelebration
        visible={mutualMatch}
        name={profile.firstName}
        onClose={() => setMutualMatch(false)}
        onMessage={() => {
          setMutualMatch(false);
          openChat();
        }}
      />

      <BlockReportSheet
        visible={blockReportVisible}
        userId={userId}
        userName={name}
        onClose={() => setBlockReportVisible(false)}
        onBlocked={() => {
          blockedRef.current = true;
          navigation.goBack();
        }}
      />

      {/* D3 like-with-note sheet (DS5) — opened from the Add a note button or by long-pressing Interested */}
      <Modal visible={noteSheetOpen} transparent animationType={sheetAnim} onRequestClose={() => setNoteSheetOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
          <PressableScale
            scaleTo={1}
            style={[s.sheetBackdrop, { backgroundColor: c.scrim }]}
            onPress={() => setNoteSheetOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={[s.sheet, { backgroundColor: c.sheetBg }, sheetPad]}>
            <Text variant="headline" color="fgStrong" style={s.sheetTitle} accessibilityRole="header">Send interest with a note</Text>
            <Input
              style={s.noteInput}
              label="Your note (optional)"
              value={noteText}
              onChangeText={(txt) => setNoteText(txt.slice(0, 280))}
              placeholder="Say what caught your eye"
              multiline
              accessibilityLabel="Note to send with your interest"
            />
            <Text variant="footnote" color="textMuted" style={s.noteCounter}>{noteText.length}/280</Text>
            <Button
              title="Send interest"
              icon="heart"
              haptic={false}
              style={s.sheetCta}
              onPress={() => {
                setNoteSheetOpen(false);
                handleAction('like', noteText.trim() || undefined);
              }}
              testID="send-like-note"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CompatibilityBreakdownSheet
        visible={breakdownVisible}
        userId={userId}
        onClose={() => setBreakdownVisible(false)}
      />

      <PhotoGalleryViewer
        photos={viewablePhotos}
        initialIndex={galleryIndex ?? 0}
        visible={galleryIndex !== null}
        onClose={() => setGalleryIndex(null)}
      />

      {/* Mention-a-photo sheet — carries the warmth into the first message
          (client-side prefill; chat gating unchanged). */}
      <Modal
        visible={appreciateOpen}
        transparent
        animationType={sheetAnim}
        onRequestClose={() => setAppreciateOpen(false)}
      >
        <PressableScale
          scaleTo={1}
          style={[s.sheetBackdrop, { backgroundColor: c.scrim }]}
          onPress={() => setAppreciateOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[s.sheet, s.appSheet, { backgroundColor: c.sheetBg }, sheetPad]}>
          <Ionicons name="heart-circle" size={40} color={c.primary} style={s.appIcon} {...HIDE_FROM_A11Y} />
          <Text variant="title2" color="fgStrong" style={s.appTitle} accessibilityRole="header">Mention this photo</Text>
          <Text variant="callout" color="textSecondary" style={s.appBody}>
            Start your conversation with {profile.firstName} by saying what caught your eye.
          </Text>
          <Button
            title={isPaid ? 'Mention in a message' : 'Upgrade to message'}
            icon="chatbubble-ellipses-outline"
            haptic={false}
            onPress={() => {
              setAppreciateOpen(false);
              if (isPaid) {
                navigation.navigate('ChatThread', {
                  userId,
                  name,
                  photo: heroPhoto ?? undefined,
                  draft: `Hello ${profile.firstName}, one of your photos stood out to me. I would love to know the story behind it.`,
                });
              } else {
                navigation.navigate('Subscription');
              }
            }}
            testID="appreciate-cta"
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
// Layout, spacing and radius only. Colour arrives inline from `useTheme()`.

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  flex: { flex: 1 },
  errorBody: { flex: 1, justifyContent: 'center' },

  floatHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    zIndex: 10,
  },
  floatTitleWrap: { flex: 1, paddingHorizontal: spacing.sm },
  floatTitle: { textAlign: 'center' },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  essenceBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 240,
  },
  statChipText: { flexShrink: 1 },
  compatCard: { marginTop: spacing.lg },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  compatInfo: { flex: 1 },
  compatHint: { marginTop: 2 },
  compatWhy: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  promptItem: { marginBottom: spacing.md },
  promptQ: {
    marginBottom: 4,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: { borderRadius: borderRadius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },

  detailRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailRowStacked: { flexDirection: 'column', gap: 2 },
  detailLabel: { width: 130 },
  detailValue: { flex: 1 },

  kundliBtn: { alignSelf: 'flex-start', marginTop: spacing.xs },

  safetyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing['2xl'],
  },

  sheetBackdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.lg,
  },
  sheetTitle: { marginBottom: spacing.md },
  sheetCta: { marginTop: spacing.md },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  noteCounter: { alignSelf: 'flex-end', marginTop: 4, fontVariant: ['tabular-nums'] },
  // No grabber: this is a plain slide-up Modal that does not drag, so a handle
  // would advertise a swipe that does nothing (the backdrop and Close dismiss it).
  appSheet: { gap: spacing.md },
  appIcon: { alignSelf: 'center' },
  appTitle: { textAlign: 'center' },
  appBody: { textAlign: 'center' },

  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
  },
  noteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },

  mutualHint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  // Beside a 20pt glyph: at large OS text the sentence wraps instead of overflowing the bar.
  mutualText: { flexShrink: 1, textAlign: 'center' },
});
