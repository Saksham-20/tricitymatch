import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import CheckBox from '../../ui/CheckBox';

const PreferencesStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();
  const CITIES = ['Chandigarh', 'Mohali', 'Panchkula', 'Delhi', 'Mumbai', 'Bangalore'];
  const EDUCATION_OPTIONS = ['12th Pass', 'Diploma', 'Bachelor', 'Master', 'PhD', 'Professional Degree'];

  const validateStep = () => {
    const newErrors = {};
    if (formData.preferredAgeMin && formData.preferredAgeMax && formData.preferredAgeMin > formData.preferredAgeMax) {
      newErrors.preferredAge = 'Minimum age cannot be greater than maximum age';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return () => validateStep();
  }, []);

  const handleCityToggle = (city) => {
    const cities = formData.preferredCity || [];
    if (cities.includes(city)) {
      updateFormData('preferredCity', cities.filter(c => c !== city));
    } else {
      updateFormData('preferredCity', [...cities, city]);
    }
  };

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-4"
      >
        <FormField
          label="Preferred Age (Min)"
          type="number"
          placeholder="20"
          value={formData.preferredAgeMin}
          onChange={(value) => updateFormData('preferredAgeMin', value)}
          min="18"
          max="70"
        />
        <FormField
          label="Preferred Age (Max)"
          type="number"
          placeholder="35"
          value={formData.preferredAgeMax}
          onChange={(value) => updateFormData('preferredAgeMax', value)}
          min="18"
          max="70"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Select
          label="Preferred Education"
          options={EDUCATION_OPTIONS.map(e => ({ value: e, label: e }))}
          value={formData.preferredEducation}
          onChange={(value) => updateFormData('preferredEducation', value)}
          placeholder="Any education level"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <label className="block text-sm font-medium text-neutral-900 mb-3">
          Preferred Cities
        </label>
        <div className="space-y-2">
          {CITIES.map((city, idx) => (
            <motion.div
              key={city}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + idx * 0.05 }}
            >
              <CheckBox
                checked={formData.preferredCity?.includes(city)}
                onChange={() => handleCityToggle(city)}
                label={city}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 text-sm text-cyan-900"
      >
        <p className="font-medium mb-1">🎯 Find your perfect match</p>
        <p>Your preferences help our algorithm find the most compatible matches for you.</p>
      </motion.div>
    </div>
  );
};

export default PreferencesStep;
