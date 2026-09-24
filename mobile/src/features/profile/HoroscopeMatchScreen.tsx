import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Screen from '../../components/layout/Screen';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { HoroscopeSkeleton } from '../../components/ui/skeletons';
import { useQuery } from '@tanstack/react-query';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { STAGGER_MS } from '@shared/constants/motion';
import { getHoroscopeCompatibility } from '../../api/profile';
import type { GunaDetail } from '../../api/profile';
import { describeFailure } from './CompatibilityBreakdownSheet';
import { CompatRing, EmptyState } from '../../components/ui';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { useFillAnimation } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'HoroscopeMatch'>;

/** Decorative glyphs sit beside text that already says the same thing. */
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

// Fill colour by strength: strong = the accent, mid = warning, weak = error.
// The score text beside every bar stays neutral: warning orange on white is
// under 4.5:1 as text, and the number already carries the meaning.
function gunaColour(pct: number, isNull: boolean, c: ThemeColours): string {
  if (isNull) return c.textMuted;
  if (pct >= 60) return c.accent;
  if (pct >= 30) return c.warning;
  return c.error;
}

/** §4.3: stagger is capped at 6 siblings. */
const staggerDelay = (index: number) => Math.min(index, 5) * STAGGER_MS;

/** Animated fill bar. The fill is absolute and childless so its width animates without re-running layout. */
function FillBar({ pct, color, index = 0 }: { pct: number; color: string; index?: number }) {
  const { c } = useTheme();
  const progress = useFillAnimation(pct, { delayMs: staggerDelay(index) });
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
  return (
    <View style={[g.track, { backgroundColor: c.surface2 }]}>
      <Animated.View style={[g.fill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

function GunaBar({ name, score, max, detail, index = 0 }: { name: string; score: number | null; max: number; detail: string; index?: number }) {
  const { c } = useTheme();
  const { fontScale } = useWindowDimensions();
  const isNull = score === null;
  const pct = isNull ? 0 : (score / max) * 100;
  const scoreLabel = isNull ? '?' : `${score}/${max}`;
  // The label column grows with the OS text size (up to 1.5x) so a name does not wrap mid-word.
  const labelWidth = Math.round(100 * Math.min(Math.max(fontScale, 1), 1.5));

  return (
    <View
      style={g.row}
      accessible
      accessibilityLabel={`${name}, ${isNull ? 'score not available' : `${score} out of ${max}`}${detail ? `. ${detail}` : ''}`}
    >
      <View style={[g.labelCol, { width: labelWidth }]}>
        <Text variant="subhead" color="fgStrong">{name}</Text>
        <Text variant="caption" color="textSecondary" numberOfLines={2}>{detail}</Text>
      </View>
      <View style={g.barCol}>
        <FillBar pct={pct} color={gunaColour(pct, isNull, c)} index={index} />
        <Text variant="caption" color="textPrimary" style={g.scoreLabel} numberOfLines={1} maxScale={1.3}>
          {scoreLabel}
        </Text>
      </View>
    </View>
  );
}

function DoshaTag({ label, present }: { label: string; present: boolean }) {
  const { c } = useTheme();
  const d = React.useMemo(() => makeD(c), [c]);
  if (!present) return null;
  return (
    <View style={d.tag} accessible accessibilityLabel={`${label} present`}>
      <Ionicons name="warning" size={12} color={c.warning} {...HIDE_FROM_A11Y} />
      <Text variant="caption" color="textPrimary">{label}</Text>
    </View>
  );
}

export default function HoroscopeMatchScreen() {
  const route = useRoute<Route>();
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { userId, name } = route.params;

  const { data, isError, error, refetch } = useQuery({
    queryKey: ['horoscope-match', userId],
    queryFn: () => getHoroscopeCompatibility(userId),
  });

  const renderScore = () => {
    if (!data) return null;
    const { ashtakoot, rashiScore, manglikCompatible, manglikDetail, summary } = data;

    const score36 = ashtakoot?.rawOut36 ?? null;
    const interpretation = ashtakoot?.interpretation ?? '';
    const pct = score36 !== null ? Math.round((score36 / 36) * 100) : null;
    const headline = interpretation || (rashiScore !== null ? 'Rashi based' : 'Incomplete data');

    return (
      <>
        {/* Overall score */}
        <Card
          style={s.scoreCard}
          accessible
          accessibilityLabel={`${headline}. ${score36 !== null ? `${score36} out of 36 gunas. ` : ''}${summary ?? ''}`}
        >
          {pct !== null ? (
            <CompatRing value={pct} size={84} />
          ) : (
            <View style={[s.ringEmpty, { borderColor: c.border }]}>
              <Text variant="caption" color="textMuted" style={s.scoreOf}>N/A</Text>
            </View>
          )}
          <View style={s.scoreInfo}>
            <Text variant="title3" color="fgStrong" style={s.interp}>{headline}</Text>
            <Text variant="footnote" color="textSecondary">{summary}</Text>
            {score36 !== null && <Text variant="caption" color="textSecondary" style={s.scoreOf}>{score36}/36 gunas</Text>}
          </View>
        </Card>

        {/* Doshas */}
        {ashtakoot && (
          <View style={s.doshaRow}>
            <DoshaTag label="Nadi dosha" present={ashtakoot.hasNadiDosha} />
            <DoshaTag label="Bhakoot dosha" present={ashtakoot.hasBhakootDosha} />
            <DoshaTag label="Gana dosha" present={ashtakoot.hasGanaDosha} />
            {!manglikCompatible && <DoshaTag label="Manglik dosha" present={true} />}
          </View>
        )}

        {/* Manglik */}
        <View style={s.section}>
          <Text variant="headline" color="fgStrong" style={s.sectionTitle} accessibilityRole="header">Manglik compatibility</Text>
          {(() => {
            const manglikUnknown = /unknown/i.test(manglikDetail);
            const bg = manglikUnknown ? c.surface2 : manglikCompatible ? c.successBg : c.warningBg;
            const fg = manglikUnknown ? c.textSecondary : manglikCompatible ? c.successAccent : c.warning;
            const icon = manglikUnknown ? 'help-circle' : manglikCompatible ? 'checkmark-circle' : 'alert-circle';
            return (
              <View style={[s.manglikBadge, { backgroundColor: bg }]} accessible accessibilityLabel={manglikDetail}>
                <Ionicons name={icon} size={20} color={fg} {...HIDE_FROM_A11Y} />
                {/* The state colour sits on the icon; the sentence stays neutral so it
                    keeps 4.5:1 on every tinted background in both themes. */}
                <Text variant="subhead" color="textPrimary" style={s.manglikText}>{manglikDetail}</Text>
              </View>
            );
          })()}
        </View>

        {/* Ashtakoot breakdown */}
        {ashtakoot ? (
          <View style={s.section}>
            <Text variant="headline" color="fgStrong" style={s.sectionTitle} accessibilityRole="header">Ashtakoot guna milan</Text>
            <Text variant="caption" color="textSecondary" style={s.sectionSub}>8 gunas · max 36 points</Text>
            {(Object.entries(ashtakoot.gunas) as [string, GunaDetail][])
              .sort(([, a], [, b]) => b.max - a.max)
              .map(([key, guna], i) => (
                <GunaBar key={key} name={guna.name} score={guna.score} max={guna.max} detail={guna.detail} index={i} />
              ))}
          </View>
        ) : rashiScore !== null ? (
          <View style={s.section}>
            <Text variant="headline" color="fgStrong" style={s.sectionTitle} accessibilityRole="header">Rashi compatibility</Text>
            <Text variant="caption" color="textSecondary" style={s.sectionSub}>Nakshatra not provided, so this uses Rashi instead.</Text>
            <View
              style={s.rashiRow}
              accessible
              accessibilityLabel={`Rashi compatibility ${rashiScore} percent`}
            >
              <FillBar pct={rashiScore} color={c.accent} />
              <Text variant="headline" color="fgStrong" style={s.rashiPct} numberOfLines={1} maxScale={1.3}>{rashiScore}%</Text>
            </View>
          </View>
        ) : (
          <EmptyState
            icon="moon-outline"
            title="Nakshatra details missing"
            description={`Ask ${name} to complete their horoscope details (nakshatra, rashi, manglik status) for a full Guna Milan analysis.`}
            testID="HoroscopeMatchScreen-empty"
          />
        )}

        <Text variant="caption" color="textSecondary" style={s.disclaimer}>
          Ashtakoot is a traditional Vedic system. Consider consulting a qualified jyotishi for life decisions.
        </Text>
      </>
    );
  };

  return (
    <Screen edges={['top', 'bottom']} style={s.container}>
      <ScreenHeader title="Kundli match" subtitle={name} testID="horoscope-header" />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {isError && !data ? (
          <EmptyState
            variant="error"
            icon="moon-outline"
            title="Couldn't load Kundli match"
            description={describeFailure(error)}
            actionLabel="Try again"
            onAction={() => refetch()}
            testID="HoroscopeMatchScreen-error"
          />
        ) : !data ? (
          // Loading, or a first fetch paused offline: either way there is nothing
          // to show yet, and a blank screen would read as an empty result.
          <HoroscopeSkeleton />
        ) : renderScore()}
      </ScrollView>
    </Screen>
  );
}

const makeS = (_c: ThemeColours) => StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { padding: spacing.gutter, paddingBottom: spacing['4xl'] },

  scoreCard:    { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.lg },
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

  rashiRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  rashiPct:     { minWidth: 48, textAlign: 'right' },

  disclaimer:   { textAlign: 'center', marginTop: spacing.lg },
});

const g = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 9, gap: spacing.sm },
  labelCol:   { width: 100 },
  barCol:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track:      { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  // Absolute and childless: the one shape whose animated width does not re-run
  // layout for its siblings (doctrine §10.4).
  fill:       { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  scoreLabel: { minWidth: 40, textAlign: 'right', flexShrink: 0 },
});

const makeD = (c: ThemeColours) => StyleSheet.create({
  tag:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.warningBg, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
});
