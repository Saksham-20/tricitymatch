import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import Select from '../../ui/Select';
import FormField from '../../ui/FormField';

const MARITAL_STATUSES = [
  { value: 'never_married', label: 'Never Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'awaiting_divorce', label: 'Awaiting Divorce' },
];

const MaritalStatusStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();

  const validateStep = () => {
    const newErrors = {};
    if (!formData.maritalStatus) {
      newErrors.maritalStatus = 'Please select your marital status';
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
          label="Marital Status"
          options={MARITAL_STATUSES}
          value={formData.maritalStatus}
          onChange={(value) => updateFormData('maritalStatus', value)}
          error={errors.maritalStatus}
          required
        />
      </motion.div>

      {formData.maritalStatus && !['never_married'].includes(formData.maritalStatus) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <FormField
            label="Number of Children"
            type="number"
            placeholder="0"
            value={formData.numberOfChildren}
            onChange={(value) => updateFormData('numberOfChildren', value)}
            min="0"
            max="10"
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900"
      >
        <p className="font-medium mb-1">💚 All statuses welcome</p>
        <p>TricityShadi is for everyone. Your marital status helps us find the right matches for you.</p>
      </motion.div>
    </div>
  );
};

export default MaritalStatusStep;
