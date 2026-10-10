import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Seo from '../components/common/Seo';
import { detectContactType } from '../components/onboarding/SmartContactField';
import api from '../api/axios';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The ten-digit mobile number however it was typed (+91, a leading 0, spaces).
const mobileFrom = (value) => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

// The account the member named, in the shape the API takes: an email, or the
// mobile number (members who joined by phone have no email). Null when it
// reads as neither.
const accountFrom = (raw) => {
  const value = String(raw || '').trim();
  const kind = detectContactType(value);
  if (kind === 'email') return EMAIL_SHAPE.test(value) ? { email: value } : null;
  if (kind === 'phone') {
    const phone = mobileFrom(value);
    return phone ? { phone } : null;
  }
  return null;
};

// Public appeal form. A suspended member cannot sign in, so this needs no
// account. The server answers identically whatever the email or number is.
export default function Appeal() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const kind = detectContactType(identifier);

  const submit = async (e) => {
    e.preventDefault();
    const account = accountFrom(identifier);
    if (!account) {
      setIdentifierError(t('appeal.identifierInvalid'));
      return;
    }
    setBusy(true);
    try {
      await api.post('/appeals', { ...account, statement });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error?.details?.[0]?.message || err.response?.data?.error?.message || t('appeal.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-16 px-4">
      <Seo title="Appeal a suspension" description="Ask TricityMatch to review a decision about your account." path="/appeal" />
      <div className="max-w-xl mx-auto">
        <Link to="/help" className="text-sm text-primary-600 dark:text-primary-300 inline-flex items-center min-h-[44px] py-3 mb-4">{t('appeal.back')}</Link>
        <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-8">
          <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{t('appeal.title')}</h1>
          {done ? (
            <p className="text-sm text-neutral-700 dark:text-neutral-300" role="status">
              {t('appeal.done')}
            </p>
          ) : (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                {t('appeal.intro')}
              </p>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="appeal-identifier" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('appeal.identifierLabel')}</label>
                  <input
                    id="appeal-identifier"
                    type="text"
                    /* Numeric pad once it reads as a phone number, the @ layout otherwise. */
                    inputMode={kind === 'phone' ? 'tel' : 'email'}
                    autoComplete="username"
                    required
                    className="input-field"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (identifierError) setIdentifierError('');
                    }}
                    aria-invalid={identifierError ? true : undefined}
                    aria-describedby={identifierError ? 'appeal-identifier-error' : 'appeal-identifier-hint'}
                  />
                  {identifierError ? (
                    <p id="appeal-identifier-error" role="alert" className="mt-1 text-xs text-destructive dark:text-red-300">{identifierError}</p>
                  ) : (
                    <p id="appeal-identifier-hint" className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('appeal.identifierHint')}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="appeal-statement" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('appeal.statementLabel')}</label>
                  <textarea id="appeal-statement" required minLength={20} maxLength={2000} rows={6} className="input-field" value={statement} onChange={(e) => setStatement(e.target.value)} />
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span>{statement.trim().length < 20 ? t('appeal.minLength') : ''}</span>
                    <span>{statement.length}/2000</span>
                  </div>
                </div>
                <button type="submit" disabled={busy || !identifier.trim() || statement.trim().length < 20} className="btn-primary disabled:opacity-60">
                  {busy ? t('appeal.sending') : t('appeal.send')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
