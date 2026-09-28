import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  AccessibilityInfo,
  Alert,
  BackHandler,
  Platform,
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Screen from '../../components/layout/Screen';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { showToast } from '../../utils/toast';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale, useReduceMotion } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import { updateMyProfile } from '../../api/profile';
import { queryKeys } from '../../constants/queryKeys';
import type { MainStackParamList } from '../../navigation/types';
import type { QuizAnswer } from '../../types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Quiz Questions ───────────────────────────────────────────────────────────

interface Question {
  id: string;
  text: string;
  options: { value: string; label: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: 'family_priority',
    text: 'How important is living near family after marriage?',
    options: [
      { value: 'very_important', label: 'Very important: family is central' },
      { value: 'somewhat_important', label: 'Somewhat: we visit regularly' },
      { value: 'flexible', label: 'Flexible based on work & circumstances' },
      { value: 'independent', label: 'Prefer to live independently' },
    ],
  },
  {
    id: 'career_vs_family',
    text: 'How do you balance career and family life?',
    options: [
      { value: 'family_first', label: 'Family always comes first' },
      { value: 'career_first', label: 'Career drives most decisions' },
      { value: 'equal_balance', label: 'I strive for equal balance' },
      { value: 'situational', label: 'Depends on the situation' },
    ],
  },
  {
    id: 'lifestyle_pace',
    text: 'Which lifestyle pace suits you best?',
    options: [
      { value: 'homebody', label: 'Homebody: cozy evenings at home' },
      { value: 'social', label: 'Social: friends, gatherings, events' },
      { value: 'adventurous', label: 'Adventurous: travel, new experiences' },
      { value: 'balanced', label: 'Mix of all depending on mood' },
    ],
  },
  {
    id: 'financial_style',
    text: 'What is your financial philosophy?',
    options: [
      { value: 'saver', label: 'Save aggressively: security first' },
      { value: 'balanced_finance', label: 'Save and enjoy in balance' },
      { value: 'spender', label: 'Live in the present, enjoy now' },
      { value: 'investor', label: 'Invest and grow wealth' },
    ],
  },
  {
    id: 'children',
    text: 'Your thoughts on having children?',
    options: [
      { value: 'want_soon', label: 'Want children soon after marriage' },
      { value: 'want_later', label: 'Want children but later in life' },
      { value: 'unsure', label: 'Open to the idea, not sure yet' },
      { value: 'no_children', label: 'Prefer not to have children' },
    ],
  },
  {
    id: 'conflict_style',
    text: 'How do you handle disagreements in a relationship?',
    options: [
      { value: 'talk_immediately', label: 'Talk it out right away' },
      { value: 'cool_down', label: 'Take space first, then discuss' },
      { value: 'compromise', label: 'Find middle ground quickly' },
      { value: 'seek_help', label: 'Involve family or counsellor if needed' },
    ],
  },
  {
    id: 'social_media',
    text: 'Your relationship with social media?',
    options: [
      { value: 'very_active', label: 'Very active: share everything' },
      { value: 'moderate', label: 'Moderate: selective sharing' },
      { value: 'private', label: 'Private: rarely post personal life' },
      { value: 'not_on_social', label: 'Not on social media' },
    ],
  },
  {
    id: 'religion_practice',
    text: 'How central is religious practice in your daily life?',
    options: [
      { value: 'very_devout', label: 'Very devout: daily rituals matter' },
      { value: 'observant', label: 'Observant: festivals & occasions' },
      { value: 'spiritual', label: 'Spiritual but not strictly religious' },
      { value: 'non_religious', label: 'Not religious' },
    ],
  },
  {
    id: 'work_location',
    text: 'How flexible are you about relocation for work or family?',
    options: [
      { value: 'stay_local', label: 'Prefer to stay in the Tricity area' },
      { value: 'open_india', label: 'Open to other cities in India' },
      { value: 'open_abroad', label: 'Open to moving abroad' },
      { value: 'wherever', label: 'Happy wherever life takes us' },
    ],
  },
  {
    id: 'partner_independence',
    text: 'How much independence do you expect in a partner?',
    options: [
      { value: 'very_independent', label: 'Very independent: own career & social life' },
      { value: 'semi_independent', label: 'Semi-independent: shared decisions' },
      { value: 'family_centric', label: 'Family-focused: joint decisions' },
      { value: 'traditional', label: 'Traditional roles preferred' },
    ],
  },
];

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const { c } = useTheme();
  const pb = React.useMemo(() => makePb(c), [c]);
  const pct = Math.round((current / total) * 100);
  const reduced = useReduceMotion();
  const w = useSharedValue(pct);
  useEffect(() => {
    w.value = reduced ? pct : withTiming(pct, { duration: duration.content, easing: Easing.bezier(...EASE_OUT) });
  }, [pct, reduced, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View
      style={pb.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Question ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      <View style={pb.track}>
        <Animated.View style={[pb.fill, fill]} />
      </View>
      {/* textSecondary, not textMuted: this is the only visible progress readout and fails AA in muted grey. */}
      <Text variant="footnote" color="textSecondary" style={pb.label}>{current} / {total}</Text>
    </View>
  );
}

const makePb = (c: ThemeColours) => StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  track: { flex: 1, height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' },
  // Absolutely positioned and childless: the one place animating `width` is
  // allowed (an in-flow node would re-run layout for its siblings every frame).
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: c.primary, borderRadius: 3 },
  label: { minWidth: 36, textAlign: 'right' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const question = QUESTIONS[currentIdx];
  const isLast = currentIdx === QUESTIONS.length - 1;
  const answered = !!answers[question.id];

  // The question changes without a screen change. Android reads the question
  // card's live region; iOS has none, so it is announced here (one channel per
  // platform, otherwise TalkBack reads every question twice).
  useEffect(() => {
    if (currentIdx > 0 && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(`Question ${currentIdx + 1} of ${QUESTIONS.length}. ${QUESTIONS[currentIdx].text}`);
    }
  }, [currentIdx]);

  // Leaving the screen throws away up to nine answers, so it asks first. Header
  // back, Android hardware back and the iOS swipe all reach `beforeRemove`.
  const hasAnswers = Object.keys(answers).length > 0;
  const guardRef = useRef(false);
  useEffect(() => {
    guardRef.current = hasAnswers;
  }, [hasAnswers]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!guardRef.current) return;
        e.preventDefault();
        Alert.alert('Discard your answers?', 'Your answers so far will not be saved.', [
          { text: 'Keep answering', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation],
  );

  // Hardware back steps to the previous question, the same as the header arrow,
  // instead of silently closing the quiz from question nine.
  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (currentIdx > 0) {
          setCurrentIdx((i) => i - 1);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [currentIdx]),
  );

  const saveMutation = useMutation({
    mutationFn: (quizAnswers: QuizAnswer[]) =>
      updateMyProfile({ quizAnswers } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      // No claim about what the answers do: nothing on the server reads them yet.
      showToast.success('Quiz saved', 'Your answers are saved to your profile.');
      // Saved: nothing left to discard, so the leave guard must let this back through.
      guardRef.current = false;
      navigation.goBack();
    },
    onError: () => {
      showToast.error('Could not save quiz', 'Please try again.');
    },
  });

  const handleSelect = (value: string) => {
    haptics.light();
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const handleNext = () => {
    if (!answered) return;
    if (isLast) {
      const quizAnswers: QuizAnswer[] = QUESTIONS.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] || '',
      })).filter((a) => !!a.answer);
      saveMutation.mutate(quizAnswers);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (currentIdx === 0) navigation.goBack();
    else setCurrentIdx((i) => i - 1);
  };

  return (
    <Screen edges={['top', 'bottom']} style={styles.wrapper} testID="QuizScreen">
      <ScreenHeader title="Compatibility quiz" onBack={handleBack} testID="quiz" />

      <ProgressBar current={currentIdx + 1} total={QUESTIONS.length} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Question (the "N / total" progress above already says which one it is) */}
        <View style={styles.questionCard} accessibilityLiveRegion="polite">
          <Text variant="headline" color="textPrimary">{question.text}</Text>
        </View>

        {/* Options */}
        <View style={styles.options} accessibilityRole="radiogroup">
          {question.options.map((opt) => {
            const selected = answers[question.id] === opt.value;
            return (
              <PressableScale
                key={opt.value}
                scaleTo={0.98}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => handleSelect(opt.value)}
                testID={`option-${opt.value}`}
                accessibilityLabel={opt.label}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <Text
                  variant="subhead"
                  color={selected ? 'primary' : 'textSecondary'}
                  style={styles.optionText}
                >
                  {opt.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {!isLast ? (
          <Button
            title="Next"
            onPress={handleNext}
            disabled={!answered}
            haptic={false}
            testID="quiz-next"
            accessibilityLabel="Next question"
          />
        ) : (
          <Button
            title="Submit quiz"
            onPress={handleNext}
            loading={saveMutation.isPending}
            disabled={!answered}
            // The success toast fires its own haptic; one per committed action.
            haptic={false}
            testID="quiz-submit"
            accessibilityLabel="Submit quiz"
          />
        )}
      </View>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  wrapper: { backgroundColor: c.background },
  scroll: { flex: 1 },
  questionCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: c.primaryLight,
    borderRadius: borderRadius.lg,
  },
  options: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.md,
    // Was a hardcoded '#fff': a white card on a dark screen.
    backgroundColor: c.surfaceCard,
  },
  optionSelected: {
    borderColor: c.primary,
    backgroundColor: c.primaryLight,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: c.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.primary,
  },
  optionText: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
});
