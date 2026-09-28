import React, { useCallback, useEffect, useRef, useState } from 'react';
import { requestNotifPrime } from '../../utils/notifPrime';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeOut, LinearTransition } from 'react-native-reanimated';
import Screen from '../../components/layout/Screen';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ListFooter from '../../components/ui/ListFooter';
import { PressableScale, useReduceMotion } from '../../components/motion';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { type as typeScale, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { duration, EASE_IN_OUT, EASE_OUT } from '@shared/constants/motion';
import { getProfileByCode, search, createSavedSearch } from '../../api/search';
import { showToast } from '../../utils/toast';
import { performMatchAction } from '../../api/matches';
import ProfileCard, { CARD_MAX_W } from '../../components/cards/ProfileCard';
import { EmptyState as SharedEmpty, MatchCelebration, PickerSheet, SkeletonBlock } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import FilterPanel, { type FilterPanelHandle } from '../../components/search/FilterPanel';
import type { MainStackParamList } from '../../navigation/types';
import type { SearchFilters, ProfileSummary, MatchAction } from '../../types';
import { formatProfileCode, parseProfileCode } from '../../utils/profileCode';
import { LIST_PERF } from '../../constants/listPerf';
import { queryKeys } from '../../constants/queryKeys';
import { tapSize } from '../../utils/elderTheme';
import { haptics } from '../../utils/haptics';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type SortOption = NonNullable<SearchFilters['sort']>;
// "Recently Active" is deliberately absent: the server validates `sortBy=lastLogin`
// but orders by createdAt for anything that is not age/location, so the option
// returned Newest under another name. Add it back when the server implements it.
const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Compatibility', value: 'compatibility' },
  { label: 'Newest', value: 'newest' },
];

const DEFAULT_FILTERS: SearchFilters = {
  sort: 'compatibility',
  limit: 20,
};

const MANGLIK_PARAM = { manglik: 'manglik_only', non_manglik: 'non_manglik_only' } as const;

/**
 * Translate the RN filter state into the query parameters `GET /search` reads
 * (searchController.js, and the web client sends the same names). The server
 * silently ignores keys it does not know, and this state used its own names for
 * three of them, so Sort, Manglik and Verified-only changed the request and
 * nothing about the results. `excludeGotra` has no server counterpart at all
 * and is left out rather than sent to be ignored.
 *
 * This belongs in `api/search.ts`; it lives here only because that layer is
 * outside this pass. Move it there and delete this.
 */
function toServerParams(f: SearchFilters): SearchFilters & Record<string, unknown> {
  const { sort, manglikStatus, isVerified, excludeGotra: _excludeGotra, maritalStatus, city, ...rest } = f;
  return {
    ...rest,
    sortBy: sort === 'newest' ? 'recent' : 'compatibility',
    ...(manglikStatus && MANGLIK_PARAM[manglikStatus as keyof typeof MANGLIK_PARAM]
      ? { manglikFilter: MANGLIK_PARAM[manglikStatus as keyof typeof MANGLIK_PARAM] }
      : {}),
    ...(isVerified ? { verifiedOnly: 'true' } : {}),
    // The server takes ONE marital status and one city, and ignores arrays. A
    // single selection narrows the results; a multi-selection cannot be expressed yet.
    ...(maritalStatus && maritalStatus.length === 1 ? { maritalStatus: maritalStatus[0] } : {}),
    ...(city && city.length > 0 ? { city: city[0] } : {}),
  } as unknown as SearchFilters & Record<string, unknown>;
}

// A card that leaves the list (Pass) fades out (opacity only, no travel) and the cards below
// close the gap on a layout move, instead of the ~500pt card vanishing in one frame and
// everything below jumping up. Built once here; both are dropped under Reduce Motion.
// Layout builders take a plain easing function, so `bezierFn` (not the `bezier` factory).
const CARD_EXIT = FadeOut.duration(duration.menu).easing(Easing.bezierFn(...EASE_OUT));
const LIST_REFLOW = LinearTransition.duration(duration.layout).easing(Easing.bezierFn(...EASE_IN_OUT));

/** The person a Like was sent to: carried through the mutation so a mutual match can name them. */
type MatchedWho = { userId: string; name: string; photo?: string };

// An empty array is the same as no filter: toggling a chip on and off leaves [].
const isSet = (v: unknown) => v !== undefined && !(Array.isArray(v) && v.length === 0);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

// Same footprint as a ProfileCard in its COMMON state. About 60% of members have no
// photo, and that card is an identity row (avatar, three lines) over the action row, so
// the skeleton is that shape. A tall photo block here made every photoless card land
// ~230pt shorter than its placeholder and the list jumped when data arrived. A photo
// card is taller than this; a skeleton cannot know which it will be, so it stands in
// for the majority.
function CardSkeleton() {
  const { c } = useTheme();
  const sk = React.useMemo(() => makeSk(c), [c]);
  return (
    <View style={sk.outer}>
      <View style={sk.card}>
        <View style={sk.identity}>
          <SkeletonBlock width={72} height={72} radius={36} />
          <View style={sk.lines}>
            <SkeletonBlock width="72%" height={20} />
            <SkeletonBlock width="48%" height={14} />
            <SkeletonBlock width="34%" height={22} radius={11} />
          </View>
        </View>
        <View style={sk.actions}>
          <SkeletonBlock width="18%" height={14} />
          <SkeletonBlock width="24%" height={14} />
          <SkeletonBlock width="24%" height={14} />
        </View>
      </View>
    </View>
  );
}
const makeSk = (c: ThemeColours) => StyleSheet.create({
  // Gutters on the wrapper, the card capped and centred: the same shape as ProfileCard's.
  outer: { paddingHorizontal: spacing.gutter, marginBottom: spacing.lg, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_W,
    backgroundColor: c.surfaceCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  lines: { flex: 1, gap: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 16 },
});

// ─── Pagination error footer ──────────────────────────────────────────────────

// ui/ListFooter only knows loading / end / idle, so a failed next page had no way to say so.
function PageErrorFooter({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={pe.wrap} accessibilityLiveRegion="polite" testID="results-page-error">
      <Text variant="footnote" color="textMuted" style={pe.text}>Couldn't load more profiles.</Text>
      <Button title="Try again" variant="secondary" size="sm" onPress={onRetry} testID="results-page-retry" />
    </View>
  );
}
const pe = StyleSheet.create({
  wrap: { paddingVertical: spacing.xl, paddingHorizontal: spacing.gutter, alignItems: 'center', gap: spacing.sm },
  text: { textAlign: 'center' },
});

// ─── Save Search Modal ────────────────────────────────────────────────────────

function SaveSearchModal({
  visible,
  onSave,
  onClose,
  saving,
  error,
  onClearError,
}: {
  visible: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
  saving: boolean;
  /** Why the last save failed. Inline, not a toast: a RN <Modal> draws in its own native
      window above the app, so a toast fired while the sheet is open would sit behind it. */
  error?: string | null;
  onClearError?: () => void;
}) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const ss = React.useMemo(() => makeSs(c), [c]);
  const [name, setName] = useState('');
  // Clear the field when the sheet closes, NOT when Save is pressed: a save that
  // fails (duplicate name, five-search cap) leaves the sheet open and the member
  // should not have to retype what they just wrote.
  useEffect(() => {
    if (!visible) setName('');
  }, [visible]);
  const trimmed = name.trim();
  const reduceMotion = useReduceMotion();
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView style={ss.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* The backdrop and the sheet are siblings. With the sheet nested inside
            the backdrop's pressable, VoiceOver saw one "Close" button and could
            not reach the field or either button. */}
        <PressableScale
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          scaleTo={1}
          accessibilityRole="button"
          accessibilityLabel="Close save search"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={ss.scrim} />
        </PressableScale>
        <View style={[ss.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}>
          <Text variant="headline" color="textPrimary" style={ss.title} accessibilityRole="header">Save search</Text>
          <Input
            label="Name this search"
            // The example names only things a saved search actually keeps (religion, city, age).
            helper={t('search.saveNameHelper', 'For example: Sikh in Chandigarh, 26 to 30')}
            error={error ?? undefined}
            containerStyle={ss.inputContainer}
            value={name}
            onChangeText={(v) => { setName(v); onClearError?.(); }}
            returnKeyType="done"
            onSubmitEditing={() => { if (trimmed) onSave(trimmed); }}
            maxLength={60}
            accessibilityLabel="Search name"
          />
          {/* What the server keeps: it stores religion, caste, city and age and drops every
              other filter, so the sheet says so instead of implying the whole filter set is saved. */}
          <Text variant="footnote" color="textMuted" style={ss.scope}>
            {t('search.saveScope', 'Saves religion, caste, city and age.')}
          </Text>
          <View style={ss.row}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={ss.rowBtn} />
            <Button
              title="Save"
              onPress={() => onSave(trimmed)}
              disabled={!trimmed}
              loading={saving}
              style={ss.rowBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const makeSs = (c: ThemeColours) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { flex: 1, backgroundColor: c.scrim },
  sheet: { backgroundColor: c.sheetBg, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg },
  title: { marginBottom: spacing.md },
  inputContainer: { marginBottom: spacing.xs },
  scope: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  rowBtn: { flex: 1 },
});

// ─── SearchScreen ─────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const tabClearance = useTabBarClearance();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { c, elder } = useTheme();
  // Elder mode's 60pt floor for the two toolbar pills; the default look is unchanged.
  const toolMinHeight = elder ? tapSize(elder) : undefined;
  const tap = tapSize(elder);
  // The search field is a raw TextInput (ui/Input has no leading-icon or clear slot yet), so it
  // cannot go through <Text>. It applies the same elder ratio Text.tsx uses (1.15625, private
  // there) to the body role; export a shared scaler from the primitive and delete this.
  const searchType = elder
    ? {
        ...typeScale.body,
        fontSize: Math.round(typeScale.body.fontSize * 1.15625),
        lineHeight: Math.round(typeScale.body.lineHeight * 1.15625),
      }
    : typeScale.body;
  const filterRef = useRef<FilterPanelHandle>(null);

  // Close the filter sheet whenever Search loses focus. The tab navigator keeps
  // this screen mounted, and gorhom's BottomSheet holds its own position, so a
  // sheet left open stayed open: every subsequent visit to Search opened with
  // the filters covering the results instead of the profile list.
  useFocusEffect(
    useCallback(() => () => filterRef.current?.close(), [])
  );

  // The search box does one thing: open a profile by its shared ID. The server
  // has no name search (it reads no `name` parameter), so typing a name used to
  // refetch the same results on every keystroke, flashing the skeleton and
  // spending the 30-requests-a-minute search limit for nothing.
  const [nameQuery, setNameQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  // What the list actually queries. Follows `filters` after a pause, so a run of
  // chip taps or digits typed into a range is one request instead of one each.
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  useEffect(() => {
    const id = setTimeout(() => setAppliedFilters(filters), 350);
    return () => clearTimeout(id);
  }, [filters]);
  // Commits (sort, reset, "Show N profiles") apply immediately instead of waiting out the pause.
  const applyNow = useCallback((next: SearchFilters) => {
    setFilters(next);
    setAppliedFilters(next);
  }, []);
  const [showSort, setShowSort] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [codeLookupError, setCodeLookupError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // What the member has done to each card this session (drives the confirmed
  // state; a pass removes the card).
  const [acted, setActed] = useState<Record<string, MatchAction>>({});
  // A Like that turns out to be mutual: the same celebration Matches and ProfileDetail play.
  const [celebrate, setCelebrate] = useState<MatchedWho | null>(null);
  const reduceMotion = useReduceMotion();

  // A member who has been given a profile ID offline ("mine is TCS-A1B2C3D4")
  // types it into the one search box they can see. Rather than add a second
  // field, recognise the shape and offer the lookup — the same box, one extra
  // affordance, only when the text can actually be a code.
  const typedCode = parseProfileCode(nameQuery);
  const codeLookup = useMutation({
    mutationFn: () => getProfileByCode(nameQuery.trim()),
    onMutate: () => setCodeLookupError(null),
    onSuccess: (profile) => {
      setNameQuery('');
      if ((profile as { isSelf?: boolean }).isSelf) {
        // Opening your own profile in the viewer's layout is confusing; send
        // the member to their own profile tab instead.
        navigation.navigate('MainTabs', { screen: 'Profile' } as never);
        return;
      }
      navigation.navigate('ProfileDetail', { userId: profile.userId });
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      // The server answers 404 both for "no such profile" and for an ambiguous
      // prefix — it refuses to guess between two members. Either way there is
      // nothing to open, so the member sees one honest message.
      const message = data?.error?.message ?? data?.message ?? 'No profile found for that ID';
      setCodeLookupError(message);
      // accessibilityLiveRegion below is Android-only; VoiceOver has to be told.
      AccessibilityInfo.announceForAccessibility(message);
    },
  });

  // ── Infinite query ──────────────────────────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    isError,
    isFetchNextPageError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['search', appliedFilters],
    queryFn: ({ pageParam }) =>
      search({ ...toServerParams(appliedFilters), cursor: pageParam as string | undefined }),
    getNextPageParam: (last: any) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const profiles: ProfileSummary[] = (data?.pages.flatMap((p) => p.profiles) ?? []).filter(
    (p) => acted[p.userId] !== 'pass'
  );
  const total: number = data?.pages[0]?.total ?? 0;
  // Only a failure with nothing to show blanks the list. A failed background
  // refetch or next-page fetch keeps the profiles already on screen.
  const searchFailed = isError && profiles.length === 0;

  // iOS VoiceOver ignores accessibilityLiveRegion, so a filter change that changes the
  // list is announced by hand once each fetch settles. The first settle is the screen
  // opening, which the screen reader's own focus order already covers.
  const busy = isFetching && !isFetchingNextPage;
  const wasBusy = useRef(false);
  const announcedOnce = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      if (announcedOnce.current && !isError) {
        AccessibilityInfo.announceForAccessibility(
          total > 0 ? `${total} ${total === 1 ? 'profile' : 'profiles'} found` : 'No profiles found'
        );
      }
      announcedOnce.current = true;
    } else if (!busy) {
      // Already settled when the screen mounted (cached results): the next settle is a real change.
      announcedOnce.current = true;
    }
    wasBusy.current = busy;
  }, [busy, isError, total]);
  useEffect(() => {
    if (searchFailed) AccessibilityInfo.announceForAccessibility("Couldn't load profiles");
  }, [searchFailed]);
  useEffect(() => {
    if (isFetchNextPageError) AccessibilityInfo.announceForAccessibility("Couldn't load more profiles");
  }, [isFetchNextPageError]);

  // Saved searches (Phase A step 6) — backend is live now; map the active
  // filter state to the saved shape the daily alert job reads.
  const saveSearchMutation = useMutation({
    mutationFn: (nm: string) => {
      const f: Parameters<typeof createSavedSearch>[1] = {};
      if (filters.religion) f.religion = filters.religion;
      if (filters.caste) f.caste = filters.caste;
      if (filters.city?.length) f.city = filters.city;
      if (filters.ageMin) f.ageMin = filters.ageMin;
      if (filters.ageMax) f.ageMax = filters.ageMax;
      return createSavedSearch(nm, f);
    },
    onSuccess: () => {
      setSaveError(null);
      setShowSaveModal(false);
      showToast.success(t('search.saved', 'Search saved'), t('search.savedSub', "We'll alert you about new matching profiles"));
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      // The sheet stays open on failure and the member has to act on it, so the reason
      // lands under the field (a toast would render behind the Modal's own window).
      const text = msg ?? `${t('search.saveFailed', "Couldn't save search")}. Check your connection and try again.`;
      setSaveError(text);
      AccessibilityInfo.announceForAccessibility(text);
    },
  });

  // ── Match actions ───────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const actionMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: MatchAction; who: MatchedWho }) =>
      performMatchAction(userId, action),
    // Hook-level, so it fires for EVERY tap: per-call callbacks only fire for the
    // latest of several in-flight mutations, and cards are tapped in quick succession.
    // Matches keeps its lists cached for minutes (shortlist for 30), so a person the
    // member just saved or liked must be pushed into those lists here, or Matches
    // says they are not there until a manual pull to refresh.
    onSuccess: (data, { userId, action, who }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      if (action === 'shortlist') queryClient.invalidateQueries({ queryKey: queryKeys.shortlisted });
      if (action === 'like') {
        queryClient.invalidateQueries({ queryKey: queryKeys.sentInterests });
        queryClient.invalidateQueries({ queryKey: queryKeys.mutualMatches });
      }
      // A like or pass on someone who already liked the member answers that interest.
      if (action === 'like' || action === 'pass') queryClient.invalidateQueries({ queryKey: queryKeys.likedMe });
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyMatches });
      // A mutual match plays MatchCelebration, which fires its own success haptic; a plain
      // like gets the success haptic here (the tap itself only gave a light one).
      if (action === 'like') {
        if (data.isMutualMatch) {
          setCelebrate(who);
          AccessibilityInfo.announceForAccessibility(`It's a match${who.name ? ` with ${who.name}` : ''}`);
        } else {
          haptics.success();
        }
      }
    },
    onError: (_err, { userId }) => {
      // Undo the optimistic mark: the request did not land, so the card must not say it did.
      setActed((a) => {
        const next = { ...a };
        delete next[userId];
        return next;
      });
      showToast.error("That didn't go through", 'Check your connection and try again.');
      AccessibilityInfo.announceForAccessibility("That didn't go through");
    },
  });
  const sendAction = actionMutation.mutate;

  const handleAction = useCallback(
    (item: ProfileSummary, action: MatchAction) => {
      const userId = item.userId;
      // Optimistic: the card shows its confirmed state (or leaves the list) on the
      // tap, and onError above puts it back if the request fails.
      setActed((a) => ({ ...a, [userId]: action }));
      sendAction({
        userId,
        action,
        who: {
          userId,
          name: [item.firstName, item.lastName].filter(Boolean).join(' '),
          photo: item.profilePhoto ?? item.photos?.[0] ?? undefined,
        },
      });
      AccessibilityInfo.announceForAccessibility(
        action === 'like' ? 'Interest sent' : action === 'shortlist' ? 'Added to your shortlist' : 'Profile passed'
      );
      // First like = the moment push notifications become genuinely useful.
      if (action === 'like') requestNotifPrime();
    },
    [sendAction]
  );

  const hasFilters = Object.keys(filters).some(
    (k) => k !== 'sort' && k !== 'limit' && isSet(filters[k as keyof SearchFilters])
  );

  // The sheet's "Show N profiles" count is only true once the list has caught up
  // with the filters. Until then the button reads plain "Apply" (and stays tappable,
  // applying immediately) rather than showing a stale or, mid-load, zero number.
  const countPending = filters !== appliedFilters || (isFetching && !isFetchingNextPage);

  const currentSort = filters.sort ?? 'compatibility';
  const sortLabel = SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? 'Compatibility';

  const onEndReached = useCallback(() => {
    // A failed page must not be retried by the scroll position alone: the list stays at the
    // end, so it would fire again and again. The footer's Try again is the retry.
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ProfileSummary }) => {
      const done = acted[item.userId];
      return (
        // The wrapper carries the exit: Animated.FlatList's own cell only handles the layout
        // move, and the card is plain Views with their own press animations.
        <Animated.View exiting={reduceMotion ? undefined : CARD_EXIT}>
          <ProfileCard
            profile={item}
            onLike={() => handleAction(item, 'like')}
            onShortlist={() => handleAction(item, 'shortlist')}
            onPass={() => handleAction(item, 'pass')}
            onPress={() => navigation.navigate('ProfileDetail', { userId: item.userId })}
            showCompatibility
            sentAction={done === 'like' || done === 'shortlist' ? done : undefined}
          />
        </Animated.View>
      );
    },
    [handleAction, navigation, acted, reduceMotion]
  );

  const renderFooter = useCallback(() => {
    // A failed next page used to stop the list silently: no message, no retry.
    if (isFetchNextPageError && !isFetchingNextPage) {
      return <PageErrorFooter onRetry={() => fetchNextPage()} />;
    }
    return <ListFooter state={isFetchingNextPage ? 'loading' : hasNextPage ? 'idle' : 'end'} endText="End of results" />;
  }, [isFetchingNextPage, isFetchNextPageError, hasNextPage, fetchNextPage]);

  return (
    <Screen edges={['top']} testID="SearchScreen">
      {/* One row: the profile-ID box and Filters. The server has no name search, so the box
          is honest about the one thing it does; Filters is an icon button beside it (its state
          is in the accessibility label and the tinted fill), not a second row of chrome. */}
      <View style={s.topRow}>
        <View style={[s.searchBar, { backgroundColor: c.surfaceCard, borderColor: c.border, minHeight: tap }]}>
          <Ionicons
            name="search"
            size={18}
            color={c.textMuted}
            style={s.searchIcon}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <TextInput
            style={[s.searchInput, searchType, { color: c.fgStrong }]}
            value={nameQuery}
            onChangeText={(v) => { setNameQuery(v); if (codeLookupError) setCodeLookupError(null); }}
            placeholder="Profile ID, e.g. TCS-A1B2C3D4"
            // textMuted is 3.4:1 on the white field; the placeholder carries the ID format, so it
            // has to pass 4.5:1 (textSecondary is 6.9:1 light, 8:1 dark).
            placeholderTextColor={c.textSecondary}
            returnKeyType="search"
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={() => { if (typedCode && !codeLookup.isPending) codeLookup.mutate(); }}
            accessibilityLabel="Profile ID"
            accessibilityRole="search"
            testID="search-input"
          />
          {/* iOS-only clearButtonMode is not a control on Android, so the clear button is ours. */}
          {nameQuery.length > 0 && (
            <PressableScale
              style={[s.clearBtn, elder && { width: tap, height: tap }]}
              onPress={() => { setNameQuery(''); setCodeLookupError(null); }}
              accessibilityRole="button"
              accessibilityLabel="Clear profile ID"
              testID="search-clear"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </PressableScale>
          )}
        </View>

        <PressableScale
          style={[
            s.filterBtn,
            { width: tap, minHeight: tap, backgroundColor: c.surface2, borderColor: c.border },
            hasFilters && { backgroundColor: c.accentSoft, borderColor: c.accent },
          ]}
          onPress={() => filterRef.current?.open()}
          accessibilityLabel={hasFilters ? 'Open filters, filters applied' : 'Open filters'}
          accessibilityRole="button"
          accessibilityState={{ selected: hasFilters }}
          // The button is `tap` (48, 60 in elder) on its own, so it needs no hitSlop; the id keeps
          // the name the tap-target audit and any harness already know it by.
          testID="filter-btn-tap44-hitslop"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="options" size={20} color={hasFilters ? c.accent : c.textSecondary} />
          {/* Active marker: the tinted fill plus a dot. The state is also in the button's
              accessibility label, so the dot is decorative. */}
          {hasFilters ? (
            <View
              style={[s.filterDot, { backgroundColor: c.accent, borderColor: c.accentSoft }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
        </PressableScale>
      </View>

      {/* Profile-ID lookup: only when what's typed could be a code */}
      {typedCode ? (
        <View style={s.codeRow}>
          <PressableScale
            style={[s.codeBtn, { borderColor: c.border, backgroundColor: c.surfaceCard, minHeight: elder ? tap : 44 }]}
            onPress={() => codeLookup.mutate()}
            disabled={codeLookup.isPending}
            accessibilityLabel={`Open profile ${formatProfileCode(typedCode)}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: codeLookup.isPending, busy: codeLookup.isPending }}
            testID="open-profile-code"
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="id-card-outline" size={16} color={c.accent} />
            <Text variant="subhead" color="fgStrong" style={s.codeText} numberOfLines={1}>
              Open profile {formatProfileCode(typedCode)}
            </Text>
            {codeLookup.isPending ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            )}
          </PressableScale>
          {codeLookupError ? (
            <Text variant="footnote" color="error" testID="code-lookup-error" accessibilityLiveRegion="polite">{codeLookupError}</Text>
          ) : null}
        </View>
      ) : nameQuery.trim().length > 0 ? (
        <View style={s.codeRow}>
          <Text variant="footnote" color="textMuted" testID="code-format-hint">
            Profile IDs look like TCS-A1B2C3D4.
          </Text>
        </View>
      ) : null}

      {/* Count left, sort right. The count is hidden at zero: the empty state below already
          says so, and showing both put "No profiles found" above the list twice. It updates
          without a tap (filters), so it is a live region. */}
      <View style={s.metaRow}>
        <View style={s.metaLeft}>
          {!isLoading && !searchFailed && total > 0 && (
            <Text
              variant="subhead"
              color="textMuted"
              numberOfLines={1}
              maxScale={1.3}
              style={s.tabular}
              accessibilityLiveRegion="polite"
            >
              {`${total.toLocaleString('en-IN')} ${total === 1 ? 'profile' : 'profiles'}`}
            </Text>
          )}
        </View>

        <PressableScale
          style={[s.sortBtn, { minHeight: toolMinHeight }]}
          onPress={() => setShowSort(true)}
          // Starts with the words on screen ("Sort: X") so Voice Control's "tap Sort" resolves.
          accessibilityLabel={`Sort: ${sortLabel}, change sort order`}
          accessibilityRole="button"
          testID="sort-btn-tap44-hitslop"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="subhead" color="textSecondary" numberOfLines={1} maxScale={1.3} style={s.sortLabel}>Sort: {sortLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={c.textSecondary} />
        </PressableScale>
      </View>

      {/* List */}
      {isLoading ? (
        <View accessible accessibilityLabel="Loading profiles" accessibilityState={{ busy: true }} style={s.flex}>
          <FlatList
            data={[1, 2, 3, 4]}
            keyExtractor={(i) => String(i)}
            renderItem={() => <CardSkeleton />}
            contentContainerStyle={[s.list, { paddingBottom: tabClearance }]}
            scrollEnabled={false}
          />
        </View>
      ) : searchFailed ? (
        // A failed request is NOT an empty result. Reporting "No profiles found"
        // when the network died tells the member the marketplace is empty — the
        // single most damaging thing this app can say while supply is thin, and
        // it is not even true. Distinguish them, and offer a retry.
        <SharedEmpty
          variant="error"
          icon="cloud-offline-outline"
          title="Couldn't load profiles"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => refetch()}
          testID="SearchScreen-error"
        />
      ) : profiles.length === 0 ? (
        <SharedEmpty
          icon="search-outline"
          title="No profiles found"
          description={hasFilters ? 'Try widening your search filters.' : 'No profiles match your search yet.'}
          actionLabel={hasFilters ? 'Reset filters' : 'Refresh'}
          onAction={hasFilters ? () => applyNow(DEFAULT_FILTERS) : () => refetch()}
          testID="SearchScreen-empty"
        />
      ) : (
        <Animated.FlatList
          {...LIST_PERF}
          // Motion only while the member acts on the list. Without this flag every card would also
          // play its exit when the whole list is swapped for the skeleton or the empty state.
          skipEnteringExitingAnimations
          itemLayoutAnimation={reduceMotion ? undefined : LIST_REFLOW}
          data={profiles}
          extraData={acted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[s.list, { paddingBottom: tabClearance }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          testID="results-list"
        />
      )}

      {/* Filter Panel */}
      <FilterPanel
        ref={filterRef}
        filters={filters}
        onChange={setFilters}
        resultCount={searchFailed || countPending ? undefined : total}
        onApply={() => setAppliedFilters(filters)}
        onReset={() => applyNow(DEFAULT_FILTERS)}
        onSaveSearch={() => setShowSaveModal(true)}
      />

      {/* Saved-search naming sheet (backend live — Phase A step 6) */}
      <SaveSearchModal
        visible={showSaveModal}
        onSave={(nm) => saveSearchMutation.mutate(nm)}
        onClose={() => { setShowSaveModal(false); setSaveError(null); }}
        saving={saveSearchMutation.isPending}
        error={saveError}
        onClearError={() => setSaveError(null)}
      />

      {/* Mutual-match reveal, the same one Matches and ProfileDetail play. */}
      <MatchCelebration
        visible={!!celebrate}
        name={celebrate?.name || undefined}
        onClose={() => setCelebrate(null)}
        onMessage={() => {
          // Straight into the thread with the person just matched, not the chat list.
          const who = celebrate;
          setCelebrate(null);
          if (who) navigation.navigate('ChatThread', { userId: who.userId, name: who.name, photo: who.photo });
        }}
      />

      {/* Sort Picker */}
      <PickerSheet<SortOption>
        visible={showSort}
        title="Sort by"
        options={SORT_OPTIONS}
        selected={currentSort}
        onSelect={(v) => applyNow({ ...filters, sort: v as SortOption })}
        onClose={() => setShowSort(false)}
      />

    </Screen>
  );
}

// Layout, spacing and radius only: every colour on this screen is applied inline from `useTheme()`.
const s = StyleSheet.create({
  flex: { flex: 1 },
  // ID box + Filters on one row. The gutter is spacing.gutter (18) like every other screen's, not
  // spacing.lg. `stretch` so the Filters button matches the field when the field grows with text size.
  topRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  // minHeight, not height: the field grows with the OS text size instead of clipping it.
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  searchIcon: { marginRight: spacing.sm },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.md },
  filterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  codeRow: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.sm, gap: 4 },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  codeText: { flex: 1 },
  // Type role is applied at render (`searchType`) so elder mode can scale it.
  // alignSelf stretch: the bar is 48pt (60 elder) but the input alone was about 38pt, so a tap on
  // the top or bottom of the visible field, or beside the icon, did not focus it.
  searchInput: {
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: spacing.sm,
  },
  // Count left, sort right. The 4pt top padding plus the 8pt under the row above keeps the sort
  // control's 12pt hitSlop from reaching into the search field.
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  // The count takes the leftover width; the Sort label gives way (ellipsis) when both cannot fit,
  // so at max text size or in elder mode on a 360dp screen the chevron is not pushed off the edge.
  metaLeft: { flex: 1, minWidth: 0 },
  // A number that changes with every filter keeps fixed digit widths so the row does not shimmy.
  tabular: { fontVariant: ['tabular-nums'] },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    marginLeft: spacing.sm,
  },
  sortLabel: { flexShrink: 1 },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing['5xl'],
  },
});
