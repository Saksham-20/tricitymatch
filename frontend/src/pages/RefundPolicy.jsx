import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiClock, FiMail, FiShield, FiXCircle } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import { support } from '../config';

/**
 * Refund & conduct policy.
 *
 * Written because we take real money from families who have never heard of us,
 * and every competitor states a position while we stated none. The commitments
 * here are deliberately narrow and concrete — a promise that cannot be kept at
 * fifteen members is worse than no promise.
 *
 * The seven-day window is the load-bearing one: it is what makes a first
 * payment a low-risk decision, and it costs nothing if the product works.
 */

const Section = ({ icon: Icon, title, children }) => (
  <section className="py-8 border-b border-neutral-200 dark:border-neutral-800 last:border-0">
    <h2 className="font-display text-xl sm:text-2xl tracking-tight flex items-center gap-3">
      <Icon className="w-5 h-5 text-primary-600 dark:text-primary-300 flex-shrink-0" aria-hidden="true" />
      {title}
    </h2>
    <div className="mt-4 space-y-3 text-sm sm:text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
      {children}
    </div>
  </section>
);

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[#FDF8F2] dark:bg-[#0f1117] text-neutral-900 dark:text-neutral-100">
      <Seo
        title="Refund & Conduct Policy"
        description="When we refund a TricityMatch membership, how to ask, and what we do about members who behave badly."
        path="/refund-policy"
      />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300">
          Refunds &amp; conduct
        </span>
        <h1 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight mt-4">
          If this is not what you expected, tell us.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
          We are a small Tricity team, not a national portal, and we would rather refund someone
          than hold on to money they regret spending. This page says exactly when we refund, how
          to ask, and what happens when a member behaves badly.
        </p>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">Last updated 25 August 2026</p>

        <div className="mt-8">
          <Section icon={FiClock} title="Seven days, no argument">
            <p>
              Ask within <strong>seven days</strong> of paying and we refund the membership in full —
              you do not have to justify it. Write to{' '}
              <a href={`mailto:${support.email}`} className="text-primary-700 dark:text-primary-300 underline">{support.email}</a>{' '}
              from the email on your account and say you want a refund.
            </p>
            <p>
              One exception, and it is the obvious one: if you have already unlocked contact details
              during those seven days, we deduct those unlocks at ₹199 for three, which is what the
              top-up costs. Everything else comes back.
            </p>
          </Section>

          <Section icon={FiXCircle} title="After seven days">
            <p>
              A membership runs for its full term and we do not refund the unused part of it — the
              same way a gym membership works. If something has genuinely gone wrong, write to us
              anyway. We read every message and we have discretion.
            </p>
            <p>
              We will always refund, at any point in the term, if: we removed a feature you paid for,
              the service was unusable for a sustained period, or you were charged twice.
            </p>
          </Section>

          <Section icon={FiShield} title="If a member behaves badly">
            <p>
              Report anyone who harasses you, misrepresents themselves, or asks you for money —
              there is a report option on every profile and in every conversation. We review reports
              by hand.
            </p>
            <p>
              A member we remove for harassment or fraud does not get a refund. If you were the one
              harmed and you no longer want to be here because of it, you get one — regardless of how
              long you have been a member.
            </p>
          </Section>

          <Section icon={FiMail} title="How to ask, and how long it takes">
            <p>
              Email{' '}
              <a href={`mailto:${support.email}`} className="text-primary-700 dark:text-primary-300 underline">{support.email}</a>{' '}
              from your registered address with your registered phone number. We reply within two
              working days.
            </p>
            <p>
              Approved refunds go back to the original payment method through Razorpay and usually
              take five to seven working days to appear, depending on your bank. We do not refund to
              a different account than the one that paid.
            </p>
            <p className="text-neutral-500 dark:text-neutral-400">
              What we never do: charge a renewal without asking, keep charging after you cancel, or
              make you phone somebody to leave. You can delete your account yourself, at any time,{' '}
              <Link to="/delete-account" className="text-primary-700 dark:text-primary-300 underline">from here</Link>.
            </p>
          </Section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 items-center">
          <Link
            to="/help"
            className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-full bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors"
          >
            Help Centre <FiArrowRight />
          </Link>
          <Link to="/terms" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
            Terms of Service
          </Link>
          <Link to="/privacy" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
