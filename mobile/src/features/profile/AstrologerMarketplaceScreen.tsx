import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getAstrologers } from '../../api/profile';
import type { Astrologer } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';

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
  return (
    <TouchableOpacity style={c.card} onPress={onPress} activeOpacity={0.8}>
      {/* Avatar + Online */}
      <View style={c.avatarWrap}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={c.avatar} />
        ) : (
          <View style={c.avatarPlaceholder}>
            <Text style={c.avatarInitial}>{item.name.charAt(0)}</Text>
          </View>
        )}
        {item.isOnline && <View style={c.onlineDot} />}
      </View>

      {/* Info */}
      <View style={c.info}>
        <Text style={c.name}>{item.name}</Text>
        <Text style={c.experience}>{item.experience} yrs exp · {item.languages.join(', ')}</Text>

        {/* Specialities */}
        <View style={c.chips}>
          {item.speciality.slice(0, 2).map(s => (
            <View key={s} style={c.chip}>
              <Ionicons name={SPECIALITY_ICONS[s] ?? 'star-outline'} size={11} color={colours.primary} />
              <Text style={c.chipText}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Rating + Price */}
        <View style={c.footer}>
          <View style={c.ratingRow}>
            <Ionicons name="star" size={12} color={colours.secondary} />
            <Text style={c.rating}>{item.rating} ({item.reviewCount})</Text>
          </View>
          <Text style={c.price}>₹{item.pricePerMin}/min</Text>
        </View>

        {!item.isOnline && item.nextAvailable && (
          <Text style={c.nextAvail}>Next: {item.nextAvailable}</Text>
        )}
      </View>

      {/* CTA — online: filled primary "Chat"; offline: outlined secondary "Book"
          (a bordered pill, not bare grey text that reads as unstyled). */}
      <View
        style={[
          c.cta,
          item.isOnline
            ? { backgroundColor: colours.primary }
            : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colours.primary },
        ]}
      >
        <Text style={[c.ctaText, { color: item.isOnline ? '#fff' : colours.primary }]}>
          {item.isOnline ? 'Chat' : 'Book'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AstrologerMarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [filter, setFilter] = useState<'all' | 'online'>('all');

  // No stub fallback. The listing previously substituted four invented
  // astrologers — names, ratings, review counts and prices — whenever the API
  // returned an empty list. Fabricated practitioners with fabricated credentials
  // are not placeholder copy; they shipped as if real. The endpoint works and
  // returns real records where the table is seeded, so an empty list means
  // "none onboarded here yet", not "feature missing".
  const { data, isLoading } = useQuery({
    queryKey: ['astrologers'],
    queryFn: getAstrologers,
  });

  const filtered = filter === 'online' ? (data ?? []).filter(a => a.isOnline) : (data ?? []);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>Astrologer Consult</Text>
          <Text style={s.subtitle}>Expert Vedic guidance for your match</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Banner */}
      <View style={s.banner}>
        <Ionicons name="planet-outline" size={28} color={colours.primary} style={s.bannerEmoji} />
        <View style={s.bannerText}>
          <Text style={s.bannerTitle}>Get a Kundli reading</Text>
          <Text style={s.bannerBody}>Consult certified Vedic astrologers for marriage timing and compatibility.</Text>
        </View>
      </View>

      {/* Filter Pills */}
      <View style={s.pills}>
        {(['all', 'online'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.pill, filter === f && s.pillActive]}
            onPress={() => setFilter(f)}
          >
            {f === 'online' && <View style={s.pillDot} />}
            <Text style={[s.pillText, filter === f && s.pillTextActive]}>
              {f === 'all' ? 'All Astrologers' : 'Online Now'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colours.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
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
              <Ionicons name="moon-outline" size={48} color={colours.textMuted} />
              <Text style={s.emptyText}>
                {filter === 'online'
                  ? 'No astrologers online right now'
                  : 'Astrologer consultations are coming soon'}
              </Text>
              {filter === 'all' && (
                <Text style={s.emptySub}>
                  We are onboarding certified Vedic astrologers. Check back shortly.
                </Text>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colours.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colours.border },
  headerText:  { flex: 1, alignItems: 'center' },
  title:       { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  subtitle:    { fontSize: typography.fontSize.xs, color: colours.textSecondary },

  banner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.secondaryLight, margin: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm },
  bannerEmoji: { fontSize: 32 },
  bannerText:  { flex: 1 },
  bannerTitle: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  bannerBody:  { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginTop: 2 },

  pills:       { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colours.border },
  pillActive:  { backgroundColor: colours.primary, borderColor: colours.primary },
  pillDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: colours.success },
  pillText:    { fontSize: typography.fontSize.sm, color: colours.textSecondary },
  pillTextActive: { color: '#fff', fontFamily: typography.fontFamily.medium },

  empty:       { alignItems: 'center', paddingVertical: 60, gap: spacing.sm },
  emptyText:   { fontSize: typography.fontSize.base, color: colours.textMuted },
  emptySub:    { fontSize: typography.fontSize.sm, color: colours.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl },
});

const c = StyleSheet.create({
  card:            { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surfaceCard, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  avatarWrap:      { position: 'relative' },
  avatar:          { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: colours.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarInitial:   { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colours.primary },
  onlineDot:       { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: colours.success, borderWidth: 2, borderColor: colours.surfaceCard },

  info:       { flex: 1 },
  name:       { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  experience: { fontSize: typography.fontSize.xs, color: colours.textSecondary, marginTop: 1 },

  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colours.primaryLight, borderRadius: borderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  chipText:   { fontSize: 10, color: colours.primary },

  footer:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating:     { fontSize: typography.fontSize.xs, color: colours.textSecondary },
  price:      { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: colours.secondary },
  nextAvail:  { fontSize: typography.fontSize.xs, color: colours.textMuted, marginTop: 2 },

  cta:        { borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'center', minWidth: 48 },
  ctaText:    { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },
});
