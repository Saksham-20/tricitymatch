import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import apiClient from '../../api/apiClient';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import ReportSummary from '../../components/marketing/ReportSummary';
import MemberReportTable from '../../components/marketing/MemberReportTable';
import PayoutSection from '../../components/marketing/PayoutSection';
import RecordPayoutForm from '../../components/admin/RecordPayoutForm';

export default function AdminMarketingUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [report, setReport] = useState(null);
  const [codes, setCodes] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async (opts = {}) => {
    const { quiet = false } = opts;
    try {
      if (quiet) setRefreshing(true); else setLoading(true);
      // The same report the rep sees for themselves — one builder, one story.
      const [reportRes, codesRes, payoutRes] = await Promise.all([
        apiClient.get(`/admin/marketing-users/${userId}/report?limit=50`),
        apiClient.get(`/admin/referral-codes?marketingUserId=${userId}&limit=50`),
        apiClient.get(`/admin/marketing-users/${userId}/payouts`),
      ]);
      setUser(reportRes.data.user);
      setReport(reportRes.data);
      setCodes(codesRes.data.codes);
      setLedger(payoutRes.data);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // Every payout write returns the recomputed ledger, so the balance on screen
  // is the server's answer rather than one the client added up itself.
  const handleRecordPayout = async (payload) => {
    const res = await apiClient.post(`/admin/marketing-users/${userId}/payouts`, payload);
    setLedger({ summary: res.data.summary, payouts: res.data.payouts });
  };

  const handlePayoutStatus = async (payoutId, status) => {
    const res = await apiClient.put(`/admin/marketing-payouts/${payoutId}`, { status });
    setLedger({ summary: res.data.summary, payouts: res.data.payouts });
  };

  const handlePayoutDelete = async (payoutId) => {
    const res = await apiClient.delete(`/admin/marketing-payouts/${payoutId}`);
    setLedger({ summary: res.data.summary, payouts: res.data.payouts });
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useAutoRefresh(() => fetchAll({ quiet: true }), 20000);

  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;
  if (error) return <div className="p-6"><div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div></div>;

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/admin/marketing-users')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={18} /> Back to Marketing Users
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Marketing User Detail</h1>
          {user && (
            <p className="text-gray-600">
              {user.Profile?.firstName} {user.Profile?.lastName} — {user.email} ({user.role})
              <span className={`ml-3 text-xs px-2 py-0.5 rounded-full ${
                user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>{user.status}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => fetchAll({ quiet: true })}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Refresh'}
        </button>
      </div>

      {report?.summary && <ReportSummary summary={report.summary} className="mb-8" commissionLabel="Rep commission" />}

      {ledger && (
        <div className="mb-8">
          <PayoutSection
            ledger={ledger}
            title="Payouts to this rep"
            actions={(p) => (
              <div className="flex items-center justify-end gap-3">
                {p.status === 'pending' ? (
                  <button
                    onClick={() => handlePayoutStatus(p.id, 'paid')}
                    className="text-xs font-medium text-green-700 hover:underline"
                  >
                    Mark paid
                  </button>
                ) : (
                  <button
                    onClick={() => handlePayoutStatus(p.id, 'pending')}
                    className="text-xs font-medium text-gray-500 hover:underline"
                  >
                    Mark queued
                  </button>
                )}
                <button
                  onClick={() => handlePayoutDelete(p.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
          >
            <RecordPayoutForm outstanding={ledger.summary.outstanding} onSubmit={handleRecordPayout} />
          </PayoutSection>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">
          Invited members ({report?.pagination?.total ?? 0})
        </h2>
        {!report?.members?.length ? (
          <div className="bg-white p-6 rounded-lg text-gray-500 border border-gray-200">
            No members invited yet
          </div>
        ) : (
          <MemberReportTable members={report.members} />
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Referral Codes ({codes.length})</h2>
        {codes.length === 0 ? (
          <div className="bg-white p-4 rounded-lg text-gray-500 border border-gray-200">No codes assigned</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {codes.map(code => (
              <div key={code.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                <div>
                  <p className="font-mono font-bold">{code.code}</p>
                  {code.campaign && <p className="text-sm text-gray-600">{code.campaign}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-600">{code.usageCount} signups</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {code.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
