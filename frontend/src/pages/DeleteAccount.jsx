import React from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import Seo from '../components/common/Seo';
import { support } from '../config';

const LINK_CLASS = 'text-primary-600 dark:text-primary-300 underline hover:text-primary-700 dark:hover:text-primary-200';

const MailLink = ({ children }) => (
  <a href={`mailto:${support.email}`} className={LINK_CLASS}>{children}</a>
);

// Inline markup the translated strings may use.
const COMPONENTS = {
  b: <strong />,
  loginlink: <Link to="/login" className={LINK_CLASS} />,
  privacylink: <Link to="/privacy" className={LINK_CLASS} />,
  supportmail: <MailLink />,
};

const Tx = ({ k }) => (
  <Trans i18nKey={`deleteAccount.${k}`} components={COMPONENTS} values={{ supportEmail: support.email }} />
);

const H2 = ({ children }) => (
  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">{children}</h2>
);

// Public account-deletion page. Google Play's Data-Safety / account-deletion
// policy requires a URL reachable outside the app that explains how a user can
// delete their account and what happens to their data — this is that URL.
export default function DeleteAccount() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-16 px-4">
      <Seo
        title="Delete Your Account"
        description="How to permanently delete your TricityMatch account and data."
        path="/delete-account"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 inline-block py-2 px-2 -mx-2 -mt-2 mb-4">{t('deleteAccount.back')}</Link>

        <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{t('deleteAccount.title')}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">{t('deleteAccount.subtitle')}</p>

          <div className="max-w-none text-base leading-relaxed text-neutral-700 dark:text-neutral-300 space-y-6">
            <section>
              <p>{t('deleteAccount.intro')}</p>
            </section>

            <section>
              <H2>{t('deleteAccount.web.h')}</H2>
              <ol className="list-decimal pl-5 space-y-1">
                {['i1', 'i2', 'i3', 'i4', 'i5'].map((k) => <li key={k}><Tx k={`web.${k}`} /></li>)}
              </ol>
            </section>

            <section>
              <H2>{t('deleteAccount.app.h')}</H2>
              <ol className="list-decimal pl-5 space-y-1">
                {['i1', 'i2', 'i3', 'i4'].map((k) => <li key={k}><Tx k={`app.${k}`} /></li>)}
              </ol>
            </section>

            <section>
              <H2>{t('deleteAccount.cant.h')}</H2>
              <p><Tx k="cant.p" /></p>
            </section>

            <section>
              <H2>{t('deleteAccount.what.h')}</H2>
              <ul className="list-disc pl-5 space-y-1">
                {['i1', 'i2', 'i3', 'i4'].map((k) => <li key={k}>{t(`deleteAccount.what.${k}`)}</li>)}
              </ul>
              <p className="mt-2"><Tx k="what.p" /></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
