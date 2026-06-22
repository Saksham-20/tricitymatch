import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { search } from '../../api/search';
import { performMatchAction } from '../../api/matches';
import { queryKeys } from '../../constants/queryKeys';
import ProfileCard from '../../components/cards/ProfileCard';
import FilterPanel, { type FilterPanelHandle } from '../../components/search/FilterPanel';
import type { MainStackParamList } from '../../navigation/types';
import type { SearchFilters, ProfileSummary, MatchAction } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type SortOption = NonNullable<SearchFilters['sort']>;
const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Compatibility', value: 'compatibility' },
  { label: 'Newest', value: 'newest' },
  { label: 'Recently Active', value: 'recently_active' },
];

const DEFAULT_FILTERS: SearchFilters = {
  sort: 'compatibility',
  limit: 20,
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <View style={sk.card}>
      <View style={sk.photo} />
      <View style={sk.body}>
        <View style={sk.line} />
        <View style={[sk.line, { width: '60%' }]} />
        <View style={[sk.line, { width: '40%', marginTop: spacing.sm }]} />
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  card: {
    backgroundColor: colours.surfaceCard,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  photo: { height: 240, backgroundColor: colours.border },
  body: { padding: spacing.md, gap: 8 },
  line: { height: 14, backgroundColor: colours.border, borderRadius: 7, width: '80%' },
});

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <View style={em.container}>
      <Ionicons name="search" size={56} color={colours.border} />
      <Text style={em.title}>No profiles found</Text>
      <Text style={em.sub}>
        {hasFilters
          ? 'Try widening your search filters.'
          : 'No profiles match your search yet.'}
      </Text>
      {hasFilters && (
        <TouchableOpacity style={em.btn} onPress={onReset}>
          <Text style={em.btnText}>Reset Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const em = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  title: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginTop: spacing.lg },
  sub: { fontSize: typography.fontSize.base, color: colours.textSecondary, fontFamily: typography.fontFamily.regular, textAlign: 'center', marginTop: spacing.sm },
  btn: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colours.primary },
  btnText: { color: colours.primary, fontFamily: typography.fontFamily.semiBold, fontSize: typography.fontSize.sm },
});

// ─── Sort Picker Modal ────────────────────────────────────────────────────────

function SortPicker({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: SortOption;
  onSelect: (v: SortOption) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={sp.backdrop} onPress={onClose} activeOpacity={1}>
        <View style={sp.sheet}>
          <Text style={sp.title}>Sort By</Text>
          {SORT_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={sp.option}
              onPress={() => { onSelect(o.value); onClose(); }}
            >
              <Text style={[sp.optLabel, current === o.value && sp.optActive]}>{o.label}</Text>
              {current === o.value && <Ionicons name="checkmark" size={18} color={colours.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
const sp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colours.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.md },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  optLabel: { fontSize: typography.fontSize.base, color: colours.textSecondary, fontFamily: typography.fontFamily.regular },
  optActive: { color: colours.primary, fontFamily: typography.fontFamily.semiBold },
});

// ─── Save Search Modal ────────────────────────────────────────────────────────

function SaveSearchModal({
  visible,
  onSave,
  onClose,
}: {
  visible: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ss.backdrop} onPress={onClose} activeOpacity={1}>
        <View style={ss.sheet} onStartShouldSetResponder={() => true}>
          <Text style={ss.title}>Save Search</Text>
          <TextInput
            style={ss.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Punjabi Doctor in Chandigarh"
            placeholderTextColor={colours.textMuted}
            returnKeyType="done"
            accessibilityLabel="Search name"
          />
          <View style={ss.row}>
            <TouchableOpacity style={ss.cancelBtn} onPress={onClose}>
              <Text style={ss.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ss.saveBtn, !name.trim() && { opacity: 0.5 }]}
              onPress={() => { if (name.trim()) { onSave(name.trim()); setName(''); } }}
              disabled={!name.trim()}
            >
              <Text style={ss.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
const ss = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colours.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.bold, color: colours.textPrimary, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colours.border, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
  cancelText: { color: colours.textSecondary, fontFamily: typography.fontFamily.medium, fontSize: typography.fontSize.base },
  saveBtn: { flex: 1, backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
  saveText: { color: '#fff', fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.base },
});

// ─── SearchScreen ─────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const filterRef = useRef<FilterPanelHandle>(null);

  const [nameQuery, setNameQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showSort, setShowSort] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // ── Infinite query ──────────────────────────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['search', filters, nameQuery],
    queryFn: ({ pageParam }) =>
      search({ ...filters, cursor: pageParam as string | undefined, ...(nameQuery ? { name: nameQuery } : {}) } as any),
    getNextPageParam: (last: any) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const profiles: ProfileSummary[] = data?.pages.flatMap((p) => p.profiles) ?? [];
  const total: number = data?.pages[0]?.total ?? 0;

  // Saved-searches have no backend yet — the save UI is hidden. See CLAUDE.md Known Issues.

  // ── Match actions ───────────────────────────────────────────────────────
  const actionMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: MatchAction }) =>
      performMatchAction(userId, action),
  });

  const handleAction = useCallback(
    (userId: string, action: MatchAction) => {
      actionMutation.mutate({ userId, action });
    },
    [actionMutation]
  );

  const hasFilters = Object.keys(filters).some(
    (k) => k !== 'sort' && k !== 'limit' && filters[k as keyof SearchFilters] !== undefined
  );

  const currentSort = filters.sort ?? 'compatibility';
  const sortLabel = SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? 'Compatibility';

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ProfileSummary }) => (
      <ProfileCard
        profile={item}
        onLike={() => handleAction(item.userId, 'like')}
        onShortlist={() => handleAction(item.userId, 'shortlist')}
        onPass={() => handleAction(item.userId, 'pass')}
        onPress={() => navigation.navigate('ProfileDetail', { userId: item.userId })}
        showCompatibility
      />
    ),
    [handleAction, navigation]
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={s.loadMore}>
        <ActivityIndicator color={colours.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <View style={[s.container, { paddingTop: insets.top }]} testID="SearchScreen">
      {/* Search Bar */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color={colours.textMuted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          value={nameQuery}
          onChangeText={setNameQuery}
          placeholder="Search profiles..."
          placeholderTextColor={colours.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search profiles by name"
          testID="search-input"
        />
      </View>

      {/* Filter + Sort row */}
      <View style={s.toolbar}>
        <View style={s.toolbarLeft}>
          <TouchableOpacity
            style={[s.toolBtn, hasFilters && s.toolBtnActive]}
            onPress={() => filterRef.current?.open()}
            accessibilityLabel="Open filters"
            testID="filter-btn"
          >
            <Ionicons
              name="options"
              size={16}
              color={hasFilters ? colours.primary : colours.textSecondary}
            />
            <Text style={[s.toolBtnText, hasFilters && { color: colours.primary }]}>
              Filters{hasFilters ? ' •' : ''}
            </Text>
          </TouchableOpacity>

        </View>

        <TouchableOpacity
          style={s.sortBtn}
          onPress={() => setShowSort(true)}
          accessibilityLabel="Sort options"
          testID="sort-btn"
        >
          <Text style={s.sortText}>Sort: {sortLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={colours.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Result count */}
      {!isLoading && (
        <View style={s.countRow}>
          <Text style={s.countText}>
            {total > 0 ? `${total} profiles found` : 'No profiles found'}
          </Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <CardSkeleton />}
          contentContainerStyle={s.list}
          scrollEnabled={false}
        />
      ) : profiles.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          testID="results-list"
        />
      )}

      {/* Filter Panel */}
      <FilterPanel
        ref={filterRef}
        filters={filters}
        onChange={setFilters}
        resultCount={total}
        onApply={() => refetch()}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Sort Picker */}
      <SortPicker
        visible={showSort}
        current={currentSort}
        onSelect={(v) => {
          setFilters((f) => ({ ...f, sort: v }));
          refetch();
        }}
        onClose={() => setShowSort(false)}
      />

    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.surfaceCard,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colours.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.regular,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  toolbarLeft: { flexDirection: 'row', gap: spacing.sm },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.background,
  },
  toolBtnActive: { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  toolBtnText: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sortText: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  countRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  countText: {
    fontSize: typography.fontSize.sm,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing['5xl'],
  },
  loadMore: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
