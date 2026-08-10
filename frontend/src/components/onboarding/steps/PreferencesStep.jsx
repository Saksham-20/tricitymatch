import React from 'react';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import { CITY_VALUES } from '../../../constants/profileOptions';

const PreferencesStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();
  const CITIES = CITY_VALUES;
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
          inputMode="numeric"
          placeholder="20"
          value={formData.preferredAgeMin}
          onChange={(value) => updateFormData('preferredAgeMin', value)}
          min="18"
          max="70"
        />
        <FormField
          label="Preferred Age (Max)"
          type="number"
          inputMode="numeric"
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
        <label className="block text-sm font-medium text-neutral-900 mb-1">
          Preferred Cities
        </label>
        <p className="text-xs text-neutral-500 mb-3">Tap all the cities you're open to.</p>
        <div className="flex flex-wrap gap-2">
          {CITIES.map((city) => {
            const selected = formData.preferredCity?.includes(city);
            return (
              <button
                type="button"
                key={city}
                onClick={() => handleCityToggle(city)}
                aria-pressed={selected}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all ${
                  selected
                    ? 'bg-primary-500 border-primary-500 text-white shadow-burgundy'
                    : 'bg-white border-neutral-300 text-neutral-700 hover:border-primary-400 hover:text-primary-600'
                }`}
              >
                {selected && <FiCheck className="w-3.5 h-3.5" />}
                {city}
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600"
      >
        <p className="font-medium text-neutral-800 mb-1">Smarter match recommendations</p>
        <p>Your preferences help our algorithm find the most compatible matches for you.</p>
      </motion.div>
    </div>
  );
};

export default PreferencesStep;
