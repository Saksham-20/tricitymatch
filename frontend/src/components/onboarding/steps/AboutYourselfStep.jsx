import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import { FiX } from 'react-icons/fi';
import { staggerContainer, fadeRise, listRow } from '../../../utils/animations';

const INTERESTS = [
  'Reading', 'Movies', 'Travel', 'Cooking', 'Fitness',
  'Music', 'Art', 'Sports', 'Yoga', 'Photography',
  'Dancing', 'Gaming', 'Gardening', 'Meditation', 'Language Learning'
];

const LANGUAGES = [
  'Hindi', 'Punjabi', 'English', 'Urdu', 'Haryanvi',
  'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati',
  'Kannada', 'Malayalam', 'Sanskrit',
];

const AboutYourselfStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();
  const [interestInput, setInterestInput] = useState('');
  const languages = formData.languages || [];

  const toggleLanguage = (lang) => {
    if (languages.includes(lang)) {
      updateFormData('languages', languages.filter((l) => l !== lang));
    } else {
      updateFormData('languages', [...languages, lang]);
    }
  };

  const validateStep = () => {
    const newErrors = {};
    setStepErrors(newErrors);
    return true;
  };

  React.useEffect(() => {
    return () => validateStep();
  }, []);

  const addInterest = (interest) => {
    if (!formData.interestTags.includes(interest)) {
      updateFormData('interestTags', [...formData.interestTags, interest]);
    }
    setInterestInput('');
  };

  const removeInterest = (interest) => {
    updateFormData('interestTags', formData.interestTags.filter(tag => tag !== interest));
  };

  return (
    <motion.div className="space-y-5" initial="initial" animate="animate" variants={staggerContainer}>
      {/* Bio */}
      <motion.div variants={fadeRise}>
        <label htmlFor="onboarding-bio" className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
          About Yourself
        </label>
        <textarea
          id="onboarding-bio"
          name="bio"
          aria-describedby="onboarding-bio-count"
          placeholder="Tell us about yourself, your values, and what makes you unique... (max 500 characters)"
          value={formData.bio}
          onChange={(e) => updateFormData('bio', e.target.value.slice(0, 500))}
          maxLength={500}
          rows={4}
          className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-[160ms] resize-none"
        />
        {/* Min 20 chars matches the completion meter's "bio done" threshold, so
            the editor and the meter finally agree on what counts as filled. */}
        <p id="onboarding-bio-count" className="text-xs mt-2">
          <span className={(formData.bio?.trim().length || 0) >= 20 ? 'text-green-600 font-medium' : 'text-neutral-500'}>
            {formData.bio?.length || 0}/500
          </span>
          {(formData.bio?.trim().length || 0) < 20 && (
            <span className="text-neutral-400"> · minimum 20 characters</span>
          )}
        </p>
      </motion.div>

      {/* Interests */}
      <motion.div variants={fadeRise}>
        <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
          Your Interests
        </label>

        {/* Selected interests — rows that appear/disappear in place as the
            member taps suggestions, so `listRow` (transition-based, retargets
            on rapid add/remove) rather than a one-off scale-pop. */}
        {formData.interestTags.length > 0 && (
          <motion.div layout className="flex flex-wrap gap-2 mb-3">
            <AnimatePresence initial={false}>
              {formData.interestTags.map((interest) => (
                <motion.div
                  key={interest}
                  layout
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={listRow}
                  className="inline-flex items-center gap-2 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 px-3 py-1 min-h-[36px] rounded-full text-sm font-medium"
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => removeInterest(interest)}
                    aria-label={`Remove ${interest}`}
                    className="flex items-center justify-center min-w-[2.75rem] min-h-[2.75rem] -m-2 rounded-full hover:text-primary-900 dark:hover:text-primary-200 transition-colors duration-[160ms]"
                  >
                    <FiX size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Suggested interests — a filter-toolbar-style option grid, not a list
            that "enters"; the whole group fades in once with the parent step
            rather than staggering per chip (doctrine caps stagger at 6, and
            there are 15 options here). */}
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => addInterest(interest)}
              disabled={formData.interestTags.includes(interest)}
              className={`px-3 py-2 min-h-[2.75rem] rounded-lg font-medium text-sm transition-colors duration-[160ms] active:scale-[0.97] ${
                formData.interestTags.includes(interest)
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 opacity-50 cursor-not-allowed'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Languages spoken */}
      <motion.div variants={fadeRise}>
        <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
          Languages You Speak
        </label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const selected = languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                aria-pressed={selected}
                className={`px-3 py-2 min-h-[2.75rem] rounded-lg font-medium text-sm border transition-colors duration-[160ms] active:scale-[0.97] ${
                  selected
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-primary-400 hover:text-primary-600'
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div variants={fadeRise} className="bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-1">A complete profile stands out</p>
        <p>A great bio and interests help matches get to know you and find common ground.</p>
      </motion.div>
    </motion.div>
  );
};

export default AboutYourselfStep;
