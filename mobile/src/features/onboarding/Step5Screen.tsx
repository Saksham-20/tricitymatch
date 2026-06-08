import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

const PROFESSIONS = [
  'Doctor / Physician', 'Dentist', 'Engineer (Software)', 'Engineer (Other)',
  'Teacher / Professor', 'Lawyer', 'CA / Accountant', 'Business Owner',
  'Government Employee', 'Armed Forces', 'Police / IPS', 'Banker / Finance',
  'Scientist / Researcher', 'Architect', 'Nurse / Paramedic', 'Artist / Designer',
  'Journalist / Media', 'Pilot / Aviation', 'Chef / Hospitality', 'Other',
];

const INCOME_RANGES: { label: string; value: number }[] = [
  { label: 'Below ₹3 Lakhs', value: 200000 },
  { label: '₹3 – 5 Lakhs', value: 400000 },
  { label: '₹5 – 10 Lakhs', value: 750000 },
  { label: '₹10 – 20 Lakhs', value: 1500000 },
  { label: '₹20 – 50 Lakhs', value: 3500000 },
  { label: 'Above ₹50 Lakhs', value: 6000000 },
  { label: 'Prefer not to say', value: 0 },
];

interface PickerSheetProps<T> {
  visible: boolean;
  title: string;
  options: { label: string; value: T }[];
  selected: T | null;
  onSelect: (v: T) => void;
  onClose: () => void;
}

function PickerSheet<T>({ visible, title, options, selected, onSelect, onClose }: PickerSheetProps<T>) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.value)}
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

export default function Step5Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [profession, setProfession] = useState(data.profession);
  const [employer, setEmployer] = useState(data.employer);
  const [income, setIncome] = useState<number | null>(data.income);
  const [profSheet, setProfSheet] = useState(false);
  const [incomeSheet, setIncomeSheet] = useState(false);

  const incomeLabel = income !== null
    ? INCOME_RANGES.find((r) => r.value === income)?.label ?? ''
    : '';

  const profOptions = PROFESSIONS.map((p) => ({ label: p, value: p }));

  const isValid = !!(profession);

  const handleContinue = async () => {
    await saveAndNext(
      { profession, employer, income },
      { profession, income } as any,
    );
  };

  return (
    <OnboardingLayout
      step={5}
      title={t('onboarding.step5.title')}
      subtitle={t('onboarding.step5.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Profession */}
      <View>
        <Text style={styles.label}>{t('onboarding.step5.profession')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setProfSheet(true)}
          testID="select-profession"
          accessibilityLabel={t('onboarding.step5.profession')}
        >
          <Text style={profession ? styles.selectText : styles.placeholderText}>
            {profession || 'Select profession'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Employer (optional) */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step5.employer')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={employer}
          onChangeText={setEmployer}
          placeholder="Company / organisation name"
          placeholderTextColor={colours.textMuted}
          autoCapitalize="words"
          testID="input-employer"
          accessibilityLabel={t('onboarding.step5.employer')}
        />
      </View>

      {/* Income */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step5.income')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setIncomeSheet(true)}
          testID="select-income"
          accessibilityLabel={t('onboarding.step5.income')}
        >
          <Text style={income !== null ? styles.selectText : styles.placeholderText}>
            {incomeLabel || 'Select annual income'}
          </Text>
        </TouchableOpacity>
      </View>

      <PickerSheet
        visible={profSheet}
        title={t('onboarding.step5.profession')}
        options={profOptions}
        selected={profession || null}
        onSelect={(v: string) => { setProfession(v); }}
        onClose={() => setProfSheet(false)}
      />
      <PickerSheet
        visible={incomeSheet}
        title={t('onboarding.step5.income')}
        options={INCOME_RANGES}
        selected={income}
        onSelect={(v: number) => setIncome(v)}
        onClose={() => setIncomeSheet(false)}
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
