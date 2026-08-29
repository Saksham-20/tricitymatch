import { Users, UserCheck, BadgeCheck, IndianRupee, Wallet } from 'lucide-react';

/**
 * The funnel in one strip: invited → signed up → paid → money.
 * Shared by the rep's portal and the admin view of a rep.
 */
const Tile = ({ icon: Icon, label, value, hint, gold = false }) => (
  <div
    className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 ${
      gold ? 'border-t-4 border-t-gold' : ''
    }`}
  >
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
        gold
          ? 'bg-gold-100 text-gold-700 dark:bg-gold-900/30 dark:text-gold-300'
          : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
      }`}
    >
      <Icon size={20} />
    </div>
    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">{value}</p>
    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-1">{label}</p>
    {hint && <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">{hint}</p>}
  </div>
);

export default function ReportSummary({ summary, className = '', commissionLabel = 'Your commission' }) {
  if (!summary) return null;
  const s = summary;
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 ${className}`}>
      <Tile icon={Users} label="Invited" value={s.totalLeads ?? 0} />
      <Tile
        icon={UserCheck}
        label="Signed up"
        value={s.signedUp ?? 0}
        hint={s.totalLeads ? `${s.signupRate}% of invited` : null}
      />
      <Tile
        icon={BadgeCheck}
        label="Paid members"
        value={s.paidMembers ?? 0}
        hint={s.signedUp ? `${s.paidRate}% of signups` : null}
      />
      <Tile
        icon={IndianRupee}
        label="Revenue collected"
        value={`₹${Number(s.revenue || 0).toLocaleString('en-IN')}`}
        hint="Paid by your members"
      />
      <Tile
        icon={Wallet}
        label={commissionLabel}
        value={`₹${Number(s.commissionEarned || 0).toLocaleString('en-IN')}`}
        hint={s.commissionRate != null ? `${s.commissionRate}% of ₹${Number(s.revenue || 0).toLocaleString('en-IN')}` : null}
        gold
      />
    </div>
  );
}
