import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import Select from '../../ui/Select';

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
          label="Skin Tone"
          options={SKIN_TONES}
          value={formData.skinTone}
          onChange={(value) => updateFormData('skinTone', value)}
          placeholder="Select skin tone"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Select
          label="Diet"
          options={DIETS}
          value={formData.diet}
          onChange={(value) => updateFormData('diet', value)}
          placeholder="Select diet preference"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Select
          label="Smoking"
          options={HABITS}
          value={formData.smoking}
          onChange={(value) => updateFormData('smoking', value)}
          placeholder="Select smoking habit"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Select
          label="Drinking"
          options={HABITS}
          value={formData.drinking}
          onChange={(value) => updateFormData('drinking', value)}
          placeholder="Select drinking habit"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900"
      >
        <p className="font-medium mb-1">🌟 Lifestyle compatibility</p>
        <p>These details help us find someone with a compatible lifestyle and habits.</p>
      </motion.div>
    </div>
  );
};

export default LifestyleStep;
