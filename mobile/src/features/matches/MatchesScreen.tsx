import React, { useEffect, useRef, useState } from 'react';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  AccessibilityInfo,
  ActivityIndicator,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Text from '../../components/ui/Text';
import { PressableScale, useReduceMotion } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import TabHeader from '../../components/layout/TabHeader';
import RowSeparator from '../../components/ui/RowSeparator';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { duration, EASE_IN_OUT, EASE_OUT } from '@shared/constants/motion';
import { scoreColour } from '../../components/cards/ProfileCard';
import {
  getMutualMatches,
  getShortlisted,
  getLikedMe,
  getSentInterests,
  performMatchAction,
} from '../../api/matches';
import { queryKeys } from '../../constants/queryKeys';
import { useOfflineShortlist } from '../../hooks/useOfflineShortlist';
import OfflineBanner from '../../components/common/OfflineBanner';
import { Avatar, EmptyState as SharedEmpty, GoldLock, SkeletonRow, MatchCelebration } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import type { MainStackParamList } from '../../navigation/types';
import type { Match } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { hasPremiumAccess } from '../../utils/entitlements';
import { LIST_PERF } from '../../constants/listPerf';
import { showToast } from '../../utils/toast';
import { getAge } from '../../utils/dateUtils';
import { tapSize } from '../../utils/elderTheme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// One word per intent: what a member gets is an "interest", so the two directions are Received
// and Sent (the tab was "Liked Me" beside "My Interests"). `liked_me` stays the route key:
// notifications and Home deep-link with it. Mutual/Shortlisted reuse the keys the locales
// already carry; Received/Sent are new keys because a resource beats the code default.
type TabKey = 'mutual' | 'shortlisted' | 'liked_me' | 'sent';
const TABS: { key: TabKey; labelKey: string; fallback: string }[] = [
  { key: 'mutual',      labelKey: 'matches.mutual',      fallback: 'Mutual' },
  { key: 'shortlisted', labelKey: 'matches.shortlisted', fallback: 'Shortlisted' },
  { key: 'liked_me',    labelKey: 'matches.tabReceived', fallback: 'Received' },
  { key: 'sent',        labelKey: 'matches.tabSent',     fallback: 'Sent' },
];

// Segmented-tab geometry. The one underline is positioned from these plus the measured bar width.
const TAB_BAR_PAD = 14;
const TAB_GAP = 4;
const UNDERLINE_INSET = 8;

// Row motion (doctrine §10.8: `itemLayoutAnimation` and an `exiting` on the row, never `entering`
// on a virtualized row). Both are module-scope so a re-render never builds a new animation.
// The exit is opacity only; the rows below then slide up on the layout transition.
// Layout builders take a plain easing function, so `bezierFn` (not the `bezier` factory).
const ITEM_LAYOUT = LinearTransition.duration(duration.accordion).easing(Easing.bezierFn(...EASE_IN_OUT));
const ROW_EXIT = FadeOut.duration(duration.menu).easing(Easing.bezierFn(...EASE_OUT));
// Layout transitions animate real frame bounds, which Android's removeClippedSubviews (on for
// every long list, see LIST_PERF) recomputes while an item is mid-move: that is where ghost and
// jumping rows come from, and it could not be device-checked here. So row motion is on only where
// clipping is off. To trial it on Android, make this `true` and watch a Decline and a shortlist
// Remove for a ghost row or a sibling that jumps.
const ROW_MOTION_SAFE = !LIST_PERF.removeClippedSubviews;

type ActionKind = 'like' | 'pass' | 'remove';

// ─── Match Row (shared list item) ─────────────────────────────────────────────

interface MatchRowProps {
  match: Match;
  mode: TabKey;
  /** An action on this row is in flight: every button waits, and a tapped Accept shows a spinner. */
  busy?: ActionKind;
  exiting?: React.ComponentProps<typeof Animated.View>['exiting'];
  onPress: () => void;
  onChat?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onRemove?: () => void;
}

function MatchRow({ match, mode, busy, exiting, onPress, onChat, onAccept, onDecline, onRemove }: MatchRowProps) {
  const { t } = useTranslation();
  const { c, isDark, elder } = useTheme();
  const mr = React.useMemo(() => makeMr(c), [c]);
  // Elder mode's 60pt floor. These circles sit 8pt apart and Accept is next to an
  // immediate Decline, so in elder mode the mark itself grows rather than leaning on
  // a hitSlop that would overlap its neighbour.
  const tap = tapSize(elder);
  const circle = elder ? { width: tap, height: tap, borderRadius: tap / 2 } : null;
  // Text and glyph on the tonal Message pill. In dark the accent (#C75D7E) on the accentSoft fill
  // is 4.4:1, just under AA for 15pt text; the light end of the ramp holds in both themes.
  const pillFg = isDark ? c.p300 : c.accent;
  const profile = match.MatchedProfile;
  const name = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || t('matches.unknown', 'Unknown')
    : t('matches.unknown', 'Unknown');
  const first = profile?.firstName || 'them';
  const age = profile?.dateOfBirth ? getAge(profile.dateOfBirth) : null;
  const photoUri = profile?.profilePhoto ?? profile?.photos?.[0];
  const compat = match.compatibilityScore ?? profile?.compatibilityScore ?? 0;
  const showNote = (mode === 'liked_me' || mode === 'sent') && !!match.note;
  const hasActions =
    ((mode === 'mutual' || mode === 'liked_me') && !!onChat) ||
    (mode === 'liked_me' && (!!onAccept || !!onDecline)) ||
    (mode === 'shortlisted' && !!onRemove);

  // The old label was "<name> match", which dropped everything a member scans a
  // row for. Say what the eye reads: who, where, how compatible, any note.
  const rowLabel = [
    `${name}${age ? `, ${age}` : ''}`,
    [profile?.profession, profile?.city].filter(Boolean).join(', ') || null,
    compat > 0 ? t('matches.a11yCompat', '{{pct}}% compatible', { pct: compat }) : null,
    profile?.isVerified ? t('matches.a11yVerified', 'Verified') : null,
    showNote ? t('matches.a11yNote', 'Note: {{note}}', { note: match.note }) : null,
  ].filter(Boolean).join('. ');

  return (
    // A plain container: the tappable profile area and the action buttons are
    // SIBLINGS. Buttons nested inside the row's own pressable were unreachable
    // by VoiceOver, which treats an accessible parent as a single element.
    // No border here: the inset RowSeparator between rows is the divider, and a border on the
    // row itself was full-bleed (Messages' is inset).
    <Animated.View exiting={exiting} style={mr.row}>
      <PressableScale
        style={mr.main}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={rowLabel}
        accessibilityHint={t('matches.a11yOpensProfile', 'Opens profile')}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Avatar uri={photoUri} name={name} size={54} verified={profile?.isVerified} />

        <View style={mr.body}>
          <Text variant="headline" color="fgStrong" numberOfLines={2}>{name}{age ? `, ${age}` : ''}</Text>
          <Text variant="footnote" color="textMuted" numberOfLines={1}>
            {[profile?.profession, profile?.city].filter(Boolean).join(' · ')}
          </Text>
          {compat > 0 && (
            <View style={mr.compatRow}>
              <View style={[mr.compatBar, { backgroundColor: c.border }]}>
                <View style={[mr.compatFill, { width: `${compat}%`, backgroundColor: scoreColour(compat, c) }]} />
              </View>
              <Text variant="caption" color="textMuted" style={mr.compatPct}>{compat}%</Text>
            </View>
          )}
          {/* D3: a like-with-note leads with the quoted note (liked_me + sent). */}
          {showNote ? (
            <Text variant="footnote" color="textSecondary" style={mr.noteLine} numberOfLines={2}>
              “{match.note}”
            </Text>
          ) : null}
        </View>

        {!hasActions && <Ionicons name="chevron-forward" size={16} color={c.textMuted} />}
      </PressableScale>

      {hasActions && (
        <View style={[mr.actions, busy && mr.actionsBusy]}>
          {/* An interest the member has accepted is now a mutual match: chat replaces the pair.
              A labelled pill, not a glyph: the person choosing here cannot be expected to read a
              bare speech bubble, and a solid burgundy disc on every row outranked the names.
              Filled burgundy is kept for the one primary action on a screen. */}
          {(mode === 'mutual' || mode === 'liked_me') && onChat && (
            <PressableScale
              scaleTo={0.95}
              style={[mr.messagePill, { minHeight: tap, backgroundColor: c.accentSoft }]}
              onPress={onChat}
              accessibilityRole="button"
              // Starts with the word on screen, so Voice Control's "tap Message" resolves.
              accessibilityLabel={t('matches.a11yMessage', 'Message {{name}}', { name: first })}
              testID={`match-chat-${match.id}-tap44-hitslop`}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chatbubble-outline" size={16} color={pillFg} />
              {/* One line at any text size or language: the label shrinks before the pill grows. */}
              <Text
                variant="subhead"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                maxScale={1.3}
                style={[mr.messageLabel, { color: pillFg }]}
              >
                {t('matches.message', 'Message')}
              </Text>
            </PressableScale>
          )}
          {mode === 'liked_me' && (
            <View style={mr.acceptRow}>
              {onAccept && (
                <PressableScale
                  scaleTo={0.9}
                  haptic
                  disabled={!!busy}
                  style={[mr.circleBtn, circle, { backgroundColor: c.successBg }]}
                  onPress={onAccept}
                  accessibilityRole="button"
                  accessibilityLabel={t('matches.a11yAccept', 'Accept interest from {{name}}', { name: first })}
                  accessibilityState={{ disabled: !!busy, busy: busy === 'like' }}
                  testID={`match-accept-${match.id}-tap44-hitslop`}
                  hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {busy === 'like'
                    ? <ActivityIndicator size="small" color={c.successAccent} />
                    : <Ionicons name="heart" size={18} color={c.successAccent} />}
                </PressableScale>
              )}
              {onDecline && (
                <PressableScale
                  scaleTo={0.9}
                  haptic
                  disabled={!!busy}
                  style={[mr.circleBtn, circle, { backgroundColor: c.errorBg }]}
                  onPress={onDecline}
                  accessibilityRole="button"
                  accessibilityLabel={t('matches.a11yDecline', 'Decline interest from {{name}}', { name: first })}
                  accessibilityState={{ disabled: !!busy }}
                  testID={`match-decline-${match.id}-tap44-hitslop`}
                  hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color={c.error} />
                </PressableScale>
              )}
            </View>
          )}
          {mode === 'shortlisted' && onRemove && (
            <PressableScale
              scaleTo={0.9}
              haptic
              disabled={!!busy}
              style={[mr.circleBtn, circle, { backgroundColor: c.accentSoft }]}
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel={t('matches.a11yRemove', 'Remove {{name}} from shortlist', { name: first })}
              accessibilityState={{ disabled: !!busy }}
              testID={`match-remove-${match.id}-tap44-hitslop`}
              hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="bookmark" size={18} color={c.accent} />
            </PressableScale>
          )}
        </View>
      )}
    </Animated.View>
  );
}
const makeMr = (c: ThemeColours) => StyleSheet.create({
  noteLine: { fontStyle: 'italic', marginTop: 3 },
  // gap 13 + the 54pt avatar is what RowSeparator's inset is measured from.
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.gutter, paddingVertical: 11,
    gap: 13,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  body: { flex: 1, gap: 3 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  // Track is `border`, not `surface2`: surface2 is a shade off the page and the empty part of
  // the bar disappeared, leaving a fill with no length to read it against.
  compatBar: { flex: 1, height: 5, backgroundColor: c.border, borderRadius: borderRadius.pill, overflow: 'hidden' },
  compatFill: { height: 5, borderRadius: borderRadius.pill },
  compatPct: { minWidth: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionsBusy: { opacity: 0.5 },
  // Tonal, not filled: accentSoft fill, accent glyph and label. maxWidth lets the label shrink
  // (see adjustsFontSizeToFit) in a longer language instead of squeezing the name column.
  messagePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 14, borderRadius: borderRadius.pill, maxWidth: 152,
  },
  messageLabel: { flexShrink: 1 },
  acceptRow: { flexDirection: 'row', gap: spacing.sm },
  circleBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});

// ─── Tab Content ──────────────────────────────────────────────────────────────

function TabContent({ activeTab }: { activeTab: TabKey }) {
  const { t } = useTranslation();
  const tabClearance = useTabBarClearance();
  const navigation = useNavigation<Nav>();
  const { c } = useTheme();
  const queryClient = useQueryClient();
  const reduceMotion = useReduceMotion();
  // Row exit + reflow, off under Reduce Motion (the row just goes) and off where Android's clipped
  // subviews make layout transitions unsafe (ROW_MOTION_SAFE).
  const rowMotion = ROW_MOTION_SAFE && !reduceMotion;
  // "Liked Me" is a requirePremium surface on the server, NOT a chat surface, so
  // it deliberately does not consult the free-chat-for-mutuals flag. Turning that
  // flag on opens chat; it must not silently hand out every paid surface.
  const authUser = useAuthStore((st) => st.user);
  const hasPlus = hasPremiumAccess(authUser);
  // Chat buttons open a specific thread (a stack screen), which stays reachable in elder mode
  // even though that mode removes the Chat TAB. Hiding them left elder members with no way
  // to message anyone they had matched (seen on device).
  // mutual-match seal celebration (shown after accepting a "Liked Me" interest)
  const [celebrate, setCelebrate] = useState<{ name: string; userId: string; photo?: string } | null>(null);
  // The likes endpoint does not exclude people the member has already answered, so a
  // refetch returns them again. Remember the answer here so Decline visibly removes the
  // row and an accepted row stops offering Accept/Decline while this screen is open.
  const [answered, setAnswered] = useState<Record<string, 'accepted' | 'declined'>>({});
  // Shortlist rows the member has just removed. They leave the list on the tap and are put back,
  // with a toast, if the server says no; the entry is dropped once the refetched list agrees.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  // Actions in flight, by the other member's id. The ref answers "already running?" synchronously
  // so a double tap cannot fire twice before the state re-renders; the state paints the disabled row.
  const [pending, setPending] = useState<Record<string, ActionKind>>({});
  const pendingRef = useRef<Record<string, ActionKind>>({});
  const beginAction = (id: string, kind: ActionKind): boolean => {
    if (pendingRef.current[id]) return false;
    pendingRef.current = { ...pendingRef.current, [id]: kind };
    setPending(pendingRef.current);
    return true;
  };
  const endAction = (id: string) => {
    const next = { ...pendingRef.current };
    delete next[id];
    pendingRef.current = next;
    setPending(next);
  };
  // The server now says what the member already did about each liker (`myAction`), which
  // survives a restart and covers a like made from Search or a profile; the local map
  // covers taps on this screen before the refetch lands and an older server without the field.
  const answerOf = (m: Match): 'accepted' | 'declined' | undefined =>
    answered[m.matchedUserId] ??
    (m.myAction === 'pass' ? 'declined' : m.myAction === 'like' ? 'accepted' : undefined);

  const mutualQuery   = useQuery({ queryKey: queryKeys.mutualMatches,  queryFn: getMutualMatches,  enabled: activeTab === 'mutual' });
  // A free member is shown the lock instead; firing the request anyway would only 403.
  const likedMeQuery  = useQuery({ queryKey: queryKeys.likedMe,        queryFn: getLikedMe,        enabled: activeTab === 'liked_me' && hasPlus });
  const sentQuery     = useQuery({ queryKey: queryKeys.sentInterests,  queryFn: getSentInterests,  enabled: activeTab === 'sent' });

  // Shortlisted uses offline-aware hook
  const {
    shortlist: offlineShortlist,
    isOffline,
    isStale,
    lastSyncedLabel,
    refetch: refetchShortlist,
  } = useOfflineShortlist();

  // useOfflineShortlist owns the shortlist fetch but only returns the list, so
  // "still loading" and "failed" both look like "empty". This passive observer
  // (same key, enabled:false, so no second fetch) reads the status of that
  // same cache entry.
  const shortlistQuery = useQuery({ queryKey: queryKeys.shortlisted, queryFn: getShortlisted, enabled: false });

  // Drop a removed id once the list no longer contains it. Keeping it until then (rather than on
  // the request succeeding) means the row cannot reappear in the gap before the refetch lands,
  // and dropping it after means re-shortlisting the same person later shows them again.
  useEffect(() => {
    setRemoved((prev) => {
      if (prev.size === 0) return prev;
      const still = new Set(offlineShortlist.map((m) => m.matchedUserId));
      const next = new Set([...prev].filter((id) => still.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [offlineShortlist]);

  const actionFailed = (title: string) =>
    showToast.error(title, t('matches.errBody', 'Check your connection and try again.'));

  // Accept and Decline. Decline is safe to show at once (the row leaves on the tap and returns,
  // with a toast, if the server refuses); Accept waits for the server, because it can turn into a
  // mutual match and the celebration must not fire for something that did not happen.
  const replyToInterest = async (item: Match, action: 'like' | 'pass') => {
    const id = item.matchedUserId;
    if (!beginAction(id, action)) return;
    if (action === 'pass') setAnswered((a) => ({ ...a, [id]: 'declined' }));
    try {
      await performMatchAction(id, action);
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.likedMe });
      queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
      if (action === 'like') {
        // `matchedUserId` is the other member. `userId` is '' on every Match built
        // by api/matches toMatch(), which POSTed to `/match/` and always 404'd.
        const p = item.MatchedProfile;
        const nm = p ? `${p.firstName} ${p.lastName}`.trim() : undefined;
        setAnswered((a) => ({ ...a, [id]: 'accepted' }));
        setCelebrate({ name: nm || 'them', userId: id, photo: p?.profilePhoto ?? p?.photos?.[0] ?? undefined });
      } else {
        // The row has left with no tap on anything new; say so.
        AccessibilityInfo.announceForAccessibility(t('matches.a11yDeclined', 'Interest declined'));
      }
    } catch {
      if (action === 'pass') {
        setAnswered((a) => {
          const next = { ...a };
          delete next[id];
          return next;
        });
      }
      // A tap that fails must not read as a tap that did nothing.
      actionFailed(t('matches.errActionTitle', "That didn't go through"));
    } finally {
      endAction(id);
    }
  };

  const removeFromShortlist = async (item: Match) => {
    const id = item.matchedUserId;
    if (!beginAction(id, 'remove')) return;
    setRemoved((s) => new Set(s).add(id));
    try {
      await performMatchAction(id, 'pass');
      queryClient.invalidateQueries({ queryKey: queryKeys.shortlisted });
      AccessibilityInfo.announceForAccessibility(t('matches.a11yRemoved', 'Removed from your shortlist'));
    } catch {
      setRemoved((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      actionFailed(t('matches.errRemoveTitle', "Couldn't remove from your shortlist"));
    } finally {
      endAction(id);
    }
  };

  const queryMap = {
    mutual:   mutualQuery,
    liked_me: likedMeQuery,
    sent:     sentQuery,
  };

  // For shortlisted tab, use offline hook data; for others use React Query
  let matches: Match[];
  let isLoading: boolean;
  let isError: boolean;
  let isRefreshing: boolean;
  let refetch: () => unknown;

  if (activeTab === 'shortlisted') {
    matches = removed.size > 0
      ? offlineShortlist.filter((m) => !removed.has(m.matchedUserId))
      : offlineShortlist;
    // Offline reads come from the MMKV cache, so only claim "loading" while a
    // fetch is genuinely expected and there is nothing cached to show.
    isLoading =
      !isOffline &&
      matches.length === 0 &&
      (shortlistQuery.isPending || (shortlistQuery.isError && shortlistQuery.isFetching));
    // Offline with nothing cached is "unknown", not "empty". NetInfo answers at once but
    // the request started at mount keeps retrying for seconds; in that window the query
    // is neither loading nor errored, and the screen used to claim the shortlist was empty.
    isError = shortlistQuery.isError || (isOffline && matches.length === 0);
    isRefreshing = matches.length > 0 && shortlistQuery.isFetching;
    refetch = refetchShortlist;
  } else {
    const q = queryMap[activeTab as keyof typeof queryMap];
    matches = (q.data as Match[]) ?? [];
    // A retry from the error state shows the skeleton again instead of
    // leaving the error card sitting there while the request is in flight.
    isLoading = q.isLoading || (q.isError && q.isFetching && matches.length === 0);
    isError = q.isError;
    isRefreshing = q.isRefetching;
    refetch = q.refetch;
  }

  // A pull that fails must not look like a pull that found nothing new (Home and
  // Notifications already say so). The shortlist hook's own refetch returns nothing,
  // so that tab reads the same cache entry's fetch result directly; offline the hook
  // does not fetch at all and the banner already explains why.
  const onRefresh = async () => {
    const res = activeTab === 'shortlisted'
      ? (isOffline ? undefined : await shortlistQuery.refetch())
      : ((await refetch()) as { isError?: boolean } | undefined);
    if (res?.isError) showToast.error("Couldn't refresh", 'Check your connection and try again.');
  };

  const errorNouns: Record<TabKey, string> = {
    mutual:      'your matches',
    shortlisted: 'your shortlist',
    liked_me:    'people who liked you',
    sent:        'your sent interests',
  };

  const emptyConfigs: Record<TabKey, {
    icon: 'heart-circle-outline' | 'bookmark-outline' | 'heart-outline' | 'paper-plane-outline';
    title: string;
    sub: string;
    actionLabel: string;
    onAction: () => void;
  }> = {
    mutual: {
      icon: 'heart-circle-outline',
      title: 'No mutual matches yet',
      sub: "When you both like each other, you'll appear here.",
      actionLabel: "See today's matches",
      onAction: () => navigation.navigate('MainTabs', { screen: 'Home' }),
    },
    shortlisted: {
      icon: 'bookmark-outline',
      title: 'Your shortlist is empty',
      sub: 'Shortlist profiles to revisit them anytime.',
      actionLabel: 'Browse profiles',
      onAction: () => navigation.navigate('MainTabs', { screen: 'Search' }),
    },
    liked_me: {
      icon: 'heart-outline',
      title: 'No one has liked you yet',
      sub: 'Improve your profile to attract more attention.',
      actionLabel: 'Improve your profile',
      onAction: () => navigation.navigate('EditProfile'),
    },
    sent: {
      icon: 'paper-plane-outline',
      title: "You haven't reached out yet",
      sub: "Profiles you like show up here. Today's matches are waiting.",
      actionLabel: "See today's matches",
      onAction: () => navigation.navigate('MainTabs', { screen: 'Home' }),
    },
  };

  // The error card swaps in with no tap on anything, so say it (iOS ignores
  // accessibilityLiveRegion, hence by hand). The free member's lock is not an error.
  const loadFailed = !(activeTab === 'liked_me' && !hasPlus) && isError && matches.length === 0;
  const errorAnnouncement =
    activeTab === 'shortlisted' && isOffline
      ? "You're offline. Your shortlist will load when you're back online."
      : `Couldn't load ${errorNouns[activeTab]}`;
  useEffect(() => {
    if (loadFailed) AccessibilityInfo.announceForAccessibility(errorAnnouncement);
  }, [loadFailed, errorAnnouncement]);

  if (activeTab === 'liked_me' && !hasPlus) {
    return (
      // Centred in the visible area, i.e. above the floating pill, not behind it.
      <View style={{ flex: 1, padding: spacing.gutter, paddingBottom: spacing.gutter + tabClearance, justifyContent: 'center' }}>
        <GoldLock
          title="See who liked you"
          subtitle="Unlock everyone who's interested in your profile with Premium."
          ctaLabel="Upgrade now"
          onUnlock={() => navigation.navigate('Subscription')}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View accessible accessibilityLabel="Loading matches" accessibilityState={{ busy: true }} style={{ flex: 1 }}>
        <FlatList
          data={[1, 2, 3, 4]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonRow />}
          scrollEnabled={false}
        />
      </View>
    );
  }

  // Only when there is nothing to show: a failed background refetch must not
  // blank a list we already have, and a failed load must never read as "empty".
  if (isError && matches.length === 0) {
    return (
      <SharedEmpty
        variant="error"
        icon="cloud-offline-outline"
        title={`Couldn't load ${errorNouns[activeTab]}`}
        description={
          activeTab === 'shortlisted' && isOffline
            ? "You're offline. Your shortlist will load when you're back online."
            : 'Check your connection and try again.'
        }
        actionLabel={activeTab === 'shortlisted' && isOffline ? undefined : 'Try again'}
        onAction={activeTab === 'shortlisted' && isOffline ? undefined : () => refetch()}
        testID="MatchesScreen-error"
      />
    );
  }

  // Declined likers leave the list; an empty result after answering everyone is not
  // "no one has liked you".
  const rows = activeTab === 'liked_me'
    ? matches.filter((m) => answerOf(m) !== 'declined')
    : matches;
  const caughtUp = activeTab === 'liked_me' && matches.length > 0 && rows.length === 0;

  if (rows.length === 0) {
    const cfg = caughtUp
      ? {
          icon: 'heart-circle-outline' as const,
          title: "You're all caught up",
          sub: 'New interest from other members will show up here.',
          actionLabel: 'Browse profiles',
          onAction: () => navigation.navigate('MainTabs', { screen: 'Search' }),
        }
      : emptyConfigs[activeTab];
    return (
      <SharedEmpty
        icon={cfg.icon}
        title={cfg.title}
        description={cfg.sub}
        actionLabel={cfg.actionLabel}
        onAction={cfg.onAction}
        testID={`MatchesScreen-empty-${activeTab}`}
      />
    );
  }

  // Animated.FlatList is a FlatList whose cells carry the layout transition; typed as the plain
  // one so the props below stay checked.
  const List = (rowMotion ? Animated.FlatList : FlatList) as typeof FlatList;
  // Reanimated's FlatList defaults scrollEventThrottle to 1 (a JS event per frame); RN's own default is 50.
  const motionProps = rowMotion
    ? { itemLayoutAnimation: ITEM_LAYOUT, skipEnteringExitingAnimations: true, scrollEventThrottle: 50 }
    : null;

  return (
    <View style={{ flex: 1 }}>
      {activeTab === 'shortlisted' && isOffline && (
        <OfflineBanner
          lastSyncedLabel={lastSyncedLabel}
          isStale={isStale}
          onRefresh={refetchShortlist}
        />
      )}
      {/* Keyed by tab: the four segments share this one list, so without the key a scroll offset
          from Mutual carried into Shortlisted, and every row of the old tab would play its exit
          over the new one. A new instance starts at the top; skipEnteringExitingAnimations makes
          its mount and unmount instant, leaving the row exit for a Decline or a Remove only. */}
      <List
        key={activeTab}
        {...LIST_PERF}
        {...motionProps}
        data={rows}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={RowSeparator}
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            mode={activeTab}
            busy={pending[item.matchedUserId]}
            exiting={rowMotion ? ROW_EXIT : undefined}
            onPress={() =>
              item.matchedUserId &&
              navigation.navigate('ProfileDetail', { userId: item.matchedUserId })
            }
            onChat={
              (activeTab === 'mutual' || (activeTab === 'liked_me' && answerOf(item) === 'accepted'))
                ? () => {
                    // Open THIS person's thread: the button says "Message <name>", and
                    // landing on the conversation list made the member find them again.
                    const p = item.MatchedProfile;
                    navigation.navigate('ChatThread', {
                      userId: item.matchedUserId,
                      name: p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : '',
                      photo: p?.profilePhoto ?? p?.photos?.[0] ?? undefined,
                    });
                  }
                : undefined
            }
            onAccept={
              activeTab === 'liked_me' && !answerOf(item)
                ? () => replyToInterest(item, 'like')
                : undefined
            }
            onDecline={
              activeTab === 'liked_me' && !answerOf(item)
                ? () => replyToInterest(item, 'pass')
                : undefined
            }
            onRemove={
              activeTab === 'shortlisted'
                ? () => removeFromShortlist(item)
                : undefined
            }
          />
        )}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[c.accent]} tintColor={c.accent} />
        }
        contentContainerStyle={{ paddingBottom: spacing['5xl'] + tabClearance }}
        testID={`matches-list-${activeTab}`}
      />
      <MatchCelebration
        visible={!!celebrate}
        name={celebrate?.name}
        onClose={() => setCelebrate(null)}
        onMessage={() => {
          // Straight into the thread with the person just matched, not the chat list.
          const who = celebrate;
          setCelebrate(null);
          if (who) navigation.navigate('ChatThread', { userId: who.userId, name: who.name, photo: who.photo });
        }}
      />
    </View>
  );
}

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const { t } = useTranslation();
  const { c, elder } = useTheme();
  const tabHeight = tapSize(elder);
  const navigation = useNavigation();
  const route = useRoute();
  const reduceMotion = useReduceMotion();
  const [activeTab, setActiveTab] = useState<TabKey>('mutual');

  // Other screens deep-link into a tab ("Interests" on Home, an
  // interest-received notification). This screen stays mounted inside the tab
  // navigator, so the param is read as an event: honour it, then clear it so
  // the same link works again after the member has switched tabs by hand.
  const requestedTab = (route.params as { tab?: TabKey } | undefined)?.tab;
  useEffect(() => {
    if (!requestedTab) return;
    if (TABS.some((t) => t.key === requestedTab)) setActiveTab(requestedTab);
    navigation.setParams({ tab: undefined } as never);
  }, [requestedTab, navigation]);

  // One underline that slides between the four equal columns. It used to be mounted inside the
  // active tab only, so it vanished from one column and appeared in another with no travel. It is
  // absolutely positioned and childless, so animating its transform costs no layout.
  const [barWidth, setBarWidth] = useState(0);
  const columnWidth = barWidth > 0 ? (barWidth - TAB_BAR_PAD * 2 - TAB_GAP * (TABS.length - 1)) / TABS.length : 0;
  const activeIndex = TABS.findIndex((tab) => tab.key === activeTab);
  const underlineX = useSharedValue(0);
  const placedFor = useRef(0);
  useEffect(() => {
    if (columnWidth <= 0) return;
    const target = activeIndex * (columnWidth + TAB_GAP);
    // First placement, a resize, and Reduce Motion all jump: only a tab change travels.
    if (reduceMotion || placedFor.current !== columnWidth) {
      underlineX.value = target;
    } else {
      underlineX.value = withTiming(target, { duration: duration.menu, easing: Easing.bezier(...EASE_IN_OUT) });
    }
    placedFor.current = columnWidth;
  }, [activeIndex, columnWidth, reduceMotion, underlineX]);
  const underlineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: underlineX.value }] }));

  return (
    <Screen edges={['top']} style={s.container} testID="MatchesScreen">
      <TabHeader title={t('matches.title', 'Matches')} />
      {/* Tab bar */}
      <View
        style={[s.tabBar, { borderBottomColor: c.hairline }]}
        accessibilityRole="tablist"
        onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {TABS.map((tab) => {
          const on = activeTab === tab.key;
          const label = t(tab.labelKey, tab.fallback);
          return (
            <PressableScale
              key={tab.key}
              style={[s.tab, { minHeight: tabHeight }]}
              onPress={() => setActiveTab(tab.key)}
              haptic={!on}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              testID={`tab-${tab.key}`}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {/* four equal columns: the label shrinks rather than wrapping the tab onto two lines */}
              <Text variant="subhead" color={on ? 'primary' : 'textMuted'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxScale={1.3}>{label}</Text>
            </PressableScale>
          );
        })}
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            s.tabUnderline,
            { width: Math.max(columnWidth - UNDERLINE_INSET * 2, 0), backgroundColor: c.accent },
            underlineStyle,
          ]}
        />
      </View>

      {/* Content */}
      <TabContent activeTab={activeTab} />
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', gap: TAB_GAP, paddingHorizontal: TAB_BAR_PAD, borderBottomWidth: 0.5 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tabUnderline: {
    position: 'absolute', left: TAB_BAR_PAD + UNDERLINE_INSET, bottom: -0.5,
    height: 2.5, borderRadius: 3,
  },
});
