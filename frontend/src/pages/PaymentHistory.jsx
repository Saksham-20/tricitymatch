import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import api from '../api/axios';
import toast from 'react-hot-toast';
import blobErrorMessage from '../utils/blobError';
import { summarisePayments, isPaidRow, refundedOf } from '../utils/paymentSummary';
import { FiDownload, FiCreditCard, FiTrendingUp, FiCalendar, FiAward } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { Skeleton, ErrorState } from '../components/ui';
import { formatDate } from '../utils/formatDate';

// Plan chip — on-system (burgundy/gold tiers, neutral free)
const PLAN_LABELS = {
  free: 'Free',
  basic_premium: 'Basic Premium',
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
  nri: 'NRI Connect',
  founding_premium: 'Founding Member',
};
const planLabel = (p) => (PLAN_LABELS[p]
  ? i18n.t(`payments.plans.${p}`)
  : (p || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

const PlanBadge = ({ plan }) => {
  const { t } = useTranslation();
  const meta = {
    free:          { label: 'Free',          cls: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700' },
    basic_premium: { label: 'Basic Premium', cls: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-primary-100 dark:border-primary-800/40' },
    premium_plus:  { label: 'Premium',       cls: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800/50' },
    elite:         { label: 'Elite',         cls: 'bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-400 border-gold-200 dark:border-gold-800/40' },
    vip:           { label: 'VIP',           cls: 'bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-400 border-gold-200 dark:border-gold-800/40' },
    nri:           { label: 'NRI Connect',   cls: 'bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-400 border-gold-200 dark:border-gold-800/40' },
    founding_premium: { label: 'Founding Member', cls: 'bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-400 border-gold-200 dark:border-gold-800/40' },
  };
  const m = meta[plan] || { label: plan, cls: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${m.cls}`}>
      {meta[plan] ? t(`payments.plans.${plan}`) : m.label}
    </span>
  );
};

// Status chip — semantic
const STATUS_KEYS = ['active', 'expired', 'cancelled', 'pending', 'failed'];

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const map = {
    active:    'bg-success-50 dark:bg-success/15 text-success border-success-100 dark:border-success/30',
    expired:   'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
    cancelled: 'bg-destructive-light dark:bg-destructive/15 text-destructive border-destructive/20',
    pending:   'bg-warning-light dark:bg-warning/15 text-warning border-warning/20',
    failed:    'bg-destructive-light dark:bg-destructive/15 text-destructive border-destructive/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize border ${map[status] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'}`}>
      {STATUS_KEYS.includes(status) ? t(`payments.status.${status}`) : status}
    </span>
  );
};

const RowSkeleton = () => (
  <tr className="border-b border-neutral-50 dark:border-neutral-800">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <Skeleton className="h-4 w-16" />
      </td>
    ))}
  </tr>
);


export default function PaymentHistory() {
  const { t } = useTranslation();
  const [subscriptions, setSubs] = useState([]);
  const [loading, setLoading]    = useState(true);
  // Distinct from "no history yet" — a failed fetch previously left
  // `subscriptions` as `[]` and rendered the same empty state a genuinely new
  // member sees, hiding a real error behind "No payment history yet."
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    api.get('/subscription/history')
      .then((r) => setSubs(r.data.subscriptions || r.data || []))
      .catch(() => { setLoadError(true); toast.error(t('payments.history.loadFailed')); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const downloadInvoice = async (subId) => {
    try {
      const res = await api.get(`/subscription/invoice/${subId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${subId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // The server explains itself ("Invoice not available for a free or granted
      // plan"); a flat failure message hides that from the member and from us.
      // The response is a Blob on this route, so it needs parsing first.
      toast.error(await blobErrorMessage(err, t('payments.history.invoiceFailed')));
    }
  };

  // Summary derived from rows
  // `amount` is the column; `paymentAmount` never existed, so this read ₹0 for
  // every member regardless of what they had paid.
  // Only rows with a payment reference count, less refunds (see paymentSummary).
  const { totalSpent, totalRefunded } = summarisePayments(subscriptions);
  const activeSub = subscriptions.find((s) => s.status === 'active');

  const amountCell = (s) => (
    <>
      {isPaidRow(s)
        ? `₹${Number(s.amount).toLocaleString('en-IN')}`
        : (s.amount != null ? t('payments.history.granted') : '—')}
      {refundedOf(s) > 0 && (
        <span className="block text-xs font-normal text-neutral-500 dark:text-neutral-400 tabular-nums">
          {t('payments.history.refunded', { amount: refundedOf(s).toLocaleString('en-IN') })}
        </span>
      )}
    </>
  );

  // The API serializes `razorpayPaymentId` (the model column); reading
  // `paymentId` meant this button never rendered for anyone. A ₹0 grant has no
  // invoice to give — the server 400s it, so don't offer the button either.
  const invoiceButton = (s) => (s.razorpayPaymentId && Number(s.amount) > 0 ? (
    <button
      onClick={() => downloadInvoice(s.id)}
      aria-label={t('payments.history.downloadInvoice', { plan: planLabel(s.planType), date: s.startDate ? formatDate(s.startDate) : '' })}
      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-medium transition-colors"
    >
      <FiDownload className="w-3.5 h-3.5" /> PDF
    </button>
  ) : null);

  const summary = [
    {
      key: 'spent',
      label: totalRefunded > 0 ? t('payments.history.totalSpentAfterRefunds') : t('payments.history.totalSpent'),
      value: `₹${totalSpent.toLocaleString('en-IN')}`,
      icon: FiTrendingUp,
    },
    { key: 'plan', label: t('payments.history.activePlan'), value: activeSub ? planLabel(activeSub.planType) : t('payments.history.none'), icon: FiAward },
    { key: 'until', label: t('payments.history.validUntil'), value: activeSub?.endDate ? formatDate(activeSub.endDate) : '—', icon: FiCalendar },
  ];

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-24 md:pb-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FiCreditCard className="w-6 h-6 text-primary-500" />
              {t('payments.history.title')}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-0.5">{t('payments.history.subtitle')}</p>
          </div>
          <Link to="/subscription" className="btn-primary inline-flex items-center justify-center min-h-[44px] px-4 py-2 text-sm whitespace-nowrap">
            {t('plans.viewPlans')}
          </Link>
        </div>

        {/* Summary cards */}
        {!loading && !loadError && subscriptions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {summary.map((s) => (
              <div key={s.key} className="bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-5 h-5 text-primary-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">{s.label}</p>
                  <p className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate tabular-nums">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <tbody>{[0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}</tbody>
            </table>
          </div>
        ) : loadError ? (
          <div className="bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card">
            <ErrorState
              title={t('payments.history.errorTitle')}
              description={t('payments.history.errorDescription')}
              retryLabel={t('payments.history.retry')}
              onRetry={load}
            />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="bg-white dark:bg-surface-dark-3 rounded-2xl p-12 text-center shadow-card">
            <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <FiAward className="w-6 h-6 text-primary-500" />
            </div>
            <p className="text-neutral-800 dark:text-neutral-200 font-semibold">{t('payments.history.emptyTitle')}</p>
            <p className="text-neutral-400 dark:text-neutral-500 text-sm mt-1">{t('payments.history.emptyDescription')}</p>
            <Link to="/subscription" className="btn-primary inline-flex items-center justify-center min-h-[44px] mt-5 px-6 py-2.5 text-sm">
              {t('plans.viewPlans')}
            </Link>
          </div>
        ) : (
          <>
          {/* Phones: one card per payment. The six-column table scrolled
              sideways at 390px and hid the invoice button off-screen. */}
          <ul className="md:hidden space-y-3">
            {subscriptions.map((s) => (
              <li key={s.id} className="bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <PlanBadge plan={s.planType} />
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{amountCell(s)}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                      {s.startDate ? formatDate(s.startDate) : '—'} – {s.endDate ? formatDate(s.endDate) : '—'}
                    </p>
                  </div>
                  {invoiceButton(s)}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800">
                    {['plan', 'status', 'amount', 'startDate', 'endDate'].map((h) => (
                      <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{t(`payments.history.columns.${h}`)}</th>
                    ))}
                    <th scope="col" className="text-right px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{t('payments.history.columns.invoice')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="px-4 py-3"><PlanBadge plan={s.planType} /></td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 font-medium text-neutral-800 dark:text-neutral-200 tabular-nums">{amountCell(s)}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {s.startDate ? formatDate(s.startDate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {s.endDate ? formatDate(s.endDate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">{invoiceButton(s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
