import { useState, useEffect, useCallback } from 'react';
import { FiFilter, FiRefreshCw, FiCheckCircle, FiUserPlus, FiX, FiSearch } from 'react-icons/fi';
import { useDebounce } from '../../hooks/useDebounce';
import apiClient from '../../api/apiClient';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import Skeleton from '../../components/ui/Skeleton';
import MemberReportTable from '../../components/marketing/MemberReportTable';
import ReportSummary from '../../components/marketing/ReportSummary';

export default function MarketingLeads() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  // `paid` reads the member's real payments; the old paymentStatus filter read a
  // copied flag that missed payments activated by the webhook.
  const [filters, setFilters] = useState({ status: '', paid: '', signedUp: '' });
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
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
      if (filters.paid) params.append('paid', filters.paid);
      if (filters.signedUp) params.append('signedUp', filters.signedUp);
      if (search) params.append('search', search);
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
  }, [page, filters, search]);

  useEffect(() => { fetchReport(); }, [fetchReport]);
  useEffect(() => { setPage(1); }, [search]);
  const filtering = Boolean(search || filters.status || filters.paid || filters.signedUp);

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
    'border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-3 py-2 rounded-lg text-base';

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-100">My Members</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Everyone who joined through your referral links: who signed up, and who paid.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchReport({ quiet: true })}
            className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          >
            <FiRefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Refresh'}
          </button>
          <button
            onClick={() => { setShowAdd((v) => !v); setAddedName(''); setAddError(''); }}
            className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            {showAdd ? <FiX size={16} /> : <FiUserPlus size={16} />}
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
            {[
              { key: 'name', label: 'Full name', required: true, autoComplete: 'name' },
              { key: 'phone', label: 'Mobile number', required: true, type: 'tel', inputMode: 'numeric', autoComplete: 'tel-national', maxLength: 14, hint: '10 digits' },
              { key: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
              { key: 'city', label: 'City', autoComplete: 'address-level2' },
            ].map(({ key, label, required, hint, ...rest }) => (
              <div key={key}>
                <label htmlFor={`lead-${key}`} className="block text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                  {label}{' '}
                  <span className="font-normal text-neutral-500 dark:text-neutral-400">{required ? '(required)' : '(optional)'}</span>
                </label>
                <input
                  id={`lead-${key}`}
                  required={required}
                  value={addForm[key]}
                  onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={hint}
                  className={`${selectCls} w-full`}
                  {...rest}
                />
              </div>
            ))}
          </div>
          {addError && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-3">{addError}</p>}
          {addedName && !addError && <p role="status" className="text-sm text-green-700 dark:text-green-400 mt-3">Added {addedName}. Add another, or close.</p>}
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
          <FiFilter size={18} />
          <h2 className="text-base font-semibold">Filters</h2>
        </div>
        <div className="relative mb-3">
          <label htmlFor="my-members-search" className="sr-only">Search your members</label>
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} aria-hidden="true" />
          <input
            id="my-members-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone, email or code"
            className={`${selectCls} w-full min-h-[44px] pl-9`}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select aria-label="Filter by status" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className={`${selectCls} min-h-[44px]`}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <select aria-label="Filter by signed up" value={filters.signedUp} onChange={(e) => handleFilterChange('signedUp', e.target.value)} className={`${selectCls} min-h-[44px]`}>
            <option value="">Signed up or not</option>
            <option value="yes">Signed up</option>
            <option value="no">Not signed up yet</option>
          </select>
          <select aria-label="Filter by payment" value={filters.paid} onChange={(e) => handleFilterChange('paid', e.target.value)} className={`${selectCls} min-h-[44px]`}>
            <option value="">Paid or not</option>
            <option value="no">Not paid</option>
            <option value="yes">Paid</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <div className="bg-neutral-50 dark:bg-neutral-800/60 px-4 py-3">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : !report?.members?.length ? (
        <div className="text-center py-16 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <FiCheckCircle className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" size={32} />
          <p className="text-neutral-700 dark:text-neutral-200 font-medium">{filtering ? 'Nobody matches these filters' : 'No members yet'}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {filtering ? 'Try a different search or clear a filter.' : 'Share a referral link: every signup through it appears here automatically.'}
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
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="min-h-[44px] px-3 py-1.5 rounded-lg text-sm font-medium border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600 dark:text-neutral-400 tabular-nums">
                Page {page} of {report.pagination.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(report.pagination.pages, p + 1))}
                disabled={page >= report.pagination.pages}
                className="min-h-[44px] px-3 py-1.5 rounded-lg text-sm font-medium border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
