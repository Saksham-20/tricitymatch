import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import { FiX } from 'react-icons/fi';

const INTERESTS = [
  'Reading', 'Movies', 'Travel', 'Cooking', 'Fitness',
  'Music', 'Art', 'Sports', 'Yoga', 'Photography',
  'Dancing', 'Gaming', 'Gardening', 'Meditation', 'Language Learning'
];

const AboutYourselfStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();
  const [interestInput, setInterestInput] = useState('');

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
    <div className="space-y-5">
      {/* Bio */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <label className="block text-sm font-medium text-neutral-900 mb-2">
          About Yourself
        </label>
        <textarea
          placeholder="Tell us about yourself, your values, and what makes you unique... (max 500 characters)"
          value={formData.bio}
          onChange={(e) => updateFormData('bio', e.target.value.slice(0, 500))}
          maxLength={500}
          rows={4}
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
        />
        <p className="text-xs text-neutral-500 mt-2">
          {formData.bio?.length || 0}/500 characters
        </p>
      </motion.div>

      {/* Interests */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <label className="block text-sm font-medium text-neutral-900 mb-3">
          Your Interests
        </label>

        {/* Selected interests */}
        {formData.interestTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {formData.interestTags.map((interest, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-2 bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-medium"
              >
                {interest}
                <button
                  onClick={() => removeInterest(interest)}
                  className="hover:text-primary-900 transition-colors"
                >
                  <FiX size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Suggested interests */}
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest, idx) => (
            <motion.button
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + idx * 0.02 }}
              onClick={() => addInterest(interest)}
              disabled={formData.interestTags.includes(interest)}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                formData.interestTags.includes(interest)
                  ? 'bg-primary-100 text-primary-800 opacity-50 cursor-not-allowed'
                  : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
              }`}
            >
              {interest}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-900"
      >
        <p className="font-medium mb-1">✨ Make yourself shine</p>
        <p>A great bio and interests help matches get to know you and find common ground.</p>
      </motion.div>
    </div>
  );
};

export default AboutYourselfStep;
