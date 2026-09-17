import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import Select from '../../ui/Select';
import FormField from '../../ui/FormField';
import { staggerContainer, fadeRise } from '../../../utils/animations';

const MARITAL_STATUSES = [
  { value: 'never_married', label: 'Never Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'awaiting_divorce', label: 'Awaiting Divorce' },
];

const MaritalStatusStep = () => {
  const { formData, updateFormData, errors, setStepErrors, registerStepValidator } = useOnboarding();
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const validateStep = () => {
    const newErrors = {};
    if (!formDataRef.current.maritalStatus) {
      newErrors.maritalStatus = 'Please select your marital status';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return registerStepValidator(validateStep);
  }, []);

  return (
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise}>
        <Select
          label="Marital Status"
          options={MARITAL_STATUSES}
          value={formData.maritalStatus}
          onChange={(value) => { updateFormData('maritalStatus', value); setTimeout(validateStep, 0); }}
          error={errors.maritalStatus}
          required
        />
      </motion.div>

      {formData.maritalStatus && !['never_married'].includes(formData.maritalStatus) && (
        <motion.div initial="initial" animate="animate" variants={fadeRise}>
          <FormField
            label="Number of Children"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={formData.numberOfChildren}
            onChange={(value) => updateFormData('numberOfChildren', value)}
            min="0"
            max="10"
            optional
          />
        </motion.div>
      )}

      <motion.div variants={fadeRise} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800 mb-1">All statuses welcome</p>
        <p>TricityMatch is for everyone. Your marital status helps us find the right matches for you.</p>
      </motion.div>
    </motion.div>
  );
};

export default MaritalStatusStep;
