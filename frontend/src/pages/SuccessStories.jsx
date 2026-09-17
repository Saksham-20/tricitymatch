import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { FiHeart, FiArrowRight } from 'react-icons/fi';
import Seo from '../components/common/Seo';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

/* The `Eyebrow` chip that used to sit above every heading on this page is
   removed (doctrine ruling 2 — zero eyebrows, the heading carries itself). */

export default function SuccessStories() {
  const { t } = useTranslation();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  // A failed fetch used to render identically to "no stories yet" (both fell
  // through to stories=[]) — a server outage never reads as zeros, so the
  // error path now gets its own state and a retry that actually retries.
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/success-stories');
      setStories(res.data.stories || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-[100dvh] bg-[#FDF8F2] text-neutral-900">
      <Seo
        title="Success Stories"
        description="Real couples who found their life partner on TricityMatch across Chandigarh, Mohali and Panchkula."
        path="/success-stories"
      />

      {/* Hero */}
      <section className="px-4 pt-24 pb-12 md:pt-32 md:pb-14 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05]">
            Found on TricityMatch,
            <span className="text-primary-700 italic"> married for life.</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600">{t('successStories.subtitle')}</p>
        </div>
      </section>

      {/* Stories */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-[#FFFAF6] border border-neutral-200 rounded-2xl overflow-hidden flex flex-col">
                  <Skeleton className="w-full h-52 rounded-none" />
                  <div className="p-7 flex flex-col flex-1">
                    <Skeleton variant="circle" className="w-8 h-8 mb-5" />
                    <Skeleton.Text lines={3} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Couldn't load stories"
              description="Something went wrong fetching these. Please try again."
              onRetry={load}
              className="max-w-md mx-auto bg-[#FFFAF6] border border-neutral-200 rounded-2xl"
            />
          ) : stories.length === 0 ? (
            <EmptyState
              icon={FiHeart}
              title="No stories yet"
              description={t('successStories.empty')}
              className="max-w-md mx-auto bg-[#FFFAF6] border border-neutral-200 rounded-2xl"
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((s) => (
                <article key={s.id} className="bg-[#FFFAF6] border border-neutral-200 rounded-2xl overflow-hidden flex flex-col">
                  {s.photoUrl && (
                    <img src={s.photoUrl} alt={s.coupleNames} className="w-full h-52 object-cover" loading="lazy" />
                  )}
                  <div className="p-7 flex flex-col flex-1">
                    <span className="font-display text-5xl leading-none text-primary-200 mb-1" aria-hidden="true">“</span>
                    <p className="text-neutral-700 leading-relaxed mb-6 -mt-3">{s.quote}</p>
                    <div className="mt-auto pt-4 border-t border-neutral-200">
                      <p className="font-display text-lg font-bold text-neutral-900">{s.coupleNames}</p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-400 mt-1">
                        {s.location}{s.marriedOn ? ` · ${t('successStories.married')} ${new Date(s.marriedOn).getFullYear()}` : ''}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-[#7C1D3A] to-[#5C1229] text-[#FDF8F2] px-8 py-14 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 text-[#FDF8F2]">Write your own story.</h2>
          {/* Was "Thousands of Tricity families found their forever here" — an
              unsupported headcount, the same species of claim as the "Join
              thousands of families" line removed from Home.jsx (see
              docs/LEGAL_REVIEW_2026-09-17.md A-3). This page shows only real,
              published stories; the honest claim is that they're real, not a
              count we don't have. */}
          <p className="text-[#FDF8F2]/70 max-w-xl mx-auto mb-8">
            Real Tricity couples found their forever here. Yours could be next.
          </p>
          <Link to="/onboarding" className="inline-flex items-center justify-center gap-2 bg-[#FDF8F2] text-primary-800 font-semibold px-7 py-3.5 rounded-full hover:bg-white transition-colors">
            Create free profile <FiArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}
