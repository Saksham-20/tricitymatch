import React, { useEffect, useState, useCallback } from 'react';
import { getVerifications, updateVerification } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiXCircle, FiExternalLink } from 'react-icons/fi';

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

export default function AdminVerifications() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState('pending');
  const [reviewModal, setReviewModal]     = useState(null);
  const [notes, setNotes]                 = useState('');
  const [submitting, setSubmitting]       = useState(false);

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verifications</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review user identity verification requests</p>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
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
                <div>
                  <p className="font-medium text-gray-800">
                    {v.User?.firstName} {v.User?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{v.User?.email}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>

              <div className="text-sm text-gray-600">
                <span className="text-xs text-gray-400">Document: </span>
                <span className="capitalize">{v.documentType?.replace(/_/g, ' ')}</span>
              </div>

              {v.documentUrl && (
                <a
                  href={v.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium"
                >
                  <FiExternalLink className="w-3.5 h-3.5" /> View Document
                </a>
              )}

              {v.adminNotes && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{v.adminNotes}</p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(v.createdAt).toLocaleDateString('en-IN')}</span>
                {v.status === 'pending' && (
                  <button
                    onClick={() => openReview(v)}
                    className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-medium text-xs transition-colors"
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Review Verification</h3>
            <p className="text-sm text-gray-500 mb-4">
              {reviewModal.User?.firstName} {reviewModal.User?.lastName} · {reviewModal.documentType}
            </p>

            {reviewModal.documentUrl && (
              <a
                href={reviewModal.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-rose-600 hover:text-rose-700 font-medium mb-4"
              >
                <FiExternalLink className="w-4 h-4" /> View Document
              </a>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1.5">Admin Notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes or reason for rejection…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
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
    </div>
  );
}
