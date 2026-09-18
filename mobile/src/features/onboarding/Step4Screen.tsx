import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import PickerSheet from '../../components/ui/PickerSheet';
import Text from '../../components/ui/Text';
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
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
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
        <Text variant="subhead" color="textPrimary" style={styles.label}>{t('onboarding.step4.qualification')}</Text>
        <PressableScale
          style={styles.selectBtn}
          onPress={() => setQualSheet(true)}
          testID="select-qualification"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.step4.qualification')}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="callout" color={education ? 'textPrimary' : 'textMuted'}>
            {education || 'Select qualification'}
          </Text>
        </PressableScale>
      </View>

      {/* Field of study + institution reveal after qualification is chosen */}
      {!!education && (
      <View>
        <Text variant="subhead" color="textPrimary" style={styles.label}>{t('onboarding.step4.fieldOfStudy')}</Text>
        <PressableScale
          style={styles.selectBtn}
          onPress={() => setFieldSheet(true)}
          testID="select-fieldOfStudy"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.step4.fieldOfStudy')}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="callout" color={degree ? 'textPrimary' : 'textMuted'}>
            {degree || 'Select field of study'}
          </Text>
        </PressableScale>
      </View>
      )}

      {/* Institution (optional) */}
      {!!education && (
      <View>
        <Text variant="subhead" color="textPrimary" style={styles.label}>
          {t('onboarding.step4.institution')}
          <Text variant="footnote" color="textMuted"> ({t('common.optional')})</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={institution}
          onChangeText={setInstitution}
          placeholder="College / University name"
          placeholderTextColor={c.textMuted}
          autoCapitalize="words"
          testID="input-institution"
          accessibilityLabel={t('onboarding.step4.institution')}
        />
      </View>
      )}

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

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: c.textPrimary,
    minHeight: 48,
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
});
