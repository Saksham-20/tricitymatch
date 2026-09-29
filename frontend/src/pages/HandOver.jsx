import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { FiCheck, FiLock } from 'react-icons/fi';
import { validatePassword } from '../utils/validators';
import Logo from '../components/common/Logo';
import Seo from '../components/common/Seo';

/**
 * The person a profile was set up for opens the emailed link here, chooses
 * their own password, and the account becomes theirs. Reached with no session,
 * because they do not have an account of their own yet.
 */
export default function HandOver() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!validatePassword(password)) {
      setError('Use 8+ characters with uppercase, lowercase, a number, and a symbol');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.post('/guardian/handover/complete', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'This link is invalid or has already been used.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full px-4 py-3 text-base rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-[border-color,box-shadow] duration-[160ms]';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#FDF8F2] dark:bg-surface-dark-1">
      <Seo title="Take over your profile" description="Take over the TricityMatch profile someone set up for you." path="/handover" noindex />
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo size="lg" linkTo="/" /></div>
        <div className="card dark:bg-surface-dark-3 dark:border-neutral-800">
          {!token ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4"><FiLock className="w-7 h-7 text-destructive" /></div>
              <h1 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Invalid link</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Ask the person who set up your profile to send the hand-over link again.</p>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"><FiCheck className="w-7 h-7 text-success" /></div>
              <h1 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Your profile is yours</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Sign in with this email address and the password you just chose. Add your own phone number in Settings.</p>
              <Link to="/login" className="btn-primary inline-flex">Sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h1 className="font-display text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Take over your profile</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Someone set up a TricityMatch profile for you. Choose a password and it becomes yours. They will be signed out and cannot open it again.</p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="handover-new" className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-1">New password</label>
                  <input id="handover-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
                </div>
                <div>
                  <label htmlFor="handover-confirm" className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-1">Confirm password</label>
                  <input id="handover-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? 'Taking over…' : 'Take over my profile'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
