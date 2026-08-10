import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import FormField from '../../ui/FormField';
import OtpBoxes from '../../ui/OtpBoxes';
import { FiCheckCircle, FiPhone, FiMail, FiEdit2, FiShield } from 'react-icons/fi';
import api from '../../../api/axios';
import { validateEmail } from '../../../utils/validators';

const RESEND_COOLDOWN = 60;

/**
 * Final signup step — confirm the contact details ALREADY entered on the account
 * step. We never re-ask for the email or phone: both are pre-filled from
 * `formData.email` / `formData.phone` (the canonical account number). The user
 * just receives a code and enters it; an inline "Change" handles typos.
 */
const VerificationStep = () => {
  const { formData, updateFormData, errors, setStepErrors, registerStepValidator } = useOnboarding();
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Inline editors (fix a typo without leaving the step)
  const [editing, setEditing] = useState(null); // 'email' | 'phone' | null
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');
  // In-flight verify guard — the code auto-verifies on the last digit
  // (OtpBoxes onComplete) AND a manual Verify button exists as a retry, so
  // block a double-submit when both fire. Holds the method being verified.
  const [verifying, setVerifying] = useState(null); // 'email' | 'phone' | null

  const formDataRef = React.useRef(formData);
  formDataRef.current = formData;

  const hasEmail = !!formData.email;
  const hasPhone = !!(formData.phone && String(formData.phone).replace(/\D/g, ''));

  // At least one identifier must be verified. Prefer email when present.
  const primary = hasEmail ? 'email' : 'phone';

  const validateStep = () => {
    const d = formDataRef.current;
    const newErrors = {};
    if (primary === 'email' && !d.emailVerification) {
      newErrors.verify = 'Please verify your email to continue';
    } else if (primary === 'phone' && !d.phoneVerification) {
      newErrors.verify = 'Please verify your phone number to continue';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => registerStepValidator(validateStep), []);

  // Tick whichever cooldown is active, once per second.
  React.useEffect(() => {
    if (emailCooldown <= 0 && phoneCooldown <= 0) return;
    const t = setTimeout(() => {
      setEmailCooldown((c) => (c > 0 ? c - 1 : 0));
      setPhoneCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearTimeout(t);
  }, [emailCooldown, phoneCooldown]);

  const startEdit = (method) => {
    setEditing(method);
    setDraft(method === 'email' ? formData.email || '' : String(formData.phone || ''));
    setDraftError('');
  };

  const saveEdit = () => {
    if (editing === 'email') {
      const next = draft.trim().toLowerCase();
      if (!next || !validateEmail(next)) { setDraftError('Enter a valid email address'); return; }
      updateFormData('email', next);
      updateFormData('emailVerification', false);
      setEmailSent(false); setEmailCode(''); setEmailCooldown(0);
    } else {
      const next = draft.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(next)) { setDraftError('Enter a valid 10-digit mobile number'); return; }
      updateFormData('phone', next);
      updateFormData('phoneVerification', false);
      setPhoneSent(false); setPhoneCode(''); setPhoneCooldown(0);
    }
    setEditing(null);
    setStepErrors({});
  };

  const sendCode = async (method) => {
    const target = method === 'email' ? formData.email : String(formData.phone || '').replace(/\D/g, '');
    if (!target) { setStepErrors({ [method]: `Add a ${method} first` }); return; }
    if (method === 'email' ? emailCooldown > 0 : phoneCooldown > 0) return;
    method === 'email' ? setEmailSending(true) : setPhoneSending(true);
    try {
      await api.post('/auth/send-otp', { type: method, target });
      if (method === 'email') { setEmailSent(true); setEmailCooldown(RESEND_COOLDOWN); }
      else { setPhoneSent(true); setPhoneCooldown(RESEND_COOLDOWN); }
      setStepErrors({});
    } catch (err) {
      setStepErrors({ [method]: err.response?.data?.error?.message || 'Failed to send code. Try again.' });
    } finally {
      method === 'email' ? setEmailSending(false) : setPhoneSending(false);
    }
  };

  const verifyCode = async (method, code) => {
    if (verifying) return; // block double-submit (auto-fire + manual Verify)
    setVerifying(method);
    const target = method === 'email' ? formData.email : String(formData.phone || '').replace(/\D/g, '');
    try {
      await api.post('/auth/verify-otp', { type: method, target, code });
      updateFormData(method === 'email' ? 'emailVerification' : 'phoneVerification', true);
      method === 'email' ? setEmailCode('') : setPhoneCode('');
      setStepErrors({});
    } catch (err) {
      method === 'email' ? setEmailCode('') : setPhoneCode('');
      setStepErrors({ [method]: err.response?.data?.error?.message || 'Invalid code. Try again.' });
    } finally {
      setVerifying(null);
    }
  };

  const renderCard = ({ method, icon: Icon, title, target, verified, optional, codeLen, code, setCode, sent, sending, cooldown }) => (
    <div className={`border-2 rounded-2xl p-5 transition-colors ${verified ? 'border-green-200 bg-green-50/40 dark:bg-green-900/10' : 'border-neutral-200 dark:border-neutral-700'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${verified ? 'bg-green-100 text-green-600' : 'bg-primary-50 text-primary-600 dark:bg-primary-900/30'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
              {title}{optional && <span className="ml-1.5 text-[11px] font-normal text-neutral-400">Optional</span>}
            </p>
            <p className="text-sm text-neutral-500 truncate">{target || `Add a ${method}`}</p>
          </div>
        </div>
        {verified ? (
          <motion.span initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-xs font-semibold text-green-600 flex-shrink-0">
            <FiCheckCircle className="w-4 h-4" /> Verified
          </motion.span>
        ) : (
          editing !== method && target && (
            <button type="button" onClick={() => startEdit(method)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 flex-shrink-0">
              <FiEdit2 className="w-3.5 h-3.5" /> Change
            </button>
          )
        )}
      </div>

      {/* Inline editor */}
      {editing === method && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-3">
          <FormField
            label={method === 'email' ? 'Update email' : 'Update phone'}
            type={method === 'email' ? 'email' : 'tel'}
            inputMode={method === 'email' ? 'email' : 'numeric'}
            value={draft}
            onChange={(v) => { setDraft(v); setDraftError(''); }}
            error={draftError}
            placeholder={method === 'email' ? 'email@example.com' : '10-digit mobile number'}
          />
          <div className="flex gap-2">
            <button type="button" onClick={saveEdit} className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Verify flow */}
      {!verified && editing !== method && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-3">
          {!sent ? (
            <button
              type="button"
              onClick={() => sendCode(method)}
              disabled={sending || !target}
              className="px-4 py-2.5 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {sending ? 'Sending…' : `Send code${target ? ` to ${method === 'email' ? 'email' : 'phone'}` : ''}`}
            </button>
          ) : (
            <>
              <p className="text-xs text-neutral-500">Enter the {codeLen}-digit code sent to <span className="font-medium text-neutral-700 dark:text-neutral-300">{target}</span></p>
              <OtpBoxes
                length={codeLen}
                value={code}
                onChange={setCode}
                onComplete={(c) => verifyCode(method, c)}
                error={!!errors?.[method]}
                disabled={verifying === method}
                autoFocus
              />
              {/* Auto-verifies on the last digit; the button is a retry after a
                  failed attempt. */}
              <div className="flex items-center gap-3 min-h-[20px]">
                {verifying === method ? (
                  <span className="flex items-center gap-2 text-xs font-medium text-primary-600">
                    <span className="w-3.5 h-3.5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    Verifying…
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => verifyCode(method, code)}
                      disabled={code.length !== codeLen}
                      className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Verify
                    </button>
                    <span className="text-xs text-neutral-500">
                      {cooldown > 0 ? `Resend in ${cooldown}s` : <button type="button" onClick={() => sendCode(method)} className="underline text-primary-600">Resend code</button>}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
          {errors?.[method] && <p className="text-sm text-red-600 bg-red-50 border-l-2 border-red-400 p-2 rounded">{errors[method]}</p>}
        </motion.div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {errors.verify && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg p-3">{errors.verify}</p>
      )}

      {hasEmail && renderCard({
        method: 'email', icon: FiMail, title: 'Email verification', target: formData.email,
        verified: formData.emailVerification, optional: false, codeLen: 6,
        code: emailCode, setCode: setEmailCode, sent: emailSent, sending: emailSending, cooldown: emailCooldown,
      })}

      {renderCard({
        method: 'phone', icon: FiPhone, title: 'Phone verification', target: hasPhone ? `+91 ${formData.phone}` : '',
        verified: formData.phoneVerification, optional: hasEmail, codeLen: 4,
        code: phoneCode, setCode: setPhoneCode, sent: phoneSent, sending: phoneSending, cooldown: phoneCooldown,
      })}

      {/* Add a phone when none was provided (email-first signup) */}
      {!hasPhone && editing !== 'phone' && (
        <button type="button" onClick={() => startEdit('phone')} className="text-sm font-medium text-primary-600 hover:text-primary-700 underline underline-offset-2 px-1">
          + Add a phone number
        </button>
      )}

      {/* Trust strip */}
      <div className="flex items-start gap-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
        <FiShield className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
          <p className="font-semibold text-neutral-800 dark:text-neutral-200">Verification keeps the community real</p>
          <p>It protects you from fake profiles and earns you a verified badge that matches trust more.</p>
        </div>
      </div>
    </div>
  );
};

export default VerificationStep;
