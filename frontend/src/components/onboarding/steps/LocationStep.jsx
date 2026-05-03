import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import Select from '../../ui/Select';

const CITIES = ['Chandigarh', 'Mohali', 'Panchkula'];

const LocationStep = () => {
  const { formData, updateFormData, errors, setStepErrors, registerStepValidator } = useOnboarding();
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const validateStep = () => {
    const newErrors = {};
    if (!formDataRef.current.city) {
      newErrors.city = 'Please select your city';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return registerStepValidator(validateStep);
  }, []);

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Select
          label="City"
          options={CITIES.map(city => ({ value: city, label: city }))}
          value={formData.city}
          onChange={(value) => updateFormData('city', value)}
          error={errors.city}
          required
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900"
      >
        <p className="font-medium mb-1">📍 Location-based matching</p>
        <p>We'll show you matches from your city and nearby areas.</p>
      </motion.div>
    </div>
  );
};

export default LocationStep;
