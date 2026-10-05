import { Link } from 'react-router-dom';
import { FiCheckCircle, FiCircle, FiArrowRight } from 'react-icons/fi';

/**
 * The partner's first-run checklist. It reads real state from the server
 * (`/marketing/onboarding`): a step is done when the thing exists, not when
 * someone ticked a box, so it cannot drift from what the account can actually do.
 *
 * Shown on the dashboard until every step is done, then it gets out of the way.
 */

const STEPS = [
  {
    key: 'agreement',
    title: 'Read and accept the Partner Guide',
    hint: 'What you earn, when you are paid and the rules. You need this before you can generate a code or add members.',
    to: '/marketing/guide',
    cta: 'Open the guide',
  },
  {
    key: 'payout',
    title: 'Add your payout details',
    hint: 'A UPI ID or bank account, and your PAN. Without these we have nowhere to send what you earn.',
    to: '#payout-details',
    cta: 'Add details',
    anchor: true,
  },
  {
    key: 'code',
    title: 'Generate your referral code',
    hint: 'Anyone who signs up through your link, or types your code, is credited to you.',
    to: '/marketing/referral-codes',
    cta: 'Get my code',
  },
  {
    key: 'outreach',
    title: 'Share it and add people you know',
    hint: 'The Outreach Kit has messages you can send as they are. Add friends and family under My Members.',
    to: '/marketing/kit',
    cta: 'Open the kit',
  },
];

export default function PartnerChecklist({ onboarding, className = '' }) {
  if (!onboarding || onboarding.complete) return null;

  const { steps, completed, total } = onboarding;
  const pct = Math.round((completed / total) * 100);
  // The first undone step is the one to do now; the rest are visible but quiet.
  const nextKey = STEPS.find((s) => !steps[s.key])?.key;

  return (
    <section
      aria-labelledby="partner-checklist-title"
      className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="partner-checklist-title" className="text-xl font-serif font-bold text-neutral-900 dark:text-neutral-100">
          Get set up
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{completed} of {total} done</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-label="Setup progress"
        className="mt-3 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden"
      >
        <div className="h-full bg-primary-600 dark:bg-primary-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-5 space-y-4">
        {STEPS.map((s) => {
          const done = Boolean(steps[s.key]);
          const isNext = s.key === nextKey;
          const Icon = done ? FiCheckCircle : FiCircle;
          const action = s.anchor ? (
            <a href={s.to} className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">
              {s.cta} <FiArrowRight size={14} aria-hidden="true" />
            </a>
          ) : (
            <Link to={s.to} className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">
              {s.cta} <FiArrowRight size={14} aria-hidden="true" />
            </Link>
          );
          return (
            <li key={s.key} className="flex items-start gap-3" data-done={done}>
              <Icon
                size={22}
                aria-hidden="true"
                className={`mt-0.5 flex-shrink-0 ${done ? 'text-green-600 dark:text-green-400' : 'text-neutral-400 dark:text-neutral-500'}`}
              />
              <div className="min-w-0">
                <p className={`font-medium ${done ? 'text-neutral-500 dark:text-neutral-400 line-through decoration-neutral-300 dark:decoration-neutral-600' : 'text-neutral-900 dark:text-neutral-100'}`}>
                  {s.title}
                  <span className="sr-only">{done ? ' (done)' : ' (to do)'}</span>
                </p>
                {!done && (
                  <>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">{s.hint}</p>
                    {isNext && <div className="mt-1">{action}</div>}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
