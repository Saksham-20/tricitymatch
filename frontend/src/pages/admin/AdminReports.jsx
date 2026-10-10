import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getReports, updateReport } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiSearch, FiEye } from 'react-icons/fi';
import Skeleton from '../../components/ui/Skeleton';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { useAdminScopes } from '../../components/admin/AdminLayout';
import QueueMemberLink, { memberLabel, memberContact } from '../../components/admin/QueueMemberLink';
import ReportDeadlineChip, { reportDeadline } from '../../components/admin/ReportDeadline';
import ReportEvidence from '../../components/admin/ReportEvidence';
import ReportMemberActions from '../../components/admin/ReportMemberActions';

// "open" is everything still waiting on a decision (pending or being reviewed):
// what the dashboard counts as open, and where the urgent clocks matter.
const TAB_OPTIONS = ['open', 'pending', 'reviewing', 'resolved', 'dismissed', 'all'];
const DEFAULT_TAB = 'open';

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

// "Banned" / "Invisible" next to a reported member, so nobody bans twice.
const AccountState = ({ user }) => (
  <>
    {user?.status === 'banned' && (
      <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold uppercase">Banned</span>
    )}
    {user?.invisible && (
      <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase">Invisible</span>
    )}
  </>
);

export const otherReportsText = (report) => {
  const others = Number(report?.otherReports) || 0;
  if (!others) return 'No other reports against this member';
  const open = Number(report.otherOpenReports) || 0;
  return `${others} other ${others === 1 ? 'report' : 'reports'} against this member${open ? ` (${open} still open)` : ''}`;
};

export default function AdminReports() {
  // The tab and "urgent only" live in the address, so a dashboard tile can open
  // the queue already filtered (?priority=urgent) and a view can be shared.
  const [params, setParams] = useSearchParams();
  const activeTab = TAB_OPTIONS.includes(params.get('status')) ? params.get('status') : DEFAULT_TAB;
  const urgentOnly = params.get('priority') === 'urgent';
  const setFilter = useCallback((key, value) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }, [setParams]);
  const setActiveTab = (tab) => setFilter('status', tab === DEFAULT_TAB ? '' : tab);
  const setUrgentOnly = (on) => setFilter('priority', on ? 'urgent' : '');

  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [query, setQuery]         = useState('');   // debounced `search`
  const [page, setPage]           = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal]         = useState(null);
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmit]   = useState(false);
  const [now, setNow]             = useState(() => Date.now());
  const panelRef = useRef(null);
  const requestSeq = useRef(0);

  const scopes = useAdminScopes();
  const canChangeMembers = scopes === null || scopes.includes('users');

  const fetchData = useCallback(async () => {
    // Only the newest request may update the list: a slow answer for an older
    // filter must not land on top of the one the admin is looking at.
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      setLoadError(false);
      const filters = { page, limit: 20 };
      if (activeTab !== 'all') filters.status = activeTab;
      if (query) filters.search = query;
      if (urgentOnly) filters.priority = 'urgent';
      const res = await getReports(filters);
      if (seq !== requestSeq.current) return;
      setReports(res.data.reports || res.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
      setNow(Date.now());
    } catch {
      if (seq !== requestSeq.current) return;
      setLoadError(true);
      toast.error('Failed to load reports');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [activeTab, query, urgentOnly, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // The urgent "due in" clocks move on their own between loads.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Typing in the box waits a moment before it hits the API, and a new filter
  // always starts from page 1.
  useEffect(() => {
    const id = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => { setPage(1); }, [activeTab, urgentOnly]);

  // The review modal is a dialog: move focus into it on open, trap Tab, close on
  // Escape, and restore focus to the trigger on close.
  const modalId = modal?.id;
  useEffect(() => {
    if (!modalId) return undefined;
    const opener = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { setModal(null); return; }
      if (e.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])');
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && opener.focus) opener.focus();
    };
  }, [modalId]);

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

  // After a ban or hide, show the new state in the open report and refresh the
  // list (every row about the same member changes with it).
  const memberChanged = (patch) => {
    setModal((m) => (m ? { ...m, ReportedUser: { ...m.ReportedUser, ...patch } } : m));
    fetchData();
  };

  const reporterName = memberLabel(modal?.Reporter);
  const reportedName = memberLabel(modal?.ReportedUser);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review and manage user-submitted reports</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 max-w-full overflow-x-auto">
          {TAB_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              aria-pressed={activeTab === t}
              title={t === 'open' ? 'Pending and under review' : undefined}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                activeTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} className="rounded border-gray-300" />
          Urgent only
        </label>
        <div className="relative flex-1 min-w-[180px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search reports…"
            aria-label="Search reports"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td className="px-4 py-3"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-40 mt-1.5" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-40 mt-1.5" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-16" /></td>
                    <td className="px-4 py-3"><div className="flex justify-end"><Skeleton className="h-7 w-16 rounded-lg" /></div></td>
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    {loadError ? (
                      <>Could not load reports. <button onClick={fetchData} className="text-primary-700 underline">Try again</button></>
                    ) : 'No reports found'}
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">
                        <QueueMemberLink userId={r.Reporter?.id}>{memberLabel(r.Reporter)}</QueueMemberLink>
                      </p>
                      <p className="text-xs text-gray-500">{memberContact(r.Reporter)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">
                        <QueueMemberLink userId={r.ReportedUser?.id}>{memberLabel(r.ReportedUser)}</QueueMemberLink>
                        <AccountState user={r.ReportedUser} />
                      </p>
                      <p className="text-xs text-gray-500">{memberContact(r.ReportedUser)}</p>
                      {Number(r.otherReports) > 0 && (
                        <p className="text-xs font-medium text-amber-800 mt-0.5">
                          +{r.otherReports} other {Number(r.otherReports) === 1 ? 'report' : 'reports'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize text-xs">
                      {r.priority === 'urgent' && (
                        <span className="mr-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase">Urgent</span>
                      )}
                      {r.reason?.replace(/_/g, ' ')}
                      {reportDeadline(r, now) && <div className="mt-1"><ReportDeadlineChip report={r} now={now} /></div>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {r.Assignee
                        ? ([r.Assignee.Profile?.firstName, r.Assignee.Profile?.lastName].filter(Boolean).join(' ') || r.Assignee.email)
                        : <span className="text-gray-500">Unassigned</span>}
                      {r.escalatedAt && <span className="ml-1.5 text-[10px] font-semibold text-red-700">Escalated</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openModal(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-primary-100 text-gray-600 hover:text-primary-700 text-xs font-medium transition-colors"
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

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Page {pagination.page} of {pagination.pages} ({pagination.total} reports)</span>
          <div className="flex gap-2">
            <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50">Previous</button>
            <button disabled={page >= pagination.pages || loading} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-review-title"
            className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto focus:outline-none"
          >
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 id="report-review-title" className="text-lg font-bold text-gray-900">Review Report</h3>
              {modal.priority === 'urgent' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase">Urgent</span>
              )}
              <ReportDeadlineChip report={modal} now={now} />
            </div>
            <div className="text-sm text-gray-500 mb-4 space-y-1">
              <p>
                <span className="font-medium text-gray-700">From:</span>{' '}
                <QueueMemberLink userId={modal.Reporter?.id}>{reporterName}</QueueMemberLink>
                {memberContact(modal.Reporter) && <span className="text-gray-500"> · {memberContact(modal.Reporter)}</span>}
              </p>
              <p>
                <span className="font-medium text-gray-700">Against:</span>{' '}
                <QueueMemberLink userId={modal.ReportedUser?.id}>{reportedName}</QueueMemberLink>
                {memberContact(modal.ReportedUser) && <span className="text-gray-500"> · {memberContact(modal.ReportedUser)}</span>}
                <AccountState user={modal.ReportedUser} />
              </p>
              <p><span className="font-medium text-gray-700">Reason:</span> {modal.reason?.replace(/_/g, ' ')}</p>
              <p><span className="font-medium text-gray-700">Filed:</span> {formatDateTime(modal.createdAt)}</p>
              <p className={Number(modal.otherReports) > 0 ? 'font-medium text-amber-800' : ''}>{otherReportsText(modal)}</p>
              {modal.description && <p className="bg-gray-50 rounded-lg px-3 py-2 text-gray-600 whitespace-pre-wrap break-words">{modal.description}</p>}
            </div>

            <div className="space-y-3 mb-4">
              <ReportEvidence report={modal} reporterName={reporterName} reportedName={reportedName} />
              {canChangeMembers && modal.ReportedUser?.id && modal.ReportedUser.role === 'user' && (
                <ReportMemberActions member={modal.ReportedUser} onChanged={memberChanged} />
              )}
            </div>

            <label htmlFor="report-notes" className="block text-sm font-medium text-gray-700 mb-1.5">Admin Notes</label>
            <textarea
              id="report-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this report…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
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
