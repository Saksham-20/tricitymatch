import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getUsers, updateUserStatus, exportUsers, deleteUsers, bulkUpdateStatus } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FiSearch, FiPlus, FiChevronLeft, FiChevronRight, FiEye, FiEyeOff, FiDownload, FiTrash2, FiX, FiSliders, FiBookmark, FiUsers } from 'react-icons/fi';
import Skeleton from '../../components/ui/Skeleton';
import { saveCsv, describeExport } from '../../utils/saveCsv';

// Must match User model status enum: active/inactive/banned/pending/deleted.
const STATUS_OPTIONS   = ['all', 'active', 'inactive', 'banned', 'pending', 'deleted'];
// Statuses an admin can set via PUT /users/:id/status (excludes 'deleted' —
// account deletion has its own flow — matching updateUserStatusValidation).
const SETTABLE_STATUSES = ['active', 'inactive', 'banned', 'pending'];
const ROLE_OPTIONS = ['all', 'user', 'sub_admin', 'admin', 'super_admin', 'marketing', 'marketing_manager'];

const PLAN_OPTIONS = [
  ['all', 'Any plan'], ['free', 'Free (no plan)'], ['paid', 'Any paid plan'], ['expiring', 'Expiring in 7 days'],
  ['lapsed', 'Lapsed (paid before)'], ['founding_premium', 'Founding'], ['premium_plus', 'Premium'],
  ['basic_premium', 'Basic'], ['elite', 'Elite'], ['vip', 'VIP'], ['nri', 'NRI'],
];
const JOINED_OPTIONS = [['', 'Any time'], ['recent', 'Recently joined'], ['oldest', 'Oldest first'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']];
const YES_NO = [['all', 'Any'], ['yes', 'Yes'], ['no', 'No']];
const SORT_OPTIONS = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['lastLogin', 'Last active']];
const EMPTY_FILTERS = {
  plan: 'all', joinedWithin: '', joinedFrom: '', joinedTo: '', verified: 'all', hasPhoto: 'all',
  gender: 'all', city: '', emailVerified: 'all', phoneVerified: 'all', inactiveDays: '',
  testAccounts: 'all', visibility: 'all', sort: 'newest', joinedTouched: false,
};
const selectCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2';

const Field = ({ label, children }) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
    {label}
    {children}
  </label>
);

const VIEWS_KEY = 'tm-admin-user-views';
const loadViews = () => {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY)) || []; } catch { return []; }
};
const storeViews = (views) => {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); } catch { /* private window: views last for this tab only */ }
};

const activeFilterParams = (f) => {
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === 'joinedTouched') continue;
    if (v !== '' && v !== 'all' && !(k === 'sort' && v === 'newest')) out[k] = v;
  }
  return out;
};

export default function AdminUsers() {
  const handleExport = async () => {
    try {
      const params = { search: search || undefined };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter   !== 'all') params.role   = roleFilter;
      Object.assign(params, activeFilterParams(filters));
      const res = await exportUsers(params);
      // No row cap: the file holds every matching member. The toast states the
      // count so an admin can check it, and warns if the stream broke part-way.
      const outcome = describeExport('members', await saveCsv(res, `tricitymatch-members-${new Date().toISOString().slice(0, 10)}.csv`));
      (outcome.ok ? toast.success : toast.error)(outcome.text);
    } catch {
      toast.error('Export failed. Try again.');
    }
  };

  const navigate = useNavigate();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [roleFilter, setRole]     = useState('all');
  const { user: me } = useAuth();
  const canDelete = me?.role === 'admin' || me?.role === 'super_admin';
  // The dashboard's "Profiles With No Photo" tile deep-links here; honour it
  // instead of opening the unfiltered list under a misleading count.
  const [searchParams] = useSearchParams();
  const [filters, setFilters]     = useState(() => {
    const hasPhoto = searchParams.get('hasPhoto');
    return hasPhoto === 'no' || hasPhoto === 'yes' ? { ...EMPTY_FILTERS, hasPhoto } : EMPTY_FILTERS;
  });
  // Open the advanced filters when we arrived with one applied, so the filter
  // that is narrowing the list is visible rather than silent.
  const [showAdv, setShowAdv]     = useState(() => searchParams.get('hasPhoto') === 'no' || searchParams.get('hasPhoto') === 'yes');
  const [selected, setSelected]   = useState(new Set());
  const [views, setViews]     = useState(loadViews);
  const [bulkStatus, setBulkStatus] = useState('');
  const [confirmOpen, setConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [total, setTotalCount]    = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotal]    = useState(1);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, search: search || undefined };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter   !== 'all') params.role   = roleFilter;
      Object.assign(params, activeFilterParams(filters));
      const res = await getUsers(params);
      setTotalCount(res.data.pagination?.total || 0);
      setUsers(res.data.users || []);
      setTotal(res.data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter, filters]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleStatusChange = async (userId, newStatus) => {
    // Banning or deactivating a member (possibly a paying one) is consequential
    // and had no guard — a single stray dropdown pick applied instantly.
    if (newStatus === 'banned' || newStatus === 'inactive') {
      const u = users.find((x) => x.id === userId);
      if (!window.confirm(`Set ${u?.email || 'this account'} to "${newStatus}"?`)) return;
    }
    try {
      await updateUserStatus(userId, { status: newStatus });
      toast.success('Status updated');
      fetchUsers();
    } catch (err) {
      // Say what the server said (for example the staff-account guard) rather
      // than a generic failure the admin cannot act on.
      toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Update failed');
    }
  };

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); setSelected(new Set()); };
  // One dropdown drives both the date window and the join-order sort.
  const joinedValue = filters.joinedWithin || (filters.sort === 'oldest' ? 'oldest' : filters.sort === 'newest' && filters.joinedTouched ? 'recent' : '');
  const setJoined = (v) => {
    setFilters((f) => ({
      ...f,
      joinedWithin: /^\d+$/.test(v) ? v : '',
      sort: v === 'oldest' ? 'oldest' : 'newest',
      joinedTouched: v === 'recent',
    }));
    setPage(1);
    setSelected(new Set());
  };
  const activeCount = Object.keys(activeFilterParams(filters)).length;
  const clearAll = () => { setFilters(EMPTY_FILTERS); setSearch(''); setStatus('all'); setRole('all'); setPage(1); setSelected(new Set()); };

  const deletableOnPage = users.filter((u) => u.role === 'user');
  const allSelected = deletableOnPage.length > 0 && deletableOnPage.every((u) => selected.has(u.id));
  const toggleOne = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(deletableOnPage.map((u) => u.id)));

  const saveView = () => {
    const name = window.prompt('Name this view (e.g. "No photo, joined this week")');
    if (!name || !name.trim()) return;
    const next = [...views.filter((v) => v.name !== name.trim()), {
      name: name.trim().slice(0, 40),
      filters,
      search,
      status: statusFilter,
      role: roleFilter,
    }].slice(-12);
    setViews(next);
    storeViews(next);
    toast.success('View saved');
  };
  const applyView = (name) => {
    const v = views.find((x) => x.name === name);
    if (!v) return;
    setFilters({ ...EMPTY_FILTERS, ...v.filters });
    setSearch(v.search || '');
    setStatus(v.status || 'all');
    setRole(v.role || 'all');
    setPage(1);
    setSelected(new Set());
  };
  const deleteView = (name) => {
    const next = views.filter((v) => v.name !== name);
    setViews(next);
    storeViews(next);
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus) return;
    if (!window.confirm(`Set ${selected.size} account${selected.size > 1 ? 's' : ''} to "${bulkStatus}"?`)) return;
    try {
      const res = await bulkUpdateStatus([...selected], bulkStatus);
      toast.success(`Updated ${res.data.updated}${res.data.skipped ? `, skipped ${res.data.skipped} (staff or deleted)` : ''}`);
      setSelected(new Set());
      setBulkStatus('');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteUsers([...selected]);
      const { deleted = [], blocked = [] } = res.data;
      if (deleted.length) toast.success(`Deleted ${deleted.length} account${deleted.length > 1 ? 's' : ''}`);
      if (blocked.length) toast.error(`${blocked.length} kept: ${blocked[0].reason}`, { duration: 6000 });
      setSelected(new Set());
      setConfirm(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString('en-IN')} matching user{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
        >
          <FiDownload className="w-4 h-4" /> Export CSV
        </button>
        <Link
          to="/admin/users/create"
          className="flex items-center gap-2 px-4 py-2 bg-primary-700 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <FiPlus className="w-4 h-4" /> Create User
        </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r === 'all' ? 'All Roles' : r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <select value={filters.plan} onChange={(e) => setFilter('plan', e.target.value)} className={selectCls} aria-label="Plan">
          {PLAN_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={joinedValue} onChange={(e) => setJoined(e.target.value)} className={selectCls} aria-label="Joined">
          {JOINED_OPTIONS.map(([v, l]) => <option key={v} value={v}>{`Joined: ${l}`}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setShowAdv((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
        >
          <FiSliders className="w-4 h-4" /> More filters{activeCount ? ` (${activeCount})` : ''}
        </button>
        {(activeCount > 0 || search || statusFilter !== 'all' || roleFilter !== 'all') && (
          <>
            <button type="button" onClick={clearAll} className="px-3 py-2 text-sm text-primary-700 hover:underline">Clear all</button>
            <button type="button" onClick={saveView} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:underline">
              <FiBookmark className="w-4 h-4" /> Save view
            </button>
          </>
        )}
        {views.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Saved views">
            {views.map((v) => (
              <span key={v.name} className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs">
                <button
                  type="button"
                  onClick={() => applyView(v.name)}
                  className="pl-3 pr-1.5 py-1 font-medium rounded-l-full hover:text-primary-700"
                  aria-label={`Apply saved view ${v.name}`}
                >
                  {v.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteView(v.name)}
                  aria-label={`Delete saved view ${v.name}`}
                  className="pr-2 pl-0.5 py-1 rounded-r-full text-gray-400 hover:text-red-600"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {showAdv && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-white border border-gray-100 rounded-2xl">
          <Field label="Joined from"><input type="date" value={filters.joinedFrom} onChange={(e) => setFilter('joinedFrom', e.target.value)} className={selectCls} /></Field>
          <Field label="Joined to"><input type="date" value={filters.joinedTo} onChange={(e) => setFilter('joinedTo', e.target.value)} className={selectCls} /></Field>
          <Field label="Photo verified">
            <select value={filters.verified} onChange={(e) => setFilter('verified', e.target.value)} className={selectCls}>
              <option value="all">Any</option><option value="yes">Verified</option><option value="pending">Pending review</option><option value="no">Not verified</option>
            </select>
          </Field>
          <Field label="Has profile photo">
            <select value={filters.hasPhoto} onChange={(e) => setFilter('hasPhoto', e.target.value)} className={selectCls}>
              {YES_NO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Gender">
            <select value={filters.gender} onChange={(e) => setFilter('gender', e.target.value)} className={selectCls}>
              <option value="all">Any</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </Field>
          <Field label="City"><input type="text" value={filters.city} onChange={(e) => setFilter('city', e.target.value)} placeholder="e.g. Mohali" className={selectCls} /></Field>
          <Field label="Email verified">
            <select value={filters.emailVerified} onChange={(e) => setFilter('emailVerified', e.target.value)} className={selectCls}>
              {YES_NO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Phone verified">
            <select value={filters.phoneVerified} onChange={(e) => setFilter('phoneVerified', e.target.value)} className={selectCls}>
              {YES_NO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Inactive for (days)"><input type="number" min="1" value={filters.inactiveDays} onChange={(e) => setFilter('inactiveDays', e.target.value)} placeholder="e.g. 30" className={selectCls} /></Field>
          <Field label="Test accounts">
            <select value={filters.testAccounts} onChange={(e) => setFilter('testAccounts', e.target.value)} className={selectCls}>
              <option value="all">Show all</option><option value="exclude">Hide test accounts</option><option value="only">Only test accounts</option>
            </select>
          </Field>
          <Field label="Visible to members">
            <select value={filters.visibility} onChange={(e) => setFilter('visibility', e.target.value)} className={selectCls}>
              <option value="all">Any</option><option value="visible">Visible</option><option value="hidden">Invisible (hidden by admin)</option>
            </select>
          </Field>
          <Field label="Sort by">
            <select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className={selectCls}>
              {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>
      )}

      {canDelete && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary-50 border border-primary-100 rounded-2xl">
          <span className="text-sm font-medium text-primary-800">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-sm text-gray-600 hover:underline">Clear</button>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className={selectCls} aria-label="Set status for selected">
              <option value="">Set status…</option>
              {SETTABLE_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            <button
              type="button"
              onClick={handleBulkStatus}
              disabled={!bulkStatus}
              className="px-3 py-1.5 rounded-lg bg-primary-700 hover:bg-primary-600 text-white text-sm font-medium disabled:opacity-40"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
            >
              <FiTrash2 className="w-4 h-4" /> Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {canDelete && (
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on this page" />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subscription</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {canDelete && <td className="w-10 px-4 py-3"><Skeleton className="w-4 h-4 rounded" /></td>}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                        <div className="flex-1">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-40 mt-1.5" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-7 w-24 rounded-lg" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><div className="flex justify-end"><Skeleton className="h-7 w-16 rounded-lg" /></div></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 7 : 6} className="py-14">
                    <div className="flex flex-col items-center justify-center text-center">
                      <FiUsers className="w-8 h-8 text-gray-300 mb-3" />
                      <p className="text-sm text-gray-500">
                        {(activeCount > 0 || search || statusFilter !== 'all' || roleFilter !== 'all')
                          ? 'No members match these filters'
                          : 'No members yet'}
                      </p>
                      {(activeCount > 0 || search || statusFilter !== 'all' || roleFilter !== 'all') && (
                        <button type="button" onClick={clearAll} className="mt-3 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium">
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    {canDelete && (
                      <td className="w-10 px-4 py-3">
                        {u.role === 'user' && (
                          <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} aria-label={`Select ${u.email || u.phone || 'member'}`} />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                          {((u.Profile?.firstName?.[0] || '') + (u.Profile?.lastName?.[0] || '')).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {[u.Profile?.firstName, u.Profile?.lastName].filter(Boolean).join(' ') || '—'}
                            {u.invisible && (
                              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[11px] font-semibold align-middle" title={u.invisible.reason ? `Invisible: ${u.invisible.reason}` : 'Invisible to members'}>
                                <FiEyeOff className="w-3 h-3" aria-hidden="true" /> Invisible
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'user' ? (
                        <span className="text-gray-600 capitalize">{u.role}</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                          {String(u.role).replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.status}
                        onChange={(e) => handleStatusChange(u.id, e.target.value)}
                        aria-label={`Status for ${u.email || u.phone || 'member'}`}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        {SETTABLE_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        {/* show current terminal state (e.g. deleted) but don't offer it as a set action */}
                        {!SETTABLE_STATUSES.includes(u.status) && (
                          <option value={u.status} disabled>{u.status}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {/* `activePlan` is derived server-side with the same predicate the
                          entitlement gates use. The old read was `u.Subscription`
                          (singular) against a hasMany association the API serializes as
                          `Subscriptions`, so this column said "Free" for every member —
                          including one an admin had just upgraded. */}
                      {u.activePlan && u.activePlan !== 'free' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          {String(u.activePlan).replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Free</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-primary-100 text-gray-600 hover:text-primary-700 text-xs font-medium transition-colors"
                      >
                        <FiEye className="w-3.5 h-3.5" /> View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FiChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <FiChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">Permanently delete {selected.size} account{selected.size > 1 ? 's' : ''}?</h2>
              <button type="button" onClick={() => setConfirm(false)} aria-label="Close"><FiX className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Profile, photos, messages, matches and every related row are removed from the database. This cannot be undone.
              Accounts with a real payment on record are kept automatically.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="px-4 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
