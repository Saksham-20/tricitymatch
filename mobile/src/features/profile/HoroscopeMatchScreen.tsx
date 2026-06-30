import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colours, type, spacing, borderRadius } from '@shared/constants/theme';
import { getHoroscopeCompatibility } from '../../api/profile';
import type { GunaDetail } from '../../api/profile';
import { CompatRing } from '../../components/ui';
import { useFillAnimation } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'HoroscopeMatch'>;

// Brand guna fill: strong = burgundy, mid = warning, weak = destructive (no rainbow).
function gunaColour(pct: number, isNull: boolean): string {
  if (isNull) return colours.textMuted;
  if (pct >= 60) return colours.p500;
  if (pct >= 30) return colours.warning;
  return colours.error;
}

function GunaBar({ name, score, max, detail, index = 0 }: { name: string; score: number | null; max: number; detail: string; index?: number }) {
  const { c } = useTheme();
  const pct = score !== null ? (score / max) * 100 : 0;
  const isNull = score === null;
  const scoreLabel = isNull ? '?' : `${score}/${max}`;
  const barColour = gunaColour(pct, isNull);
  // koota bars stagger 40ms each (handoff motion spec)
  const progress = useFillAnimation(isNull ? 0 : pct, { delayMs: index * 40 });
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View style={g.row}>
      <View style={g.labelCol}>
        <Text style={[g.name, { color: c.fgStrong }]}>{name}</Text>
        <Text style={[g.detail, { color: c.textMuted }]} numberOfLines={1}>{detail}</Text>
      </View>
      <View style={g.barCol}>
        <View style={[g.track, { backgroundColor: c.surface2 }]}>
          <Animated.View style={[g.fill, { backgroundColor: barColour }, fillStyle]} />
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
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { c } = useTheme();
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

    return (
      <>
        {/* Overall score */}
        <View style={[s.scoreCard, { backgroundColor: c.surfaceCard, borderColor: c.border }]}>
          {pct !== null ? (
            <CompatRing value={pct} size={84} />
          ) : (
            <View style={[s.ringEmpty, { borderColor: c.border }]}>
              <Text style={[s.scoreOf, { color: c.textMuted }]}>N/A</Text>
            </View>
          )}
          <View style={s.scoreInfo}>
            <Text style={[s.interp, { color: c.fgStrong }]}>
              {interpretation || (rashiScore !== null ? 'Rashi Based' : 'Incomplete Data')}
            </Text>
            <Text style={[s.summary, { color: c.textMuted }]}>{summary}</Text>
            {score36 !== null && <Text style={[s.scoreOf, { color: c.textMuted }]}>{score36}/36 gunas</Text>}
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

        {/* Manglik */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.fgStrong }]}>Manglik Compatibility</Text>
          {(() => {
            const manglikUnknown = /unknown/i.test(manglikDetail);
            const bg = manglikUnknown ? c.surface2 : manglikCompatible ? colours.successBg : colours.warningBg;
            const fg = manglikUnknown ? c.textSecondary : manglikCompatible ? colours.success : colours.warning;
            const icon = manglikUnknown ? 'help-circle' : manglikCompatible ? 'checkmark-circle' : 'alert-circle';
            return (
              <View style={[s.manglikBadge, { backgroundColor: bg }]}>
                <Ionicons name={icon} size={20} color={fg} />
                <Text style={[s.manglikText, { color: fg }]}>{manglikDetail}</Text>
              </View>
            );
          })()}
        </View>

        {/* Ashtakoot breakdown */}
        {ashtakoot ? (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.fgStrong }]}>Ashtakoot Guna Milan</Text>
            <Text style={[s.sectionSub, { color: c.textMuted }]}>8 gunas · max 36 points</Text>
            {(Object.entries(ashtakoot.gunas) as [string, GunaDetail][])
              .sort(([, a], [, b]) => b.max - a.max)
              .map(([key, guna], i) => (
                <GunaBar key={key} name={guna.name} score={guna.score} max={guna.max} detail={guna.detail} index={i} />
              ))}
          </View>
        ) : rashiScore !== null ? (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.fgStrong }]}>Rashi Compatibility</Text>
            <Text style={[s.sectionSub, { color: c.textMuted }]}>Nakshatra not provided — using Rashi as fallback</Text>
            <View style={[s.rashiRow, { backgroundColor: c.surface2 }]}>
              <View style={[s.rashiBar, { width: `${rashiScore}%`, backgroundColor: colours.p500 }]} />
              <Text style={[s.rashiPct, { color: c.fgStrong }]}>{rashiScore}%</Text>
            </View>
          </View>
        ) : (
          <View style={s.emptySection}>
            <Ionicons name="moon-outline" size={40} color={c.textMuted} />
            <Text style={[s.emptyTitle, { color: c.textSecondary }]}>Nakshatra details missing</Text>
            <Text style={[s.emptyBody, { color: c.textMuted }]}>
              Ask {name} to complete their horoscope details (nakshatra, rashi, manglik status) for a full Guna Milan analysis.
            </Text>
          </View>
        )}

        <Text style={[s.disclaimer, { color: c.textMuted }]}>
          * Ashtakoot is a traditional Vedic system. Consider consulting a qualified jyotishi for life decisions.
        </Text>
      </>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={[s.header, { borderBottomColor: c.hairline }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={c.fgStrong} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.fgStrong }]}>Kundli Match</Text>
          <Text style={[s.headerSub, { color: c.textMuted }]}>{name}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={c.accent} />
            <Text style={[s.loadingText, { color: c.textMuted }]}>Calculating Guna Milan…</Text>
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
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 0.5 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { ...type.headline },
  headerSub:    { ...type.footnote },
  scroll:       { padding: spacing.gutter, paddingBottom: spacing['4xl'] },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['5xl'] },
  loadingText:  { marginTop: spacing.md, ...type.body },
  errorText:    { marginTop: spacing.sm, ...type.body, color: colours.error, textAlign: 'center' },

  scoreCard:    { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.lg },
  ringEmpty:    { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreOf:      { ...type.caption, marginTop: 4 },
  scoreInfo:    { flex: 1 },
  interp:       { ...type.title3, marginBottom: 4 },
  summary:      { ...type.footnote },

  doshaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },

  section:      { marginBottom: spacing.xl },
  sectionTitle: { ...type.headline, marginBottom: 2 },
  sectionSub:   { ...type.caption, marginBottom: spacing.sm },

  manglikBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md },
  manglikText:  { flex: 1, ...type.subhead, fontFamily: 'Inter-Medium' },

  rashiRow:     { height: 26, borderRadius: 13, overflow: 'hidden', marginTop: spacing.sm, position: 'relative', justifyContent: 'center' },
  rashiBar:     { ...StyleSheet.absoluteFillObject, borderRadius: 13 },
  rashiPct:     { position: 'absolute', right: spacing.md, ...type.subhead, fontFamily: 'Inter-SemiBold' },

  emptySection: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle:   { ...type.headline },
  emptyBody:    { ...type.subhead, textAlign: 'center', paddingHorizontal: spacing.lg },

  disclaimer:   { ...type.caption, textAlign: 'center', marginTop: spacing.lg, fontStyle: 'italic' },
});

const g = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 9, gap: spacing.sm },
  labelCol:   { width: 100 },
  name:       { ...type.subhead, fontFamily: 'Inter-Medium' },
  detail:     { ...type.caption },
  barCol:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track:      { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  fill:       { height: '100%', borderRadius: 4 },
  scoreLabel: { ...type.caption, fontFamily: 'Inter-SemiBold', width: 34, textAlign: 'right' },
});

const d = StyleSheet.create({
  tag:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colours.warningBg, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  tagText: { ...type.caption, color: colours.warning, fontFamily: 'Inter-Medium' },
});
