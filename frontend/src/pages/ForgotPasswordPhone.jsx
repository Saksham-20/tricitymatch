import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { FiArrowLeft, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import { validatePassword } from '../utils/validators';
import OtpBoxes from '../components/ui/OtpBoxes';
import Logo from '../components/common/Logo';
import Seo from '../components/common/Seo';

const PHONE_RE = /^[6-9]\d{9}$/;
const RESEND_SECONDS = 60;
const toTen = (v) => String(v || '').replace(/\D/g, '').slice(-10);

/**
 * Password reset by text message, for accounts that were created with a mobile
 * number and have no verified email to receive a link. The server answers the
 * first step identically for every number, so this page can only say "if it can
 * be reset, a code was sent".
 */
export default function ForgotPasswordPhone() {
  const [step, setStep] = useState('phone'); // phone | code | done
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const sendCode = async (e) => {
    e.preventDefault();
    if (!PHONE_RE.test(toTen(phone))) { setError('Enter your 10-digit mobile number'); return; }
    setError(''); setBusy(true);
    try {
      await api.post('/auth/forgot-password/phone', { phone: toTen(phone) });
      setStep('code');
      setCooldown(RESEND_SECONDS);
      setResent(false);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // The server answers identically whether or not a code went out, so a member
  // whose account is not eligible (it has a verified email, say) would wait for
  // a text that never comes. Offer a resend and the email route.
  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setError(''); setBusy(true);
    try {
      await api.post('/auth/forgot-password/phone', { phone: toTen(phone) });
      setCooldown(RESEND_SECONDS);
      setResent(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (code.length < 4) { setError('Enter the code we sent'); return; }
    if (!validatePassword(password)) { setError('Use 8+ characters with uppercase, lowercase, a number, and a symbol'); return; }
    setError(''); setBusy(true);
    try {
      await api.post('/auth/reset-password/phone', { phone: toTen(phone), code, password });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'That code is not right or has expired.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'input-field dark:bg-surface-dark-2 dark:border-neutral-700';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#FDF8F2] dark:bg-surface-dark-1">
      <Seo title="Reset password by mobile" description="Reset your TricityMatch password with a code sent to your mobile number." path="/forgot-password/phone" noindex />
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>

        {step === 'done' ? (
          <div className="card dark:bg-surface-dark-3 dark:border-neutral-800 text-center">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"><FiCheck className="w-7 h-7 text-success" /></div>
            <h1 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Password updated</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Every device was signed out. Sign in with your mobile number and new password.</p>
            <Link to="/login" className="btn-primary inline-flex">Sign in</Link>
          </div>
        ) : (
          <form onSubmit={step === 'phone' ? sendCode : reset} noValidate className="card dark:bg-surface-dark-3 dark:border-neutral-800 space-y-5">
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-1">Reset by mobile</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {step === 'phone'
                  ? 'For accounts created with a mobile number and no email. We text you a code.'
                  : 'If this number can be reset, we sent a code to it. Enter it with a new password.'}
              </p>
            </div>

            {error && <p role="alert" className="px-4 py-3 rounded-xl bg-destructive/10 dark:bg-red-950/30 border border-destructive/20 dark:border-red-900/50 text-destructive dark:text-red-300 text-sm">{error}</p>}

            {step === 'phone' ? (
              <div>
                <label htmlFor="reset-phone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Mobile number</label>
                <input id="reset-phone" type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus className={field}
                  placeholder="10-digit number" value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} />
              </div>
            ) : (
              <>
                <div>
                  <p className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Code</p>
                  <OtpBoxes length={4} value={code} onChange={setCode} />
                </div>
                <div>
                  <label htmlFor="reset-new-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">New password</label>
                  <div className="relative">
                    <input id="reset-new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`${field} pr-12`} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    >
                      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">8+ characters with uppercase, lowercase, a number, and a symbol.</p>
                </div>
              </>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? 'Please wait…' : step === 'phone' ? 'Send code' : 'Set new password'}
            </button>

            {step === 'code' && (
              <div className="text-center space-y-2">
                <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
                  {resent ? 'We sent another code. ' : ''}No code yet?{' '}
                  <button type="button" onClick={resend} disabled={cooldown > 0 || busy}
                    className="font-medium text-primary-600 dark:text-primary-300 disabled:text-neutral-400 disabled:dark:text-neutral-500 disabled:cursor-not-allowed">
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the code'}
                  </button>
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Accounts that have an email address are reset by email, not text. Use the email link below if no code arrives.
                </p>
                <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(''); setCooldown(0); }} className="block mx-auto text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-600 font-medium">
                  Use a different number
                </button>
              </div>
            )}

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-primary-500 dark:text-primary-300 font-medium inline-flex items-center gap-1">
                <FiArrowLeft className="w-4 h-4" /> Reset by email instead
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
