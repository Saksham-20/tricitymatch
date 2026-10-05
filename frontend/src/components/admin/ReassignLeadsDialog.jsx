import { useEffect, useRef, useState } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import apiClient from '../../api/apiClient';

/**
 * Choose which active partner takes over some leads.
 *
 * Used for one lead (Admin → Leads) and for a whole partner's open list (the
 * partner's page, typically when they are leaving). The server decides what can
 * move: a lead that already became a member stays with the partner who earned
 * it, and anyone the new partner already has is skipped. This dialog only picks
 * the destination and shows the server's own account of what happened.
 */

const errorOf = (err, fallback) =>
  err?.response?.data?.error?.details?.[0]?.message
  || err?.response?.data?.error?.message
  || err?.response?.data?.message
  || fallback;

const partnerName = (p) => [p.Profile?.firstName, p.Profile?.lastName].filter(Boolean).join(' ');

export default function ReassignLeadsDialog({ title, intro, confirmLabel = 'Move', excludeId, currentOwnerId, onConfirm, onClose }) {
  const ref = useRef(null);
  const [partners, setPartners] = useState(null); // null = loading
  const [loadError, setLoadError] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/admin/marketing-users?limit=100')
      .then((res) => {
        if (cancelled) return;
        const skip = excludeId || currentOwnerId;
        setPartners((res.data.users || []).filter((u) => u.status === 'active' && u.id !== skip));
      })
      .catch((err) => { if (!cancelled) { setPartners([]); setLoadError(errorOf(err, 'Could not load the partners')); } });
    return () => { cancelled = true; };
  }, [excludeId, currentOwnerId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!toUserId) { setError('Choose who should take these leads'); return; }
    setBusy(true);
    setError('');
    try {
      await onConfirm(toUserId);
    } catch (err) {
      setError(errorOf(err, 'Could not move the leads'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <form
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reassign-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white p-6 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto outline-none"
      >
        <h2 id="reassign-title" className="text-xl font-bold mb-2">{title}</h2>
        {intro && <p className="text-sm text-gray-600 mb-4">{intro}</p>}

        <label htmlFor="reassign-to" className="block text-sm font-medium text-gray-700 mb-1">Give to</label>
        {partners === null ? (
          <p className="text-sm text-gray-600 py-2" role="status">Loading partners…</p>
        ) : partners.length === 0 ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {loadError || 'There is no other active partner to give these to. Create or reactivate one first.'}
          </p>
        ) : (
          <select
            id="reassign-to"
            value={toUserId}
            onChange={(e) => { setToUserId(e.target.value); setError(''); }}
            className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Choose a partner…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{partnerName(p) ? `${partnerName(p)} · ${p.email}` : p.email}</option>
            ))}
          </select>
        )}

        <p className="text-xs text-gray-600 mt-3">
          People who have already joined stay with the partner who brought them, so their commission does not move.
        </p>

        {error && (
          <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mt-3" role="alert">
            <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || !partners?.length} className="min-h-[44px] px-4 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
            {busy ? 'Moving…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
