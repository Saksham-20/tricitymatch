import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheck, FiGift } from 'react-icons/fi';
import api from '../../api/axios';

const inr = (paise) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/**
 * "Have a referral code?" on the signup form.
 *
 * Collapsed to one line until wanted (or until a `?ref=` link prefilled it), then
 * checked against the server as the person types so a typo is caught here, not
 * silently ignored by signup. The check is advisory: an unrecognised code never
 * blocks creating an account, it only tells them before they submit.
 */
export default function ReferralCodeField({ value, onChange, id = 'signup-referral-code' }) {
  const [open, setOpen] = useState(Boolean(value));
  const [state, setState] = useState({ status: 'idle' }); // idle|checking|valid|invalid
  const seq = useRef(0);
  const { t } = useTranslation();

  useEffect(() => { if (value) setOpen(true); }, [value]);

  useEffect(() => {
    const code = (value || '').trim();
    if (code.length < 3) { setState({ status: 'idle' }); return undefined; }
    setState({ status: 'checking' });
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/referral-check', { code });
        if (mine !== seq.current) return; // a newer keystroke superseded this
        setState(data.valid
          ? { status: 'valid', discountPaise: data.discountPaise, referrerName: data.referrerName }
          : { status: 'invalid', message: data.message });
      } catch {
        // Rate-limited or offline: say nothing rather than call a real code wrong.
        if (mine === seq.current) setState({ status: 'idle' });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [value]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-primary-700 dark:text-primary-300 hover:text-primary-800 underline underline-offset-2"
      >
        <FiGift className="w-4 h-4" aria-hidden="true" /> {t('signup.haveReferral')}
      </button>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
        {t('signup.referralLabel')} <span className="font-normal text-neutral-500 dark:text-neutral-400">{t('signup.optional')}</span>
      </label>
      <input
        id={id}
        type="text"
        name="referralCode"
        autoComplete="off"
        autoCapitalize="characters"
        placeholder={t('signup.referralPlaceholder')}
        maxLength={32}
        value={value || ''}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s/g, ''))}
        aria-invalid={state.status === 'invalid'}
        aria-describedby={`${id}-status`}
        className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-surface-dark-3 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 uppercase tracking-wider text-base"
      />
      <p id={`${id}-status`} aria-live="polite" className="text-sm mt-1.5 min-h-[20px]">
        {state.status === 'checking' && <span className="text-neutral-500 dark:text-neutral-400">{t('signup.checking')}</span>}
        {state.status === 'valid' && (
          <span className="inline-flex items-center gap-1.5 text-success">
            <FiCheck className="w-4 h-4" aria-hidden="true" />
            {state.discountPaise > 0
              ? (state.referrerName
                ? t('signup.codeAppliedFromDiscount', { name: state.referrerName, amount: inr(state.discountPaise) })
                : t('signup.codeAppliedDiscount', { amount: inr(state.discountPaise) }))
              : (state.referrerName
                ? t('signup.codeAppliedFrom', { name: state.referrerName })
                : t('signup.codeApplied'))}
          </span>
        )}
        {state.status === 'invalid' && (
          <span className="text-neutral-600 dark:text-neutral-300">
            {t('signup.codeNotFound')}
          </span>
        )}
      </p>
    </div>
  );
}
