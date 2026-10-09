import React from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { FiArrowLeft } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import { legal, support } from '../config';

/**
 * Terms of Service.
 *
 * Rewritten 26 August 2026 after a review of what Indian law actually requires
 * of a platform like this one (docs/LEGAL_REVIEW_2026-08-26.md). The previous
 * version was honest but thin, and it was wrong in three ways that matter:
 *
 *   - it set the minimum age at 18 for everyone, when the Prohibition of Child
 *     Marriage Act, 2006 sets it at 21 for men and 18 for women;
 *   - it said fees are "non-refundable" while /refund-policy promises a
 *     seven-day no-questions refund — two published documents contradicting
 *     each other, and the one that binds us is the one more favourable to the
 *     member;
 *   - it carried none of the intermediary due-diligence content that IT Rules
 *     2021 r.3(1)(b) requires a platform to publish, and named no Grievance
 *     Officer, which r.3(2)(a) requires by name and not by role mailbox.
 *
 * Anything that depends on facts only the owner holds — registered entity name,
 * address, the Grievance Officer's name — comes from `config.legal` and is
 * OMITTED when unset rather than rendered as a placeholder. A fabricated
 * statutory disclosure is worse than a missing one.
 */

const H = ({ children }) => (
  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">{children}</h2>
);

const A = ({ href, children }) => (
  <a href={href} className="text-primary-700 dark:text-primary-300 underline">{children}</a>
);

const L = ({ to, children }) => (
  <Link to={to} className="text-primary-700 dark:text-primary-300 underline">{children}</Link>
);

// Inline markup the translated strings may use: <b>, <em>, the page links and
// the mailto links. Values are the config-driven names and addresses, which are
// never translated.
const COMPONENTS = {
  b: <strong />,
  em: <em />,
  privacylink: <L to="/privacy" />,
  refundlink: <L to="/refund-policy" />,
  safetylink: <L to="/safety" />,
  settingslink: <L to="/settings" />,
  deletelink: <L to="/delete-account" />,
  helplink: <L to="/help" />,
  supportmail: <A href={`mailto:${support.email}`} />,
  privacymail: <A href={`mailto:${legal.privacyEmail}`} />,
};
const VALUES = {
  entity: legal.entity,
  supportEmail: support.email,
  privacyEmail: legal.privacyEmail,
};

const Tx = ({ k }) => <Trans i18nKey={`terms.${k}`} components={COMPONENTS} values={VALUES} />;

export default function Terms() {
  const { t, i18n } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-16 px-4">
      <Seo
        title="Terms of Service"
        description="The terms governing your use of TricityMatch."
        path="/terms"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary-700 dark:text-primary-300 py-2 px-2 -mx-2 -mt-2 mb-4">
          <FiArrowLeft className="w-4 h-4" aria-hidden="true" /> {t('legal.backHome')}
        </Link>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-8 md:p-12">
          {i18n.resolvedLanguage !== 'en' && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t('legal.englishGoverns')}</p>
          )}
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{t('terms.title')}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">{t('terms.lastUpdated', { date: legal.termsUpdated })}</p>

          <div className="max-w-none text-base leading-relaxed text-neutral-700 dark:text-neutral-300 space-y-6">
            <section>
              <p><Tx k="intro.p1" /></p>
              {legal.address && (
                <p className="mt-2">
                  <strong>{t('terms.intro.operator')}</strong> {legal.entity}
                  {legal.address ? `, ${legal.address}` : ''}
                  {legal.gstin ? ` · GSTIN ${legal.gstin}` : ''}.
                </p>
              )}
              <p className="mt-2"><Tx k="intro.intermediary" /></p>
            </section>

            <section>
              <H>{t('terms.s1.h')}</H>
              <p><Tx k="s1.p" /></p>
            </section>

            <section>
              <H>{t('terms.s2.h')}</H>
              <p>{t('terms.s2.intro')}</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {['i1', 'i2', 'i3', 'i4'].map((k) => <li key={k}><Tx k={`s2.${k}`} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s2.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s3.h')}</H>
              <p><Tx k="s3.p" /></p>
            </section>

            <section>
              <H>{t('terms.s4.h')}</H>
              <p><Tx k="s4.p1" /></p>
              <p className="mt-2"><Tx k="s4.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s5.h')}</H>
              <p>{t('terms.s5.intro')}</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {['i1', 'i2', 'i3'].map((k) => <li key={k}><Tx k={`s5.${k}`} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s5.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s6.h')}</H>
              <p><Tx k="s6.p1" /></p>
              <p className="mt-2"><Tx k="s6.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s7.h')}</H>
              <p>{t('terms.s7.intro')}</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i10'].map((k) => <li key={k}><Tx k={`s7.${k}`} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s7.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s8.h')}</H>
              <p><Tx k="s8.intro" /></p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9'].map((k) => <li key={k}><Tx k={`s8.${k}`} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s8.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s9.h')}</H>
              <p><Tx k="s9.p1" /></p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {['i1', 'i2', 'i3', 'i4'].map((k) => <li key={k}><Tx k={`s9.${k}`} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s9.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s10.h')}</H>
              <p><Tx k="s10.p1" /></p>
              <p className="mt-2"><Tx k="s10.p2" /></p>
              <p className="mt-2"><Tx k="s10.p3" /></p>
            </section>

            <section>
              <H>{t('terms.s11.h')}</H>
              <p><Tx k="s11.p" /></p>
            </section>

            <section>
              <H>{t('terms.s12.h')}</H>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9'].map((k) => <li key={k}><Tx k={`s12.${k}`} /></li>)}
              </ul>
            </section>

            <section>
              <H>{t('terms.s13.h')}</H>
              <p><Tx k="s13.p1" /></p>
              <p className="mt-2"><Tx k="s13.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s14.h')}</H>
              <p><Tx k="s14.p1" /></p>
              <p className="mt-2"><Tx k="s14.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s15.h')}</H>
              <p><Tx k="s15.p" /></p>
            </section>

            <section>
              <H>{t('terms.s16.h')}</H>
              <p><Tx k="s16.p" /></p>
            </section>

            <section>
              <H>{t('terms.s17.h')}</H>
              <p><Tx k="s17.p" /></p>
            </section>

            <section>
              <H>{t('terms.s18.h')}</H>
              <p><Tx k="s18.p1" /></p>
              <p className="mt-2"><Tx k="s18.p2" /></p>
              <p className="mt-2"><Tx k="s18.p3" /></p>
            </section>

            <section>
              <H>{t('terms.s19.h')}</H>
              <p><Tx k="s19.p" /></p>
            </section>

            <section>
              <H>{t('terms.s20.h')}</H>
              <p><Tx k="s20.p1" /></p>
              <p className="mt-2"><Tx k="s20.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s21.h')}</H>
              <p><Tx k="s21.p" /></p>
            </section>

            <section>
              <H>{t('terms.s22.h')}</H>
              <p><Tx k="s22.p1" /></p>
              <p className="mt-2"><Tx k="s22.p2" /></p>
            </section>

            <section>
              <H>{t('terms.s23.h')}</H>
              <p><Tx k="s23.p" /></p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><Tx k="s23.i1" /></li>
                <li>
                  <strong>{t('terms.s23.officer')}{legal.grievanceOfficer ? ` — ${legal.grievanceOfficer}` : ''}:</strong>{' '}
                  <A href={`mailto:${legal.grievanceEmail}`}>{legal.grievanceEmail}</A>
                  {legal.address ? <> · {legal.entity}, {legal.address}</> : null}{t('terms.s23.appointed')}
                </li>
                <li><Tx k="s23.i3" /></li>
                <li><Tx k="s23.i4" /></li>
              </ul>
            </section>

            <section>
              <H>{t('terms.s24.h')}</H>
              <p><Tx k="s24.p" /></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
