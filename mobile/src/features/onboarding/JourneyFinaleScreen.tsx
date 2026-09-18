/**
 * Journey finale (D6 + DS2/DS6/DS7). Ends the preferences journey with a
 * curated-matches reveal — but only when there is real liquidity to show:
 * fewer than 4 results skips the labor-illusion theater entirely and lands on
 * an honest early-market state. The staged loader holds ≤1.5s total and dies
 * instantly on fetch error; reduced-motion gets a static line. The single gold
 * element on this screen is the locked tease card (DS7).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Text from '../../components/ui/Text';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getDailyFeed } from '../../api/matches';
import SmartImage from '../../components/common/SmartImage';
import { useReduceMotion, PressableScale } from '../../components/motion';
import { useOnboarding, JOURNEY_DONE_KEY } from './OnboardingContext';
import { useBiodataShare } from '../../hooks/useBiodataShare';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import type { ProfileSummary } from '../../types';

const STAGES = [
  'Scanning Tricity profiles…',
  'Matching 36 gunas…',
  'Checking family preferences…',
];
const STAGE_MS = 500; // 3 stages × 500ms = 1.5s max hold (DS6)
const REVEAL_MIN = 4; // DS2 liquidity guard

const ageFrom = (dob: string | null): string => {
  if (!dob) return '';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return Number.isFinite(years) && years > 0 ? `, ${years}` : '';
};

export default function JourneyFinaleScreen() {
  const { c } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { exit } = useOnboarding();
  const reduced = useReduceMotion();
  const { share: shareBiodata, busy: biodataBusy } = useBiodataShare();

  const [phase, setPhase] = useState<'loading' | 'reveal' | 'early' | 'error'>('loading');
  const [stageIndex, setStageIndex] = useState(0);
  const [matches, setMatches] = useState<ProfileSummary[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    AsyncStorage.setItem(JOURNEY_DONE_KEY, String(Date.now())).catch(() => {});
    let cancelled = false;

    if (!reduced) {
      // Stage copy advances on a fixed clock; theater only fills real wait —
      // the reveal fires at max(fetch, stages), never delaying an error.
      timers.current = STAGES.map((_, i) =>
        setTimeout(() => { if (!cancelled) setStageIndex(i); }, i * STAGE_MS),
      );
    }

    const minHold = reduced ? Promise.resolve() : new Promise((r) => { timers.current.push(setTimeout(r, STAGES.length * STAGE_MS)); });
    (async () => {
      try {
        const [feed] = await Promise.all([getDailyFeed(), minHold]);
        if (cancelled) return;
        if (feed.length >= REVEAL_MIN) {
          setMatches(feed.slice(0, 4));
          setPhase('reveal');
        } else {
          setPhase('early');
        }
      } catch {
        if (!cancelled) {
          timers.current.forEach(clearTimeout); // kill theater instantly (DS6)
          setPhase('error');
        }
      }
    })();

    return () => { cancelled = true; timers.current.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goQuiz = () => navigation.navigate('Quiz');

  if (phase === 'loading') {
    return (
      <SafeAreaView style={st.safe} testID="JourneyFinaleLoading">
        <View style={st.center}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text variant="callout" color="textSecondary" style={st.stageText} accessibilityLiveRegion="polite">
            {reduced ? t('journey.finding', 'Finding matches…') : STAGES[stageIndex]}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} testID="JourneyFinaleScreen">
      <ScrollView contentContainerStyle={st.content}>
        {phase === 'reveal' && (
          <>
            <Text variant="title2" color="textPrimary" style={st.title}>{t('journey.revealTitle', 'Your matches are ready')}</Text>
            <Text variant="footnote" color="textMuted" style={st.sub}>{t('journey.revealSub', 'Curated from verified Tricity profiles, using everything you just shared.')}</Text>
            <View style={st.grid}>
              {matches.map((p) => (
                <PressableScale
                  key={p.userId}
                  style={st.card}
                  onPress={() => navigation.navigate('ProfileDetail', { userId: p.userId })}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.firstName} profile`}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <SmartImage uri={p.profilePhoto ?? p.photos?.[0] ?? null} name={`${p.firstName} ${p.lastName ?? ''}`} style={st.cardImg} />
                  <View style={st.cardMeta}>
                    <Text variant="headline" color="textPrimary" numberOfLines={1}>{p.firstName}{ageFrom(p.dateOfBirth)}</Text>
                    <Text variant="footnote" color="textMuted" style={st.cardCity} numberOfLines={1}>{p.city}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
            {/* DS7: the one gold element — locked tease */}
            <View style={st.tease}>
              <Ionicons name="lock-closed" size={16} color={c.secondary} />
              <Text variant="footnote" color="textPrimary" style={st.teaseText}>{t('journey.tease', 'More members liked profiles like yours — see who, with Premium.')}</Text>
            </View>
          </>
        )}

        {phase === 'early' && (
          <View style={st.center}>
            <Ionicons name="leaf-outline" size={40} color={c.primary} />
            <Text variant="title2" color="textPrimary" style={st.title}>{t('journey.earlyTitle', "You're early")}</Text>
            <Text variant="footnote" color="textMuted" style={st.sub}>
              {t('journey.earlySub', "New Tricity profiles arrive weekly — we'll notify you as soon as strong matches appear.")}
            </Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={st.center}>
            <Ionicons name="cloud-offline-outline" size={40} color={c.textMuted} />
            <Text variant="title2" color="textPrimary" style={st.title}>{t('journey.errorTitle', "Couldn't load matches")}</Text>
            <Text variant="footnote" color="textMuted" style={st.sub}>{t('journey.errorSub', 'Your answers are saved. Check your matches from the Home tab.')}</Text>
          </View>
        )}

        {/* Completion energy -> the biodata share loop (D5 flagship) */}
        <PressableScale haptic style={st.quizBtn} onPress={shareBiodata} accessibilityRole="button" testID="biodata-cta">
          <Ionicons name={biodataBusy ? 'hourglass-outline' : 'logo-whatsapp'} size={18} color={colours.success} />
          {/* colours.success is the static, non-theme-reactive import (flagged per scope rule) — kept as an explicit override */}
          <Text variant="subhead" style={{ color: colours.success }}>{t('journey.biodataCta', 'Share your new biodata on WhatsApp')}</Text>
        </PressableScale>

        <PressableScale haptic style={st.quizBtn} onPress={goQuiz} accessibilityRole="button" testID="quiz-cta">
          <Ionicons name="sparkles-outline" size={18} color={c.primary} />
          <Text variant="subhead" color="primary">{t('journey.quizCta', 'Take the 2-minute personality quiz')}</Text>
        </PressableScale>

        <PressableScale haptic style={st.cta} onPress={exit} accessibilityRole="button" testID="done-btn">
          <Text variant="headline" color="onPrimary">
            {phase === 'reveal' ? t('journey.explore', 'Explore my matches') : t('journey.done', 'Go to my dashboard')}
          </Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.gutter, paddingBottom: spacing['3xl'], flexGrow: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  stageText: { marginTop: spacing.md },
  title: { textAlign: 'center', marginTop: spacing.sm },
  sub: { textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  card: {
    width: '47%', borderRadius: borderRadius.lg, overflow: 'hidden',
    backgroundColor: c.surfaceCard, borderWidth: 1, borderColor: c.border,
  },
  cardImg: { width: '100%', aspectRatio: 0.9 },
  cardMeta: { padding: spacing.sm },
  cardCity: { marginTop: 2 },
  tease: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: c.goldSoft, borderRadius: borderRadius.md,
    padding: spacing.md, marginTop: spacing.lg,
  },
  teaseText: { flex: 1 },
  quizBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, marginTop: spacing.xl,
  },
  cta: {
    backgroundColor: c.primary, borderRadius: borderRadius.pill,
    minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
});
