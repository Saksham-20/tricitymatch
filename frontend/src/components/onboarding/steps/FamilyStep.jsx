import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import { translateOptions } from '../../../constants/profileOptions';
import { staggerContainer, fadeRise } from '../../../utils/animations';

const FAMILY_TYPES = [
  { value: 'joint', label: 'Joint Family' },
  { value: 'nuclear', label: 'Nuclear Family' },
];

const FAMILY_STATUS = [
  { value: 'middle_class', label: 'Middle Class' },
  { value: 'upper_middle_class', label: 'Upper Middle Class' },
  { value: 'affluent', label: 'Affluent' },
  { value: 'rich', label: 'Rich' },
];

const FAMILY_VALUES = [
  { value: 'traditional', label: 'Traditional' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'liberal', label: 'Liberal' },
];

const LIVING_ARRANGEMENT = [
  { value: 'with_family', label: 'With family' },
  { value: 'alone', label: 'On my own' },
  { value: 'with_roommates', label: 'With roommates' },
];

const FamilyStep = () => {
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
          label={t('onboarding.family.type')}
          options={translateOptions('familyType', FAMILY_TYPES, t)}
          value={formData.familyType}
          onChange={(value) => updateFormData('familyType', value)}
          placeholder={t('onboarding.family.selectType')}
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.family.status')}
          options={translateOptions('familyStatus', FAMILY_STATUS, t)}
          value={formData.familyStatus}
          onChange={(value) => updateFormData('familyStatus', value)}
          placeholder={t('onboarding.family.selectStatus')}
        />
      </motion.div>

      <motion.div variants={fadeRise} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label={t('onboarding.family.fatherOccupation')}
          placeholder={t('onboarding.optional')}
          value={formData.fatherOccupation}
          onChange={(value) => updateFormData('fatherOccupation', value)}
        />
        <FormField
          label={t('onboarding.family.motherOccupation')}
          placeholder={t('onboarding.optional')}
          value={formData.motherOccupation}
          onChange={(value) => updateFormData('motherOccupation', value)}
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <FormField
          label={t('onboarding.family.siblings')}
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={formData.numberOfSiblings}
          onChange={(value) => updateFormData('numberOfSiblings', value)}
          min="0"
          max="10"
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.family.values')}
          options={translateOptions('familyValues', FAMILY_VALUES, t)}
          value={formData.familyValues}
          onChange={(value) => updateFormData('familyValues', value)}
          optional
          placeholder={t('onboarding.family.selectValues')}
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.family.living')}
          options={translateOptions('livingArrangement', LIVING_ARRANGEMENT, t)}
          value={formData.livingArrangement}
          onChange={(value) => updateFormData('livingArrangement', value)}
          optional
          placeholder={t('onboarding.family.selectLiving')}
        />
      </motion.div>

      <motion.div variants={fadeRise} className="bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-1">{t('onboarding.family.infoTitle')}</p>
        <p>{t('onboarding.family.infoBody')}</p>
      </motion.div>
    </motion.div>
  );
};

export default FamilyStep;
