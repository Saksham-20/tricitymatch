import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import apiClient from '../../api/apiClient';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import ReportSummary from '../../components/marketing/ReportSummary';
import MemberReportTable from '../../components/marketing/MemberReportTable';
import PayoutSection from '../../components/marketing/PayoutSection';

export default function MarketingDashboard() {
  const [report, setReport] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchReport = useCallback(async (opts = {}) => {
    const { quiet = false } = opts;
    try {
      if (quiet) setRefreshing(true); else setLoading(true);
      // Limit 5: the dashboard shows the latest few; My Members has the rest.
      const [reportRes, payoutRes] = await Promise.all([
        apiClient.get('/marketing/report?limit=5'),
        apiClient.get('/marketing/payouts'),
      ]);
      setReport(reportRes.data);
      setLedger(payoutRes.data);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);
  useAutoRefresh(() => fetchReport({ quiet: true }), 20000);

  if (loading) {
    return <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">Loading…</div>;
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Marketing Dashboard</h1>
        <button
          onClick={() => fetchReport({ quiet: true })}
          className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {report?.summary && <ReportSummary summary={report.summary} className="mb-8" />}

      {ledger && (
        <div className="mb-8">
          <PayoutSection ledger={ledger} />
        </div>
      )}

      {report?.members?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-serif font-bold mb-4 text-neutral-900 dark:text-neutral-100">Latest members</h2>
          <MemberReportTable members={report.members} />
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 rounded-xl">
        <h2 className="text-xl font-serif font-bold mb-4 text-neutral-900 dark:text-neutral-100">How It Works</h2>
        <ol className="space-y-3 text-neutral-700 dark:text-neutral-300 list-none">
          {[
            <>Go to <strong className="text-neutral-900 dark:text-neutral-100">Referral Codes</strong> and generate a code for your campaign.</>,
            <>Copy the share link — it opens the signup page with your code pre-filled.</>,
            <>Every signup via your link appears in <strong className="text-neutral-900 dark:text-neutral-100">My Members</strong> and increments your code's signup count.</>,
            <>When a member pays, their plan and amount show up here automatically.</>,
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200 text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
