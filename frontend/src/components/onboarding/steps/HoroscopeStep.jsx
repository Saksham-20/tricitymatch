import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import { MANGLIK_OPTIONS, NAKSHATRA_OPTIONS, ZODIAC_OPTIONS, RASHI_OPTIONS, translateOptions } from '../../../constants/profileOptions';
import { staggerContainer, fadeRise, DUR, EASE_OUT } from '../../../utils/animations';

// The Kundli / horoscope form. Every field is optional — many members don't know
// their birth time or nakshatra, and horoscope is a match aid, not a gate.
// Trimmed to the essentials that actually drive Ashtakoot matching: Manglik +
// Nakshatra + birth place/time. (Nakshatra already fixes the Rashi/moon sign, and
// the Western sun-sign was redundant — both inputs removed to cut depth.)
const HoroscopeStep = () => {
  const { t } = useTranslation();
  const { formData, updateFormData } = useOnboarding();

  return (
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise} className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-lg p-4 text-sm text-neutral-700 dark:text-neutral-200">
        <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">{t('onboarding.horoscope.skipTitle')}</p>
        <p>{t('onboarding.horoscope.skipBody')}</p>
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.horoscope.manglik')}
          options={translateOptions('manglikStatus', MANGLIK_OPTIONS, t)}
          value={formData.manglikStatus}
          onChange={(value) => updateFormData('manglikStatus', value)}
          placeholder={t('onboarding.horoscope.selectManglik')}
        />
      </motion.div>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.horoscope.nakshatra')}
          options={NAKSHATRA_OPTIONS}
          value={formData.nakshatra}
          onChange={(value) => updateFormData('nakshatra', value)}
          searchable
          placeholder={t('onboarding.horoscope.selectNakshatra')}
        />
      </motion.div>

      <motion.div variants={fadeRise} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label={t('onboarding.horoscope.rashi')}
          options={translateOptions('rashi', RASHI_OPTIONS, t)}
          value={formData.rashi}
          onChange={(value) => updateFormData('rashi', value)}
          searchable
          optional
          placeholder={t('onboarding.horoscope.selectRashi')}
        />
        <Select
          label={t('onboarding.horoscope.zodiac')}
          options={ZODIAC_OPTIONS}
          value={formData.zodiacSign}
          onChange={(value) => updateFormData('zodiacSign', value)}
          searchable
          optional
          placeholder={t('onboarding.horoscope.selectZodiac')}
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
              label={t('onboarding.horoscope.placeOfBirth')}
              placeholder={t('onboarding.horoscope.placeOfBirthPlaceholder')}
              value={formData.placeOfBirth}
              onChange={(value) => updateFormData('placeOfBirth', value)}
            />
            <div>
              <FormField
                label={t('onboarding.horoscope.timeOfBirth')}
                type="time"
                value={formData.birthTime}
                onChange={(value) => updateFormData('birthTime', value)}
              />
              <p className="text-xs text-neutral-400 mt-1.5">{t('onboarding.horoscope.timeOfBirthHint')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeRise} className="bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-1">{t('onboarding.horoscope.infoTitle')}</p>
        <p>{t('onboarding.horoscope.infoBody')}</p>
      </motion.div>
    </motion.div>
  );
};

export default HoroscopeStep;
