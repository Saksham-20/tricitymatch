import toast from 'react-hot-toast';
import { FiCopy } from 'react-icons/fi';
import planLabel from '../../utils/planLabel';
import copyText from '../../utils/copyText';
import { formatDate, formatDateTime } from '../../utils/formatDate';

/**
 * A member's plan history with the payment facts support is asked about: when
 * the money arrived, the Razorpay ids to look it up by, and any refund or
 * dispute on it. "I paid but I'm not premium" and "is this inside the seven-day
 * refund window?" are both answered from here.
 */

const DISPUTE_LABEL = { open: 'open', won: 'won', lost: 'lost', closed: 'closed' };

function CopyId({ label, value, display }) {
  const copy = async () => {
    if (await copyText(value)) toast.success(`${label} copied`);
    else toast.error('Could not copy');
  };
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="font-mono text-gray-700 break-all">{display || value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        title={`Copy ${label.toLowerCase()}`}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800 flex-shrink-0"
      >
        <FiCopy className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

export default function PlanHistoryList({ rows, canRefund, onRefund }) {
  return (
    <ul className="space-y-2">
      {rows.map((h) => {
        const paid = Boolean(h.razorpayPaymentId) && Number(h.amount) > 0;
        const refunded = Number(h.refundedAmount) || 0;
        const googlePlay = h.paymentRail === 'google_play' || h.razorpaySignature === 'GOOGLE_PLAY';
        // An order id with no payment is a checkout the member closed; a staff grant has neither.
        // A Google Play purchase stores its token in razorpayPaymentId;
        // those are refunded from the Play Console, not here.
        const refundable = paid && !googlePlay && !h.refundedAt && refunded < Number(h.amount);
        const paidAt = h.paidAt || (h.razorpayPaymentId ? h.startDate : null);
        const ended = h.endDate && new Date(h.endDate) < new Date();
        return (
          <li key={h.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-500">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="font-semibold text-gray-800">{planLabel(h.planType)}</span>
              <span>{h.status}</span>
              <span>{paid ? `₹${Number(h.amount).toLocaleString('en-IN')}` : h.razorpayOrderId ? 'not paid' : (Number(h.amount) > 0 ? 'granted' : '—')}</span>
              <span>{h.endDate ? `${ended ? 'Ended' : 'Ends'} ${formatDate(h.endDate)}` : '—'}</span>
              {refundable && canRefund && (
                <button
                  type="button"
                  onClick={() => onRefund(h)}
                  className="inline-flex items-center min-h-[32px] px-2 rounded-lg text-red-700 font-medium hover:bg-red-50"
                >
                  Refund
                </button>
              )}
            </div>

            {(h.razorpayPaymentId || h.razorpayOrderId) && (
              <div className="mt-1.5 space-y-0.5">
                {paidAt && <p>Paid {formatDateTime(paidAt)}{googlePlay ? ' on Google Play' : ''}</p>}
                {h.razorpayPaymentId && (
                  <p className="flex flex-wrap items-center gap-x-1">
                    <span>{googlePlay ? 'Purchase token' : 'Payment'}</span>
                    <CopyId
                      label={googlePlay ? 'Purchase token' : 'Payment id'}
                      value={h.razorpayPaymentId}
                      display={googlePlay && h.razorpayPaymentId.length > 16 ? `${h.razorpayPaymentId.slice(0, 12)}…` : undefined}
                    />
                  </p>
                )}
                {h.razorpayOrderId && (
                  <p className="flex flex-wrap items-center gap-x-1">
                    <span>Order</span>
                    <CopyId label="Order id" value={h.razorpayOrderId} />
                  </p>
                )}
              </div>
            )}

            {(h.refundedAt || refunded > 0 || h.disputeStatus) && (
              <p className="mt-1 flex flex-wrap gap-x-2">
                {(h.refundedAt || refunded > 0) && (
                  <>
                    <span className="text-red-700 font-medium">{h.refundedAt ? 'Refunded in full' : `Refunded ₹${refunded.toLocaleString('en-IN')}`}</span>
                    {h.lastRefundAt && <span>on {formatDate(h.lastRefundAt)}</span>}
                  </>
                )}
                {h.disputeStatus && (
                  <span className="text-amber-800 font-medium">Payment dispute: {DISPUTE_LABEL[h.disputeStatus] || h.disputeStatus}</span>
                )}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
