import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getRevenueReport } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiDownload } from 'react-icons/fi';

const KPI = ({ label, value }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    <p className="text-sm text-gray-500 mt-0.5">{label}</p>
  </div>
);

function exportCSV(rows) {
  const headers = ['Month', 'Total Revenue (₹)', 'Subscriptions'];
  const csv = [headers, ...rows.map((r) => [r.month, r.amount, r.count])].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'revenue-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminRevenue() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear]       = useState(new Date().getFullYear());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRevenueReport({ year });
      setData(res.data);
    } catch {
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthly   = data?.monthly || [];
  const summary   = data?.summary || {};
  const byPlan    = data?.byPlan  || [];
  const yearRange = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-gray-500 text-sm mt-0.5">Financial overview and reports</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            {yearRange.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => monthly.length && exportCSV(monthly)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
          >
            <FiDownload className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI label={`Total Revenue ${year}`} value={summary.totalRevenue ? `₹${Number(summary.totalRevenue).toLocaleString('en-IN')}` : '—'} />
        <KPI label="Total Subscriptions"     value={summary.totalSubscriptions ?? '—'} />
        <KPI label="Avg. Revenue / Sub"      value={summary.avgRevenue ? `₹${Number(summary.avgRevenue).toFixed(0)}` : '—'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Revenue (₹)</h3>
          {loading ? (
            <div className="h-[220px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-600" />
            </div>
          ) : monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="amount" fill="#be123c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data for {year}</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Subscriptions</h3>
          {!loading && monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data for {year}</div>
          )}
        </div>
      </div>

      {/* By-plan breakdown */}
      {byPlan.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Plan</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 rounded-lg">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Subscriptions</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue (₹)</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byPlan.map((p) => (
                  <tr key={p.plan} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800 capitalize">{p.plan}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.count}</td>
                    <td className="px-4 py-2.5 text-gray-600">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {summary.totalRevenue ? `${((p.amount / summary.totalRevenue) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly table */}
      {monthly.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Month</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Subscriptions</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthly.map((m) => (
                  <tr key={m.month} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{m.month}</td>
                    <td className="px-4 py-2.5 text-gray-600">{m.count}</td>
                    <td className="px-4 py-2.5 text-gray-600">₹{Number(m.amount).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
