import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ListSkeleton } from '../../components/ui/skeletons';
import { useQuery } from '@tanstack/react-query';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import Screen from '../../components/layout/Screen';
import Text from '../../components/ui/Text';
import EmptyState from '../../components/ui/EmptyState';
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


function AstrologerCard({ item, onPress }: { item: Astrologer; onPress: () => void }) {
  const { c } = useTheme();
  const cs = React.useMemo(() => makeCs(c), [c]);
  return (
    <PressableScale
      style={cs.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.isOnline ? 'online now' : 'offline'}, ₹${item.pricePerMin} per minute`}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {/* Avatar + Online */}
      <View style={cs.avatarWrap}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={cs.avatar} />
        ) : (
          <View style={cs.avatarPlaceholder}>
            <Text variant="title3" color="primary">{item.name.charAt(0)}</Text>
          </View>
        )}
        {item.isOnline && <View style={cs.onlineDot} />}
      </View>

      {/* Info */}
      <View style={cs.info}>
        <Text variant="headline" color="textPrimary">{item.name}</Text>
        <Text variant="caption" color="textSecondary" style={cs.experience}>{item.experience} yrs exp · {item.languages.join(', ')}</Text>

        {/* Specialities */}
        <View style={cs.chips}>
          {item.speciality.slice(0, 2).map(s => (
            <View key={s} style={cs.chip}>
              <Ionicons name={SPECIALITY_ICONS[s] ?? 'star-outline'} size={11} color={c.primary} />
              <Text variant="micro" color="primary">{s}</Text>
            </View>
          ))}
        </View>

        {/* Rating + Price */}
        <View style={cs.footer}>
          <View style={cs.ratingRow}>
            <Ionicons name="star" size={12} color={c.secondary} />
            <Text variant="caption" color="textSecondary">{item.rating} ({item.reviewCount})</Text>
          </View>
          <Text variant="caption" style={cs.price}>₹{item.pricePerMin}/min</Text>
        </View>

        {!item.isOnline && item.nextAvailable && (
          <Text variant="caption" color="textMuted" style={cs.nextAvail}>Next: {item.nextAvailable}</Text>
        )}
      </View>

      {/* CTA — online: filled primary "Chat"; offline: outlined secondary "Book"
          (a bordered pill, not bare grey text that reads as unstyled). */}
      <View
        style={[
          cs.cta,
          item.isOnline
            ? { backgroundColor: c.primary }
            : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.primary },
        ]}
      >
        <Text variant="caption" color={item.isOnline ? 'onPrimary' : 'primary'}>
          {item.isOnline ? 'Chat' : 'Book'}
        </Text>
      </View>
    </PressableScale>
  );
}

export default function AstrologerMarketplaceScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = useState<'all' | 'online'>('all');

  // No stub fallback. The listing previously substituted four invented
  // astrologers — names, ratings, review counts and prices — whenever the API
  // returned an empty list. Fabricated practitioners with fabricated credentials
  // are not placeholder copy; they shipped as if real. The endpoint works and
  // returns real records where the table is seeded, so an empty list means
  // "none onboarded here yet", not "feature missing".
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['astrologers'],
    queryFn: getAstrologers,
  });

  const filtered = filter === 'online' ? (data ?? []).filter(a => a.isOnline) : (data ?? []);

  return (
    <Screen edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <PressableScale
          onPress={() => nav.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
        <View style={s.headerText}>
          <Text variant="headline" color="textPrimary">Astrologer Consult</Text>
          <Text variant="caption" color="textSecondary">Expert Vedic guidance for your match</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Banner */}
      <View style={s.banner}>
        <Ionicons name="planet-outline" size={28} color={c.primary} style={s.bannerEmoji} />
        <View style={s.bannerText}>
          <Text variant="headline" color="textPrimary">Get a Kundli reading</Text>
          <Text variant="caption" color="textSecondary" style={s.bannerBody}>Consult certified Vedic astrologers for marriage timing and compatibility.</Text>
        </View>
      </View>

      {/* Filter Pills */}
      <View style={s.pills}>
        {(['all', 'online'] as const).map(f => (
          <PressableScale
            key={f}
            style={[s.pill, filter === f && s.pillActive]}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {f === 'online' && <View style={s.pillDot} />}
            <Text variant="subhead" color={filter === f ? 'onPrimary' : 'textSecondary'}>
              {f === 'all' ? 'All Astrologers' : 'Online Now'}
            </Text>
          </PressableScale>
        ))}
      </View>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError && !data ? (
        // A failed fetch must not fall through to the "coming soon" empty state
        // below: that copy claims the feature has no practitioners yet, which is
        // a different statement from "we could not reach the server".
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
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
          renderItem={({ item }) => (
            <AstrologerCard
              item={item}
              onPress={() => nav.navigate('AstrologerDetail', { astrologerId: item.id, astrologerName: item.name })}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="moon-outline" size={48} color={c.textMuted} />
              <Text variant="callout" color="textMuted">
                {filter === 'online'
                  ? 'No astrologers online right now'
                  : 'Astrologer consultations are coming soon'}
              </Text>
              {filter === 'all' && (
                <Text variant="subhead" color="textMuted" style={s.emptySub}>
                  We are onboarding certified Vedic astrologers. Check back shortly.
                </Text>
              )}
            </View>
          }
        />
      )}
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  headerText:  { flex: 1, alignItems: 'center' },

  banner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: c.secondaryLight, margin: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm },
  bannerEmoji: { fontSize: 32 },
  bannerText:  { flex: 1 },
  bannerBody:  { marginTop: 2 },

  pills:       { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: c.border },
  pillActive:  { backgroundColor: c.primary, borderColor: c.primary },
  pillDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: c.success },

  empty:       { alignItems: 'center', paddingVertical: 60, gap: spacing.sm },
  emptySub:    { textAlign: 'center', paddingHorizontal: spacing.xl },
});

const makeCs = (c: ThemeColours) => StyleSheet.create({
  card:            { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceCard, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  avatarWrap:      { position: 'relative' },
  avatar:          { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  onlineDot:       { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: c.success, borderWidth: 2, borderColor: c.surfaceCard },

  info:       { flex: 1 },
  experience: { marginTop: 1 },

  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.primaryLight, borderRadius: borderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },

  footer:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // c.secondary is the gold token — never curated as a text colour (premium/VIP signal
  // only, per doctrine). Kept as an explicit style override.
  price:      { color: c.secondary },
  nextAvail:  { marginTop: 2 },

  cta:        { borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'center', minWidth: 48 },
});
