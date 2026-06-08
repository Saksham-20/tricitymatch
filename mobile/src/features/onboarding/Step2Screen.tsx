import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

const RELIGIONS = [
  'Hindu', 'Sikh', 'Muslim', 'Christian', 'Jain', 'Buddhist', 'Other',
];

const MOTHER_TONGUES = [
  'Punjabi', 'Hindi', 'Haryanvi', 'Urdu', 'English', 'Bengali',
  'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Gujarati', 'Other',
];

interface PickerSheetProps {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  onClose: () => void;
}

function PickerSheet({ visible, title, options, selected, onSelect, onClose }: PickerSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sheetRow, item === selected && styles.sheetRowActive]}
              onPress={() => { onSelect(item); onClose(); }}
              testID={`option-${item}`}
            >
              <Text style={[styles.sheetRowText, item === selected && styles.sheetRowTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

export default function Step2Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [religion, setReligion] = useState(data.religion);
  const [caste, setCaste] = useState(data.caste);
  const [subCaste, setSubCaste] = useState(data.subCaste);
  const [gotra, setGotra] = useState(data.gotra);
  const [motherTongue, setMotherTongue] = useState(data.motherTongue);
  const [religionSheet, setReligionSheet] = useState(false);
  const [tongueSheet, setTongueSheet] = useState(false);

  const isValid = !!(religion && caste.trim() && motherTongue);

  const handleContinue = async () => {
    await saveAndNext(
      { religion, caste, subCaste, gotra, motherTongue },
      { religion, caste, subCaste, gotra, motherTongue } as any,
    );
  };

  return (
    <OnboardingLayout
      step={2}
      title={t('onboarding.step2.title')}
      subtitle={t('onboarding.step2.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Religion */}
      <View>
        <Text style={styles.label}>{t('onboarding.step2.religion')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setReligionSheet(true)}
          testID="select-religion"
          accessibilityLabel={t('onboarding.step2.religion')}
        >
          <Text style={religion ? styles.selectText : styles.placeholderText}>
            {religion || 'Select religion'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Caste */}
      <View>
        <Text style={styles.label}>{t('onboarding.step2.caste')}</Text>
        <TextInput
          style={styles.input}
          value={caste}
          onChangeText={setCaste}
          placeholder="e.g. Jat, Khatri, Brahmin"
          placeholderTextColor={colours.textMuted}
          autoCapitalize="words"
          testID="input-caste"
          accessibilityLabel={t('onboarding.step2.caste')}
        />
      </View>

      {/* Sub-caste (optional) */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step2.subCaste')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={subCaste}
          onChangeText={setSubCaste}
          placeholder="Sub-caste"
          placeholderTextColor={colours.textMuted}
          autoCapitalize="words"
          testID="input-subCaste"
          accessibilityLabel={t('onboarding.step2.subCaste')}
        />
      </View>

      {/* Gotra (optional) */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step2.gotra')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={gotra}
          onChangeText={setGotra}
          placeholder="e.g. Kashyap, Bharadwaj"
          placeholderTextColor={colours.textMuted}
          autoCapitalize="words"
          testID="input-gotra"
          accessibilityLabel={t('onboarding.step2.gotra')}
        />
      </View>

      {/* Mother tongue */}
      <View>
        <Text style={styles.label}>{t('onboarding.step2.motherTongue')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setTongueSheet(true)}
          testID="select-motherTongue"
          accessibilityLabel={t('onboarding.step2.motherTongue')}
        >
          <Text style={motherTongue ? styles.selectText : styles.placeholderText}>
            {motherTongue || 'Select language'}
          </Text>
        </TouchableOpacity>
      </View>

      <PickerSheet
        visible={religionSheet}
        title={t('onboarding.step2.religion')}
        options={RELIGIONS}
        selected={religion}
        onSelect={setReligion}
        onClose={() => setReligionSheet(false)}
      />
      <PickerSheet
        visible={tongueSheet}
        title={t('onboarding.step2.motherTongue')}
        options={MOTHER_TONGUES}
        selected={motherTongue}
        onSelect={setMotherTongue}
        onClose={() => setTongueSheet(false)}
      />
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
  selectBtn: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  selectText: { fontSize: typography.fontSize.base, color: colours.textPrimary },
  placeholderText: { fontSize: typography.fontSize.base, color: colours.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colours.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '55%',
    paddingTop: spacing.lg,
  },
  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sheetRow: { height: 52, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  sheetRowActive: { backgroundColor: colours.primaryLight },
  sheetRowText: { fontSize: typography.fontSize.base, color: colours.textPrimary },
  sheetRowTextActive: { color: colours.primary, fontFamily: typography.fontFamily.semiBold },
});
