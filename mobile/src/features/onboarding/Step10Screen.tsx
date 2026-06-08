import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

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
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [bio, setBio] = useState(data.bio);
  const [selectedTags, setSelectedTags] = useState<string[]>(data.interestTags);

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
    await saveAndNext(
      { bio, interestTags: selectedTags },
      { bio, interestTags: selectedTags } as any,
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
          placeholderTextColor={colours.textMuted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={BIO_MAX}
          testID="input-bio"
          accessibilityLabel={t('onboarding.step10.bio')}
        />
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
              <TouchableOpacity
                key={tag}
                style={[styles.tag, active && styles.tagActive, disabled && styles.tagDisabled]}
                onPress={() => toggleTag(tag)}
                disabled={disabled}
                testID={`tag-${tag}`}
                accessibilityLabel={tag}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
              >
                <Text style={[styles.tagText, active && styles.tagTextActive, disabled && styles.tagTextDisabled]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    minHeight: 120,
    lineHeight: typography.fontSize.base * 1.5,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
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
    borderColor: colours.border,
    borderRadius: borderRadius.full,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagActive: {
    borderColor: colours.primary,
    backgroundColor: colours.primaryLight,
  },
  tagDisabled: {
    opacity: 0.4,
  },
  tagText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textPrimary,
  },
  tagTextActive: {
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  tagTextDisabled: {
    color: colours.textMuted,
  },
});
