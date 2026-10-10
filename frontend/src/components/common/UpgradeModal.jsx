import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FiX, FiLock, FiArrowRight, FiZap, FiShield } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import api from '../../api/axios';
import Skeleton from '../ui/Skeleton';
import ErrorState from '../ui/ErrorState';
import { termSuffix } from '../../utils/planFeatures';

// Presentation-only metadata (icon + accent colour), keyed by plan enum. Every
// commercial fact here — price, tenure, contact unlocks, and which of these
// tiers are even for sale — comes from GET /subscription/plans at render
// time. This map must never grow a price or a duration: a hardcoded ladder
// nobody fetched (₹1,500/15d, ₹3,000/1mo, ₹7,499/3mo, two of the three tiers
// withdrawn) is exactly the bug this file used to ship.
const PLAN_META = {
  basic_premium: { icon: FiZap, accent: 'primary' },
  premium_plus:  { icon: FaCrown, accent: 'primary' },
  elite:         { icon: FiShield, accent: 'gold' },
  vip:           { icon: FaCrown, accent: 'gold' },
};
const GRID_KEYS = ['basic_premium', 'premium_plus', 'elite', 'vip'];

/**
 * Reusable upgrade prompt modal
 * @param {boolean} isOpen - controls visibility
 * @param {function} onClose - close handler
 * @param {string} feature - name of the locked feature (e.g. "View Phone Number");
 *   defaults to a translated "this feature"
 * @param {string} description - optional longer description
 */
const UpgradeModal = ({ isOpen, onClose, feature, description }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [plans, setPlans] = useState({});
  // idle | loading | loaded | error — never a static catalogue fallback. A
  // withdrawn tier is simply absent from `plans`, the same contract
  // Subscription.jsx already relies on.
  const [status, setStatus] = useState('idle');
  // Focus management (mirrors ImageLightbox): the element to restore focus to
  // on close, the dialog to trap Tab within, and the first control to focus.
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const triggerRef = useRef(null);

  const fetchPlans = useCallback(() => {
    setStatus('loading');
    api.get('/subscription/plans')
      .then(({ data }) => {
        setPlans(data?.plans || {});
        setStatus('loaded');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    if (isOpen && status === 'idle') fetchPlans();
  }, [isOpen, status, fetchPlans]);

  // Doctrine §6: sheets and modals close on Escape. Focus is also managed here
  // (mirrors ImageLightbox): remember what was focused, move focus into the
  // dialog, trap Tab within it, and restore focus to the trigger on close.
  useEffect(() => {
    if (!isOpen) return undefined;
    triggerRef.current = document.activeElement;
    closeBtnRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (typeof triggerRef.current?.focus === 'function') triggerRef.current.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const visiblePlans = GRID_KEYS
    .filter((key) => Boolean(plans[key]))
    .map((key) => [key, plans[key]]);

  return createPortal(
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-80"
        />

        {/* Modal wrapper keeps dialog fully visible across viewports */}
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] my-auto"
            role="dialog"
            aria-modal="true"
            aria-label={t('upgrade.title')}
          >
            {/* Header — surface with burgundy carried as accents only (doctrine
                §3: burgundy is never a large flat/gradient fill). A thin accent
                bar echoes the plan cards; the icon and title hold the brand. */}
            <div className="relative px-6 pt-8 pb-6 text-center border-b border-neutral-100 dark:border-neutral-800">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-500 to-primary-700" />
              <button
                onClick={onClose}
                ref={closeBtnRef}
                aria-label={t('upgrade.close')}
                className="absolute top-4 right-4 w-8 h-8 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>

              <div className="w-14 h-14 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center">
                <FiLock className="w-7 h-7 text-primary-600 dark:text-primary-400" />
              </div>

              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
                {t('upgrade.title')}
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                {description || t('upgrade.unlockFeature', { feature: feature || t('upgrade.thisFeature') })}
              </p>
            </div>

            {/* Plan list — loading skeleton, error + retry, or the live offer.
                Never a static catalogue: that is exactly the shape of the bug
                this file used to ship. */}
            <div className="px-5 py-5 space-y-3 overflow-y-auto flex-1">
              {status === 'loading' && (
                <div className="space-y-3" aria-busy="true" aria-label={t('upgrade.loadingPlans')}>
                  {[0, 1].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      <Skeleton variant="circle" className="w-9 h-9 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {status === 'error' && (
                <ErrorState
                  title={t('upgrade.errorTitle')}
                  description={t('upgrade.errorBody')}
                  onRetry={fetchPlans}
                  className="py-6"
                />
              )}

              {status === 'loaded' && visiblePlans.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('upgrade.updating')}</p>
                  <button
                    onClick={() => { onClose(); navigate('/subscription'); }}
                    className="mt-3 text-sm font-semibold text-primary-600 underline underline-offset-2"
                  >
                    {t('upgrade.checkPlans')}
                  </button>
                </div>
              )}

              {status === 'loaded' && visiblePlans.map(([key, plan]) => {
                const meta = PLAN_META[key] || {};
                const Icon = meta.icon || FaCrown;
                const gold = meta.accent === 'gold';
                // "Unlimited" carries the actual daily fair-use ceiling
                // (doctrine: state it plainly wherever the unlock benefit
                // shows, never silently) — GET /subscription/plans serves
                // `unlockDailyCap` only on the tier it applies to.
                const unlocksLabel = plan.contactUnlocks === -1
                  ? (plan.unlockDailyCap ? t('upgrade.unlimitedCap', { cap: plan.unlockDailyCap }) : t('upgrade.unlimited'))
                  : t('upgrade.unlocks', { count: plan.contactUnlocks });
                return (
                  <button
                    key={key}
                    onClick={() => { onClose(); navigate('/subscription'); }}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-[transform,box-shadow,border-color,background-color] duration-[160ms] hover:-translate-y-0.5 ${
                      plan.popular
                        ? 'border-primary-300 dark:border-primary-700/50 bg-primary-50/50 dark:bg-primary-900/20 shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-primary-200 dark:hover:border-primary-800'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      gold ? 'bg-gold-100 dark:bg-gold-900/30' : 'bg-primary-100 dark:bg-primary-900/30'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        gold ? 'text-gold-600 dark:text-gold-400' : 'text-primary-500'
                      }`} />
                    </div>

                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{plan.name}</span>
                        {plan.badge && (
                          <span className="px-1.5 py-0.5 bg-primary-500 text-white text-[9px] font-bold rounded-full uppercase">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {/* termSuffix: "/3 months", or " until 10 Jan 2027" when the launch
                            offer sells the plan to a fixed end date (a slash before a date
                            read as "₹1,100/until 10 January 2027"). */}
                        ₹{plan.price.toLocaleString('en-IN')}{termSuffix(plan, plan.duration)} · {unlocksLabel}
                      </p>
                    </div>

                    <FiArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              <button
                onClick={() => { onClose(); navigate('/subscription'); }}
                className="w-full py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-burgundy flex items-center justify-center gap-2"
              >
                {t('upgrade.viewAll')} <FiArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </>
    </AnimatePresence>,
    document.body
  );
};

export default UpgradeModal;
