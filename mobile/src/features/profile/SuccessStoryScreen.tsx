import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '../../utils/toast';
import { useNavigation } from '@react-navigation/native';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { submitSuccessStory } from '../../api/profile';

export default function SuccessStoryScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const nav = useNavigation();
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [story, setStory] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState(false);

  const submitMut = useMutation({
    mutationFn: () =>
      submitSuccessStory({
        groomName: groomName.trim(),
        brideName: brideName.trim(),
        weddingDate: weddingDate.trim(),
        story: story.trim(),
        photoUri: photoUri ?? undefined,
      }),
    onSuccess: () => setSubmitted(true),
    onError: () => showToast.error('Could not submit', 'Failed to submit story. Try again.'),
  });

  const handlePickPhoto = () => {
    // expo-image-picker requires native build
    Alert.alert(
      'Photo Upload',
      'Photo upload requires a native build (EAS). Your story will be submitted without a photo.',
      [{ text: 'OK' }]
    );
  };

  const handleSubmit = () => {
    if (!groomName.trim() || !brideName.trim()) {
      showToast.error('Names required', 'Please enter both names.'); return;
    }
    if (!story.trim() || story.trim().length < 20) {
      showToast.error('Story too short', 'Please share a bit more about your journey (min 20 characters).'); return;
    }
    if (!consent) {
      showToast.error('Consent needed', 'Please agree to the publishing terms to submit your story.'); return;
    }
    submitMut.mutate();
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.safe} testID="SuccessStoryScreen-success">
        <View style={s.successContainer}>
          <View style={s.successIcon}>
            <Ionicons name="heart" size={48} color={c.primary} />
          </View>
          <Text style={s.successTitle}>Story Submitted!</Text>
          <Text style={s.successBody}>
            Thank you for sharing your journey. Our team will review and publish your story shortly.
          </Text>
          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => nav.goBack()}
            testID="done-btn"
          >
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} testID="SuccessStoryScreen">
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Share Your Story</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.subtitle}>
          Inspire others by sharing your TricityMatch success story!
        </Text>

        {/* Names */}
        <Text style={s.label}>Groom's Name *</Text>
        <TextInput
          style={s.input}
          value={groomName}
          onChangeText={setGroomName}
          placeholder="Rahul Sharma"
          placeholderTextColor={c.textMuted}
          maxLength={60}
          testID="groom-name"
          accessibilityLabel="Groom's name"
        />

        <Text style={s.label}>Bride's Name *</Text>
        <TextInput
          style={s.input}
          value={brideName}
          onChangeText={setBrideName}
          placeholder="Priya Verma"
          placeholderTextColor={c.textMuted}
          maxLength={60}
          testID="bride-name"
          accessibilityLabel="Bride's name"
        />

        <Text style={s.label}>Wedding Date</Text>
        <TextInput
          style={s.input}
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
          }}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={c.textMuted}
          maxLength={10}
          keyboardType="numeric"
          testID="wedding-date"
          accessibilityLabel="Wedding date"
        />

        <Text style={s.label}>Your Story *</Text>
        <TextInput
          style={s.storyInput}
          value={story}
          onChangeText={setStory}
          placeholder="How did you find each other on TricityMatch? Share your journey..."
          placeholderTextColor={c.textMuted}
          multiline
          maxLength={1000}
          textAlignVertical="top"
          testID="story-text"
          accessibilityLabel="Your story"
        />
        <Text style={s.charCount}>{story.length}/1000</Text>

        {/* Photo (stub — needs native build) */}
        <Text style={s.label}>Wedding Photo (optional)</Text>
        <TouchableOpacity style={s.photoBtn} onPress={handlePickPhoto} testID="photo-btn">
          {photoUri ? (
            <Text style={s.photoText}>Photo selected</Text>
          ) : (
            <>
              <Ionicons name="image-outline" size={24} color={c.textMuted} />
              <Text style={s.photoText}>Add a photo</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.consentRow}
          onPress={() => setConsent((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          testID="consent-checkbox"
        >
          <Ionicons
            name={consent ? 'checkbox' : 'square-outline'}
            size={22}
            color={consent ? c.primary : c.textMuted}
          />
          <Text style={s.consentText}>
            I agree to the{' '}
            <Text style={s.link} onPress={() => (nav as any).navigate('Terms')} accessibilityRole="link">Terms &amp; Conditions</Text>
            {' '}and{' '}
            <Text style={s.link} onPress={() => (nav as any).navigate('Privacy')} accessibilityRole="link">Privacy Policy</Text>
            , and consent to TricityMatch publishing our names, story and photo. I can withdraw this any time by contacting support.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.submitBtn, submitMut.isPending && s.disabled]}
          onPress={handleSubmit}
          disabled={submitMut.isPending}
          testID="submit-btn"
        >
          {submitMut.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="heart-outline" size={18} color="#fff" />
              <Text style={s.submitBtnText}>Submit Story</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: c.textPrimary,
  },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: c.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: c.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: c.textPrimary,
    backgroundColor: c.surfaceCard,
  },
  storyInput: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: c.textPrimary,
    backgroundColor: c.surfaceCard,
    minHeight: 120,
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: c.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    backgroundColor: c.surfaceCard,
  },
  photoText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: c.textSecondary,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  consentText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: c.textSecondary,
    lineHeight: 20,
  },
  link: { color: c.primary, fontFamily: typography.fontFamily.semiBold },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  submitBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
  disabled: { opacity: 0.6 },
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
  successTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: c.textPrimary,
  },
  successBody: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  doneBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  doneBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: '#fff',
  },
});
