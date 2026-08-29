import { Check, Minus } from 'lucide-react';

/**
 * One row per invited member, shared by the rep's portal and the admin view of
 * a rep — the same component so the two can never drift into telling different
 * stories about the same referral.
 *
 * Pass `onStatusChange` to make the lead status editable (the rep's own view);
 * leave it out and the status renders as a read-only chip (the admin view).
 */

const STATUS_CHIP = {
  converted: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  new: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
};

const PLAN_LABELS = {
  free: 'Free',
  founding_premium: 'Founding',
  basic_premium: 'Basic Premium',
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
  nri: 'NRI',
};

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : null;

const Yes = ({ label }) => (
  <span className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-300 font-medium">
    <Check size={15} /> {label}
  </span>
);

const No = ({ label }) => (
  <span className="inline-flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
    <Minus size={15} /> {label}
  </span>
);

export default function MemberReportTable({ members, onStatusChange, updatingId }) {
  const th = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400';
  const td = 'px-4 py-4 text-sm text-neutral-800 dark:text-neutral-100 align-top';

  return (
    <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
      <table className="w-full border-collapse">
        <thead className="bg-neutral-50 dark:bg-neutral-800/60">
          <tr>
            <th className={th}>Member</th>
            <th className={th}>Contact</th>
            <th className={th}>Code</th>
            <th className={th}>Signed up</th>
            <th className={th}>Paid on</th>
            <th className={th}>Plan</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={`${th} text-right`}>Commission</th>
            <th className={th}>Lead status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {members.map((m) => (
            <tr key={m.leadId} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors">
              <td className={td}>
                <div className="font-semibold text-neutral-900 dark:text-neutral-50">{m.name}</div>
                {m.city && <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{m.city}</div>}
              </td>
              <td className={td}>
                <div className="text-neutral-700 dark:text-neutral-200">{m.phone || '—'}</div>
                {m.email && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 break-all">{m.email}</div>
                )}
              </td>
              <td className={td}>
                <span className="font-mono text-xs px-2 py-1 rounded bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                  {m.referralCode || '—'}
                </span>
                {m.campaign && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{m.campaign}</div>
                )}
              </td>
              <td className={td}>
                {m.signedUp ? <Yes label={fmtDate(m.signedUpAt) || 'Yes'} /> : <No label="Not yet" />}
                {m.signedUp && !m.profileComplete && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Profile incomplete</div>
                )}
              </td>
              <td className={td}>
                {m.paid ? <Yes label={fmtDate(m.paidAt) || 'Yes'} /> : <No label="Not paid" />}
              </td>
              <td className={td}>
                {m.planType ? (
                  <div>
                    <span className="font-medium">{PLAN_LABELS[m.planType] || m.planType}</span>
                    {m.planEndsAt && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        until {fmtDate(m.planEndsAt)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-neutral-400 dark:text-neutral-500">—</span>
                )}
              </td>
              <td className={`${td} text-right font-semibold tabular-nums`}>
                {m.amountPaid ? `₹${Number(m.amountPaid).toLocaleString('en-IN')}` : '—'}
              </td>
              <td className={`${td} text-right font-semibold tabular-nums text-gold-700 dark:text-gold-300`}>
                {m.commission ? `₹${Number(m.commission).toLocaleString('en-IN')}` : '—'}
              </td>
              <td className={td}>
                {onStatusChange ? (
                  <select
                    value={m.leadStatus}
                    onChange={(e) => onStatusChange(m.leadId, e.target.value)}
                    disabled={updatingId === m.leadId}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-0 ${
                      STATUS_CHIP[m.leadStatus] || STATUS_CHIP.new
                    }`}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                  </select>
                ) : (
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      STATUS_CHIP[m.leadStatus] || STATUS_CHIP.new
                    }`}
                  >
                    {m.leadStatus}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
