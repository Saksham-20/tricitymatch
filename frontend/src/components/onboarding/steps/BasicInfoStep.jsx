import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import Select from '../../ui/Select';
import DobField from '../../ui/DobField';
import ContactNumberVerify from '../../common/ContactNumberVerify';
import { validateName, validateAge } from '../../../utils/validators';
import { staggerContainer, fadeRise } from '../../../utils/animations';
import { minAgeFor, pickerMinAge, minAgeMessage } from '../../../utils/marriageableAge';

// 4'6" – 7'0" in one-inch increments, stored as cm (backend validates 100–250).
const HEIGHT_OPTIONS = (() => {
  const opts = [];
  for (let ft = 4; ft <= 7; ft++) {
    for (let inch = 0; inch <= 11; inch++) {
      if (ft === 4 && inch < 6) continue;
      if (ft === 7 && inch > 0) break;
      const cm = Math.round(ft * 30.48 + inch * 2.54);
      opts.push({ value: String(cm), label: `${ft}'${inch}" (${cm} cm)` });
    }
  }
  return opts;
})();

const BasicInfoStep = () => {
  const { formData, updateFormData, errors, setStepErrors, setFieldTouched, registerStepValidator, mode } = useOnboarding();
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  // Date of birth and gender cannot be changed after sign-up (the server refuses;
  // support can correct them). In the editor, a value that was already saved is
  // shown read-only rather than offered and then rejected on save.
  const initialIdentity = useRef({ gender: formData.gender, dateOfBirth: formData.dateOfBirth });
  const genderLocked = mode === 'edit' && !!initialIdentity.current.gender;
  const dobLocked = mode === 'edit' && !!initialIdentity.current.dateOfBirth;

  const validateStep = () => {
    const data = formDataRef.current;
    const newErrors = {};

    if (!data.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (!validateName(data.firstName)) {
      newErrors.firstName = 'At least 2 characters';
    }

    if (!data.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (!validateName(data.lastName)) {
      newErrors.lastName = 'At least 2 characters';
    }

    if (!data.gender) {
      newErrors.gender = 'Gender is required';
    }

    // An email signup has no phone yet; members call this number after an
    // unlock, so it must be present and proven before the account exists.
    if (mode === 'signup' && data.email && !data.phoneVerification) {
      newErrors.phone = 'Verify your mobile number to continue';
    }

    if (!data.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else if (!validateAge(data.dateOfBirth, minAgeFor(data.gender), 100)) {
      // Calendar-accurate (leap-year safe) instead of 365.25-day float math.
      // 21 for men and "other", 18 for women (Prohibition of Child Marriage Act).
      newErrors.dateOfBirth = minAgeMessage(data.gender);
    }

    if (data.weight !== '' && data.weight != null) {
      const w = Number(data.weight);
      if (!Number.isInteger(w) || w < 30 || w > 300) {
        newErrors.weight = 'Weight must be between 30–300 kg';
      }
    }

    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return registerStepValidator(validateStep);
  }, []);

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  const handleFieldBlur = (field) => () => {
    setFieldTouched(field);
    validateStep();
  };

  return (
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            autoComplete="given-name"
            placeholder="John"
            value={formData.firstName}
            onChange={(value) => updateFormData('firstName', value)}
            onBlur={handleFieldBlur('firstName')}
            error={errors.firstName}
            required
          />
          <FormField
            label="Last Name"
            autoComplete="family-name"
            placeholder="Smith"
            value={formData.lastName}
            onChange={(value) => updateFormData('lastName', value)}
            onBlur={handleFieldBlur('lastName')}
            error={errors.lastName}
            required
          />
        </div>
        <p className="text-xs text-neutral-400 mt-1.5">Your real name, as families will see it. Real names build trust.</p>
      </motion.div>

      <motion.div variants={fadeRise}>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Gender <span className="text-red-500 ml-1">*</span>
          </span>
          <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Gender">
            {genderOptions.map((opt) => {
              const selected = formData.gender === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={genderLocked && !selected}
                  onClick={() => { if (genderLocked) return; updateFormData('gender', opt.value); setFieldTouched('gender'); validateStep(); }}
                  className={`min-h-[2.75rem] py-3 rounded-xl border-2 text-sm font-semibold transition-colors duration-[160ms] active:scale-[0.97] ${
                    selected
                      ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-primary-300'
                  } ${genderLocked && !selected ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errors.gender && <p className="text-sm text-red-600 font-medium">{errors.gender}</p>}
          {(genderLocked || dobLocked) && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Gender and date of birth cannot be changed after sign-up. If one is wrong, <a href="/contact" className="underline text-primary-600 dark:text-primary-300">contact support</a>.
            </p>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeRise}>
        {/* Day/Month/Year selects instead of a native date input — the Android
            calendar dialog (clamped 18 years back, decades of paging) was a
            reported usability failure, and pickers are the wrong tool for a
            birthday anyway. Year list already bounds 18-100. */}
        {dobLocked ? (
          <div>
            <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Date of Birth</span>
            <p className="mt-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 px-4 py-3 text-sm text-neutral-700 dark:text-neutral-200">
              {new Date(formData.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
            </p>
          </div>
        ) : (
        <DobField
          minAge={pickerMinAge(formData.gender)}
          value={formData.dateOfBirth}
          onChange={(value) => { updateFormData('dateOfBirth', value); setFieldTouched('dateOfBirth'); validateStep(); }}
          error={errors.dateOfBirth}
          hint="Used for age and horoscope matching. Your exact birthday is never shown publicly."
          required
        />
        )}
      </motion.div>

      {mode === 'signup' && formData.email && (
        <motion.div variants={fadeRise}>
          <ContactNumberVerify
            flow="signup"
            value={formData.phone}
            verified={!!formData.phoneVerification}
            error={errors.phone}
            onChange={(d) => {
              updateFormData('phone', d);
              if (formData.phoneVerification) updateFormData('phoneVerification', false);
            }}
            onVerified={(d, proof) => { updateFormData('phone', d); updateFormData('phoneProof', proof || ''); updateFormData('phoneVerification', true); setStepErrors({}); }}
          />
        </motion.div>
      )}

      {/* Height/weight are collected post-signup: self-signup stays a 2-field
          minimum, while edit + guardian flows carry the full basic profile. */}
      {mode !== 'signup' && (
        <motion.div variants={fadeRise}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Height"
              options={HEIGHT_OPTIONS}
              value={formData.height ? String(formData.height) : ''}
              onChange={(value) => updateFormData('height', value)}
              searchable
              placeholder="Search height"
              optional
            />
            <FormField
              label="Weight (kg)"
              type="number"
              inputMode="numeric"
              placeholder="65"
              value={formData.weight}
              onChange={(value) => updateFormData('weight', value)}
              onBlur={handleFieldBlur('weight')}
              error={errors.weight}
              optional
            />
          </div>
          <p className="text-xs text-neutral-400 mt-1.5">Optional, but profiles with height filled appear in more filtered searches.</p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default BasicInfoStep;
