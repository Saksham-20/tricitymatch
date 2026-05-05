import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import { validateEmail, validatePassword } from '../../../utils/validators';
import { FiEye, FiEyeOff, FiUser, FiUsers, FiHeart } from 'react-icons/fi';

const CreateAccountStep = () => {
  const { formData, updateFormData, errors, setStepErrors, setFieldTouched, registerStepValidator } = useOnboarding();
  const [showPassword, setShowPassword] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  useEffect(() => {
    if (formData.referralCode) setShowReferralInput(true);
  }, []);

  const creatingForOptions = [
    { value: 'self', label: 'For Me', icon: FiUser, description: 'I am creating my own profile' },
    { value: 'other', label: 'For Someone Else', icon: FiUsers, description: 'I am creating a profile for another person' },
  ];

  const relationshipOptions = [
    { value: 'parent', label: 'Parent (Mother/Father)' },
    { value: 'sibling', label: 'Sibling (Brother/Sister)' },
    { value: 'child', label: 'Child (Son/Daughter)' },
    { value: 'relative', label: 'Other Relative' },
    { value: 'friend', label: 'Friend' },
    { value: 'other', label: 'Other' },
  ];

  const validateStep = () => {
    const data = formDataRef.current;
    const newErrors = {};

    if (!data.creatingFor) {
      newErrors.creatingFor = 'Please select who this profile is for';
    }

    if (!data.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(data.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!data.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(data.password)) {
      newErrors.password = 'Min 8 chars (uppercase, lowercase, number, symbol)';
    }

    // Additional validation for "other" relationship option
    if (data.creatingFor !== 'self') {
      if (!data.relationshipToProfile) {
        newErrors.relationshipToProfile = 'Please select your relationship';
      }

      if (!data.yourName || data.yourName.trim().length < 2) {
        newErrors.yourName = 'Name is required (at least 2 characters)';
      }

      if (!data.yourPhone || data.yourPhone.trim().length < 10) {
        newErrors.yourPhone = 'Valid phone number is required';
      }
    }

    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return registerStepValidator(validateStep);
  }, []);

  return (
    <div className="space-y-6">
      {/* Profile Creation Type Selection */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <label className="block text-sm font-semibold text-neutral-900">
          Is this profile for you or someone else?
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {creatingForOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = formData.creatingFor === option.value;

            return (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => updateFormData('creatingFor', option.value)}
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
                  <p className="font-semibold text-neutral-900 text-sm">{option.label}</p>
                  <p className="text-xs text-neutral-600">{option.description}</p>
                </div>
                {isSelected && (
                  <div className="text-primary-600 text-lg">✓</div>
                )}
              </motion.button>
            );
          })}
        </div>

        {errors.creatingFor && (
          <p className="text-sm text-red-600">{errors.creatingFor}</p>
        )}
      </motion.div>

      {/* Creator Details - Only show when creating for someone else */}
      {formData.creatingFor !== 'self' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <div className="pb-2 border-b border-neutral-200">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">Your details — profile creator</p>
            <p className="text-xs text-neutral-500">This is YOUR information as the person setting up this account.</p>
          </div>

          <FormField
            label="Your Full Name"
            placeholder="Enter your own name"
            value={formData.yourName || ''}
            onChange={(value) => updateFormData('yourName', value)}
            onBlur={() => setFieldTouched('yourName')}
            error={errors.yourName}
            required
          />

          <FormField
            label="Your Phone Number"
            type="tel"
            placeholder="Your 10-digit phone number"
            value={formData.yourPhone || ''}
            onChange={(value) => updateFormData('yourPhone', value)}
            onBlur={() => setFieldTouched('yourPhone')}
            error={errors.yourPhone}
            required
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-900">
              Your Relationship to the Person Whose Profile This Is *
            </label>
            <select
              value={formData.relationshipToProfile || ''}
              onChange={(e) => updateFormData('relationshipToProfile', e.target.value)}
              onBlur={() => setFieldTouched('relationshipToProfile')}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            >
              <option value="">Select your relationship to them...</option>
              {relationshipOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.relationshipToProfile && (
              <p className="text-sm text-red-600">{errors.relationshipToProfile}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Account Credentials */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: formData.creatingFor !== 'self' ? 0.2 : 0.15 }}
        className="space-y-4"
      >
        {formData.creatingFor !== 'self' ? (
          <div className="pb-2 border-b border-neutral-200">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">Profile owner's login details</p>
            <p className="text-xs text-neutral-500">The email and password they'll use to sign in.</p>
          </div>
        ) : (
          <h3 className="font-semibold text-neutral-900 text-sm">Account Information</h3>
        )}

        <FormField
          label={formData.creatingFor !== 'self' ? "Profile Owner's Email" : "Email"}
          type="email"
          placeholder={formData.creatingFor !== 'self' ? "Their email address" : "email@example.com"}
          value={formData.email}
          onChange={(value) => updateFormData('email', value)}
          onBlur={() => setFieldTouched('email')}
          error={errors.email}
          required
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-900">
            {formData.creatingFor !== 'self' ? "Profile Owner's Password *" : "Password *"}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => updateFormData('password', e.target.value)}
              onBlur={() => setFieldTouched('password')}
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
            >
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
        </div>

        <div className="space-y-1">
          {!showReferralInput ? (
            <button
              type="button"
              onClick={() => setShowReferralInput(true)}
              className="text-xs text-neutral-400 hover:text-primary-600 transition-colors underline underline-offset-2"
            >
              Have a referral code?
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              className="space-y-1"
            >
              <input
                type="text"
                placeholder="Enter referral code"
                value={formData.referralCode || ''}
                onChange={(e) => updateFormData('referralCode', e.target.value.toUpperCase())}
                autoFocus
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase tracking-wider text-sm"
              />
              {formData.referralCode && (
                <p className="text-xs text-green-600">✓ Referral code applied</p>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CreateAccountStep;
