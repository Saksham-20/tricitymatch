import { useState } from 'react';
import { Plus } from 'lucide-react';

const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

/**
 * Records a payout against a rep. The server refuses an amount above the
 * outstanding balance unless allowOverpay is set, so the checkbox is the
 * deliberate escape hatch for a bonus or a correction — the guard exists to
 * catch a typed extra zero, not to overrule the admin.
 */
export default function RecordPayoutForm({ outstanding = 0, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    amount: '', method: 'bank_transfer', reference: '', note: '',
    status: 'paid', allowOverpay: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit({ ...form, amount: Number(form.amount) });
      setForm({ amount: '', method: 'bank_transfer', reference: '', note: '', status: 'paid', allowOverpay: false });
      setOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to record payout');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  if (!open) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={16} /> Record payout
        </button>
        {outstanding > 0 && (
          <span className="text-sm text-gray-600">
            ₹{Number(outstanding).toLocaleString('en-IN')} outstanding
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
          <input
            type="number" min="1" step="1" required autoFocus
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder={outstanding ? String(outstanding) : '0'}
            className={input}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
          <select value={form.method} onChange={(e) => set('method', e.target.value)} className={input}>
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Reference</label>
          <input
            type="text" value={form.reference}
            onChange={(e) => set('reference', e.target.value)}
            placeholder="UTR / txn id"
            className={input}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className={input}>
            <option value="paid">Paid</option>
            <option value="pending">Queued</option>
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
        <input
          type="text" value={form.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="e.g. August commission"
          className={input}
        />
      </div>

      <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.allowOverpay}
          onChange={(e) => set('allowOverpay', e.target.checked)}
        />
        Allow more than the outstanding balance (bonus or correction)
      </label>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={saving || !form.amount}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40"
        >
          {saving ? 'Recording…' : 'Record payout'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
