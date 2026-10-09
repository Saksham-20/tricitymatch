import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheck, FiCopy, FiGift, FiShare2, FiX } from 'react-icons/fi';
import api from '../../api/axios';
import { copyToClipboard } from '../common/InviteLink';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/**
 * Referral code at checkout + the member's own code.
 *
 * Two jobs on one quiet panel:
 *   1. APPLY — a buyer types a friend's (or a marketing rep's) code and sees the
 *      price they will pay. The server prices it (`/subscription/referral/check`
 *      runs the same quote `create-order` charges), the page never computes a
 *      discount itself. The accepted code is handed up via `onChange` and sent
 *      with `create-order`.
 *   2. SHARE — the member's own code, what it earns them, and how it is doing.
 *
 * Renders nothing until the server answers, and nothing at all when the
 * programme is off: it is an add-on to checkout, not part of its critical path.
 */
export default function ReferralPanel({ planType, applied, onChange }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const check = useCallback(async (raw) => {
    const code = (raw || '').trim();
    if (!code || !planType) return;
    setChecking(true);
    setError('');
    try {
      const { data } = await api.post('/subscription/referral/check', { code, planType });
      if (data.valid) {
        onChange({
          code: data.code,
          discount: data.discount,
          price: data.price,
          finalPrice: data.finalPrice,
          referrerName: data.referrerName,
        });
        setInput('');
      } else {
        onChange(null);
        setError(data.message || t('referral.couldNotApply'));
      }
    } catch (err) {
      onChange(null);
      setError(err.response?.data?.error?.message || t('referral.checkFailed'));
    } finally {
      setChecking(false);
    }
  }, [planType, onChange, t]);

  useEffect(() => {
    let live = true;
    api.get('/subscription/referral')
      .then(({ data }) => {
        if (!live) return;
        setInfo(data.referral);
        // The code they signed up with (or were invited by) is offered, not
        // forced: they still choose to apply it.
        if (data.referral?.prefill) setInput(data.referral.prefill);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  if (!info?.enabled) return null;

  const canApply = info.eligible && Boolean(planType);
  const shareText = t('referral.shareText', { code: info.code, amount: inr(info.discountPaise / 100), url: info.shareUrl });
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async () => {
    if (await copyToClipboard(info.code)) setCopied(true);
  };
  const handleShare = async () => {
    try {
      await navigator.share({ title: 'TricityMatch', text: shareText });
    } catch { /* dismissed */ }
  };

  return (
    <section
      aria-label={t('referral.sectionLabel')}
      className="mb-8 grid gap-4 md:grid-cols-2 bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5"
    >
      {canApply && (
        <div>
          <h2 className="font-display text-lg text-neutral-900 dark:text-neutral-100 leading-tight">{t('referral.haveCode')}</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            {t('referral.takeOff', { amount: inr(info.discountPaise / 100) })}
          </p>

          {applied ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-700 px-3 py-2.5">
              <span className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                <FiCheck className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {t('referral.appliedOff', { code: applied.code, amount: inr(applied.discount) })}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t('referral.youPay', { final: inr(applied.finalPrice), price: inr(applied.price) })}
                  {applied.referrerName ? ` ${t('referral.fromName', { name: applied.referrerName })}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(null)}
                aria-label={t('referral.remove')}
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form
              className="mt-3"
              onSubmit={(e) => { e.preventDefault(); check(input); }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  aria-label={t('referral.sectionLabel')}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'referral-error' : undefined}
                  value={input}
                  onChange={(e) => { setInput(e.target.value.toUpperCase()); setError(''); }}
                  placeholder={t('referral.enterCode')}
                  maxLength={32}
                  className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-surface-dark-3 text-base uppercase tracking-wider text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={checking || !input.trim()}
                  className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {checking ? t('referral.checking') : t('referral.apply')}
                </button>
              </div>
              {error && (
                <p id="referral-error" role="alert" className="text-sm text-destructive mt-2">{error}</p>
              )}
            </form>
          )}
        </div>
      )}

      <div className={canApply ? 'md:border-l md:border-neutral-200 md:dark:border-neutral-700 md:pl-5' : 'md:col-span-2'}>
        <h2 className="font-display text-lg text-neutral-900 dark:text-neutral-100 leading-tight">{t('referral.referFriend')}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
          {info.referrerUnlocks > 0
            ? t('referral.theyGetYouGet', { amount: inr(info.discountPaise / 100), count: info.referrerUnlocks })
            : t('referral.theyGet', { amount: inr(info.discountPaise / 100) })}
        </p>
        {info.code && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-700 text-sm tracking-widest tabular-nums text-neutral-900 dark:text-neutral-100">
              <FiGift className="w-4 h-4 text-primary-600" aria-hidden="true" />
              {info.code}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
            >
              {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
              {copied ? t('referral.copied') : t('referral.copy')}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors"
              >
                <FiShare2 className="w-4 h-4" /> {t('referral.share')}
              </button>
            ) : (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors"
              >
                <FiShare2 className="w-4 h-4" /> {t('referral.shareWhatsApp')}
              </a>
            )}
          </div>
        )}
        {(info.stats?.signedUp > 0 || info.stats?.paid > 0) && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
            {t('referral.statsJoined', { n: info.stats.signedUp })} · {t('referral.statsPaid', { count: info.stats.paid })}
            {info.stats.unlocksEarned > 0 ? ` · ${t('referral.statsUnlocks', { count: info.stats.unlocksEarned })}` : ''}
          </p>
        )}
      </div>
    </section>
  );
}
