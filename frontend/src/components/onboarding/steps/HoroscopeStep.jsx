import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import { MANGLIK_OPTIONS, NAKSHATRA_OPTIONS } from '../../../constants/profileOptions';

// The Kundli / horoscope form. Every field is optional — many members don't know
// their birth time or nakshatra, and horoscope is a match aid, not a gate.
// Trimmed to the essentials that actually drive Ashtakoot matching: Manglik +
// Nakshatra + birth place/time. (Nakshatra already fixes the Rashi/moon sign, and
// the Western sun-sign was redundant — both inputs removed to cut depth.)
const HoroscopeStep = () => {
  const { formData, updateFormData } = useOnboarding();

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Select
          label="Manglik / Mangal Dosha"
          options={MANGLIK_OPTIONS}
          value={formData.manglikStatus}
          onChange={(value) => updateFormData('manglikStatus', value)}
          placeholder="Select Manglik status"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Select
          label="Nakshatra (Birth star)"
          options={NAKSHATRA_OPTIONS}
          value={formData.nakshatra}
          onChange={(value) => updateFormData('nakshatra', value)}
          searchable
          placeholder="Select Nakshatra"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <FormField
          label="Place of Birth"
          placeholder="City / town"
          value={formData.placeOfBirth}
          onChange={(value) => updateFormData('placeOfBirth', value)}
        />
        <div>
          <FormField
            label="Time of Birth"
            type="time"
            value={formData.birthTime}
            onChange={(value) => updateFormData('birthTime', value)}
          />
          <p className="text-xs text-neutral-400 mt-1.5">As close as you know — used for Kundli matching.</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600"
      >
        <p className="font-medium text-neutral-800 mb-1">All optional</p>
        <p>Horoscope details power Ashtakoot / Manglik compatibility and your Kundli match report. Fill what you know — you can add the rest later.</p>
      </motion.div>
    </div>
  );
};

export default HoroscopeStep;
