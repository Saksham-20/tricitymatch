import React from 'react';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import { CITY_VALUES } from '../../../constants/profileOptions';
import { staggerContainer, fadeRise } from '../../../utils/animations';

const PreferencesStep = () => {
  const { formData, updateFormData, errors, setStepErrors, registerStepValidator } = useOnboarding();
  const CITIES = CITY_VALUES;
  const EDUCATION_OPTIONS = ['12th Pass', 'Diploma', 'Bachelor', 'Master', 'PhD', 'Professional Degree'];

  // Registered once below — read the latest values through a ref so the
  // registered closure never validates against the stale mount-time formData.
  const formDataRef = React.useRef(formData);
  formDataRef.current = formData;

  const validateStep = () => {
    const d = formDataRef.current;
    const newErrors = {};
    if (d.preferredAgeMin && d.preferredAgeMax && d.preferredAgeMin > d.preferredAgeMax) {
      newErrors.preferredAge = 'Minimum age cannot be greater than maximum age';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Wired into the step-advance gate (was only running as an unmount side
  // effect, so clicking Next invoked whichever validator a PRIOR step left
  // registered, never this one — the age-range check never actually blocked).
  React.useEffect(() => {
    return registerStepValidator(validateStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise} className="grid grid-cols-2 gap-4">
        <FormField
          label="Preferred Age (Min)"
          type="number"
          inputMode="numeric"
          placeholder="20"
          value={formData.preferredAgeMin}
          onChange={(value) => updateFormData('preferredAgeMin', value)}
          onBlur={validateStep}
          error={errors.preferredAge}
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
          onBlur={validateStep}
          min="18"
          max="70"
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label="Preferred Education"
          options={EDUCATION_OPTIONS.map(e => ({ value: e, label: e }))}
          value={formData.preferredEducation}
          onChange={(value) => updateFormData('preferredEducation', value)}
          placeholder="Any education level"
        />
      </motion.div>

      <motion.div variants={fadeRise}>
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[2.75rem] rounded-full text-sm font-medium border transition-colors duration-[160ms] active:scale-[0.97] ${
                  selected
                    ? 'bg-primary-500 border-primary-500 text-white shadow-burgundy'
                    : 'bg-white border-neutral-300 text-neutral-700 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-300'
                }`}
              >
                {selected && <FiCheck className="w-3.5 h-3.5" />}
                {city}
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div variants={fadeRise} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800 mb-1">Smarter match recommendations</p>
        <p>Your preferences help our algorithm find the most compatible matches for you.</p>
      </motion.div>
    </motion.div>
  );
};

export default PreferencesStep;
