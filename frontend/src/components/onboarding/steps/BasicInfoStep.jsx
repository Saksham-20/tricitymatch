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

    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const dob = new Date(formData.dateOfBirth);
      const age = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) {
        newErrors.dateOfBirth = 'You must be at least 18 years old';
      }
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

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-900">
            Gender <span className="text-red-500 ml-1">*</span>
          </label>
          <select
            value={formData.gender || ''}
            onChange={(e) => updateFormData('gender', e.target.value)}
            onBlur={() => setFieldTouched('gender')}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
              errors.gender
                ? 'border-red-500 focus:ring-red-500/20 focus:ring-red-500'
                : 'border-neutral-300 focus:ring-primary-500/20 focus:ring-primary-500'
            }`}
          >
            <option value="" disabled>Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {errors.gender && <p className="text-sm text-red-600 font-medium">{errors.gender}</p>}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <FormField
          label="Date of Birth"
          type="date"
          value={formData.dateOfBirth}
          onChange={(value) => updateFormData('dateOfBirth', value)}
          onBlur={() => setFieldTouched('dateOfBirth')}
          error={errors.dateOfBirth}
          max={new Date().toISOString().split('T')[0]}
          required
        />
      </motion.div>
    </div>
  );
};

export default BasicInfoStep;
