import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import { MANGLIK_OPTIONS, NAKSHATRA_OPTIONS, ZODIAC_OPTIONS, RASHI_OPTIONS } from '../../../constants/profileOptions';
import { staggerContainer, fadeRise, DUR, EASE_OUT } from '../../../utils/animations';

// The Kundli / horoscope form. Every field is optional — many members don't know
// their birth time or nakshatra, and horoscope is a match aid, not a gate.
// Trimmed to the essentials that actually drive Ashtakoot matching: Manglik +
// Nakshatra + birth place/time. (Nakshatra already fixes the Rashi/moon sign, and
// the Western sun-sign was redundant — both inputs removed to cut depth.)
const HoroscopeStep = () => {
  const { formData, updateFormData } = useOnboarding();

  return (
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise}>
        <Select
          label="Manglik / Mangal Dosha"
          options={MANGLIK_OPTIONS}
          value={formData.manglikStatus}
          onChange={(value) => updateFormData('manglikStatus', value)}
          placeholder="Select Manglik status"
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label="Nakshatra (Birth star)"
          options={NAKSHATRA_OPTIONS}
          value={formData.nakshatra}
          onChange={(value) => updateFormData('nakshatra', value)}
          searchable
          placeholder="Select Nakshatra"
        />
      </motion.div>

      <motion.div variants={fadeRise} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Rashi (Moon sign)"
          options={RASHI_OPTIONS}
          value={formData.rashi}
          onChange={(value) => updateFormData('rashi', value)}
          searchable
          optional
          placeholder="Select Rashi"
        />
        <Select
          label="Zodiac (Sun sign)"
          options={ZODIAC_OPTIONS}
          value={formData.zodiacSign}
          onChange={(value) => updateFormData('zodiacSign', value)}
          searchable
          optional
          placeholder="Select Zodiac sign"
        />
      </motion.div>

      {/* Progressive reveal: birth place/time only appear once a Manglik status
          is chosen — a member who skips horoscope skips the whole section. */}
      <AnimatePresence>
        {!!formData.manglikStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: DUR.accordion, ease: EASE_OUT } }}
            exit={{ opacity: 0, height: 0, transition: { duration: DUR.accordion, ease: EASE_OUT } }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-hidden"
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
              <p className="text-xs text-neutral-400 mt-1.5">As close as you know, used for Kundli matching.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeRise} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800 mb-1">All optional</p>
        <p>Horoscope details power Ashtakoot / Manglik compatibility and your Kundli match report. Fill what you know, you can add the rest later.</p>
      </motion.div>
    </motion.div>
  );
};

export default HoroscopeStep;
