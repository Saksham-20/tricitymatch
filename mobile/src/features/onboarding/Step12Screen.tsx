import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View, StyleSheet, Image,
  Alert, ActivityIndicator,
} from 'react-native';
import Text from '../../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/motion';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { useOnboarding } from './OnboardingContext';
import { uploadPhoto } from '../../api/profile';

const MAX_PHOTOS = 6;
const SLOT_SIZE = 104;

export default function Step12Screen() {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
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
      formData.append('photos', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: `photo_${slotIndex}.jpg`,
      } as any);
      const { url } = await uploadPhoto(formData, 'photos');
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
        <PressableScale
          scaleTo={0.92}
          onPress={goBack}
          style={styles.backBtn}
          testID="btn-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
        </PressableScale>
        <Text variant="subhead" color="textSecondary">{t('onboarding.progress', { current: 12, total: 14 })}</Text>
        <PressableScale
          onPress={handleSkip}
          testID="btn-skip"
          accessibilityRole="button"
          accessibilityLabel={t('common.skip')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="subhead" color="primary">{t('common.skip')}</Text>
        </PressableScale>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(12 / 14) * 100}%` as any }]} />
      </View>

      <View style={styles.body}>
        <Text variant="title2" color="textPrimary" style={styles.title}>{t('onboarding.step12.title')}</Text>
        <Text variant="callout" color="textSecondary" style={styles.subtitle}>{t('onboarding.step12.subtitle')}</Text>

        {/* Guidelines */}
        <View style={styles.guidelines}>
          {[
            t('onboarding.step12.guide1'),
            t('onboarding.step12.guide2'),
            t('onboarding.step12.guide3'),
          ].map((g, i) => (
            <View key={i} style={styles.guideRow}>
              <Ionicons name="checkmark-circle" size={16} color={c.success} />
              <Text variant="footnote" color="textSecondary">{g}</Text>
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
                <PressableScale
                  key={`slot-${i}`}
                  style={styles.addSlot}
                  onPress={pickImage}
                  disabled={uploading !== null}
                  testID="btn-addPhoto"
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.step12.addPhoto')}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color={c.primary} />
                  ) : (
                    <>
                      <Ionicons name="add" size={32} color={c.primary} />
                      <Text variant="caption" color="primary" style={styles.addSlotText}>
                        {i === 0 ? t('onboarding.step12.addFirst') : t('onboarding.step12.addMore')}
                      </Text>
                    </>
                  )}
                </PressableScale>
              );
            }

            return (
              <View key={`photo-${i}`} style={styles.photoSlot}>
                <Image source={{ uri: photo }} style={styles.photoImg} resizeMode="cover" />

                {/* Primary badge */}
                {i === 0 && (
                  <View style={styles.primaryBadge}>
                    <Text variant="caption" color="onPrimary">{t('onboarding.step12.primary')}</Text>
                  </View>
                )}

                {/* Remove button */}
                <PressableScale
                  scaleTo={0.9}
                  style={styles.removeBtn}
                  onPress={() => removePhoto(i)}
                  testID={`btn-remove-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.step12.removePhoto')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </PressableScale>

                {/* Reorder buttons */}
                <View style={styles.reorderBtns}>
                  {i > 0 && (
                    <PressableScale
                      scaleTo={0.9}
                      style={styles.reorderBtn}
                      onPress={() => movePhoto(i, i - 1)}
                      testID={`btn-move-left-${i}`}
                      accessibilityRole="button"
                      accessibilityLabel="Move photo left"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="chevron-back" size={14} color="#fff" />
                    </PressableScale>
                  )}
                  {i < photos.length - 1 && (
                    <PressableScale
                      scaleTo={0.9}
                      style={styles.reorderBtn}
                      onPress={() => movePhoto(i, i + 1)}
                      testID={`btn-move-right-${i}`}
                      accessibilityRole="button"
                      accessibilityLabel="Move photo right"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="chevron-forward" size={14} color="#fff" />
                    </PressableScale>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <Text variant="footnote" color="textMuted" style={styles.countHint}>
          {t('onboarding.step12.count', { count: photos.length, max: MAX_PHOTOS })}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <PressableScale
          style={[styles.continueBtn, !isValid && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!isValid}
          testID="btn-continue"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.saveAndContinue')}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="headline" color="onPrimary">{t('onboarding.saveAndContinue')}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    height: 4,
    backgroundColor: c.border,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.primary,
    borderRadius: borderRadius.full,
  },
  body: { flex: 1, padding: spacing.lg },
  title: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  guidelines: { gap: spacing.xs, marginBottom: spacing['2xl'] },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
    borderColor: c.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: c.primaryLight,
  },
  addSlotText: {
    textAlign: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: c.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: c.error,
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
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
  continueBtn: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: { opacity: 0.5 },
});
