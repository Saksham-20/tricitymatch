import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiGlobe } from 'react-icons/fi';
import { useOnboarding } from '../../../context/OnboardingContext';
import Select from '../../ui/Select';
import FormField from '../../ui/FormField';
import CheckBox from '../../ui/CheckBox';
import { CITY_OPTIONS, CITY_VALUES, CITY_OTHER } from '../../../constants/profileOptions';

const CITY_VALUE_SET = new Set(CITY_VALUES);
const CITY_SELECT_OPTIONS = [...CITY_OPTIONS, { value: CITY_OTHER, label: 'Other (type your city)' }];

// Common NRI destination countries; free-text "Other" catches the rest.
const NRI_COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'New Zealand',
  'United Arab Emirates', 'Singapore', 'Malaysia', 'Saudi Arabia', 'Qatar',
  'Kuwait', 'Oman', 'Bahrain', 'Germany', 'France', 'Netherlands', 'Ireland',
  'Italy', 'Hong Kong', 'Japan', 'South Africa',
];
const COUNTRY_OTHER = '__other_country__';
const COUNTRY_SET = new Set(NRI_COUNTRIES);
const COUNTRY_OPTIONS = [
  ...NRI_COUNTRIES.map((c) => ({ value: c, label: c })),
  { value: COUNTRY_OTHER, label: 'Other (type your country)' },
];

const RESIDENCE_STATUS = ['Citizen', 'Permanent Resident', 'Work Visa', 'Student Visa', 'Other']
  .map((s) => ({ value: s, label: s }));

const LocationStep = () => {
  const { formData, updateFormData, errors, setStepErrors, registerStepValidator } = useOnboarding();
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // A saved city not in the curated list resolves to "Other" with the value
  // prefilled (same pattern as caste), so Save never wipes a legacy free-text city.
  const [cityOther, setCityOther] = useState(
    () => !!formData.city && !CITY_VALUE_SET.has(formData.city)
  );
  const citySelectValue = cityOther
    ? CITY_OTHER
    : (CITY_VALUE_SET.has(formData.city) ? formData.city : '');

  const handleCitySelect = (value) => {
    if (value === CITY_OTHER) {
      setCityOther(true);
    } else {
      setCityOther(false);
      updateFormData('city', value);
    }
  };

  const [countryOther, setCountryOther] = useState(
    () => !!formData.residenceCountry && !COUNTRY_SET.has(formData.residenceCountry)
  );
  const countrySelectValue = countryOther
    ? COUNTRY_OTHER
    : (COUNTRY_SET.has(formData.residenceCountry) ? formData.residenceCountry : '');

  const handleCountrySelect = (value) => {
    if (value === COUNTRY_OTHER) {
      setCountryOther(true);
    } else {
      setCountryOther(false);
      updateFormData('residenceCountry', value);
    }
  };

  const validateStep = () => {
    const newErrors = {};
    if (!formDataRef.current.city) {
      newErrors.city = 'Please select your city';
    }
    if (formDataRef.current.isNri && !formDataRef.current.residenceCountry) {
      newErrors.residenceCountry = 'Please tell us which country you live in';
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
          options={CITY_SELECT_OPTIONS}
          value={citySelectValue}
          onChange={handleCitySelect}
          error={errors.city}
          searchable
          required
          placeholder="Search your city"
        />
        <AnimatePresence>
          {cityOther && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <FormField
                label="Your city"
                placeholder="Type your city"
                value={CITY_VALUE_SET.has(formData.city) ? '' : formData.city}
                onChange={(value) => updateFormData('city', value)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* NRI / living-abroad declaration — inline, not a separate section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-lg border border-neutral-200 p-4"
      >
        <div className="flex items-start gap-2.5">
          <FiGlobe className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <CheckBox
              checked={!!formData.isNri}
              onChange={() => updateFormData('isNri', !formData.isNri)}
              label="I'm an NRI / currently living outside India"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Helps us match you with families open to an NRI alliance and show prices in your currency.
            </p>
          </div>
        </div>

        <AnimatePresence>
          {formData.isNri && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-4 mt-4 border-t border-neutral-100">
                <div>
                  <Select
                    label="Country you live in"
                    options={COUNTRY_OPTIONS}
                    value={countrySelectValue}
                    onChange={handleCountrySelect}
                    error={errors.residenceCountry}
                    searchable
                    required
                    placeholder="Search your country"
                  />
                  <AnimatePresence>
                    {countryOther && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <FormField
                          label="Your country"
                          placeholder="Type your country"
                          value={COUNTRY_SET.has(formData.residenceCountry) ? '' : formData.residenceCountry}
                          onChange={(value) => updateFormData('residenceCountry', value)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Select
                  label="Residency status"
                  options={RESIDENCE_STATUS}
                  value={formData.residenceStatus}
                  onChange={(value) => updateFormData('residenceStatus', value)}
                  optional
                  placeholder="e.g. Permanent Resident"
                />

                <FormField
                  label="Where is your family based in India?"
                  placeholder="e.g. Ludhiana, Punjab"
                  value={formData.familyLocation}
                  onChange={(value) => updateFormData('familyLocation', value)}
                  optional
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600"
      >
        <p className="font-medium text-neutral-800 mb-1">Location-based matching</p>
        <p>We'll show you matches from your city and nearby areas.</p>
      </motion.div>
    </div>
  );
};

export default LocationStep;
