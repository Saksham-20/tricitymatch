import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheckCircle } from 'react-icons/fi';
import api from '../../api/axios';
import OtpBoxes from '../ui/OtpBoxes';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;
const digitsOnly = (raw = '') => String(raw).replace(/\D/g, '').slice(-10);
const isValid = (d) => /^[6-9]\d{9}$/.test(d);
const errOf = (err, fallback) => err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

/**
 * Collects a mobile number and proves the member controls it.
 *
 * flow="account": a signed-in member. The server checks its own DB first, so a
 *   number that is already verified for the account saves with NO code.
 * flow="signup": no account exists yet, so the public send/verify endpoints are
 *   used; the server remembers the verification and stamps it at signup.
 *
 * `onVerified(phone, proof)` fires once the number is proven. Editing a verified
 * number clears the proof, so a late typo can never ride on an old check.
 */
export default function ContactNumberVerify({
  flow = 'account',
  value = '',
  verified = false,
  onChange,
  onVerified,
  error = '',
  label,
  hint,
}) {
  const { t } = useTranslation();
  const shownLabel = label ?? t('auth.mobileNumber');
  const shownHint = hint ?? t('contactNumber.defaultHint');
  const [phone, setPhone] = useState(digitsOnly(value));
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState('');

  // The parent often learns the number after this mounts (the signed-in user
  // arrives from /auth/me a moment later). Take it then, but never under a
  // code that was already sent to the number on screen.
  useEffect(() => {
    if (!otpSent) setPhone(digitsOnly(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const edit = (raw) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    setPhone(d);
    setMessage('');
    if (otpSent) { setOtpSent(false); setCode(''); }
    onChange?.(d);
  };

  const send = async () => {
    if (!isValid(phone)) { setMessage(t('validation.validMobile')); return; }
    if (cooldown > 0) return;
    setSending(true);
    setMessage('');
    try {
      if (flow === 'signup') {
        await api.post('/auth/send-otp', { type: 'phone', target: phone });
        setOtpSent(true);
        setCooldown(RESEND_SECONDS);
      } else {
        const res = await api.post('/auth/contact-number/request', { phone });
        if (res.data.alreadyVerified) {
          // No code is needed for a number the account already verified, but the
          // choice still has to be saved: picking the sign-in number again is
          // what clears a separate contact number. Without this call the page
          // said "Number verified" while members kept getting the old number.
          await api.post('/auth/contact-number/verify', { phone });
          onVerified?.(phone);
        } else {
          setOtpSent(true);
          setCooldown(RESEND_SECONDS);
        }
      }
    } catch (err) {
      setMessage(errOf(err, t('auth.sendCodeFailed')));
    } finally {
      setSending(false);
    }
  };

  const verify = async (otp) => {
    setVerifying(true);
    setMessage('');
    try {
      let proof = '';
      if (flow === 'signup') {
        const { data } = await api.post('/auth/verify-otp', { type: 'phone', target: phone, code: otp });
        proof = data?.verificationProof || '';
      } else {
        await api.post('/auth/contact-number/verify', { phone, code: otp });
      }
      setCode('');
      setOtpSent(false);
      onVerified?.(phone, proof);
    } catch (err) {
      setCode('');
      setMessage(errOf(err, t('contactNumber.codeNoMatch')));
    } finally {
      setVerifying(false);
    }
  };

  const shown = message || error;

  return (
    <div className="space-y-2">
      <label htmlFor="contact-number" className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {shownLabel} <span className="text-destructive ml-1">*</span>
      </label>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus-within:ring-2 focus-within:ring-primary-500">
          <span className="pl-3 pr-2 text-sm text-neutral-500 select-none">+91</span>
          <input
            id="contact-number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => edit(e.target.value)}
            disabled={verifying}
            className="w-full bg-transparent py-3 pr-3 text-base outline-none"
          />
          {verified && isValid(phone) && <FiCheckCircle className="mr-3 h-4 w-4 text-success" aria-label={t('contactNumber.verifiedAria')} />}
        </div>
        {!verified && !otpSent && (
          <button
            type="button"
            onClick={send}
            disabled={sending || !isValid(phone)}
            className="rounded-xl bg-primary-700 px-4 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {sending ? t('auth.sending') : t('contactNumber.verify')}
          </button>
        )}
      </div>

      {otpSent && !verified && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">{t('contactNumber.enterCodeSent', { count: OTP_LENGTH, phone })}</p>
          <OtpBoxes length={OTP_LENGTH} value={code} onChange={setCode} onComplete={verify} disabled={verifying} error={!!message} autoFocus />
          <button
            type="button"
            onClick={send}
            disabled={cooldown > 0 || sending}
            className="text-xs text-primary-700 hover:underline disabled:text-neutral-400 disabled:no-underline"
          >
            {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resendCode')}
          </button>
        </div>
      )}

      {verified && isValid(phone) && <p className="text-xs text-success">{t('contactNumber.verifiedNote')}</p>}
      {shown && <p role="alert" className="text-xs text-destructive">{shown}</p>}
      {!shown && !verified && <p className="text-xs text-neutral-400">{shownHint}</p>}
    </div>
  );
}
