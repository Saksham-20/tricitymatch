import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCw, FiCheckCircle, FiCircle, FiUsers, FiSearch, FiChevronLeft, FiChevronRight, FiExternalLink } from 'react-icons/fi';
import { useDebounce } from '../../hooks/useDebounce';
import toast from 'react-hot-toast';
import apiClient from '../../api/apiClient';
import { reassignPartnerLeads } from '../../api/adminApi';
import ReassignLeadsDialog from '../../components/admin/ReassignLeadsDialog';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import ReportSummary from '../../components/marketing/ReportSummary';
import MemberReportTable from '../../components/marketing/MemberReportTable';
import PayoutSection from '../../components/marketing/PayoutSection';
import RecordPayoutForm from '../../components/admin/RecordPayoutForm';
import PartnerAccountCard from '../../components/admin/PartnerAccountCard';
import { useAdminScopes } from '../../components/admin/AdminLayout';

export default function AdminMarketingUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const scopes = useAdminScopes();
  const canPayouts = !scopes || scopes.includes('payouts');
  const [user, setUser] = useState(null);
  const [report, setReport] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [openLeads, setOpenLeads] = useState(0);
  const [handingOver, setHandingOver] = useState(false);
  const [codes, setCodes] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  // The invited-members list used to be one fetch of 50 with no paging and no
  // search, so a partner past 50 people had members an admin could not see.
  const [memberSearch, setMemberSearch] = useState('');
  const debouncedSearch = useDebounce(memberSearch.trim(), 350);
  const [memberFilter, setMemberFilter] = useState({ signedUp: '', paid: '' });
  const [memberPage, setMemberPage] = useState(1);
  const loadedRef = useRef(false);

  const fetchAll = useCallback(async (opts = {}) => {
    const { quiet = false } = opts;
    try {
      if (quiet) setRefreshing(true); else setLoading(true);
      // The same report the rep sees for themselves — one builder, one story.
      const [reportRes, codesRes, payoutRes] = await Promise.all([
        apiClient.get(`/admin/marketing-users/${userId}/report?${new URLSearchParams({
          limit: '25',
          page: String(memberPage),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(memberFilter.signedUp ? { signedUp: memberFilter.signedUp } : {}),
          ...(memberFilter.paid ? { paid: memberFilter.paid } : {}),
        })}`),
        apiClient.get(`/admin/referral-codes?marketingUserId=${userId}&limit=50`),
        apiClient.get(`/admin/marketing-users/${userId}/payouts`),
      ]);
      setUser(reportRes.data.user);
      setReport(reportRes.data);
      setOnboarding(reportRes.data.onboarding || null);
      setOpenLeads(reportRes.data.openLeads || 0);
      setCodes(codesRes.data.codes);
      setLedger(payoutRes.data);
      setLastUpdated(new Date());
      setError('');
      loadedRef.current = true;
    } catch (err) {
      // A failed background refresh (auto-refresh, a filter change) keeps the
      // page that is already on screen instead of replacing it with an error.
      if (quiet && loadedRef.current) toast.error('Could not refresh. Showing the last loaded figures.', { id: 'rep-refresh' });
      else setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, memberPage, debouncedSearch, memberFilter]);

  // Every payout write returns the recomputed ledger, so the balance on screen
  // is the server's answer rather than one the client added up itself.
  const handleRecordPayout = async (payload) => {
    const res = await apiClient.post(`/admin/marketing-users/${userId}/payouts`, payload);
    setLedger({ summary: res.data.summary, payouts: res.data.payouts });
  };

  const handlePayoutStatus = async (payoutId, status) => {
    // The bank's reference (UTR) ties the row to the statement line.
    const reference = status === 'paid' ? window.prompt('Bank reference / UTR for this transfer (optional):', '') : null;
    if (reference === null && status === 'paid') return;
    const res = await apiClient.put(`/admin/marketing-payouts/${payoutId}`, { status, ...(reference ? { reference: reference.trim() } : {}) });
    setLedger({ summary: res.data.summary, payouts: res.data.payouts });
  };

  // Voiding keeps the row (it is the record that money left) and needs a reason.
  // One click used to destroy a paid payout with nothing recorded.
  const handlePayoutVoid = async (payout) => {
    const amount = `₹${Number(payout.amount).toLocaleString('en-IN')}`;
    const reason = window.prompt(
      `Void this ${payout.status === 'paid' ? 'PAID ' : ''}payout of ${amount}?\n\nIt stays in the history, marked voided, and stops counting toward the balance. Enter the reason (min 5 characters):`
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      setError('A reason of at least 5 characters is required to void a payout');
      return;
    }
    try {
      const res = await apiClient.delete(`/admin/marketing-payouts/${payout.id}`, { data: { reason: reason.trim() } });
      setLedger({ summary: res.data.summary, payouts: res.data.payouts });
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Could not void the payout');
    }
  };

  useEffect(() => { fetchAll({ quiet: loadedRef.current }); }, [fetchAll]);
  useEffect(() => { setMemberPage(1); }, [debouncedSearch, memberFilter]);
  useAutoRefresh(() => fetchAll({ quiet: true }), 20000);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-3">{error}</div>
        <button onClick={() => fetchAll()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Try again</button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <button
        onClick={() => navigate('/admin/marketing-users')}
        className="flex items-center gap-2 min-h-[44px] text-gray-600 hover:text-gray-900 mb-4"
      >
        <FiArrowLeft size={18} /> Back to Marketing Users
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">
            {[user?.Profile?.firstName, user?.Profile?.lastName].filter(Boolean).join(' ') || user?.email || 'Marketing partner'}
          </h1>
          {user && (
            <p className="text-gray-600 break-all">
              {user.email} · {user.role === 'marketing_manager' ? 'Manager' : 'Partner'}
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
          <FiRefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Refresh'}
        </button>
      </div>

      {user && <PartnerAccountCard user={user} onChanged={() => fetchAll({ quiet: true })} />}

      {onboarding && (
        <section aria-label="Partner setup" className="mb-8 bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Setup · {onboarding.completed} of {onboarding.total} done
          </h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {[
              ['agreement', onboarding.agreementAcceptedAt
                ? `Accepted the Partner Guide on ${new Date(onboarding.agreementAcceptedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : (onboarding.needsReacceptance ? 'Must re-accept the updated guide' : 'Has not accepted the Partner Guide')],
              ['payout', onboarding.steps.payout ? 'Payout details saved' : 'No payout details yet'],
              ['code', onboarding.steps.code ? 'Has a referral code' : 'No referral code yet'],
              ['outreach', onboarding.steps.outreach ? 'Has members or leads' : 'No members or leads yet'],
            ].map(([key, text]) => {
              const done = Boolean(onboarding.steps[key]);
              const Icon = done ? FiCheckCircle : FiCircle;
              return (
                <li key={key} className={`inline-flex items-center gap-1.5 ${done ? 'text-gray-700' : 'text-amber-800 font-medium'}`}>
                  <Icon size={15} aria-hidden="true" className={done ? 'text-green-600' : 'text-amber-600'} />
                  {text}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {openLeads > 0 && user && (
        <section
          aria-label="Open leads"
          className={`mb-8 rounded-2xl p-5 border flex flex-wrap items-center justify-between gap-4 ${
            user.status === 'active' ? 'bg-white border-gray-200' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <FiUsers className={`mt-0.5 ${user.status === 'active' ? 'text-gray-500' : 'text-amber-700'}`} size={18} aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {openLeads} open {openLeads === 1 ? 'lead' : 'leads'}
              </h2>
              <p className="text-sm text-gray-700 mt-0.5">
                {user.status === 'active'
                  ? 'People this partner added who have not joined yet.'
                  : 'This partner is not active, so nobody is following these people up and a signup from them earns no one commission. Give them to another partner.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHandingOver(true)}
            className="min-h-[44px] px-4 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-800"
          >
            Move to another partner
          </button>
        </section>
      )}

      {report?.summary && <ReportSummary summary={report.summary} className="mb-8" commissionLabel="Rep commission" />}

      {ledger && (
        <div className="mb-8">
          <PayoutSection
            ledger={ledger}
            title="Payouts to this rep"
            actions={canPayouts ? (p) => (
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
                  onClick={() => handlePayoutVoid(p)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Void
                </button>
              </div>
            ) : undefined}
          >
            {canPayouts && <RecordPayoutForm outstanding={ledger.summary.payable} inHold={ledger.summary.inHold} onSubmit={handleRecordPayout} />}
          </PayoutSection>
        </div>
      )}

      <section aria-labelledby="members-title" className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <h2 id="members-title" className="text-xl font-bold">
            Invited members ({report?.pagination?.total ?? 0})
          </h2>
          <Link
            to={`/admin/leads?marketingUserId=${userId}`}
            className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-primary-700 hover:underline"
          >
            Open in Partner members <FiExternalLink size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="col-span-2 relative">
            <label htmlFor="rep-member-search" className="sr-only">Search this partner's members</label>
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
            <input
              id="rep-member-search"
              type="search"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search name, phone, email or code"
              className="w-full min-h-[44px] border border-gray-300 rounded-lg pl-9 pr-3 text-sm bg-white"
            />
          </div>
          <div>
            <label htmlFor="rep-member-joined" className="sr-only">Joined</label>
            <select
              id="rep-member-joined"
              value={memberFilter.signedUp}
              onChange={(e) => setMemberFilter((f) => ({ ...f, signedUp: e.target.value }))}
              className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm bg-white"
            >
              <option value="">Joined or not</option>
              <option value="yes">Became a member</option>
              <option value="no">Not joined yet</option>
            </select>
          </div>
          <div>
            <label htmlFor="rep-member-paid" className="sr-only">Paid</label>
            <select
              id="rep-member-paid"
              value={memberFilter.paid}
              onChange={(e) => setMemberFilter((f) => ({ ...f, paid: e.target.value }))}
              className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm bg-white"
            >
              <option value="">Paid or not</option>
              <option value="yes">Paid</option>
              <option value="no">Not paid</option>
            </select>
          </div>
        </div>
        {!report?.members?.length ? (
          <div className="bg-white p-6 rounded-lg text-gray-500 border border-gray-200">
            {debouncedSearch || memberFilter.signedUp || memberFilter.paid ? 'Nobody matches these filters.' : 'No members invited yet'}
          </div>
        ) : (
          <MemberReportTable members={report.members} memberHref={(m) => `/admin/users/${m.memberId}`} />
        )}
        {(report?.pagination?.pages || 1) > 1 && (
          <nav aria-label="Member pages" className="flex items-center justify-between gap-3 mt-4">
            <button type="button" onClick={() => setMemberPage((p) => Math.max(1, p - 1))} disabled={memberPage <= 1} className="inline-flex items-center gap-1 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-40">
              <FiChevronLeft size={16} aria-hidden="true" /> Previous
            </button>
            <span className="text-sm text-gray-600">Page {memberPage} of {report.pagination.pages}</span>
            <button type="button" onClick={() => setMemberPage((p) => Math.min(report.pagination.pages, p + 1))} disabled={memberPage >= report.pagination.pages} className="inline-flex items-center gap-1 min-h-[44px] px-3 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-40">
              Next <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        )}
      </section>

      <div>
        <h2 className="text-xl font-bold mb-4">Referral Codes ({codes.length})</h2>
        {codes.length === 0 ? (
          <div className="bg-white p-4 rounded-lg text-gray-500 border border-gray-200">No codes assigned</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {codes.map(code => (
              <div key={code.id} className="bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className="font-mono font-bold break-all">{code.code}</p>
                  {code.campaign && <p className="text-sm text-gray-600">{code.campaign}</p>}
                </div>
                <div className="text-right shrink-0">
                  <Link to={`/admin/leads?marketingUserId=${userId}&search=${encodeURIComponent(code.code)}`} className="block font-bold text-primary-600 hover:underline">
                    {code.usageCount} {code.usageCount === 1 ? 'signup' : 'signups'}
                  </Link>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {code.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {handingOver && (
        <ReassignLeadsDialog
          title="Move open leads"
          intro={`Gives ${user?.email || 'this partner'}'s ${openLeads} open ${openLeads === 1 ? 'lead' : 'leads'} to another active partner.`}
          confirmLabel={`Move ${openLeads} ${openLeads === 1 ? 'lead' : 'leads'}`}
          excludeId={userId}
          onClose={() => setHandingOver(false)}
          onConfirm={async (toUserId) => {
            const res = await reassignPartnerLeads(userId, toUserId);
            toast.success(res.data?.message || 'Leads moved');
            setHandingOver(false);
            fetchAll({ quiet: true });
          }}
        />
      )}
    </div>
  );
}
