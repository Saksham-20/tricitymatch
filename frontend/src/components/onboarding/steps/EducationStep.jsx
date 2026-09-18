import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import { staggerContainer, fadeRise } from '../../../utils/animations';

const EDUCATION_DEGREES = ['12th Pass', 'Diploma', 'Bachelor', 'Master', 'PhD', 'Professional Degree', 'Other'];
const PROFESSIONS = ['Student', 'Engineer', 'Doctor', 'Lawyer', 'Business Owner', 'Entrepreneur', 'IT Professional', 'Accountant', 'Teacher', 'Civil Servant', 'Other'];
const INCOME_RANGES = [
  { value: '300000', label: '₹0 - 3 Lac' },
  { value: '500000', label: '₹3 - 5 Lac' },
  { value: '1000000', label: '₹5 - 10 Lac' },
  { value: '1500000', label: '₹10 - 15 Lac' },
  { value: '2500000', label: '₹15 - 25 Lac' },
  { value: '5000000', label: '₹25 - 50 Lac' },
  { value: '10000000', label: '₹50 Lac+' },
  { value: '0', label: 'Prefer not to say' },
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
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise}>
        <Select
          label="Highest Education"
          options={EDUCATION_DEGREES.map(e => ({ value: e, label: e }))}
          value={formData.education}
          onChange={(value) => updateFormData('education', value)}
          placeholder="Select your education level"
        />
      </motion.div>

      {formData.education && (
        <motion.div initial="initial" animate="animate" variants={fadeRise}>
          <FormField
            label="Degree / Course"
            placeholder="e.g., B.Tech, MBA, MBBS"
            value={formData.degree}
            onChange={(value) => updateFormData('degree', value)}
          />
        </motion.div>
      )}

      <motion.div variants={fadeRise}>
        <Select
          label="Profession"
          options={PROFESSIONS.map(p => ({ value: p, label: p }))}
          value={formData.profession}
          onChange={(value) => updateFormData('profession', value)}
          searchable
          placeholder="Search your profession"
        />
      </motion.div>

      {/* Progressive reveal: income follows profession — mirrors the mobile
          journey (details only after the field they qualify is filled). */}
      {formData.profession && (
        <motion.div initial="initial" animate="animate" variants={fadeRise}>
          <Select
            label="Annual Income"
            options={INCOME_RANGES}
            value={formData.income}
            onChange={(value) => updateFormData('income', value)}
            placeholder="Select income range"
          />
        </motion.div>
      )}

      <motion.div variants={fadeRise} className="bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-1">Education &amp; career</p>
        <p>Your education and career help us find someone with similar professional background and goals.</p>
      </motion.div>
    </motion.div>
  );
};

export default EducationStep;
