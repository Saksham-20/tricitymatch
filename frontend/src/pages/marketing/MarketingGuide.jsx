import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { legal, support } from '../../config';

const Section = ({ title, children }) => (
  <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">{title}</h2>
    <div className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{children}</div>
  </section>
);

const Ul = ({ children }) => <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export default function MarketingGuide() {
  const [rate, setRate] = useState(null);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    apiClient.get('/marketing/payouts')
      .then((r) => setRate(r.data?.summary?.commissionRate ?? null))
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

  const pct = rate == null ? '—' : `${rate}%`;
  const earn = (price) => (rate == null ? '—' : inr(Math.round((price * rate) / 100)));

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Partner Guide</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          How the TricityMatch partner programme works, what you earn, and the rules. Last updated 4 October 2026.
        </p>
      </div>

      <div className="space-y-4">
        <Section title="1. How it works">
          <Ul>
            <li>You get referral codes and share links from <Link to="/marketing/referral-codes" className="text-primary-600 dark:text-primary-300 underline">Referral Codes</Link>. A person who signs up through your link, or types your code at signup or at checkout, is credited to you.</li>
            <li>People you already know can be added by hand from <Link to="/marketing/leads" className="text-primary-600 dark:text-primary-300 underline">My Members → Add a lead</Link>. If they sign up with that mobile number or email within 60 days, they are credited to you even without a code.</li>
            <li>Credit goes to the first partner a member is linked to. It does not move afterwards.</li>
            <li>Members who join through your code get a 48-hour profile boost; members you added by hand do not.</li>
          </Ul>
        </Section>

        <Section title="2. What you earn">
          <p>You earn <strong className="text-neutral-900 dark:text-neutral-100">{pct} of every membership payment</strong> made by a member credited to you — the first plan, and any renewal or upgrade they buy later.</p>
          {plans.length > 0 && rate != null && (
            <div className="mt-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 p-4">
              <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">At today's prices</p>
              <table className="w-full text-sm">
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.key} className="border-t border-neutral-200 dark:border-neutral-700 first:border-0">
                      <td className="py-1.5">{p.name} · {p.duration}</td>
                      <td className="py-1.5 text-right text-neutral-500 dark:text-neutral-400">member pays {inr(p.price)}</td>
                      <td className="py-1.5 text-right font-semibold text-neutral-900 dark:text-neutral-100">you earn {earn(p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Ul>
            <li>Commission is on the amount actually kept: a refund removes it, a partial refund reduces it.</li>
            <li>Only membership plans count. Contact-unlock top-ups, astrologer bookings and any other purchases do not.</li>
            <li>Free signups earn nothing until the member pays.</li>
            <li>The rate is set by TricityMatch and can change; the rate shown here and on your dashboard is the one that applies today, and we tell you before it changes.</li>
          </Ul>
        </Section>

        <Section title="3. When and how you are paid">
          <Ul>
            <li>Payouts are made <strong>once a month</strong>, in the first week, for payments whose 7-day refund window has closed.</li>
            <li>Paid by UPI or bank transfer to the account you give us. Minimum payout {inr(500)}; smaller balances roll into the next month.</li>
            <li>Your <Link to="/marketing/dashboard" className="text-primary-600 dark:text-primary-300 underline">Dashboard</Link> shows earned, paid out and outstanding, and every payout with its reference.</li>
            <li>Tax: commission is subject to TDS under section 194H of the Income-tax Act (currently 2% once your yearly commission crosses ₹20,000). Share your PAN with us before your first payout; without it, TDS applies at the higher rate the law requires. You are responsible for your own income tax and, if registered, GST.</li>
            <li>If a payment you were paid commission on is later refunded or charged back, the amount is deducted from your next payout.</li>
          </Ul>
        </Section>

        <Section title="4. Rules">
          <Ul>
            <li><strong>Be honest about what TricityMatch is.</strong> It is a matrimonial service for people seeking marriage, not a dating app. Never promise a match, a marriage, or a timeline, and never describe members as "background-verified" — profile verification is a selfie check, nothing more.</li>
            <li><strong>Only people who can legally marry.</strong> 21 for men, 18 for women. Do not add or refer anyone younger.</li>
            <li><strong>No self-referral.</strong> Your own account, your own family's accounts, and accounts you control do not earn commission. Discovered self-referrals are reversed.</li>
            <li><strong>Member details are not yours to keep.</strong> The names and numbers on your dashboard are shown so you can follow up about TricityMatch. Do not share, sell, or use them for anything else, and delete any copies when you leave the programme.</li>
            <li><strong>No spam.</strong> Contact people one-to-one. No bulk SMS, no WhatsApp broadcasts to people who have not asked, no messages to numbers on the Do Not Disturb registry.</li>
            <li><strong>No money handling.</strong> Members pay TricityMatch directly through the website or app. Never collect cash or payments on our behalf, and never offer a discount beyond the official one tied to your code.</li>
            <li><strong>Use our name properly.</strong> Say you are a TricityMatch partner, not an employee. Do not create pages, ads or accounts that look like the official TricityMatch ones.</li>
            <li>Breaking these rules ends the partnership and forfeits unpaid commission. Fraud is reported.</li>
          </Ul>
        </Section>

        <Section title="5. Questions">
          <p>Programme questions: <a href={`mailto:${support.email}`} className="text-primary-600 dark:text-primary-300 underline">{support.email}</a>.
            Complaints go to our Grievance Officer at <a href={`mailto:${legal.grievanceEmail}`} className="text-primary-600 dark:text-primary-300 underline">{legal.grievanceEmail}</a>.
            This guide forms part of your agreement with {legal.entity}; where it changes materially, we tell you by email, and continuing to use the programme means you accept the change.</p>
        </Section>
      </div>
    </div>
  );
}
