import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { submitSuccessStory } from '../../api/profile';

export default function SuccessStoryScreen() {
  const nav = useNavigation();
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [story, setStory] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
    onError: () => Alert.alert('Error', 'Failed to submit story. Try again.'),
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
      Alert.alert('Required', 'Please enter both names.'); return;
    }
    if (!story.trim() || story.trim().length < 20) {
      Alert.alert('Story too short', 'Please share a bit more about your journey (min 20 characters).'); return;
    }
    submitMut.mutate();
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.safe} testID="SuccessStoryScreen-success">
        <View style={s.successContainer}>
          <View style={s.successIcon}>
            <Ionicons name="heart" size={48} color={colours.primary} />
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
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Share Your Story</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.subtitle}>
          Inspire others by sharing your TricityShadi success story!
        </Text>

        {/* Names */}
        <Text style={s.label}>Groom's Name *</Text>
        <TextInput
          style={s.input}
          value={groomName}
          onChangeText={setGroomName}
          placeholder="Rahul Sharma"
          placeholderTextColor={colours.textMuted}
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
          placeholderTextColor={colours.textMuted}
          maxLength={60}
          testID="bride-name"
          accessibilityLabel="Bride's name"
        />

        <Text style={s.label}>Wedding Date</Text>
        <TextInput
          style={s.input}
          value={weddingDate}
          onChangeText={setWeddingDate}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colours.textMuted}
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
          placeholder="How did you find each other on TricityShadi? Share your journey..."
          placeholderTextColor={colours.textMuted}
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
              <Ionicons name="image-outline" size={24} color={colours.textMuted} />
              <Text style={s.photoText}>Add a photo</Text>
            </>
          )}
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textPrimary,
    backgroundColor: colours.surfaceCard,
  },
  storyInput: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colours.textPrimary,
    backgroundColor: colours.surfaceCard,
    minHeight: 120,
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colours.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    backgroundColor: colours.surfaceCard,
  },
  photoText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textSecondary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colours.primary,
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
    backgroundColor: colours.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
  },
  successBody: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colours.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  doneBtn: {
    backgroundColor: colours.primary,
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
