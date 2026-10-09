import React from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { FiArrowLeft } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import { legal, support } from '../config';

/**
 * Privacy Policy.
 *
 * Rewritten 26 August 2026 (docs/LEGAL_REVIEW_2026-08-26.md). The previous
 * version described a smaller product than the one we now run and made two
 * claims the code does not support: that deleted data is "permanently purged"
 * (financial and moderation records are deliberately retained, and rule 3(1)(h)
 * of the IT Rules requires registration data to be held for 180 days), and that
 * we notify only the Data Protection Board on a breach (CERT-In's 2022
 * Directions require reporting within six hours, separately).
 *
 * Everything here is written against what backend/utils/accountErasure.js
 * actually does and which processors the app actually calls. If you change
 * either, change this page in the same commit.
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

// Inline markup the translated strings may use. Values are the config-driven
// names and addresses, which are never translated.
const COMPONENTS = {
  b: <strong />,
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

const Tx = ({ k }) => <Trans i18nKey={`privacy.${k}`} components={COMPONENTS} values={VALUES} />;

const items = (section, count) => Array.from({ length: count }, (_, i) => `${section}.i${i + 1}`);

export default function Privacy() {
  const { t, i18n } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-16 px-4">
      <Seo
        title="Privacy Policy"
        description="How TricityMatch collects, uses and protects your personal data."
        path="/privacy"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary-700 dark:text-primary-300 py-2 px-2 -mx-2 -mt-2 mb-4">
          <FiArrowLeft className="w-4 h-4" /> {t('legal.backHome')}
        </Link>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-8 md:p-12">
          {i18n.resolvedLanguage !== 'en' && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t('legal.englishGoverns')}</p>
          )}
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{t('privacy.title')}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">{t('privacy.lastUpdated', { date: legal.privacyUpdated })}</p>

          <div className="prose prose-sm max-w-none text-neutral-700 dark:text-neutral-300 space-y-6">
            <section>
              <p><Tx k="intro.p1" /></p>
              <p className="mt-2"><Tx k="intro.p2" /></p>
              {legal.address && (
                <p className="mt-2"><strong>{t('privacy.intro.address')}</strong> {legal.entity}, {legal.address}.</p>
              )}
            </section>

            <section>
              <H>{t('privacy.s1.h')}</H>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {items('s1', 11).map((k) => <li key={k}><Tx k={k} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s1.p2" /></p>
            </section>

            <section>
              <H>{t('privacy.s2.h')}</H>
              <p><Tx k="s2.intro" /></p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {items('s2', 8).map((k) => <li key={k}><Tx k={k} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s2.p2" /></p>
            </section>

            <section>
              <H>{t('privacy.s3.h')}</H>
              <p><Tx k="s3.p1" /></p>
              <p className="mt-2"><Tx k="s3.p2" /></p>
            </section>

            <section>
              <H>{t('privacy.s4.h')}</H>
              <p><Tx k="s4.intro" /></p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {items('s4', 5).map((k) => <li key={k}><Tx k={k} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s4.p2" /></p>
            </section>

            <section>
              <H>{t('privacy.s5.h')}</H>
              <p><Tx k="s5.intro" /></p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {items('s5', 10).map((k) => <li key={k}><Tx k={k} /></li>)}
              </ul>
            </section>

            <section>
              <H>{t('privacy.s6.h')}</H>
              <p><Tx k="s6.p" /></p>
            </section>

            <section>
              <H>{t('privacy.s7.h')}</H>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {items('s7', 3).map((k) => <li key={k}><Tx k={k} /></li>)}
              </ul>
            </section>

            <section>
              <H>{t('privacy.s8.h')}</H>
              <p><Tx k="s8.p" /></p>
            </section>

            <section>
              <H>{t('privacy.s9.h')}</H>
              <p><Tx k="s9.p" /></p>
            </section>

            <section>
              <H>{t('privacy.s10.h')}</H>
              <p><Tx k="s10.p" /></p>
            </section>

            <section>
              <H>{t('privacy.s11.h')}</H>
              <p><Tx k="s11.p" /></p>
            </section>

            <section>
              <H>{t('privacy.s12.h')}</H>
              <p><Tx k="s12.p1" /></p>
              <p className="mt-2"><Tx k="s12.p2" /></p>
            </section>

            <section>
              <H>{t('privacy.s13.h')}</H>
              <p><Tx k="s13.intro" /></p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {items('s13', 7).map((k) => <li key={k}><Tx k={k} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s13.p2" /></p>
            </section>

            <section>
              <H>{t('privacy.s14.h')}</H>
              <p>{t('privacy.s14.intro')}</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {items('s14', 5).map((k) => <li key={k}><Tx k={k} /></li>)}
              </ul>
              <p className="mt-2"><Tx k="s14.p2" /></p>
              <p className="mt-2"><Tx k="s14.p3" /></p>
            </section>

            <section>
              <H>{t('privacy.s15.h')}</H>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>{t('privacy.s15.dataLabel')}</strong> <A href={`mailto:${legal.privacyEmail}`}>{legal.privacyEmail}</A>{legal.dataProtectionOfficer ? ` (${legal.dataProtectionOfficer})` : ''}<Tx k="s15.dataRest" /></li>
                <li>
                  <strong>{t('privacy.s15.officer')}{legal.grievanceOfficer ? ` — ${legal.grievanceOfficer}` : ''}:</strong>{' '}
                  <A href={`mailto:${legal.grievanceEmail}`}>{legal.grievanceEmail}</A>
                  {legal.address ? <> · {legal.entity}, {legal.address}</> : null}{t('privacy.s15.officerRest')}
                </li>
                <li><Tx k="s15.i3" /></li>
                <li><Tx k="s15.i4" /></li>
              </ul>
            </section>

            <section>
              <H>{t('privacy.s16.h')}</H>
              <p><Tx k="s16.p" /></p>
            </section>

            <section>
              <H>{t('privacy.s17.h')}</H>
              <p><Tx k="s17.p" /></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
