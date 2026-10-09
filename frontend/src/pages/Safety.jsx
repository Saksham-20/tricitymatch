import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { FiShield, FiMessageCircle, FiMapPin, FiFlag, FiCheck, FiPhone, FiArrowRight } from 'react-icons/fi';
import Seo from '../components/common/Seo';

/* The `Eyebrow` chip that used to sit above every heading on this page is
   removed (doctrine ruling 2 — zero eyebrows, the heading carries itself). */

// Copy lives in locales/<lng>/safetyPage.json; this list only holds the keys.
const PILLARS = [
  { icon: FiShield, n: '01', key: 'verification', body: true, points: [] },
  { icon: FiMessageCircle, n: '02', key: 'messaging', body: false, points: ['p1', 'p2', 'p3', 'p4'] },
  { icon: FiMapPin, n: '03', key: 'meeting', body: false, points: ['p1', 'p2', 'p3'] },
  { icon: FiFlag, n: '04', key: 'reporting', body: true, points: [] },
];

export default function Safety() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-1 text-neutral-900 dark:text-neutral-100">
      <Seo
        title="Safety & Trust"
        description="How TricityMatch keeps members safe — verification, privacy controls, and dating-safety guidance."
        path="/safety"
      />

      {/* Hero */}
      <section className="px-4 pt-24 pb-14 md:pt-32 md:pb-16">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 inline-flex items-center min-h-[44px] py-2 px-2 -mx-2 -mt-2 mb-8">{t('safetyPage.backHome')}</Link>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] max-w-3xl">
            {t('safetyPage.heroTitle')}<span className="text-primary-700 dark:text-primary-300 italic">{t('safetyPage.heroTitleEm')}</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
            {t('safetyPage.heroBody')}
          </p>
        </div>
      </section>

      {/* Trust pillars */}
      <section className="px-4 pb-16 md:pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          {PILLARS.map(({ icon: Icon, n, key, body, points }) => (
            <div key={n} className="bg-[#FFFAF6] dark:bg-surface-dark-3 p-7 md:p-9 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <span className="w-11 h-11 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-xs tracking-[0.16em] text-neutral-400 dark:text-neutral-500 tabular-nums">{n}</span>
              </div>
              <h2 className="font-display text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">{t(`safetyPage.pillars.${key}.t`)}</h2>
              {body && <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{t(`safetyPage.pillars.${key}.body`)}</p>}
              {points.length > 0 && (
                <ul className="space-y-2.5 mt-1">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                      <FiCheck className="w-4 h-4 text-primary-600 dark:text-primary-300 mt-0.5 flex-shrink-0" />
                      <span>{t(`safetyPage.pillars.${key}.${p}`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Emergency callout */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto rounded-2xl bg-primary-600 text-[#FDF8F2] px-8 py-12 md:py-14">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <span className="w-14 h-14 rounded-full bg-[#FDF8F2]/12 flex items-center justify-center flex-shrink-0">
              <FiPhone className="w-6 h-6 text-[#FDF8F2]" />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 text-[#FDF8F2]">{t('safetyPage.emergencyTitle')}</h2>
              <p className="text-[#FDF8F2]/70 max-w-xl">
                <Trans
                  i18nKey="safetyPage.emergencyBody"
                  components={{ mail: <a href="mailto:support@tricitymatch.com" className="underline decoration-[#FDF8F2]/60 underline-offset-4 hover:text-white" /> }}
                />
              </p>
            </div>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 bg-[#FDF8F2] text-primary-900 font-semibold px-6 py-3.5 rounded-xl hover:bg-white transition-colors flex-shrink-0">
              {t('safetyPage.contactUs')} <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
