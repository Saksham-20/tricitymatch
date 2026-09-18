import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Text from '../../components/ui/Text';
import Screen from '../../components/layout/Screen';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { HoroscopeSkeleton } from '../../components/ui/skeletons';
import { useQuery } from '@tanstack/react-query';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colours, type, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { getHoroscopeCompatibility } from '../../api/profile';
import type { GunaDetail } from '../../api/profile';
import { CompatRing } from '../../components/ui';
import { useFillAnimation, PressableScale } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'HoroscopeMatch'>;

// Brand guna fill: strong = burgundy, mid = warning, weak = destructive (no rainbow).
function gunaColour(pct: number, isNull: boolean, c: ThemeColours): string {
  if (isNull) return c.textMuted;
  if (pct >= 60) return c.p500;
  if (pct >= 30) return c.warning;
  return c.error;
}

function GunaBar({ name, score, max, detail, index = 0 }: { name: string; score: number | null; max: number; detail: string; index?: number }) {
  const { c } = useTheme();
  const pct = score !== null ? (score / max) * 100 : 0;
  const isNull = score === null;
  const scoreLabel = isNull ? '?' : `${score}/${max}`;
  const barColour = gunaColour(pct, isNull, c);
  // koota bars stagger 40ms each (handoff motion spec)
  const progress = useFillAnimation(isNull ? 0 : pct, { delayMs: index * 40 });
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View style={g.row}>
      <View style={g.labelCol}>
        <Text variant="subhead" color="fgStrong">{name}</Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>{detail}</Text>
      </View>
      <View style={g.barCol}>
        <View style={[g.track, { backgroundColor: c.surface2 }]}>
          <Animated.View style={[g.fill, { backgroundColor: barColour }, fillStyle]} />
        </View>
        {/* barColour is a score-threshold gradient (gunaColour), not a single
            curated token — kept as a style override. */}
        <Text variant="caption" style={[g.scoreLabel, { color: barColour }]}>{scoreLabel}</Text>
      </View>
    </View>
  );
}

function DoshaTag({ label, present }: { label: string; present: boolean }) {
  const { c } = useTheme();
  const d = React.useMemo(() => makeD(c), [c]);
  if (!present) return null;
  return (
    <View style={d.tag}>
      <Ionicons name="warning" size={12} color={c.warning} />
      <Text variant="caption" color="warning">{label}</Text>
    </View>
  );
}

export default function HoroscopeMatchScreen() {
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
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
              <Text variant="caption" color="textMuted" style={s.scoreOf}>N/A</Text>
            </View>
          )}
          <View style={s.scoreInfo}>
            <Text variant="title3" color="fgStrong" style={s.interp}>
              {interpretation || (rashiScore !== null ? 'Rashi Based' : 'Incomplete Data')}
            </Text>
            <Text variant="footnote" color="textMuted">{summary}</Text>
            {score36 !== null && <Text variant="caption" color="textMuted" style={s.scoreOf}>{score36}/36 gunas</Text>}
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
          <Text variant="headline" color="fgStrong" style={s.sectionTitle}>Manglik Compatibility</Text>
          {(() => {
            const manglikUnknown = /unknown/i.test(manglikDetail);
            const bg = manglikUnknown ? c.surface2 : manglikCompatible ? c.successBg : c.warningBg;
            const fg = manglikUnknown ? c.textSecondary : manglikCompatible ? c.success : c.warning;
            const icon = manglikUnknown ? 'help-circle' : manglikCompatible ? 'checkmark-circle' : 'alert-circle';
            return (
              <View style={[s.manglikBadge, { backgroundColor: bg }]}>
                <Ionicons name={icon} size={20} color={fg} />
                {/* fg is a state-conditional pick across 3 curated tokens, not a
                    single one — kept as a style override. */}
                <Text variant="subhead" style={[s.manglikText, { color: fg }]}>{manglikDetail}</Text>
              </View>
            );
          })()}
        </View>

        {/* Ashtakoot breakdown */}
        {ashtakoot ? (
          <View style={s.section}>
            <Text variant="headline" color="fgStrong" style={s.sectionTitle}>Ashtakoot Guna Milan</Text>
            <Text variant="caption" color="textMuted" style={s.sectionSub}>8 gunas · max 36 points</Text>
            {(Object.entries(ashtakoot.gunas) as [string, GunaDetail][])
              .sort(([, a], [, b]) => b.max - a.max)
              .map(([key, guna], i) => (
                <GunaBar key={key} name={guna.name} score={guna.score} max={guna.max} detail={guna.detail} index={i} />
              ))}
          </View>
        ) : rashiScore !== null ? (
          <View style={s.section}>
            <Text variant="headline" color="fgStrong" style={s.sectionTitle}>Rashi Compatibility</Text>
            <Text variant="caption" color="textMuted" style={s.sectionSub}>Nakshatra not provided — using Rashi as fallback</Text>
            <View style={[s.rashiRow, { backgroundColor: c.surface2 }]}>
              <View style={[s.rashiBar, { width: `${rashiScore}%`, backgroundColor: c.p500 }]} />
              <Text variant="headline" color="fgStrong" style={s.rashiPct}>{rashiScore}%</Text>
            </View>
          </View>
        ) : (
          <View style={s.emptySection}>
            <Ionicons name="moon-outline" size={40} color={c.textMuted} />
            <Text variant="headline" color="textSecondary">Nakshatra details missing</Text>
            <Text variant="subhead" color="textMuted" style={s.emptyBody}>
              Ask {name} to complete their horoscope details (nakshatra, rashi, manglik status) for a full Guna Milan analysis.
            </Text>
          </View>
        )}

        <Text variant="caption" color="textMuted" style={s.disclaimer}>
          * Ashtakoot is a traditional Vedic system. Consider consulting a qualified jyotishi for life decisions.
        </Text>
      </>
    );
  };

  return (
    <Screen edges={['top']} style={s.container}>
      <View style={[s.header, { borderBottomColor: c.hairline }]}>
        <PressableScale
          onPress={() => nav.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={c.fgStrong} />
        </PressableScale>
        <View style={s.headerCenter}>
          <Text variant="headline" color="fgStrong">Kundli Match</Text>
          <Text variant="footnote" color="textMuted">{name}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <HoroscopeSkeleton />
        ) : isError ? (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={48} color={c.error} />
            <Text variant="body" color="error" style={s.errorText}>Could not load horoscope data</Text>
          </View>
        ) : renderScore()}
      </ScrollView>
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 0.5 },
  headerCenter: { flex: 1, alignItems: 'center' },
  scroll:       { padding: spacing.gutter, paddingBottom: spacing['4xl'] },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['5xl'] },
  loadingText:  { marginTop: spacing.md, ...type.body },
  errorText:    { marginTop: spacing.sm, textAlign: 'center' },

  scoreCard:    { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.lg },
  ringEmpty:    { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreOf:      { marginTop: 4 },
  scoreInfo:    { flex: 1 },
  interp:       { marginBottom: 4 },

  doshaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },

  section:      { marginBottom: spacing.xl },
  sectionTitle: { marginBottom: 2 },
  sectionSub:   { marginBottom: spacing.sm },

  manglikBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: borderRadius.md, padding: spacing.md },
  manglikText:  { flex: 1 },

  rashiRow:     { height: 26, borderRadius: 13, overflow: 'hidden', marginTop: spacing.sm, position: 'relative', justifyContent: 'center' },
  rashiBar:     { ...StyleSheet.absoluteFillObject, borderRadius: 13 },
  rashiPct:     { position: 'absolute', right: spacing.md },

  emptySection: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyBody:    { textAlign: 'center', paddingHorizontal: spacing.lg },

  disclaimer:   { textAlign: 'center', marginTop: spacing.lg, fontStyle: 'italic' },
});

const g = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 9, gap: spacing.sm },
  labelCol:   { width: 100 },
  barCol:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track:      { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  fill:       { height: '100%', borderRadius: 4 },
  scoreLabel: { width: 34, textAlign: 'right' },
});

const makeD = (c: ThemeColours) => StyleSheet.create({
  tag:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.warningBg, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
});
