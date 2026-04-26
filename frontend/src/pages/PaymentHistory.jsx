import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiDownload, FiCreditCard } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const PlanBadge = ({ plan }) => {
  const map = {
    free:    'bg-gray-100 text-gray-600',
    basic:   'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-700',
    gold:    'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[plan] || 'bg-gray-100 text-gray-500'}`}>
      {plan}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    active:   'bg-green-100 text-green-700',
    expired:  'bg-gray-100 text-gray-600',
    cancelled:'bg-red-100 text-red-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
};

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

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-24 md:pb-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <FiCreditCard className="w-6 h-6 text-primary-500" />
              Payment History
            </h1>
            <p className="text-neutral-500 text-sm mt-0.5">Your subscription history and invoices</p>
          </div>
          <Link
            to="/subscription"
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: '#8B2346' }}
          >
            Upgrade Plan
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" style={{ borderBottomColor: '#8B2346' }} />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-neutral-100">
            <FaCrown className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-neutral-700 font-semibold">No payment history yet</p>
            <p className="text-neutral-400 text-sm mt-1">Upgrade to a paid plan to see your transactions here.</p>
            <Link
              to="/subscription"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: '#8B2346' }}
            >
              View Plans
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Start Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">End Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3"><PlanBadge plan={s.planType} /></td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 font-medium text-neutral-800">
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-medium transition-colors"
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
