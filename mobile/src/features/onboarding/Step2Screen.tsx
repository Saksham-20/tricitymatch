import React, { useState } from 'react';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import PickerSheet from '../../components/ui/PickerSheet';
import OnboardingLayout, { OnboardingSelectField, flushField, useOnboardingControls } from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

const RELIGIONS = [
  'Hindu', 'Sikh', 'Muslim', 'Christian', 'Jain', 'Buddhist', 'Other',
];

const MOTHER_TONGUES = [
  'Punjabi', 'Hindi', 'Haryanvi', 'Urdu', 'English', 'Bengali',
  'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Gujarati', 'Other',
];

export default function Step2Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();
  const controls = useOnboardingControls();

  const [religion, setReligion] = useState(data.religion);
  const [caste, setCaste] = useState(data.caste);
  const [subCaste, setSubCaste] = useState(data.subCaste);
  const [gotra, setGotra] = useState(data.gotra);
  const [motherTongue, setMotherTongue] = useState(data.motherTongue);
  const [religionSheet, setReligionSheet] = useState(false);
  const [tongueSheet, setTongueSheet] = useState(false);

  const isValid = !!(religion && caste.trim() && motherTongue);

  // The visible label and the spoken/Voice Control label are the same string, so
  // "(Optional)" reaches a screen-reader user too.
  const subCasteLabel = `${t('onboarding.step2.subCaste')} (${t('common.optional')})`;
  const gotraLabel = `${t('onboarding.step2.gotra')} (${t('common.optional')})`;

  const handleContinue = async () => {
    const answers = {
      religion,
      caste: caste.trim(),
      subCaste: subCaste.trim(),
      gotra: gotra.trim(),
      motherTongue,
    };
    await saveAndNext(answers, answers);
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
      <OnboardingSelectField
        label={t('onboarding.step2.religion')}
        value={religion}
        placeholder={t('onboarding.placeholders.religion', 'Select religion')}
        onPress={() => setReligionSheet(true)}
        open={religionSheet}
        testID="select-religion"
      />

      {/* Caste (server caps every free-text community field at 100 characters) */}
      <Input
        {...controls.inputProps}
        label={t('onboarding.step2.caste')}
        value={caste}
        onChangeText={setCaste}
        containerStyle={flushField}
        placeholder={t('onboarding.placeholders.caste', 'e.g. Jat, Khatri, Brahmin')}
        autoCapitalize="words"
        maxLength={100}
        testID="input-caste"
        accessibilityLabel={t('onboarding.step2.caste')}
      />

      {/* Sub-caste + gotra reveal only once caste is filled — irrelevant
          questions stay out of sight (NN/g: shortest path for each user) */}
      {!!caste.trim() && (
        <>
          <Input
            {...controls.inputProps}
            label={subCasteLabel}
            value={subCaste}
            onChangeText={setSubCaste}
            containerStyle={flushField}
            placeholder={t('onboarding.placeholders.subCaste', 'Sub-caste')}
            autoCapitalize="words"
            maxLength={100}
            testID="input-subCaste"
            accessibilityLabel={subCasteLabel}
          />
          <Input
            {...controls.inputProps}
            label={gotraLabel}
            value={gotra}
            onChangeText={setGotra}
            containerStyle={flushField}
            placeholder={t('onboarding.placeholders.gotra', 'e.g. Kashyap, Bharadwaj')}
            autoCapitalize="words"
            maxLength={100}
            testID="input-gotra"
            accessibilityLabel={gotraLabel}
          />
        </>
      )}

      {/* Mother tongue */}
      <OnboardingSelectField
        label={t('onboarding.step2.motherTongue')}
        value={motherTongue}
        placeholder={t('onboarding.placeholders.motherTongue', 'Select language')}
        onPress={() => setTongueSheet(true)}
        open={tongueSheet}
        testID="select-motherTongue"
      />

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
