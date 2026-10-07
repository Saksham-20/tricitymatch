import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiCopy, FiCheck, FiToggleRight, FiAlertCircle, FiInbox, FiSearch, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import { useDebounce } from '../../hooks/useDebounce';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const partnerLabel = (u) => [u?.Profile?.firstName, u?.Profile?.lastName].filter(Boolean).join(' ') || u?.email || '';
const fieldCls = 'w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

export default function AdminReferralCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [marketingUsers, setMarketingUsers] = useState([]);
  const [formData, setFormData] = useState({
    code: '',
    marketingUserId: '',
    campaign: '',
    source: ''
  });
  const [error, setError] = useState('');
  // Create errors belong inside the dialog; the page banner sat behind the scrim.
  const [createError, setCreateError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [partnerFilter, setPartnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const isNarrow = useMediaQuery('(max-width: 767px)');
  const firstFieldRef = useRef(null);

  useEffect(() => { setPage(1); }, [search, partnerFilter, statusFilter]);
  useEffect(() => { fetchMarketingUsers(); }, []);

  // Dialog a11y: focus the first field when the create modal opens, let Escape
  // close it, and lock background scroll while it is open.
  useEffect(() => {
    if (!showCreateModal) return undefined;
    firstFieldRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setShowCreateModal(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showCreateModal]);

  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) q.set('search', search);
      if (partnerFilter) q.set('marketingUserId', partnerFilter);
      if (statusFilter) q.set('isActive', statusFilter);
      const res = await apiClient.get(`/admin/referral-codes?${q}`);
      setCodes(res.data.codes || []);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotal(res.data.pagination?.total || 0);
      setLoadError('');
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to fetch referral codes');
    } finally {
      setLoading(false);
    }
  }, [page, search, partnerFilter, statusFilter]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const fetchMarketingUsers = async () => {
    try {
      const res = await apiClient.get('/admin/marketing-users?limit=100&sort=name');
      setMarketingUsers(res.data.users || []);
    } catch (err) {
      setMarketingUsers([]);
    }
  };

  const openCreate = () => { setCreateError(''); setShowCreateModal(true); };

  const handleCreateCode = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/referral-codes', formData);
      setSuccess('Referral code created successfully');
      setError('');
      setCreateError('');
      setShowCreateModal(false);
      setFormData({ code: '', marketingUserId: '', campaign: '', source: '' });
      setPage(1);
      fetchCodes();
    } catch (err) {
      setCreateError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create referral code');
    }
  };

  const handleToggle = async (code) => {
    if (code.isActive && !window.confirm(`Switch off ${code.code}? Anyone who types it at signup or checkout will be told it is not valid.`)) return;
    try {
      await apiClient.put(`/admin/referral-codes/${code.id}/toggle`);
      setSuccess(`${code.code} ${code.isActive ? 'switched off' : 'switched on'}`);
      setError('');
      fetchCodes();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update referral code');
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy the code. Select and copy it manually.');
    }
  };

  const activeFilters = (search ? 1 : 0) + (partnerFilter ? 1 : 0) + (statusFilter ? 1 : 0);
  const clearFilters = () => { setSearchInput(''); setPartnerFilter(''); setStatusFilter(''); };
  const membersHref = (c, extra = '') => `/admin/leads?marketingUserId=${c.marketingUserId}&search=${encodeURIComponent(c.code)}${extra}`;

  const actions = (code) => (
    <div className="flex gap-1">
      <button
        onClick={() => handleCopyCode(code.code)}
        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50"
        title={copied === code.code ? 'Copied' : 'Copy code'}
        aria-label={copied === code.code ? `${code.code} copied` : `Copy ${code.code}`}
      >
        {copied === code.code ? <FiCheck size={18} /> : <FiCopy size={18} />}
      </button>
      <button
        onClick={() => handleToggle(code)}
        aria-label={code.isActive ? `Switch off ${code.code}` : `Switch on ${code.code}`}
        title={code.isActive ? 'Switch off' : 'Switch on'}
        className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 ${code.isActive ? 'text-red-600' : 'text-green-700'}`}
      >
        <FiToggleRight size={18} />
      </button>
    </div>
  );

  const statusChip = (code) => (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
      {code.isActive ? 'Active' : 'Off'}
    </span>
  );

  const partnerCell = (code) => (
    <div className="min-w-0">
      <Link to={`/admin/marketing-users/${code.marketingUserId}`} className="font-medium text-gray-900 hover:text-primary-700 hover:underline break-words">
        {code.partnerName || code.MarketingUser?.email || '—'}
      </Link>
      {code.MarketingUser?.status && code.MarketingUser.status !== 'active' && (
        <div className="text-xs text-amber-800">Partner {code.MarketingUser.status}</div>
      )}
    </div>
  );

  const results = (code) => (
    <span className="tabular-nums text-sm">
      <Link to={membersHref(code)} className="hover:underline">{code.people ?? 0} people</Link>
      {' · '}
      <Link to={membersHref(code, '&signedUp=yes')} className="hover:underline">{code.joined ?? code.usageCount} joined</Link>
      {' · '}
      <Link to={membersHref(code, '&paid=yes')} className="hover:underline">{code.paid ?? 0} paid</Link>
    </span>
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Referral Codes</h1>
          <p className="text-sm text-gray-600 mt-1">Every partner code, who owns it and what it has brought in.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 min-h-[44px] bg-primary-600 text-white px-4 rounded-lg hover:bg-primary-700"
        >
          <FiPlus size={20} /> Create Code
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-4">{success}</div>}

      <section aria-label="Find a code" className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2 relative">
            <label htmlFor="rc-search" className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <FiSearch className="absolute left-3 bottom-3.5 text-gray-400" size={16} aria-hidden="true" />
            <input id="rc-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Code, campaign or partner" className={`${fieldCls} pl-9`} />
          </div>
          <div>
            <label htmlFor="rc-f-partner" className="block text-xs font-medium text-gray-600 mb-1">Partner</label>
            <select id="rc-f-partner" value={partnerFilter} onChange={(e) => setPartnerFilter(e.target.value)} className={fieldCls}>
              <option value="">All partners</option>
              {marketingUsers.map((u) => <option key={u.id} value={u.id}>{partnerLabel(u)}{u.status !== 'active' ? ' (inactive)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rc-f-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select id="rc-f-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={fieldCls}>
              <option value="">Any</option>
              <option value="true">Active</option>
              <option value="false">Off</option>
            </select>
          </div>
        </div>
        {activeFilters > 0 && (
          <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1.5 min-h-[40px] px-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100">
            <FiX size={14} aria-hidden="true" /> Clear {activeFilters} {activeFilters === 1 ? 'filter' : 'filters'}
          </button>
        )}
      </section>

      {loading && !codes.length ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <FiAlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">{loadError}</p>
          <button onClick={fetchCodes} className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            Try again
          </button>
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <FiInbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          {activeFilters ? (
            <>
              <p className="text-gray-500 mb-4">No code matches these filters.</p>
              <button onClick={clearFilters} className="inline-flex items-center gap-2 min-h-[44px] border border-gray-300 text-gray-700 px-4 rounded-lg hover:bg-gray-50">Clear filters</button>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-4">No referral codes yet</p>
              <button onClick={openCreate} className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
                <FiPlus size={18} /> Create Code
              </button>
            </>
          )}
        </div>
      ) : isNarrow ? (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {codes.map((code) => (
            <li key={code.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono font-bold break-all">{code.code}</p>
                  {code.campaign && <p className="text-sm text-gray-600 break-words">{code.campaign}</p>}
                  <div className="mt-1.5">{statusChip(code)}</div>
                </div>
                {actions(code)}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-sm">
                {partnerCell(code)}
                {results(code)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={`overflow-x-auto bg-white border border-gray-200 rounded-xl ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3">Code</th>
                <th scope="col" className="px-4 py-3">Partner</th>
                <th scope="col" className="px-4 py-3">Campaign</th>
                <th scope="col" className="px-4 py-3">Brought in</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((code) => (
                <tr key={code.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-semibold">{code.code}</td>
                  <td className="px-4 py-3">{partnerCell(code)}</td>
                  <td className="px-4 py-3 text-sm">{code.campaign || '-'}</td>
                  <td className="px-4 py-3">{results(code)}</td>
                  <td className="px-4 py-3">{statusChip(code)}</td>
                  <td className="px-4 py-3">{actions(code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loadError && totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 mt-5">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-40">
            <FiChevronLeft size={16} aria-hidden="true" /> Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages} · {total} codes</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-40">
            Next <FiChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-code-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-code-title" className="text-2xl font-bold mb-4">Create Referral Code</h2>
            {createError && (
              <div role="alert" className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{createError}</div>
            )}
            <form onSubmit={handleCreateCode} className="space-y-4">
              <div>
                <label htmlFor="rc-code" className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  id="rc-code"
                  ref={firstFieldRef}
                  type="text"
                  placeholder="e.g. REFER50"
                  value={formData.code}
                  pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,31}"
                  title="3-32 characters: letters, numbers and hyphens, starting with a letter or number"
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
                  className="w-full min-h-[44px] border px-3 py-2 rounded"
                  required
                />
              </div>
              <div>
                <label htmlFor="rc-mu" className="block text-sm font-medium text-gray-700 mb-1">Marketing user</label>
                <select
                  id="rc-mu"
                  value={formData.marketingUserId}
                  onChange={(e) => setFormData({ ...formData, marketingUserId: e.target.value })}
                  className="w-full min-h-[44px] border px-3 py-2 rounded"
                  required
                >
                  <option value="">Select marketing user</option>
                  {marketingUsers.filter((u) => u.status === 'active').map(user => (
                    <option key={user.id} value={user.id}>
                      {partnerLabel(user)}{partnerLabel(user) !== user.email ? ` (${user.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rc-campaign" className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
                <input
                  id="rc-campaign"
                  type="text"
                  placeholder="Optional"
                  value={formData.campaign}
                  onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                  className="w-full min-h-[44px] border px-3 py-2 rounded"
                />
              </div>
              <div>
                <label htmlFor="rc-source" className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <input
                  id="rc-source"
                  type="text"
                  placeholder="Optional"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full min-h-[44px] border px-3 py-2 rounded"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 min-h-[44px] bg-primary-600 text-white py-2 rounded hover:bg-primary-700">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 min-h-[44px] border py-2 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
