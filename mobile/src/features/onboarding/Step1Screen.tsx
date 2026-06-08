import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import type { Gender } from '../../types';

const GENDERS: { key: Gender; tKey: string }[] = [
  { key: 'male', tKey: 'onboarding.step1.genderOptions.male' },
  { key: 'female', tKey: 'onboarding.step1.genderOptions.female' },
  { key: 'other', tKey: 'onboarding.step1.genderOptions.other' },
];

const HEIGHT_OPTIONS: { label: string; value: number }[] = [];
for (let cm = 121; cm <= 213; cm++) {
  const totalInches = Math.round(cm / 2.54);
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  HEIGHT_OPTIONS.push({ label: `${ft}'${inches}" (${cm} cm)`, value: cm });
}

interface SelectSheetProps {
  visible: boolean;
  title: string;
  options: { label: string; value: any }[];
  selected: any;
  onSelect: (val: any) => void;
  onClose: () => void;
}

function SelectSheet({ visible, title, options, selected, onSelect, onClose }: SelectSheetProps) {
  const scrollIndex = Math.max(0, options.findIndex((o) => o.value === selected) - 2);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.value)}
          initialScrollIndex={scrollIndex}
          getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sheetRow, item.value === selected && styles.sheetRowActive]}
              onPress={() => { onSelect(item.value); onClose(); }}
              testID={`option-${item.value}`}
            >
              <Text style={[styles.sheetRowText, item.value === selected && styles.sheetRowTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

export default function Step1Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [firstName, setFirstName] = useState(data.firstName);
  const [lastName, setLastName] = useState(data.lastName);
  const [dobDisplay, setDobDisplay] = useState(
    data.dateOfBirth ? data.dateOfBirth.split('-').reverse().join('/') : '',
  );
  const [dob, setDob] = useState(data.dateOfBirth);
  const [dobError, setDobError] = useState('');
  const [gender, setGender] = useState<Gender | null>(data.gender);
  const [height, setHeight] = useState<number | null>(data.height);
  const [weight, setWeight] = useState(data.weight ? String(data.weight) : '');
  const [heightSheet, setHeightSheet] = useState(false);

  const isValid = !!(firstName.trim() && lastName.trim() && dob && gender && !dobError);

  const handleDobChange = (text: string) => {
    setDobDisplay(text);
    setDobError('');
    const parts = text.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      const [dd, mm, yyyy] = parts;
      const date = new Date(`${yyyy}-${mm}-${dd}`);
      if (isNaN(date.getTime())) { setDobError('Invalid date'); return; }
      const age = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 18) { setDobError('Must be at least 18 years old'); return; }
      if (age > 65) { setDobError('Must be under 65 years old'); return; }
      setDob(`${yyyy}-${mm}-${dd}`);
    } else if (text.length < 10) {
      setDob('');
    }
  };

  const handleContinue = async () => {
    const w = weight ? Number(weight) : null;
    await saveAndNext(
      { firstName, lastName, dateOfBirth: dob, gender, height, weight: w },
      { firstName, lastName, dateOfBirth: dob, gender, height, weight: w } as any,
    );
  };

  return (
    <OnboardingLayout
      step={1}
      title={t('onboarding.step1.title')}
      subtitle={t('onboarding.step1.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Full name */}
      <View>
        <Text style={styles.label}>{t('onboarding.step1.fullName')}</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colours.textMuted}
            autoCapitalize="words"
            testID="input-firstName"
            accessibilityLabel="First name"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colours.textMuted}
            autoCapitalize="words"
            testID="input-lastName"
            accessibilityLabel="Last name"
          />
        </View>
      </View>

      {/* Date of birth */}
      <View>
        <Text style={styles.label}>{t('onboarding.step1.dateOfBirth')}</Text>
        <TextInput
          style={[styles.input, dobError ? styles.inputError : null]}
          value={dobDisplay}
          onChangeText={handleDobChange}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colours.textMuted}
          keyboardType="numeric"
          maxLength={10}
          testID="input-dob"
          accessibilityLabel={t('onboarding.step1.dateOfBirth')}
        />
        {dobError ? <Text style={styles.errorText}>{dobError}</Text> : null}
      </View>

      {/* Gender */}
      <View>
        <Text style={styles.label}>{t('onboarding.step1.gender')}</Text>
        <View style={styles.row}>
          {GENDERS.map((g) => {
            const isActive = gender === g.key;
            return (
              <TouchableOpacity
                key={g.key}
                style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                onPress={() => setGender(g.key)}
                testID={`gender-${g.key}`}
                accessibilityLabel={t(g.tKey)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionBtnText, isActive && styles.optionBtnTextActive]}>
                  {t(g.tKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Height */}
      <View>
        <Text style={styles.label}>{t('onboarding.step1.height')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setHeightSheet(true)}
          testID="select-height"
          accessibilityLabel={t('onboarding.step1.height')}
        >
          <Text style={height ? styles.selectBtnText : styles.selectBtnPlaceholder}>
            {height ? HEIGHT_OPTIONS.find((h) => h.value === height)?.label ?? `${height} cm` : 'Select height'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weight (optional) */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step1.weight')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          placeholder="kg"
          placeholderTextColor={colours.textMuted}
          keyboardType="numeric"
          maxLength={3}
          testID="input-weight"
          accessibilityLabel={t('onboarding.step1.weight')}
        />
      </View>

      <SelectSheet
        visible={heightSheet}
        title={t('onboarding.step1.height')}
        options={HEIGHT_OPTIONS}
        selected={height}
        onSelect={setHeight}
        onClose={() => setHeightSheet(false)}
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
  optional: {
    color: colours.textMuted,
    fontFamily: typography.fontFamily.regular,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    backgroundColor: colours.background,
    minHeight: 48,
  },
  inputError: { borderColor: colours.error },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colours.error,
    marginTop: spacing.xs,
  },
  optionBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
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
  selectBtn: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  selectBtnText: { fontSize: typography.fontSize.base, color: colours.textPrimary },
  selectBtnPlaceholder: { fontSize: typography.fontSize.base, color: colours.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colours.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
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
