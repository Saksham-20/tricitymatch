import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheck, FiShield, FiMapPin, FiHeart, FiLock, FiUsers } from 'react-icons/fi';
import Seo from '../components/common/Seo';

const Eyebrow = ({ children, className = '' }) => (
  <span
    className={`inline-block font-mono text-[11px] uppercase tracking-[0.2em] text-primary-600 ${className}`}
  >
    {children}
  </span>
);

const STATS = [
  { value: '1,190+', label: 'Marriages made' },
  { value: '50K+', label: 'Verified members' },
  { value: '92%', label: 'Reply within 48 hrs' },
  { value: '15 yr', label: 'Serving Tricity families' },
];

const VALUES = [
  { icon: FiShield, n: '01', t: 'Verified, every profile', d: 'Selfie verification and human review before any profile goes live. Zero fake accounts, zero exceptions.' },
  { icon: FiLock, n: '02', t: 'Privacy-first', d: 'Your data is yours. Browse incognito, control who sees you, numbers never shared.' },
  { icon: FiUsers, n: '03', t: 'Family-oriented', d: 'Matching that respects family background, values, and the people who matter in the decision.' },
  { icon: FiMapPin, n: '04', t: 'Hyperlocal focus', d: 'Built only for Chandigarh, Mohali and Panchkula. Partners within driving distance.' },
  { icon: FiHeart, n: '05', t: 'Transparent pricing', d: 'Clear plans, no hidden fees, no surprise renewals. Free to start.' },
  { icon: FiCheck, n: '06', t: 'Human-reviewed', d: 'A real safety team reviews profiles and reports — not just an algorithm.' },
];

export default function About() {
  return (
    <div className="min-h-screen bg-[#FDF8F2] text-neutral-900">
      <Seo
        title="About Us"
        description="Learn about TricityShadi — the trusted hyperlocal matrimonial platform for Chandigarh, Mohali and Panchkula."
        path="/about"
      />

      {/* Hero */}
      <section className="px-4 pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500 hover:text-primary-600 transition-colors mb-10 block w-fit">← Back to home</Link>
          <Eyebrow className="mb-5">● Our story · Tricity only · Since 2011</Eyebrow>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] text-neutral-900 max-w-3xl">
            Matrimony built for families,
            <span className="text-primary-700 italic"> not algorithms.</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600 max-w-2xl leading-relaxed">
            TricityShadi is a hyperlocal matrimonial platform built specifically for families in
            Chandigarh, Mohali and Panchkula — where finding a life partner is meaningful, safe and community-first.
          </p>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-[#3A0E1E] text-[#FDF8F2]">
        <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center md:text-left">
              <div className="font-display text-4xl md:text-5xl font-bold text-[#D4B048]">{s.value}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#FDF8F2]/55 mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission — editorial split */}
      <section className="px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-16">
          <div>
            <Eyebrow className="mb-4">— Our mission</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">
              50,000 serious local members, <span className="italic text-primary-700">not 50 million strangers.</span>
            </h2>
          </div>
          <div className="space-y-5 text-neutral-700 text-base leading-relaxed pt-1">
            <p>
              Unlike generic matrimonial platforms, TricityShadi focuses on the Tricity region — bringing together
              people who share local roots, cultural values and community ties.
            </p>
            <p>
              Our intelligent matching considers compatibility, family background, education and lifestyle to suggest
              the connections that actually lead somewhere. Every profile is photo-verified and human-reviewed before
              it goes live, and every family is within driving distance.
            </p>
          </div>
        </div>
      </section>

      {/* Values grid */}
      <section className="px-4 pb-16 md:pb-24">
        <div className="max-w-5xl mx-auto">
          <Eyebrow className="mb-4">— What we stand for</Eyebrow>
          <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-10">Six principles that shape every decision.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-200 border border-neutral-200 rounded-2xl overflow-hidden">
            {VALUES.map(({ icon: Icon, n, t, d }) => (
              <div key={n} className="bg-[#FFFAF6] p-7 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <span className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.16em] text-neutral-400">{n}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-neutral-900 mb-2">{t}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-[#7C1D3A] to-[#5C1229] text-[#FDF8F2] px-8 py-14 md:py-16 text-center">
          <Eyebrow className="mb-4 !text-[#D4B048]">— Begin your journey</Eyebrow>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 text-[#FDF8F2]">Your forever starts with one step.</h2>
          <p className="text-[#FDF8F2]/70 max-w-xl mx-auto mb-8">
            Have questions or feedback? Reach us at{' '}
            <a href="mailto:support@tricityshadi.com" className="underline decoration-[#D4B048] underline-offset-4 hover:text-white">support@tricityshadi.com</a>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/onboarding" className="inline-flex items-center justify-center gap-2 bg-[#FDF8F2] text-primary-800 font-semibold px-7 py-3.5 rounded-full hover:bg-white transition-colors">
              Create free profile <FiArrowRight />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 border border-[#FDF8F2]/40 text-[#FDF8F2] font-semibold px-7 py-3.5 rounded-full hover:bg-[#FDF8F2]/10 transition-colors">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
