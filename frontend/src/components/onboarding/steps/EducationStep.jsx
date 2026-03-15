import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';

const EDUCATION_DEGREES = ['12th Pass', 'Diploma', 'Bachelor', 'Master', 'PhD', 'Professional Degree', 'Other'];
const PROFESSIONS = ['Student', 'Engineer', 'Doctor', 'Lawyer', 'Business Owner', 'Entrepreneur', 'IT Professional', 'Accountant', 'Teacher', 'Civil Servant', 'Other'];
const INCOME_RANGES = [
  { value: '0-3', label: '₹0 - 3 Lac' },
  { value: '3-5', label: '₹3 - 5 Lac' },
  { value: '5-10', label: '₹5 - 10 Lac' },
  { value: '10-15', label: '₹10 - 15 Lac' },
  { value: '15-25', label: '₹15 - 25 Lac' },
  { value: '25-50', label: '₹25 - 50 Lac' },
  { value: '50+', label: '₹50 Lac+' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const EducationStep = () => {
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
          label="Highest Education"
          options={EDUCATION_DEGREES.map(e => ({ value: e, label: e }))}
          value={formData.education}
          onChange={(value) => updateFormData('education', value)}
          placeholder="Select your education level"
        />
      </motion.div>

      {formData.education && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <FormField
            label="Degree / Course"
            placeholder="e.g., B.Tech, MBA, MBBS"
            value={formData.degree}
            onChange={(value) => updateFormData('degree', value)}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Select
          label="Profession"
          options={PROFESSIONS.map(p => ({ value: p, label: p }))}
          value={formData.profession}
          onChange={(value) => updateFormData('profession', value)}
          placeholder="Select your profession"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Select
          label="Annual Income"
          options={INCOME_RANGES}
          value={formData.income}
          onChange={(value) => updateFormData('income', value)}
          placeholder="Select income range"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-900"
      >
        <p className="font-medium mb-1">📚 Career matters</p>
        <p>Your education and career help us find someone with similar professional background and goals.</p>
      </motion.div>
    </div>
  );
};

export default EducationStep;
