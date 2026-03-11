import React, { useEffect, useState, useCallback } from 'react';
import { getReports, updateReport } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiSearch, FiEye } from 'react-icons/fi';

const TAB_OPTIONS = ['pending', 'reviewing', 'resolved', 'dismissed', 'all'];

const StatusBadge = ({ status }) => {
  const map = {
    pending:   'bg-amber-100 text-amber-700',
    reviewing: 'bg-blue-100 text-blue-700',
    resolved:  'bg-green-100 text-green-700',
    dismissed: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
};

export default function AdminReports() {
  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(null);
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmit]   = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab !== 'all') params.status = activeTab;
      if (search) params.search = search;
      const res = await getReports(params);
      setReports(res.data.reports || res.data || []);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (r) => {
    setModal(r);
    setNotes(r.adminNotes || '');
  };

  const handleAction = async (newStatus) => {
    if (!modal) return;
    setSubmit(true);
    try {
      await updateReport(modal.id, { status: newStatus, adminNotes: notes });
      toast.success(`Report marked as ${newStatus}`);
      setModal(null);
      fetchData();
    } catch {
      toast.error('Action failed');
    } finally {
      setSubmit(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review and manage user-submitted reports</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TAB_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                activeTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reporter</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reported</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-600" />
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No reports found</td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{r.Reporter?.firstName} {r.Reporter?.lastName}</p>
                      <p className="text-xs text-gray-400">{r.Reporter?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{r.ReportedUser?.firstName} {r.ReportedUser?.lastName}</p>
                      <p className="text-xs text-gray-400">{r.ReportedUser?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize text-xs">{r.reason?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openModal(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-rose-100 text-gray-600 hover:text-rose-700 text-xs font-medium transition-colors"
                      >
                        <FiEye className="w-3.5 h-3.5" /> Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Review Report</h3>
            <div className="text-sm text-gray-500 mb-4 space-y-1">
              <p><span className="font-medium text-gray-700">From:</span> {modal.Reporter?.firstName} {modal.Reporter?.lastName}</p>
              <p><span className="font-medium text-gray-700">Against:</span> {modal.ReportedUser?.firstName} {modal.ReportedUser?.lastName}</p>
              <p><span className="font-medium text-gray-700">Reason:</span> {modal.reason?.replace(/_/g, ' ')}</p>
              {modal.description && <p className="bg-gray-50 rounded-lg px-3 py-2 text-gray-600">{modal.description}</p>}
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">Admin Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this report…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
            />

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setModal(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
              <button onClick={() => handleAction('reviewing')} disabled={submitting} className="px-4 py-2.5 rounded-xl bg-blue-100 text-blue-700 text-sm font-medium disabled:opacity-60">
                Mark Reviewing
              </button>
              <button onClick={() => handleAction('dismissed')} disabled={submitting} className="px-4 py-2.5 rounded-xl bg-gray-200 text-gray-700 text-sm font-medium disabled:opacity-60">
                Dismiss
              </button>
              <button onClick={() => handleAction('resolved')} disabled={submitting} className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-60">
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
