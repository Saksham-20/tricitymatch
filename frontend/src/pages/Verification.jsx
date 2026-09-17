import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiShield, FiCheckCircle, FiClock, FiXCircle } from 'react-icons/fi';
import LiveSelfieCapture from '../components/verification/LiveSelfieCapture';
import ErrorState from '../components/ui/ErrorState';
import Skeleton from '../components/ui/Skeleton';
import { fadeRise, staggerContainer } from '../utils/animations';

const STATUS_META = {
  approved:      { icon: FiCheckCircle, cls: 'text-success bg-success-50 border border-success-100',         key: 'statusApproved', ringCls: 'text-success' },
  pending:       { icon: FiClock,       cls: 'text-warning bg-warning-light border border-warning/20',       key: 'statusPending',  ringCls: 'text-warning' },
  rejected:      { icon: FiXCircle,     cls: 'text-destructive bg-destructive-light border border-destructive/20', key: 'statusRejected', ringCls: 'text-destructive' },
};
const NOT_STARTED_META = { icon: FiClock, cls: 'text-neutral-500 bg-neutral-100 border border-neutral-200', key: 'statusNotStarted', ringCls: 'text-neutral-400' };

function StatusPill({ status }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status] || NOT_STARTED_META;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${meta.cls}`}>
      <Icon className="w-4 h-4" /> {t(`verification.${meta.key}`)}
    </span>
  );
}

// Loading skeleton matches the settled layout's shape (trust-score card +
// status card + photo-verification card), not a spinner (doctrine §6).
function VerificationSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8" aria-busy="true" aria-label="Loading verification status">
      <div className="flex items-center gap-3 mb-1">
        <Skeleton variant="circle" className="w-7 h-7" />
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="h-4 w-64 mb-6" />
      <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6 flex items-center gap-5">
        <Skeleton variant="circle" className="w-20 h-20 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </div>
      </div>
      <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6 space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6">
        <Skeleton className="h-5 w-48 mb-3" />
        <Skeleton.Text lines={2} />
      </div>
    </div>
  );
}

export default function Verification() {
  const { t } = useTranslation();
  const [selfieStatus, setSelfieStatus] = useState('not_submitted');
  const [adminNotes, setAdminNotes] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Default | loading | error — a failed fetch must never quietly render as
  // "not_submitted / 0%"; it gets its own state with a real retry (doctrine §6).
  const [loadState, setLoadState] = useState('loading');

  const loadStatus = useCallback(async () => {
    setLoadState('loading');
    try {
      const v = await api.get('/verification/status');
      setSelfieStatus(v.data.verification?.status || 'not_submitted');
      setAdminNotes(v.data.verification?.adminNotes || null);
      setLoadState('default');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const submitSelfie = async (e) => {
    e.preventDefault();
    if (!selfie) { setSubmitError('Capture a selfie before submitting.'); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('selfiePhoto', selfie);
      await api.post('/verification/submit', form);
      toast.success('Selfie submitted for review');
      setSelfie(null);
      loadStatus();
    } catch (err) {
      setSubmitError(err.response?.data?.error?.message || err.response?.data?.message || 'Could not submit your selfie. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Trust score from selfie verification — real, derived state; never a
  // fabricated number.
  const trustScore = selfieStatus === 'approved' ? 100 : selfieStatus === 'pending' ? 50 : 0;
  const ringMeta = STATUS_META[selfieStatus] || NOT_STARTED_META;
  const ringC = 2 * Math.PI * 30;

  if (loadState === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1">
        <VerificationSkeleton />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <FiShield className="w-7 h-7 text-primary-600" />
            <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('verification.title')}</h1>
          </div>
          <ErrorState
            title="Couldn't load your verification status"
            description="Something went wrong on our end. Try again."
            onRetry={loadStatus}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1">
      <motion.div initial="initial" animate="animate" variants={staggerContainer} className="max-w-3xl mx-auto px-4 py-8">
        <motion.div variants={fadeRise} className="flex items-center gap-3 mb-1">
          <FiShield className="w-7 h-7 text-primary-600" />
          <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('verification.title')}</h1>
        </motion.div>
        <motion.p variants={fadeRise} className="text-neutral-500 mb-6">{t('verification.subtitle')}</motion.p>

        {/* Trust-score ring header. Gold is reserved for premium (doctrine §3.1) —
            selfie verification is free for every member, so the ring reads the
            same status colour as the pill below it: neutral while unstarted,
            warning while pending, success once approved. Never gold. */}
        <motion.div variants={fadeRise} className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6 flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
              <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth="6" />
              <motion.circle
                cx="40" cy="40" r="30" fill="none" stroke="currentColor" className={ringMeta.ringCls} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={ringC}
                initial={false}
                animate={{ strokeDashoffset: ringC - (trustScore / 100) * ringC }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-neutral-800 dark:text-neutral-100">{trustScore}%</span>
          </div>
          <div>
            <p className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100">Trust Score</p>
            <p className="text-sm text-neutral-500">Complete each tier to boost your trust and get more responses.</p>
          </div>
        </motion.div>

        {/* Status overview */}
        <motion.div variants={fadeRise} className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6">
          <h2 className="text-sm font-medium text-neutral-500 mb-4">{t('verification.status')}</h2>
          <div className="flex items-center justify-between">
            <span className="text-neutral-700 dark:text-neutral-300">{t('verification.tierSelfie')}</span>
            <StatusPill status={selfieStatus === 'not_submitted' ? undefined : selfieStatus} />
          </div>
          {adminNotes && (
            <p className="mt-4 text-sm text-destructive bg-destructive-light border border-destructive/20 rounded-lg p-3">{adminNotes}</p>
          )}
        </motion.div>

        {/* Photo Verification */}
        <motion.div variants={fadeRise} className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6">
          <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">{t('verification.tierSelfie')}</h2>
          <p className="text-sm text-neutral-500 mb-4">
            Take a live selfie with your camera. Our team matches it against your profile
            photos. No documents needed, and the selfie is never shown to other members.
          </p>

          {/* Why verify — one standard neutral info panel (doctrine §8: no
              rainbow-tinted info boxes; this is a free feature, so no gold either). */}
          <div className="mb-5 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 p-4">
            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide mb-2">Why get verified</p>
            <ul className="space-y-1.5">
              {[
                'A verified badge on your profile that families trust',
                'Higher ranking in search results',
                'You appear in "Verified only" searches',
              ].map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <FiCheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          {/* Rejected — surface the admin note + let them resubmit */}
          {selfieStatus === 'rejected' && adminNotes && (
            <p className="mb-5 text-sm text-destructive bg-destructive-light border border-destructive/20 rounded-lg p-3">
              {adminNotes}
            </p>
          )}

          {selfieStatus === 'approved' ? (
            <div className="flex items-center gap-2 text-success bg-success-50 border border-success-100 rounded-xl p-4 text-sm font-medium">
              <FiCheckCircle className="w-5 h-5" /> Your profile is verified. The badge is live for other members.
            </div>
          ) : selfieStatus === 'pending' ? (
            <div className="flex items-center gap-2 text-warning bg-warning-light border border-warning/20 rounded-xl p-4 text-sm font-medium">
              <FiClock className="w-5 h-5" /> Your selfie is with our team for review. We'll notify you once it's done.
            </div>
          ) : (
            <form onSubmit={submitSelfie} noValidate>
              {/* How it works */}
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                {[
                  { step: '1', title: 'Take a selfie', desc: 'Good light, face clearly visible' },
                  { step: '2', title: 'Team review', desc: 'Matched to your profile photos' },
                  { step: '3', title: 'Get the badge', desc: 'Verified tick on your profile' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex flex-col items-center text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-700">
                    <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center mb-1.5">{step}</div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{title}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>

              <LiveSelfieCapture file={selfie} onChange={(f) => { setSelfie(f); if (submitError) setSubmitError(''); }} />

              {/* Reserved row: submit error appears here inline, never a toast for
                  something the member must act on (doctrine §6/component law). */}
              <div className="min-h-[20px] mt-3">
                {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting || !selfie}
                className="mt-2 w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium transition-colors duration-[160ms] active:scale-[0.98]"
              >
                {submitting ? t('common.loading') : 'Submit for review'}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
