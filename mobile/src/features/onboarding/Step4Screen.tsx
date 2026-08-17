import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import PickerSheet from '../../components/ui/PickerSheet';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

const QUALIFICATIONS = [
  '10th', '12th / Intermediate', 'Diploma', 'Graduate (B.A./B.Sc./B.Com)',
  'Graduate (B.Tech/B.E.)', 'Graduate (MBBS/BDS)', 'Post-Graduate (M.A./M.Sc./M.Com)',
  'Post-Graduate (M.Tech/M.E.)', 'Post-Graduate (MBA)', 'Post-Graduate (MD/MS)',
  'PhD / Doctorate', 'Other',
];

const FIELDS_OF_STUDY = [
  'Engineering', 'Medicine / Healthcare', 'Commerce / Finance', 'Arts / Humanities',
  'Law', 'Management / MBA', 'Science', 'Computer Science / IT', 'Education',
  'Architecture', 'Agriculture', 'Other',
];

export default function Step4Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [education, setEducation] = useState(data.education);
  const [degree, setDegree] = useState(data.degree);
  const [institution, setInstitution] = useState(data.institution);
  const [qualSheet, setQualSheet] = useState(false);
  const [fieldSheet, setFieldSheet] = useState(false);

  const isValid = !!(education && degree);

  const handleContinue = async () => {
    await saveAndNext(
      { education, degree, institution },
      { education, degree } as any,
    );
  };

  return (
    <OnboardingLayout
      step={4}
      title={t('onboarding.step4.title')}
      subtitle={t('onboarding.step4.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Highest qualification */}
      <View>
        <Text style={styles.label}>{t('onboarding.step4.qualification')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setQualSheet(true)}
          testID="select-qualification"
          accessibilityLabel={t('onboarding.step4.qualification')}
        >
          <Text style={education ? styles.selectText : styles.placeholderText}>
            {education || 'Select qualification'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Field of study */}
      <View>
        <Text style={styles.label}>{t('onboarding.step4.fieldOfStudy')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setFieldSheet(true)}
          testID="select-fieldOfStudy"
          accessibilityLabel={t('onboarding.step4.fieldOfStudy')}
        >
          <Text style={degree ? styles.selectText : styles.placeholderText}>
            {degree || 'Select field of study'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Institution (optional) */}
      <View>
        <Text style={styles.label}>
          {t('onboarding.step4.institution')}
          <Text style={styles.optional}> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={institution}
          onChangeText={setInstitution}
          placeholder="College / University name"
          placeholderTextColor={colours.textMuted}
          autoCapitalize="words"
          testID="input-institution"
          accessibilityLabel={t('onboarding.step4.institution')}
        />
      </View>

      <PickerSheet
        visible={qualSheet}
        title={t('onboarding.step4.qualification')}
        options={QUALIFICATIONS}
        selected={education}
        onSelect={setEducation}
        onClose={() => setQualSheet(false)}
      />
      <PickerSheet
        visible={fieldSheet}
        title={t('onboarding.step4.fieldOfStudy')}
        options={FIELDS_OF_STUDY}
        selected={degree}
        onSelect={setDegree}
        onClose={() => setFieldSheet(false)}
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
});
