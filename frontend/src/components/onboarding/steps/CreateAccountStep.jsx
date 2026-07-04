import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import CheckBox from '../../ui/CheckBox';
import OtpBoxes from '../../ui/OtpBoxes';
import SmartContactField, { detectContactType, phoneDigits } from '../SmartContactField';
import { validateEmail, validatePassword } from '../../../utils/validators';
import PasswordRequirements from '../../common/PasswordRequirements';
import api from '../../../api/axios';
import { FiEye, FiEyeOff, FiUser, FiUsers, FiCheck, FiCheckCircle, FiEdit2, FiShield } from 'react-icons/fi';

const RESEND_COOLDOWN = 60;

const CreateAccountStep = () => {
  const { formData, updateFormData, errors, setStepErrors, setFieldTouched, registerStepValidator, mode } = useOnboarding();
  const isGuardian = mode === 'create_for_other';

  const [showPassword, setShowPassword] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // ── Combined verify state (self-signup only) ───────────────────────────────
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const idType = detectContactType(formData.identifier);
  const verified = idType === 'email' ? !!formData.emailVerification
    : idType === 'phone' ? !!formData.phoneVerification : false;

  useEffect(() => {
    if (formData.referralCode) setShowReferralInput(true);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const relationshipOptions = [
    { value: 'parent', label: 'Parent (Mother/Father)' },
    { value: 'sibling', label: 'Sibling (Brother/Sister)' },
    { value: 'child', label: 'Child (Son/Daughter)' },
    { value: 'relative', label: 'Other Relative' },
    { value: 'friend', label: 'Friend' },
    { value: 'other', label: 'Other' },
  ];

  // Writing the single identifier fans out into the canonical email / phone
  // fields the backend understands, and invalidates any prior verification so a
  // late edit can never submit with a stale "verified" flag.
  const onIdentifierChange = (raw) => {
    updateFormData('identifier', raw);
    const type = detectContactType(raw);
    if (type === 'email') {
      updateFormData('email', raw.trim().toLowerCase());
      if (formData.phone) updateFormData('phone', '');
      if (formData.phoneVerification) updateFormData('phoneVerification', false);
    } else if (type === 'phone') {
      updateFormData('phone', phoneDigits(raw));
      if (formData.email) updateFormData('email', '');
      if (formData.emailVerification) updateFormData('emailVerification', false);
    }
    // Editing the contact resets the OTP exchange.
    if (otpSent) { setOtpSent(false); setOtpCode(''); setCooldown(0); }
  };

  const idTarget = () => (idType === 'email' ? formData.email : phoneDigits(formData.identifier));
  const idValid = () => (idType === 'email' ? validateEmail(formData.email) : /^[6-9]\d{9}$/.test(idTarget()));

  const sendOtp = async () => {
    // Send only needs a valid contact — password/terms are gated at "Next" so a
    // user can confirm their email/phone without a confusing credential error
    // on the OTP button.
    if (!idType || !idValid()) { setStepErrors({ identifier: 'Enter a valid email or 10-digit mobile number' }); return; }
    if (cooldown > 0) return;

    setOtpSending(true);
    try {
      await api.post('/auth/send-otp', { type: idType, target: idTarget() });
      setOtpSent(true);
      setCooldown(RESEND_COOLDOWN);
      setStepErrors({});
    } catch (err) {
      setStepErrors({ identifier: err.response?.data?.error?.message || 'Could not send the code. Try again.' });
    } finally {
      setOtpSending(false);
    }
  };

  // Auto-fires from OtpBoxes onComplete — no manual "Verify" click needed.
  const verifyOtp = async (code) => {
    setOtpVerifying(true);
    try {
      await api.post('/auth/verify-otp', { type: idType, target: idTarget(), code });
      updateFormData(idType === 'email' ? 'emailVerification' : 'phoneVerification', true);
      setOtpCode('');
      setStepErrors({});
    } catch (err) {
      setOtpCode('');
      setStepErrors({ otp: err.response?.data?.error?.message || 'Invalid code. Try again.' });
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep = () => {
    const data = formDataRef.current;
    const newErrors = {};

    if (isGuardian) {
      // Guardian path keeps the legacy multi-field form; verification is its own step.
      if (!data.creatingFor) newErrors.creatingFor = 'Please select who this profile is for';
      const phone = (data.phone || '').replace(/[\s-]/g, '');
      const hasEmail = !!data.email;
      if (!hasEmail && !phone) newErrors.email = 'Enter an email or phone number';
      else {
        if (hasEmail && !validateEmail(data.email)) newErrors.email = 'Invalid email address';
        if (phone && !/^[6-9]\d{9}$/.test(phone)) newErrors.phone = 'Enter a valid 10-digit Indian mobile number';
      }
      if (!data.password) newErrors.password = 'Password is required';
      else if (!validatePassword(data.password)) newErrors.password = 'Min 8 chars (uppercase, lowercase, number, symbol)';
      if (data.creatingFor !== 'self') {
        if (!data.relationshipToProfile) newErrors.relationshipToProfile = 'Please select your relationship';
        if (!data.yourName || data.yourName.trim().length < 2) newErrors.yourName = 'Name is required (at least 2 characters)';
        if (!data.yourPhone || data.yourPhone.trim().length < 10) newErrors.yourPhone = 'Valid phone number is required';
      }
      if (!data.account_agree) newErrors.account_agree = 'Please agree to the Terms & Privacy Policy to continue';
      setStepErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    // Self-signup: single identifier must be entered, valid, AND verified.
    const type = detectContactType(data.identifier);
    if (!type || !(type === 'email' ? validateEmail(data.email) : /^[6-9]\d{9}$/.test(phoneDigits(data.identifier)))) {
      newErrors.identifier = 'Enter a valid email or 10-digit mobile number';
    }
    if (!data.password) newErrors.password = 'Password is required';
    else if (!validatePassword(data.password)) newErrors.password = 'Min 8 chars (uppercase, lowercase, number, symbol)';
    if (!data.account_agree) newErrors.account_agree = 'Please agree to the Terms & Privacy Policy to continue';
    const isVerified = type === 'email' ? data.emailVerification : type === 'phone' ? data.phoneVerification : false;
    if (!isVerified && !newErrors.identifier) newErrors.verify = `Verify your ${type === 'phone' ? 'mobile number' : 'email'} to continue`;

    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => registerStepValidator(validateStep), []);

  // ── Self-signup combined UI ─────────────────────────────────────────────────
  if (!isGuardian) {
    const codeLen = idType === 'phone' ? 4 : 6;
    return (
      <div className="space-y-5">
        <SmartContactField
          value={formData.identifier}
          onChange={onIdentifierChange}
          onBlur={() => setFieldTouched('identifier')}
          error={errors.identifier}
          disabled={verified}
          autoFocus
        />

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="signup-password" className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="signup-password"
              name="password"
              autoComplete="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => updateFormData('password', e.target.value)}
              onBlur={() => setFieldTouched('password')}
              aria-invalid={errors.password ? true : undefined}
              className="w-full px-4 py-3 pr-11 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
            />
            <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
          {formData.password ? (
            <PasswordRequirements password={formData.password} />
          ) : !errors.password && (
            <p className="text-xs text-neutral-400">At least 8 characters with uppercase, lowercase, a number, and a symbol.</p>
          )}
        </div>

        {/* Referral (collapsed) */}
        <div>
          {!showReferralInput ? (
            <button type="button" onClick={() => setShowReferralInput(true)} className="text-xs text-neutral-400 hover:text-primary-600 underline underline-offset-2">
              Have a referral code?
            </button>
          ) : (
            <input
              type="text"
              placeholder="Enter referral code"
              value={formData.referralCode || ''}
              onChange={(e) => updateFormData('referralCode', e.target.value.toUpperCase())}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 uppercase tracking-wider text-sm"
            />
          )}
        </div>

        {/* Terms */}
        <div>
          <CheckBox
            checked={!!formData.account_agree}
            onChange={(checked) => updateFormData('account_agree', checked)}
            size="md"
            label={
              <span className="text-sm text-neutral-600">
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">Terms &amp; Conditions</a>{' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">Privacy Policy</a>.
              </span>
            }
          />
          {errors.account_agree && <p className="text-sm text-red-600 mt-1.5">{errors.account_agree}</p>}
        </div>

        {/* Verify panel */}
        <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 p-4 sm:p-5">
          {verified ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-100 text-green-600 flex-shrink-0"><FiCheckCircle className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-700">{idType === 'phone' ? 'Mobile number' : 'Email'} verified</p>
                <p className="text-xs text-neutral-500 truncate">{idType === 'phone' ? `+91 ${idTarget()}` : formData.email}</p>
              </div>
              <button type="button" onClick={() => { updateFormData(idType === 'email' ? 'emailVerification' : 'phoneVerification', false); setOtpSent(false); setOtpCode(''); }} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 flex-shrink-0">
                <FiEdit2 className="w-3.5 h-3.5" /> Change
              </button>
            </motion.div>
          ) : !otpSent ? (
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 flex-shrink-0"><FiShield className="w-5 h-5" /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Verify to create your account</p>
                <p className="text-xs text-neutral-500 mt-0.5 mb-3">We’ll send a one-time code to confirm it’s really you. Your account is created only after this.</p>
                <button type="button" onClick={sendOtp} disabled={otpSending} className="px-5 py-2.5 text-sm font-semibold bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  {otpSending ? 'Sending…' : 'Send OTP'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Enter the {codeLen}-digit code</p>
              <p className="text-xs text-neutral-500 -mt-1.5">Sent to <span className="font-medium text-neutral-700 dark:text-neutral-300">{idType === 'phone' ? `+91 ${idTarget()}` : formData.email}</span></p>
              <OtpBoxes length={codeLen} value={otpCode} onChange={setOtpCode} onComplete={verifyOtp} error={!!errors.otp} disabled={otpVerifying} autoFocus />
              {/* Verification fires on the last digit — no button to hunt for. */}
              <div className="flex items-center gap-3 min-h-[20px]">
                {otpVerifying ? (
                  <span className="flex items-center gap-2 text-xs font-medium text-primary-600">
                    <span className="w-3.5 h-3.5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    Verifying…
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500">{cooldown > 0 ? `Resend in ${cooldown}s` : <button type="button" onClick={sendOtp} className="underline text-primary-600">Resend code</button>}</span>
                )}
              </div>
              {errors.otp && <p className="text-sm text-red-600 bg-red-50 border-l-2 border-red-400 p-2 rounded">{errors.otp}</p>}
            </div>
          )}
        </div>

        {errors.verify && <p className="text-sm text-red-600 font-medium">{errors.verify}</p>}
      </div>
    );
  }

  // ── Guardian (create-for-other) legacy form — verification is a later step ──
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
        <label className="block text-sm font-semibold text-neutral-900">Is this profile for you or someone else?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { value: 'self', label: 'For Me', icon: FiUser, description: 'I am creating my own profile' },
            { value: 'other', label: 'For Someone Else', icon: FiUsers, description: 'I am creating a profile for another person' },
          ].map((option) => {
            const Icon = option.icon;
            const isSelected = formData.creatingFor === option.value;
            return (
              <motion.button key={option.value} type="button" onClick={() => updateFormData('creatingFor', option.value)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className={`p-4 text-left rounded-lg border-2 transition-all flex items-start gap-3 ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-300'}`}>
                <div className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-primary-100 text-primary-600' : 'bg-neutral-100 text-neutral-600'}`}><Icon size={20} /></div>
                <div className="flex-1">
                  <p className="font-semibold text-neutral-900 text-sm">{option.label}</p>
                  <p className="text-xs text-neutral-600">{option.description}</p>
                </div>
                {isSelected && <FiCheck className="w-5 h-5 text-primary-600" />}
              </motion.button>
            );
          })}
        </div>
        {errors.creatingFor && <p className="text-sm text-red-600">{errors.creatingFor}</p>}
      </motion.div>

      {formData.creatingFor !== 'self' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
          <div className="pb-2 border-b border-neutral-200">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">Your details — profile creator</p>
            <p className="text-xs text-neutral-500">This is YOUR information as the person setting up this account.</p>
          </div>
          <FormField label="Your Full Name" name="yourName" autoComplete="name" placeholder="Enter your own name" value={formData.yourName || ''} onChange={(v) => updateFormData('yourName', v)} onBlur={() => setFieldTouched('yourName')} error={errors.yourName} required />
          <FormField label="Your Phone Number" type="tel" name="yourPhone" autoComplete="tel" inputMode="numeric" placeholder="Your 10-digit phone number" value={formData.yourPhone || ''} onChange={(v) => updateFormData('yourPhone', v)} onBlur={() => setFieldTouched('yourPhone')} error={errors.yourPhone} required />
          <div className="space-y-2">
            <label htmlFor="onboarding-relationship" className="block text-sm font-medium text-neutral-900">Your Relationship to the Person Whose Profile This Is *</label>
            <select id="onboarding-relationship" name="relationshipToProfile" value={formData.relationshipToProfile || ''} onChange={(e) => updateFormData('relationshipToProfile', e.target.value)} onBlur={() => setFieldTouched('relationshipToProfile')}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all">
              <option value="">Select your relationship to them...</option>
              {relationshipOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {errors.relationshipToProfile && <p className="text-sm text-red-600">{errors.relationshipToProfile}</p>}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: formData.creatingFor !== 'self' ? 0.2 : 0.15 }} className="space-y-4">
        {formData.creatingFor !== 'self' ? (
          <div className="pb-2 border-b border-neutral-200">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">Profile owner's login details</p>
            <p className="text-xs text-neutral-500">The email and password they'll use to sign in.</p>
          </div>
        ) : (
          <h3 className="font-semibold text-neutral-900 text-sm">Account Information</h3>
        )}
        <p className="text-xs text-neutral-500 -mb-1">Sign up with an email, a phone number, or both — at least one is required.</p>
        <FormField label={formData.creatingFor !== 'self' ? "Profile Owner's Email" : 'Email'} type="email" name="email" autoComplete="email" inputMode="email" placeholder={formData.creatingFor !== 'self' ? 'Their email address' : 'email@example.com'} value={formData.email} onChange={(v) => updateFormData('email', v)} onBlur={() => setFieldTouched('email')} error={errors.email} />
        <FormField label={formData.creatingFor !== 'self' ? "Profile Owner's Phone" : 'Phone'} type="tel" name="phone" autoComplete="tel" inputMode="numeric" placeholder="10-digit mobile number" value={formData.phone || ''} onChange={(v) => updateFormData('phone', v)} onBlur={() => setFieldTouched('phone')} error={errors.phone} />
        <div className="space-y-2">
          <label htmlFor="onboarding-password" className="block text-sm font-medium text-neutral-900">{formData.creatingFor !== 'self' ? "Profile Owner's Password *" : 'Password *'}</label>
          <div className="relative">
            <input id="onboarding-password" name="password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={(e) => updateFormData('password', e.target.value)} onBlur={() => setFieldTouched('password')}
              className="w-full px-4 py-2.5 pr-11 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">{showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}</button>
          </div>
          {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
          {formData.password ? <PasswordRequirements password={formData.password} /> : !errors.password && <p className="text-xs text-neutral-500 mt-1">At least 8 characters with uppercase, lowercase, a number, and a symbol.</p>}
        </div>
        <div className="space-y-1">
          {!showReferralInput ? (
            <button type="button" onClick={() => setShowReferralInput(true)} className="text-xs text-neutral-400 hover:text-primary-600 transition-colors underline underline-offset-2">Have a referral code?</button>
          ) : (
            <input type="text" placeholder="Enter referral code" value={formData.referralCode || ''} onChange={(e) => updateFormData('referralCode', e.target.value.toUpperCase())} autoFocus className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase tracking-wider text-sm" />
          )}
        </div>
        <div className="pt-2">
          <CheckBox checked={!!formData.account_agree} onChange={(checked) => updateFormData('account_agree', checked)} size="md"
            label={<span className="text-sm text-neutral-600">I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">Privacy Policy</a>.</span>} />
          {errors.account_agree && <p className="text-sm text-red-600 mt-1.5">{errors.account_agree}</p>}
        </div>
      </motion.div>
    </div>
  );
};

export default CreateAccountStep;
