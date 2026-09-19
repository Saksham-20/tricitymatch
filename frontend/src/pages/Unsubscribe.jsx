import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
      setError(err.response?.data?.error?.message || 'Connection failed. Try again.');
      setStatus('error');
    }
  };

  const working = status === 'working';

  let icon = FiMail;
  let iconTone = 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300';
  let title = 'Unsubscribe from reminder emails';
  let body = 'We will stop the photo reminders, plan follow-ups and the weekly matches email. Emails about payments, your membership dates, sign-in codes and account security will still reach you.';

  if (!linkOk) {
    icon = FiAlertCircle;
    iconTone = 'bg-destructive/10 text-destructive dark:text-red-300';
    title = 'This link is not valid';
    body = 'Open the latest email from us and use the unsubscribe link at the bottom, or write to us and we will do it for you.';
  } else if (status === 'done') {
    icon = FiCheckCircle;
    iconTone = 'bg-success-50 text-success';
    title = 'You are unsubscribed';
    body = 'We will not send you reminder emails. Emails about payments, membership dates and account security will still reach you.';
  } else if (status === 'undone') {
    icon = FiCheckCircle;
    iconTone = 'bg-success-50 text-success';
    title = 'Reminder emails are back on';
    body = 'You will get our reminder emails again. You can turn them off from the link at the bottom of any of them.';
  } else if (status === 'error') {
    icon = FiAlertCircle;
    iconTone = 'bg-destructive/10 text-destructive dark:text-red-300';
    title = 'That did not go through';
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
                {working ? 'Unsubscribing' : 'Unsubscribe'}
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
                {working ? 'Turning back on' : 'Undo'}
              </button>
            )}

            {status === 'error' && (
              <button type="button" className="btn-primary w-full" onClick={() => run(lastAction)}>
                Try again
              </button>
            )}

            {!linkOk && (
              <a href="mailto:support@tricitymatch.com" className="btn-primary w-full flex items-center justify-center">
                Email support
              </a>
            )}

            <Link
              to="/"
              className="w-full py-2.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors duration-150"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
