import { useState, useEffect, useCallback } from 'react';
import { FiBriefcase, FiCheckCircle } from 'react-icons/fi';
import apiClient from '../../api/apiClient';

/**
 * Where the rep wants to be paid. The server stores it encrypted and only ever
 * sends it back masked, so this form can overwrite but never reveal the full
 * account number or PAN. Saving always asks for the whole set again.
 */

const field = 'w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary-500';
const label = 'block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1';
const EMPTY = { method: 'upi', upiId: '', accountHolder: '', accountNumber: '', ifsc: '', pan: '' };

export default function PayoutDetailsCard({ onSaved }) {
  const [saved, setSaved] = useState(undefined); // undefined = loading, null = none
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await apiClient.get('/marketing/payout-details');
      setSaved(res.data.details || null);
      if (!res.data.details) setEditing(true);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.put('/marketing/payout-details', form);
      setSaved(res.data.details);
      setForm(EMPTY);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Could not save your payout details');
    } finally {
      setSaving(false);
    }
  };

  const shell = 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6';

  if (loadError) {
    return (
      <section className={shell}>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">We could not load your payout details.</p>
        <button onClick={load} className="mt-3 px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
          Try again
        </button>
      </section>
    );
  }
  if (saved === undefined) return <section className={`${shell} h-40 animate-pulse`} aria-busy="true" />;

  return (
    <section className={shell}>
      <div className="flex items-center gap-3 mb-1">
        <FiBriefcase size={20} className="text-neutral-500 dark:text-neutral-400" />
        <h2 className="text-xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Where to pay you</h2>
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
        Commission is paid by bank transfer or UPI. Your PAN is needed for tax. Details are stored encrypted and shown here masked.
        If you change them, payouts pause for 48 hours as a safety check.
      </p>

      {saved && !editing && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-neutral-800 dark:text-neutral-100 space-y-0.5">
            <p className="flex items-center gap-2 font-medium">
              <FiCheckCircle size={16} className="text-green-600" />
              {saved.method === 'upi' ? 'UPI' : 'Bank account'} on file
            </p>
            {saved.unreadable ? (
              <p className="text-neutral-500 dark:text-neutral-400">These details need to be entered again.</p>
            ) : saved.method === 'upi' ? (
              <p className="text-neutral-600 dark:text-neutral-300">{saved.upiId}</p>
            ) : (
              <p className="text-neutral-600 dark:text-neutral-300">
                {saved.accountHolder} · {saved.accountNumber} · {saved.ifsc}
              </p>
            )}
            {saved.pan && <p className="text-neutral-500 dark:text-neutral-400">PAN {saved.pan}</p>}
          </div>
          <button
            onClick={() => { setEditing(true); setError(''); }}
            className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Change
          </button>
        </div>
      )}

      {editing && (
        <form onSubmit={submit} className="space-y-4">
          <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden text-sm" role="radiogroup" aria-label="Payout method">
            {[['upi', 'UPI'], ['bank', 'Bank account']].map(([value, text]) => (
              <button
                key={value} type="button" role="radio" aria-checked={form.method === value}
                onClick={() => set('method', value)}
                className={`px-4 py-2 ${form.method === value ? 'bg-primary-600 text-white' : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200'}`}
              >
                {text}
              </button>
            ))}
          </div>

          {form.method === 'upi' ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="pd-upi">UPI ID</label>
                <input id="pd-upi" className={field} value={form.upiId} onChange={(e) => set('upiId', e.target.value)} placeholder="name@bank" autoComplete="off" required />
              </div>
              <div>
                <label className={label} htmlFor="pd-name-upi">Name on the account (optional)</label>
                <input id="pd-name-upi" className={field} value={form.accountHolder} onChange={(e) => set('accountHolder', e.target.value)} autoComplete="off" />
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="pd-name">Account holder name</label>
                <input id="pd-name" className={field} value={form.accountHolder} onChange={(e) => set('accountHolder', e.target.value)} autoComplete="off" required />
              </div>
              <div>
                <label className={label} htmlFor="pd-acct">Account number</label>
                <input id="pd-acct" className={field} inputMode="numeric" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} autoComplete="off" required />
              </div>
              <div>
                <label className={label} htmlFor="pd-ifsc">IFSC code</label>
                <input id="pd-ifsc" className={`${field} uppercase`} value={form.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} placeholder="HDFC0001234" autoComplete="off" required />
              </div>
            </div>
          )}

          <div className="sm:w-1/2">
            <label className={label} htmlFor="pd-pan">PAN</label>
            <input id="pd-pan" className={`${field} uppercase`} value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} autoComplete="off" required />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40">
              {saving ? 'Saving…' : 'Save details'}
            </button>
            {saved && (
              <button type="button" onClick={() => { setEditing(false); setForm(EMPTY); setError(''); }} className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
