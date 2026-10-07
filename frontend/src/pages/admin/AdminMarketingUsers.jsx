import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiEye, FiPower, FiAlertCircle, FiUsers, FiRefreshCw, FiCopy, FiCheck, FiX, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import CommissionSettingsCard from '../../components/admin/CommissionSettingsCard';
import { useAdminScopes } from '../../components/admin/AdminLayout';
import copyText from '../../utils/copyText';
import generatePassword from '../../utils/generatePassword';
import { useDebounce } from '../../hooks/useDebounce';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const ROLE_LABEL = { marketing: 'Partner', marketing_manager: 'Manager' };
const fieldCls = 'w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

// What an admin needs to chase, in the words they would use. Keyed by the
// server's onboarding step names.
const MISSING_LABEL = {
  agreement: 'Guide not accepted',
  payout: 'No payout details',
  code: 'No code yet',
  outreach: 'No members yet',
};

export default function AdminMarketingUsers() {
  // null = full-access role. Commission is a money lever with its own scope.
  const scopes = useAdminScopes();
  const canPayouts = !scopes || scopes.includes('payouts');
  const [users, setUsers] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [filters, setFilters] = useState({ status: '', role: '', setup: '', sort: 'newest' });
  const isNarrow = useMediaQuery('(max-width: 767px)');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'marketing'
  });
  const [error, setError] = useState('');
  // Errors from the create form belong INSIDE the dialog: the page-level banner
  // rendered behind the scrim, so a duplicate email looked like nothing happened.
  const [createError, setCreateError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // The just-created partner's sign-in details, kept only until the admin closes
  // the panel. There is no other way to read the password back.
  const [created, setCreated] = useState(null);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const navigate = useNavigate();
  const firstFieldRef = useRef(null);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  useEffect(() => { setPage(1); }, [search]);
  const activeFilters = ['status', 'role', 'setup'].filter((k) => filters[k]).length + (search ? 1 : 0);
  const clearFilters = () => { setSearchInput(''); setFilters({ status: '', role: '', setup: '', sort: 'newest' }); setPage(1); };

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

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) q.set('search', search);
      Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
      const res = await apiClient.get(`/admin/marketing-users?${q}`);
      setUsers(res.data.users || []);
      setTotals(res.data.totals || null);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotal(res.data.pagination?.total ?? (res.data.users || []).length);
      setLoadError('');
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to fetch marketing users');
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/admin/marketing-users', formData);
      setError('');
      setCreateError('');
      setSuccess('');
      setCreated({
        email: res.data.user?.email || formData.email,
        password: formData.password,
        firstName: formData.firstName,
        welcomeEmailSent: Boolean(res.data.welcomeEmailSent),
      });
      setCopiedDetails(false);
      setShowCreateModal(false);
      setShowPassword(false);
      setFormData({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'marketing' });
      setPage(1);
      fetchUsers();
    } catch (err) {
      const e2 = err.response?.data?.error;
      setCreateError(e2?.details?.[0]?.message || e2?.message || err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleToggleStatus = async (userId, currentStatus, email, openLeads = 0) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    // Deactivating also switches off every referral code the partner owns, and
    // reactivating does NOT switch them back on, so say so before doing it.
    if (newStatus === 'inactive' && !window.confirm(
      `Deactivate ${email}?\n\nThey will no longer be able to sign in, and all of their referral codes stop working. Reactivating them later does not turn the codes back on.`
      + (openLeads > 0 ? `\n\nThey have ${openLeads} open ${openLeads === 1 ? 'lead' : 'leads'} nobody will follow up. You can give ${openLeads === 1 ? 'it' : 'them'} to another partner from their page afterwards.` : '')
    )) return;
    try {
      await apiClient.put(`/admin/marketing-users/${userId}/status`, { status: newStatus });
      setError('');
      setSuccess(newStatus === 'inactive'
        ? `${email} deactivated. Their referral codes were switched off.${openLeads > 0 ? ` They still have ${openLeads} open ${openLeads === 1 ? 'lead' : 'leads'}: open their page to give ${openLeads === 1 ? 'it' : 'them'} to another partner.` : ''}`
        : `${email} reactivated. Their referral codes stay off until you re-enable them.`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update user status');
    }
  };

  const signInMessage = (c) => [
    `Hi ${c.firstName}, your TricityMatch partner account is ready.`,
    '',
    `Sign in: ${window.location.origin}/login`,
    `Email: ${c.email}`,
    `Temporary password: ${c.password}`,
    '',
    'Please change your password after you sign in (Account & security in the portal), then read and accept the Partner Guide.',
  ].join('\n');

  const copySignIn = async () => {
    if (await copyText(signInMessage(created))) {
      setCopiedDetails(true);
      setTimeout(() => setCopiedDetails(false), 2000);
    }
  };

  const handleViewStats = async (userId) => {
    navigate(`/admin/marketing-users/${userId}`);
  };

  const nameOf = (u) => [u.Profile?.firstName, u.Profile?.lastName].filter(Boolean).join(' ');

  const setupCell = (u) => (u.onboarding ? (
    <div>
      <span className={`text-sm font-medium ${u.onboarding.complete ? 'text-green-700' : 'text-gray-800'}`}>
        {u.onboarding.completed} of {u.onboarding.total}
      </span>
      {!u.onboarding.complete && (
        <p className="text-xs text-gray-600 mt-0.5">
          {Object.keys(MISSING_LABEL).filter((k) => !u.onboarding.steps[k]).map((k) => MISSING_LABEL[k]).join(' · ')}
        </p>
      )}
    </div>
  ) : <span className="text-gray-500">—</span>);

  const statusChip = (u) => (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
      {u.status}
    </span>
  );

  // Links into Partner members, pre-filtered to this partner, so "who is under
  // this partner" is one click from the list.
  const membersLink = (u, extra = '') => `/admin/leads?marketingUserId=${u.id}${extra}`;

  const actions = (u) => (
    <div className="flex gap-1">
      <button
        onClick={() => handleViewStats(u.id)}
        aria-label={`Open ${nameOf(u) || u.email}`}
        title="Open partner"
        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50"
      >
        <FiEye size={18} />
      </button>
      <button
        onClick={() => handleToggleStatus(u.id, u.status, u.email, u.openLeads)}
        aria-label={u.status === 'active' ? `Deactivate ${u.email}` : `Activate ${u.email}`}
        title={u.status === 'active' ? 'Deactivate partner' : 'Activate partner'}
        className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 ${u.status === 'active' ? 'text-yellow-700' : 'text-green-700'}`}
      >
        <FiPower size={18} />
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Marketing Users</h1>
          <p className="text-sm text-gray-600 mt-1">Every partner and manager, what they have brought in, and how far they are with setup.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
          <Link
            to="/admin/leads"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3 sm:px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <FiUsers size={18} aria-hidden="true" /> Partner members
          </Link>
          <button
            onClick={() => { setCreateError(''); setShowCreateModal(true); }}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-primary-600 text-white px-3 sm:px-4 rounded-lg hover:bg-primary-700"
          >
            <FiPlus size={20} /> Create User
          </button>
        </div>
      </div>

      {canPayouts && <CommissionSettingsCard />}

      {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-4">{success}</div>}

      <section aria-label="Find a partner" className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="col-span-2 md:col-span-2 relative">
            <label htmlFor="mu-search" className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <FiSearch className="absolute left-3 bottom-3.5 text-gray-400" size={16} aria-hidden="true" />
            <input
              id="mu-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, email, phone or code"
              className={`${fieldCls} pl-9`}
            />
          </div>
          <div>
            <label htmlFor="mu-f-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select id="mu-f-status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={fieldCls}>
              <option value="">Any</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label htmlFor="mu-f-role" className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select id="mu-f-role" value={filters.role} onChange={(e) => setFilter('role', e.target.value)} className={fieldCls}>
              <option value="">Any</option>
              <option value="marketing">Partner</option>
              <option value="marketing_manager">Manager</option>
            </select>
          </div>
          <div>
            <label htmlFor="mu-f-setup" className="block text-xs font-medium text-gray-600 mb-1">Setup</label>
            <select id="mu-f-setup" value={filters.setup} onChange={(e) => setFilter('setup', e.target.value)} className={fieldCls}>
              <option value="">Any</option>
              <option value="incomplete">Not finished</option>
              <option value="complete">Finished</option>
            </select>
          </div>
          <div>
            <label htmlFor="mu-f-sort" className="block text-xs font-medium text-gray-600 mb-1">Sort by</label>
            <select id="mu-f-sort" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className={fieldCls}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="revenue">Revenue</option>
              <option value="paid">Paying members</option>
              <option value="signedUp">Members joined</option>
              <option value="leads">People invited</option>
            </select>
          </div>
        </div>
        {activeFilters > 0 && (
          <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1.5 min-h-[40px] px-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100">
            <FiX size={14} aria-hidden="true" /> Clear {activeFilters} {activeFilters === 1 ? 'filter' : 'filters'}
          </button>
        )}
      </section>

      {totals && !loadError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            ['Partners', `${num(totals.partners)}`, `${num(totals.active)} active`],
            ['People invited', num(totals.totalLeads), `${num(totals.signedUp)} joined`],
            ['Paying members', num(totals.paidMembers), null],
            ['Revenue', inr(totals.revenue), `${inr(totals.commissionEarned)} commission`],
          ].map(([label, value, sub]) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-600">{label}</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
              {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {loading && !users.length ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <FiAlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">{loadError}</p>
          <button onClick={fetchUsers} className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            Try again
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <FiUsers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          {activeFilters ? (
            <>
              <p className="text-gray-500 mb-4">No partner matches these filters.</p>
              <button onClick={clearFilters} className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 min-h-[44px] rounded-lg hover:bg-gray-50">Clear filters</button>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-4">No marketing users yet</p>
              <button onClick={() => { setCreateError(''); setShowCreateModal(true); }} className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
                <FiPlus size={18} /> Create User
              </button>
            </>
          )}
        </div>
      ) : isNarrow ? (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {users.map((u) => {
            const m = u.metrics || {};
            return (
              <li key={u.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/admin/marketing-users/${u.id}`} className="font-semibold text-gray-900 hover:text-primary-700 break-words">
                      {nameOf(u) || u.email}
                    </Link>
                    <p className="text-xs text-gray-500 break-all">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {statusChip(u)}
                      <span className="text-xs text-gray-600">{ROLE_LABEL[u.role] || u.role}</span>
                    </div>
                  </div>
                  {actions(u)}
                </div>
                {u.metrics && (
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
                    {[['Invited', num(m.totalLeads)], ['Joined', num(m.signedUp)], ['Paid', num(m.paidMembers)], ['Revenue', inr(m.revenue)]].map(([l, v]) => (
                      <div key={l}>
                        <p className="text-sm font-semibold tabular-nums">{v}</p>
                        <p className="text-[11px] text-gray-500">{l}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
                  <div className="min-w-0">{setupCell(u)}</div>
                  <Link to={membersLink(u)} className="shrink-0 inline-flex items-center min-h-[44px] text-sm font-medium text-primary-700 hover:underline">
                    Members
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={`overflow-x-auto bg-white border border-gray-200 rounded-xl ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3">Partner</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Invited</th>
                <th scope="col" className="px-4 py-3 text-right">Joined</th>
                <th scope="col" className="px-4 py-3 text-right">Paid</th>
                <th scope="col" className="px-4 py-3 text-right">Revenue</th>
                <th scope="col" className="px-4 py-3">Setup</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const m = u.metrics || {};
                return (
                  <tr key={u.id} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/admin/marketing-users/${u.id}`} className="font-medium text-gray-900 hover:text-primary-700 hover:underline">
                        {nameOf(u) || u.email}
                      </Link>
                      <div className="text-xs text-gray-500 break-all">{u.email}</div>
                      <div className="text-xs text-gray-600">{ROLE_LABEL[u.role] || u.role}</div>
                    </td>
                    <td className="px-4 py-3">{statusChip(u)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {u.metrics ? <Link to={membersLink(u)} className="hover:underline">{num(m.totalLeads)}</Link> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {u.metrics ? <Link to={membersLink(u, '&signedUp=yes')} className="hover:underline">{num(m.signedUp)}</Link> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {u.metrics ? <Link to={membersLink(u, '&paid=yes')} className="hover:underline">{num(m.paidMembers)}</Link> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {u.metrics ? (
                        <>
                          <div className="font-medium">{inr(m.revenue)}</div>
                          <div className="text-xs text-gray-500">{inr(m.commissionEarned)} comm.</div>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">{setupCell(u)}</td>
                    <td className="px-4 py-3">{actions(u)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loadError && totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 mt-5">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-40">
            <FiChevronLeft size={16} aria-hidden="true" /> Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages} · {num(total)} partners</span>
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
            aria-labelledby="create-mu-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-mu-title" className="text-2xl font-bold mb-4">Create Marketing User</h2>
            {createError && (
              <div role="alert" className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{createError}</div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label htmlFor="mu-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="mu-email"
                  ref={firstFieldRef}
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div>
                <label htmlFor="mu-password" className="block text-sm font-medium text-gray-700 mb-1">Temporary password</label>
                <div className="flex gap-2">
                  <input
                    id="mu-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="12+ characters, upper, lower, number, symbol"
                    minLength={12}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border px-3 py-2 rounded"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setFormData((f) => ({ ...f, password: generatePassword() })); setShowPassword(true); }}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap border px-3 rounded text-sm font-medium text-gray-800 hover:bg-gray-50 min-h-[44px]"
                  >
                    <FiRefreshCw size={14} aria-hidden="true" /> Generate
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  You will be shown the sign-in details once after creating the account. The partner is asked to change this password.
                </p>
              </div>
              <div>
                <label htmlFor="mu-firstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  id="mu-firstName"
                  type="text"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div>
                <label htmlFor="mu-lastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  id="mu-lastName"
                  type="text"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div>
                <label htmlFor="mu-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  id="mu-phone"
                  type="tel"
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div>
                <label htmlFor="mu-role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  id="mu-role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="marketing">Marketing</option>
                  <option value="marketing_manager">Marketing Manager (also sees the whole team's numbers)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-primary-600 text-white py-2 rounded hover:bg-primary-700">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border py-2 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {created && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div
            className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="created-mu-title"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 id="created-mu-title" className="text-xl font-bold">Partner account created</h2>
              <button
                type="button"
                onClick={() => setCreated(null)}
                aria-label="Close"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mt-2 -mr-2 rounded text-gray-500 hover:bg-gray-100"
              >
                <FiX size={18} />
              </button>
            </div>
            <p className={`text-sm mb-3 ${created.welcomeEmailSent ? 'text-green-700' : 'text-amber-800'}`}>
              {created.welcomeEmailSent
                ? `A welcome email with the first steps was sent to ${created.email}. It does not contain the password.`
                : `The welcome email could not be sent to ${created.email}. The account exists; send the details below yourself.`}
            </p>
            <p className="text-sm text-gray-700 mb-2">Send these sign-in details to the partner now. The password cannot be shown again.</p>
            <pre className="whitespace-pre-wrap break-all rounded bg-gray-50 border p-3 text-sm text-gray-900">{signInMessage(created)}</pre>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={copySignIn}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-600 text-white py-2 rounded hover:bg-primary-700 min-h-[44px]"
              >
                {copiedDetails ? <FiCheck size={16} aria-hidden="true" /> : <FiCopy size={16} aria-hidden="true" />}
                {copiedDetails ? 'Copied' : 'Copy sign-in details'}
              </button>
              <button type="button" onClick={() => setCreated(null)} className="flex-1 border py-2 rounded hover:bg-gray-50 min-h-[44px]">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
