import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { getHoroscopeCompatibility } from '../../api/profile';
import type { GunaDetail } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'HoroscopeMatch'>;

const GUNA_COLOURS: Record<string, string> = {
  nadi:    '#EF4444',
  bhakoot: '#F59E0B',
  gana:    '#8B5CF6',
  maitri:  '#3B82F6',
  yoni:    '#10B981',
  tara:    '#06B6D4',
  vashya:  '#C9A227',
  varna:   '#6B7280',
};

function GunaBar({
  name, score, max, detail, colour,
}: {
  name: string; score: number | null; max: number; detail: string; colour: string;
}) {
  const pct = score !== null ? (score / max) * 100 : 0;
  const isNull = score === null;
  const scoreLabel = isNull ? '?' : `${score}/${max}`;
  const barColour = isNull ? colours.textMuted : (pct >= 60 ? colour : (pct >= 30 ? colours.warning : colours.error));

  return (
    <View style={g.row}>
      <View style={g.labelCol}>
        <Text style={g.name}>{name}</Text>
        <Text style={g.detail} numberOfLines={1}>{detail}</Text>
      </View>
      <View style={g.barCol}>
        <View style={g.track}>
          <View style={[g.fill, { width: `${isNull ? 0 : pct}%`, backgroundColor: barColour }]} />
        </View>
        <Text style={[g.scoreLabel, { color: barColour }]}>{scoreLabel}</Text>
      </View>
    </View>
  );
}

function DoshaTag({ label, present }: { label: string; present: boolean }) {
  if (!present) return null;
  return (
    <View style={d.tag}>
      <Ionicons name="warning" size={12} color={colours.warning} />
      <Text style={d.tagText}>{label}</Text>
    </View>
  );
}

export default function HoroscopeMatchScreen() {
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { userId, name } = route.params;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['horoscope-match', userId],
    queryFn: () => getHoroscopeCompatibility(userId),
  });

  const renderScore = () => {
    if (!data) return null;
    const { ashtakoot, rashiScore, manglikCompatible, manglikDetail, summary } = data;

    const score36 = ashtakoot?.rawOut36 ?? null;
    const interpretation = ashtakoot?.interpretation ?? '';
    const pct = score36 !== null ? Math.round((score36 / 36) * 100) : null;

    const scoreColour = pct === null ? colours.textMuted
      : pct >= 78 ? colours.success
      : pct >= 67 ? colours.info
      : pct >= 50 ? colours.warning
      : colours.error;

    return (
      <>
        {/* Overall Score Ring */}
        <View style={s.scoreCard}>
          <View style={[s.ring, { borderColor: scoreColour }]}>
            <Text style={[s.scoreNum, { color: scoreColour }]}>
              {score36 !== null ? `${score36}` : '—'}
            </Text>
            <Text style={s.scoreOf}>{score36 !== null ? '/36' : 'N/A'}</Text>
          </View>
          <View style={s.scoreInfo}>
            <Text style={s.interp}>{interpretation || (rashiScore !== null ? 'Rashi Based' : 'Incomplete Data')}</Text>
            <Text style={s.summary}>{summary}</Text>
          </View>
        </View>

        {/* Doshas */}
        {ashtakoot && (
          <View style={s.doshaRow}>
            <DoshaTag label="Nadi Dosha" present={ashtakoot.hasNadiDosha} />
            <DoshaTag label="Bhakoot Dosha" present={ashtakoot.hasBhakootDosha} />
            <DoshaTag label="Gana Dosha" present={ashtakoot.hasGanaDosha} />
            {!manglikCompatible && <DoshaTag label="Manglik Dosha" present={true} />}
          </View>
        )}

        {/* Manglik Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Manglik Compatibility</Text>
          <View style={[s.manglikBadge, { backgroundColor: manglikCompatible ? colours.successBg : colours.errorBg }]}>
            <Ionicons
              name={manglikCompatible ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={manglikCompatible ? colours.success : colours.error}
            />
            <Text style={[s.manglikText, { color: manglikCompatible ? colours.success : colours.error }]}>
              {manglikDetail}
            </Text>
          </View>
        </View>

        {/* Ashtakoot Guna Breakdown */}
        {ashtakoot ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Ashtakoot Guna Milan</Text>
            <Text style={s.sectionSub}>8 gunas · max 36 points</Text>
            {(Object.entries(ashtakoot.gunas) as [string, GunaDetail][])
              .sort(([, a], [, b]) => b.max - a.max) // nadi (8) first
              .map(([key, guna]) => (
                <GunaBar
                  key={key}
                  name={guna.name}
                  score={guna.score}
                  max={guna.max}
                  detail={guna.detail}
                  colour={GUNA_COLOURS[key] ?? colours.primary}
                />
              ))}
          </View>
        ) : rashiScore !== null ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Rashi Compatibility</Text>
            <Text style={s.sectionSub}>Nakshatra not provided — using Rashi as fallback</Text>
            <View style={s.rashiRow}>
              <View style={[s.rashiBar, { width: `${rashiScore}%`, backgroundColor: scoreColour }]} />
              <Text style={[s.rashiPct, { color: scoreColour }]}>{rashiScore}%</Text>
            </View>
          </View>
        ) : (
          <View style={s.emptySection}>
            <Ionicons name="moon-outline" size={40} color={colours.textMuted} />
            <Text style={s.emptyTitle}>Nakshatra details missing</Text>
            <Text style={s.emptyBody}>
              Ask {name} to complete their horoscope details (nakshatra, rashi, manglik status) for a full Guna Milan analysis.
            </Text>
          </View>
        )}

        {/* Disclaimer */}
        <Text style={s.disclaimer}>
          * Ashtakoot is a traditional Vedic system. Consider consulting a qualified jyotishi for life decisions.
        </Text>
      </>
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Kundli Match</Text>
          <Text style={s.headerSub}>{name}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colours.primary} />
            <Text style={s.loadingText}>Calculating Guna Milan…</Text>
          </View>
        ) : isError ? (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colours.error} />
            <Text style={s.errorText}>Could not load horoscope data</Text>
          </View>
        ) : renderScore()}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colours.background },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colours.border },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  headerSub:    { fontSize: typography.fontSize.sm, color: colours.textSecondary },
  scroll:       { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 3 },
  loadingText:  { marginTop: spacing.md, fontSize: typography.fontSize.base, color: colours.textSecondary },
  errorText:    { marginTop: spacing.sm, fontSize: typography.fontSize.base, color: colours.error, textAlign: 'center' },

  scoreCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surfaceCard, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.md },
  ring:         { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreNum:     { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold },
  scoreOf:      { fontSize: typography.fontSize.xs, color: colours.textMuted, marginTop: -4 },
  scoreInfo:    { flex: 1 },
  interp:       { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary, marginBottom: 4 },
  summary:      { fontSize: typography.fontSize.sm, color: colours.textSecondary, lineHeight: 18 },

  doshaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },

  section:      { marginBottom: spacing.lg },
  sectionTitle: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary, marginBottom: 2 },
  sectionSub:   { fontSize: typography.fontSize.xs, color: colours.textMuted, marginBottom: spacing.sm },

  manglikBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: borderRadius.md, padding: spacing.sm },
  manglikText:  { flex: 1, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium },

  rashiRow:     { height: 24, backgroundColor: colours.surfaceCard, borderRadius: 12, overflow: 'hidden', marginTop: spacing.sm, position: 'relative' },
  rashiBar:     { height: '100%', borderRadius: 12 },
  rashiPct:     { position: 'absolute', right: spacing.sm, top: 3, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold },

  emptySection: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle:   { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textSecondary },
  emptyBody:    { fontSize: typography.fontSize.sm, color: colours.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg },

  disclaimer:   { fontSize: typography.fontSize.xs, color: colours.textMuted, textAlign: 'center', marginTop: spacing.lg, fontStyle: 'italic' },
});

const g = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  labelCol:  { width: 100 },
  name:      { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.medium, color: colours.textPrimary },
  detail:    { fontSize: typography.fontSize.xs, color: colours.textMuted },
  barCol:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track:     { flex: 1, height: 8, backgroundColor: colours.surfaceCard, borderRadius: 4, overflow: 'hidden' },
  fill:      { height: '100%', borderRadius: 4 },
  scoreLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.semiBold, width: 32, textAlign: 'right' },
});

const d = StyleSheet.create({
  tag:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colours.secondaryLight, borderRadius: borderRadius.sm, paddingHorizontal: spacing.xs, paddingVertical: 3 },
  tagText: { fontSize: typography.fontSize.xs, color: colours.warning, fontFamily: typography.fontFamily.medium },
});
