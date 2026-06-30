import React from 'react';
import { Link } from 'react-router-dom';
import { FiShield, FiMessageCircle, FiMapPin, FiFlag, FiCheck, FiPhone, FiArrowRight } from 'react-icons/fi';
import Seo from '../components/common/Seo';

const Eyebrow = ({ children, className = '' }) => (
  <span className={`inline-block font-mono text-[11px] uppercase tracking-[0.2em] text-primary-600 ${className}`}>
    {children}
  </span>
);

const PILLARS = [
  {
    icon: FiShield,
    n: '01',
    t: 'Profile verification',
    body: 'Every profile is verified with government-issued ID before going live. Verified profiles display a badge and receive 3× more responses — always prefer them when connecting.',
    points: [],
  },
  {
    icon: FiMessageCircle,
    n: '02',
    t: 'Safe messaging',
    body: null,
    points: [
      'Never share financial information in chats',
      "Don't send money to anyone you haven't met in person",
      'Be cautious of anyone rushing you off-platform',
      'Report suspicious behaviour with the Report button',
    ],
  },
  {
    icon: FiMapPin,
    n: '03',
    t: 'Meeting safely',
    body: null,
    points: [
      'Meet first in a public place, with family or friends',
      'Tell a trusted person your plans before meeting',
      "Don't share your home address until you're comfortable",
    ],
  },
  {
    icon: FiFlag,
    n: '04',
    t: 'Reporting & blocking',
    body: 'Use Report and Block on any profile. Reports are reviewed by our safety team within 24 hours. Blocked users cannot view your profile or contact you.',
    points: [],
  },
];

export default function Safety() {
  return (
    <div className="min-h-screen bg-[#FDF8F2] text-neutral-900">
      <Seo
        title="Safety & Trust"
        description="How TricityShadi keeps members safe — verification, privacy controls, and dating-safety guidance."
        path="/safety"
      />

      {/* Hero */}
      <section className="px-4 pt-24 pb-14 md:pt-32 md:pb-16">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500 hover:text-primary-600 transition-colors mb-10 block w-fit">← Back to home</Link>
          <Eyebrow className="mb-5">● Safety centre · Your trust comes first</Eyebrow>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] max-w-3xl">
            Meet with <span className="text-primary-700 italic">confidence.</span>
          </h1>
          <p className="mt-6 text-lg text-neutral-600 max-w-2xl leading-relaxed">
            We do the groundwork on verification and privacy so you can focus on finding the right person.
            Here's how we keep the platform — and you — safe.
          </p>
        </div>
      </section>

      {/* Trust pillars */}
      <section className="px-4 pb-16 md:pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-px bg-neutral-200 border border-neutral-200 rounded-2xl overflow-hidden">
          {PILLARS.map(({ icon: Icon, n, t, body, points }) => (
            <div key={n} className="bg-[#FFFAF6] p-7 md:p-9 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <span className="w-11 h-11 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="font-mono text-[11px] tracking-[0.16em] text-neutral-400">{n}</span>
              </div>
              <h2 className="font-display text-xl md:text-2xl font-bold text-neutral-900 mb-3">{t}</h2>
              {body && <p className="text-sm text-neutral-600 leading-relaxed">{body}</p>}
              {points.length > 0 && (
                <ul className="space-y-2.5 mt-1">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-neutral-700">
                      <FiCheck className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>{p}</span>
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
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-[#7C1D3A] to-[#5C1229] text-[#FDF8F2] px-8 py-12 md:py-14">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <span className="w-14 h-14 rounded-full bg-[#FDF8F2]/12 flex items-center justify-center flex-shrink-0">
              <FiPhone className="w-6 h-6 text-[#D4B048]" />
            </span>
            <div className="flex-1">
              <Eyebrow className="mb-2 !text-[#D4B048]">— Emergency</Eyebrow>
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 text-[#FDF8F2]">In immediate danger? Call 112.</h2>
              <p className="text-[#FDF8F2]/70 max-w-xl">
                For platform safety concerns, email{' '}
                <a href="mailto:support@tricityshadi.com" className="underline decoration-[#D4B048] underline-offset-4 hover:text-white">support@tricityshadi.com</a>.
                Our team responds within 24 hours.
              </p>
            </div>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 bg-[#FDF8F2] text-primary-800 font-semibold px-6 py-3.5 rounded-full hover:bg-white transition-colors flex-shrink-0">
              Contact us <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
