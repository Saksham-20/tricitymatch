import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { FiArrowRight, FiCamera, FiCheck, FiChevronDown, FiMapPin, FiShield, FiUserCheck } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import { CITIES, CITY_SLUGS, getCityCopy } from '../data/cityMatrimony';

/**
 * City landing pages (Phase S, F3) — /matrimony/chandigarh|mohali|panchkula.
 *
 * ONE template, three content instances (src/data/cityMatrimony.js, with the
 * visible copy in i18n/locales/<lng>/cityPages.json). The route
 * names were fixed before they went into the sitemap: an indexed URL that later
 * moves throws away everything it earned.
 *
 * Honesty bar is the landing page's: no member counts, no "browse N profiles",
 * no activity claims, and no free-membership offer (the founding offer is off
 * by choice).
 *
 * Theme: full light/dark parity via `dark:` variants; elder mode needs nothing
 * special (html.elder scales the root font and this page uses relative units).
 */

// Copy for each step lives under cityPages.verify.<id> in the translation files.
const VERIFY_STEPS = [
  { id: 'live', icon: FiCamera },
  { id: 'human', icon: FiUserCheck },
  { id: 'badge', icon: FiShield },
];

export default function CityMatrimony() {
  const { t } = useTranslation();
  const { city: slug } = useParams();
  const [openFaq, setOpenFaq] = useState(0);

  const meta = CITIES[String(slug || '').toLowerCase()];
  if (!meta) return <Navigate to="/" replace />;
  const city = { ...meta, ...getCityCopy(meta.slug, t) };

  const path = `/matrimony/${city.slug}`;

  return (
    <div className="min-h-[100dvh] bg-[#FDF8F2] dark:bg-surface-dark-1 text-neutral-900 dark:text-neutral-100">
      <Seo title={meta.seoTitle} description={meta.seoDescription} path={path} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16 md:py-24">
        {/* Doctrine ruling 2: zero eyebrows. The location tag that used to sit
            above this heading is dropped — the heading already names the city. */}
        <h1 className="font-display text-4xl sm:text-5xl leading-[1.08] tracking-tight">
          {t('cityPages.hero.line1', { city: city.name })}<br />
          <em className="italic text-primary-700 dark:text-primary-300">{t('cityPages.hero.line2', { city: city.name })}</em>
        </h1>
        <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
          {city.lede}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/onboarding"
            className="btn-primary inline-flex items-center gap-2 min-h-[48px] text-sm"
          >
            {t('cityPages.cta')} <FiArrowRight aria-hidden="true" />
          </Link>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('cityPages.tagline')}
          </span>
        </div>
      </section>

      {/* ── Founding band ────────────────────────────────────────────────────
          Colours are pinned to literal brand values, NOT to the neutral scale:
          this band is dark in BOTH themes, and the scale inverts under
          `html.dark` (bg-neutral-900 resolves to a near-WHITE there), which
          renders the whole band light-on-light. Same reason the heading names
          its own colour — index.css colours h2 with an element rule that beats
          an inherited one. */}
      <section className="bg-[#2D1A22] dark:bg-surface-dark-2 text-[#FDF8F2]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
          <h2 className="font-display text-2xl sm:text-3xl leading-snug max-w-3xl text-[#FDF8F2]">
            <Trans
              i18nKey="cityPages.founding.heading"
              values={{ city: city.name }}
              components={{ em: <em className="italic text-[#FDF8F2]" /> }}
            />
          </h2>
          <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-[#FDF8F2]/75">
            {t('cityPages.founding.body')}
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 min-h-[48px] px-7 rounded-xl bg-[#FDF8F2] text-[#2D1A22] text-sm font-medium mt-7 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white active:scale-[0.97] transition-[background-color,transform] duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#FDF8F2]"
          >
            {t('cityPages.cta')} <FiArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── How verification works ───────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16 md:py-24">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">{t('cityPages.verify.heading')}</h2>
        <p className="mt-3 max-w-2xl text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
          {t('cityPages.verify.sub')}
        </p>
        <div className="grid gap-5 sm:grid-cols-3 mt-8">
          {VERIFY_STEPS.map(({ id, icon: Icon }) => (
            <div
              key={id}
              className="rounded-2xl bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-800 p-6"
            >
              <Icon className="w-5 h-5 text-primary-600 dark:text-primary-300" aria-hidden="true" />
              <h3 className="font-semibold mt-3 text-base">{t(`cityPages.verify.${id}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{t(`cityPages.verify.${id}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Locality specifics ───────────────────────────────────────────── */}
      <section className="bg-white dark:bg-surface-dark-3 border-y border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 md:py-24 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight">{city.locality.heading}</h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
              {city.locality.body}
            </p>
          </div>
          <ul className="space-y-4">
            {city.locality.points.map((point) => (
              <li key={point} className="flex gap-3">
                <FiCheck className="w-4 h-4 text-primary-600 dark:text-primary-300 mt-1 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-16 md:py-24">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
          {t('cityPages.faqHeading', { city: city.name })}
        </h2>
        <div className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800 border-t border-b border-neutral-200 dark:border-neutral-800">
          {city.faqs.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  className="w-full flex items-center justify-between gap-4 text-left min-h-[56px] py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                >
                  <span className="font-medium text-base">{faq.q}</span>
                  <FiChevronDown
                    aria-hidden="true"
                    className={`w-4 h-4 flex-shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <p id={`faq-panel-${i}`} className="pb-5 -mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Closing CTA + sibling cities (internal linking) ──────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16 md:py-24">
        <div className="rounded-2xl bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-800 p-8 sm:p-10 text-center">
          <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
            {t('cityPages.closing.heading')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
            {t('cityPages.closing.body')}
          </p>
          <Link
            to="/onboarding"
            className="btn-primary inline-flex items-center gap-2 min-h-[48px] mt-7 text-sm"
          >
            {t('cityPages.cta')} <FiArrowRight aria-hidden="true" />
          </Link>
        </div>

        <nav aria-label={t('cityPages.otherCities')} className="mt-8 flex flex-wrap justify-center gap-3">
          {CITY_SLUGS.filter((s) => s !== city.slug).map((s) => (
            <Link
              key={s}
              to={`/matrimony/${s}`}
              className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-white dark:hover:bg-surface-dark-3 transition-colors"
            >
              <FiMapPin className="w-3.5 h-3.5 text-primary-600 dark:text-primary-300" aria-hidden="true" />
              {t('cityPages.matrimonyIn', { city: t(`cityPages.names.${s}`) })}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
