import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { AccessibilityInfo, Platform, View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import { EmptyState, SkeletonBlock, SkeletonFade } from '../../components/ui';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import { haptics } from '../../utils/haptics';
import { tapSize } from '../../utils/elderTheme';
import OnboardingLayout, { flushField } from './OnboardingLayout';
import { useOnboarding, type JourneyProfilePatch } from './OnboardingContext';
import { PROFILE_PROMPTS, PromptPair, fromProfilePrompts, toProfilePrompts } from '../../constants/prompts';
import { queryKeys } from '../../constants/queryKeys';
import { getMyProfile } from '../../api/profile';

const BIO_MAX = 500;
const TAGS_MAX = 10;
const PROMPTS_MAX = 2;

// A drifting finger must not cancel a press (doctrine §10.8).
const RETAIN = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const INTEREST_TAGS = [
  'Cooking', 'Travel', 'Music', 'Reading', 'Sports', 'Fitness',
  'Movies', 'Gaming', 'Photography', 'Art', 'Dance', 'Yoga',
  'Trekking', 'Cricket', 'Badminton', 'Swimming', 'Volunteering',
  'Gardening', 'Pets', 'Technology', 'Fashion', 'Food & Dining',
  'Theatre', 'Spirituality', 'Cycling',
];

// Skeleton shapes for the prompt chips and the tag grid, so the placeholder has
// the same footprint as the content that replaces it.
const SKELETON_CHIP_WIDTHS = [150, 130] as const;
const SKELETON_TAG_WIDTHS = [72, 96, 64, 88, 80, 104, 68, 92, 76, 84] as const;

export default function Step10Screen() {
  const { c, elder } = useTheme();
  const tap = tapSize(elder);
  const styles = React.useMemo(() => makeStyles(c, tap), [c, tap]);
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [bio, setBio] = useState(data.bio);
  const [selectedTags, setSelectedTags] = useState<string[]>(data.interestTags);
  // Prompts halve the "write about yourself" friction: answering a question is
  // easier than facing a blank textarea. Up to 2 here (editor allows 3).
  const [prompts, setPrompts] = useState<PromptPair[]>([]);
  // The prompt the member just added: its field takes focus so they can type at once.
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // The journey context hydrates the bio but not tags or prompts, and the server
  // replaces those wholesale, so a member coming back here would save over what
  // they already had. Fill an untouched list from the saved profile instead.
  // Per-list "touched" refs keep a late response from undoing a choice.
  const {
    data: saved,
    isError: savedError,
    isFetching: savedFetching,
    refetch: refetchSaved,
  } = useQuery({ queryKey: queryKeys.myProfile, queryFn: getMyProfile });
  const bioTouched = useRef(false);
  const tagsTouched = useRef(false);
  const promptsTouched = useRef(false);
  useEffect(() => {
    if (!saved) return;
    if (!tagsTouched.current) {
      setSelectedTags((prev) => (prev.length > 0 ? prev : saved.interestTags ?? []));
    }
    if (!promptsTouched.current) {
      setPrompts((prev) => (
        prev.length > 0 ? prev : fromProfilePrompts(saved.profilePrompts as Record<string, string> | null)
      ));
    }
  }, [saved]);

  // Until the saved tags and prompts have arrived the member cannot see what a
  // save would replace, so those two sections stay a skeleton (or an error with
  // a retry) instead of being editable. A retry counts as loading again.
  const savedReady = !!saved;
  const savedFailed = !savedReady && savedError && !savedFetching;
  // When the answers were already cached the sections are simply there; the
  // cross-fade only belongs to a real skeleton-to-content swap.
  const settledFromCache = useRef(savedReady).current;

  const loadErrorTitle = t('onboarding.loadFailedTitle', "Couldn't load your saved answers");
  useEffect(() => {
    // Android reads the live region below; iOS VoiceOver only hears an explicit announce.
    if (savedFailed && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(loadErrorTitle);
  }, [savedFailed, loadErrorTitle]);

  const atTagLimit = selectedTags.length >= TAGS_MAX;
  const tagsLimitText = t('onboarding.step10.tagsLimit', {
    count: TAGS_MAX,
    defaultValue: 'You can pick up to {{count}}. Tap a selected one to remove it.',
  });
  // A saved tag that is not in this list still has to be visible, or it would
  // count toward the limit with no chip to tap to remove it.
  const tagOptions = [...INTEREST_TAGS, ...selectedTags.filter((tag) => !INTEREST_TAGS.includes(tag))];

  const pickPrompt = (prompt: string) => {
    if (prompts.length >= PROMPTS_MAX || prompts.some((p) => p.prompt === prompt)) return;
    haptics.light();
    promptsTouched.current = true;
    setPrompts((prev) => [...prev, { prompt, answer: '' }]);
    setJustAdded(prompt);
    // The card appears above the chip that was tapped, with no focus change of its own.
    AccessibilityInfo.announceForAccessibility(
      t('onboarding.step10.promptAdded', 'Prompt added. Type your answer.'),
    );
  };
  const setAnswer = (idx: number, answer: string) => {
    promptsTouched.current = true;
    setPrompts((prev) => prev.map((p, i) => (i === idx ? { ...p, answer } : p)));
  };
  const removePrompt = (idx: number) => {
    promptsTouched.current = true;
    setPrompts((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleTag = (tag: string) => {
    const active = selectedTags.includes(tag);
    if (!active && atTagLimit) return;
    haptics.light();
    tagsTouched.current = true;
    const next = active ? selectedTags.filter((x) => x !== tag) : [...selectedTags, tag];
    setSelectedTags(next);
    // The tags go disabled with no tap involved, so say why out loud.
    if (!active && next.length === TAGS_MAX) AccessibilityInfo.announceForAccessibility(tagsLimitText);
  };

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const handleContinue = async () => {
    const profilePatch: JourneyProfilePatch = {};
    // The bio goes only once the member has edited it. It is hydrated from the
    // journey context, and if that load failed the box shows empty over a saved
    // bio, so sending it untouched would write '' over the real one.
    if (bioTouched.current) profilePatch.bio = bio;
    // The server replaces tags and prompts wholesale, so they are sent only once
    // the saved ones have loaded and what is on screen is the truth. An empty
    // selection still means "no answer", not "clear my tags".
    if (savedReady) {
      const profilePrompts = toProfilePrompts(prompts);
      if (selectedTags.length > 0) profilePatch.interestTags = selectedTags;
      if (Object.keys(profilePrompts).length > 0) profilePatch.profilePrompts = profilePrompts;
    }
    await saveAndNext({ bio, interestTags: selectedTags }, profilePatch);
  };

  const promptsAndTags = (
    <>
      {/* Prompts: pick a question, answer in a line or two */}
      <View>
        <Text variant="subhead" color="textPrimary">
          {t('onboarding.step10.prompts', 'Answer a prompt')}
          <Text variant="footnote" color="textSecondary"> ({t('common.optional')})</Text>
        </Text>
        <Text variant="footnote" color="textSecondary" style={styles.hint}>
          {t('onboarding.step10.promptsHintShort', 'Easier than a blank page. These appear on your profile.')}
        </Text>
        {prompts.map((p, idx) => (
          <View key={p.prompt} style={styles.promptCard}>
            <View style={styles.promptHead}>
              <Text variant="subhead" color="textPrimary" style={styles.promptQ}>{p.prompt}</Text>
              {/* A real tap-sized box, not an icon padded out by hitSlop. */}
              <PressableScale
                style={styles.promptRemove}
                onPress={() => removePrompt(idx)}
                accessibilityRole="button"
                accessibilityLabel={`${t('onboarding.step10.removePrompt', 'Remove prompt')}: ${p.prompt}`}
                pressRetentionOffset={RETAIN}
                testID={`prompt-remove-${idx}`}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={c.textSecondary}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              </PressableScale>
            </View>
            <Input
              containerStyle={styles.promptInputContainer}
              value={p.answer}
              onChangeText={(txt) => setAnswer(idx, txt.slice(0, 200))}
              placeholder={t('onboarding.step10.promptAnswer', 'Your answer…')}
              multiline
              maxLength={200}
              autoFocus={p.prompt === justAdded}
              testID={`prompt-answer-${idx}`}
              accessibilityLabel={p.prompt}
            />
          </View>
        ))}
        {prompts.length < PROMPTS_MAX && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promptChipRow}
            // A nested ScrollView defaults to 'never', which swallows the first
            // tap while the bio keyboard is up (the outer one is 'handled').
            keyboardShouldPersistTaps="handled"
          >
            {PROFILE_PROMPTS.filter((q) => !prompts.some((p) => p.prompt === q)).slice(0, 6).map((q) => (
              <PressableScale
                key={q}
                style={styles.promptChip}
                onPress={() => pickPrompt(q)}
                testID={`prompt-pick-${q}`}
                accessibilityRole="button"
                accessibilityLabel={q}
                pressRetentionOffset={RETAIN}
              >
                <Text variant="footnote" color="textSecondary">{q}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Interest tags */}
      <View>
        <View style={styles.labelRow}>
          <Text variant="subhead" color="textPrimary" style={styles.labelText}>{t('onboarding.step10.interests')}</Text>
          <Text variant="footnote" color="textSecondary">{selectedTags.length}/{TAGS_MAX}</Text>
        </View>
        <Text variant="footnote" color={atTagLimit ? 'textPrimary' : 'textSecondary'} style={styles.hint}>
          {atTagLimit ? tagsLimitText : t('onboarding.step10.interestsHint')}
        </Text>
        <View style={styles.tagGrid}>
          {tagOptions.map((tag) => {
            const active = selectedTags.includes(tag);
            const disabled = !active && atTagLimit;
            return (
              <PressableScale
                key={tag}
                style={[styles.tag, active && styles.tagActive, disabled && styles.tagDisabled]}
                onPress={() => toggleTag(tag)}
                disabled={disabled}
                testID={`tag-${tag}`}
                accessibilityLabel={tag}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active, disabled }}
                pressRetentionOffset={RETAIN}
              >
                <Text variant="footnote" color={active ? 'primary' : disabled ? 'textMuted' : 'textPrimary'}>
                  {tag}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </>
  );

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
          <Text variant="subhead" color="textPrimary" style={styles.labelText}>{t('onboarding.step10.bio')}</Text>
          <Text variant="footnote" color="textSecondary">{bio.length}/{BIO_MAX}</Text>
        </View>
        <Input
          containerStyle={flushField}
          style={styles.textarea}
          value={bio}
          onChangeText={(text) => {
            bioTouched.current = true;
            setBio(text.slice(0, BIO_MAX));
          }}
          placeholder={t('onboarding.step10.bioPlaceholder')}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          autoCapitalize="sentences"
          maxLength={BIO_MAX}
          testID="input-bio"
          accessibilityLabel={t('onboarding.step10.bio')}
        />
      </View>

      {savedReady ? (
        settledFromCache ? (
          <View style={styles.sections}>{promptsAndTags}</View>
        ) : (
          <SkeletonFade style={styles.sections}>{promptsAndTags}</SkeletonFade>
        )
      ) : savedFailed ? (
        // Content that appears without a tap: a live region says so on Android.
        <View accessibilityLiveRegion="polite" testID="saved-error">
          <EmptyState
            variant="error"
            icon="cloud-offline-outline"
            title={loadErrorTitle}
            description={t('onboarding.loadFailedBody', 'Check your connection, then tap again.')}
            actionLabel={t('common.retry')}
            onAction={() => { refetchSaved(); }}
            testID="saved-error-state"
          />
        </View>
      ) : (
        <View
          style={styles.sections}
          accessible
          accessibilityLabel={t('common.loading')}
          accessibilityState={{ busy: true }}
          testID="saved-skeleton"
        >
          <View>
            <SkeletonBlock width="45%" height={16} />
            <SkeletonBlock width="80%" height={12} style={styles.skeletonGap} />
            <View style={styles.skeletonRow}>
              {SKELETON_CHIP_WIDTHS.map((w) => (
                <SkeletonBlock key={w} width={w} height={tap} radius={borderRadius.pill} />
              ))}
            </View>
          </View>
          <View>
            <SkeletonBlock width="35%" height={16} />
            <SkeletonBlock width="70%" height={12} style={styles.skeletonGap} />
            <View style={styles.skeletonRow}>
              {SKELETON_TAG_WIDTHS.map((w) => (
                <SkeletonBlock key={w} width={w} height={tap} radius={borderRadius.pill} />
              ))}
            </View>
          </View>
        </View>
      )}
    </OnboardingLayout>
  );
}

const makeStyles = (c: ThemeColours, tap: number) => StyleSheet.create({
  // The layout's own gap does not reach inside a wrapper, so the two sections
  // (and their skeleton) carry the same rhythm themselves.
  sections: { gap: spacing.lg },
  skeletonGap: { marginTop: spacing.sm },
  skeletonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  // Grouped by fill alone: the Input inside carries its own border, so a second
  // one on the card would box the field twice.
  promptCard: {
    borderRadius: borderRadius.md,
    backgroundColor: c.surface2, padding: spacing.md, marginTop: spacing.sm,
  },
  promptHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promptQ: { flex: 1 },
  // No negative margin to pull the icon toward the card edge: the part of the box
  // that hung outside the row would lie outside its parent, where a touch is never
  // delivered, so the target would be `tap` minus that overhang.
  promptRemove: {
    width: tap,
    height: tap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptInputContainer: { marginTop: 4, marginBottom: 0 },
  promptChipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  promptChip: {
    borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.pill,
    backgroundColor: c.surfaceCard, paddingHorizontal: spacing.md, paddingVertical: 8,
    minHeight: tap, justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  // A longer hi/pa label must shrink and wrap rather than push the counter out.
  labelText: { flexShrink: 1, marginRight: spacing.sm },
  textarea: {
    minHeight: 120,
  },
  hint: {
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
    minHeight: tap,
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
});
