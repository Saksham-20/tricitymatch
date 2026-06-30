import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiDownload, FiCreditCard, FiTrendingUp, FiCalendar } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { Link } from 'react-router-dom';

// Plan chip — on-system (burgundy/gold tiers, neutral free)
const PLAN_LABELS = {
  free: 'Free',
  basic_premium: 'Basic Premium',
  premium_plus: 'Premium Plus',
  vip: 'VIP',
};
const planLabel = (p) => PLAN_LABELS[p] || (p || '—').replace(/_/g, ' ');

const PlanBadge = ({ plan }) => {
  const meta = {
    free:          { label: 'Free',          cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
    basic_premium: { label: 'Basic Premium', cls: 'bg-primary-50 text-primary-600 border-primary-100' },
    premium_plus:  { label: 'Premium Plus',  cls: 'bg-primary-100 text-primary-700 border-primary-200' },
    vip:           { label: 'VIP',           cls: 'bg-gold-50 text-gold-700 border-gold-200' },
  };
  const m = meta[plan] || { label: plan, cls: 'bg-neutral-100 text-neutral-500 border-neutral-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${m.cls}`}>
      {m.label}
    </span>
  );
};

// Status chip — semantic
const StatusBadge = ({ status }) => {
  const map = {
    active:    'bg-success-50 text-success border-success-100',
    expired:   'bg-neutral-100 text-neutral-600 border-neutral-200',
    cancelled: 'bg-destructive-light text-destructive border-destructive/20',
    pending:   'bg-warning-light text-warning border-warning/20',
    failed:    'bg-destructive-light text-destructive border-destructive/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize border ${map[status] || 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
      {status}
    </span>
  );
};

const RowSkeleton = () => (
  <tr className="border-b border-neutral-50 dark:border-neutral-800">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 w-16 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
      </td>
    ))}
  </tr>
);

export default function PaymentHistory() {
  const [subscriptions, setSubs] = useState([]);
  const [loading, setLoading]    = useState(true);

  useEffect(() => {
    api.get('/subscription/history')
      .then((r) => setSubs(r.data.subscriptions || r.data || []))
      .catch(() => toast.error('Failed to load payment history'))
      .finally(() => setLoading(false));
  }, []);

  const downloadInvoice = async (subId) => {
    try {
      const res = await api.get(`/subscription/invoice/${subId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${subId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice');
    }
  };

  // Summary derived from rows
  const totalSpent = subscriptions.reduce((sum, s) => sum + (Number(s.paymentAmount) || 0), 0);
  const activeSub = subscriptions.find((s) => s.status === 'active');

  const summary = [
    { label: 'Total Spent', value: `₹${totalSpent.toLocaleString('en-IN')}`, icon: FiTrendingUp },
    { label: 'Active Plan', value: activeSub ? planLabel(activeSub.planType) : 'None', icon: FaCrown },
    { label: 'Renews On', value: activeSub?.endDate ? new Date(activeSub.endDate).toLocaleDateString('en-IN') : '—', icon: FiCalendar },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pt-20 pb-24 md:pb-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FiCreditCard className="w-6 h-6 text-primary-500" />
              Payment History
            </h1>
            <p className="text-neutral-500 text-sm mt-0.5">Your subscription history and invoices</p>
          </div>
          <Link to="/subscription" className="btn-primary px-4 py-2 text-sm whitespace-nowrap">
            Upgrade Plan
          </Link>
        </div>

        {/* Summary cards */}
        {!loading && subscriptions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {summary.map((s) => (
              <div key={s.label} className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-5 h-5 text-primary-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-400 font-medium">{s.label}</p>
                  <p className={`font-display text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate ${s.cap ? 'capitalize' : ''}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-card border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>{[0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}</tbody>
            </table>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-12 text-center shadow-card border border-neutral-100 dark:border-neutral-800">
            <div className="w-14 h-14 rounded-full bg-gold-50 flex items-center justify-center mx-auto mb-4">
              <FaCrown className="w-6 h-6 text-gold-500" />
            </div>
            <p className="text-neutral-800 dark:text-neutral-200 font-semibold">No payment history yet</p>
            <p className="text-neutral-400 text-sm mt-1">Upgrade to a paid plan to see your transactions here.</p>
            <Link to="/subscription" className="btn-primary inline-flex mt-5 px-6 py-2.5 text-sm">
              View Plans
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-card border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800">
                    {['Plan', 'Status', 'Amount', 'Start Date', 'End Date'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                    ))}
                    <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="px-4 py-3"><PlanBadge plan={s.planType} /></td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 font-medium text-neutral-800 dark:text-neutral-200">
                        {s.paymentAmount ? `₹${Number(s.paymentAmount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {s.startDate ? new Date(s.startDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {s.endDate ? new Date(s.endDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.paymentId && (
                          <button
                            onClick={() => downloadInvoice(s.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-medium transition-colors"
                          >
                            <FiDownload className="w-3.5 h-3.5" /> PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
