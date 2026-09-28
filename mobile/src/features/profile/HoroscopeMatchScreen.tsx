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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { HoroscopeSkeleton } from '../../components/ui/skeletons';
import { useQuery } from '@tanstack/react-query';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { STAGGER_MS } from '@shared/constants/motion';
import { getHoroscopeCompatibility, getMyProfile, getProfile } from '../../api/profile';
import type { GunaDetail, HoroscopeCompatibilityResponse } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import { selectPlan, useAuthStore } from '../../stores/authStore';
import { describeFailure } from './CompatibilityBreakdownSheet';
import { CompatRing, EmptyState } from '../../components/ui';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { useFillAnimation } from '../../components/motion';
import { useTheme } from '../../hooks/useTheme';
import type { MainStackParamList } from '../../navigation/types';

type Route = RouteProp<MainStackParamList, 'HoroscopeMatch'>;
type Nav = NativeStackNavigationProp<MainStackParamList>;


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
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const { userId, name } = route.params;
  const firstName = name.trim().split(/\s+/)[0] || name.trim() || t('profileDetail.thisMember', 'This member');
  const isPaid = useAuthStore(selectPlan) !== 'free';

  const { data, isError, error, refetch } = useQuery({
    queryKey: ['horoscope-match', userId],
    queryFn: () => getHoroscopeCompatibility(userId) as Promise<HoroscopeCompatibilityResponse>,
  });

  // A missing guna score has two very different causes: the member's own profile has no nakshatra,
  // or the other person's does not. The server's `summary` blames neither, so read both profiles
  // (both are already cached from the screens that lead here) and say which one it is. Only asked
  // for when the score actually came back empty.
  const needsWhy = !!data && !data.ashtakoot && data.rashiScore === null;
  // Re-read on open and trust only a settled read: a member who has just added their nakshatra on
  // the website must not be told it is missing from a cached copy.
  const { data: myProfile, isFetching: myFetching } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    enabled: needsWhy,
  });
  const { data: theirProfile, isFetching: theirFetching } = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getProfile(userId),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    enabled: needsWhy,
  });

  /**
   * No guna score. Names the real cause instead of blaming the other person by default: the
   * member's own nakshatra, the other person's, or (both present but one not recognised) neither.
   * The member can add their own nakshatra on the website (its profile editor has a Horoscope &
   * Kundli step); this screen has no field for it, so no button points at one.
   */
  const renderMissing = () => {
    const viewerMissing = myProfile && !myFetching ? !myProfile.nakshatra : null;
    const theirMissing = theirProfile && !theirFetching ? !theirProfile.nakshatra : null;

    if (viewerMissing) {
      return (
        <EmptyState
          icon="moon-outline"
          title={t('horoscope.addYours', 'Add your nakshatra')}
          description={
            theirMissing
              ? t('horoscope.viewerMissingBoth', "A guna match needs both nakshatras. Yours isn't on your profile yet, and {{name}} hasn't added one either. You can add yours from your profile on the website.", { name: firstName })
              : t('horoscope.viewerMissing', "A guna match needs both nakshatras. Yours isn't on your profile yet. You can add it from your profile on the website.")
          }
          testID="HoroscopeMatchScreen-empty"
        />
      );
    }

    if (theirMissing) {
      // Same draft-prefill route as ProfileDetail's "mention this photo": the member edits it before
      // sending, and the thread carries its own gate. Offered only where a message can actually go
      // (a mutual match, or a paid plan); to anyone else it would open a paywall.
      const canMessage = isPaid || theirProfile?.isMutual === true;
      return (
        <EmptyState
          icon="moon-outline"
          title={t('horoscope.theirMissing', "{{name}} hasn't added a nakshatra", { name: firstName })}
          description={t('horoscope.theirMissingBody', "A guna match needs both nakshatras, so there is no score until {{name}} adds one.", { name: firstName })}
          actionLabel={canMessage ? t('horoscope.messageThem', 'Message {{name}}', { name: firstName }) : undefined}
          onAction={
            canMessage
              ? () =>
                  navigation.navigate('ChatThread', {
                    userId,
                    name,
                    photo: theirProfile?.profilePhoto ?? undefined,
                    draft: t('horoscope.draft', 'Hello {{name}}, would you be able to share your nakshatra? I would like to check our Kundli match.', { name: firstName }),
                  })
              : undefined
          }
          testID="HoroscopeMatchScreen-empty"
        />
      );
    }

    return (
      <EmptyState
        icon="moon-outline"
        title={t('horoscope.noScore', 'No guna score for this pair')}
        description={
          myProfile && theirProfile && !myFetching && !theirFetching
            ? t('horoscope.noScoreRecognised', "One of the two nakshatras isn't one we can match, so there is no guna score.")
            : t('horoscope.noScoreGeneric', 'A guna match needs a nakshatra on both profiles.')
        }
        testID="HoroscopeMatchScreen-empty"
      />
    );
  };

  const renderScore = () => {
    if (!data) return null;
    const { ashtakoot, rashiScore, manglikCompatible, manglikDetail, summary } = data;
    const numerology = data.numerology ?? null;

    const score36 = ashtakoot?.rawOut36 ?? null;
    const interpretation = ashtakoot?.interpretation ?? '';
    const pct = score36 !== null ? Math.round((score36 / 36) * 100) : null;
    const headline = interpretation || (ashtakoot ? 'Guna Milan' : 'Rashi based');

    return (
      <>
        {/* Overall score. Only when there IS one: a ring reading "N/A" under a headline of
            "Incomplete data" was the whole screen for most pairs. The reason it is missing gets
            its own card below, and the numerology read still renders. */}
        {(pct !== null || rashiScore !== null) && (
          <Card
            style={s.scoreCard}
            accessible
            accessibilityLabel={`${headline}. ${score36 !== null ? `${score36} out of 36 gunas. ` : ''}${summary ?? ''}`}
          >
            <CompatRing value={pct ?? (rashiScore as number)} size={84} />
            <View style={s.scoreInfo}>
              <Text variant="title3" color="fgStrong" style={s.interp}>{headline}</Text>
              <Text variant="footnote" color="textSecondary">{summary}</Text>
              {score36 !== null && <Text variant="caption" color="textSecondary" style={s.scoreOf}>{score36}/36 gunas</Text>}
            </View>
          </Card>
        )}

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
          renderMissing()
        )}

        {/* Numerology needs only dates of birth, so it is shown whenever the server has one. */}
        {numerology && (
          <View style={s.section}>
            <Text variant="headline" color="fgStrong" style={s.sectionTitle} accessibilityRole="header">{t('horoscope.numerologyTitle', 'Numerology')}</Text>
            <Text variant="caption" color="textSecondary" style={s.sectionSub}>{t('horoscope.numerologySub', 'Life-path numbers, worked out from date of birth.')}</Text>
            <Card style={s.numCard}>
              {[
                { who: t('horoscope.you', 'You'), lp: numerology.person1 },
                { who: firstName, lp: numerology.person2 },
              ].map(({ who, lp }, i) => (
                <View
                  key={i}
                  style={[s.numRow, i === 0 && { borderBottomColor: c.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}
                  accessible
                  accessibilityLabel={`${who}: ${t('horoscope.lifePath', 'Life path {{n}}', { n: lp.number })}, ${lp.title}`}
                >
                  <View style={[s.numBadge, { backgroundColor: c.accentSoft }]}>
                    <Text variant="headline" color="primary" maxScale={1.3} {...HIDE_FROM_A11Y}>{lp.number}</Text>
                  </View>
                  <View style={s.numText}>
                    <Text variant="subhead" color="fgStrong">{who}</Text>
                    <Text variant="footnote" color="textSecondary">{lp.title}</Text>
                  </View>
                </View>
              ))}
              {numerology.compatibility && (
                <View
                  style={s.numCompat}
                  accessible
                  accessibilityLabel={`${numerology.compatibility.label}, ${numerology.compatibility.score} percent. ${numerology.compatibility.note}`}
                >
                  <View style={s.rashiRow}>
                    <FillBar pct={numerology.compatibility.score} color={c.accent} />
                    <Text variant="headline" color="fgStrong" style={s.rashiPct} numberOfLines={1} maxScale={1.3}>{numerology.compatibility.score}%</Text>
                  </View>
                  <Text variant="subhead" color="fgStrong" style={s.numLabel}>{numerology.compatibility.label}</Text>
                  <Text variant="footnote" color="textSecondary">{numerology.compatibility.note}</Text>
                </View>
              )}
            </Card>
          </View>
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

  numCard:      { padding: 0 },
  numRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  numBadge:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  numText:      { flex: 1 },
  numCompat:    { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 2 },
  numLabel:     { marginTop: spacing.xs },

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
