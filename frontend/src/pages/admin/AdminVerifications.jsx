import React, { useEffect, useState, useCallback } from 'react';
import { getVerifications, updateVerification } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiXCircle, FiCamera, FiUser } from 'react-icons/fi';
import { getImageUrl } from '../../utils/cloudinary';
import { API_BASE_URL } from '../../utils/api';

const TAB_OPTIONS = ['pending', 'approved', 'rejected', 'all'];

const StatusBadge = ({ status }) => {
  const map = {
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
};

const img = (url, transformation = 'thumbnail') => getImageUrl(url, API_BASE_URL, transformation);

// Dev seed data stores relative photo paths with no file behind them — swap a
// broken <img> for the same dashed "Not provided" placeholder instead of the
// browser's broken-image glyph.
const hideOnError = (e) => {
  e.currentTarget.style.display = 'none';
  const fallback = e.currentTarget.parentElement?.querySelector('[data-img-fallback]');
  if (fallback) fallback.style.display = 'flex';
};

const ImgWithFallback = ({ src, alt, className, fallbackClassName }) => (
  <>
    <img src={src} alt={alt} className={className} onError={hideOnError} />
    <div
      data-img-fallback
      style={{ display: 'none' }}
      className={fallbackClassName || 'w-full h-28 rounded-xl border border-dashed border-gray-200 bg-gray-50 items-center justify-center text-[11px] text-gray-400'}
    >
      Image unavailable
    </div>
  </>
);

// Labelled photo cell — the whole review is "does the selfie match the profile
// photos", so selfie and profile shot always render side by side.
const PhotoCell = ({ label, url, icon: Icon, onZoom }) => (
  <div className="flex-1 min-w-0">
    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
      <Icon className="w-3 h-3" /> {label}
    </p>
    {url ? (
      <button type="button" onClick={() => onZoom?.(url)} className="block w-full">
        <ImgWithFallback
          src={img(url)}
          alt={label}
          className="w-full h-28 object-cover rounded-xl border border-gray-200 hover:opacity-90 transition-opacity"
        />
      </button>
    ) : (
      <div className="w-full h-28 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-[11px] text-gray-400">
        Not provided
      </div>
    )}
  </div>
);

export default function AdminVerifications() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState('pending');
  const [reviewModal, setReviewModal]     = useState(null);
  const [notes, setNotes]                 = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [zoomUrl, setZoomUrl]             = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const res = await getVerifications(params);
      setVerifications(res.data.verifications || res.data || []);
    } catch {
      toast.error('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openReview = (v) => {
    setReviewModal(v);
    setNotes(v.adminNotes || '');
  };

  const handleAction = async (action) => {
    if (!reviewModal) return;
    setSubmitting(true);
    try {
      await updateVerification(reviewModal.id, { status: action, adminNotes: notes });
      toast.success(`Verification ${action}`);
      setReviewModal(null);
      fetchData();
    } catch {
      toast.error('Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const memberName = (v) => {
    const p = v.User?.Profile;
    return [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Unknown member';
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Photo Verifications</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Compare each selfie against the member's profile photos, then approve or reject
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TAB_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : verifications.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100 text-gray-400 text-sm">
          No verifications found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {verifications.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{memberName(v)}</p>
                  <p className="text-xs text-gray-400 truncate">{v.User?.email || v.User?.phone}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>

              {/* Selfie vs profile photo */}
              <div className="flex gap-3">
                <PhotoCell label="Selfie" url={v.selfiePhoto} icon={FiCamera} onZoom={setZoomUrl} />
                <PhotoCell label="Profile photo" url={v.User?.Profile?.profilePhoto} icon={FiUser} onZoom={setZoomUrl} />
              </div>

              {!v.selfiePhoto && (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Legacy submission without a selfie — reject and ask the member to resubmit.
                </p>
              )}

              {v.adminNotes && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{v.adminNotes}</p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(v.createdAt).toLocaleDateString('en-IN')}</span>
                {v.status === 'pending' && (
                  <button
                    onClick={() => openReview(v)}
                    className="px-3 py-1.5 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 font-medium text-xs transition-colors"
                  >
                    Review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Review Photo Verification</h3>
            <p className="text-sm text-gray-500 mb-4">
              {memberName(reviewModal)} · {reviewModal.User?.email || reviewModal.User?.phone}
            </p>

            {/* Large side-by-side comparison */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <FiCamera className="w-3 h-3" /> Submitted selfie
                </p>
                {reviewModal.selfiePhoto ? (
                  <ImgWithFallback
                    src={img(reviewModal.selfiePhoto, 'full')}
                    alt="Selfie"
                    className="w-full rounded-xl border border-gray-200 object-cover"
                    fallbackClassName="w-full h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 items-center justify-center text-xs text-gray-400"
                  />
                ) : (
                  <div className="w-full h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400">No selfie</div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <FiUser className="w-3 h-3" /> Profile photo
                </p>
                {reviewModal.User?.Profile?.profilePhoto ? (
                  <ImgWithFallback
                    src={img(reviewModal.User.Profile.profilePhoto, 'full')}
                    alt="Profile"
                    className="w-full rounded-xl border border-gray-200 object-cover"
                    fallbackClassName="w-full h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 items-center justify-center text-xs text-gray-400"
                  />
                ) : (
                  <div className="w-full h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400">No profile photo</div>
                )}
              </div>
            </div>

            {/* Gallery strip for extra comparison shots */}
            {(reviewModal.User?.Profile?.photos || []).length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Gallery</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {reviewModal.User.Profile.photos.map((p, i) => (
                    <img key={i} src={img(p)} alt={`Gallery ${i + 1}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                  ))}
                </div>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1.5">Admin Notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes or reason for rejection…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setReviewModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('rejected')}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                <FiXCircle className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => handleAction('approved')}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                <FiCheckCircle className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom lightbox */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomUrl(null)}
        >
          <img src={img(zoomUrl, 'full')} alt="Zoom" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
