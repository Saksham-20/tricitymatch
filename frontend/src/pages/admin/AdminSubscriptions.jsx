import React, { useEffect, useState, useCallback } from 'react';
import { getUsers, updateSubscription } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiSearch, FiEdit2, FiDownload } from 'react-icons/fi';
import { adminGetInvoice } from '../../api/adminApi';

const PLAN_OPTIONS = ['free', 'basic', 'premium', 'gold'];

const PlanBadge = ({ plan }) => {
  const map = {
    free:    'bg-gray-100 text-gray-600',
    basic:   'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-700',
    gold:    'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[plan] || 'bg-gray-100 text-gray-500'}`}>
      {plan}
    </span>
  );
};

export default function AdminSubscriptions() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotal]    = useState(1);
  const [overrideModal, setModal] = useState(null);
  const [newPlan, setNewPlan]     = useState('');
  const [submitting, setSubmit]   = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers({ page, limit: 20, search: search || undefined });
      setUsers(res.data.users || []);
      setTotal(res.data.totalPages || 1);
    } catch {
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openOverride = (user) => {
    setModal(user);
    setNewPlan(user.Subscription?.planType || 'free');
  };

  const handleOverride = async () => {
    if (!overrideModal) return;
    setSubmit(true);
    try {
      await updateSubscription(overrideModal.id, { planType: newPlan });
      toast.success('Plan updated');
      setModal(null);
      fetchData();
    } catch {
      toast.error('Update failed');
    } finally {
      setSubmit(false);
    }
  };

  const downloadInvoice = async (subscriptionId) => {
    try {
      const res = await adminGetInvoice(subscriptionId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${subscriptionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage user subscription plans</p>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Start Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">End Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-600" />
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={u.Subscription?.planType || 'free'} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{u.Subscription?.status || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.Subscription?.startDate ? new Date(u.Subscription.startDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.Subscription?.endDate ? new Date(u.Subscription.endDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.Subscription?.paymentAmount ? `₹${Number(u.Subscription.paymentAmount).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.Subscription && (
                          <button
                            onClick={() => downloadInvoice(u.Subscription.id)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                            title="Download Invoice"
                          >
                            <FiDownload className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openOverride(u)}
                          className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
                          title="Override Plan"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {/* Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Override Plan</h3>
            <p className="text-sm text-gray-500 mb-4">{overrideModal.firstName} {overrideModal.lastName}</p>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
            >
              {PLAN_OPTIONS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
              <button onClick={handleOverride} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-sm font-medium disabled:opacity-60">
                {submitting ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
