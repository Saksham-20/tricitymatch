import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiImage, FiActivity, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import { useAdminScopes } from '../../components/admin/AdminLayout';
import {
  getSuspicious, getModerationStats, getPhotoQueue, removePhoto, updateUserStatus,
} from '../../api/adminApi';
import { formatDate } from '../../utils/formatDate';
import QueueMemberLink from '../../components/admin/QueueMemberLink';

const TABS = [
  { id: 'suspicious', label: 'Suspicious accounts', icon: FiAlertTriangle },
  { id: 'photos', label: 'Photo review', icon: FiImage },
  { id: 'stats', label: 'Moderation stats', icon: FiActivity },
];

const errMsg = (err, fallback) => err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

const Empty = ({ children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center text-sm text-gray-500">{children}</div>
);

const Loading = () => (
  <div className="flex items-center justify-center py-14">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
  </div>
);

// A failed load must never read as "nothing to worry about": say it failed and
// offer a retry, instead of the all-clear empty message.
const LoadFailed = ({ children, onRetry }) => (
  <div className="bg-white rounded-2xl p-12 text-center border border-gray-100" role="alert">
    <FiXCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" aria-hidden="true" />
    <p className="text-sm text-gray-600 mb-4">{children}</p>
    <button type="button" onClick={onRetry} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium">
      Try again
    </button>
  </div>
);

const scoreTone = (score) => (score >= 60 ? 'bg-red-100 text-red-700' : score >= 35 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600');

function Suspicious() {
  // Banning needs the `users` scope on the server; a reports-only sub-admin can
  // review but would get a 403 on every Ban, so the button is not offered.
  // Opening a member page needs the same scope, so "Review" follows it too.
  const scopes = useAdminScopes();
  const canBan = scopes === null || scopes.includes('users');
  const [accounts, setAccounts] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [includeTest, setIncludeTest] = useState(false);

  const load = useCallback(async () => {
    setAccounts(null);
    setLoadError(false);
    try {
      const res = await getSuspicious({ includeTest: includeTest || undefined });
      setAccounts(res.data.accounts || []);
    } catch (err) {
      toast.error(errMsg(err, 'Could not load suspicious accounts'));
      setLoadError(true);
      setAccounts([]);
    }
  }, [includeTest]);

  useEffect(() => { load(); }, [load]);

  const ban = async (u) => {
    if (!window.confirm(`Ban ${u.email || u.name}? They are signed out of every screen that checks status and cannot log in.`)) return;
    try {
      await updateUserStatus(u.id, { status: 'banned' });
      toast.success('Account banned');
      setAccounts((list) => list.filter((a) => a.id !== u.id));
    } catch (err) {
      toast.error(errMsg(err, 'Could not ban this account'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 max-w-2xl">
          Accounts matching scam or fake-profile patterns: a photo or phone number shared with another account,
          mass outreach right after signup, or repeated reports. A signal is a reason to look, not proof.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
            Include test accounts
          </label>
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700">
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {accounts === null ? <Loading /> : loadError ? (
        <LoadFailed onRetry={load}>Could not load suspicious accounts.</LoadFailed>
      ) : accounts.length === 0 ? (
        <Empty>No account matches a suspicious pattern right now.</Empty>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-4 p-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">
                    <QueueMemberLink userId={a.id}>{a.name || a.email || a.phone || '—'}</QueueMemberLink>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scoreTone(a.score)}`}>Risk {a.score}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{a.email || a.phone} · joined {formatDate(a.createdAt)}{a.city ? ` · ${a.city}` : ''}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {a.signals.map((s) => (
                    <li key={s.key} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">{s.label}</li>
                  ))}
                </ul>
              </div>
              {canBan && (
                <div className="flex items-center gap-2">
                  <Link to={`/admin/users/${a.id}`} className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700">Review</Link>
                  <button onClick={() => ban(a)} className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-medium text-red-700">Ban</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Photos() {
  const scopes = useAdminScopes();
  const canOpenMembers = scopes === null || scopes.includes('users');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setData(null);
    setLoadError(false);
    try {
      const res = await getPhotoQueue({ page });
      setData(res.data);
    } catch (err) {
      toast.error(errMsg(err, 'Could not load photos'));
      setLoadError(true);
      setData({ profiles: [], pagination: { pages: 1 } });
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const remove = async (userId, photoUrl) => {
    const reason = window.prompt('Remove this photo? Reason (recorded in the audit log):');
    if (reason === null) return;
    if (!reason.trim()) { toast.error('A reason is required — it is written to the audit log.'); return; }
    try {
      await removePhoto({ userId, photoUrl, reason });
      toast.success('Photo removed and the member was told');
      load();
    } catch (err) {
      toast.error(errMsg(err, 'Could not remove the photo'));
    }
  };

  if (data === null) return <Loading />;
  if (loadError) return <LoadFailed onRetry={load}>Could not load profile photos.</LoadFailed>;
  if (!data.profiles.length) return <Empty>No profile photos to review.</Empty>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Newest profile activity first. Remove any photo that shows another person, explicit content, contact details or a watermark.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.profiles.map((p) => (
          <div key={p.userId} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate"><QueueMemberLink userId={p.userId}>{p.name}</QueueMemberLink></p>
                <p className="text-xs text-gray-500 truncate">{p.email}</p>
              </div>
              {canOpenMembers && <Link to={`/admin/users/${p.userId}`} className="text-xs text-primary-700 hover:underline">Open</Link>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {p.photos.map((url) => (
                <div key={url} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">Image unavailable</span>
                  <img src={url} alt="" loading="lazy" className="relative w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  <button
                    type="button"
                    onClick={() => remove(p.userId, url)}
                    className="absolute inset-x-0 bottom-0 py-1 text-[11px] font-medium bg-red-600/90 text-white opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <button disabled={page === 1} onClick={() => setPage((n) => n - 1)} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">Prev</button>
          <span className="text-xs text-gray-500">Page {page} of {data.pagination.pages}</span>
          <button disabled={page >= data.pagination.pages} onClick={() => setPage((n) => n + 1)} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

const hours = (h) => (h >= 48 ? `${Math.round(h / 24)} d` : `${h} h`);

const Stat = ({ label, value, hint }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-4">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const ModTable = ({ title, rows }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-4">
    <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
    {rows.length === 0 ? <p className="text-sm text-gray-400">Nothing handled in the last 30 days.</p> : (
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.adminId} className="border-t border-gray-50 first:border-0">
              <td className="py-2 text-gray-700">{r.email}</td>
              <td className="py-2 text-right font-medium text-gray-900">{r.handled}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

function Stats() {
  const [stats, setStats] = useState(null);
  const load = useCallback(() => {
    setStats(null);
    getModerationStats().then((r) => setStats(r.data)).catch((err) => { toast.error(errMsg(err, 'Could not load stats')); setStats(false); });
  }, []);
  useEffect(() => { load(); }, [load]);
  if (stats === null) return <Loading />;
  if (stats === false) return <LoadFailed onRetry={load}>Could not load moderation stats.</LoadFailed>;
  const { reports, verifications, support } = stats;
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-900">Member reports</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Open" value={reports.open} hint={reports.open ? `oldest waiting ${hours(reports.oldestOpenHours)}` : 'queue is clear'} />
          <Stat label="Avg time to resolve" value={hours(reports.avgResolveHours)} hint="last 30 days" />
          <Stat label="Handled" value={reports.handled30} hint="last 30 days" />
          <Stat label="Dismissed" value={`${reports.dismissRate}%`} hint="a high rate can mean over-flagging" />
        </div>
        <ModTable title="Reports handled per moderator (30 days)" rows={reports.byModerator} />
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-900">Photo verifications</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Waiting" value={verifications.open} hint={verifications.open ? `oldest waiting ${hours(verifications.oldestOpenHours)}` : 'queue is clear'} />
          <Stat label="Handled" value={verifications.handled30} hint="last 30 days" />
          <Stat label="Rejected" value={`${verifications.rejectRate}%`} hint="of decisions, last 30 days" />
        </div>
        <ModTable title="Verifications handled per moderator (30 days)" rows={verifications.byModerator} />
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-900">Support inbox</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Unread" value={support.newCount} />
          <Stat label="Not resolved" value={support.open} />
          <Stat label="Avg time to reply" value={hours(support.avgReplyHours)} hint="last 30 days" />
          <Stat label="Replied" value={support.replied30} hint="last 30 days" />
        </div>
      </section>
    </div>
  );
}

export default function AdminSafety() {
  const [tab, setTab] = useState('suspicious');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trust &amp; Safety</h1>
        <p className="text-gray-500 text-sm mt-0.5">Find fake accounts, review photos and watch moderation queues.</p>
      </div>
      <div role="tablist" className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'suspicious' && <Suspicious />}
        {tab === 'photos' && <Photos />}
        {tab === 'stats' && <Stats />}
      </div>
    </div>
  );
}
