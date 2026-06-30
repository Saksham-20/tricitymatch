import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { FiHeart, FiArrowRight } from 'react-icons/fi';
import Seo from '../components/common/Seo';

const Eyebrow = ({ children, className = '' }) => (
  <span className={`inline-block font-mono text-[11px] uppercase tracking-[0.2em] text-primary-600 ${className}`}>
    {children}
  </span>
);

export default function SuccessStories() {
  const { t } = useTranslation();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/success-stories');
        setStories(res.data.stories || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#FDF8F2] text-neutral-900">
      <Seo
        title="Success Stories"
        description="Real couples who found their life partner on TricityShadi across Chandigarh, Mohali and Panchkula."
        path="/success-stories"
      />

      {/* Hero */}
      <section className="px-4 pt-24 pb-12 md:pt-32 md:pb-14 text-center">
        <div className="max-w-3xl mx-auto">
          <Eyebrow className="mb-5">● Real couples · Real weddings</Eyebrow>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05]">
            Found on TricityShadi,
            <span className="text-primary-700 italic"> married for life.</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600">{t('successStories.subtitle')}</p>
        </div>
      </section>

      {/* Stories */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-[#FFFAF6] border border-neutral-200 rounded-2xl p-7 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-neutral-200 mb-5" />
                  <div className="h-3 bg-neutral-200 rounded w-full mb-2" />
                  <div className="h-3 bg-neutral-200 rounded w-4/5 mb-6" />
                  <div className="h-3 bg-neutral-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : stories.length === 0 ? (
            <div className="max-w-md mx-auto text-center bg-[#FFFAF6] border border-neutral-200 rounded-2xl py-16 px-6">
              <span className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4">
                <FiHeart className="w-5 h-5" />
              </span>
              <p className="text-neutral-600">{t('successStories.empty')}</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((s) => (
                <article key={s.id} className="bg-[#FFFAF6] border border-neutral-200 rounded-2xl overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
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
          <Eyebrow className="mb-4 !text-[#D4B048]">— Your turn</Eyebrow>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 text-[#FDF8F2]">Write your own story.</h2>
          <p className="text-[#FDF8F2]/70 max-w-xl mx-auto mb-8">
            Thousands of Tricity families found their forever here. Yours could be next.
          </p>
          <Link to="/onboarding" className="inline-flex items-center justify-center gap-2 bg-[#FDF8F2] text-primary-800 font-semibold px-7 py-3.5 rounded-full hover:bg-white transition-colors">
            Create free profile <FiArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}
