import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';

const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Buddhist', 'Jain', 'Other'];
const MOTHER_TONGUES = ['Punjabi', 'Hindi', 'English', 'Marathi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Other'];

const ReligionStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();

  const validateStep = () => {
    const newErrors = {};
    // Religion is optional in the new design, but caste requires religion
    if (formData.caste && !formData.religion) {
      newErrors.religion = 'Please select religion to specify caste';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
          label="Religion"
          options={RELIGIONS.map(r => ({ value: r, label: r }))}
          value={formData.religion}
          onChange={(value) => updateFormData('religion', value)}
          error={errors.religion}
          placeholder="Select your religion"
        />
      </motion.div>

      {formData.religion && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <FormField
            label="Caste"
            placeholder="Optional"
            value={formData.caste}
            onChange={(value) => updateFormData('caste', value)}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Select
          label="Mother Tongue"
          options={MOTHER_TONGUES.map(m => ({ value: m, label: m }))}
          value={formData.motherTongue}
          onChange={(value) => updateFormData('motherTongue', value)}
          placeholder="Select your mother tongue"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-900"
      >
        <p className="font-medium mb-1">🙏 Cultural values matter</p>
        <p>Your religious and cultural background helps us find compatible matches who share your values.</p>
      </motion.div>
    </div>
  );
};

export default ReligionStep;
