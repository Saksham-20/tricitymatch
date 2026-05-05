import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import { FiCheckCircle, FiPhone, FiMail, FiLoader } from 'react-icons/fi';
import api from '../../../api/axios';

const VerificationStep = () => {
  const { formData, updateFormData, errors, setStepErrors, registerStepValidator } = useOnboarding();
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const formDataRef = React.useRef(formData);
  formDataRef.current = formData;

  const validateStep = () => {
    const newErrors = {};
    if (!formDataRef.current.emailVerification) {
      newErrors.emailVerification = 'Email verification is required';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return registerStepValidator(validateStep);
  }, []);

  const handleSendCode = async (method) => {
    const target = method === 'email' ? formData.email : formData.phoneNumber;
    if (!target) {
      setStepErrors({ [method]: method === 'email' ? 'No email address found' : 'Please enter a phone number first' });
      return;
    }
    if (method === 'email') setEmailSending(true);
    else setPhoneSending(true);

    try {
      await api.post('/auth/send-otp', { type: method, target });
      if (method === 'email') setEmailSent(true);
      else setPhoneSent(true);
      setStepErrors({});
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to send code. Please try again.';
      setStepErrors({ [method]: msg });
    } finally {
      if (method === 'email') setEmailSending(false);
      else setPhoneSending(false);
    }
  };

  const handleVerifyCode = async (method) => {
    const code = method === 'email' ? emailCode : phoneCode;
    if (code.length !== 6) return;
    try {
      const target = method === 'email' ? formData.email : formData.phoneNumber;
      await api.post('/auth/verify-otp', { type: method, target, code });
      if (method === 'email') {
        updateFormData('emailVerification', true);
        setEmailCode('');
      } else {
        updateFormData('phoneVerification', true);
        setPhoneCode('');
      }
      setStepErrors({});
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Invalid code. Please try again.';
      setStepErrors({ [method]: msg });
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

      {errors.emailVerification && (
        <p className="text-sm text-red-600 font-medium">{errors.emailVerification}</p>
      )}

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
              {!emailSent ? (
                <p className="text-xs text-neutral-600">Click "Send Code" to get a 6-digit code at {formData.email}</p>
              ) : (
                <FormField
                  label="Verification Code"
                  placeholder="Enter 6-digit code"
                  value={emailCode}
                  onChange={(value) => setEmailCode(value.replace(/\D/g, '').slice(0, 6))}
                  maxLength="6"
                  autoComplete="one-time-code"
                />
              )}
              {emailSent && (
                <p className="text-xs text-neutral-500">
                  Code sent to {formData.email}.{' '}
                  <button onClick={() => handleSendCode('email')} className="underline text-primary-600">Resend</button>
                </p>
              )}
              <div className="flex gap-2">
                {!emailSent && (
                  <button
                    onClick={() => handleSendCode('email')}
                    disabled={emailSending}
                    className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {emailSending ? 'Sending...' : 'Send Code'}
                  </button>
                )}
                {emailSent && (
                  <button
                    onClick={() => handleVerifyCode('email')}
                    disabled={emailCode.length !== 6}
                    className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Verify
                  </button>
                )}
              </div>
              {errors?.email && (
                <p className="text-sm border-l-2 border-red-500 bg-red-50 text-red-600 p-2 mt-2">{errors.email}</p>
              )}
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
              {phoneSent && (
                <FormField
                  label="Verification Code"
                  placeholder="Enter 6-digit code"
                  value={phoneCode}
                  onChange={(value) => setPhoneCode(value.replace(/\D/g, '').slice(0, 6))}
                  maxLength="6"
                  autoComplete="one-time-code"
                />
              )}
              {phoneSent && (
                <p className="text-xs text-neutral-500">
                  Code sent.{' '}
                  <button onClick={() => handleSendCode('phone')} className="underline text-primary-600">Resend</button>
                </p>
              )}
              <div className="flex gap-2">
                {!phoneSent && (
                  <button
                    onClick={() => handleSendCode('phone')}
                    disabled={phoneSending || !formData.phoneNumber}
                    className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {phoneSending ? 'Sending...' : 'Send OTP'}
                  </button>
                )}
                {phoneSent && (
                  <button
                    onClick={() => handleVerifyCode('phone')}
                    disabled={phoneCode.length !== 6}
                    className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Verify
                  </button>
                )}
              </div>
              {errors?.phone && (
                <p className="text-sm border-l-2 border-red-500 bg-red-50 text-red-600 p-2 mt-2">{errors.phone}</p>
              )}
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
