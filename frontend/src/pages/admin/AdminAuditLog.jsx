import React, { useCallback, useEffect, useState } from 'react';
import { FiRefreshCw, FiShield } from 'react-icons/fi';
import { getAuditLog } from '../../api/adminApi';

/**
 * Audit log — every privileged action, newest first.
 *
 * `logAudit` has always written these to the JSON app log, which nobody can
 * read from inside the product. "Who granted this member a plan, and when" is
 * a question that gets asked months later, usually by the person who needs the
 * answer least able to grep a container log.
 */

const ACTION_LABELS = {
  subscription_overridden: 'Plan granted',
  subscription_cancelled: 'Plan cancelled',
  admin_role_changed: 'Role changed',
  admin_account_created: 'Admin created',
  user_created_by_admin: 'Member created',
  users_exported: 'Members exported',
  launch_offer_updated: 'Pricing changed',
  verification_reviewed: 'Verification reviewed',
};

const label = (action) => ACTION_LABELS[action] || String(action).replace(/_/g, ' ');

export default function AdminAuditLog() {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditLog({ page, limit: 50 });
      setEntries(res.data.entries || []);
      setPages(res.data.pagination?.pages || 1);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the audit log');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Plan grants, cancellations, role changes and exports — who did what, and when.
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600" title="Refresh">
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
          <p className="text-sm text-gray-600 mb-3">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl bg-primary-700 text-white text-sm font-medium">Retry</button>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <FiShield className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nothing recorded yet. Actions appear here as admins take them.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">When</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                        {label(e.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {e.Actor?.email || '—'}
                      {e.Actor?.role ? <span className="text-gray-400"> · {String(e.Actor.role).replace(/_/g, ' ')}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      {/* Raw JSON on purpose: the shape differs per action, and a
                          prettified guess would hide the field that matters. */}
                      <code className="text-[11px] text-gray-500 break-all">
                        {e.details ? JSON.stringify(e.details) : '—'}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">Prev</button>
              <span>Page {page} of {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
