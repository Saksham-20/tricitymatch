import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { showToast } from '../../utils/toast';
import { useTranslation } from 'react-i18next';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
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
      { value: 'very_important', label: 'Very important — family is central' },
      { value: 'somewhat_important', label: 'Somewhat — we visit regularly' },
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
      { value: 'homebody', label: 'Homebody — cozy evenings at home' },
      { value: 'social', label: 'Social — friends, gatherings, events' },
      { value: 'adventurous', label: 'Adventurous — travel, new experiences' },
      { value: 'balanced', label: 'Mix of all depending on mood' },
    ],
  },
  {
    id: 'financial_style',
    text: 'What is your financial philosophy?',
    options: [
      { value: 'saver', label: 'Save aggressively — security first' },
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
      { value: 'very_active', label: 'Very active — share everything' },
      { value: 'moderate', label: 'Moderate — selective sharing' },
      { value: 'private', label: 'Private — rarely post personal life' },
      { value: 'not_on_social', label: 'Not on social media' },
    ],
  },
  {
    id: 'religion_practice',
    text: 'How central is religious practice in your daily life?',
    options: [
      { value: 'very_devout', label: 'Very devout — daily rituals matter' },
      { value: 'observant', label: 'Observant — festivals & occasions' },
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
      { value: 'very_independent', label: 'Very independent — own career & social life' },
      { value: 'semi_independent', label: 'Semi-independent — shared decisions' },
      { value: 'family_centric', label: 'Family-focused — joint decisions' },
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
    <View style={pb.container}>
      <View style={pb.track}>
        <Animated.View style={[pb.fill, fill]} />
      </View>
      <Text variant="footnote" color="textMuted" style={pb.label}>{current} / {total}</Text>
    </View>
  );
}

const makePb = (c: ThemeColours) => StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  track: { flex: 1, height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: c.primary, borderRadius: 3 },
  label: { minWidth: 36 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const question = QUESTIONS[currentIdx];
  const isLast = currentIdx === QUESTIONS.length - 1;
  const answered = !!answers[question.id];

  const saveMutation = useMutation({
    mutationFn: (quizAnswers: QuizAnswer[]) =>
      updateMyProfile({ quizAnswers } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      showToast.success('Quiz saved', 'Your answers help us find better matches for you.');
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
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale
          onPress={handleBack}
          testID="quiz-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <Text variant="headline" color="textPrimary">Compatibility Quiz</Text>
        <View style={{ width: 22 }} />
      </View>

      <ProgressBar current={currentIdx + 1} total={QUESTIONS.length} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Question */}
        <View style={styles.questionCard}>
          <Text variant="caption" color="primary" style={styles.questionNumber}>Question {currentIdx + 1}</Text>
          <Text variant="headline" color="textPrimary">{question.text}</Text>
        </View>

        {/* Options */}
        <View style={styles.options}>
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
                accessibilityState={{ selected }}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <Text
                  variant="footnote"
                  color={selected ? 'primary' : 'textSecondary'}
                  style={styles.optionText}
                >
                  {opt.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {!isLast ? (
          <PressableScale
            style={[styles.nextBtn, !answered && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!answered}
            testID="quiz-next"
            accessibilityLabel="Next question"
            accessibilityRole="button"
            accessibilityState={{ disabled: !answered }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text variant="headline" style={styles.nextBtnText}>Next →</Text>
          </PressableScale>
        ) : (
          <PressableScale
            style={[styles.nextBtn, (!answered || saveMutation.isPending) && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!answered || saveMutation.isPending}
            testID="quiz-submit"
            accessibilityLabel="Submit quiz"
            accessibilityRole="button"
            accessibilityState={{ disabled: !answered || saveMutation.isPending }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text variant="headline" style={styles.nextBtnText}>Submit Quiz</Text>
            )}
          </PressableScale>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: c.background || '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'] || 32,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  scroll: { flex: 1 },
  questionCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xl || spacing.lg,
    padding: spacing.lg,
    backgroundColor: c.primaryLight,
    borderRadius: borderRadius.lg,
  },
  questionNumber: {
    marginBottom: spacing.sm,
  },
  options: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
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
  nextBtn: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: {
    color: '#fff',
  },
});
