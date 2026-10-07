import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { legal, support } from '../../config';
import { launchPhase, launchDateLabel } from '../../utils/launchDate';
import CheckBox from '../../components/ui/CheckBox';

const Section = ({ id, title, children }) => (
  <section id={id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-6 scroll-mt-6">
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">{title}</h2>
    <div className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{children}</div>
  </section>
);

const Ul = ({ children }) => <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;
const A = ({ to, children }) => (
  <Link to={to} className="text-primary-700 dark:text-primary-300 underline underline-offset-2">{children}</Link>
);

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// The guide's version is an ISO date; show it the way a person writes a date.
const versionLabel = (v) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? new Date(`${v}T00:00:00Z`) : null;
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
};

const LaunchNote = () => {
  const { phase, days } = launchPhase();
  if (phase === 'after') return null;
  const when = phase === 'today'
    ? 'TricityMatch launches today.'
    : `TricityMatch launches on ${launchDateLabel()}${days === 1 ? ' (tomorrow)' : ` (${days} days to go)`}.`;
  return (
    <div className="mb-4 rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-950/30 p-4 text-sm text-neutral-800 dark:text-neutral-200">
      <p className="font-semibold">{when}</p>
      <p className="mt-1 text-neutral-700 dark:text-neutral-300">
        Everyone who signs up through your link, your code or your member list is credited to you from the day you start,
        so you can begin speaking to people you know now. The <A to="/marketing/kit">Outreach Kit</A> has messages you can send as they are.
      </p>
    </div>
  );
};

export default function MarketingGuide() {
  const { onboarding, refreshOnboarding } = useOutletContext() || {};
  const { user } = useAuth();
  const isManager = user?.role === 'marketing_manager';
  const [summary, setSummary] = useState(null);
  const [plans, setPlans] = useState([]);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/marketing/payouts')
      .then((r) => setSummary(r.data?.summary ?? null))
      .catch(() => {});
    apiClient.get('/subscription/plans')
      .then((r) => {
        const all = r.data?.plans || {};
        setPlans(Object.entries(all)
          .filter(([key, p]) => key !== 'free' && p && Number(p.price) > 0)
          .map(([key, p]) => ({ key, name: p.name, price: Number(p.price), duration: p.duration })));
      })
      .catch(() => {});
  }, []);

  const rate = summary?.commissionRate ?? null;
  const holdDays = summary?.holdDays ?? 7;
  const minPayout = summary?.minPayout ?? 500;
  const pct = rate == null ? '—' : `${rate}%`;
  const earn = (price) => (rate == null ? '—' : inr(Math.round((price * rate) / 100)));
  const dated = versionLabel(onboarding?.guideVersion);
  const accepted = Boolean(onboarding?.steps?.agreement);

  const accept = async () => {
    setSaving(true);
    try {
      await apiClient.post('/marketing/accept-agreement', { version: onboarding.guideVersion, accepted: true });
      await refreshOnboarding?.();
      toast.success('Thank you. You can now generate codes and add members.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your acceptance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Partner Guide</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          How the TricityMatch partner programme works, what you earn, and the rules.{dated ? ` Last updated ${dated}.` : ''}
        </p>
      </div>

      <LaunchNote />

      <div className="space-y-4">
        <Section id="start" title="1. Getting started">
          <p>Ten minutes, in this order. Your <A to="/marketing/dashboard">Dashboard</A> ticks each step off as you finish it.</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Read this guide and accept it at the bottom of the page.</li>
            <li>Add your payout details on the <A to="/marketing/dashboard">Dashboard</A>: a UPI ID or bank account, and your PAN.</li>
            <li>Generate a code on <A to="/marketing/referral-codes">Referral Codes</A> and copy your share link.</li>
            <li>Open the <A to="/marketing/kit">Outreach Kit</A>, send your first messages, and add the people you already know under <A to="/marketing/leads">My Members</A>.</li>
          </ol>
          <p>Your password was chosen by the TricityMatch team. Please change it from <A to="/settings">Account &amp; security</A> the first time you sign in.</p>
          {isManager && (
            <p>
              As a marketing manager you also see every partner's numbers side by side on the <A to="/marketing/team">Team</A> page: invited, signed up, paid, revenue and commission.
              It shows numbers only. Member names, contact details and payout information stay with the partner and the TricityMatch team. Your own commission works exactly as described below.
            </p>
          )}
        </Section>

        <Section id="credit" title="2. How credit works">
          <Ul>
            <li>A person who signs up through your link, or types your code at signup or at checkout, is credited to you.</li>
            <li>People you already know can be added by hand from <A to="/marketing/leads">My Members → Add a lead</A>. If they sign up with that mobile number or email within 60 days, they are credited to you even without a code.</li>
            <li>Credit goes to the first partner a member is linked to. It does not move afterwards.</li>
            <li>Members who join through your code get a 48-hour profile boost; members you added by hand do not.</li>
          </Ul>
        </Section>

        <Section id="earn" title="3. What you earn">
          <p>You earn <strong className="text-neutral-900 dark:text-neutral-100">{pct} of every membership payment</strong> made by a member credited to you — the first plan, and any renewal or upgrade they buy later.</p>
          {plans.length > 0 && rate != null && (
            <div className="mt-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 p-4">
              <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">At today's prices</p>
              <table className="w-full text-sm">
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.key} className="border-t border-neutral-200 dark:border-neutral-700 first:border-0">
                      <td className="py-1.5">{p.name} · {p.duration}</td>
                      <td className="py-1.5 text-right text-neutral-600 dark:text-neutral-400">list price {inr(p.price)}</td>
                      <td className="py-1.5 text-right font-semibold text-neutral-900 dark:text-neutral-100">you earn up to {earn(p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                Commission is on what the member actually pays. A member who uses a code may get a small discount on their first plan, so the amount you earn can be slightly lower than the figure above. Your dashboard always shows the exact amount.
              </p>
            </div>
          )}
          <Ul>
            <li>Commission is on the amount actually kept: a refund removes it, a partial refund reduces it.</li>
            <li>Only membership plans count. Contact-unlock top-ups, astrologer bookings and any other purchases do not.</li>
            <li>Free signups earn nothing until the member pays.</li>
            <li>The rate is set by TricityMatch and can change. The rate shown here and on your dashboard is the one that applies today, and we tell you before it changes.</li>
          </Ul>
        </Section>

        <Section id="paid" title="4. When and how you are paid">
          <Ul>
            <li>Commission becomes payable {holdDays} days after the member's payment, once their refund window has closed. Until then it shows on your dashboard as "in the refund window".</li>
            <li>Payouts are made <strong>once a month</strong>, in the first week, for everything that is payable by then.</li>
            <li>Paid by UPI or bank transfer to the account you give us. Minimum payout {inr(minPayout)}; smaller balances roll into the next month.</li>
            <li>Your <A to="/marketing/dashboard">Dashboard</A> shows earned, paid out and outstanding, and every payout with its bank reference.</li>
            <li>Tax: commission may be subject to TDS under the Income-tax Act. When it applies we deduct it at the rate and above the threshold the law sets at the time of the payout, and the deduction is shown on that payout in your dashboard. Share your PAN with us before your first payout; without one the law requires a higher rate. You are responsible for your own income tax and, if you are registered, GST.</li>
            <li>If a payment you were paid commission on is later refunded or charged back, the amount is deducted from your next payout.</li>
            <li>If you change your payout details, payouts to the new account start 48 hours later. This protects you if someone else gets into your account.</li>
          </Ul>
        </Section>

        <Section id="rules" title="5. Rules">
          <Ul>
            <li><strong>Be honest about what TricityMatch is.</strong> It is a matrimonial service for people seeking marriage, not a dating app. Never promise a match, a marriage, or a timeline, and never describe members as "background-verified" — profile verification is a selfie check, nothing more.</li>
            <li><strong>Only people who can legally marry.</strong> 21 for men, 18 for women. Do not add or refer anyone younger.</li>
            <li><strong>No self-referral.</strong> Your own account, your own family's accounts, and accounts you control do not earn commission. Discovered self-referrals are reversed.</li>
            <li><strong>Member details are not yours to keep.</strong> The names and numbers on your dashboard are shown so you can follow up about TricityMatch. Do not share, sell, or use them for anything else, and delete any copies when you leave the programme.</li>
            <li><strong>Only add people who know you.</strong> A lead is someone you already speak to and who would expect to hear from you about TricityMatch. Never add numbers from a purchased list, a scraped group or a stranger.</li>
            <li><strong>No spam.</strong> Contact people one-to-one. No bulk SMS, no WhatsApp broadcasts to people who have not asked, no messages to numbers on the Do Not Disturb registry. If someone says stop, stop.</li>
            <li><strong>No money handling.</strong> Members pay TricityMatch directly through the website or app. Never collect cash or payments on our behalf, and never offer a discount beyond the official one tied to your code.</li>
            <li><strong>Use our name properly.</strong> Say you are a TricityMatch partner, not an employee. Do not create pages, ads or accounts that look like the official TricityMatch ones.</li>
            <li>Breaking these rules ends the partnership and forfeits unpaid commission. Fraud is reported.</li>
          </Ul>
        </Section>

        <Section id="questions" title="6. Questions">
          <p>Programme questions: <a href={`mailto:${support.email}`} className="text-primary-700 dark:text-primary-300 underline underline-offset-2">{support.email}</a>.
            Complaints go to our Grievance Officer at <a href={`mailto:${legal.grievanceEmail}`} className="text-primary-700 dark:text-primary-300 underline underline-offset-2">{legal.grievanceEmail}</a>.
            This guide forms part of your agreement with {legal.entity}; where it changes materially, we tell you by email and ask you to accept the new version.</p>
        </Section>

        {onboarding && (
          <section
            id="accept"
            aria-labelledby="accept-title"
            className="bg-white dark:bg-neutral-900 border-2 border-primary-200 dark:border-primary-900 rounded-xl p-4 sm:p-6 scroll-mt-6"
          >
            <h2 id="accept-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Your agreement</h2>
            {accepted ? (
              <p className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <FiCheckCircle size={18} className="mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                <span>
                  You accepted this guide
                  {onboarding.agreementAcceptedAt
                    ? ` on ${new Date(onboarding.agreementAcceptedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : ''}.
                  We will ask again only if the rules or the earnings terms change.
                </span>
              </p>
            ) : (
              <>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                  {onboarding.needsReacceptance
                    ? 'This guide has changed since you last accepted it. Please read it again and accept the new version.'
                    : 'You need to accept the guide before you can generate a referral code or add members.'}
                </p>
                <CheckBox
                  checked={agreed}
                  onChange={setAgreed}
                  size="md"
                  label={<span className="text-sm text-neutral-800 dark:text-neutral-200">I have read the Partner Guide and agree to follow it.</span>}
                />
                <button
                  type="button"
                  onClick={accept}
                  disabled={!agreed || saving}
                  className="mt-4 inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : 'Accept and continue'}
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
