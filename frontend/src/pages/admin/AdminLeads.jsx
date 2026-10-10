import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiSearch, FiSliders, FiDownload, FiAlertCircle, FiUsers, FiX, FiChevronLeft, FiChevronRight, FiCheck, FiMinus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import apiClient from '../../api/apiClient';
import { assignLead } from '../../api/adminApi';
import ReassignLeadsDialog from '../../components/admin/ReassignLeadsDialog';
import { formatLeadPhone, leadEmail } from '../../utils/leadContact';
import { saveCsv, describeExport } from '../../utils/saveCsv';
import planLabel from '../../utils/planLabel';
import { useDebounce } from '../../hooks/useDebounce';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * Everyone under every partner: the people they invited or added, whether each
 * one became a member, and whether that member paid. Filters live in the URL so
 * a partner's page can link straight to "their members who paid", and a
 * filtered view can be bookmarked or shared with another admin.
 */

const LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];
const FILTER_KEYS = ['search', 'marketingUserId', 'signedUp', 'paid', 'status', 'source', 'from', 'to', 'sort'];

const STATUS_TONE = {
  converted: 'bg-green-100 text-green-700',
  contacted: 'bg-blue-100 text-blue-700',
  lost: 'bg-red-100 text-red-700',
  new: 'bg-gray-100 text-gray-700',
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const errorOf = (err, fallback) => err?.response?.data?.error?.message || err?.response?.data?.message || fallback;
const partnerLabel = (p) => [p.Profile?.firstName, p.Profile?.lastName].filter(Boolean).join(' ') || p.email;

const fieldCls = 'w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

// The member's side of a lead: did they join, and did they pay.
function MemberCell({ lead }) {
  const m = lead.member;
  if (!lead.convertedUserId) {
    return <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><FiMinus size={14} aria-hidden="true" /> Not joined yet</span>;
  }
  return (
    <div className="text-sm">
      <Link to={`/admin/users/${lead.convertedUserId}`} className="font-medium text-primary-700 hover:underline [overflow-wrap:anywhere]">
        {m?.name || m?.email || 'Open member'}
      </Link>
      {m?.signedUpAt && <div className="text-xs text-gray-500 mt-0.5">Joined {fmtDate(m.signedUpAt)}</div>}
      {m && m.status !== 'active' && <div className="text-xs text-amber-800 mt-0.5">Account {m.status}</div>}
    </div>
  );
}

function PaidCell({ lead }) {
  const m = lead.member;
  if (!m?.paid) return <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><FiMinus size={14} aria-hidden="true" /> Not paid</span>;
  return (
    <div className="text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium text-green-700"><FiCheck size={14} aria-hidden="true" /> {inr(m.amountPaid)}</span>
      <div className="text-xs text-gray-500 mt-0.5">{planLabel(m.planType)}{m.planEndsAt ? ` · until ${fmtDate(m.planEndsAt)}` : ''}</div>
    </div>
  );
}

function SourceCell({ lead }) {
  return (
    <div className="text-sm">
      {lead.referralCode
        ? <span className="font-mono text-xs px-2 py-1 rounded bg-primary-50 text-primary-700 [overflow-wrap:anywhere]">{lead.referralCode}</span>
        : <span className="text-xs text-gray-600">Added by hand</span>}
      {lead.campaign && <div className="text-xs text-gray-500 mt-1 [overflow-wrap:anywhere]">{lead.campaign}</div>}
    </div>
  );
}

export default function AdminLeads() {
  const [params, setParams] = useSearchParams();
  const isNarrow = useMediaQuery('(max-width: 767px)');
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));

  // Search is typed, so it waits for a pause before asking the server.
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 350);

  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partners, setPartners] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [moving, setMoving] = useState(null); // the lead being given to another partner
  const [exporting, setExporting] = useState(false);
  // On a phone the eight filters take a whole screen, so they fold away.
  const [showFilters, setShowFilters] = useState(false);

  const setFilter = useCallback((key, value) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    if (debouncedSearch.trim() !== filters.search) setFilter('search', debouncedSearch.trim());
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = () => {
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    FILTER_KEYS.forEach((k) => { if (filters[k]) q.set(k, filters[k]); });
    return q;
  };
  const queryKey = params.toString();

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/leads?${query()}`);
      setLeads(res.data.leads || []);
      setSummary(res.data.summary || null);
      setPagination(res.data.pagination || { pages: 1, total: 0 });
      setError('');
    } catch (err) {
      setError(errorOf(err, 'Could not load partner members'));
    } finally {
      setLoading(false);
    }
  }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    apiClient.get('/admin/marketing-users?limit=100&sort=name')
      .then((res) => setPartners(res.data.users || []))
      .catch(() => setPartners([]));
  }, []);

  const handleStatusChange = async (leadId, status) => {
    setSavingId(leadId);
    try {
      await apiClient.put(`/admin/leads/${leadId}/status`, { status });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
      toast.success('Lead updated');
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Could not update the lead');
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const q = query();
      q.delete('page');
      q.delete('limit');
      q.set('format', 'csv');
      const res = await apiClient.get(`/admin/leads?${q}`, { responseType: 'blob' });
      const outcome = describeExport('people', await saveCsv(res, `tricitymatch-partner-members-${new Date().toISOString().slice(0, 10)}.csv`));
      (outcome.ok ? toast.success : toast.error)(outcome.text);
    } catch (err) {
      toast.error('Could not export the list. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const goPage = (p) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (p > 1) next.set('page', String(p)); else next.delete('page');
    return next;
  });

  const activeFilters = FILTER_KEYS.filter((k) => k !== 'sort' && filters[k]).length;
  const clearFilters = () => { setSearchInput(''); setParams({}, { replace: true }); };

  const statusSelect = (lead) => (
    <select
      value={lead.status}
      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
      disabled={savingId === lead.id}
      aria-label={`Lead status for ${lead.name}`}
      className={`min-h-[36px] px-2 rounded-lg text-sm border border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 ${STATUS_TONE[lead.status] || STATUS_TONE.new}`}
    >
      {LEAD_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
    </select>
  );

  // Someone who already became a member stays with the partner who earned the
  // commission, so there is nothing to offer.
  const reassignAction = (lead) => (lead.convertedUserId ? (
    <span className="text-xs text-gray-500">Stays with partner</span>
  ) : (
    <button
      type="button"
      onClick={() => setMoving(lead)}
      // `relative` anchors the sr-only name inside the scrolling table; without
      // it the hidden span escaped and widened the whole page by ~27px.
      className="relative min-h-[44px] px-2 text-sm font-medium text-primary-700 hover:underline whitespace-nowrap"
    >
      Reassign<span className="sr-only"> {lead.name}</span>
    </button>
  ));

  const partnerCell = (lead) => (lead.AssignedMarketer ? (
    <div className="text-sm min-w-0">
      <Link to={`/admin/marketing-users/${lead.assignedToMarketingUserId}`} className="font-medium text-gray-900 hover:text-primary-700 hover:underline [overflow-wrap:anywhere]">
        {lead.partnerName || lead.AssignedMarketer.email}
      </Link>
      {lead.partnerName && lead.partnerName !== lead.AssignedMarketer.email && (
        <div className="text-xs text-gray-500 truncate max-w-[10rem]" title={lead.AssignedMarketer.email}>{lead.AssignedMarketer.email}</div>
      )}
      {lead.AssignedMarketer.status && lead.AssignedMarketer.status !== 'active' && (
        <div className="text-xs text-amber-800">Partner {lead.AssignedMarketer.status}</div>
      )}
    </div>
  ) : <span className="text-gray-500">—</span>);

  // The admin shell already pads the page, so no second padding here: the table
  // needs the width to show every column at 1440 without scrolling sideways.
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Partner members</h1>
          <p className="text-sm text-gray-600 mt-1">
            Everyone a marketing partner invited or added, which partner they are with, whether they joined and whether they paid.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          <FiDownload size={16} aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <section aria-label="Filters" className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="relative mb-3">
          <label htmlFor="pm-search" className="sr-only">Search</label>
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
          <input
            id="pm-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone, email, city, code or campaign"
            className={`${fieldCls} pl-9`}
          />
        </div>
        {isNarrow && (
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="pm-filter-fields"
            className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-800"
          >
            <FiSliders size={16} aria-hidden="true" />
            {showFilters ? 'Hide filters' : `Filters${activeFilters ? ` (${activeFilters})` : ''}`}
          </button>
        )}
        {(!isNarrow || showFilters) && (
        <div id="pm-filter-fields" className={isNarrow ? 'mt-3' : ''}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label htmlFor="pm-partner" className={labelCls}>Partner</label>
            <select id="pm-partner" value={filters.marketingUserId} onChange={(e) => setFilter('marketingUserId', e.target.value)} className={fieldCls}>
              <option value="">All partners</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{partnerLabel(p)}{p.status !== 'active' ? ' (inactive)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pm-joined" className={labelCls}>Joined</label>
            <select id="pm-joined" value={filters.signedUp} onChange={(e) => setFilter('signedUp', e.target.value)} className={fieldCls}>
              <option value="">Anyone</option>
              <option value="yes">Became a member</option>
              <option value="no">Not joined yet</option>
            </select>
          </div>
          <div>
            <label htmlFor="pm-paid" className={labelCls}>Paid</label>
            <select id="pm-paid" value={filters.paid} onChange={(e) => setFilter('paid', e.target.value)} className={fieldCls}>
              <option value="">Anyone</option>
              <option value="yes">Paid</option>
              <option value="no">Not paid</option>
            </select>
          </div>
          <div>
            <label htmlFor="pm-status" className={labelCls}>Lead status</label>
            <select id="pm-status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={fieldCls}>
              <option value="">All statuses</option>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pm-source" className={labelCls}>How they came</label>
            <select id="pm-source" value={filters.source} onChange={(e) => setFilter('source', e.target.value)} className={fieldCls}>
              <option value="">Any way</option>
              <option value="code">Referral code</option>
              <option value="manual">Added by hand</option>
            </select>
          </div>
          <div>
            <label htmlFor="pm-from" className={labelCls}>Added from</label>
            <input id="pm-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="pm-to" className={labelCls}>Added to</label>
            <input id="pm-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} className={fieldCls} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-2">
            <label htmlFor="pm-sort" className="text-xs font-medium text-gray-600">Sort</label>
            <select id="pm-sort" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className="min-h-[40px] border border-gray-300 rounded-lg px-2 text-sm bg-white">
              <option value="">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          {activeFilters > 0 && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100">
              <FiX size={14} aria-hidden="true" /> Clear {activeFilters} {activeFilters === 1 ? 'filter' : 'filters'}
            </button>
          )}
        </div>
        </div>
        )}
      </section>

      {summary && !error && (
        <div className="grid grid-cols-3 gap-3 mb-5" aria-live="polite">
          {[
            ['People', summary.total],
            ['Became members', summary.signedUp],
            ['Paid', summary.paid],
          ].map(([label, n]) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl px-3 py-3 sm:px-4">
              <p className="text-xl sm:text-2xl font-bold tabular-nums">{Number(n).toLocaleString('en-IN')}</p>
              <p className="text-xs sm:text-sm text-gray-600">{label}</p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <FiAlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button type="button" onClick={fetchLeads} className="min-h-[44px] px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Try again</button>
        </div>
      ) : loading && !leads.length ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <FiUsers className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-600">{activeFilters ? 'Nobody matches these filters.' : 'No partner has invited or added anyone yet.'}</p>
          {activeFilters > 0 && (
            <button type="button" onClick={clearFilters} className="mt-4 min-h-[44px] px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Clear filters</button>
          )}
        </div>
      ) : isNarrow ? (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {leads.map((lead) => (
            <li key={lead.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 break-words">{lead.name}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{formatLeadPhone(lead.phone)}{lead.city ? ` · ${lead.city}` : ''}</p>
                  {leadEmail(lead.email) && <p className="text-xs text-gray-500 break-all">{leadEmail(lead.email)}</p>}
                </div>
                {statusSelect(lead)}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-3 mt-3 pt-3 border-t border-gray-100">
                <div className="col-span-2"><dt className={labelCls}>Partner</dt><dd>{partnerCell(lead)}</dd></div>
                <div><dt className={labelCls}>Member</dt><dd><MemberCell lead={lead} /></dd></div>
                <div><dt className={labelCls}>Paid</dt><dd><PaidCell lead={lead} /></dd></div>
                <div className="col-span-2"><dt className={labelCls}>Came through</dt><dd><SourceCell lead={lead} /></dd></div>
              </dl>
              <div className="flex items-center justify-between gap-3 mt-2">
                <span className="text-xs text-gray-500">Added {fmtDate(lead.createdAt)}</span>
                {reassignAction(lead)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        // `relative` keeps the hidden header text and button names inside this
        // scroller; the narrower cells let every column, Reassign included, fit
        // at 1440 without a sideways scroll.
        <div className={`relative overflow-x-auto bg-white border border-gray-200 rounded-xl ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-600">
              <tr>
                <th scope="col" className="px-3 py-3">Name</th>
                <th scope="col" className="px-3 py-3">Contact</th>
                <th scope="col" className="px-3 py-3">Partner</th>
                <th scope="col" className="px-3 py-3">Came through</th>
                <th scope="col" className="px-3 py-3">Member</th>
                <th scope="col" className="px-3 py-3">Paid</th>
                <th scope="col" className="px-3 py-3">Status</th>
                <th scope="col" className="relative px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="align-top hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium text-gray-900 min-w-[7rem] [overflow-wrap:anywhere]">{lead.name}</td>
                  <td className="px-3 py-3 text-sm">
                    <div className="whitespace-nowrap">{formatLeadPhone(lead.phone)}</div>
                    {leadEmail(lead.email) && <div className="text-xs text-gray-500 truncate max-w-[10rem]" title={leadEmail(lead.email)}>{leadEmail(lead.email)}</div>}
                    {lead.city && <div className="text-xs text-gray-500">{lead.city}</div>}
                  </td>
                  <td className="px-3 py-3">{partnerCell(lead)}</td>
                  <td className="px-3 py-3"><SourceCell lead={lead} /></td>
                  <td className="px-3 py-3"><MemberCell lead={lead} /></td>
                  <td className="px-3 py-3"><PaidCell lead={lead} /></td>
                  <td className="px-3 py-3">{statusSelect(lead)}</td>
                  <td className="px-3 py-3">{reassignAction(lead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && pagination.pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 mt-5">
          <button type="button" onClick={() => goPage(page - 1)} disabled={page <= 1} className="inline-flex items-center gap-1 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-40">
            <FiChevronLeft size={16} aria-hidden="true" /> Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {pagination.pages}</span>
          <button type="button" onClick={() => goPage(page + 1)} disabled={page >= pagination.pages} className="inline-flex items-center gap-1 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-40">
            Next <FiChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}

      {moving && (
        <ReassignLeadsDialog
          title={`Reassign ${moving.name}`}
          intro={moving.AssignedMarketer?.email ? `Currently with ${moving.partnerName || moving.AssignedMarketer.email}.` : 'This lead has no partner yet.'}
          confirmLabel="Reassign"
          currentOwnerId={moving.assignedToMarketingUserId}
          onClose={() => setMoving(null)}
          onConfirm={async (toUserId) => {
            const res = await assignLead(moving.id, toUserId);
            toast.success(res.data?.message || 'Lead moved');
            setMoving(null);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
}
