import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiFlag, FiSlash, FiX, FiAlertTriangle } from 'react-icons/fi';

const REPORT_REASONS = [
  { value: 'fake_profile',          label: 'Fake Profile' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'harassment',            label: 'Harassment' },
  { value: 'spam',                  label: 'Spam' },
  { value: 'scam',                  label: 'Scam / Fraud' },
  { value: 'other',                 label: 'Other' },
];

/**
 * BlockReportModal
 * 
 * Props:
 *   isOpen      — boolean
 *   onClose     — () => void
 *   targetUser  — { id, firstName, lastName }
 *   onBlock     — optional callback after block
 */
export default function BlockReportModal({ isOpen, onClose, targetUser, onBlock }) {
  const [mode, setMode]         = useState('choose'); // 'choose' | 'report'
  const [reason, setReason]     = useState('');
  const [description, setDesc]  = useState('');
  const [loading, setLoading]   = useState(false);

  const reset = () => {
    setMode('choose');
    setReason('');
    setDesc('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleBlock = async () => {
    setLoading(true);
    try {
      await api.post(`/block/${targetUser.id}`);
      toast.success(`${targetUser.firstName} has been blocked`);
      onBlock?.();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block user');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reason) { toast.error('Please select a reason'); return; }
    setLoading(true);
    try {
      await api.post(`/report/${targetUser.id}`, { reason, description });
      toast.success('Report submitted. We will review it shortly.');
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                <h3 className="font-bold text-neutral-900 text-base">
                  {mode === 'report' ? 'Report User' : `${targetUser?.firstName}`}
                </h3>
                <button onClick={handleClose} className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 transition-colors">
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              {mode === 'choose' && (
                <div className="p-5 space-y-3">
                  <p className="text-sm text-neutral-500">What would you like to do?</p>
                  <button
                    onClick={() => setMode('report')}
                    className="flex items-center gap-3 w-full p-3.5 rounded-xl border border-neutral-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <FiFlag className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">Report</p>
                      <p className="text-xs text-neutral-500">Flag inappropriate behaviour</p>
                    </div>
                  </button>

                  <button
                    onClick={handleBlock}
                    disabled={loading}
                    className="flex items-center gap-3 w-full p-3.5 rounded-xl border border-neutral-200 hover:border-red-300 hover:bg-red-50 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <FiSlash className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">Block</p>
                      <p className="text-xs text-neutral-500">Stop receiving messages from this user</p>
                    </div>
                  </button>

                  <div className="flex items-start gap-2 bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
                    <FiAlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Blocking will prevent each other from viewing profiles or messaging.</span>
                  </div>
                </div>
              )}

              {mode === 'report' && (
                <form onSubmit={handleReport} className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Reason <span className="text-red-500">*</span></label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">Select a reason</option>
                      {REPORT_REASONS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Additional details (optional)</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDesc(e.target.value)}
                      placeholder="Describe what happened…"
                      maxLength={500}
                      className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('choose')}
                      className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-medium"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl bg-destructive hover:bg-destructive-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                    >
                      {loading ? 'Submitting…' : 'Submit Report'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
