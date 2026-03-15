import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';

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
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Select
          label="Family Type"
          options={FAMILY_TYPES}
          value={formData.familyType}
          onChange={(value) => updateFormData('familyType', value)}
          placeholder="Select family type"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Select
          label="Family Status"
          options={FAMILY_STATUS}
          value={formData.familyStatus}
          onChange={(value) => updateFormData('familyStatus', value)}
          placeholder="Select family status"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-4"
      >
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

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <FormField
          label="Number of Siblings"
          type="number"
          placeholder="0"
          value={formData.numberOfSiblings}
          onChange={(value) => updateFormData('numberOfSiblings', value)}
          min="0"
          max="10"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-pink-50 border border-pink-200 rounded-lg p-4 text-sm text-pink-900"
      >
        <p className="font-medium mb-1">👨‍👩‍👧‍👦 Family background</p>
        <p>Your family values help us find someone with similar family expectations and beliefs.</p>
      </motion.div>
    </div>
  );
};

export default FamilyStep;
