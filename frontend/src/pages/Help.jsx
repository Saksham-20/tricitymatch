import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
  FiHelpCircle, FiMail, FiMessageCircle, FiShield, FiCreditCard,
  FiUser, FiArrowRight, FiChevronDown, FiTrash2,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import Seo from '../components/common/Seo';
import { support } from '../config';

/**
 * Help Centre — the self-serve half of support.
 *
 * Support was previously a single contact form: every question, however
 * routine, became a human ticket into a mailbox. These answers are the ones the
 * inbox actually receives; the contact form stays one click away for the rest.
 *
 * Every answer here must match shipped behaviour — a help page that describes a
 * product we do not have is worse than no help page.
 */

/* The `Eyebrow` chip that used to sit above the heading below is removed
   (doctrine ruling 2 — zero eyebrows, the heading carries itself). */

// Copy lives in locales/<lng>/help.json; this list only holds the keys.
const SECTIONS = [
  { icon: FiUser, key: 'profile', faqs: ['badge', 'photos', 'parents', 'nri'] },
  { icon: FiCreditCard, key: 'plans', faqs: ['unlocks', 'upgrade', 'carryOver', 'refund', 'secure'] },
  { icon: FiMessageCircle, key: 'matches', faqs: ['message', 'score'] },
  { icon: FiShield, key: 'safety', faqs: ['behaviour', 'appeal', 'delete'] },
];

const Faq = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-4 text-left py-4 min-h-[2.75rem]"
      >
        <span className="font-medium text-neutral-900 dark:text-neutral-100">{q}</span>
        <FiChevronDown className={`w-4 h-4 text-neutral-400 mt-1 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-base text-neutral-600 dark:text-neutral-300 leading-relaxed pb-4 -mt-1 max-w-2xl">{a}</p>}
    </div>
  );
};

export default function Help() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-1 text-neutral-900 dark:text-neutral-100">
      <Seo
        title="Help Centre"
        description="Answers about verification, plans and contact unlocks, matches and messaging, safety and account deletion on TricityMatch — plus how to reach our support team."
        path="/help"
      />

      {/* Hero */}
      <section className="px-4 pt-24 pb-12 md:pt-32 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 inline-block py-2 px-2 -mx-2 -mt-2 mb-8">{t('help.backHome')}</Link>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] max-w-3xl">
            <Trans i18nKey="help.heroTitle" components={{ em: <span className="text-primary-700 dark:text-primary-300 italic" /> }} />
          </h1>
          <p className="mt-6 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
            {t('help.heroBody')}
          </p>
        </div>
      </section>

      {/* Contact channels */}
      <section className="px-4 pb-14">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href={`mailto:${support.email}`}
            className="bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 hover:border-primary-300 transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center mb-4">
              <FiMail className="w-5 h-5" />
            </span>
            <h2 className="font-display text-lg font-bold mb-1">{t('help.channels.email')}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 break-all">{support.email}</p>
          </a>

          <Link
            to="/contact"
            className="bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 hover:border-primary-300 transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center mb-4">
              <FiHelpCircle className="w-5 h-5" />
            </span>
            <h2 className="font-display text-lg font-bold mb-1">{t('help.channels.form')}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('help.channels.formBody')}</p>
          </Link>

          {/* Rendered only when a real WhatsApp number is configured — a dead
              support channel is worse than one fewer channel. */}
          {support.whatsapp && (
            <a
              href={`https://wa.me/${support.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 hover:border-primary-300 transition-colors"
            >
              <span className="w-11 h-11 rounded-full bg-success-50 text-success flex items-center justify-center mb-4">
                <FaWhatsapp className="w-5 h-5" />
              </span>
              <h2 className="font-display text-lg font-bold mb-1">{t('help.channels.whatsapp')}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('help.channels.whatsappBody')}</p>
            </a>
          )}
        </div>
      </section>

      {/* FAQ sections */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto space-y-6">
          {SECTIONS.map(({ icon: Icon, key, faqs }) => (
            <div key={key} className="bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <h2 className="font-display text-xl md:text-2xl font-bold">{t(`help.sections.${key}`)}</h2>
              </div>
              <div>
                {faqs.map((f) => <Faq key={f} q={t(`help.faqs.${f}.q`)} a={t(`help.faqs.${f}.a`)} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer links */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-3">
          <Link to="/safety" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:border-primary-400 transition-colors">
            <FiShield className="w-4 h-4" /> {t('help.links.safety')}
          </Link>
          <Link to="/privacy" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:border-primary-400 transition-colors">
            {t('help.links.privacy')}
          </Link>
          <Link to="/delete-account" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:border-primary-400 transition-colors">
            <FiTrash2 className="w-4 h-4" /> {t('help.links.delete')}
          </Link>
          <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
            {t('help.links.stuck')} <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
