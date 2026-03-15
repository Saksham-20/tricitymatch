import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import CheckBox from '../../ui/CheckBox';
import { FiCheckCircle, FiPhone, FiMail } from 'react-icons/fi';

const VerificationStep = () => {
  const { formData, updateFormData, errors, setStepErrors } = useOnboarding();
  const [verificationMethod, setVerificationMethod] = useState('email');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);

  const validateStep = () => {
    const newErrors = {};
    if (!formData.emailVerification) {
      newErrors.emailVerification = 'Email verification is required';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return () => validateStep();
  }, []);

  const handleSendCode = () => {
    // Simulate sending code
    console.log(`Sending verification code to ${verificationMethod}`);
    // In real implementation, this would call an API
  };

  const handleVerifyCode = () => {
    // Simulate verifying code
    if (verificationCode.length === 6) {
      setCodeVerified(true);
      if (verificationMethod === 'email') {
        updateFormData('emailVerification', true);
      } else {
        updateFormData('phoneVerification', true);
      }
      setStepErrors({});
    }
  };

  return (
    <div className="space-y-5">
      {/* How to Create Account message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-purple-50 border border-purple-200 rounded-lg p-4"
      >
        <p className="text-sm text-purple-900">
          <span className="font-medium">🔐 Account Security:</span><br />
          We'll send you a verification code to confirm your email and phone number. This keeps your profile secure.
        </p>
      </motion.div>

      {/* Email Verification */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="border border-neutral-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${formData.emailVerification ? 'bg-green-100' : 'bg-neutral-100'}`}>
                <FiMail className={`w-5 h-5 ${formData.emailVerification ? 'text-green-600' : 'text-neutral-600'}`} />
              </div>
              <div>
                <p className="font-medium text-neutral-900">Email Verification</p>
                <p className="text-sm text-neutral-600">{formData.email}</p>
              </div>
            </div>
            {formData.emailVerification && (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-green-600"
              >
                <FiCheckCircle className="w-5 h-5" />
              </motion.div>
            )}
          </div>

          {!formData.emailVerification && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ delay: 0.2 }}
              className="mt-4 space-y-3 pt-4 border-t border-neutral-200"
            >
              <FormField
                label="Verification Code"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                maxLength="6"
              />
              <p className="text-xs text-neutral-600">
                Check your email for the 6-digit verification code
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleSendCode}
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Send Code
                </button>
                <button
                  onClick={handleVerifyCode}
                  disabled={verificationCode.length !== 6}
                  className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Verify
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Phone Verification (Optional) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="border border-neutral-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${formData.phoneVerification ? 'bg-green-100' : 'bg-neutral-100'}`}>
                <FiPhone className={`w-5 h-5 ${formData.phoneVerification ? 'text-green-600' : 'text-neutral-600'}`} />
              </div>
              <div>
                <p className="font-medium text-neutral-900">Phone Verification (Optional)</p>
                <p className="text-sm text-neutral-600">
                  {formData.phoneNumber || 'Add your phone number'}
                </p>
              </div>
            </div>
            {formData.phoneVerification && (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-green-600"
              >
                <FiCheckCircle className="w-5 h-5" />
              </motion.div>
            )}
          </div>

          {!formData.phoneVerification && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ delay: 0.3 }}
              className="mt-4 space-y-3 pt-4 border-t border-neutral-200"
            >
              <FormField
                label="Phone Number"
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phoneNumber}
                onChange={(value) => updateFormData('phoneNumber', value)}
              />
              <button
                onClick={handleSendCode}
                className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                Send OTP
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Trust badges */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900"
      >
        <p className="font-medium mb-2">🛡️ Why we verify:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Protects you from fake profiles</li>
          <li>Ensures community safety</li>
          <li>Verified badge increases match confidence</li>
        </ul>
      </motion.div>
    </div>
  );
};

export default VerificationStep;
