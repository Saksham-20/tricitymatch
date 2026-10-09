import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import CheckBox from '../../ui/CheckBox';
import { CASTE_OPTIONS, CASTE_OTHER } from '../../../constants/profileOptions';
import { staggerContainer, fadeRise, DUR, EASE_OUT } from '../../../utils/animations';

const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Buddhist', 'Jain', 'Other'];
const MOTHER_TONGUES = ['Punjabi', 'Hindi', 'English', 'Marathi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Other'];

const CASTE_VALUES = new Set(CASTE_OPTIONS.map((o) => o.value));

const ReligionStep = () => {
  const { t } = useTranslation();
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();
  const CASTE_SELECT_OPTIONS = [...CASTE_OPTIONS, { value: CASTE_OTHER, label: t('onboarding.religion.otherCaste') }];

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
    // Everything on this step is optional and independent — caste/community is
    // available to every religion (no gating), so there is nothing to block on.
    setStepErrors({});
    return true;
  };

  React.useEffect(() => {
    return () => validateStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.religion.religion')}
          options={RELIGIONS.map(r => ({ value: r, label: r }))}
          value={formData.religion}
          onChange={(value) => updateFormData('religion', value)}
          error={errors.religion}
          placeholder={t('onboarding.religion.selectReligion')}
        />
      </motion.div>

      {/* Caste / community + horoscope details are available to EVERY religion —
          no gating. Search the list or type your own via "Other". */}
      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.religion.caste')}
          options={CASTE_SELECT_OPTIONS}
          value={casteSelectValue}
          onChange={handleCasteSelect}
          searchable
          optional
          placeholder={t('onboarding.religion.searchCaste')}
        />
        <AnimatePresence>
          {casteOther && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', transition: { duration: DUR.accordion, ease: EASE_OUT } }}
              exit={{ opacity: 0, height: 0, transition: { duration: DUR.accordion, ease: EASE_OUT } }}
              className="mt-3 overflow-hidden"
            >
              <FormField
                label={t('onboarding.religion.yourCommunity')}
                placeholder={t('onboarding.religion.typeCommunity')}
                value={formData.caste}
                onChange={(value) => updateFormData('caste', value)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Progressive reveal: sub-caste/gotra only make sense once a community
          is chosen — hidden until then to keep the form short (shortest path). */}
      <AnimatePresence>
        {!!(formData.caste || '').trim() && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: DUR.accordion, ease: EASE_OUT } }}
            exit={{ opacity: 0, height: 0, transition: { duration: DUR.accordion, ease: EASE_OUT } }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-hidden"
          >
            <FormField
              label={t('onboarding.religion.subCaste')}
              placeholder={t('onboarding.optional')}
              value={formData.subCaste}
              onChange={(value) => updateFormData('subCaste', value)}
            />
            <FormField
              label={t('onboarding.religion.gotra')}
              placeholder={t('onboarding.optional')}
              value={formData.gotra}
              onChange={(value) => updateFormData('gotra', value)}
            />
            {(formData.gotra || '').trim() && (
              <div className="sm:col-span-2">
                <CheckBox
                  checked={!!formData.excludeSameGotra}
                  onChange={(checked) => updateFormData('excludeSameGotra', checked)}
                  label={t('onboarding.religion.excludeGotra')}
                  hint={t('onboarding.religion.excludeGotraHint')}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeRise}>
        <Select
          label={t('onboarding.religion.motherTongue')}
          options={MOTHER_TONGUES.map(m => ({ value: m, label: m }))}
          value={formData.motherTongue}
          onChange={(value) => updateFormData('motherTongue', value)}
          searchable
          placeholder={t('onboarding.religion.searchMotherTongue')}
        />
      </motion.div>

      <motion.div variants={fadeRise} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800 mb-1">{t('onboarding.religion.infoTitle')}</p>
        <p>{t('onboarding.religion.infoBody')}</p>
      </motion.div>
    </motion.div>
  );
};

export default ReligionStep;
