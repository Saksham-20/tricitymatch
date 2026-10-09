import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../../context/OnboardingContext';
import Select from '../../ui/Select';
import { translateOptions } from '../../../constants/profileOptions';
import { staggerContainer, fadeRise } from '../../../utils/animations';

const SKIN_TONES = [
  { value: 'fair', label: 'Fair' },
  { value: 'wheatish', label: 'Wheatish' },
  { value: 'dark', label: 'Dark' },
];

const DIETS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non-vegetarian', label: 'Non-Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'jain', label: 'Jain' },
];

const HABITS = [
  { value: 'never', label: 'Never' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'regularly', label: 'Regularly' },
];

const LifestyleStep = () => {
  const { t } = useTranslation();
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();

  const validateStep = () => {
    const newErrors = {};
    setStepErrors(newErrors);
    return true;
  };

  React.useEffect(() => {
    return () => validateStep();
  }, []);

  return (
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.lifestyle.skinTone')}
          options={translateOptions('skinTone', SKIN_TONES, t)}
          value={formData.skinTone}
          onChange={(value) => updateFormData('skinTone', value)}
          placeholder={t('onboarding.lifestyle.selectSkinTone')}
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.lifestyle.diet')}
          options={translateOptions('diet', DIETS, t)}
          value={formData.diet}
          onChange={(value) => updateFormData('diet', value)}
          placeholder={t('onboarding.lifestyle.selectDiet')}
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.lifestyle.smoking')}
          options={translateOptions('habit', HABITS, t)}
          value={formData.smoking}
          onChange={(value) => updateFormData('smoking', value)}
          placeholder={t('onboarding.lifestyle.selectSmoking')}
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.lifestyle.drinking')}
          options={translateOptions('habit', HABITS, t)}
          value={formData.drinking}
          onChange={(value) => updateFormData('drinking', value)}
          placeholder={t('onboarding.lifestyle.selectDrinking')}
        />
      </motion.div>

      <motion.div variants={fadeRise} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800 mb-1">{t('onboarding.lifestyle.infoTitle')}</p>
        <p>{t('onboarding.lifestyle.infoBody')}</p>
      </motion.div>
    </motion.div>
  );
};

export default LifestyleStep;
