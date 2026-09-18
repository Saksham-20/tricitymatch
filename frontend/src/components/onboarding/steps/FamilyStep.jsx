import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
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

const FamilyStep = () => {
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
          label="Family Type"
          options={FAMILY_TYPES}
          value={formData.familyType}
          onChange={(value) => updateFormData('familyType', value)}
          placeholder="Select family type"
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label="Family Status"
          options={FAMILY_STATUS}
          value={formData.familyStatus}
          onChange={(value) => updateFormData('familyStatus', value)}
          placeholder="Select family status"
        />
      </motion.div>

      <motion.div variants={fadeRise} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Father's Occupation"
          placeholder="Optional"
          value={formData.fatherOccupation}
          onChange={(value) => updateFormData('fatherOccupation', value)}
        />
        <FormField
          label="Mother's Occupation"
          placeholder="Optional"
          value={formData.motherOccupation}
          onChange={(value) => updateFormData('motherOccupation', value)}
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <FormField
          label="Number of Siblings"
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={formData.numberOfSiblings}
          onChange={(value) => updateFormData('numberOfSiblings', value)}
          min="0"
          max="10"
        />
      </motion.div>

      <motion.div variants={fadeRise} className="bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-1">Family background</p>
        <p>Your family values help us find someone with similar family expectations and beliefs.</p>
      </motion.div>
    </motion.div>
  );
};

export default FamilyStep;
