/**
 * Journey finale (D6 + DS2/DS7). Ends the preferences journey with a matches
 * reveal, but only when there is real liquidity to show: fewer than 4 results
 * lands on an honest early-market state instead of a card grid (DS2).
 * The loading screen says one true thing, "Finding matches", and reveals when the
 * fetch returns. A short floor (MIN_HOLD_MS) only stops a fast response flashing
 * the loader for a frame; it is not a script. This screen used to rotate through
 * "Matching 36 gunas" and "Checking family preferences" on a fixed clock: that
 * work was never happening (a guna match needs a nakshatra, which a member on
 * mobile cannot have entered), so the copy claimed effort the server had not
 * made. An error shows immediately, and reduced-motion gets no floor at all.
 * The single gold element on this screen is the locked tease card (DS7).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/layout/Screen';
import { getDailyFeed } from '../../api/matches';
import { getMyProfile } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import { useQuery } from '@tanstack/react-query';
import SmartImage from '../../components/common/SmartImage';
import { useReduceMotion, PressableScale } from '../../components/motion';
import { useOnboarding, JOURNEY_DONE_KEY } from './OnboardingContext';
import { useOnboardingControls } from './OnboardingLayout';
import { useBiodataShare } from '../../hooks/useBiodataShare';
import { useAuthStore } from '../../stores/authStore';
import { tapSize } from '../../utils/elderTheme';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import type { ProfileSummary } from '../../types';

const MIN_HOLD_MS = 600; // floor so a fast fetch does not flash the loader for a frame
const REVEAL_MIN = 4; // DS2 liquidity guard

const ageFrom = (dob: string | null): string => {
  if (!dob) return '';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return Number.isFinite(years) && years > 0 ? `, ${years}` : '';
};

interface FinaleActionProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone: 'outline' | 'text';
  /** Work in flight: swaps the icon for a spinner and blocks a second press. */
  busy?: boolean;
  /** One light haptic for a committed action (share); leave off for plain navigation. */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  testID: string;
}

/**
 * A secondary action whose label WRAPS. Button pins its title to one line, which
 * ellipsized these long strings on a 360dp phone at default text size and clips
 * them further in hi/pa (about 30% longer) or at a large OS font. Until Button
 * grows a wrap option this is the one place that needs it.
 */
function FinaleAction({ label, icon, onPress, tone, busy = false, haptic = false, style, testID }: FinaleActionProps) {
  const { c, elder } = useTheme();
  const st = React.useMemo(() => makeActionStyles(c), [c]);
  return (
    <PressableScale
      haptic={haptic}
      onPress={onPress}
      disabled={busy}
      style={[st.action, tone === 'outline' ? st.outline : st.plain, { minHeight: Math.max(50, tapSize(elder)) }, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator size="small" color={c.accent} />
      ) : (
        <Ionicons name={icon} size={20} color={c.accent} accessibilityElementsHidden importantForAccessibility="no" />
      )}
      <Text variant={tone === 'outline' ? 'headline' : 'subhead'} color="primary" style={st.actionText}>{label}</Text>
    </PressableScale>
  );
}

export default function JourneyFinaleScreen() {
  const { c, elder } = useTheme();
  const st = React.useMemo(() => makeSt(c), [c]);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { exit } = useOnboarding();
  const controls = useOnboardingControls();
  const reduced = useReduceMotion();
  const { share: shareBiodata, busy: biodataBusy } = useBiodataShare();
  // Founding-window signups already hold an active Premium grant, so the likes
  // tease is only true for a member who does not have it.
  const isFree = (useAuthStore((s) => s.user?.subscriptionPlan) ?? 'free') === 'free';

  const [phase, setPhase] = useState<'loading' | 'reveal' | 'early' | 'error'>('loading');
  const [matches, setMatches] = useState<ProfileSummary[]>([]);
  const [attempt, setAttempt] = useState(0);

  const revealTitle = t('journey.revealTitle', 'Your matches are ready');
  const earlyTitle = t('journey.earlyTitle', "You're early");
  const errorTitle = t('journey.errorTitle', "Couldn't load matches");

  useEffect(() => {
    AsyncStorage.setItem(JOURNEY_DONE_KEY, String(Date.now())).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    // This run's timers, so the cleanup clears exactly them.
    const pending: ReturnType<typeof setTimeout>[] = [];

    // The reveal fires at max(fetch, floor); an error never waits for the floor.
    const minHold = reduced ? Promise.resolve() : new Promise((r) => { pending.push(setTimeout(r, MIN_HOLD_MS)); });
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
          pending.forEach(clearTimeout);
          setPhase('error');
        }
      }
    })();

    return () => { cancelled = true; pending.forEach(clearTimeout); };
    // Re-runs only on an explicit retry; toggling reduce-motion mid-load must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // The result replaces the loader without a tap, so say what it became.
  useEffect(() => {
    if (phase === 'loading') return;
    AccessibilityInfo.announceForAccessibility(
      phase === 'reveal' ? revealTitle : phase === 'early' ? earlyTitle : errorTitle,
    );
  }, [phase, revealTitle, earlyTitle, errorTitle]);

  // Members without a profile photo are ranked last in search. That is the single most useful thing
  // this screen can tell them, so it takes the place of the optional quiz. Unknown (still loading or
  // failed) keeps the quiz: never claim a member has no photo on a guess.
  // The photos step uploads without touching the query cache, so a cached profile can pre-date the
  // photo the member just added: re-read on mount and trust only a settled read.
  const { data: myProfile, isFetching: profileFetching } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMyProfile,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const noPhoto =
    !!myProfile && !profileFetching && !myProfile.profilePhoto && (myProfile.photos?.length ?? 0) === 0;

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const goQuiz = () => navigation.navigate('Quiz');
  const goPhotos = () => navigation.navigate('EditProfile', { section: 'photos' });
  const goPremium = () => navigation.navigate('Subscription');

  if (phase === 'loading') {
    // A spinner is deliberate here: this is the DS6 staged loader, and until the
    // fetch settles nobody knows whether a card grid or an empty state follows,
    // so a grid-shaped skeleton would promise cards that may never arrive.
    return (
      <Screen edges={['top', 'bottom']} contentContainerStyle={st.loadingWrap} testID="JourneyFinaleLoading">
        <View
          style={st.center}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('journey.finding', 'Finding matches…')}
          accessibilityState={{ busy: true }}
        >
          <ActivityIndicator size="large" color={c.primary} />
          <Text variant="callout" color="textSecondary" style={st.stageText}>
            {t('journey.finding', 'Finding matches…')}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} scroll contentContainerStyle={st.content} testID="JourneyFinaleScreen">
      {phase === 'reveal' && (
        <>
          <Text variant="title2" color="textPrimary" style={st.title} accessibilityRole="header">{revealTitle}</Text>
          {/* Not "verified": the daily set ranks active members, it does not filter on verification. */}
          <Text variant="footnote" color="textSecondary" style={st.sub}>{t('journey.revealSubHonest', 'Picked from Tricity members using everything you just shared.')}</Text>
          <View style={st.grid}>
            {matches.map((p) => (
              <PressableScale
                key={p.userId}
                style={st.card}
                onPress={() => navigation.navigate('ProfileDetail', { userId: p.userId })}
                accessibilityRole="button"
                accessibilityLabel={t('journey.openProfile', "Open {{name}}'s profile", { name: p.firstName })}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <SmartImage uri={p.profilePhoto ?? p.photos?.[0] ?? null} name={`${p.firstName} ${p.lastName ?? ''}`} style={st.cardImg} />
                <View style={st.cardMeta}>
                  <Text variant="headline" color="textPrimary" numberOfLines={1}>{p.firstName}{ageFrom(p.dateOfBirth)}</Text>
                  {p.city ? <Text variant="footnote" color="textSecondary" style={st.cardCity} numberOfLines={1}>{p.city}</Text> : null}
                </View>
              </PressableScale>
            ))}
          </View>
          {/* DS7: the one gold element — locked tease. States only what is true (the
              likes-you list is a Premium feature) and only to a member who lacks it. */}
          {isFree ? (
            <PressableScale
              style={[st.tease, { minHeight: tapSize(elder) }]}
              onPress={goPremium}
              accessibilityRole="button"
              accessibilityLabel={t('journey.premiumTease', 'See who likes you with Premium.')}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="finale-premium-tease"
            >
              <Ionicons name="lock-closed" size={16} color={c.secondary} accessibilityElementsHidden importantForAccessibility="no" />
              <Text variant="footnote" color="textPrimary" style={st.teaseText}>{t('journey.premiumTease', 'See who likes you with Premium.')}</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
            </PressableScale>
          ) : null}
        </>
      )}

      {phase === 'early' && (
        <EmptyState
          icon="leaf-outline"
          title={earlyTitle}
          description={t('journey.earlyBody', "We're still growing across the Tricity. Check back soon for new matches.")}
          testID="JourneyFinale-early"
        />
      )}

      {phase === 'error' && (
        <EmptyState
          variant="error"
          icon="cloud-offline-outline"
          title={errorTitle}
          description={t('journey.errorSub', 'Your answers are saved. Check your matches from the Home tab.')}
          actionLabel={t('common.retry', 'Retry')}
          onAction={retry}
          testID="JourneyFinale-error"
        />
      )}

      {/* Completion energy -> the biodata share loop (D5 flagship). The one committed
          action on this screen, so the one haptic; the rest only navigate. */}
      <FinaleAction
        tone="outline"
        icon="logo-whatsapp"
        label={t('journey.biodataShare', 'Share biodata on WhatsApp')}
        onPress={shareBiodata}
        busy={biodataBusy}
        haptic
        style={st.secondaryAction}
        testID="biodata-cta"
      />

      {noPhoto ? (
        <>
          <FinaleAction
            tone="text"
            icon="camera-outline"
            label={t('journey.addPhoto', 'Add a photo')}
            onPress={goPhotos}
            style={st.textAction}
            testID="photo-cta"
          />
          <Text variant="footnote" color="textSecondary" style={st.photoNote}>
            {t('journey.addPhotoNote', 'Profiles without one are shown last in search.')}
          </Text>
        </>
      ) : (
        <FinaleAction
          tone="text"
          icon="sparkles-outline"
          label={t('journey.quizCta', 'Take the 2-minute personality quiz')}
          onPress={goQuiz}
          style={st.textAction}
          testID="quiz-cta"
        />
      )}

      <Button
        title={phase === 'reveal' ? t('journey.explore', 'Explore my matches') : t('journey.done', 'Go to my dashboard')}
        onPress={exit}
        haptic={false}
        size="lg"
        style={[st.cta, controls.buttonStyle]}
        testID="done-btn"
      />
    </Screen>
  );
}

const makeSt = (c: ThemeColours) => StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.gutter },
  content: { padding: spacing.gutter, paddingBottom: spacing['3xl'], flexGrow: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  stageText: { marginTop: spacing.md, textAlign: 'center' },
  title: { textAlign: 'center', marginTop: spacing.sm },
  sub: { textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  // Elevation declared once: a border (no shadow).
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
  secondaryAction: { marginTop: spacing.xl },
  textAction: { marginTop: spacing.sm, alignSelf: 'center', maxWidth: '100%' },
  photoNote: { textAlign: 'center', paddingHorizontal: spacing.lg },
  cta: { marginTop: spacing.sm },
});

const makeActionStyles = (c: ThemeColours) => StyleSheet.create({
  action: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  // Same outline treatment as Button's secondary variant.
  outline: { borderWidth: 1.5, borderColor: c.accent, borderRadius: borderRadius.md },
  plain: { borderRadius: borderRadius.md },
  actionText: { flexShrink: 1, textAlign: 'center' },
});
