import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import { PROFILE_PROMPTS, PromptPair, toProfilePrompts } from '../../constants/prompts';

const BIO_MAX = 500;
const TAGS_MAX = 10;

const INTEREST_TAGS = [
  'Cooking', 'Travel', 'Music', 'Reading', 'Sports', 'Fitness',
  'Movies', 'Gaming', 'Photography', 'Art', 'Dance', 'Yoga',
  'Trekking', 'Cricket', 'Badminton', 'Swimming', 'Volunteering',
  'Gardening', 'Pets', 'Technology', 'Fashion', 'Food & Dining',
  'Theatre', 'Spirituality', 'Cycling',
];

export default function Step10Screen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [bio, setBio] = useState(data.bio);
  const [selectedTags, setSelectedTags] = useState<string[]>(data.interestTags);
  // Prompts halve the "write about yourself" friction: answering a question is
  // easier than facing a blank textarea. Up to 2 here (editor allows 3).
  const [prompts, setPrompts] = useState<PromptPair[]>([]);

  const pickPrompt = (prompt: string) => {
    haptics.light();
    setPrompts((prev) => (prev.length >= 2 || prev.some((p) => p.prompt === prompt)
      ? prev
      : [...prev, { prompt, answer: '' }]));
  };
  const setAnswer = (idx: number, answer: string) =>
    setPrompts((prev) => prev.map((p, i) => (i === idx ? { ...p, answer } : p)));
  const removePrompt = (idx: number) =>
    setPrompts((prev) => prev.filter((_, i) => i !== idx));

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= TAGS_MAX) return prev;
      return [...prev, tag];
    });
  };

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const handleContinue = async () => {
    const profilePrompts = toProfilePrompts(prompts);
    await saveAndNext(
      { bio, interestTags: selectedTags },
      {
        bio,
        interestTags: selectedTags,
        ...(Object.keys(profilePrompts).length > 0 ? { profilePrompts } : {}),
      } as any,
    );
  };

  return (
    <OnboardingLayout
      step={10}
      title={t('onboarding.step10.title')}
      subtitle={t('onboarding.step10.subtitle')}
      onContinue={handleContinue}
      skippable
      onSkip={handleSkip}
    >
      {/* Bio */}
      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('onboarding.step10.bio')}</Text>
          <Text style={styles.charCount}>{bio.length}/{BIO_MAX}</Text>
        </View>
        <TextInput
          style={styles.textarea}
          value={bio}
          onChangeText={(text) => setBio(text.slice(0, BIO_MAX))}
          placeholder="Tell potential matches a bit about yourself — your values, what you're looking for, what makes you unique..."
          placeholderTextColor={c.textMuted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          autoCapitalize="sentences"
          maxLength={BIO_MAX}
          testID="input-bio"
          accessibilityLabel={t('onboarding.step10.bio')}
        />
      </View>

      {/* Prompts — pick a question, answer in a line or two */}
      <View>
        <Text style={styles.label}>{t('onboarding.step10.prompts', 'Answer a prompt')}<Text style={styles.optional}> ({t('common.optional')})</Text></Text>
        <Text style={styles.hint}>{t('onboarding.step10.promptsHint', 'Easier than a blank page — these appear on your profile.')}</Text>
        {prompts.map((p, idx) => (
          <View key={p.prompt} style={styles.promptCard}>
            <View style={styles.labelRow}>
              <Text style={styles.promptQ}>{p.prompt}</Text>
              <PressableScale scaleTo={0.9} onPress={() => removePrompt(idx)} accessibilityLabel="Remove prompt" testID={`prompt-remove-${idx}`}>
                <Text style={styles.promptRemove}>✕</Text>
              </PressableScale>
            </View>
            <TextInput
              style={styles.promptInput}
              value={p.answer}
              onChangeText={(txt) => setAnswer(idx, txt.slice(0, 200))}
              placeholder={t('onboarding.step10.promptAnswer', 'Your answer…')}
              placeholderTextColor={c.textMuted}
              multiline
              maxLength={200}
              testID={`prompt-answer-${idx}`}
            />
          </View>
        ))}
        {prompts.length < 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptChipRow}>
            {PROFILE_PROMPTS.filter((q) => !prompts.some((p) => p.prompt === q)).slice(0, 6).map((q) => (
              <PressableScale key={q} scaleTo={0.95} style={styles.promptChip} onPress={() => pickPrompt(q)} testID={`prompt-pick-${q}`} accessibilityLabel={q}>
                <Text style={styles.promptChipText}>{q}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Interest tags */}
      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('onboarding.step10.interests')}</Text>
          <Text style={styles.charCount}>{selectedTags.length}/{TAGS_MAX}</Text>
        </View>
        <Text style={styles.hint}>{t('onboarding.step10.interestsHint')}</Text>
        <View style={styles.tagGrid}>
          {INTEREST_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            const disabled = !active && selectedTags.length >= TAGS_MAX;
            return (
              <PressableScale
                key={tag}
                scaleTo={0.95}
                style={[styles.tag, active && styles.tagActive, disabled && styles.tagDisabled]}
                onPress={() => { haptics.light(); toggleTag(tag); }}
                disabled={disabled}
                testID={`tag-${tag}`}
                accessibilityLabel={tag}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
              >
                <Text style={[styles.tagText, active && styles.tagTextActive, disabled && styles.tagTextDisabled]}>
                  {tag}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  optional: { fontSize: typography.fontSize.xs, color: c.textMuted, fontFamily: typography.fontFamily.regular },
  promptCard: {
    borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md,
    backgroundColor: c.surfaceCard, padding: spacing.md, marginTop: spacing.sm,
  },
  promptQ: { flex: 1, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: c.textPrimary },
  promptRemove: { fontSize: typography.fontSize.sm, color: c.textMuted, paddingHorizontal: 6 },
  promptInput: { minHeight: 44, fontSize: typography.fontSize.sm, color: c.textPrimary, marginTop: 4 },
  promptChipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  promptChip: {
    borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.pill,
    backgroundColor: c.surfaceCard, paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  promptChipText: { fontSize: typography.fontSize.xs, color: c.textSecondary },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: c.textPrimary,
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    color: c.textMuted,
    fontFamily: typography.fontFamily.regular,
  },
  textarea: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: c.textPrimary,
    minHeight: 120,
    lineHeight: typography.fontSize.base * 1.5,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: c.textMuted,
    marginBottom: spacing.md,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.full,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagActive: {
    borderColor: c.primary,
    backgroundColor: c.primaryLight,
  },
  tagDisabled: {
    opacity: 0.4,
  },
  tagText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: c.textPrimary,
  },
  tagTextActive: {
    color: c.primary,
    fontFamily: typography.fontFamily.medium,
  },
  tagTextDisabled: {
    color: c.textMuted,
  },
});
