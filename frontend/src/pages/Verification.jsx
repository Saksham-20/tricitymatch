import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiShield, FiCheckCircle, FiClock, FiXCircle, FiUploadCloud, FiX, FiCamera } from 'react-icons/fi';
import { razorpay } from '../config';
import { loadRazorpayScript, ensurePaymentsAvailable, PAYMENTS_UNAVAILABLE_MSG } from '../utils/razorpayCheckout';

const STATUS_META = {
  approved:      { icon: FiCheckCircle, cls: 'text-success bg-success-50 border border-success-100',         key: 'statusApproved' },
  passed:        { icon: FiCheckCircle, cls: 'text-success bg-success-50 border border-success-100',         key: 'statusApproved' },
  pending:       { icon: FiClock,       cls: 'text-warning bg-warning-light border border-warning/20',       key: 'statusPending' },
  in_progress:   { icon: FiClock,       cls: 'text-warning bg-warning-light border border-warning/20',       key: 'statusPending' },
  pending_payment:{ icon: FiClock,      cls: 'text-warning bg-warning-light border border-warning/20',       key: 'statusPending' },
  rejected:      { icon: FiXCircle,     cls: 'text-destructive bg-destructive-light border border-destructive/20', key: 'statusRejected' },
  failed:        { icon: FiXCircle,     cls: 'text-destructive bg-destructive-light border border-destructive/20', key: 'statusRejected' },
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
  const [tab, setTab] = useState('photo');
  const [selfieStatus, setSelfieStatus] = useState('not_submitted');
  const [bgStatus, setBgStatus] = useState('not_requested');
  const [adminNotes, setAdminNotes] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bgConsent, setBgConsent] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const [v, bg] = await Promise.all([
        api.get('/verification/status'),
        api.get('/verification/bg-check/status'),
      ]);
      setSelfieStatus(v.data.verification?.status || 'not_submitted');
      setAdminNotes(v.data.verification?.adminNotes || null);
      setBgStatus(bg.data.bgCheckStatus || 'not_requested');
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

  const startBgCheck = async () => {
    if (!bgConsent) { toast.error('Please give consent to proceed'); return; }
    setBgBusy(true);
    try {
      const res = await api.post('/verification/bg-check/initiate', { consent: true });
      if (res.data.razorpayOrderId) {
        // Payment required — make sure the SDK + key are available before
        // opening, so we never claim success without actually charging.
        if (!ensurePaymentsAvailable()) return;
        try {
          await loadRazorpayScript();
        } catch {
          toast.error(PAYMENTS_UNAVAILABLE_MSG);
          return;
        }
        const rzp = new window.Razorpay({
          key: razorpay.keyId,
          order_id: res.data.razorpayOrderId,
          amount: res.data.amountPaise,
          name: 'TricityShadi',
          description: 'Background Check',
          handler: async (resp) => {
            try {
              await api.post('/verification/bg-check/verify-payment', {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              });
              toast.success('Payment confirmed — check in progress');
              loadStatus();
            } catch {
              toast.error('Payment verification failed');
            }
          },
        });
        rzp.open();
      } else {
        toast.success(res.data.message || 'Background check initiated');
        loadStatus();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start background check');
    } finally {
      setBgBusy(false);
    }
  };

  // Trust score from completed tiers
  const trustScore =
    (['approved', 'pending'].includes(selfieStatus) ? 50 : 0) +
    (['passed', 'in_progress'].includes(bgStatus) ? 50 : 0);
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-neutral-700">{t('verification.tierSelfie')}</span>
            <StatusPill status={selfieStatus === 'not_submitted' ? undefined : selfieStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-700">{t('verification.tierBgCheck')}</span>
            <StatusPill status={bgStatus === 'not_requested' ? undefined : bgStatus} />
          </div>
        </div>
        {adminNotes && (
          <p className="mt-4 text-sm text-destructive bg-destructive-light border border-destructive/20 rounded-lg p-3">{adminNotes}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 mb-6 w-full sm:w-fit">
        {[
          { id: 'photo', label: 'Photo Verification' },
          { id: 'bgCheck', label: 'Background Check' },
        ].map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tb.id
                ? 'bg-white dark:bg-[#1a1f2e] shadow text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Photo Verification tab ─────────────────────────────────────────── */}
      {tab === 'photo' && (
        <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6 mb-6">
          <h2 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">{t('verification.tierSelfie')}</h2>
          <p className="text-sm text-neutral-500 mb-4">
            Upload a clear selfie. Our team matches it against your profile photos — no
            documents needed, and the selfie is never shown to other members.
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

              <SelfieField file={selfie} onChange={setSelfie} />

              <button
                type="submit"
                disabled={submitting || !selfie}
                className="mt-4 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium"
              >
                {submitting ? t('common.loading') : t('verification.uploadSelfie')}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Background Check tab ────────────────────────────────────────────── */}
      {tab === 'bgCheck' && (
        <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-6">
          <h2 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t('verification.tierBgCheck')}</h2>
          {bgStatus === 'passed' || bgStatus === 'in_progress' ? (
            <div className={`flex items-center gap-2 rounded-xl p-4 text-sm font-medium ${
              bgStatus === 'passed'
                ? 'text-success bg-success-50 border border-success-100'
                : 'text-warning bg-warning-light border border-warning/20'
            }`}>
              {bgStatus === 'passed'
                ? <><FiCheckCircle className="w-5 h-5" /> Background check complete. The trust badge is on your profile.</>
                : <><FiClock className="w-5 h-5" /> Your background check is in progress.</>}
            </div>
          ) : (
            <>
              <p className="text-sm text-neutral-500 mb-4">
                A professional background verification (₹499). Adds a trust badge to your profile.
              </p>
              <label className="flex items-start gap-2 mb-4 text-sm text-neutral-700">
                <input type="checkbox" checked={bgConsent} onChange={(e) => setBgConsent(e.target.checked)} className="mt-1" />
                <span>I consent to a third-party background check using my profile details.</span>
              </label>
              <button
                onClick={startBgCheck}
                disabled={bgBusy}
                className="px-6 py-2.5 bg-primary-700 text-white rounded-lg hover:bg-primary-800 disabled:opacity-60 font-medium transition-colors"
              >
                {bgBusy ? t('common.loading') : t('verification.startBgCheck')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

function SelfieField({ file, onChange }) {
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  // Object URL preview so the user can confirm the selfie is clear before
  // submitting it for review.
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      {file ? (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50">
          {preview && (
            <img src={preview} alt="Selfie preview" className="w-16 h-16 rounded-xl object-cover border border-neutral-200 flex-shrink-0" />
          )}
          <span className="text-sm text-neutral-700 truncate flex-1">{file.name}</span>
          <button
            type="button"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="p-1.5 rounded-md text-neutral-400 hover:text-destructive hover:bg-white transition-colors flex-shrink-0"
            aria-label="Remove selfie"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-neutral-300 cursor-pointer hover:border-primary-400 text-neutral-500 transition-colors">
          <FiCamera className="w-7 h-7 text-primary-400" />
          <span className="text-sm font-medium text-neutral-700">Take or choose a selfie</span>
          <span className="text-xs text-neutral-400 flex items-center gap-1"><FiUploadCloud className="w-3.5 h-3.5" /> JPG/PNG, face clearly visible</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
        </label>
      )}
    </div>
  );
}
