import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  AccessibilityInfo,
  Platform,
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Screen from '../../components/layout/Screen';
import { PressableScale } from '../../components/motion';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { submitSuccessStory } from '../../api/profile';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// Decorative glyphs sit beside a text label; the screen reader reads the label.
const HIDE_FROM_A11Y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const MIN_STORY_CHARS = 20;

/** DD/MM/YYYY that is a real calendar date (the numeric keypad has no "/", so the field auto-inserts them). */
const isValidWeddingDate = (v: string): boolean => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === mo - 1 &&
    dt.getDate() === d &&
    y >= 1950 &&
    y <= new Date().getFullYear() + 1
  );
};

/**
 * DD/MM/YYYY -> YYYY-MM-DD. The field asks for the first, the server validates
 * `isISO8601` and rejects it, so a member who filled the date in exactly as
 * instructed got a 400 and an error that no retry could clear.
 */
const toIsoDate = (v: string): string | undefined => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};

/** Names the real reason a submission failed rather than blaming the connection for everything. */
const submitFailureMessage = (err: unknown): string => {
  const e = err as {
    retryAfter?: number;
    response?: { data?: { error?: { message?: string }; message?: string } };
  };
  // api/client rewrites a 429 into a plain Error carrying `retryAfter` (no `response`).
  if (e?.retryAfter) return 'Too many submissions from this connection. Please try again later.';
  if (!e?.response) return 'Could not reach the server. Check your connection and try again.';
  const message = e.response.data?.error?.message ?? e.response.data?.message;
  // Production sends only "Validation failed" for a bad field; that says nothing.
  if (message && message !== 'Validation failed') return message;
  return 'We could not accept your story. Check the details and try again.';
};

interface FieldErrors {
  groom?: string;
  bride?: string;
  weddingDate?: string;
  story?: string;
  consent?: string;
}

export default function SuccessStoryScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const nav = useNavigation<Nav>();
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [story, setStory] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // This screen is presented as a native modal, which sits above the app-root
  // toast host on iOS — so every message here is inline, never a toast.
  const submitMut = useMutation({
    mutationFn: () =>
      submitSuccessStory({
        groomName: groomName.trim(),
        brideName: brideName.trim(),
        weddingDate: toIsoDate(weddingDate.trim()) ?? '',
        story: story.trim(),
      }),
    onSuccess: () => {
      setSubmitted(true);
      AccessibilityInfo.announceForAccessibility('Story submitted. Our team will review it.');
    },
  });

  // A failed submit appears without a tap. Android reads the banner's live
  // region; iOS has none, so it is announced here (one channel per platform).
  const submitError = submitMut.isError ? submitFailureMessage(submitMut.error) : null;
  useEffect(() => {
    if (submitError && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(submitError);
  }, [submitError]);

  const clearError = (key: keyof FieldErrors) =>
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const handleSubmit = () => {
    const next: FieldErrors = {};
    if (!groomName.trim()) next.groom = "Enter the groom's name.";
    if (!brideName.trim()) next.bride = "Enter the bride's name.";
    if (weddingDate.trim() && !isValidWeddingDate(weddingDate.trim())) {
      next.weddingDate = 'Use the format DD/MM/YYYY, or leave it empty.';
    }
    if (story.trim().length < MIN_STORY_CHARS) {
      next.story = `Tell us a little more about your journey (at least ${MIN_STORY_CHARS} characters).`;
    }
    if (!consent) next.consent = 'Please agree to the terms to submit your story.';
    setErrors(next);
    const first = Object.values(next).find(Boolean);
    if (first) {
      AccessibilityInfo.announceForAccessibility(first);
      return;
    }
    submitMut.mutate();
  };

  if (submitted) {
    return (
      <Screen edges={['top', 'bottom']} style={s.safe} testID="SuccessStoryScreen-success">
        <View style={s.successContainer}>
          <View style={s.successIcon} {...HIDE_FROM_A11Y}>
            <Ionicons name="heart" size={48} color={c.primary} />
          </View>
          <Text variant="title2" color="textPrimary" accessibilityRole="header">Story submitted</Text>
          <Text variant="callout" color="textSecondary" style={s.successBody}>
            Thank you for sharing your journey. Our team will review and publish your story shortly.
          </Text>
          <Button title="Done" haptic={false} onPress={() => nav.goBack()} testID="done-btn" style={s.doneBtn} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard style={s.safe} testID="SuccessStoryScreen">
      <ScreenHeader title="Share your story" testID="success-story-header" />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text variant="footnote" color="textSecondary" style={s.subtitle}>
          Inspire others by sharing your TricityMatch success story.
        </Text>

        {/* Names */}
        <Input
          label="Groom's name"
          value={groomName}
          onChangeText={(v) => { setGroomName(v); clearError('groom'); }}
          placeholder="Rahul Sharma"
          maxLength={60}
          error={errors.groom}
          testID="groom-name"
          accessibilityLabel="Groom's name"
        />

        <Input
          label="Bride's name"
          value={brideName}
          onChangeText={(v) => { setBrideName(v); clearError('bride'); }}
          placeholder="Priya Verma"
          maxLength={60}
          error={errors.bride}
          testID="bride-name"
          accessibilityLabel="Bride's name"
        />

        <Input
          label="Wedding date (optional)"
          value={weddingDate}
          // Numeric keypad has no "/" key, so the separators have to be
          // inserted for the user (same trap as onboarding step 1).
          onChangeText={(raw) => {
            const digits = raw.replace(/\D/g, '').slice(0, 8);
            setWeddingDate(
              digits.length <= 2
                ? digits
                : digits.length <= 4
                  ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                  : `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`,
            );
            clearError('weddingDate');
          }}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          keyboardType="numeric"
          error={errors.weddingDate}
          testID="wedding-date"
          accessibilityLabel="Wedding date (optional)"
        />

        <Input
          label="Your story"
          style={s.storyInput}
          value={story}
          onChangeText={(v) => { setStory(v); clearError('story'); }}
          placeholder="How did you find each other on TricityMatch? Share your journey..."
          multiline
          maxLength={1000}
          textAlignVertical="top"
          error={errors.story}
          testID="story-text"
          accessibilityLabel="Your story"
        />
        <Text variant="footnote" color="textSecondary" style={s.charCount}>{story.length}/1000</Text>

        <PressableScale
          style={s.consentRow}
          onPress={() => { setConsent((v) => !v); clearError('consent'); }}
          accessibilityRole="checkbox"
          accessibilityLabel="I agree to the Terms and Conditions and Privacy Policy, and consent to TricityMatch publishing our names, story and photo"
          accessibilityState={{ checked: consent }}
          testID="consent-checkbox"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={consent ? 'checkbox' : 'square-outline'}
            size={22}
            color={consent ? c.primary : c.textMuted}
            {...HIDE_FROM_A11Y}
          />
          <Text variant="footnote" color="textSecondary" style={s.consentText}>
            I agree to the Terms &amp; Conditions and Privacy Policy, and consent to TricityMatch publishing our names, story and photo. I can withdraw this any time by contacting support.
          </Text>
        </PressableScale>
        {/* The links sit outside the checkbox row: a link nested inside an
            accessible control cannot be reached by a screen reader. */}
        <View style={s.linkRow}>
          <Button
            title="Terms & Conditions"
            variant="text"
            size="sm"
            haptic={false}
            onPress={() => nav.navigate('Terms')}
            accessibilityLabel="Read the Terms and Conditions"
            testID="consent-terms-link"
          />
          <Button
            title="Privacy Policy"
            variant="text"
            size="sm"
            haptic={false}
            onPress={() => nav.navigate('Privacy')}
            accessibilityLabel="Read the Privacy Policy"
            testID="consent-privacy-link"
          />
        </View>
        {errors.consent ? (
          <Text variant="caption" color="error" style={s.consentError} accessibilityRole="alert">{errors.consent}</Text>
        ) : null}

        {submitError ? (
          <View style={s.errorBanner} testID="story-submit-error" accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={15} color={c.error} {...HIDE_FROM_A11Y} />
            <Text variant="footnote" color="error" style={s.errorText}>
              {submitError}
            </Text>
          </View>
        ) : null}

        <Button
          title="Submit story"
          icon="heart-outline"
          onPress={handleSubmit}
          loading={submitMut.isPending}
          testID="submit-btn"
          style={s.submitBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  safe: { backgroundColor: c.background },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  subtitle: {
    marginBottom: spacing.sm,
  },
  storyInput: {
    minHeight: 120,
  },
  charCount: {
    textAlign: 'right',
    marginTop: 2,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.lg,
  },
  consentText: {
    flex: 1,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  consentError: {
    marginTop: spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: c.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: { flex: 1 },
  submitBtn: {
    marginTop: spacing.lg,
  },
  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBody: {
    textAlign: 'center',
  },
  doneBtn: {
    minWidth: 180,
  },
});
