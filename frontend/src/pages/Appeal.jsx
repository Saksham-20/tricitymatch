import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Seo from '../components/common/Seo';
import api from '../api/axios';

// Public appeal form. A suspended member cannot sign in, so this needs no
// account. The server answers identically whatever the email is.
export default function Appeal() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/appeals', { email, statement });
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
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="appeal-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('appeal.emailLabel')}</label>
                  <input id="appeal-email" type="email" autoComplete="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="appeal-statement" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('appeal.statementLabel')}</label>
                  <textarea id="appeal-statement" required minLength={20} maxLength={2000} rows={6} className="input-field" value={statement} onChange={(e) => setStatement(e.target.value)} />
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span>{statement.trim().length < 20 ? t('appeal.minLength') : ''}</span>
                    <span>{statement.length}/2000</span>
                  </div>
                </div>
                <button type="submit" disabled={busy || statement.trim().length < 20} className="btn-primary disabled:opacity-60">
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
