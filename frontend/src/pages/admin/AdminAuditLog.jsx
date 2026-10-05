import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiChevronLeft, FiChevronRight, FiDownload, FiRefreshCw, FiSearch, FiShield, FiX, FiAlertCircle } from 'react-icons/fi';
import { getAuditLog, getAuditActions, exportAuditLog } from '../../api/adminApi';
import { actionLabel, summarise } from '../../utils/auditLabels';
import { saveCsv, describeExport } from '../../utils/saveCsv';
import Skeleton from '../../components/ui/Skeleton';

/**
 * Audit log: every privileged action, newest first.
 *
 * "Who granted this member a plan, and when" is asked months later, usually by
 * someone who cannot grep a container log. So the filters are the point: by
 * action, by who did it, by who it was about, by date. They live in the URL so
 * a filtered view can be bookmarked or pasted to a colleague, and the member
 * page links here with `?target=<id>`.
 */

const LIMIT = 50;
const FILTER_KEYS = ['action', 'actor', 'target', 'from', 'to'];
const fieldCls = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2';

const when = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
const roleText = (r) => String(r || '').replace(/_/g, ' ');

function Field({ label, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function Person({ user }) {
  if (!user) return <span className="text-gray-400">—</span>;
  return (
    <>
      <span className="break-words">{user.email}</span>
      {user.role && <span className="text-gray-500"> · {roleText(user.role)}</span>}
    </>
  );
}

export default function AdminAuditLog() {
  const [params, setParams] = useSearchParams();
  const applied = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])), [params]);
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);

  // What is typed but not yet applied (the two free-text boxes apply on Enter).
  const [draft, setDraft] = useState({ actor: applied.actor, target: applied.target });
  useEffect(() => { setDraft({ actor: applied.actor, target: applied.target }); }, [applied.actor, applied.target]);

  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const filtersActive = FILTER_KEYS.some((k) => applied[k]);

  const apply = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
    next.delete('page');
    setParams(next, { replace: true });
  };
  const goToPage = (p) => {
    const next = new URLSearchParams(params);
    if (p > 1) next.set('page', String(p)); else next.delete('page');
    setParams(next, { replace: true });
  };
  const reset = () => setParams(new URLSearchParams(), { replace: true });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = { page, limit: LIMIT };
      FILTER_KEYS.forEach((k) => { if (applied[k]) query[k] = applied[k]; });
      const res = await getAuditLog(query);
      setEntries(res.data.entries || []);
      setTotal(res.data.pagination?.total || 0);
      setPages(res.data.pagination?.pages || 1);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the audit log');
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => { load(); }, [load]);

  // The dropdown lists what has actually been recorded, so it never offers an
  // action that returns nothing or hides one that exists.
  useEffect(() => {
    getAuditActions().then((r) => setActions(r.data.actions || [])).catch(() => setActions([]));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const query = {};
      FILTER_KEYS.forEach((k) => { if (applied[k]) query[k] = applied[k]; });
      const res = await exportAuditLog(query);
      const outcome = describeExport('audit rows', await saveCsv(res, `tricitymatch-audit-log-${new Date().toISOString().slice(0, 10)}.csv`));
      (outcome.ok ? toast.success : toast.error)(outcome.text);
    } catch {
      toast.error('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const submitPeople = (e) => {
    e.preventDefault();
    apply({ actor: draft.actor.trim(), target: draft.target.trim() });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
          <p className="text-gray-600 text-sm mt-0.5">
            Plan grants, refunds, bans, role changes, exports and record views: who did what, and when. Times are India time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            aria-label="Refresh the audit log"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            <FiRefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || total === 0}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
          >
            <FiDownload className="w-4 h-4" aria-hidden="true" />
            {exporting ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <form onSubmit={submitPeople} className="bg-white rounded-2xl border border-gray-100 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end" aria-label="Filter the audit log">
        <div className="lg:col-span-2">
          <Field label="Action" htmlFor="audit-action">
            <select id="audit-action" value={applied.action} onChange={(e) => apply({ action: e.target.value })} className={fieldCls}>
              <option value="">Every action</option>
              {actions.map((a) => (
                <option key={a.action} value={a.action}>{actionLabel(a.action)} ({a.count.toLocaleString('en-IN')})</option>
              ))}
              {/* An action in the URL that has no rows yet must still show as selected. */}
              {applied.action && !actions.some((a) => a.action === applied.action) && (
                <option value={applied.action}>{actionLabel(applied.action)}</option>
              )}
            </select>
          </Field>
        </div>
        <Field label="Done by (email or part of it)" htmlFor="audit-actor">
          <input id="audit-actor" type="text" value={draft.actor} onChange={(e) => setDraft((d) => ({ ...d, actor: e.target.value }))} placeholder="admin@…" className={fieldCls} autoComplete="off" />
        </Field>
        <Field label="About (member email or ID)" htmlFor="audit-target">
          <input id="audit-target" type="text" value={draft.target} onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))} placeholder="member@…" className={fieldCls} autoComplete="off" />
        </Field>
        <Field label="From" htmlFor="audit-from">
          <input id="audit-from" type="date" value={applied.from} max={applied.to || undefined} onChange={(e) => apply({ from: e.target.value })} className={fieldCls} />
        </Field>
        <Field label="To" htmlFor="audit-to">
          <input id="audit-to" type="date" value={applied.to} min={applied.from || undefined} onChange={(e) => apply({ to: e.target.value })} className={fieldCls} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-6 flex items-center gap-2 flex-wrap">
          <button type="submit" className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
            <FiSearch className="w-4 h-4" aria-hidden="true" /> Apply
          </button>
          {filtersActive && (
            <button type="button" onClick={reset} className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FiX className="w-4 h-4" aria-hidden="true" /> Clear filters
            </button>
          )}
          <p className="text-sm text-gray-600 ml-auto" role="status" aria-live="polite">
            {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} ${total === 1 ? 'entry' : 'entries'}${filtersActive ? ' match' : ''}`}
          </p>
        </div>
      </form>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3" aria-busy="true" aria-label="Loading the audit log">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center" role="alert">
          <FiAlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-gray-700 mb-3">{error}</p>
          <button type="button" onClick={load} className="min-h-[44px] px-4 rounded-xl bg-primary-700 text-white text-sm font-medium">Try again</button>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <FiShield className="w-8 h-8 text-gray-400 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-gray-600 mb-3">
            {filtersActive ? 'Nothing matches these filters.' : 'Nothing recorded yet. Actions appear here as admins take them.'}
          </p>
          {filtersActive && <button type="button" onClick={reset} className="min-h-[44px] px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Clear filters</button>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['When', 'Action', 'By', 'About', 'What happened'].map((h) => (
                    <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((e) => {
                  const text = summarise(e.action, e.details);
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{when(e.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 whitespace-nowrap">{actionLabel(e.action)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700"><Person user={e.Actor} /></td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {e.TargetUser ? (
                          <Link to={`/admin/users/${e.TargetUser.id}`} className="text-primary-700 underline underline-offset-2 break-words">{e.TargetUser.email}</Link>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-md">
                        {text && <p className="break-words">{text}</p>}
                        {e.details && Object.keys(e.details).length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 min-h-[24px]">Full record</summary>
                            <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-gray-600 bg-gray-50 rounded-lg p-2">{JSON.stringify(e.details, null, 2)}</pre>
                          </details>
                        )}
                        {!text && !(e.details && Object.keys(e.details).length) && <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600" aria-label="Audit log pages">
              <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1} className="min-h-[44px] inline-flex items-center gap-1 px-3 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                <FiChevronLeft aria-hidden="true" /> Newer
              </button>
              <span>Page {page} of {pages.toLocaleString('en-IN')}</span>
              <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= pages} className="min-h-[44px] inline-flex items-center gap-1 px-3 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                Older <FiChevronRight aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
