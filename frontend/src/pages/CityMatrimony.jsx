import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { FiArrowRight, FiCamera, FiCheck, FiChevronDown, FiMapPin, FiShield, FiUserCheck } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import useFoundingWindow from '../hooks/useFoundingWindow';
import { CITIES, CITY_SLUGS } from '../data/cityMatrimony';

/**
 * City landing pages (Phase S, F3) — /matrimony/chandigarh|mohali|panchkula.
 *
 * ONE template, three content instances (src/data/cityMatrimony.js). The route
 * names were fixed before they went into the sitemap: an indexed URL that later
 * moves throws away everything it earned.
 *
 * Honesty bar is the landing page's: no member counts, no "browse N profiles",
 * no activity claims. The founding promise is server-gated the same way — the
 * stronger "free premium period" line appears only while the window is open.
 *
 * Theme: full light/dark parity via `dark:` variants; elder mode needs nothing
 * special (html.elder scales the root font and this page uses relative units).
 */

const VERIFY_STEPS = [
  {
    icon: FiCamera,
    title: 'A live selfie, in the app',
    body: 'The camera opens in the browser and the photo is captured there and then. There is no upload option anywhere in the flow — an uploaded file can be borrowed, edited or lifted from someone else’s profile.',
  },
  {
    icon: FiUserCheck,
    title: 'Matched by a person',
    body: 'A reviewer on our team compares that selfie against the profile photos side by side. No score, no automated pass — a human decides.',
  },
  {
    icon: FiShield,
    title: 'The badge, and what it means',
    body: 'Approved profiles carry a verified badge and can be filtered for. It means one specific thing — this person’s photos match their face — and we do not stretch it to mean anything else.',
  },
];

export default function CityMatrimony() {
  const { city: slug } = useParams();
  const founding = useFoundingWindow();
  const [openFaq, setOpenFaq] = useState(0);

  const city = CITIES[String(slug || '').toLowerCase()];
  if (!city) return <Navigate to="/" replace />;

  const path = `/matrimony/${city.slug}`;

  return (
    <div className="min-h-screen bg-[#FDF8F2] dark:bg-[#0f1117] text-neutral-900 dark:text-neutral-100">
      <Seo title={city.seoTitle} description={city.seoDescription} path={path} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-14 pb-12">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300">
          <FiMapPin className="w-3.5 h-3.5" aria-hidden="true" />
          Tricity only · {city.name}
        </span>
        <h1 className="font-display text-4xl sm:text-5xl leading-[1.08] tracking-tight mt-5">
          Matrimony in {city.name},<br />
          <em className="italic text-primary-700 dark:text-primary-300">built for {city.name}.</em>
        </h1>
        <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
          {city.lede}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 min-h-[48px] px-7 rounded-full bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors"
          >
            Create your profile <FiArrowRight />
          </Link>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Free to join · Verified with a live selfie
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
      <section className="bg-[#2D1A22] dark:bg-[#14182a] text-[#FDF8F2]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-400">— Founding members</span>
          <h2 className="font-display text-2xl sm:text-3xl leading-snug mt-4 max-w-3xl text-[#FDF8F2]">
            We&apos;re building this one verified {city.name} family at a time —{' '}
            <em className="italic text-gold-400">
              {founding.open ? 'founding members join free.' : 'and doing it in the open.'}
            </em>
          </h2>
          <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-[#FDF8F2]/75">
            No inflated numbers and no borrowed profiles. Everyone here chose to be here, every verified
            badge was earned with a live selfie, and nobody is matched outside the Tricity.
            {founding.open
              ? ' Join while the founding period is open and your membership is free until the period ends.'
              : ' Founding members join free and shape what this becomes.'}
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 min-h-[48px] px-7 rounded-full bg-[#FDF8F2] text-[#2D1A22] text-sm font-medium mt-7 hover:bg-white transition-colors"
          >
            Become a founding member <FiArrowRight />
          </Link>
        </div>
      </section>

      {/* ── How verification works ───────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">How verification works</h2>
        <p className="mt-3 max-w-2xl text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
          The single thing most worth checking before a family invests time in a match.
        </p>
        <div className="grid gap-5 sm:grid-cols-3 mt-8">
          {VERIFY_STEPS.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="rounded-2xl bg-white dark:bg-[#1a1f2e] border border-neutral-200 dark:border-neutral-800 p-6"
            >
              <span className="font-mono text-[11px] text-neutral-400">0{i + 1}</span>
              <Icon className="w-5 h-5 text-primary-600 dark:text-primary-300 mt-3" aria-hidden="true" />
              <h3 className="font-semibold mt-3 text-base">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Locality specifics ───────────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#1a1f2e] border-y border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14 grid gap-10 lg:grid-cols-2">
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
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
          Questions {city.name} families ask
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
                  className="w-full flex items-center justify-between gap-4 text-left min-h-[56px] py-4"
                >
                  <span className="font-medium text-[15px]">{faq.q}</span>
                  <FiChevronDown
                    aria-hidden="true"
                    className={`w-4 h-4 flex-shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <p className="pb-5 -mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Closing CTA + sibling cities (internal linking) ──────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-20">
        <div className="rounded-3xl bg-white dark:bg-[#1a1f2e] border border-neutral-200 dark:border-neutral-800 p-8 sm:p-10 text-center">
          <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
            Start with a profile your family would stand behind
          </h2>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
            It takes about two minutes. You choose what is visible, who can message you, and whether
            your family can see your matches.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 min-h-[48px] px-7 rounded-full bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium mt-7 transition-colors"
          >
            Create your profile <FiArrowRight />
          </Link>
        </div>

        <nav aria-label="Other Tricity cities" className="mt-8 flex flex-wrap justify-center gap-3">
          {CITY_SLUGS.filter((s) => s !== city.slug).map((s) => (
            <Link
              key={s}
              to={`/matrimony/${s}`}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-white dark:hover:bg-[#1a1f2e] transition-colors"
            >
              <FiMapPin className="w-3.5 h-3.5 text-primary-600 dark:text-primary-300" aria-hidden="true" />
              Matrimony in {CITIES[s].name}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
