import React from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { FiArrowLeft, FiArrowRight, FiClock, FiMail, FiShield, FiXCircle } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import { legal, support } from '../config';

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
    <div className="mt-4 space-y-3 text-base sm:text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
      {children}
    </div>
  </section>
);

const LINK_CLASS = 'text-primary-700 dark:text-primary-300 underline';

const MailLink = ({ children }) => (
  <a href={`mailto:${support.email}`} className={LINK_CLASS}>{children}</a>
);

// Inline markup the translated strings may use.
const COMPONENTS = {
  b: <strong />,
  supportmail: <MailLink />,
  deletelink: <Link to="/delete-account" className={LINK_CLASS} />,
};

const Tx = ({ k }) => (
  <Trans i18nKey={`refund.${k}`} components={COMPONENTS} values={{ supportEmail: support.email }} />
);

export default function RefundPolicy() {
  const { t, i18n } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-1 text-neutral-900 dark:text-neutral-100">
      <Seo
        title="Refund & Conduct Policy"
        description="When we refund a TricityMatch membership, how to ask, and what we do about members who behave badly."
        path="/refund-policy"
      />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary-700 dark:text-primary-300 py-2 px-2 -mx-2 -mt-2 mb-4">
          <FiArrowLeft className="w-4 h-4" aria-hidden="true" /> {t('legal.backHome')}
        </Link>
        {i18n.resolvedLanguage !== 'en' && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t('legal.englishGoverns')}</p>
        )}
        {/* Doctrine ruling 2: zero eyebrows — the "Refunds & conduct" label
            that used to sit above this heading is dropped. */}
        <h1 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight">
          {t('refund.h1')}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
          {t('refund.intro')}
        </p>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{t('refund.lastUpdated', { date: legal.termsUpdated })}</p>

        <div className="mt-8">
          <Section icon={FiClock} title={t('refund.seven.title')}>
            <p><Tx k="seven.p1" /></p>
            <p><Tx k="seven.p2" /></p>
          </Section>

          <Section icon={FiXCircle} title={t('refund.after.title')}>
            <p><Tx k="after.p1" /></p>
            <p><Tx k="after.p2" /></p>
          </Section>

          <Section icon={FiShield} title={t('refund.conduct.title')}>
            <p><Tx k="conduct.p1" /></p>
            <p><Tx k="conduct.p2" /></p>
          </Section>

          <Section icon={FiMail} title={t('refund.ask.title')}>
            <p><Tx k="ask.p1" /></p>
            <p><Tx k="ask.p2" /></p>
            <p className="text-neutral-600 dark:text-neutral-400"><Tx k="ask.p3" /></p>
          </Section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 items-center">
          <Link
            to="/help"
            className="btn-primary inline-flex items-center gap-2 min-h-[48px] px-6 text-sm"
          >
            {t('refund.help')} <FiArrowRight aria-hidden="true" />
          </Link>
          <Link to="/terms" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
            {t('refund.terms')}
          </Link>
          <Link to="/privacy" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">
            {t('refund.privacy')}
          </Link>
        </div>
      </div>
    </div>
  );
}
