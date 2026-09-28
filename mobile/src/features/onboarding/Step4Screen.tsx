import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PickerSheet from '../../components/ui/PickerSheet';
import OnboardingLayout, { OnboardingSelectField } from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

const QUALIFICATIONS = [
  '10th', '12th / Intermediate', 'Diploma', 'Graduate (B.A./B.Sc./B.Com)',
  'Graduate (B.Tech/B.E.)', 'Graduate (MBBS/BDS)', 'Post-Graduate (M.A./M.Sc./M.Com)',
  'Post-Graduate (M.Tech/M.E.)', 'Post-Graduate (MBA)', 'Post-Graduate (MD/MS)',
  'PhD / Doctorate', 'Other',
];

/**
 * School-level qualifications have no "field of study" to name, so asking for
 * one forced a made-up answer. The field stays visible but optional for these.
 */
const SCHOOL_LEVEL = new Set(['10th', '12th / Intermediate']);

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
  const [qualSheet, setQualSheet] = useState(false);
  const [fieldSheet, setFieldSheet] = useState(false);

  const fieldOptional = SCHOOL_LEVEL.has(education);
  const isValid = !!(education && (fieldOptional || degree));

  const handleContinue = async () => {
    const answers = { education, degree };
    await saveAndNext(answers, answers);
  };

  // No "institution" input: the backend has no column for it (the web form never
  // asked either), so the old field collected an answer and silently threw it away.
  return (
    <OnboardingLayout
      step={4}
      title={t('onboarding.step4.title')}
      subtitle={t('onboarding.step4.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Highest qualification */}
      <OnboardingSelectField
        label={t('onboarding.step4.qualification')}
        value={education}
        placeholder={t('onboarding.placeholders.qualification', 'Select qualification')}
        onPress={() => setQualSheet(true)}
        open={qualSheet}
        testID="select-qualification"
      />

      {/* Field of study reveals after qualification is chosen */}
      {!!education && (
        <OnboardingSelectField
          label={t('onboarding.step4.fieldOfStudy')}
          optional={fieldOptional}
          value={degree}
          placeholder={t('onboarding.placeholders.fieldOfStudy', 'Select field of study')}
          onPress={() => setFieldSheet(true)}
          open={fieldSheet}
          testID="select-fieldOfStudy"
        />
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
