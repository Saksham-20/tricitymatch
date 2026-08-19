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
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getDailyFeed } from '../../api/matches';
import SmartImage from '../../components/common/SmartImage';
import { useReduceMotion, PressableScale } from '../../components/motion';
import { useOnboarding, JOURNEY_DONE_KEY } from './OnboardingContext';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
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
          <Text style={st.stageText} accessibilityLiveRegion="polite">
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
            <Text style={st.title}>{t('journey.revealTitle', 'Your matches are ready')}</Text>
            <Text style={st.sub}>{t('journey.revealSub', 'Curated from verified Tricity profiles, using everything you just shared.')}</Text>
            <View style={st.grid}>
              {matches.map((p) => (
                <TouchableOpacity
                  key={p.userId}
                  style={st.card}
                  onPress={() => navigation.navigate('ProfileDetail', { userId: p.userId })}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.firstName} profile`}
                >
                  <SmartImage uri={p.profilePhoto ?? p.photos?.[0] ?? null} name={`${p.firstName} ${p.lastName ?? ''}`} style={st.cardImg} />
                  <View style={st.cardMeta}>
                    <Text style={st.cardName} numberOfLines={1}>{p.firstName}{ageFrom(p.dateOfBirth)}</Text>
                    <Text style={st.cardCity} numberOfLines={1}>{p.city}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {/* DS7: the one gold element — locked tease */}
            <View style={st.tease}>
              <Ionicons name="lock-closed" size={16} color={c.secondary} />
              <Text style={st.teaseText}>{t('journey.tease', 'More members liked profiles like yours — see who, with Premium.')}</Text>
            </View>
          </>
        )}

        {phase === 'early' && (
          <View style={st.center}>
            <Ionicons name="leaf-outline" size={40} color={c.primary} />
            <Text style={st.title}>{t('journey.earlyTitle', "You're early")}</Text>
            <Text style={st.sub}>
              {t('journey.earlySub', "New Tricity profiles arrive weekly — we'll notify you as soon as strong matches appear.")}
            </Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={st.center}>
            <Ionicons name="cloud-offline-outline" size={40} color={c.textMuted} />
            <Text style={st.title}>{t('journey.errorTitle', "Couldn't load matches")}</Text>
            <Text style={st.sub}>{t('journey.errorSub', 'Your answers are saved. Check your matches from the Home tab.')}</Text>
          </View>
        )}

        <PressableScale haptic style={st.quizBtn} onPress={goQuiz} accessibilityRole="button" testID="quiz-cta">
          <Ionicons name="sparkles-outline" size={18} color={c.primary} />
          <Text style={st.quizText}>{t('journey.quizCta', 'Take the 2-minute personality quiz')}</Text>
        </PressableScale>

        <PressableScale haptic style={st.cta} onPress={exit} accessibilityRole="button" testID="done-btn">
          <Text style={st.ctaText}>
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
  stageText: { fontSize: typography.fontSize.base, color: c.textSecondary, marginTop: spacing.md },
  title: { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: c.textPrimary, textAlign: 'center', marginTop: spacing.sm },
  sub: { fontSize: typography.fontSize.sm, color: c.textMuted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  card: {
    width: '47%', borderRadius: borderRadius.lg, overflow: 'hidden',
    backgroundColor: c.surfaceCard, borderWidth: 1, borderColor: c.border,
  },
  cardImg: { width: '100%', aspectRatio: 0.9 },
  cardMeta: { padding: spacing.sm },
  cardName: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: c.textPrimary },
  cardCity: { fontSize: typography.fontSize.xs, color: c.textMuted, marginTop: 2 },
  tease: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: c.goldSoft, borderRadius: borderRadius.md,
    padding: spacing.md, marginTop: spacing.lg,
  },
  teaseText: { flex: 1, fontSize: typography.fontSize.sm, color: c.textPrimary },
  quizBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, marginTop: spacing.xl,
  },
  quizText: { fontSize: typography.fontSize.sm, color: c.primary, fontFamily: typography.fontFamily.semiBold },
  cta: {
    backgroundColor: c.primary, borderRadius: borderRadius.pill,
    minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  ctaText: { color: '#fff', fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.base },
});
