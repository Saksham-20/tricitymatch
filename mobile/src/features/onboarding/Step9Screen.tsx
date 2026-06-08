import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';
import type { FamilyType } from '../../types';

type FamilyValues = 'orthodox' | 'traditional' | 'moderate' | 'liberal';

const OCCUPATIONS = [
  'Business / Self-employed', 'Government Employee', 'Private Sector',
  'Doctor / Healthcare', 'Teacher / Professor', 'Lawyer', 'Engineer',
  'Army / Defence', 'Police', 'Farmer / Agriculture',
  'Homemaker', 'Retired', 'Passed Away', 'Other',
];

const FAMILY_TYPES: { key: FamilyType; label: string }[] = [
  { key: 'nuclear', label: 'Nuclear' },
  { key: 'joint', label: 'Joint' },
];

const FAMILY_VALUES_OPTIONS: { key: FamilyValues; label: string }[] = [
  { key: 'orthodox', label: 'Orthodox' },
  { key: 'traditional', label: 'Traditional' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'liberal', label: 'Liberal' },
];

interface PickerSheetProps {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
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

function CounterInput({
  label, value, onChange, testID,
}: { label: string; value: number; onChange: (v: number) => void; testID: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.counterRow}>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => onChange(Math.max(0, value - 1))}
          testID={`${testID}-dec`}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.counterBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.counterValue} testID={testID}>{value}</Text>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => onChange(Math.min(10, value + 1))}
          testID={`${testID}-inc`}
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.counterBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function Step9Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [fatherOccupation, setFatherOccupation] = useState(data.fatherOccupation);
  const [motherOccupation, setMotherOccupation] = useState(data.motherOccupation);
  const [brothers, setBrothers] = useState(data.numberOfBrothers);
  const [sisters, setSisters] = useState(data.numberOfSisters);
  const [familyType, setFamilyType] = useState<FamilyType | null>(data.familyType);
  const [familyValues, setFamilyValues] = useState<FamilyValues | null>(data.familyValues);
  const [fatherSheet, setFatherSheet] = useState(false);
  const [motherSheet, setMotherSheet] = useState(false);

  const handleSkip = async () => {
    await saveAndNext({}, {});
  };

  const handleContinue = async () => {
    await saveAndNext(
      { fatherOccupation, motherOccupation, numberOfBrothers: brothers, numberOfSisters: sisters, familyType, familyValues },
      { fatherOccupation, motherOccupation, familyType } as any,
    );
  };

  return (
    <OnboardingLayout
      step={9}
      title={t('onboarding.step9.title')}
      subtitle={t('onboarding.step9.subtitle')}
      onContinue={handleContinue}
      skippable
      onSkip={handleSkip}
    >
      {/* Father's occupation */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step9.fatherOccupation')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setFatherSheet(true)}
          testID="select-fatherOccupation"
          accessibilityLabel={t('onboarding.step9.fatherOccupation')}
        >
          <Text style={fatherOccupation ? styles.selectText : styles.placeholderText}>
            {fatherOccupation || 'Select occupation'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mother's occupation */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step9.motherOccupation')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setMotherSheet(true)}
          testID="select-motherOccupation"
          accessibilityLabel={t('onboarding.step9.motherOccupation')}
        >
          <Text style={motherOccupation ? styles.selectText : styles.placeholderText}>
            {motherOccupation || 'Select occupation'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Siblings */}
      <View style={styles.siblingRow}>
        <View style={styles.siblingItem}>
          <CounterInput
            label={t('onboarding.step9.brothers')}
            value={brothers}
            onChange={setBrothers}
            testID="counter-brothers"
          />
        </View>
        <View style={styles.siblingItem}>
          <CounterInput
            label={t('onboarding.step9.sisters')}
            value={sisters}
            onChange={setSisters}
            testID="counter-sisters"
          />
        </View>
      </View>

      {/* Family type */}
      <View>
        <Text style={styles.label}>{t('onboarding.step9.familyType')}</Text>
        <View style={styles.pillRow}>
          {FAMILY_TYPES.map((opt) => {
            const active = familyType === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setFamilyType(opt.key)}
                testID={`familyType-${opt.key}`}
                accessibilityLabel={opt.label}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Family values */}
      <View>
        <Text style={styles.label}>{t('onboarding.step9.familyValues')}</Text>
        <View style={styles.pillRow}>
          {FAMILY_VALUES_OPTIONS.map((opt) => {
            const active = familyValues === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setFamilyValues(opt.key)}
                testID={`familyValues-${opt.key}`}
                accessibilityLabel={opt.label}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <PickerSheet
        visible={fatherSheet}
        title={t('onboarding.step9.fatherOccupation')}
        options={OCCUPATIONS}
        selected={fatherOccupation}
        onSelect={setFatherOccupation}
        onClose={() => setFatherSheet(false)}
      />
      <PickerSheet
        visible={motherSheet}
        title={t('onboarding.step9.motherOccupation')}
        options={OCCUPATIONS}
        selected={motherOccupation}
        onSelect={setMotherOccupation}
        onClose={() => setMotherSheet(false)}
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
  siblingRow: { flexDirection: 'row', gap: spacing.lg },
  siblingItem: { flex: 1 },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontSize: typography.fontSize.xl,
    color: colours.textPrimary,
    fontFamily: typography.fontFamily.medium,
    lineHeight: typography.fontSize.xl * 1.2,
  },
  counterValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: colours.border,
    borderRadius: borderRadius.full,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {
    borderColor: colours.primary,
    backgroundColor: colours.primaryLight,
  },
  pillText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  pillTextActive: { color: colours.primary },
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
