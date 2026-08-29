import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getAnalytics } from '../../api/adminApi';
import { FiUsers, FiCheckCircle, FiCreditCard, FiTrendingUp, FiFlag } from 'react-icons/fi';

// Brand-family ramp (burgundy → gold → muted tints); no off-brand green/blue/purple.
const COLORS = ['#8B2346', '#C9A227', '#B76E79', '#5E1730', '#D8B24A'];

const KpiCard = ({ icon: Icon, label, value, sub, color = 'rose' }) => {
  const colorMap = {
    rose: 'bg-primary-100 text-primary-700',
    gold: 'bg-gold-50 text-gold-700',
  };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const registrations = data?.registrations || [];
  const revenue = data?.revenue || [];
  const planDist = data?.planDistribution || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Overview of TricityMatch platform</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={FiUsers}       label="Total Users"         value={stats.totalUsers}         color="rose" />
        <KpiCard icon={FiCheckCircle} label="Verified Users"      value={stats.verifiedUsers}      color="rose" />
        <KpiCard icon={FiCreditCard}  label="Active Subscribers"  value={stats.activeSubscribers}  color="rose" />
        <KpiCard icon={FiTrendingUp}  label="Revenue (This Month)" value={stats.revenueThisMonth ? `₹${stats.revenueThisMonth.toLocaleString('en-IN')}` : '—'} color="gold" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Registrations over time */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Registrations (Last 30 days)</h3>
          {registrations.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={registrations}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="chart-grid" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#be123c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Revenue over time */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Revenue (₹)</h3>
          {revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="chart-grid" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="amount" fill="#be123c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plan distribution */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Subscription Plans</h3>
          {planDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={planDist} dataKey="count" nameKey="plan" outerRadius={64}>
                  {planDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Quick links */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pending Verifications', to: '/admin/verifications', badge: stats.pendingVerifications },
              { label: 'Open Reports',          to: '/admin/reports',       badge: stats.openReports },
              // An enquiry could previously sit unanswered indefinitely: nothing
              // anywhere in the panel said one had arrived.
              { label: 'Unread Support',        to: '/admin/contact-messages', badge: stats.unreadSupport },
              { label: 'Profiles With No Photo', to: '/admin/users',        badge: stats.profilesWithoutPhoto },
              { label: 'Funnel',                to: '/admin/funnel' },
              { label: 'View Revenue',          to: '/admin/revenue' },
            ].map(({ label, to, badge }) => (
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
              <h3 className="text-sm font-semibold text-gray-700">Founding window</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {stats.founding.open
                  ? `Open — new members are granted ${stats.founding.contactUnlocks} unlocks for ${stats.founding.grantDays} days, free.`
                  : 'Closed — new signups no longer receive a founding grant.'}
              </p>
            </div>
            <Link to="/admin/launch-offer" className="text-xs font-medium text-primary-700 hover:underline">
              Edit in Pricing &amp; Offers
            </Link>
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
