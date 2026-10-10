import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiArrowDown, FiFilter, FiRefreshCw, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { getFunnel } from '../../api/adminApi';

/**
 * The signup funnel.
 *
 * Until this page existed the events were being collected and read by nobody —
 * the only way to see them was a SQL script. Every row is a real count from
 * AnalyticsEvents except the last, which comes from Subscriptions so it can
 * never disagree with revenue.
 *
 * Two numbers per stage on purpose: the count, and the same window immediately
 * before it. A single total cannot tell you whether a quiet week is normal.
 */

// The first window is the last 24 hours (on launch day, "today so far" is the
// question), counted back from now rather than from midnight.
const WINDOWS = [
  { days: 1, label: '24 hours' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export default function AdminFunnel() {
  const [days, setDays] = useState(30);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Switching windows quickly must not leave an older window's numbers showing.
  const requestSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getFunnel({ days });
      if (seq !== requestSeq.current) return;
      setStages(res.data.stages || []);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err?.response?.data?.error?.message || 'Could not load the funnel');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const top = stages.length ? Math.max(...stages.map((s) => s.count)) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funnel</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Where people stop. Traffic stages are reported by the browser; the account stages are
            recorded server-side, and “Paid” is counted from real payments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              aria-pressed={days === w.days}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === w.days ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {w.label}
            </button>
          ))}
          <button
            onClick={load}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
            aria-label="Refresh"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="skeleton h-4 w-40 rounded" />
                <div className="skeleton h-5 w-12 rounded" />
              </div>
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
          <p className="text-sm text-gray-600 mb-3">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl bg-primary-700 text-white text-sm font-medium">Retry</button>
        </div>
      ) : stages.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <FiFilter className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No events recorded for this window yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {stages.map((stage, i) => {
            const prevStage = i > 0 ? stages[i - 1] : null;
            // Step conversion against the stage above, which is the number that
            // tells you which screen to fix.
            // Stages are ordered but NOT strictly nested — an early member can
            // have sent an interest without ever tripping the traffic beacon,
            // which produced the nonsense "300% of the stage above got this
            // far". Only show the ratio where it actually reads as a drop-off.
            const rawRate = prevStage && prevStage.count > 0
              ? Math.round((stage.count / prevStage.count) * 100)
              : null;
            const stepRate = rawRate !== null && rawRate <= 100 ? rawRate : null;
            const delta = stage.count - stage.previous;
            const width = top > 0 ? Math.max((stage.count / top) * 100, stage.count > 0 ? 2 : 0) : 0;

            return (
              <div key={stage.key} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-gray-800">{stage.label}</span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-lg font-bold text-gray-900 tabular-nums">{stage.count}</span>
                    {stage.previous > 0 || stage.count > 0 ? (
                      <span className={`text-xs tabular-nums inline-flex items-center gap-1 ${
                        delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {delta > 0 ? <FiTrendingUp className="w-3 h-3" /> : delta < 0 ? <FiTrendingDown className="w-3 h-3" /> : null}
                        {delta > 0 ? '+' : ''}{delta} vs previous
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-600" style={{ width: `${width}%` }} />
                </div>
                {stepRate !== null && (
                  <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                    <FiArrowDown className="w-3 h-3" />
                    {stepRate}% of “{prevStage.label}” got this far
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Traffic stages count visits, not people — one person opening the site twice counts twice.
        Account stages count each member once, and only from the day that stage began being
        recorded, so an early member can appear further down the funnel than above it.
      </p>
    </div>
  );
}
