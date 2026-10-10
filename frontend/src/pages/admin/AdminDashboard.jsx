import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getAnalytics } from '../../api/adminApi';
import { useAdminScopes } from '../../components/admin/AdminLayout';
import planLabel from '../../utils/planLabel';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { FiUsers, FiCheckCircle, FiCreditCard, FiTrendingUp, FiFlag, FiAlertCircle, FiUserPlus, FiMail, FiRotateCcw } from 'react-icons/fi';
import Skeleton from '../../components/ui/Skeleton';

const REFRESH_MS = 60 * 1000;

// "3 min", "5 h", "2 days": how long the oldest unread enquiry has waited.
export const waitedFor = (since, now = Date.now()) => {
  if (!since) return null;
  const mins = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} days`;
};

const clock = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// A figure that is also a door to the work behind it.
const QueueTile = ({ icon: Icon, label, value, sub, to, alert }) => (
  <Link
    to={to}
    className={`flex items-start gap-3 p-4 rounded-2xl border bg-white shadow-sm transition-colors hover:bg-gray-50 ${alert ? 'border-red-200' : 'border-gray-100'}`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${alert ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'}`}>
      <Icon className="w-5 h-5" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className={`text-xl font-bold tabular-nums ${alert ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </Link>
);

// Brand-family ramp (burgundy → gold → muted tints); no off-brand green/blue/purple.
const COLORS = ['#8B2346', '#C9A227', '#B76E79', '#5E1730', '#D8B24A'];

const KpiCard = ({ icon: Icon, label, value, sub, color = 'rose' }) => {
  const colorMap = {
    rose: 'bg-primary-100 text-primary-700',
  };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? 'None'}</p>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

// Which scope each quick link needs, so a scoped sub-admin is not offered links
// that land on "Not your section".
const LINK_SCOPE = {
  '/admin/verifications': 'verifications',
  '/admin/reports': 'reports',
  '/admin/appeals': 'reports',
  '/admin/contact-messages': 'support',
  '/admin/users': 'users',
  '/admin/funnel': 'users',
  '/admin/revenue': 'revenue',
  '/admin/launch-offer': 'pricing',
};

export default function AdminDashboard() {
  const scopes = useAdminScopes();
  const canOpen = (to) => scopes === null || scopes.includes(LINK_SCOPE[to.split('?')[0]]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshFailedAt, setRefreshFailedAt] = useState(null);
  const requestSeq = useRef(0);

  // A failed load used to be swallowed and the page rendered em-dashes and
  // "No data yet" as if the platform were empty. Say it failed, and offer a retry.
  const load = useCallback(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError(false);
    getAnalytics()
      .then((r) => {
        if (seq !== requestSeq.current) return;
        setData(r.data);
        setUpdatedAt(new Date());
        setRefreshFailedAt(null);
      })
      .catch(() => { if (seq === requestSeq.current) setLoadError(true); })
      .finally(() => { if (seq === requestSeq.current) setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Kept current while the page is open (launch night is watched from this
  // screen). A failed refresh keeps the last figures on screen and says how old
  // they are, rather than blanking the page.
  const refresh = useCallback(() => {
    const seq = ++requestSeq.current;
    getAnalytics()
      .then((r) => {
        if (seq !== requestSeq.current) return;
        setData(r.data);
        setUpdatedAt(new Date());
        setRefreshFailedAt(null);
      })
      .catch(() => { if (seq === requestSeq.current) setRefreshFailedAt(new Date()); });
  }, []);

  useAutoRefresh(refresh, REFRESH_MS, Boolean(data) && !loading);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
              <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-4 w-24 mt-2" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <Skeleton className="h-4 w-40 mb-4" />
              <Skeleton className="h-[200px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center max-w-md mx-auto mt-10">
        <FiAlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Couldn't load the dashboard</h2>
        <p className="text-sm text-gray-500 mb-5">The figures did not come back, so nothing is shown rather than showing zeros.</p>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium">
          Try again
        </button>
      </div>
    );
  }

  const stats = data?.stats || {};
  // null = this admin lacks the revenue scope (not "no revenue").
  const showRevenue = stats.revenueThisMonth !== null && stats.revenueThisMonth !== undefined;
  const registrations = data?.registrations || [];
  const revenue = data?.revenue || [];
  const planDist = data?.planDistribution || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Overview of TricityMatch platform</p>
        </div>
        {refreshFailedAt ? (
          <p className="text-xs text-amber-800" role="status">
            Couldn&apos;t refresh at {clock(refreshFailedAt)}. Showing figures from {updatedAt ? clock(updatedAt) : 'earlier'}.
          </p>
        ) : updatedAt ? (
          <p className="text-xs text-gray-500">Updated {clock(updatedAt)} · refreshes every minute</p>
        ) : null}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={FiUsers}       label="Total Users"         value={stats.totalUsers}         color="rose" />
        <KpiCard icon={FiCheckCircle} label="Photo-verified"      value={stats.verifiedUsers}      color="rose"
          sub={stats.emailVerifiedUsers != null ? `${stats.emailVerifiedUsers} with a verified email` : undefined} />
        {/* Members whose plan was bought with real money, each counted once.
            Founding places and staff grants are premium without payment. */}
        <KpiCard icon={FiCreditCard}  label="Paying Members"      value={stats.paidSubscribers ?? stats.activeSubscribers} color="rose"
          sub={[
            stats.foundingActive != null ? `plus ${stats.foundingActive} founding` : null,
            stats.staffGrantedActive != null ? `${stats.staffGrantedActive} granted by staff` : null,
          ].filter(Boolean).join(' · ') || undefined} />
        <KpiCard icon={FiTrendingUp}  label="Revenue (This Month)"
          value={showRevenue ? `₹${Number(stats.revenueThisMonth).toLocaleString('en-IN')}` : 'None'}
          sub={showRevenue ? undefined : 'Revenue access required'} color="rose" />
      </div>

      {/* Today (India time) and the work that is waiting. Each tile opens the
          page where it is dealt with. */}
      {(() => {
        const tiles = [
          { to: '/admin/users?joined=today', icon: FiUserPlus, label: 'Signups today', value: stats.signupsToday ?? 0 },
          stats.paymentsToday != null && {
            to: '/admin/revenue', icon: FiCreditCard, label: 'Payments today', value: stats.paymentsToday,
          },
          {
            to: '/admin/reports?priority=urgent', icon: FiFlag, label: 'Urgent reports open', value: stats.urgentOpenReports ?? 0,
            sub: 'Act within 24 hours', alert: (stats.urgentOpenReports || 0) > 0,
          },
          { to: '/admin/appeals', icon: FiRotateCcw, label: 'Appeals waiting', value: stats.pendingAppeals ?? 0 },
          {
            to: '/admin/contact-messages', icon: FiMail, label: 'Oldest unread enquiry',
            value: stats.oldestUnreadSupportAt ? waitedFor(stats.oldestUnreadSupportAt) : 'None waiting',
            sub: stats.unreadSupport ? `${stats.unreadSupport} unread` : undefined,
          },
        ].filter((tile) => tile && canOpen(tile.to));
        if (!tiles.length) return null;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {tiles.map((tile) => <QueueTile key={tile.to} {...tile} />)}
          </div>
        );
      })()}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Registrations over time */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-gray-500">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Registrations (Last 30 days)</h2>
          {registrations.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={registrations}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="chart-grid" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#8B2346" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Revenue over time */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-gray-500">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Revenue (₹)</h2>
          {revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="chart-grid" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'currentColor' }} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} allowDecimals={false} width={64} tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="amount" fill="#8B2346" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">{showRevenue ? 'No data yet' : 'Revenue access required'}</div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plan distribution */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Subscription Plans</h2>
          {planDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={planDist} dataKey="count" nameKey="plan" outerRadius={64}>
                  {planDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span className="text-gray-700">{planLabel(value)}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">{showRevenue ? 'No data yet' : 'Revenue access required'}</div>
          )}
        </div>

        {/* Quick links */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pending Verifications', to: '/admin/verifications', badge: stats.pendingVerifications },
              // Waiting and under review: opening a report no longer drops it off.
              { label: 'Open Reports',          to: '/admin/reports',       badge: stats.openReports },
              // An enquiry could previously sit unanswered indefinitely: nothing
              // anywhere in the panel said one had arrived.
              { label: 'Unread Support',        to: '/admin/contact-messages', badge: stats.unreadSupport },
              // The same members the count is taken over: active member accounts.
              { label: 'Profiles With No Photo', to: '/admin/users?hasPhoto=no&role=user&status=active', badge: stats.profilesWithoutPhoto },
              { label: 'Funnel',                to: '/admin/funnel' },
              { label: 'View Revenue',          to: '/admin/revenue' },
            ].filter(({ to }) => canOpen(to)).map(({ label, to, badge }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-sm font-medium text-gray-700 hover:text-primary-700"
              >
                <span>{label}</span>
                {badge != null && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                    {badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Founding window — capped AND time-boxed, and until now neither figure
          was visible anywhere. Both are spendable: the cap by signups, the
          deadline by the calendar. */}
      {stats.founding && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Founding window</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {stats.founding.open
                  ? `Open: new members are granted ${stats.founding.contactUnlocks} unlocks for ${stats.founding.grantDays} days, free.`
                  : 'Closed: new signups no longer receive a founding grant.'}
              </p>
            </div>
            {canOpen('/admin/launch-offer') && (
              <Link to="/admin/launch-offer" className="text-xs font-medium text-primary-700 hover:underline">
                Edit in Pricing &amp; Offers
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-lg font-bold text-gray-900 tabular-nums">
                {stats.founding.granted} / {stats.founding.memberCap}
              </p>
              <p className="text-xs text-gray-500">Grants used</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">
                {stats.founding.endsAt
                  ? new Date(stats.founding.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'No end date'}
              </p>
              <p className="text-xs text-gray-500">Closes</p>
            </div>
            <div>
              <p className={`text-lg font-bold ${stats.founding.open ? 'text-green-600' : 'text-gray-400'}`}>
                {stats.founding.open ? 'Open' : 'Closed'}
              </p>
              <p className="text-xs text-gray-500">Status</p>
            </div>
          </div>
          {stats.founding.memberCap > 0 && (
            <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-600"
                style={{ width: `${Math.min(100, (stats.founding.granted / stats.founding.memberCap) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
