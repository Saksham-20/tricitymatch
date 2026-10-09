import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiMail, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import api from '../api/axios';

// Landing page for the "Unsubscribe from reminder emails" link in our
// reminder mail. The link carries a signed member id and token; nothing here
// needs a login. It confirms before it acts: mail-security scanners open every
// link in a message, so a bare GET that unsubscribed would unsubscribe
// everyone on delivery.
const LINK_RE = { u: /^[0-9a-f-]{36}$/i, t: /^[0-9a-f]{32}$/i };

export default function Unsubscribe() {
  const { t: tr } = useTranslation();
  const [params] = useSearchParams();
  const u = params.get('u') || '';
  const t = params.get('t') || '';
  const linkOk = LINK_RE.u.test(u) && LINK_RE.t.test(t);

  // 'idle' | 'working' | 'done' | 'undone' | 'error'
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [lastAction, setLastAction] = useState('unsubscribe');

  const run = async (action) => {
    setStatus('working');
    setError('');
    setLastAction(action);
    try {
      await api.post(`/email/${action}`, { u, t });
      setStatus(action === 'unsubscribe' ? 'done' : 'undone');
    } catch (err) {
      setError(err.response?.data?.error?.message || tr('unsubscribe.error.fallback'));
      setStatus('error');
    }
  };

  const working = status === 'working';

  let icon = FiMail;
  let iconTone = 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300';
  let title = tr('unsubscribe.idle.title');
  let body = tr('unsubscribe.idle.body');

  if (!linkOk) {
    icon = FiAlertCircle;
    iconTone = 'bg-destructive/10 text-destructive dark:text-red-300';
    title = tr('unsubscribe.invalid.title');
    body = tr('unsubscribe.invalid.body');
  } else if (status === 'done') {
    icon = FiCheckCircle;
    iconTone = 'bg-success-50 dark:bg-success-500/20 text-success dark:text-success-100';
    title = tr('unsubscribe.done.title');
    body = tr('unsubscribe.done.body');
  } else if (status === 'undone') {
    icon = FiCheckCircle;
    iconTone = 'bg-success-50 dark:bg-success-500/20 text-success dark:text-success-100';
    title = tr('unsubscribe.undone.title');
    body = tr('unsubscribe.undone.body');
  } else if (status === 'error') {
    icon = FiAlertCircle;
    iconTone = 'bg-destructive/10 text-destructive dark:text-red-300';
    title = tr('unsubscribe.error.title');
    body = error;
  }

  const Icon = icon;

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-16 px-4">
      <Seo
        title="Reminder emails"
        description="Choose whether TricityMatch sends you reminder emails."
        path="/unsubscribe"
        noindex
      />
      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-8 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${iconTone}`}>
            <Icon className="w-7 h-7" aria-hidden="true" />
          </div>

          <div aria-live="polite">
            <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{title}</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{body}</p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {linkOk && (status === 'idle' || (status === 'working' && lastAction === 'unsubscribe')) && (
              <button
                type="button"
                className="btn-primary w-full"
                disabled={working}
                aria-busy={working}
                onClick={() => run('unsubscribe')}
              >
                {working ? tr('unsubscribe.unsubscribing') : tr('unsubscribe.unsubscribe')}
              </button>
            )}

            {linkOk && (status === 'done' || (status === 'working' && lastAction === 'resubscribe')) && (
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={working}
                aria-busy={working}
                onClick={() => run('resubscribe')}
              >
                {working ? tr('unsubscribe.turningBackOn') : tr('unsubscribe.undo')}
              </button>
            )}

            {status === 'error' && (
              <button type="button" className="btn-primary w-full" onClick={() => run(lastAction)}>
                {tr('unsubscribe.tryAgain')}
              </button>
            )}

            {!linkOk && (
              <a href="mailto:support@tricitymatch.com" className="btn-primary w-full flex items-center justify-center">
                {tr('unsubscribe.emailSupport')}
              </a>
            )}

            <Link
              to="/"
              className="w-full min-h-[44px] py-3 flex items-center justify-center text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors duration-150"
            >
              {tr('unsubscribe.backHome')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
