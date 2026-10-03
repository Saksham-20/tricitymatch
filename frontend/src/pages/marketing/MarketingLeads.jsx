import { useState, useEffect, useCallback } from 'react';
import { Filter, RefreshCw, CheckCircle2, Clock, UserPlus, X } from 'lucide-react';
import apiClient from '../../api/apiClient';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import MemberReportTable from '../../components/marketing/MemberReportTable';
import ReportSummary from '../../components/marketing/ReportSummary';

export default function MarketingLeads() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', paymentStatus: '' });
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '', city: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addedName, setAddedName] = useState('');

  const fetchReport = useCallback(async (opts = {}) => {
    const { quiet = false } = opts;
    try {
      if (quiet) setRefreshing(true); else setLoading(true);
      const params = new URLSearchParams({ page, limit: 25 });
      if (filters.status) params.append('status', filters.status);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
      const res = await apiClient.get(`/marketing/report?${params}`);
      setReport(res.data);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Members sign up and pay while this page sits open, so keep it current
  // without anyone having to reload.
  useAutoRefresh(() => fetchReport({ quiet: true }), 20000);

  const handleStatusChange = async (leadId, newStatus) => {
    setUpdating(leadId);
    try {
      await apiClient.put(`/marketing/leads/${leadId}/status`, { status: newStatus });
      setReport(prev => prev && ({
        ...prev,
        members: prev.members.map(m => (m.leadId === leadId ? { ...m, leadStatus: newStatus } : m)),
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    try {
      await apiClient.post('/marketing/leads', {
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        email: addForm.email.trim() || undefined,
        city: addForm.city.trim() || undefined,
      });
      setAddedName(addForm.name.trim());
      setAddForm({ name: '', phone: '', email: '', city: '' });
      setPage(1);
      fetchReport({ quiet: true });
    } catch (err) {
      const data = err.response?.data;
      setAddError(data?.error?.details?.[0]?.message || data?.error?.message || data?.message || 'Could not add this lead');
    } finally {
      setAdding(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const selectCls =
    'border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-3 py-2 rounded-lg text-sm';

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-100">My Members</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Everyone who joined through your referral links — who signed up, and who paid.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchReport({ quiet: true })}
            className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Refresh'}
          </button>
          <button
            onClick={() => { setShowAdd((v) => !v); setAddedName(''); setAddError(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            {showAdd ? <X size={16} /> : <UserPlus size={16} />}
            {showAdd ? 'Close' : 'Add a lead'}
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAddLead} className="bg-white dark:bg-neutral-900 border border-primary-200 dark:border-primary-900 p-4 rounded-xl mb-6">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Someone you already know</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 mb-4">
            When they sign up with this number or email within 60 days, they are credited to you — even without a code.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name *" className={selectCls} />
            <input required value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Mobile number *" inputMode="numeric" className={selectCls} />
            <input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email (optional)" className={selectCls} />
            <input value={addForm.city} onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))} placeholder="City (optional)" className={selectCls} />
          </div>
          {addError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{addError}</p>}
          {addedName && !addError && <p className="text-sm text-green-700 dark:text-green-400 mt-3">Added {addedName}. Add another, or close.</p>}
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={adding} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {adding ? 'Adding…' : 'Add lead'}
            </button>
          </div>
        </form>
      )}

      {report?.summary && <ReportSummary summary={report.summary} className="mb-6" />}

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 rounded-xl mb-6">
        <div className="flex items-center gap-2 mb-4 text-neutral-900 dark:text-neutral-100">
          <Filter size={18} />
          <h2 className="text-base font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className={selectCls}>
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <select value={filters.paymentStatus} onChange={(e) => handleFilterChange('paymentStatus', e.target.value)} className={selectCls}>
            <option value="">All Payment Status</option>
            <option value="none">Not paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 justify-center py-16 text-neutral-500 dark:text-neutral-400">
          <Clock size={18} /> Loading your members…
        </div>
      ) : !report?.members?.length ? (
        <div className="text-center py-16 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <CheckCircle2 className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" size={32} />
          <p className="text-neutral-700 dark:text-neutral-200 font-medium">No members yet</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Share a referral link — every signup through it appears here automatically.
          </p>
        </div>
      ) : (
        <>
          <MemberReportTable
            members={report.members}
            onStatusChange={handleStatusChange}
            updatingId={updating}
          />
          {report.pagination?.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: report.pagination.pages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    page === p
                      ? 'bg-primary-600 text-white'
                      : 'border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
