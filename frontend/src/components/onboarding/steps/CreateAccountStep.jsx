import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import CheckBox from '../../ui/CheckBox';
import OtpBoxes from '../../ui/OtpBoxes';
import SmartContactField, { detectContactType, phoneDigits } from '../SmartContactField';
import { validateEmail, validatePassword, identifierError } from '../../../utils/validators';
import PasswordRequirements from '../../common/PasswordRequirements';
import ReferralCodeField from '../ReferralCodeField';
import { ConsentNotice, TermsCheckbox, MarketingCheckbox } from '../../auth/SignupConsent';
import GoogleSignIn from '../../auth/GoogleSignIn';
import { google as googleConfig } from '../../../config';
import api from '../../../api/axios';
import { FiEye, FiEyeOff, FiUser, FiUsers, FiCheck, FiCheckCircle, FiEdit2, FiShield } from 'react-icons/fi';
import { staggerContainer, fadeRise, fade } from '../../../utils/animations';

const RESEND_COOLDOWN = 60;

const CreateAccountStep = () => {
  const { formData, updateFormData, errors, setStepErrors, setFieldTouched, registerStepValidator, mode, clearDraft } = useOnboarding();
  const isGuardian = mode === 'create_for_other';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  // Google signup lands on the same "finish your basics" page as a Google
  // sign-in from the login page; an existing member just goes in.
  const onGoogleSuccess = (user, isNewUser) => {
    clearDraft?.();
    if (user?.role === 'user' && (isNewUser || user.onboardingComplete === false)) navigate('/welcome', { replace: true });
    else navigate('/dashboard', { replace: true });
  };

  const [showPassword, setShowPassword] = useState(false);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // ── Combined verify state (self-signup only) ───────────────────────────────
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // A user retrying "Send code" after they already have an account (e.g. they
  // signed up successfully on a prior attempt but bounced back to this step)
  // was seeing only the plain 409 error text with no way out — they'd keep
  // hammering Send/Resend instead of logging in. Surface a direct link.
  const [accountExists, setAccountExists] = useState(false);

  const idType = detectContactType(formData.identifier);
  const verified = idType === 'email' ? !!formData.emailVerification
    : idType === 'phone' ? !!formData.phoneVerification : false;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const relationshipOptions = [
    { value: 'parent', label: t('signup.rel.parent') },
    { value: 'sibling', label: t('signup.rel.sibling') },
    { value: 'child', label: t('signup.rel.child') },
    { value: 'relative', label: t('signup.rel.relative') },
    { value: 'friend', label: t('signup.rel.friend') },
    { value: 'other', label: t('signup.rel.other') },
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
    setAccountExists(false);
  };

  const idTarget = () => (idType === 'email' ? formData.email : phoneDigits(formData.identifier));
  const idValid = () => (idType === 'email' ? validateEmail(formData.email) : /^[6-9]\d{9}$/.test(idTarget()));

  const sendOtp = async () => {
    // Send only needs a valid contact — password/terms are gated at "Next" so a
    // user can confirm their email/phone without a confusing credential error
    // on the OTP button.
    if (!idType || !idValid()) { setStepErrors({ identifier: identifierError() }); return; }
    if (cooldown > 0) return;

    setOtpSending(true);
    setAccountExists(false);
    try {
      await api.post('/auth/send-otp', { type: idType, target: idTarget() });
      setOtpSent(true);
      setCooldown(RESEND_COOLDOWN);
      setStepErrors({});
    } catch (err) {
      setAccountExists(err.response?.data?.error?.code === 'CONFLICT');
      setStepErrors({ identifier: err.response?.data?.error?.message || t('auth.sendCodeFailed') });
    } finally {
      setOtpSending(false);
    }
  };

  // Auto-fires from OtpBoxes onComplete — no manual "Verify" click needed.
  const verifyOtp = async (code) => {
    setOtpVerifying(true);
    try {
      const { data: verified } = await api.post('/auth/verify-otp', { type: idType, target: idTarget(), code });
      updateFormData(idType === 'email' ? 'emailProof' : 'phoneProof', verified?.verificationProof || '');
      updateFormData(idType === 'email' ? 'emailVerification' : 'phoneVerification', true);
      setOtpCode('');
      setStepErrors({});
    } catch (err) {
      setOtpCode('');
      setStepErrors({ otp: err.response?.data?.error?.message || t('signup.invalidCode') });
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
      if (!data.creatingFor) newErrors.creatingFor = t('signup.errWhoFor');
      const phone = (data.phone || '').replace(/[\s-]/g, '');
      const hasEmail = !!data.email;
      if (!hasEmail && !phone) newErrors.email = t('signup.errEmailOrPhone');
      else {
        if (hasEmail && !validateEmail(data.email)) newErrors.email = t('validation.invalidEmail');
        if (phone && !/^[6-9]\d{9}$/.test(phone)) newErrors.phone = t('validation.validIndianMobile');
      }
      if (!data.password) newErrors.password = t('validation.passwordRequired');
      else if (!validatePassword(data.password)) newErrors.password = t('validation.passwordShortRule');
      if (data.creatingFor !== 'self') {
        if (!data.relationshipToProfile) newErrors.relationshipToProfile = t('signup.errRelationship');
        if (!data.yourName || data.yourName.trim().length < 2) newErrors.yourName = t('signup.errYourName');
        if (!data.yourPhone || data.yourPhone.trim().length < 10) newErrors.yourPhone = t('signup.errYourPhone');
        // Your email is optional, but if given it must be valid AND differ from
        // the profile owner's email (you can't be your own guardian).
        if (data.yourEmail) {
          if (!validateEmail(data.yourEmail)) newErrors.yourEmail = t('validation.enterValidEmail');
          else if (hasEmail && data.yourEmail.trim().toLowerCase() === data.email.trim().toLowerCase()) {
            newErrors.yourEmail = t('signup.errDifferentEmail');
          }
        }
      }
      if (!data.account_agree) newErrors.account_agree = t('validation.agreeTerms');
      if (data.creatingFor !== 'self' && !data.account_attest) newErrors.account_attest = t('signup.errAttest');
      setStepErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    // Self-signup: single identifier must be entered, valid, AND verified.
    // Password and Terms live behind verification (Phase B of the two-phase
    // screen below) — validating them while they aren't even rendered yet
    // would surface an error for a field the member can't see or fix.
    const type = detectContactType(data.identifier);
    if (!type || !(type === 'email' ? validateEmail(data.email) : /^[6-9]\d{9}$/.test(phoneDigits(data.identifier)))) {
      newErrors.identifier = identifierError();
    }
    const isVerified = type === 'email' ? !!data.emailVerification : type === 'phone' ? !!data.phoneVerification : false;
    if (isVerified) {
      if (!data.password) newErrors.password = t('validation.passwordRequired');
      else if (!validatePassword(data.password)) newErrors.password = t('validation.passwordShortRule');
      if (!data.account_agree) newErrors.account_agree = t('validation.agreeTerms');
    } else if (!newErrors.identifier) {
      newErrors.verify = type === 'phone' ? t('signup.verifyPhoneToContinue') : t('signup.verifyEmailToContinue');
    }

    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => registerStepValidator(validateStep), []);

  // ── Self-signup combined UI ─────────────────────────────────────────────────
  // Two phases driven entirely by `verified` (derived above from the existing
  // emailVerification/phoneVerification flags — no separate phase state).
  // Phase A: identifier + verify panel only, nothing else. Phase B (post-OTP):
  // the verified confirmation, then password/referral/notice/terms. Matches the
  // Shaadi/Jeevansathi/BharatMatrimony pattern of a single-field opening screen.
  if (!isGuardian) {
    const codeLen = idType === 'phone' ? 4 : 6;
    return (
      <div className="space-y-5">
        {!verified && (
          <>
            <SmartContactField
              value={formData.identifier}
              onChange={onIdentifierChange}
              onBlur={() => {
                setFieldTouched('identifier');
                // Validate format only here — the full validateStep() also flags
                // "not yet verified", which would be a false alarm the instant the
                // member tabs off a freshly-typed, not-yet-submitted contact field.
                // Skip entirely on an untouched, still-empty field.
                if (formData.identifier?.trim() && (!idType || !idValid())) {
                  setStepErrors({ ...errors, identifier: identifierError() });
                }
              }}
              error={errors.identifier}
              disabled={verified}
              autoFocus
            />
            {accountExists && (
              <Link to="/login" className="inline-block text-sm font-semibold text-primary-600 underline">
                {t('signup.loginInstead')}
              </Link>
            )}

            {/* Verify panel — Send OTP / OTP entry. The only primary-emphasis
                action on this phase of the screen. */}
            <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 p-4 sm:p-5">
              {!otpSent ? (
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 flex-shrink-0"><FiShield className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t('signup.verifyTitle')}</p>
                    <p className="text-xs text-neutral-500 mt-0.5 mb-3">{t('signup.verifyBody')}</p>
                    {/* Shared .btn-primary (index.css) carries the funnel's one primary-CTA
                        look plus real press feedback (:active scale(0.97) @120ms) — the ad-hoc
                        bg-primary-600/hover classes this replaced had neither. */}
                    <button type="button" onClick={sendOtp} disabled={otpSending} className="btn-primary text-sm">
                      {otpSending ? t('auth.sending') : t('signup.sendOtp')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t('signup.enterCode', { count: codeLen })}</p>
                  <p className="text-xs text-neutral-500 -mt-1.5"><Trans i18nKey="signup.sentTo" values={{ target: idType === 'phone' ? `+91 ${idTarget()}` : formData.email }} components={{ target: <span className="font-medium text-neutral-700 dark:text-neutral-300" /> }} /></p>
                  <OtpBoxes length={codeLen} value={otpCode} onChange={setOtpCode} onComplete={verifyOtp} error={!!errors.otp} disabled={otpVerifying} autoFocus />
                  {/* Verification fires on the last digit — no button to hunt for. */}
                  <div className="flex items-center gap-3 min-h-[20px]">
                    {otpVerifying ? (
                      <span className="flex items-center gap-2 text-xs font-medium text-primary-600">
                        <span className="w-3.5 h-3.5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                        {t('signup.verifying')}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">{cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : <button type="button" onClick={sendOtp} className="underline text-primary-600">{t('auth.resendCode')}</button>}</span>
                    )}
                  </div>
                  {errors.otp && <p className="text-sm text-destructive dark:text-red-300 bg-red-50 dark:bg-red-950/30 border-l-2 border-red-400 dark:border-red-500 p-2 rounded">{errors.otp}</p>}
                </div>
              )}
            </div>

            {errors.verify && <p className="text-sm text-destructive dark:text-red-300 font-medium">{errors.verify}</p>}

            {googleConfig.isConfigured && !otpSent && (
              <>
                <div className="relative" aria-hidden="true">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200 dark:border-neutral-700" /></div>
                  <div className="relative flex justify-center text-sm"><span className="px-3 bg-white dark:bg-surface-dark-3 text-neutral-500 dark:text-neutral-400">{t('signup.or')}</span></div>
                </div>
                <GoogleSignIn
                  text="signup_with"
                  referralCode={formData.referralCode}
                  invite={searchParams.get('invite')}
                  onSuccess={onGoogleSuccess}
                />
              </>
            )}
          </>
        )}

        {verified && (
          <>
            {/* Verified confirmation */}
            <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 p-4 sm:p-5">
              <motion.div initial="initial" animate="animate" variants={fade} className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0"><FiCheckCircle className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">{idType === 'phone' ? t('signup.phoneVerified') : t('signup.emailVerified')}</p>
                  <p className="text-xs text-neutral-500 truncate">{idType === 'phone' ? `+91 ${idTarget()}` : formData.email}</p>
                </div>
                {/* py-3.5/-my-3.5 pads the tap target to the doctrine's 44px floor
                    without growing the visible mark (§3.5). */}
                <button type="button" onClick={() => { updateFormData(idType === 'email' ? 'emailVerification' : 'phoneVerification', false); setOtpSent(false); setOtpCode(''); }} className="flex items-center gap-1 py-3.5 -my-3.5 text-xs font-medium text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 flex-shrink-0">
                  <FiEdit2 className="w-3.5 h-3.5" /> {t('auth.change')}
                </button>
              </motion.div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {t('auth.password')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('signup.createPasswordPlaceholder')}
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  onBlur={() => {
                    setFieldTouched('password');
                    if (formData.password && !validatePassword(formData.password)) {
                      setStepErrors({ ...errors, password: t('validation.passwordShortRule') });
                    }
                  }}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'signup-password-error' : (formData.password ? undefined : 'signup-password-hint')}
                  className="w-full px-4 py-3 pr-11 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                />
                <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && <p id="signup-password-error" className="text-sm text-destructive dark:text-red-300">{errors.password}</p>}
              {formData.password ? (
                <PasswordRequirements password={formData.password} />
              ) : !errors.password && (
                <p id="signup-password-hint" className="text-xs text-neutral-400">{t('validation.passwordHintLong')}</p>
              )}
            </div>

            {/* Referral — checked live, never blocks signup */}
            <ReferralCodeField
              value={formData.referralCode}
              onChange={(v) => updateFormData('referralCode', v)}
            />

            {/* DPDP notice + Terms (required) + promotional email (optional).
                Shared with Google signup so both record the same consent. */}
            <ConsentNotice />
            <TermsCheckbox
              checked={formData.account_agree}
              onChange={(checked) => updateFormData('account_agree', checked)}
              error={errors.account_agree}
            />
            <MarketingCheckbox
              checked={formData.account_marketing}
              onChange={(checked) => updateFormData('account_marketing', checked)}
            />
          </>
        )}
      </div>
    );
  }

  // ── Guardian (create-for-other) legacy form — verification is a later step ──
  return (
    <motion.div className="space-y-6" initial="initial" animate="animate" variants={staggerContainer}>
      <motion.div variants={fadeRise} className="space-y-3">
        <label className="block text-sm font-semibold text-neutral-900">{t('signup.whoFor')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { value: 'self', label: t('signup.forMe'), icon: FiUser, description: t('signup.forMeDesc') },
            { value: 'other', label: t('signup.forOther'), icon: FiUsers, description: t('signup.forOtherDesc') },
          ].map((option) => {
            const Icon = option.icon;
            const isSelected = formData.creatingFor === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => updateFormData('creatingFor', option.value)}
                className={`p-4 text-left rounded-lg border-2 transition-colors duration-[160ms] active:scale-[0.98] flex items-start gap-3 ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-300'}`}
              >
                <div className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-primary-100 text-primary-600' : 'bg-neutral-100 text-neutral-600'}`}><Icon size={20} /></div>
                <div className="flex-1">
                  <p className="font-semibold text-neutral-900 text-sm">{option.label}</p>
                  <p className="text-xs text-neutral-600">{option.description}</p>
                </div>
                {isSelected && <FiCheck className="w-5 h-5 text-primary-600" />}
              </button>
            );
          })}
        </div>
        {errors.creatingFor && <p className="text-sm text-red-600">{errors.creatingFor}</p>}
      </motion.div>

      {formData.creatingFor !== 'self' && (
        <motion.div initial="initial" animate="animate" variants={fadeRise} className="space-y-4">
          <div className="pb-2 border-b border-neutral-200">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">{t('signup.creatorHeading')}</p>
            <p className="text-xs text-neutral-500">{t('signup.creatorBody')}</p>
          </div>
          <FormField label={t('signup.yourName')} name="yourName" autoComplete="name" placeholder={t('signup.yourNamePlaceholder')} value={formData.yourName || ''} onChange={(v) => updateFormData('yourName', v)} onBlur={() => { setFieldTouched('yourName'); validateStep(); }} error={errors.yourName} required />
          <FormField label={t('signup.yourPhone')} type="tel" name="yourPhone" autoComplete="tel" inputMode="numeric" placeholder={t('signup.yourPhonePlaceholder')} value={formData.yourPhone || ''} onChange={(v) => updateFormData('yourPhone', v)} onBlur={() => { setFieldTouched('yourPhone'); validateStep(); }} error={errors.yourPhone} required />
          {/* Guardian's own email — when given, we link them as a read-only
              guardian of this profile so they can keep an eye on it later. */}
          <FormField label={t('signup.yourEmail')} type="email" name="yourEmail" autoComplete="email" inputMode="email" placeholder="your.email@example.com" value={formData.yourEmail || ''} onChange={(v) => updateFormData('yourEmail', v)} onBlur={() => { setFieldTouched('yourEmail'); validateStep(); }} error={errors.yourEmail} hint={t('signup.yourEmailHint')} optional />
          <div className="space-y-2">
            <label htmlFor="onboarding-relationship" className="block text-sm font-medium text-neutral-900">{t('signup.relationshipLabel')}</label>
            <select id="onboarding-relationship" name="relationshipToProfile" value={formData.relationshipToProfile || ''} onChange={(e) => { updateFormData('relationshipToProfile', e.target.value); setTimeout(validateStep, 0); }} onBlur={() => setFieldTouched('relationshipToProfile')}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-[160ms]">
              <option value="">{t('signup.relationshipPlaceholder')}</option>
              {relationshipOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {errors.relationshipToProfile && <p className="text-sm text-red-600">{errors.relationshipToProfile}</p>}
          </div>
        </motion.div>
      )}

      <motion.div initial="initial" animate="animate" variants={fadeRise} className="space-y-4">
        {formData.creatingFor !== 'self' ? (
          <div className="pb-2 border-b border-neutral-200">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">{t('signup.ownerLoginHeading')}</p>
            <p className="text-xs text-neutral-500">{t('signup.ownerLoginBody')}</p>
          </div>
        ) : (
          <h3 className="font-semibold text-neutral-900 text-sm">{t('signup.accountInfo')}</h3>
        )}
        <p className="text-xs text-neutral-500 -mb-1">{t('signup.mobileRequiredNote')}</p>
        <FormField label={formData.creatingFor !== 'self' ? t('signup.ownerEmail') : t('auth.email')} type="email" name="email" autoComplete="email" inputMode="email" placeholder={formData.creatingFor !== 'self' ? t('signup.ownerEmailPlaceholder') : 'email@example.com'} value={formData.email} onChange={(v) => updateFormData('email', v)} onBlur={() => { setFieldTouched('email'); validateStep(); }} error={errors.email} />
        <FormField label={formData.creatingFor !== 'self' ? t('signup.ownerPhone') : t('signup.phone')} type="tel" name="phone" autoComplete="tel" inputMode="numeric" placeholder={t('signup.phonePlaceholder')} value={formData.phone || ''} onChange={(v) => updateFormData('phone', v)} onBlur={() => { setFieldTouched('phone'); validateStep(); }} error={errors.phone} />
        <div className="space-y-2">
          <label htmlFor="onboarding-password" className="block text-sm font-medium text-neutral-900">{formData.creatingFor !== 'self' ? t('signup.ownerPassword') : t('signup.passwordStar')}</label>
          <div className="relative">
            <input id="onboarding-password" name="password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} placeholder={t('signup.createPasswordPlaceholder')} value={formData.password} onChange={(e) => updateFormData('password', e.target.value)} onBlur={() => { setFieldTouched('password'); validateStep(); }}
              aria-invalid={errors.password ? true : undefined} aria-describedby="guardian-password-hint"
              className="w-full px-4 py-2.5 pr-11 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">{showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}</button>
          </div>
          {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
          {formData.password ? <PasswordRequirements password={formData.password} /> : !errors.password && <p id="guardian-password-hint" className="text-xs text-neutral-500 mt-1">{t('validation.passwordHintLong')}</p>}
        </div>
        <ReferralCodeField
          id="guardian-referral-code"
          value={formData.referralCode}
          onChange={(v) => updateFormData('referralCode', v)}
        />
        <div className="pt-2">
          <CheckBox checked={!!formData.account_agree} onChange={(checked) => updateFormData('account_agree', checked)} size="md"
            label={<span className="text-sm text-neutral-600"><Trans i18nKey="signup.termsAgree" components={{ terms: <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700" />, privacy: <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700" /> }} /></span>} />
          {errors.account_agree && <p className="text-sm text-red-600 mt-1.5">{errors.account_agree}</p>}
        </div>
        {formData.creatingFor !== 'self' && (
          <div>
            <CheckBox checked={!!formData.account_attest} onChange={(checked) => updateFormData('account_attest', checked)} size="md"
              label={<span className="text-sm text-neutral-600">{t('signup.attest')}</span>} />
            {errors.account_attest && <p className="text-sm text-red-600 mt-1.5">{errors.account_attest}</p>}
          </div>
        )}
        <CheckBox checked={!!formData.account_marketing} onChange={(checked) => updateFormData('account_marketing', checked)} size="md"
          label={<span className="text-sm text-neutral-600">{t('signup.guardianMarketingOptIn')}</span>} />
      </motion.div>
    </motion.div>
  );
};

export default CreateAccountStep;
