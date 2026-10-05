import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import apiClient from '../../api/apiClient';

/**
 * Monthly rep payouts, done by hand on purpose (no payout API): review who is
 * payable, prepare the batch, download the bank upload file, pay from the bank,
 * then mark each row paid with its UTR. Every step is audited server-side.
 */

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const errMsg = (err, fallback) => err.response?.data?.error?.message || err.response?.data?.message || fallback;

const REASONS = {
  inactive_account: 'Account inactive',
  no_details: 'No payout details',
  details_unreadable: 'Details need re-entering',
  details_changed_recently: 'Details changed in the last 48h',
  nothing_payable: 'Nothing payable yet',
  below_minimum: 'Below the minimum',
  changed_during_run: 'Balance changed during the run',
};

const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
const th = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500';
const td = 'px-4 py-3 text-sm text-gray-800';

export default function AdminPayouts() {
  const [overview, setOverview] = useState(null);
  const [queued, setQueued] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [utrs, setUtrs] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [o, q] = await Promise.all([
        apiClient.get('/admin/marketing-payouts/overview'),
        apiClient.get('/admin/marketing-payouts/queued'),
      ]);
      setOverview(o.data);
      setQueued(q.data.payouts || []);
      setForm((f) => f || {
        holdDays: o.data.settings.holdDays, minPayout: o.data.settings.minPayout, tdsRate: o.data.settings.tdsRate,
      });
    } catch (err) {
      setError(errMsg(err, 'Could not load payouts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiClient.put('/admin/marketing-payout-settings', {
        holdDays: Number(form.holdDays), minPayout: Number(form.minPayout), tdsRate: Number(form.tdsRate),
      });
      toast.success('Payout rules saved');
      await load();
    } catch (err) {
      toast.error(errMsg(err, 'Could not save'));
    } finally {
      setSavingSettings(false);
    }
  };

  const prepare = async () => {
    const { eligibleReps, payable } = overview.totals;
    if (!window.confirm(`Queue payouts for ${eligibleReps} rep${eligibleReps === 1 ? '' : 's'} totalling ${inr(payable)}?\n\nNothing is sent. This creates the to-do list you pay from your bank.`)) return;
    setBusy(true);
    try {
      const res = await apiClient.post('/admin/marketing-payouts/prepare', {});
      toast.success(`${res.data.created.length} payout${res.data.created.length === 1 ? '' : 's'} queued`);
      await load();
    } catch (err) {
      toast.error(errMsg(err, 'Could not prepare payouts'));
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = async () => {
    try {
      const res = await apiClient.get('/admin/marketing-payouts/queued.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rep-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errMsg(err, 'Could not download the file'));
    }
  };

  const markPaid = async (rows) => {
    setBusy(true);
    try {
      const res = await apiClient.post('/admin/marketing-payouts/mark-paid', {
        items: rows.map((r) => ({ id: r.payoutId, ...(utrs[r.payoutId]?.trim() ? { reference: utrs[r.payoutId].trim() } : {}) })),
      });
      const failed = res.data.results.filter((r) => !r.ok);
      toast.success(`${res.data.results.length - failed.length} marked paid`);
      if (failed.length) toast.error(`${failed.length} could not be marked paid`);
      setUtrs({});
      await load();
    } catch (err) {
      toast.error(errMsg(err, 'Could not mark paid'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !overview) {
    return <div className="p-6"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" aria-busy="true" /></div>;
  }
  if (error && !overview) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-lg mb-3">{error}</div>
        <button onClick={load} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Try again</button>
      </div>
    );
  }

  const reps = overview.reps;
  const queuedTotal = queued.reduce((n, p) => n + p.net, 0);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rep payouts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Prepare the month&apos;s batch, pay from your bank, then mark each row paid with its UTR.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Rules</h2>
        <p className="text-sm text-gray-500 mb-4">
          Commission is payable after the refund window. Deduct TDS only at the rate your CA gives you; 0 turns it off.
        </p>
        <form onSubmit={saveSettings} className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="s-hold">Hold period (days)</label>
            <input id="s-hold" type="number" min="0" max="90" className={input} value={form?.holdDays ?? ''} onChange={(e) => setForm({ ...form, holdDays: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="s-min">Minimum payout (₹)</label>
            <input id="s-min" type="number" min="0" className={input} value={form?.minPayout ?? ''} onChange={(e) => setForm({ ...form, minPayout: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="s-tds">TDS rate (%)</label>
            <input id="s-tds" type="number" min="0" max="30" step="0.1" className={input} value={form?.tdsRate ?? ''} onChange={(e) => setForm({ ...form, tdsRate: e.target.value })} />
          </div>
          <button type="submit" disabled={savingSettings} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40">
            {savingSettings ? 'Saving…' : 'Save rules'}
          </button>
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Who is payable</h2>
            <p className="text-sm text-gray-500">
              {overview.totals.eligibleReps} ready · {inr(overview.totals.payable)} to pay
            </p>
          </div>
          <button
            onClick={prepare}
            disabled={busy || overview.totals.eligibleReps === 0}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40"
          >
            Prepare payouts
          </button>
        </div>
        {reps.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No marketing reps yet.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Rep</th>
                  <th className={`${th} text-right`}>Earned</th>
                  <th className={`${th} text-right`}>Paid</th>
                  <th className={`${th} text-right`}>Queued</th>
                  <th className={`${th} text-right`}>Payable</th>
                  <th className={`${th} text-right`}>In window</th>
                  <th className={th}>Paid via</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reps.map((r) => (
                  <tr key={r.userId}>
                    <td className={td}>
                      <Link to={`/admin/marketing-users/${r.userId}`} className="font-medium text-primary-700 hover:underline">{r.name}</Link>
                      <div className="text-xs text-gray-500">{r.email}</div>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{inr(r.earned)}</td>
                    <td className={`${td} text-right tabular-nums`}>{inr(r.paidOut)}</td>
                    <td className={`${td} text-right tabular-nums`}>{inr(r.pending)}</td>
                    <td className={`${td} text-right tabular-nums font-semibold`}>{inr(r.payable)}</td>
                    <td className={`${td} text-right tabular-nums`}>{inr(r.inHold)}</td>
                    <td className={td}>{r.detailsMethod === 'upi' ? 'UPI' : r.detailsMethod === 'bank' ? 'Bank' : '-'}</td>
                    <td className={td}>
                      {r.eligible
                        ? <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Ready</span>
                        : <span className="text-xs text-gray-500">{REASONS[r.reason] || r.reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Queued for transfer</h2>
            <p className="text-sm text-gray-500">
              {queued.length} payout{queued.length === 1 ? '' : 's'} · {inr(queuedTotal)} to transfer after TDS
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={downloadCsv} disabled={!queued.length} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-40">
              <FiDownload size={14} /> Download bank file
            </button>
            <button
              onClick={() => window.confirm(`Mark all ${queued.length} as paid?`) && markPaid(queued)}
              disabled={busy || !queued.length}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40"
            >
              Mark all paid
            </button>
          </div>
        </div>
        {queued.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-xl">
            Nothing queued. Prepare payouts above to create this month&apos;s list.
          </p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Rep</th>
                  <th className={th}>To</th>
                  <th className={`${th} text-right`}>Gross</th>
                  <th className={`${th} text-right`}>TDS</th>
                  <th className={`${th} text-right`}>Transfer</th>
                  <th className={th}>Bank reference (UTR)</th>
                  <th className={`${th} text-right`} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {queued.map((p) => (
                  <tr key={p.payoutId}>
                    <td className={td}>{p.repName}<div className="text-xs text-gray-500">{p.repEmail}</div></td>
                    <td className={td}>
                      {p.detailsMissing ? <span className="text-xs font-semibold text-red-600">No details, do not pay</span> : p.destination}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{inr(p.gross)}</td>
                    <td className={`${td} text-right tabular-nums`}>{inr(p.tds)}</td>
                    <td className={`${td} text-right tabular-nums font-semibold`}>{inr(p.net)}</td>
                    <td className={td}>
                      <input
                        className={`${input} font-mono`} placeholder="optional"
                        value={utrs[p.payoutId] || ''}
                        onChange={(e) => setUtrs((u) => ({ ...u, [p.payoutId]: e.target.value }))}
                        aria-label={`UTR for ${p.repName}`}
                      />
                    </td>
                    <td className={`${td} text-right`}>
                      <button onClick={() => markPaid([p])} disabled={busy} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                        Mark paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
