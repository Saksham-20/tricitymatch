import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import { CASTE_OPTIONS, CASTE_OTHER } from '../../../constants/profileOptions';

const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Buddhist', 'Jain', 'Other'];
const MOTHER_TONGUES = ['Punjabi', 'Hindi', 'English', 'Marathi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Other'];

const CASTE_VALUES = new Set(CASTE_OPTIONS.map((o) => o.value));
const CASTE_SELECT_OPTIONS = [...CASTE_OPTIONS, { value: CASTE_OTHER, label: 'Other (type your own)' }];

const ReligionStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();

  // A saved caste that isn't in the curated list (e.g. a legacy free-text value
  // like "Chadha") must resolve to "Other" with the value prefilled — otherwise
  // the Select shows a placeholder and Save silently wipes their real caste.
  const [casteOther, setCasteOther] = useState(
    () => !!formData.caste && !CASTE_VALUES.has(formData.caste)
  );

  const casteSelectValue = casteOther
    ? CASTE_OTHER
    : (CASTE_VALUES.has(formData.caste) ? formData.caste : '');

  const handleCasteSelect = (value) => {
    if (value === CASTE_OTHER) {
      setCasteOther(true);
      // keep any existing free text; don't clobber a legacy value
    } else {
      setCasteOther(false);
      updateFormData('caste', value); // '' when cleared
    }
  };

  const validateStep = () => {
    const newErrors = {};
    // Religion is optional in the new design, but caste requires religion
    if (formData.caste && !formData.religion) {
      newErrors.religion = 'Please select religion to specify caste';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return () => validateStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Select
          label="Religion"
          options={RELIGIONS.map(r => ({ value: r, label: r }))}
          value={formData.religion}
          onChange={(value) => updateFormData('religion', value)}
          error={errors.religion}
          placeholder="Select your religion"
        />
      </motion.div>

      {formData.religion && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Select
              label="Caste / Community"
              options={CASTE_SELECT_OPTIONS}
              value={casteSelectValue}
              onChange={handleCasteSelect}
              searchable
              placeholder="Search your community (optional)"
            />
            <AnimatePresence>
              {casteOther && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <FormField
                    label="Your community"
                    placeholder="Type your community"
                    value={formData.caste}
                    onChange={(value) => updateFormData('caste', value)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <FormField
              label="Sub-caste"
              placeholder="Optional"
              value={formData.subCaste}
              onChange={(value) => updateFormData('subCaste', value)}
            />
            <FormField
              label="Gotra"
              placeholder="Optional"
              value={formData.gotra}
              onChange={(value) => updateFormData('gotra', value)}
            />
          </motion.div>
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Select
          label="Mother Tongue"
          options={MOTHER_TONGUES.map(m => ({ value: m, label: m }))}
          value={formData.motherTongue}
          onChange={(value) => updateFormData('motherTongue', value)}
          placeholder="Select your mother tongue"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600"
      >
        <p className="font-medium text-neutral-800 mb-1">Cultural compatibility</p>
        <p>Your religious and cultural background helps us find compatible matches who share your values. Caste is optional.</p>
      </motion.div>
    </div>
  );
};

export default ReligionStep;
