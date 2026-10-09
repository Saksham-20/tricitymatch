import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FiShield, FiAlertCircle } from 'react-icons/fi';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// Two-step verification (authenticator app). Staff accounts are required to have
// it when the server flag is on; members may opt in. Enrolment is three calls:
// setup (re-enter password -> secret), enable (prove a code -> recovery codes),
// and disable (password + code) for accounts where it is optional.
const errorOf = (err, fallback) => err.response?.data?.error?.message || err.response?.data?.message || fallback;

const groupSecret = (secret) => (secret || '').replace(/(.{4})/g, '$1 ').trim();

const TwoStepVerification = () => {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [status, setStatus] = useState(null); // { enabled, required, recoveryCodesRemaining }
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState('idle'); // idle | password | code | codes | disable
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null); // { secret, otpauthUri }
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoadError(false);
    try {
      const { data } = await api.get('/auth/mfa/status');
      setStatus(data);
    } catch {
      setLoadError(true);
    }
  };
  useEffect(() => { load(); }, []);

  // Google-only members have no password to re-enter, so they cannot enrol here.
  if (user?.hasPassword === false) return null;

  const reset = () => { setStep('idle'); setPassword(''); setCode(''); setSetup(null); };

  const startSetup = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/mfa/setup', { password });
      setSetup(data);
      setPassword('');
      setStep('code');
    } catch (err) {
      toast.error(errorOf(err, t('settings.twoStep.startFailed')));
    } finally {
      setBusy(false);
    }
  };

  const enable = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/mfa/enable', { code });
      setRecoveryCodes(data.recoveryCodes || []);
      setSetup(null);
      setCode('');
      setStep('codes');
      setUser?.((u) => (u ? { ...u, mfaEnabled: true } : u));
      load();
    } catch (err) {
      toast.error(errorOf(err, t('settings.twoStep.codeWrong')));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/mfa/disable', { password, code });
      toast.success(t('settings.twoStep.turnedOff'));
      setUser?.((u) => (u ? { ...u, mfaEnabled: false } : u));
      reset();
      load();
    } catch (err) {
      toast.error(errorOf(err, t('settings.twoStep.disableFailed')));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'input-field';
  const labelClass = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5';

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{t('settings.twoStep.title')}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          {t('settings.twoStep.desc')}
        </p>
      </div>

      <div className="max-w-xl space-y-4">
        {loadError && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <FiAlertCircle className="w-4 h-4" /> {t('settings.twoStep.loadError')}{' '}
            <button type="button" onClick={load} className="underline">{t('settings.twoStep.retry')}</button>
          </p>
        )}

        {status && step === 'idle' && (
          <div className="flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              <FiShield className={`w-4 h-4 ${status.enabled ? 'text-success' : 'text-neutral-400'}`} />
              {status.enabled
                ? (status.recoveryCodesRemaining ? t('settings.twoStep.onWithCodes', { n: status.recoveryCodesRemaining }) : t('settings.twoStep.on'))
                : t('settings.twoStep.off')}
            </p>
            {!status.enabled && (
              <button type="button" className="btn-secondary" onClick={() => setStep('password')}>{t('settings.twoStep.turnOn')}</button>
            )}
            {status.enabled && !status.required && (
              <button type="button" className="btn-secondary" onClick={() => setStep('disable')}>{t('settings.twoStep.turnOff')}</button>
            )}
            {status.enabled && status.required && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('settings.twoStep.required')}</span>
            )}
          </div>
        )}

        {status?.required && !status.enabled && step === 'idle' && (
          <p className="flex items-start gap-2 text-sm text-warning">
            <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {t('settings.twoStep.requiredWarning')}
          </p>
        )}

        {step === 'password' && (
          <form onSubmit={startSetup} className="space-y-3">
            <div>
              <label htmlFor="mfa-password" className={labelClass}>{t('settings.twoStep.confirmPassword')}</label>
              <input id="mfa-password" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !password} className="btn-primary disabled:opacity-60">{t('settings.twoStep.continue')}</button>
              <button type="button" className="btn-secondary" onClick={reset}>{t('settings.common.cancel')}</button>
            </div>
          </form>
        )}

        {step === 'code' && setup && (
          <form onSubmit={enable} className="space-y-4">
            <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800 p-4 space-y-2">
              <p className="text-sm text-neutral-700 dark:text-neutral-200">
                {t('settings.twoStep.addKey')}
              </p>
              <p className="font-mono text-sm tracking-wider break-all select-all text-neutral-900 dark:text-neutral-100" data-testid="mfa-secret">{groupSecret(setup.secret)}</p>
              <a href={setup.otpauthUri} className="text-sm underline text-primary-600 dark:text-primary-300">{t('settings.twoStep.openInApp')}</a>
            </div>
            <div>
              <label htmlFor="mfa-code" className={labelClass}>{t('settings.twoStep.codeLabel')}</label>
              <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || code.replace(/\s/g, '').length < 6} className="btn-primary disabled:opacity-60">{t('settings.twoStep.turnOn')}</button>
              <button type="button" className="btn-secondary" onClick={reset}>{t('settings.common.cancel')}</button>
            </div>
          </form>
        )}

        {step === 'codes' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{t('settings.twoStep.isOn')}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t('settings.twoStep.saveCodes')}
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-4 font-mono text-sm text-neutral-900 dark:text-neutral-100" data-testid="mfa-recovery-codes">
              {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <button type="button" className="btn-primary" onClick={() => { setRecoveryCodes([]); reset(); }}>{t('settings.twoStep.savedThem')}</button>
          </div>
        )}

        {step === 'disable' && (
          <form onSubmit={disable} className="space-y-3">
            <div>
              <label htmlFor="mfa-off-password" className={labelClass}>{t('settings.twoStep.password')}</label>
              <input id="mfa-off-password" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="mfa-off-code" className={labelClass}>{t('settings.twoStep.offCodeLabel')}</label>
              <input id="mfa-off-code" autoComplete="one-time-code" className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !password || !code} className="btn-primary disabled:opacity-60">{t('settings.twoStep.turnOff')}</button>
              <button type="button" className="btn-secondary" onClick={reset}>{t('settings.common.cancel')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TwoStepVerification;
