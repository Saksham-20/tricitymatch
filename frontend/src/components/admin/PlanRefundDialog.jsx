import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { refundSubscription } from '../../api/adminApi';
import planLabel from '../../utils/planLabel';
import { formatDateTime } from '../../utils/formatDate';

/**
 * Refund one payment through Razorpay, with the published policy worked out.
 *
 * The Refund Policy page (i18n locales `refund.json`, "Seven days, no argument")
 * promises a full refund when asked within seven days of paying, less any
 * contact unlocks already used, deducted "at ₹199 for three" (the unlock
 * top-up price). After seven days the unused part of a term is not refunded,
 * except where we removed a feature, the service was unusable, or the member was
 * charged twice. The dialog shows that figure; the amount stays editable and the
 * server's own checks are unchanged.
 */

export const REFUND_WINDOW_DAYS = 7;
export const UNLOCK_PACK_PRICE = 199;
export const UNLOCK_PACK_SIZE = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * What the policy says to refund for one subscription row.
 * `suggested` is null when the payment date is unknown (nothing to measure
 * the seven days from).
 */
export function refundSuggestion(row, now = Date.now()) {
  const amount = Number(row?.amount) || 0;
  const left = Math.max(0, amount - (Number(row?.refundedAmount) || 0));
  const unlocksUsed = Math.max(0, Number(row?.contactUnlocksUsed) || 0);
  const paidAtRaw = row?.paidAt || (row?.razorpayPaymentId ? row?.startDate : null) || null;
  const paidAtMs = paidAtRaw ? new Date(paidAtRaw).getTime() : NaN;
  if (Number.isNaN(paidAtMs)) {
    return { left, amount, unlocksUsed, paidAt: null, days: null, withinWindow: null, deduction: 0, suggested: null };
  }
  const elapsed = Math.max(0, now - paidAtMs);
  const withinWindow = elapsed <= REFUND_WINDOW_DAYS * DAY_MS;
  const deduction = withinWindow ? Math.round((unlocksUsed * UNLOCK_PACK_PRICE) / UNLOCK_PACK_SIZE) : 0;
  return {
    left,
    amount,
    unlocksUsed,
    paidAt: paidAtRaw,
    days: Math.floor(elapsed / DAY_MS),
    withinWindow,
    deduction,
    suggested: withinWindow ? Math.max(0, left - deduction) : 0,
  };
}

const daysAgo = (days) => (days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`);

export default function PlanRefundDialog({ row, onClose, onRefunded }) {
  const policy = refundSuggestion(row);
  const { left } = policy;
  // Start from what the policy allows. With no payment date to measure from,
  // fall back to what is left on the payment; when the policy allows nothing,
  // the field starts empty so any figure is a deliberate one.
  const [amount, setAmount] = useState(() => {
    if (policy.suggested === null) return String(left);
    return policy.suggested > 0 ? String(policy.suggested) : '';
  });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const amt = Number(amount);
  const problem = !Number.isFinite(amt) || amt <= 0 ? 'Enter an amount above zero'
    : amt > left ? `The most that can be refunded is ${rupees(left)}`
    : reason.trim().length < 5 ? 'Give a reason of at least 5 characters (it is kept in the audit log)'
    : null;

  const submit = async () => {
    setBusy(true);
    try {
      await refundSubscription(row.id, { amount: amt, reason: reason.trim() });
      toast.success('Refund issued. It reaches the member in five to seven working days.');
      onRefunded();
    } catch (err) {
      const e = err?.response?.data?.error;
      toast.error(e?.details?.[0]?.message || e?.message || 'Could not issue the refund');
      setBusy(false);
    }
  };

  const unlockLimit = row.contactUnlocksAllowed == null ? 'unlimited' : row.contactUnlocksAllowed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="refund-title" className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl outline-none">
        <h3 id="refund-title" className="text-lg font-bold text-gray-900 mb-1">Refund this payment</h3>
        <p className="text-sm text-gray-600 mb-3">
          Paid {rupees(row.amount || 0)} for {planLabel(row.planType)}.
          This sends money back to the member&apos;s original payment method through Razorpay and cannot be undone. It does not end their plan; use End plan for that.
        </p>

        <dl className="text-xs text-gray-600 space-y-1 mb-3">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-gray-500">Paid on</dt>
            <dd className="font-medium text-gray-800">
              {policy.paidAt ? formatDateTime(policy.paidAt) : 'Not recorded'}
              {policy.days != null && (
                <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full font-semibold ${policy.withinWindow ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'}`}>
                  {daysAgo(policy.days)}
                </span>
              )}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-gray-500">Contact unlocks used</dt>
            <dd className="font-medium text-gray-800">{policy.unlocksUsed} of {unlockLimit}</dd>
          </div>
          {Number(row.refundedAmount) > 0 && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-gray-500">Already refunded</dt>
              <dd className="font-medium text-gray-800">{rupees(row.refundedAmount)}</dd>
            </div>
          )}
        </dl>

        {policy.suggested !== null && (
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 mb-3 text-xs text-gray-700" data-testid="refund-policy">
            <p className="text-sm font-semibold text-gray-900">Policy suggests {rupees(policy.suggested)}</p>
            {policy.withinWindow ? (
              <p className="mt-1">
                Within seven days of paying: a full refund
                {policy.unlocksUsed > 0
                  ? `, less ${policy.unlocksUsed} ${policy.unlocksUsed === 1 ? 'unlock' : 'unlocks'} at ₹199 for three (${rupees(policy.deduction)}): ${rupees(left)} − ${rupees(policy.deduction)}.`
                  : '. No contact unlocks used.'}
              </p>
            ) : (
              <p className="mt-1 text-amber-800">
                Paid more than seven days ago. The policy refunds nothing after that, unless we removed a feature they paid for, the service was unusable for a sustained period, or they were charged twice.
              </p>
            )}
          </div>
        )}

        <label htmlFor="refund-amount" className="block text-sm font-medium text-gray-700 mb-1">Amount to refund (₹)</label>
        <input
          id="refund-amount"
          type="number"
          min="1"
          max={left}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
        />
        <label htmlFor="refund-reason" className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
        <textarea
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. within the 7-day window, duplicate payment"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
        />
        {problem && <p role="status" className="text-xs text-amber-800 mb-3">{problem}</p>}
        <div className="flex gap-3 mt-2">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || Boolean(problem)}
            className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {busy ? 'Refunding…' : `Refund ₹${Number.isFinite(amt) && amt > 0 ? amt.toLocaleString('en-IN') : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
