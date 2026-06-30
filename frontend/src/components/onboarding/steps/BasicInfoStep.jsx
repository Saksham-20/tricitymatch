import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import { validateName } from '../../../utils/validators';

const BasicInfoStep = () => {
  const { formData, updateFormData, errors, setStepErrors, setFieldTouched, registerStepValidator } = useOnboarding();
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const validateStep = () => {
    const data = formDataRef.current;
    const newErrors = {};

    if (!data.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (!validateName(data.firstName)) {
      newErrors.firstName = 'At least 2 characters';
    }

    if (!data.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (!validateName(data.lastName)) {
      newErrors.lastName = 'At least 2 characters';
    }

    if (!data.gender) {
      newErrors.gender = 'Gender is required';
    }

    if (!data.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const dob = new Date(data.dateOfBirth);
      const age = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) {
        newErrors.dateOfBirth = 'You must be at least 18 years old';
      }
    }

    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return registerStepValidator(validateStep);
  }, []);

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="First Name"
          autoComplete="given-name"
          placeholder="John"
          value={formData.firstName}
          onChange={(value) => updateFormData('firstName', value)}
          onBlur={() => setFieldTouched('firstName')}
          error={errors.firstName}
          required
        />
        <FormField
          label="Last Name"
          autoComplete="family-name"
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
          <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Gender <span className="text-red-500 ml-1">*</span>
          </span>
          <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Gender">
            {genderOptions.map((opt) => {
              const selected = formData.gender === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => { updateFormData('gender', opt.value); setFieldTouched('gender'); }}
                  whileTap={{ scale: 0.97 }}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    selected
                      ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-primary-300'
                  }`}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
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
          /* Opens the picker near the 18+ era instead of today, and blocks
             under-18 / impossible dates inline rather than after submit. */
          min={new Date(new Date().setFullYear(new Date().getFullYear() - 100)).toISOString().split('T')[0]}
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
          required
        />
      </motion.div>
    </div>
  );
};

export default BasicInfoStep;
