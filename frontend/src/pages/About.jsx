import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { FiArrowRight, FiCheck, FiShield, FiMapPin, FiHeart, FiLock, FiUsers } from 'react-icons/fi';
import Seo from '../components/common/Seo';

/* The `Eyebrow` chip that used to sit above every heading on this page is
   removed (doctrine ruling 2 — zero eyebrows, the heading carries itself). */

// Copy lives in locales/<lng>/about.json; these lists only hold the keys.
const STATS = ['selfie', 'tricity', 'family'];

const ALWAYS_STAT = 'reviewed';

const VALUES = [
  { icon: FiShield, n: '01', key: 'verified' },
  { icon: FiLock, n: '02', key: 'privacy' },
  { icon: FiUsers, n: '03', key: 'family' },
  { icon: FiMapPin, n: '04', key: 'local' },
  { icon: FiHeart, n: '05', key: 'pricing' },
  { icon: FiCheck, n: '06', key: 'human' },
];

export default function About() {
  const { t } = useTranslation();
  const stats = [...STATS, ALWAYS_STAT].map((k) => ({
    value: t(`about.stats.${k}.value`),
    label: t(`about.stats.${k}.label`),
  }));
  return (
    <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-1 text-neutral-900 dark:text-neutral-100">
      <Seo
        title="About Us"
        description="Learn about TricityMatch — the trusted hyperlocal matrimonial platform for Chandigarh, Mohali and Panchkula."
        path="/about"
      />

      {/* Hero */}
      <section className="px-4 pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 inline-flex items-center min-h-[44px] py-2 px-2 -mx-2 -mt-2 mb-8">{t('about.backHome')}</Link>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] text-neutral-900 dark:text-neutral-100 max-w-3xl">
            {t('about.heroTitle')}
            <span className="text-primary-700 italic">{t('about.heroTitleEm')}</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
            {t('about.heroBody')}
          </p>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-[#FFFAF6] dark:bg-surface-dark-2 border-y border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center md:text-left">
              <div className="font-display text-4xl md:text-5xl font-bold text-primary-700 dark:text-primary-300">{s.value}</div>
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-400 mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission — editorial split */}
      <section className="px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-16">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">
              {t('about.missionTitle')}<span className="italic text-primary-700">{t('about.missionTitleEm')}</span>
            </h2>
          </div>
          <div className="space-y-5 text-neutral-700 dark:text-neutral-300 text-base leading-relaxed pt-1">
            <p>{t('about.missionP1')}</p>
            <p>{t('about.missionP2')}</p>
          </div>
        </div>
      </section>

      {/* Values grid */}
      <section className="px-4 pb-16 md:pb-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-10">{t('about.valuesTitle')}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-200 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            {VALUES.map(({ icon: Icon, n, key }) => (
              <div key={n} className="bg-[#FFFAF6] dark:bg-surface-dark-3 p-7 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <span className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center">
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-xs tracking-[0.16em] text-neutral-400 dark:text-neutral-500 tabular-nums">{n}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{t(`about.values.${key}.t`)}</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{t(`about.values.${key}.d`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto rounded-2xl bg-primary-600 text-[#FDF8F2] px-8 py-14 md:py-16 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 text-[#FDF8F2]">{t('about.ctaTitle')}</h2>
          <p className="text-[#FDF8F2]/70 max-w-xl mx-auto mb-8">
            <Trans
              i18nKey="about.ctaBody"
              components={{ mail: <a href="mailto:support@tricitymatch.com" className="underline decoration-[#FDF8F2]/60 underline-offset-4 hover:text-white" /> }}
            />
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/onboarding" className="inline-flex items-center justify-center gap-2 bg-[#FDF8F2] text-primary-900 font-semibold px-7 py-3.5 rounded-xl hover:bg-white transition-colors">
              {t('about.ctaPrimary')} <FiArrowRight />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 border border-[#FDF8F2]/40 text-[#FDF8F2] font-semibold px-7 py-3.5 rounded-xl hover:bg-[#FDF8F2]/10 transition-colors">
              {t('about.ctaContact')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
