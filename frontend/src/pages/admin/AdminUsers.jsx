import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUsers, updateUserStatus } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiSearch, FiPlus, FiChevronLeft, FiChevronRight, FiEye } from 'react-icons/fi';

const STATUS_OPTIONS = ['all', 'active', 'inactive', 'suspended', 'deleted'];
const ROLE_OPTIONS   = ['all', 'user', 'admin'];

const StatusBadge = ({ status }) => {
  const map = {
    active:    'bg-green-100 text-green-700',
    inactive:  'bg-gray-100 text-gray-600',
    suspended: 'bg-amber-100 text-amber-700',
    deleted:   'bg-red-100 text-red-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [roleFilter, setRole]     = useState('all');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotal]    = useState(1);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, search: search || undefined };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter   !== 'all') params.role   = roleFilter;
      const res = await getUsers(params);
      setUsers(res.data.users || []);
      setTotal(res.data.totalPages || 1);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await updateUserStatus(userId, { status: newStatus });
      toast.success('Status updated');
      fetchUsers();
    } catch {
      toast.error('Update failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage all registered users</p>
        </div>
        <Link
          to="/admin/users/create"
          className="flex items-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <FiPlus className="w-4 h-4" /> Create User
        </Link>
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
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r === 'all' ? 'All Roles' : r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
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
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-600" />
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 text-xs font-bold flex-shrink-0">
                          {((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{u.role}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.status}
                        onChange={(e) => handleStatusChange(u.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      >
                        {['active', 'inactive', 'suspended', 'deleted'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {u.Subscription ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 capitalize">
                          {u.Subscription.planType}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Free</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-rose-100 text-gray-600 hover:text-rose-700 text-xs font-medium transition-colors"
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
    </div>
  );
}
