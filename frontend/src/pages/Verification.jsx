import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiShield, FiCheckCircle, FiClock, FiXCircle } from 'react-icons/fi';
import LiveSelfieCapture from '../components/verification/LiveSelfieCapture';

const STATUS_META = {
  approved:      { icon: FiCheckCircle, cls: 'text-success bg-success-50 border border-success-100',         key: 'statusApproved' },
  pending:       { icon: FiClock,       cls: 'text-warning bg-warning-light border border-warning/20',       key: 'statusPending' },
  rejected:      { icon: FiXCircle,     cls: 'text-destructive bg-destructive-light border border-destructive/20', key: 'statusRejected' },
};

function StatusPill({ status }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status] || { icon: FiClock, cls: 'text-neutral-500 bg-neutral-100 border border-neutral-200', key: 'statusNotStarted' };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${meta.cls}`}>
      <Icon className="w-4 h-4" /> {t(`verification.${meta.key}`)}
    </span>
  );
}

export default function Verification() {
  const { t } = useTranslation();
  const [selfieStatus, setSelfieStatus] = useState('not_submitted');
  const [adminNotes, setAdminNotes] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const v = await api.get('/verification/status');
      setSelfieStatus(v.data.verification?.status || 'not_submitted');
      setAdminNotes(v.data.verification?.adminNotes || null);
    } catch {
      // silent — page still renders with defaults
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const submitSelfie = async (e) => {
    e.preventDefault();
    if (!selfie) { toast.error('A selfie photo is required'); return; }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('selfiePhoto', selfie);
      await api.post('/verification/submit', form);
      toast.success('Selfie submitted for review');
      setSelfie(null);
      loadStatus();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Trust score from selfie verification
  const trustScore = selfieStatus === 'approved' ? 100 : selfieStatus === 'pending' ? 50 : 0;
  const ringC = 2 * Math.PI * 30;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117]">
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <FiShield className="w-7 h-7 text-primary-600" />
        <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('verification.title')}</h1>
      </div>
      <p className="text-neutral-500 mb-6">{t('verification.subtitle')}</p>

      {/* Trust-score ring header */}
      <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6 flex items-center gap-5">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
            <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth="6" />
            <circle cx="40" cy="40" r="30" fill="none" stroke="#C9A227" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={ringC} strokeDashoffset={ringC - (trustScore / 100) * ringC} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-gold-600">{trustScore}%</span>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100">Trust Score</p>
          <p className="text-sm text-neutral-500">Complete each tier to boost your trust and get more responses.</p>
        </div>
      </div>

      {/* Status overview */}
      <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6">
        <h2 className="text-sm font-medium text-neutral-500 mb-4">{t('verification.status')}</h2>
        <div className="flex items-center justify-between">
          <span className="text-neutral-700">{t('verification.tierSelfie')}</span>
          <StatusPill status={selfieStatus === 'not_submitted' ? undefined : selfieStatus} />
        </div>
        {adminNotes && (
          <p className="mt-4 text-sm text-destructive bg-destructive-light border border-destructive/20 rounded-lg p-3">{adminNotes}</p>
        )}
      </div>

      {/* ── Photo Verification ─────────────────────────────────────────────── */}
      {(
        <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6">
          <h2 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">{t('verification.tierSelfie')}</h2>
          <p className="text-sm text-neutral-500 mb-4">
            Take a live selfie with your camera. Our team matches it against your profile
            photos — no documents needed, and the selfie is never shown to other members.
          </p>

          {/* Why verify — the perks */}
          <div className="mb-5 rounded-xl bg-gold-50 dark:bg-gold-900/10 border border-gold-100 dark:border-gold-800 p-4">
            <p className="text-xs font-bold text-gold-700 dark:text-gold-300 uppercase tracking-wide mb-2">Why get verified</p>
            <ul className="space-y-1.5">
              {[
                'A verified badge on your profile that families trust',
                'Higher ranking in search results',
                'You appear in “Verified only” searches',
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
            <form onSubmit={submitSelfie}>
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

              <LiveSelfieCapture file={selfie} onChange={setSelfie} />

              <button
                type="submit"
                disabled={submitting || !selfie}
                className="mt-5 w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium"
              >
                {submitting ? t('common.loading') : 'Submit for review'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

