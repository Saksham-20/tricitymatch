import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import { uploadPhoto } from '../../api/profile';
import type { ManglikStatus } from '../../types';

const MANGLIK_OPTIONS: { key: ManglikStatus; tKey: string }[] = [
  { key: 'manglik', tKey: 'onboarding.step3.manglikOptions.manglik' },
  { key: 'non_manglik', tKey: 'onboarding.step3.manglikOptions.non_manglik' },
  { key: 'anshik_manglik', tKey: 'onboarding.step3.manglikOptions.anshik_manglik' },
  { key: 'not_sure', tKey: 'onboarding.step3.manglikOptions.not_sure' },
];

export default function Step3Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [manglikStatus, setManglikStatus] = useState<ManglikStatus | null>(data.manglikStatus);
  const [birthTime, setBirthTime] = useState(data.birthTime);
  const [placeOfBirth, setPlaceOfBirth] = useState(data.placeOfBirth);
  const [kundliUrl, setKundliUrl] = useState(data.kundliUrl);
  const [kundliFileName, setKundliFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  const isValid = !!manglikStatus;

  const handlePickKundli = () => {
    Alert.alert(t('onboarding.step3.uploadKundli'), '', [
      {
        text: 'Image',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadKundliAsset(result.assets[0].uri, result.assets[0].fileName ?? 'kundli.jpg');
          }
        },
      },
      {
        text: 'PDF',
        onPress: async () => {
          const result = await DocumentPicker.getDocumentAsync({
            type: 'application/pdf',
            copyToCacheDirectory: true,
          });
          if (result.assets && result.assets[0]) {
            await uploadKundliAsset(result.assets[0].uri, result.assets[0].name);
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const uploadKundliAsset = async (uri: string, name: string) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('photo', { uri, name, type: 'application/octet-stream' } as any);
      const res = await uploadPhoto(form);
      setKundliUrl(res.url);
      setKundliFileName(name);
    } catch {
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    await saveAndNext(
      { manglikStatus, birthTime, placeOfBirth, kundliUrl },
      { manglikStatus, birthTime, placeOfBirth } as any,
    );
  };

  return (
    <OnboardingLayout
      step={3}
      title={t('onboarding.step3.title')}
      subtitle={t('onboarding.step3.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Manglik status */}
      <View>
        <Text style={styles.label}>{t('onboarding.step3.manglikStatus')}</Text>
        <View style={styles.grid}>
          {MANGLIK_OPTIONS.map((opt) => {
            const isActive = manglikStatus === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                onPress={() => setManglikStatus(opt.key)}
                testID={`manglik-${opt.key}`}
                accessibilityLabel={t(opt.tKey)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionBtnText, isActive && styles.optionBtnTextActive]}>
                  {t(opt.tKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Kundli upload */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step3.uploadKundli')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={handlePickKundli}
          disabled={uploading}
          testID="btn-uploadKundli"
          accessibilityLabel={t('onboarding.step3.uploadKundli')}
        >
          <Ionicons name="document-attach-outline" size={20} color={colours.primary} />
          <Text style={styles.uploadBtnText}>
            {uploading ? 'Uploading...' : kundliFileName || 'Upload image or PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Birth details */}
      <View>
        <Text style={styles.sectionHeader}>{t('onboarding.step3.birthDetails')}</Text>
      </View>

      <View>
        <Text style={styles.label}>
          {t('onboarding.step3.birthTime')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={birthTime}
          onChangeText={setBirthTime}
          placeholder="HH:MM (e.g. 06:30)"
          placeholderTextColor={colours.textMuted}
          keyboardType="numbers-and-punctuation"
          testID="input-birthTime"
          accessibilityLabel={t('onboarding.step3.birthTime')}
        />
      </View>

      <View>
        <Text style={styles.label}>
          {t('onboarding.step3.birthPlace')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={placeOfBirth}
          onChangeText={setPlaceOfBirth}
          placeholder="City of birth"
          placeholderTextColor={colours.textMuted}
          autoCapitalize="words"
          testID="input-placeOfBirth"
          accessibilityLabel={t('onboarding.step3.birthPlace')}
        />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  optional: { color: colours.textMuted, fontFamily: typography.fontFamily.regular },
  sectionHeader: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textSecondary,
    marginTop: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionBtn: {
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBtnActive: { borderColor: colours.primary, backgroundColor: colours.primaryLight },
  optionBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  optionBtnTextActive: { color: colours.primary },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    minHeight: 48,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colours.primary,
    borderStyle: 'dashed',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    minHeight: 52,
  },
  uploadBtnText: {
    fontSize: typography.fontSize.sm,
    color: colours.primary,
    fontFamily: typography.fontFamily.medium,
    flex: 1,
  },
});
