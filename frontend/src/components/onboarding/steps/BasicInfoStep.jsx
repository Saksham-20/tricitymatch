import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import { validateName } from '../../../utils/validators';

const BasicInfoStep = () => {
  const { formData, updateFormData, errors, setStepErrors, setFieldTouched } = useOnboarding();

  const validateStep = () => {
    const newErrors = {};

    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (!validateName(formData.firstName)) {
      newErrors.firstName = 'At least 2 characters';
    }

    if (!formData.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (!validateName(formData.lastName)) {
      newErrors.lastName = 'At least 2 characters';
    }

    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return () => validateStep();
  }, []);

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <FormField
          label="First Name"
          placeholder="John"
          value={formData.firstName}
          onChange={(value) => updateFormData('firstName', value)}
          onBlur={() => setFieldTouched('firstName')}
          error={errors.firstName}
          required
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <FormField
          label="Last Name"
          placeholder="Smith"
          value={formData.lastName}
          onChange={(value) => updateFormData('lastName', value)}
          onBlur={() => setFieldTouched('lastName')}
          error={errors.lastName}
          required
        />
      </motion.div>
    </div>
  );
};

export default BasicInfoStep;
