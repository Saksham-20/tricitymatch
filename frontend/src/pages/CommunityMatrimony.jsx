import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { FiArrowRight, FiChevronDown, FiMapPin, FiShield, FiUsers } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import useFoundingWindow from '../hooks/useFoundingWindow';
import { CITIES } from '../data/cityMatrimony';
import { COMMUNITIES } from '../data/communityMatrimony';

/**
 * Community × city landing pages — /matrimony/:city/:community.
 *
 * The long tail the national sites cannot write. Each page composes two
 * genuinely distinct content blocks — the community's own (how these families
 * tend to match) and the city's locality block, reused verbatim from the city
 * page — so the page is a real intersection rather than a slug substitution.
 *
 * Unknown city or community redirects to the city page or home rather than
 * 404-ing, so a mistyped or retired slug still lands somewhere useful.
 *
 * Same honesty bar as everything else public: no member counts, no activity
 * claims, and the founding line is server-gated so it cannot promise a window
 * that has closed.
 */
export default function CommunityMatrimony() {
  const { city: citySlug, community: communitySlug } = useParams();
  const founding = useFoundingWindow();
  const [openFaq, setOpenFaq] = useState(0);

  const city = CITIES[String(citySlug || '').toLowerCase()];
  const community = COMMUNITIES[String(communitySlug || '').toLowerCase()];
  if (!city) return <Navigate to="/" replace />;
  if (!community) return <Navigate to={`/matrimony/${city.slug}`} replace />;

  const path = `/matrimony/${city.slug}/${community.slug}`;
  const title = `${community.seoName} Matrimony in ${city.name}`;

  // The community FAQ first (it is why they searched), then two from the city
  // page so the page answers the ordinary questions too.
  const faqs = [community.faq, ...(city.faqs || []).slice(0, 2)];

  return (
    <div className="min-h-screen bg-[#FDF8F2] dark:bg-[#0f1117] text-neutral-900 dark:text-neutral-100">
      <Seo
        title={title}
        description={`${community.seoName} matrimonial matches in ${city.name}, with live-selfie verification, gotra and horoscope matching, and families close enough to meet this week.`}
        path={path}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-14 pb-12">
        <nav aria-label="Breadcrumb" className="text-xs text-neutral-500 dark:text-neutral-400">
          <Link to={`/matrimony/${city.slug}`} className="hover:text-primary-700 dark:hover:text-primary-300">
            Matrimony in {city.name}
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span>{community.name}</span>
        </nav>

        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300 mt-5">
          <FiMapPin className="w-3.5 h-3.5" aria-hidden="true" />
          {city.name} · {community.name}
        </span>
        <h1 className="font-display text-4xl sm:text-5xl leading-[1.08] tracking-tight mt-4">
          {community.name} matrimony<br />
          <em className="italic text-primary-700 dark:text-primary-300">in {city.name}.</em>
        </h1>
        <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
          {community.lede}
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

      {/* ── What matching looks like in this community ───────────────────── */}
      <section className="bg-white dark:bg-[#1a1f2e] border-y border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
              How {community.name} families here tend to match
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
              {community.body}
            </p>
          </div>
          <ul className="space-y-4">
            {community.points.map((point) => (
              <li key={point} className="flex gap-3 text-sm sm:text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
                <FiUsers className="w-4 h-4 text-primary-600 dark:text-primary-300 flex-shrink-0 mt-1" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── The city half of the intersection ────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">{city.locality.heading}</h2>
        <p className="mt-4 max-w-3xl text-sm sm:text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          {city.locality.body}
        </p>
        <Link
          to={`/matrimony/${city.slug}`}
          className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline"
        >
          Everything about matrimony in {city.name} <FiArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ── Verification + founding ──────────────────────────────────────── */}
      <section className="bg-[#2D1A22] dark:bg-[#14182a] text-[#FDF8F2]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold-400">— Verified, not claimed</span>
          <h2 className="font-display text-2xl sm:text-3xl leading-snug mt-4 max-w-3xl text-[#FDF8F2]">
            Every badge here was earned with a live selfie —{' '}
            <em className="italic text-gold-400">
              {founding.open ? 'and founding members join free.' : 'checked by a person, not a score.'}
            </em>
          </h2>
          <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-[#FDF8F2]/75">
            The camera opens in the browser and the photo is taken there and then — there is no upload
            option anywhere in the flow, because an uploaded file can be borrowed or edited. A reviewer
            on our team compares it against the profile photos by hand.
            {founding.open && ' Join while the founding period is open and your membership is free until it ends.'}
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 min-h-[48px] px-7 rounded-full bg-[#FDF8F2] text-[#2D1A22] text-sm font-medium mt-7 hover:bg-white transition-colors"
          >
            <FiShield className="w-4 h-4" aria-hidden="true" /> Create a verified profile
          </Link>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">Questions families ask</h2>
        <div className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800 border-y border-neutral-200 dark:border-neutral-800">
          {faqs.map((faq, i) => (
            <div key={faq.q}>
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                aria-expanded={openFaq === i}
                className="w-full flex items-start justify-between gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                <span className="text-base font-medium">{faq.q}</span>
                <FiChevronDown
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 text-neutral-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
              {openFaq === i && (
                <p className="pb-5 -mt-1 text-sm sm:text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 min-h-[48px] px-7 rounded-full bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium transition-colors"
          >
            Create your profile <FiArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}
