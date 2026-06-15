import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiShield, FiCheckCircle, FiClock, FiXCircle, FiUploadCloud } from 'react-icons/fi';

const DOCUMENT_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
];

const STATUS_META = {
  approved:      { icon: FiCheckCircle, cls: 'text-green-600 bg-green-50',  key: 'statusApproved' },
  passed:        { icon: FiCheckCircle, cls: 'text-green-600 bg-green-50',  key: 'statusApproved' },
  pending:       { icon: FiClock,       cls: 'text-amber-600 bg-amber-50',  key: 'statusPending' },
  in_progress:   { icon: FiClock,       cls: 'text-amber-600 bg-amber-50',  key: 'statusPending' },
  pending_payment:{ icon: FiClock,      cls: 'text-amber-600 bg-amber-50',  key: 'statusPending' },
  rejected:      { icon: FiXCircle,     cls: 'text-red-600 bg-red-50',      key: 'statusRejected' },
  failed:        { icon: FiXCircle,     cls: 'text-red-600 bg-red-50',      key: 'statusRejected' },
};

function StatusPill({ status }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status] || { icon: FiClock, cls: 'text-gray-500 bg-gray-100', key: 'statusNotStarted' };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${meta.cls}`}>
      <Icon className="w-4 h-4" /> {t(`verification.${meta.key}`)}
    </span>
  );
}

export default function Verification() {
  const { t } = useTranslation();
  const [docStatus, setDocStatus] = useState('not_submitted');
  const [bgStatus, setBgStatus] = useState('not_requested');
  const [adminNotes, setAdminNotes] = useState(null);
  const [documentType, setDocumentType] = useState('aadhaar');
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
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
      setDocStatus(v.data.verification?.status || 'not_submitted');
      setAdminNotes(v.data.verification?.adminNotes || null);
      setBgStatus(bg.data.bgCheckStatus || 'not_requested');
    } catch {
      // silent — page still renders with defaults
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const submitDocuments = async (e) => {
    e.preventDefault();
    if (!front) { toast.error('Front of document is required'); return; }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('documentType', documentType);
      form.append('documentFront', front);
      if (back) form.append('documentBack', back);
      if (selfie) form.append('selfiePhoto', selfie);
      await api.post('/verification/submit', form);
      toast.success('Documents submitted for review');
      setFront(null); setBack(null); setSelfie(null);
      loadStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const startBgCheck = async () => {
    if (!bgConsent) { toast.error('Please give consent to proceed'); return; }
    setBgBusy(true);
    try {
      const res = await api.post('/verification/bg-check/initiate', { consent: true });
      if (res.data.razorpayOrderId && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <FiShield className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl font-semibold text-neutral-800">{t('verification.title')}</h1>
      </div>
      <p className="text-neutral-500 mb-8">{t('verification.subtitle')}</p>

      {/* Status overview */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-sm font-medium text-neutral-500 mb-4">{t('verification.status')}</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-neutral-700">{t('verification.tierDocuments')}</span>
            <StatusPill status={docStatus === 'not_submitted' ? undefined : docStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-700">{t('verification.tierBgCheck')}</span>
            <StatusPill status={bgStatus === 'not_requested' ? undefined : bgStatus} />
          </div>
        </div>
        {adminNotes && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{adminNotes}</p>
        )}
      </div>

      {/* Document submission */}
      {docStatus !== 'approved' && docStatus !== 'pending' && (
        <form onSubmit={submitDocuments} className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
          <h2 className="font-semibold text-neutral-800 mb-4">{t('verification.submitDocuments')}</h2>
          <label className="block text-sm text-neutral-600 mb-1">Document type</label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg border border-neutral-200"
          >
            {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>

          <FileField label="Document (front) *" file={front} onChange={setFront} />
          <FileField label="Document (back)" file={back} onChange={setBack} />
          <FileField label="Selfie photo" file={selfie} onChange={setSelfie} />

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium"
          >
            {submitting ? t('common.loading') : t('verification.submitDocuments')}
          </button>
        </form>
      )}

      {/* Background check */}
      {bgStatus !== 'passed' && bgStatus !== 'in_progress' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h2 className="font-semibold text-neutral-800 mb-2">{t('verification.tierBgCheck')}</h2>
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
            className="px-6 py-2.5 bg-neutral-800 text-white rounded-lg hover:bg-neutral-900 disabled:opacity-60 font-medium"
          >
            {bgBusy ? t('common.loading') : t('verification.startBgCheck')}
          </button>
        </div>
      )}
    </div>
  );
}

function FileField({ label, file, onChange }) {
  return (
    <div className="mb-4">
      <label className="block text-sm text-neutral-600 mb-1">{label}</label>
      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-neutral-300 cursor-pointer hover:border-primary-400 text-neutral-500">
        <FiUploadCloud className="w-5 h-5" />
        <span className="text-sm truncate">{file ? file.name : 'Choose file'}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
}
