import React from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import { FiUser, FiUsers, FiHeart } from 'react-icons/fi';

/**
 * CreatingForStep - Select who the profile is being created for
 * Only shown in 'create_for_other' mode when a guardian is creating a profile
 * Allows selection of relationship (parent, sibling, child, etc.)
 */
const CreatingForStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();

  const relationships = [
    { value: 'self', label: 'For Myself', icon: FiUser, description: 'I am creating my own profile' },
    { value: 'parent', label: 'For My Parent', icon: FiHeart, description: 'Creating for mother or father' },
    { value: 'sibling', label: 'For My Sibling', icon: FiUsers, description: 'Creating for brother or sister' },
    { value: 'child', label: 'For My Child', icon: FiHeart, description: 'Creating for son or daughter' },
    { value: 'other', label: 'Other Relative', icon: FiUsers, description: 'Creating for cousin, aunt, uncle, etc.' },
  ];

  const validateStep = () => {
    const newErrors = {};

    if (!formData.creatingFor) {
      newErrors.creatingFor = 'Please select who this profile is for';
    }

    if (!formData.yourName || formData.yourName.trim().length < 2) {
      newErrors.yourName = 'Please enter your name (at least 2 characters)';
    }

    if (!formData.yourPhone || formData.yourPhone.trim().length < 10) {
      newErrors.yourPhone = 'Please enter a valid phone number';
    }

    if (!formData.yourEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.yourEmail)) {
      newErrors.yourEmail = 'Please enter a valid email address';
    }

    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return () => validateStep();
  }, []);

  return (
    <div className="space-y-6">
      {/* Selection Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <label className="block text-sm font-semibold text-neutral-900">
          Who are you creating this profile for?
        </label>

        <div className="grid grid-cols-1 gap-3">
          {relationships.map((rel) => {
            const Icon = rel.icon;
            const isSelected = formData.creatingFor === rel.value;

            return (
              <motion.button
                key={rel.value}
                type="button"
                onClick={() => updateFormData('creatingFor', rel.value)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 text-left rounded-lg border-2 transition-all flex items-start gap-3 ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-neutral-200 bg-white hover:border-primary-300'
                }`}
              >
                <div
                  className={`p-2 rounded-lg mt-0.5 ${
                    isSelected
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-neutral-900">{rel.label}</p>
                  <p className="text-sm text-neutral-600">{rel.description}</p>
                </div>
                {isSelected && (
                  <div className="text-primary-600 text-xl">✓</div>
                )}
              </motion.button>
            );
          })}
        </div>

        {errors.creatingFor && (
          <p className="text-sm text-red-600">{errors.creatingFor}</p>
        )}
      </motion.div>

      {/* Guardian Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-neutral-50 p-5 rounded-lg border border-neutral-200 space-y-4"
      >
        <h3 className="font-semibold text-neutral-900">Your Information</h3>
        <p className="text-sm text-neutral-600">
          As the profile creator, we need your contact details for verification purposes.
        </p>

        <FormField
          label="Your Full Name"
          placeholder="Enter your name"
          value={formData.yourName}
          onChange={(v) => updateFormData('yourName', v)}
          error={errors.yourName}
          onBlur={() => validateStep()}
          required
        />

        <FormField
          label="Your Phone Number"
          type="tel"
          placeholder="10-digit phone number"
          value={formData.yourPhone}
          onChange={(v) => updateFormData('yourPhone', v)}
          error={errors.yourPhone}
          onBlur={() => validateStep()}
          required
        />

        <FormField
          label="Your Email Address"
          type="email"
          placeholder="your.email@example.com"
          value={formData.yourEmail}
          onChange={(v) => updateFormData('yourEmail', v)}
          error={errors.yourEmail}
          onBlur={() => validateStep()}
          required
        />

        {/* Optional relationship note */}
        <FormField
          label="Relationship (Optional)"
          placeholder="e.g., Mother, Elder Sister, etc."
          value={formData.relationshipToProfile}
          onChange={(v) => updateFormData('relationshipToProfile', v)}
          hint="Help us understand your relationship with the person whose profile this is"
        />
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-blue-50 border border-blue-200 rounded-lg p-4"
      >
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> The email and phone you provide will be used for account verification. 
          The person whose profile this is will need to verify these details after account creation.
        </p>
      </motion.div>
    </div>
  );
};

export default CreatingForStep;
