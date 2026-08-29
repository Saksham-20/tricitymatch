import { Wallet, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * The payout ledger: what the rep has earned, what has actually been handed
 * over, and what is still owed — plus the individual payments so the balance
 * can be checked against its parts.
 *
 * Read-only by default (the rep's view). The admin passes `actions` to render
 * per-row controls and `children` for the record-a-payout form; payouts are
 * only ever written by an admin.
 */

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

const METHOD_LABELS = {
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

const Figure = ({ icon: Icon, label, value, hint, tone = 'neutral' }) => {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    gold: 'bg-gold-100 text-gold-700 dark:bg-gold-900/30 dark:text-gold-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  };
  return (
    <div className="flex-1 min-w-[160px]">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">{value}</p>
      <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-0.5">{label}</p>
      {hint && <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">{hint}</p>}
    </div>
  );
};

export default function PayoutSection({ ledger, actions, children, title = 'Payouts' }) {
  if (!ledger?.summary) return null;
  const s = ledger.summary;
  const payouts = ledger.payouts || [];

  const th = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400';
  const td = 'px-4 py-3.5 text-sm text-neutral-800 dark:text-neutral-100';

  return (
    <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
        <h2 className="text-xl font-serif font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Commission at {s.commissionRate}% · paid out by the TricityMatch team
        </p>
      </div>

      <div className="flex flex-wrap gap-6 mb-6">
        <Figure icon={Wallet} label="Commission earned" value={inr(s.earned)} tone="gold" />
        <Figure
          icon={CheckCircle2}
          label="Paid out"
          value={inr(s.paidOut)}
          hint={s.lastPaidAt ? `Last on ${fmtDate(s.lastPaidAt)}` : 'Nothing paid yet'}
          tone="green"
        />
        {s.pending > 0 && <Figure icon={Clock} label="Queued" value={inr(s.pending)} hint="Not sent yet" />}
        <Figure
          icon={Wallet}
          label="Outstanding"
          value={inr(s.outstanding)}
          hint={s.outstanding ? 'Owed to you' : 'All settled'}
        />
      </div>

      {s.overpaid > 0 && (
        <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-700 dark:text-neutral-200">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>
            {inr(s.overpaid)} more has been paid out than the current commission rate accounts for.
            This is normal after a rate change or an advance, and carries against future earnings.
          </span>
        </div>
      )}

      {children}

      {payouts.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
          No payouts recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <table className="w-full border-collapse">
            <thead className="bg-neutral-50 dark:bg-neutral-800/60">
              <tr>
                <th className={th}>Date</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>Status</th>
                <th className={th}>Method</th>
                <th className={th}>Reference</th>
                <th className={th}>Period</th>
                {actions && <th className={`${th} text-right`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors">
                  <td className={td}>
                    {fmtDate(p.paidAt || p.createdAt)}
                    {p.recordedBy && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">by {p.recordedBy}</div>
                    )}
                  </td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{inr(p.amount)}</td>
                  <td className={td}>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                        p.status === 'paid'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      {p.status === 'paid' ? 'Paid' : 'Queued'}
                    </span>
                  </td>
                  <td className={td}>{METHOD_LABELS[p.method] || '—'}</td>
                  <td className={td}>
                    <span className="font-mono text-xs">{p.reference || '—'}</span>
                    {p.note && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{p.note}</div>
                    )}
                  </td>
                  <td className={td}>
                    {p.periodStart || p.periodEnd
                      ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}`
                      : '—'}
                  </td>
                  {actions && <td className={`${td} text-right`}>{actions(p)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
