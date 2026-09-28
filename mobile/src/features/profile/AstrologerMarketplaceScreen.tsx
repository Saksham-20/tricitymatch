import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  AccessibilityInfo,
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { useQuery } from '@tanstack/react-query';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import Text from '../../components/ui/Text';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { tapSize } from '../../utils/elderTheme';
import { getAstrologers } from '../../api/profile';
import type { Astrologer } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';
import { LIST_PERF } from '../../constants/listPerf';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const SPECIALITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Kundli Matching': 'planet-outline',
  'Marriage Timing': 'heart-outline',
  'Career': 'briefcase-outline',
  'Numerology': 'calculator-outline',
  'Vastu': 'home-outline',
  'Gemstone': 'diamond-outline',
};

/** Rating as the record carries it. Only shown once someone has actually rated. */
const formatRating = (rating: number) => Number(rating).toFixed(1);

function AstrologerCard({ item, onPress }: { item: Astrologer; onPress: () => void }) {
  const { c } = useTheme();
  const cs = React.useMemo(() => makeCs(c), [c]);
  const hasRating = item.reviewCount > 0;
  const languages = item.languages ?? [];
  const specialities = item.speciality ?? [];
  const spoken = [
    item.name,
    item.isOnline ? 'online now' : 'offline',
    item.experience ? `${item.experience} years experience` : null,
    hasRating ? `rated ${formatRating(item.rating)} from ${item.reviewCount} ${item.reviewCount === 1 ? 'review' : 'reviews'}` : null,
    `₹${item.pricePerMin} per minute`,
  ].filter(Boolean).join(', ');

  return (
    <PressableScale
      style={cs.press}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens their profile and prices"
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {/* Card owns the elevation (shadow only), so the row declares it once. */}
      <Card padded={false} style={cs.card}>
        {/* photo, or the brand initials when the record has none / it fails to load */}
        <Avatar uri={item.avatarUrl} name={item.name} size={60} online={item.isOnline} />

        {/* Info */}
        <View style={cs.info}>
          <Text variant="headline" color="textPrimary">{item.name}</Text>
          {(item.experience || languages.length > 0) ? (
            <Text variant="caption" color="textSecondary" style={cs.experience}>
              {[item.experience ? `${item.experience} yrs exp` : null, languages.join(', ') || null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}

          {/* Specialities */}
          <View style={cs.chips}>
            {specialities.slice(0, 2).map(s => (
              <View key={s} style={cs.chip}>
                <Ionicons name={SPECIALITY_ICONS[s] ?? 'star-outline'} size={11} color={c.accent} />
                <Text variant="micro" color="primary">{s}</Text>
              </View>
            ))}
          </View>

          {/* Rating + Price. No reviews yet means no rating row: "0 (0)" reads as
              a bad score, not as "not rated". */}
          <View style={cs.footer}>
            {hasRating ? (
              <View style={cs.ratingRow}>
                {/* neutral: a rating is a score, and gold is the premium signal */}
                <Ionicons name="star" size={12} color={c.textSecondary} />
                <Text variant="caption" color="textSecondary">{formatRating(item.rating)} ({item.reviewCount})</Text>
              </View>
            ) : <View />}
            <Text variant="caption" color="fgStrong">₹{item.pricePerMin}/min</Text>
          </View>

          {/* Availability in words too: the green dot on the photo is colour-only. */}
          {item.isOnline ? (
            <Text variant="caption" color="textSecondary" style={cs.nextAvail}>Online now</Text>
          ) : item.nextAvailable ? (
            <Text variant="caption" color="textSecondary" style={cs.nextAvail}>Next: {item.nextAvailable}</Text>
          ) : null}
        </View>

        {/* Both states lead to the same profile screen, so the affordance is one
            honest label. It used to read "Chat" for online astrologers, but there is
            no astrologer chat, and it read "Book" until booking moved to the
            website: this opens their profile and prices, which is what "View" says. */}
        <View style={cs.cta}>
          <Text variant="caption" color="primary">View</Text>
        </View>
      </Card>
    </PressableScale>
  );
}

export default function AstrologerMarketplaceScreen() {
  const { c, elder } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = useState<'all' | 'online'>('all');

  // No stub fallback. The listing previously substituted four invented
  // astrologers — names, ratings, review counts and prices — whenever the API
  // returned an empty list. Fabricated practitioners with fabricated credentials
  // are not placeholder copy; they shipped as if real. The endpoint works and
  // returns real records where the table is seeded, so an empty list means
  // "none onboarded here yet", not "feature missing".
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['astrologers'],
    queryFn: getAstrologers,
  });

  const all = data ?? [];
  const filtered = filter === 'online' ? all.filter(a => a.isOnline) : all;

  // Finished loading with no list at all is a failed (or paused, offline) fetch,
  // whether or not react-query has flagged it isError: an offline member's query
  // is paused, and falling through to "No astrologers listed yet" would say
  // nobody is listed when the truth is we could not ask.
  const loadFailed = !isLoading && !data;
  // The skeleton being replaced by an error card appears without a tap, so it is
  // announced; a screen-reader member would otherwise keep waiting on a load
  // that has already given up.
  useEffect(() => {
    if (loadFailed) {
      AccessibilityInfo.announceForAccessibility("Couldn't load astrologers. Check your connection and try again.");
    }
  }, [loadFailed]);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title="Astrologer consult"
        subtitle="Vedic guidance for your match"
        testID="AstrologerMarketplace-header"
      />

      {/* Banner: one muted info panel, not a gold-tinted card (gold is premium only).
          "Certified" is gone with the rest of the credential claims: nothing on
          the record says who certified whom. */}
      <View style={s.banner}>
        {/* decorative: the headline beside it says what this is */}
        <Ionicons
          name="planet-outline"
          size={28}
          color={c.accent}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={s.bannerText}>
          <Text variant="headline" color="textPrimary">Get a Kundli reading</Text>
          <Text variant="caption" color="textSecondary" style={s.bannerBody}>Consult Vedic astrologers about marriage timing and compatibility.</Text>
        </View>
      </View>

      {/* Filter pills: 32pt visual + 6pt slop = 44pt tall, 4pt side slop stays inside the 8pt gap */}
      <View style={s.pills} accessibilityRole="radiogroup" accessibilityLabel="Filter astrologers">
        {(['all', 'online'] as const).map(f => (
          <PressableScale
            key={f}
            style={[s.pill, filter === f && s.pillActive, elder ? { minHeight: tapSize(true) } : null]}
            onPress={() => setFilter(f)}
            testID={`astrologer-filter-${f}-tap44-hitslop`}
            accessibilityRole="radio"
            accessibilityLabel={f === 'all' ? 'All astrologers' : 'Online now'}
            accessibilityState={{ checked: filter === f }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {f === 'online' && <View style={s.pillDot} />}
            <Text variant="subhead" color={filter === f ? 'primary' : 'textSecondary'}>
              {f === 'all' ? 'All astrologers' : 'Online now'}
            </Text>
          </PressableScale>
        ))}
      </View>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : !data ? (
        // A failed fetch must not fall through to the "none listed" empty state
        // below: that copy says nobody is listed yet, which is a different
        // statement from "we could not reach the server".
        <EmptyState
          variant="error"
          icon="cloud-offline-outline"
          title="Couldn't load astrologers"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => refetch()}
          testID="AstrologerMarketplace-error"
        />
      ) : (
        <FlatList
          {...LIST_PERF}
          data={filtered}
          keyExtractor={a => a.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <AstrologerCard
              item={item}
              onPress={() => nav.navigate('AstrologerDetail', { astrologerId: item.id, astrologerName: item.name })}
            />
          )}
          ListEmptyComponent={
            all.length === 0 ? (
              <EmptyState
                icon="moon-outline"
                title="No astrologers listed yet"
                description="Astrologers will appear here once they are listed."
                actionLabel="Refresh"
                onAction={() => refetch()}
                testID="AstrologerMarketplace-empty"
              />
            ) : (
              <EmptyState
                icon="moon-outline"
                title="No astrologers online right now"
                description="Check back later, or see everyone who is listed."
                actionLabel="Show all astrologers"
                onAction={() => setFilter('all')}
                testID="AstrologerMarketplace-empty-online"
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  banner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface2, margin: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm },
  bannerText:  { flex: 1 },
  bannerBody:  { marginTop: 2 },

  pills:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: c.border },
  // the same selected treatment as the shared Chip: soft accent fill + accent edge, never a flat burgundy slab
  pillActive:  { backgroundColor: c.accentSoft, borderColor: c.accent },
  // successAccent, not success: the plain green is unreadable on a dark surface
  pillDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: c.successAccent },

  listContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
});

const makeCs = (c: ThemeColours) => StyleSheet.create({
  press:      { marginBottom: spacing.sm },
  card:       { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },

  info:       { flex: 1 },
  experience: { marginTop: 1 },

  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.accentSoft, borderRadius: borderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },

  footer:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nextAvail:  { marginTop: 2 },

  cta:        { backgroundColor: c.accentSoft, borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'center', minWidth: 48 },
});
