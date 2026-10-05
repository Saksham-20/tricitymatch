import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiSearch, FiRefreshCw, FiUsers, FiUserCheck, FiCheckCircle, FiTrendingUp, FiCreditCard, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { getMarketingTeam } from '../../api/adminApi';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';

/**
 * Team overview, for marketing managers (and admins looking in).
 *
 * Every partner's funnel and commission side by side, so a manager can see who
 * is converting and who is stuck. Numbers only: it deliberately carries no
 * member names or contact details and nothing about payouts. Those stay with
 * the partner who earned them and with admins.
 */

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const num = (n) => Number(n || 0).toLocaleString('en-IN');

const Tile = ({ icon: Icon, label, value, hint }) => (
  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
      <Icon size={20} aria-hidden="true" />
    </div>
    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">{value}</p>
    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-1">{label}</p>
    {hint && <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{hint}</p>}
  </div>
);

const COLUMNS = [
  { key: 'name', label: 'Partner', align: 'left' },
  { key: 'totalLeads', label: 'Invited', align: 'right' },
  { key: 'signedUp', label: 'Signed up', align: 'right' },
  { key: 'paidMembers', label: 'Paid', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
  { key: 'commissionEarned', label: 'Commission', align: 'right' },
  { key: 'openLeads', label: 'Open leads', align: 'right' },
  { key: 'setup', label: 'Setup', align: 'right' },
];

const sortValue = (row, key) => {
  if (key === 'name') return row.name.toLowerCase();
  if (key === 'setup') return row.setup ? row.setup.completed / (row.setup.total || 1) : -1;
  return row[key] ?? 0;
};

export default function MarketingTeam() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null); // { status, message }
  const [lastUpdated, setLastUpdated] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'revenue', dir: 'desc' });

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const res = await getMarketingTeam();
      setData(res.data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // A refresh that fails must not wipe a page that is already showing numbers.
      if (!quiet) setError({ status: err?.response?.status, message: err?.response?.data?.error?.message || 'Could not load the team numbers.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(() => load({ quiet: true }), 30000, !error || error.status !== 403);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.partners || []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.name.localeCompare(b.name);
    });
  }, [data, query, sort]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const t = data?.totals;

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Team</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">
            How every partner is doing, side by side. These are numbers only: no member names, contact details or payout information.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ quiet: true })}
          className="min-h-[44px] inline-flex items-center gap-2 px-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-primary-700"
        >
          <FiRefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div aria-busy="true" aria-label="Loading the team numbers">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : error ? (
        error.status === 403 ? (
          <EmptyState icon={FiUsers} title="This view is for marketing managers" description="Your own numbers are on your dashboard." />
        ) : (
          <ErrorState title="Couldn't load the team" description={error.message} onRetry={() => load()} />
        )
      ) : !data?.partners?.length ? (
        <EmptyState icon={FiUsers} title="No partners yet" description="Once an admin creates partner accounts, their numbers appear here." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Tile icon={FiUsers} label="Partners" value={num(t.partners)} hint={`${num(t.activePartners)} active`} />
            <Tile icon={FiUsers} label="Invited" value={num(t.totalLeads)} hint={t.openLeads ? `${num(t.openLeads)} not joined yet` : null} />
            <Tile icon={FiUserCheck} label="Signed up" value={num(t.signedUp)} />
            <Tile icon={FiCheckCircle} label="Paid members" value={num(t.paidMembers)} />
            <Tile icon={FiTrendingUp} label="Revenue" value={inr(t.revenue)} hint="Net of refunds" />
            <Tile icon={FiCreditCard} label="Commission earned" value={inr(t.commissionEarned)} />
          </div>

          {data.truncated && (
            <p role="status" className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-900">
              Showing the most recent partners only. Ask an admin for the full list.
            </p>
          )}

          <div className="relative max-w-sm mb-4">
            <label htmlFor="team-search" className="sr-only">Search partners</label>
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
            <input
              id="team-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="w-full pl-9 pr-3 min-h-[44px] rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={FiSearch} title="Nobody matches that search" description="Try a different name or email." actionLabel="Clear search" onAction={() => setQuery('')} />
          ) : (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                    {COLUMNS.map((c) => {
                      const active = sort.key === c.key;
                      return (
                        <th
                          key={c.key}
                          scope="col"
                          aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className={`inline-flex items-center gap-1 min-h-[44px] uppercase tracking-wide hover:text-neutral-900 dark:hover:text-neutral-100 ${c.align === 'right' ? 'flex-row-reverse' : ''}`}
                          >
                            {c.label}
                            {active && (sort.dir === 'asc' ? <FiChevronUp size={14} aria-hidden="true" /> : <FiChevronDown size={14} aria-hidden="true" />)}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {rows.map((p) => (
                    <tr key={p.id} className="text-neutral-800 dark:text-neutral-200">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 break-all">
                          {p.name !== p.email && <>{p.email} · </>}
                          {p.role === 'marketing_manager' ? 'Manager' : 'Partner'}
                          {p.status !== 'active' && <span className="ml-2 px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200">{p.status}</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(p.totalLeads)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(p.signedUp)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(p.paidMembers)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{inr(p.revenue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {inr(p.commissionEarned)}
                        <span className="block text-xs text-neutral-600 dark:text-neutral-400">at {p.commissionRate}%</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(p.openLeads)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.setup ? (
                          <span className={p.setup.completed >= p.setup.total ? 'text-green-700 dark:text-green-400' : 'text-amber-800 dark:text-amber-300 font-medium'}>
                            {p.setup.completed} of {p.setup.total}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
