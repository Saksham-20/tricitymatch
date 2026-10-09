import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
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
 * Password reset for members who joined with their mobile number.
 *
 * Email first: the member gives their mobile number AND the email on their
 * account; when both match one account we email a reset link (free for us,
 * and using it verifies the email). A text message code is the fallback. The
 * server answers each step identically whatever happens, so this page can only
 * say "if it matches, we sent it".
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPhone() {
  const [step, setStep] = useState('phone'); // phone | emailSent | code | done
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const sendLink = async (e) => {
    e.preventDefault();
    if (!PHONE_RE.test(toTen(phone))) { setError(t('passwordReset.enterMobile')); return; }
    if (!EMAIL_RE.test(email.trim())) { setError(t('passwordReset.enterAccountEmail')); return; }
    setError(''); setBusy(true);
    try {
      await api.post('/auth/forgot-password/phone-email', { phone: toTen(phone), email: email.trim() });
      setStep('emailSent');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('passwordReset.sendLinkFailed'));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (e) => {
    e?.preventDefault?.();
    if (!PHONE_RE.test(toTen(phone))) { setError(t('passwordReset.enterMobile')); return; }
    setError(''); setBusy(true);
    try {
      await api.post('/auth/forgot-password/phone', { phone: toTen(phone) });
      setStep('code');
      setCooldown(RESEND_SECONDS);
      setResent(false);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('auth.sendCodeFailed'));
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
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('auth.sendCodeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (code.length < 4) { setError(t('passwordReset.enterTheCode')); return; }
    if (!validatePassword(password)) { setError(t('validation.passwordRule')); return; }
    setError(''); setBusy(true);
    try {
      await api.post('/auth/reset-password/phone', { phone: toTen(phone), code, password });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('passwordReset.codeWrong'));
    } finally {
      setBusy(false);
    }
  };

  const field = 'input-field dark:bg-surface-dark-2 dark:border-neutral-700';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#FDF8F2] dark:bg-surface-dark-1">
      <Seo title="Reset password" description="Reset your TricityMatch password if you joined with your mobile number." path="/forgot-password/phone" noindex />
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>

        {step === 'emailSent' ? (
          <div className="card dark:bg-surface-dark-3 dark:border-neutral-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto"><FiCheck className="w-7 h-7 text-success" /></div>
            <h1 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100">{t('auth.checkEmail')}</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              <Trans i18nKey="passwordReset.phoneEmailSentBody" values={{ email: email.trim() }} components={{ b: <strong className="text-neutral-700 dark:text-neutral-300" /> }} />
            </p>
            <div className="rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 p-4 text-left">
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{t('passwordReset.noEmailTitle')}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('passwordReset.maybeDifferent')}</p>
              <button type="button" onClick={() => sendCode()} disabled={busy}
                className="mt-3 w-full btn-secondary text-sm disabled:opacity-60">
                {busy ? t('auth.pleaseWait') : t('passwordReset.textCodeInstead')}
              </button>
              {error && <p role="alert" className="mt-2 text-sm text-destructive dark:text-red-300">{error}</p>}
            </div>
            <Link to="/login" className="text-sm text-primary-500 dark:text-primary-300 font-medium inline-flex items-center gap-1">
              <FiArrowLeft className="w-4 h-4" /> {t('passwordReset.backToSignIn')}
            </Link>
          </div>
        ) : step === 'done' ? (
          <div className="card dark:bg-surface-dark-3 dark:border-neutral-800 text-center">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"><FiCheck className="w-7 h-7 text-success" /></div>
            <h1 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">{t('passwordReset.passwordUpdated')}</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{t('passwordReset.signedOutEverywhere')}</p>
            <Link to="/login" className="btn-primary inline-flex">{t('auth.signIn')}</Link>
          </div>
        ) : (
          <form onSubmit={step === 'phone' ? sendLink : reset} noValidate className="card dark:bg-surface-dark-3 dark:border-neutral-800 space-y-5">
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-1">{t('passwordReset.mobileTitle')}</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {step === 'phone'
                  ? t('passwordReset.phoneStepBody')
                  : t('passwordReset.codeStepBody')}
              </p>
            </div>

            {error && <p role="alert" className="px-4 py-3 rounded-xl bg-destructive/10 dark:bg-red-950/30 border border-destructive/20 dark:border-red-900/50 text-destructive dark:text-red-300 text-sm">{error}</p>}

            {step === 'phone' ? (
              <>
                <div>
                  <label htmlFor="reset-phone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('auth.mobileNumber')}</label>
                  <input id="reset-phone" type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus className={field}
                    placeholder={t('passwordReset.tenDigitPlaceholder')} value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} />
                </div>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('passwordReset.emailOnAccount')}</label>
                  <input id="reset-email" type="email" inputMode="email" autoComplete="email" className={field}
                    placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('passwordReset.code')}</p>
                  <OtpBoxes length={4} value={code} onChange={setCode} />
                </div>
                <div>
                  <label htmlFor="reset-new-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('auth.newPassword')}</label>
                  <div className="relative">
                    <input id="reset-new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`${field} pr-12`} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    >
                      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">{t('validation.passwordHint')}</p>
                </div>
              </>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? t('auth.pleaseWait') : step === 'phone' ? t('passwordReset.emailMeLink') : t('passwordReset.setNewPassword')}
            </button>

            {step === 'phone' && (
              <div className="text-center">
                <button type="button" onClick={() => sendCode()} disabled={busy}
                  className="text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-300 underline underline-offset-2 disabled:opacity-60 py-2">
                  {t('passwordReset.noEmailTextInstead')}
                </button>
              </div>
            )}

            {step === 'code' && (
              <div className="text-center space-y-2">
                <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
                  {resent ? `${t('passwordReset.sentAnother')} ` : ''}{t('passwordReset.noCodeYet')}{' '}
                  <button type="button" onClick={resend} disabled={cooldown > 0 || busy}
                    className="font-medium text-primary-600 dark:text-primary-300 disabled:text-neutral-400 disabled:dark:text-neutral-500 disabled:cursor-not-allowed">
                    {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('passwordReset.resendTheCode')}
                  </button>
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('passwordReset.codesOnlyVerified')}
                </p>
                <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(''); setCooldown(0); }} className="block mx-auto text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary-600 font-medium">
                  {t('passwordReset.useDifferentNumber')}
                </button>
              </div>
            )}

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-primary-500 dark:text-primary-300 font-medium inline-flex items-center gap-1">
                <FiArrowLeft className="w-4 h-4" /> {t('passwordReset.resetWithEmail')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
