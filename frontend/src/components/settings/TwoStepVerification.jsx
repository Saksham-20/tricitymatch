import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
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
      toast.error(errorOf(err, 'Could not start setup. Try again.'));
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
      toast.error(errorOf(err, 'That code is not right. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/mfa/disable', { password, code });
      toast.success('Two-step verification is off');
      setUser?.((u) => (u ? { ...u, mfaEnabled: false } : u));
      reset();
      load();
    } catch (err) {
      toast.error(errorOf(err, 'Could not turn it off. Check your password and code.'));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'input-field';
  const labelClass = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5';

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Two-step verification</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          Asks for a code from an authenticator app when you sign in, so a stolen password alone is not enough.
        </p>
      </div>

      <div className="max-w-xl space-y-4">
        {loadError && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <FiAlertCircle className="w-4 h-4" /> Could not load your setting.{' '}
            <button type="button" onClick={load} className="underline">Retry</button>
          </p>
        )}

        {status && step === 'idle' && (
          <div className="flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              <FiShield className={`w-4 h-4 ${status.enabled ? 'text-success' : 'text-neutral-400'}`} />
              {status.enabled
                ? `On${status.recoveryCodesRemaining ? ` · ${status.recoveryCodesRemaining} recovery codes left` : ''}`
                : 'Off'}
            </p>
            {!status.enabled && (
              <button type="button" className="btn-secondary" onClick={() => setStep('password')}>Turn on</button>
            )}
            {status.enabled && !status.required && (
              <button type="button" className="btn-secondary" onClick={() => setStep('disable')}>Turn off</button>
            )}
            {status.enabled && status.required && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Required for your role</span>
            )}
          </div>
        )}

        {status?.required && !status.enabled && step === 'idle' && (
          <p className="flex items-start gap-2 text-sm text-warning">
            <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> Your role needs this turned on before you can use the admin or marketing areas.
          </p>
        )}

        {step === 'password' && (
          <form onSubmit={startSetup} className="space-y-3">
            <div>
              <label htmlFor="mfa-password" className={labelClass}>Confirm your password</label>
              <input id="mfa-password" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !password} className="btn-primary disabled:opacity-60">Continue</button>
              <button type="button" className="btn-secondary" onClick={reset}>Cancel</button>
            </div>
          </form>
        )}

        {step === 'code' && setup && (
          <form onSubmit={enable} className="space-y-4">
            <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800 p-4 space-y-2">
              <p className="text-sm text-neutral-700 dark:text-neutral-200">
                In your authenticator app (Google Authenticator, Authy, 1Password…) add an account and enter this key:
              </p>
              <p className="font-mono text-sm tracking-wider break-all select-all text-neutral-900 dark:text-neutral-100" data-testid="mfa-secret">{groupSecret(setup.secret)}</p>
              <a href={setup.otpauthUri} className="text-sm underline text-primary-600 dark:text-primary-300">Open in an authenticator app on this device</a>
            </div>
            <div>
              <label htmlFor="mfa-code" className={labelClass}>6-digit code from the app</label>
              <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || code.replace(/\s/g, '').length < 6} className="btn-primary disabled:opacity-60">Turn on</button>
              <button type="button" className="btn-secondary" onClick={reset}>Cancel</button>
            </div>
          </form>
        )}

        {step === 'codes' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Two-step verification is on.</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Save these recovery codes somewhere safe. Each works once if you lose your phone. They are shown only now.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-4 font-mono text-sm text-neutral-900 dark:text-neutral-100" data-testid="mfa-recovery-codes">
              {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <button type="button" className="btn-primary" onClick={() => { setRecoveryCodes([]); reset(); }}>I have saved them</button>
          </div>
        )}

        {step === 'disable' && (
          <form onSubmit={disable} className="space-y-3">
            <div>
              <label htmlFor="mfa-off-password" className={labelClass}>Password</label>
              <input id="mfa-off-password" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="mfa-off-code" className={labelClass}>Code from the app (or a recovery code)</label>
              <input id="mfa-off-code" autoComplete="one-time-code" className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !password || !code} className="btn-primary disabled:opacity-60">Turn off</button>
              <button type="button" className="btn-secondary" onClick={reset}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TwoStepVerification;
