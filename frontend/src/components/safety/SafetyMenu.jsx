/**
 * SafetyMenu — "More" button with Report and Block for another member.
 *
 * The web app had no way to report or block anyone, although the Terms, Safety
 * and Help pages promise both. Used on the profile page and the chat header.
 *
 * Block is two-way and immediate; the other person is not told. Report goes to
 * human review — nothing is actioned automatically.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMoreVertical, FiFlag, FiSlash, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { reportMember, blockMember } from '../../api/safety';
import { REPORT_REASONS, URGENT_REASONS, reportReasonLabel, reportReasonHint } from './reportReasons';
import { backdrop, modal, popIn } from '../../utils/animations';

const MAX_DETAILS = 1000;

const failureMessage = (t, err, fallback) => {
  if (err?.response?.status === 429) return t('safetyTools.tooMany');
  if (!err?.response) return t('safetyTools.noConnection');
  return err.response?.data?.error?.message || fallback;
};

// Escape-to-close and return focus to whatever opened the dialog.
const useDialogA11y = (open, onClose) => {
  const dialogRef = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    const t = setTimeout(() => dialogRef.current?.focus(), 0);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      if (returnTo.current && typeof returnTo.current.focus === 'function') returnTo.current.focus();
    };
  }, [open, onClose]);

  return dialogRef;
};

const Backdrop = ({ children, onClose }) => (
  <motion.div
    {...backdrop}
    className="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
    onClick={onClose}
  >
    {children}
  </motion.div>
);

const cardClass =
  'w-full sm:max-w-md max-h-[90vh] overflow-y-auto [color-scheme:light] dark:[color-scheme:dark] bg-white dark:bg-surface-dark-3 rounded-t-3xl sm:rounded-3xl shadow-xl p-5 focus:outline-none';

// ─── Report dialog ───────────────────────────────────────────────────────────

const ReportDialog = ({ open, userId, name, onClose, onBlockInstead }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const dialogRef = useDialogA11y(open, onClose);

  useEffect(() => {
    if (open) { setReason(''); setDetails(''); setError(''); setDone(false); setSubmitting(false); }
  }, [open]);

  const submit = async () => {
    if (!reason) { setError(t('safetyTools.chooseReason')); return; }
    setSubmitting(true);
    setError('');
    try {
      await reportMember(userId, reason, details);
      setDone(true);
    } catch (err) {
      setError(failureMessage(t, err, t('safetyTools.reportFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onClose}>
          <motion.div
            {...modal}
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            className={cardClass}
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center py-4">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-50 dark:bg-success-500/15">
                  <FiCheck className="h-6 w-6 text-success dark:text-green-400" aria-hidden="true" />
                </div>
                <h2 id="report-title" className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {t('safetyTools.reportReceived')}
                </h2>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                  {t('safetyTools.reportReceivedDesc', { name })}
                </p>
                {URGENT_REASONS.includes(reason) && (
                  <p className="mt-3 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                    {t('safetyTools.emergency')}
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onBlockInstead}
                    className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-[160ms]"
                  >
                    {t('safetyTools.alsoBlock', { name })}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] rounded-xl bg-primary-500 text-sm font-semibold text-white hover:bg-primary-600 transition-colors duration-[160ms]"
                  >
                    {t('safetyTools.done')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h2 id="report-title" className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {t('safetyTools.reportName', { name })}
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('safetyTools.close')}
                    className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <FiX className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
                  {t('safetyTools.whatHappened', { name })}
                </p>

                <fieldset className="space-y-1.5" disabled={submitting}>
                  <legend className="sr-only">{t('safetyTools.reasonLegend')}</legend>
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-[160ms] ${
                        reason === r.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => { setReason(r.value); setError(''); }}
                        className="mt-1 h-4 w-4 accent-primary-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">{reportReasonLabel(t, r)}</span>
                        {r.hint && <span className="block text-xs text-neutral-500 dark:text-neutral-400">{reportReasonHint(t, r)}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>

                <label htmlFor="report-details" className="mt-4 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  {t('safetyTools.anythingElse')} <span className="font-normal text-neutral-400">{t('safetyTools.optional')}</span>
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS))}
                  rows={3}
                  disabled={submitting}
                  className="mt-1.5 w-full resize-none rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-surface-dark-2 dark:text-neutral-100"
                />
                <p className="mt-1 text-right text-xs tabular-nums text-neutral-400">{details.length}/{MAX_DETAILS}</p>

                {error && (
                  <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-destructive">
                    <FiAlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    {error}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    {t('safetyTools.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="min-h-[44px] flex-1 rounded-xl bg-primary-500 text-sm font-semibold text-white transition-colors duration-[160ms] hover:bg-primary-600 disabled:opacity-60"
                  >
                    {submitting ? t('safetyTools.sending') : t('safetyTools.sendReport')}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
};

// ─── Block dialog ────────────────────────────────────────────────────────────

const BlockDialog = ({ open, userId, name, onClose, onBlocked }) => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useDialogA11y(open, onClose);

  useEffect(() => {
    if (open) { setError(''); setSubmitting(false); }
  }, [open]);

  const confirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await blockMember(userId);
      toast.success(t('safetyTools.blocked', { name }));
      onBlocked?.();
      onClose();
    } catch (err) {
      setError(failureMessage(t, err, t('safetyTools.blockFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onClose}>
          <motion.div
            {...modal}
            ref={dialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="block-title"
            aria-describedby="block-desc"
            className={cardClass}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="block-title" className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {t('safetyTools.blockQuestion', { name })}
            </h2>
            <p id="block-desc" className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              {t('safetyTools.blockDesc', { name })}
            </p>
            {error && (
              <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive">
                <FiAlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {t('safetyTools.cancel')}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={submitting}
                className="min-h-[44px] flex-1 rounded-xl bg-primary-600 text-sm font-semibold text-white transition-colors duration-[160ms] hover:bg-primary-700 disabled:opacity-60"
              >
                {submitting ? t('safetyTools.blocking') : t('safetyTools.block')}
              </button>
            </div>
          </motion.div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
};

// ─── Menu ────────────────────────────────────────────────────────────────────

const SafetyMenu = ({ userId, name: nameProp, onBlocked, className = '' }) => {
  const { t } = useTranslation();
  const name = nameProp ?? t('safetyTools.thisMember');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const closeReport = useCallback(() => setReportOpen(false), []);
  const closeBlock = useCallback(() => setBlockOpen(false), []);

  if (!userId) return null;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t('safetyTools.moreOptions', { name })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition-colors duration-[160ms] hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <FiMoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            {...popIn}
            role="menu"
            aria-label={t('safetyTools.optionsFor', { name })}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-surface-dark-3"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); setReportOpen(true); }}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm text-neutral-700 transition-colors duration-[160ms] hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <FiFlag className="h-4 w-4" aria-hidden="true" /> {t('safetyTools.reportName', { name })}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); setBlockOpen(true); }}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm text-destructive transition-colors duration-[160ms] hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <FiSlash className="h-4 w-4" aria-hidden="true" /> {t('safetyTools.blockName', { name })}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ReportDialog
        open={reportOpen}
        userId={userId}
        name={name}
        onClose={closeReport}
        onBlockInstead={() => { setReportOpen(false); setBlockOpen(true); }}
      />
      <BlockDialog open={blockOpen} userId={userId} name={name} onClose={closeBlock} onBlocked={onBlocked} />
    </div>
  );
};

export default SafetyMenu;
