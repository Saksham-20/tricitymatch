import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { useOnboarding } from './OnboardingContext';
import { uploadPhoto } from '../../api/profile';

const MAX_PHOTOS = 6;
const SLOT_SIZE = 104;

export default function Step12Screen() {
  const { t } = useTranslation();
  const { saveAndNext, goBack, currentStep } = useOnboarding();

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState<number | null>(null); // index currently uploading

  const isValid = photos.length > 0;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('common.permissionRequired'),
        t('onboarding.step12.photoPermission'),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 5],
    });
    if (result.canceled || !result.assets?.[0]) return;

    const slotIndex = photos.length;
    setUploading(slotIndex);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: `photo_${slotIndex}.jpg`,
      } as any);
      const { url } = await uploadPhoto(formData);
      setPhotos((prev) => [...prev, url]);
    } catch {
      Alert.alert(t('common.error'), t('onboarding.step12.uploadError'));
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = (index: number) => {
    Alert.alert(
      t('onboarding.step12.removeTitle'),
      t('onboarding.step12.removeMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => setPhotos((prev) => prev.filter((_, i) => i !== index)),
        },
      ],
    );
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    setPhotos((prev) => {
      const next = [...prev];
      const tmp = next[from];
      next[from] = next[to];
      next[to] = tmp;
      return next;
    });
  };

  const handleContinue = async () => {
    await saveAndNext(
      { photos },
      { photos, profilePhoto: photos[0] ?? null } as any,
    );
  };

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  // Render grid: filled slots + one empty slot (if < MAX)
  const slots = Array.from({ length: Math.min(photos.length + 1, MAX_PHOTOS) });

  return (
    <SafeAreaView style={styles.safe} testID="OnboardingStep12">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} testID="btn-back" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepLabel}>{t('onboarding.progress', { current: 12, total: 14 })}</Text>
        <TouchableOpacity onPress={handleSkip} testID="btn-skip" accessibilityLabel={t('common.skip')}>
          <Text style={styles.skipText}>{t('common.skip')}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(12 / 14) * 100}%` as any }]} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{t('onboarding.step12.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.step12.subtitle')}</Text>

        {/* Guidelines */}
        <View style={styles.guidelines}>
          {[
            t('onboarding.step12.guide1'),
            t('onboarding.step12.guide2'),
            t('onboarding.step12.guide3'),
          ].map((g, i) => (
            <View key={i} style={styles.guideRow}>
              <Ionicons name="checkmark-circle" size={16} color={colours.success} />
              <Text style={styles.guideText}>{g}</Text>
            </View>
          ))}
        </View>

        {/* Photo grid */}
        <View style={styles.grid}>
          {slots.map((_, i) => {
            const isUploadSlot = i === photos.length;
            const photo = photos[i];
            const isLoading = uploading === i;

            if (isUploadSlot) {
              return (
                <TouchableOpacity
                  key={`slot-${i}`}
                  style={styles.addSlot}
                  onPress={pickImage}
                  disabled={uploading !== null}
                  testID="btn-addPhoto"
                  accessibilityLabel={t('onboarding.step12.addPhoto')}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colours.primary} />
                  ) : (
                    <>
                      <Ionicons name="add" size={32} color={colours.primary} />
                      <Text style={styles.addSlotText}>
                        {i === 0 ? t('onboarding.step12.addFirst') : t('onboarding.step12.addMore')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            }

            return (
              <View key={`photo-${i}`} style={styles.photoSlot}>
                <Image source={{ uri: photo }} style={styles.photoImg} resizeMode="cover" />

                {/* Primary badge */}
                {i === 0 && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>{t('onboarding.step12.primary')}</Text>
                  </View>
                )}

                {/* Remove button */}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removePhoto(i)}
                  testID={`btn-remove-${i}`}
                  accessibilityLabel={t('onboarding.step12.removePhoto')}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </TouchableOpacity>

                {/* Reorder buttons */}
                <View style={styles.reorderBtns}>
                  {i > 0 && (
                    <TouchableOpacity
                      style={styles.reorderBtn}
                      onPress={() => movePhoto(i, i - 1)}
                      testID={`btn-move-left-${i}`}
                      accessibilityLabel="Move photo left"
                    >
                      <Ionicons name="chevron-back" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {i < photos.length - 1 && (
                    <TouchableOpacity
                      style={styles.reorderBtn}
                      onPress={() => movePhoto(i, i + 1)}
                      testID={`btn-move-right-${i}`}
                      accessibilityLabel="Move photo right"
                    >
                      <Ionicons name="chevron-forward" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.countHint}>
          {t('onboarding.step12.count', { count: photos.length, max: MAX_PHOTOS })}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, !isValid && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!isValid}
          testID="btn-continue"
          accessibilityLabel={t('onboarding.saveAndContinue')}
        >
          <Text style={styles.continueBtnText}>{t('onboarding.saveAndContinue')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepLabel: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  skipText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colours.border,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colours.primary,
    borderRadius: borderRadius.full,
  },
  body: { flex: 1, padding: spacing.lg },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colours.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colours.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: typography.fontSize.base * 1.5,
  },
  guidelines: { gap: spacing.xs, marginBottom: spacing['2xl'] },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guideText: {
    fontSize: typography.fontSize.sm,
    color: colours.textSecondary,
    fontFamily: typography.fontFamily.regular,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoSlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'visible',
    position: 'relative',
  },
  photoImg: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: borderRadius.md,
  },
  addSlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colours.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colours.primaryLight,
  },
  addSlotText: {
    fontSize: typography.fontSize.xs,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colours.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryBadgeText: {
    fontSize: typography.fontSize.xs,
    color: '#fff',
    fontFamily: typography.fontFamily.semiBold,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colours.error,
    borderRadius: borderRadius.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtns: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    gap: 2,
  },
  reorderBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: borderRadius.sm,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countHint: {
    fontSize: typography.fontSize.xs,
    color: colours.textMuted,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colours.border,
    backgroundColor: colours.background,
  },
  continueBtn: {
    backgroundColor: colours.primary,
    borderRadius: borderRadius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
  },
});
