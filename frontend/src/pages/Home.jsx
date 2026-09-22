/**
 * Home — the acquisition surface.
 *
 * Concept, 2026-09-22: "Planned City". Three things carry it, and all three are
 * answers to why the previous version read as bland rather than as calm.
 *
 * 1. THE GRID IS DRAWN. Chandigarh is a planned city on a published modular
 *    grid, which is art direction no national competitor can truthfully use.
 *    The page's real 12-column layout grid is rendered as hairlines behind the
 *    content on its light bands, and every element sits on it. The craft floor
 *    allows a grid overlay when there is an actual blueprint under it; here the
 *    blueprint is the subject.
 * 2. THE MECHANISM IS THE EVIDENCE. A logged-out visitor previously saw zero
 *    product and six adjectives. They now see the machinery: the real eight
 *    Ashtakoot kutas we score and their real point ceilings (read off
 *    `backend/utils/compatibility.js`), the real verification sequence, and the
 *    real `ReplyMeter` component imported from the chat surface. No invented
 *    member, no fabricated count, no drawn-rectangle screenshot.
 * 3. A THIRD GROUND. The palette had two light surfaces and one ink band, which
 *    is why a long page flattened into beige. `--concrete` (added to index.css
 *    in the same commit) is the Capitol Complex grey, used for whole bands
 *    only. Burgundy stays accent-only, gold stays premium-only.
 *
 * Audience decision, same date: member-first, parent must still survive. The
 * tone is written for someone 25 to 32. Elder mode, 48px targets, the keyboard
 * path and the no-hover-only rule remain hard requirements, and the doctrine's
 * bans (no pinning, no scroll-hijack, no scrubbed scroll, no idle loops, no
 * GSAP) were confirmed binding rather than relaxed.
 *
 * Imagery: `frontend/public/images/landing/` is AI-generated and says so. Real
 * Tricity photography is commissioned; when it lands, swapping the manifest
 * entries removes the disclosure on its own.
 */
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  FiArrowRight, FiCheck, FiX, FiPlus, FiMinus, FiCamera, FiEye,
  FiChevronLeft, FiChevronRight, FiAward,
} from 'react-icons/fi';
import { FaInstagram, FaFacebook, FaTwitter, FaWhatsapp } from 'react-icons/fa';

import Seo from '../components/common/Seo';
import ReplyMeter from '../components/chat/ReplyMeter';
import api from '../api/axios';
import { track, STAGES } from '../utils/analytics';
import useFoundingWindow from '../hooks/useFoundingWindow';
import { support } from '../config';
import { revealOnce, fadeRise, staggerIndex, EASE_OUT, DUR } from '../utils/animations';
import { EDITORIAL_IMAGES } from '../data/editorialImages';

/* The fixed-palette ink surfaces. Deliberately not Tailwind neutral utilities:
   `html.dark` inverts `bg-neutral-900` to near-white, which would turn these
   bands inside out. `bg-concrete` and `bg-white` are theme-reactive tokens and
   are used as classes; only the ink is pinned. */
const INK = '#241519';
const INK_TEXT = '#FDF8F2';
const INK_TEXT_SOFT = 'rgba(253,248,242,0.74)';
const INK_LINE = 'rgba(253,248,242,0.18)';
const GOLD_ON_INK = '#E8C34A'; /* gold-400, the ~9:1-on-dark value index.css already uses */

const CITIES = [
  {
    name: 'Chandigarh',
    slug: 'chandigarh',
    plaque: 'CHD',
    line: 'The planned one. Sectors, roundabouts, and a coffee at 17 that turns into three hours.',
    image: EDITORIAL_IMAGES.cities.chandigarh,
  },
  {
    name: 'Mohali',
    slug: 'mohali',
    plaque: 'SAS',
    line: 'The working one. IT parks, the stadium, and everyone you went to school with two phases away.',
    image: EDITORIAL_IMAGES.cities.mohali,
  },
  {
    name: 'Panchkula',
    slug: 'panchkula',
    plaque: 'PKL',
    line: 'The quiet one. Hills at the end of the road, families who have been here three generations.',
    image: EDITORIAL_IMAGES.cities.panchkula,
  },
];

/* The eight kutas, their real point ceilings and the real one-line meanings,
   read straight off `backend/utils/compatibility.js` (the `ashtakoot` block at
   its line 272). Thirty-six points total. Domain fact plus our own scoring, not
   sample data, which is why it can sit on a marketing page without a caveat. */
const GUNAS = [
  { n: 'Varna', max: 1, detail: 'Spiritual compatibility' },
  { n: 'Vashya', max: 2, detail: 'Mutual attraction' },
  { n: 'Tara', max: 3, detail: 'Birth-star compatibility' },
  { n: 'Yoni', max: 4, detail: 'Physical harmony' },
  { n: 'Graha Maitri', max: 5, detail: 'Psychological compatibility' },
  { n: 'Gana', max: 6, detail: 'Temperament' },
  { n: 'Bhakoot', max: 7, detail: 'Love and health' },
  { n: 'Nadi', max: 8, detail: 'Health and progeny' },
];
const GUNA_TOTAL = GUNAS.reduce((sum, g) => sum + g.max, 0);

/* The non-astrological half, by category. Named, not weighted: the weights are
   real but they are tuning values that move, and publishing a number we then
   change is the kind of small dishonesty this page exists to avoid. */
const SIGNALS = [
  'Age, and the age you asked for',
  'City and sector',
  'Education and profession',
  'Religion, community, gotra',
  'Diet, smoking, drinking',
  'Interests you both listed',
  'Manglik status and rashi',
  'What your family said matters',
];

const VERIFY_STEPS = [
  { icon: FiCamera, t: 'Camera, or nothing', b: 'The selfie is captured live, in the app. There is no upload button, because a file can be anybody.' },
  { icon: FiEye, t: 'A person looks at it', b: 'Someone on our team compares the selfie to your profile photos. Not a model, not a score.' },
  { icon: FiAward, t: 'The badge is yours', b: 'It shows on your profile and in search. It is the one badge we have, and it cannot be bought.' },
];

const STEPS = [
  { n: '01', t: 'Make a profile', b: 'Two screens, about two minutes. Fill in the rest whenever you feel like it.' },
  { n: '02', t: 'Get verified', b: 'One live selfie. A person reviews it, usually within hours.' },
  { n: '03', t: 'See who fits', b: 'Ranked matches, refreshed daily. You control who can see you the whole time.' },
  { n: '04', t: 'Talk, then meet', b: 'Encrypted in transit, your number stays yours, and family comes in when you say so.' },
];

const FAQS = [
  {
    q: 'Do you only accept Tricity residents?',
    a: 'Yes. Every profile is from Chandigarh, Mohali or Panchkula, or has direct family ties here. Hyperlocal is the whole point, not a filter.',
  },
  {
    q: 'How does verification work?',
    a: 'You take a live selfie in the app, captured in the moment and never uploaded from a file, and someone on our team compares it to your profile photos. The badge appears once it is approved.',
  },
  {
    q: 'Can I look around without an account?',
    a: 'Search and full profiles need a free account. Making one takes about two minutes and you can start browsing straight away.',
  },
  {
    q: 'I live abroad. Can NRIs join?',
    a: 'Yes, if you are from the Tricity or your family is. Where you live now does not matter; the roots do. Mark yourself as an NRI at sign-up and add your country, and families looking for an NRI alliance will find you. A parent or sibling here can search alongside you through Guardian access.',
  },
  {
    q: 'What does Premium actually unlock?',
    a: 'One plan, nothing to compare: unlimited contact unlocks, unlimited messaging, advanced filters, Incognito mode, a profile boost and a spotlight listing, for the full term. Browsing, matching and your profile stay free.',
  },
  {
    q: 'Is my data private?',
    a: 'Conversations are encrypted in transit and readable only by you and your match. We never share your phone number, never sell data, and never show you to someone you have not matched with.',
  },
  {
    q: 'Do my parents have to be involved?',
    a: 'Only when you want them to be. Guardian access is opt-in, it gives them their own view and their own chat channel, and it never shows them your conversations.',
  },
];

const LOOKING_FOR = [
  { value: 'bride', label: 'bride' },
  { value: 'groom', label: 'groom' },
];
const AGES = Array.from({ length: 33 }, (_, i) => 21 + i); // 21..53

/* Scroll reveals.
 *
 * Two things this has to get right. `revealOnce` carries its transition inside
 * the `whileInView` target, so a sibling `transition` prop is silently ignored:
 * a staggered reveal has to rebuild the target rather than layer a prop on it.
 * And doctrine 4.6 asks that reduced motion put scroll reveals at their settled
 * state IMMEDIATELY. `MotionConfig reducedMotion="user"` drops the translation
 * but keeps the opacity animation, which still leaves content invisible until
 * it is scrolled past, so the props are dropped outright.
 *
 * Read once at module scope, like the scroll-timeline probe below: the
 * preference does not change mid-session in practice, and reading it per
 * component would put a hook in a dozen places to no visible end. */
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const reveal = (index = 0) => {
  if (prefersReducedMotion) return {};
  if (index === 0) return revealOnce;
  return {
    ...revealOnce,
    whileInView: {
      ...revealOnce.whileInView,
      transition: { ...revealOnce.whileInView.transition, delay: staggerIndex(index) },
    },
  };
};

/* ═══════════════════════════════════════════════════════════════════
   Scoped CSS — only what utilities cannot express.
   ═══════════════════════════════════════════════════════════════════ */
const PageStyle = () => (
  <style>{`
    .tm-progress {
      position: fixed; top: 0; left: 0; right: 0; height: 2px;
      transform-origin: 0 50%; z-index: 60;
      background: linear-gradient(90deg, #8B2346, #C9A227);
    }
    @supports (animation-timeline: scroll()) {
      .tm-progress-css { animation: tm-progress-grow linear both; animation-timeline: scroll(); }
    }
    @keyframes tm-progress-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

    /* The one authored moment on the page. The headline's three lines wipe up
       from their own baseline and the photograph wipes down, both on clip-path,
       which the craft floor names as sanctioned material beyond transform and
       opacity. Fires once on load, under 800ms, and never again. */
    @keyframes tm-line-in {
      from { clip-path: inset(0 0 100% 0); transform: translateY(0.12em); }
      to   { clip-path: inset(0 0 -0.3em 0); transform: translateY(0); }
    }
    @keyframes tm-photo-in {
      from { clip-path: inset(0 0 100% 0); }
      to   { clip-path: inset(0 0 0 0); }
    }
    .tm-line { display: block; animation: tm-line-in 700ms cubic-bezier(0.23,1,0.32,1) both; }
    .tm-line:nth-child(2) { animation-delay: 80ms; }
    .tm-line:nth-child(3) { animation-delay: 160ms; }
    .tm-photo { animation: tm-photo-in 800ms cubic-bezier(0.23,1,0.32,1) 120ms both; }

    /* The mad-libs selects are words in a sentence, so they carry an underline
       rather than a box. 16px floor: iOS Safari force-zooms a focused input
       below it and the hero layout breaks. */
    .tm-inline-select {
      appearance: none; -webkit-appearance: none;
      background: transparent; border: 0;
      border-bottom: 1.5px solid #8B2346;
      color: #8B2346; font-weight: 600; font-size: 16px; line-height: 1.5;
      padding: 2px 18px 3px 2px; margin: 0 2px; cursor: pointer;
      background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238B2346' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 2px center;
      transition: border-color 160ms ease, background-color 160ms ease;
      border-radius: 2px;
    }
    .tm-inline-select:focus-visible { outline: 2px solid #8B2346; outline-offset: 3px; }
    /* index.css gives every select under html.dark a filled box with its own
       border and colour, with !important and higher specificity than a class.
       These are words in a sentence, not form boxes, so they win explicitly. */
    html.dark .tm-inline-select {
      color: #e0a6b8 !important;
      background-color: transparent !important;
      border: 0 !important;
      border-bottom: 1.5px solid #e0a6b8 !important;
      background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23e0a6b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") !important;
      background-repeat: no-repeat !important;
      background-position: right 2px center !important;
    }
    html.dark .tm-inline-select option { color: #ebebeb; background: #252b3b; }

    /* Hover is pointer-gated: a tap fires a synthetic mouseenter with no
       matching leave, which strands a control in its hover state. */
    @media (hover: hover) and (pointer: fine) {
      .tm-inline-select:hover { background-color: rgba(139,35,70,0.06); }
      .tm-city:hover .tm-city-img { transform: scale(1.04); }
      .tm-footer-link:hover { color: #E8C34A; }
      .tm-social:hover { background: #8B2346; border-color: #8B2346; color: #FDF8F2; }
    }
    .tm-city-img { transition: transform 400ms cubic-bezier(0.23,1,0.32,1); }
    /* A press is a press on every input type, so this needs no gate. */
    .tm-press { transition: transform 120ms cubic-bezier(0.23,1,0.32,1); }
    .tm-press:active { transform: scale(0.985); }

    .tm-sticky {
      position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 60;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 10px 12px 10px 16px; border-radius: 14px;
      background: #241519; color: #FDF8F2;
      box-shadow: 0 8px 30px rgba(36,21,25,0.28);
      transform: translateY(calc(100% + 16px)); opacity: 0;
      transition: transform 240ms cubic-bezier(0.23,1,0.32,1), opacity 240ms cubic-bezier(0.23,1,0.32,1);
    }
    .tm-sticky.is-shown { transform: translateY(0); opacity: 1; }
    @media (min-width: 768px) { .tm-sticky { display: none; } }

    /* Elder mode raises every target to 48px. These are the controls that sit
       at or under the 44px floor at default scale. */
    html.elder .tm-faq-toggle { width: 48px; height: 48px; }
    html.elder .tm-announce-dismiss { padding: 16px; }
    html.elder .tm-story-nav { width: 48px; height: 48px; }
    html.elder .tm-social { width: 48px; height: 48px; }

    /* Reduced motion: fewer and gentler, not zero. Colour and opacity survive
       so the interface still shows it heard you; the wipes, the photo scale and
       the progress bar do not. */
    @media (prefers-reduced-motion: reduce) {
      .tm-progress, .tm-progress-css { display: none; }
      .tm-line, .tm-photo { animation: none; clip-path: none; transform: none; }
      .tm-city-img, .tm-press { transition: none; }
      .tm-sticky { transform: none; transition: opacity 150ms ease; }
    }
  `}</style>
);

/* ═══════════════════════════════════════════════════════════════════
   Layout furniture: the grid, and the signage the city is full of.
   ═══════════════════════════════════════════════════════════════════ */
const Shell = ({ children, className = '' }) => (
  <div className={`relative mx-auto w-full max-w-[1280px] px-4 md:px-8 ${className}`}>{children}</div>
);

/* The page's real column grid, drawn. Same 12 columns and same gutter the
   content is laid out on, so it reads as structure rather than wallpaper.
   Hidden below md, where four columns of hairline would just be noise. */
const GridRules = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
    <div className="mx-auto h-full w-full max-w-[1280px] px-4 md:px-8">
      <div className="grid h-full grid-cols-12 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="border-l border-[rgba(36,21,25,0.07)] last:border-r dark:border-[rgba(253,248,242,0.06)]"
          />
        ))}
      </div>
    </div>
  </div>
);

/* Sector signage. Chandigarh labels everything, and a small filled plaque is a
   cheaper and far more local way to number a sequence than the 72px serif
   numeral inside an animated progress ring this page used to carry. */
const Plaque = ({ children, className = '' }) => (
  <span
    className={`inline-flex items-center justify-center bg-primary-500 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] tabular-nums text-white ${className}`}
  >
    {children}
  </span>
);

const SectionHead = ({ title, lead, onInk = false, className = '' }) => (
  <motion.div {...reveal()} className={`max-w-[42ch] ${className}`}>
    <h2
      className="font-display text-[clamp(2rem,4.2vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em]"
      style={onInk ? { color: INK_TEXT } : undefined}
    >
      {title}
    </h2>
    {lead && (
      <p
        className={`mt-4 text-[17px] leading-[1.6] ${onInk ? '' : 'text-neutral-600'}`}
        style={{ textWrap: 'pretty', ...(onInk ? { color: INK_TEXT_SOFT } : {}) }}
      >
        {lead}
      </p>
    )}
  </motion.div>
);

/* ═══════════════════════════════════════════════════════════════════
   Announcement — founding offer only, server-gated, fail-closed.
   ═══════════════════════════════════════════════════════════════════ */
const Announcement = ({ founding, onDismiss }) => (
  <AnimatePresence>
    {founding.open && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: DUR.accordion, ease: EASE_OUT }}
        style={{ background: INK, color: INK_TEXT, overflow: 'hidden' }}
        className="relative z-40"
      >
        <div className="relative mx-auto flex max-w-[1280px] items-center justify-center gap-3 px-10 py-2.5 text-[13px] leading-[1.5]">
          <p style={{ textWrap: 'pretty' }}>
            <span className="font-semibold" style={{ color: GOLD_ON_INK }}>Founding offer</span>
            {': '}
            {founding.grantDays ? `${founding.grantDays} days` : 'A period'} of Premium, free
            {founding.contactUnlocks != null
              ? `, with ${founding.contactUnlocks} contact unlock${founding.contactUnlocks === 1 ? '' : 's'}`
              : ''}
            .{' '}
            <Link to="/onboarding" className="font-semibold underline underline-offset-2">Claim it</Link>
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss announcement"
            className="tm-announce-dismiss absolute right-1 top-1/2 -translate-y-1/2 p-2.5 opacity-70 transition-opacity duration-150 hover:opacity-100"
          >
            <FiX className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ═══════════════════════════════════════════════════════════════════
   MatchFinder — the hero's conversion device.

   Every competitor in this market opens with a product action rather than a
   signup ask. Three controls compose one English sentence and hand the answer
   to the funnel. The subline says plainly that a free account comes first,
   because a control that says "show me matches" and silently lands on a signup
   wall is the one trade this product cannot afford.
   ═══════════════════════════════════════════════════════════════════ */
const MatchFinder = () => {
  const navigate = useNavigate();
  const [lookingFor, setLookingFor] = useState('bride');
  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(32);
  const [city, setCity] = useState('chandigarh');

  const onSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams({
      lookingFor,
      ageMin: String(ageMin),
      ageMax: String(Math.max(ageMax, ageMin)),
      city,
    });
    navigate(`/onboarding?${params.toString()}`);
  };

  /* Keeping max >= min without a validation message: the pair is a range, and
     silently clamping is kinder than telling somebody they chose wrong. */
  const onMinChange = (value) => {
    setAgeMin(value);
    if (value > ageMax) setAgeMax(value);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 bg-white p-5 shadow-card md:mt-8 md:p-7"
      aria-label="Find matches"
    >
      <p className="text-[17px] leading-[2] text-neutral-700">
        Looking for a
        <label className="sr-only" htmlFor="tm-for">Who you are looking for</label>
        <select
          id="tm-for"
          className="tm-inline-select"
          value={lookingFor}
          onChange={(e) => setLookingFor(e.target.value)}
        >
          {LOOKING_FOR.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="whitespace-nowrap">
          aged
          <label className="sr-only" htmlFor="tm-age-min">Minimum age</label>
          <select
            id="tm-age-min"
            className="tm-inline-select"
            value={ageMin}
            onChange={(e) => onMinChange(Number(e.target.value))}
          >
            {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          to
          <label className="sr-only" htmlFor="tm-age-max">Maximum age</label>
          <select
            id="tm-age-max"
            className="tm-inline-select"
            value={ageMax}
            onChange={(e) => setAgeMax(Number(e.target.value))}
          >
            {AGES.filter((a) => a >= ageMin).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </span>
        <span className="whitespace-nowrap">
          in
          <label className="sr-only" htmlFor="tm-city">City</label>
          <select
            id="tm-city"
            className="tm-inline-select"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            <option value="all">all three cities</option>
          </select>
        </span>
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="btn-primary tm-press inline-flex items-center gap-2">
          Show me matches
          <FiArrowRight aria-hidden="true" />
        </button>
        <p className="text-[13px] text-neutral-500">Free account first. About two minutes.</p>
      </div>
    </form>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Hero — the grid, the headline, one photograph running off the edge.
   ═══════════════════════════════════════════════════════════════════ */
const Hero = ({ heroRef }) => {
  const photo = EDITORIAL_IMAGES.heroStack.front;

  return (
    <section ref={heroRef} className="relative overflow-hidden pb-14 pt-6 md:pb-20 md:pt-10 lg:min-h-[660px]">
      <GridRules />

      {/* On lg the photograph leaves the container and runs to the viewport
          edge. Full bleed with square corners reads editorial; the rounded card
          this replaced read like every other template. */}
      <figure className="tm-photo absolute right-0 top-0 hidden h-full w-[40vw] max-w-[620px] lg:block">
        <img
          src={photo.src}
          alt={photo.alt}
          width="900"
          height="1200"
          loading="eager"
          className="h-full w-full object-cover object-top"
        />
        {photo.aiGenerated && (
          <figcaption
            className="absolute bottom-0 left-0 right-0 px-4 py-2 text-[11px] leading-[1.4]"
            style={{ background: 'rgba(0,0,0,0.62)', color: '#FFFFFF' }}
          >
            Illustrative photography, AI-generated. Not a member.
          </figcaption>
        )}
      </figure>

      <Shell>
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <motion.div
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.06, delayChildren: 0.28 } } }}
            className="lg:col-span-7"
          >
            <h1 className="font-display text-[clamp(2.75rem,6.4vw,5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-neutral-900">
              <span className="tm-line">From match</span>
              <span className="tm-line">to mandap,</span>
              <span className="tm-line italic text-primary-500">all in the Tricity.</span>
            </h1>

            <motion.p
              variants={fadeRise}
              className="mt-6 max-w-[42ch] text-[17px] leading-[1.6] text-neutral-600 md:text-[18px]"
              style={{ textWrap: 'pretty' }}
            >
              Three cities, one short list, and a person checking every face on
              it. Close enough that both families can meet this week.
            </motion.p>

            {/* The photograph on mobile, edge to edge, above the fold. The old
                mobile fold was 100% text, which is the one thing every
                competitor in this market gets right and we did not. */}
            <motion.figure variants={fadeRise} className="-mx-4 mt-6 lg:hidden">
              <img
                src={photo.src}
                alt={photo.alt}
                width="800"
                height="450"
                loading="eager"
                className="aspect-[16/9] w-full object-cover object-top"
              />
              {photo.aiGenerated && (
                <figcaption className="px-4 pt-2 text-[12px] leading-[1.5] text-neutral-500">
                  Illustrative photography, AI-generated. Not a member.
                </figcaption>
              )}
            </motion.figure>

            <motion.div variants={fadeRise}>
              <MatchFinder />
            </motion.div>

            <motion.ul
              variants={fadeRise}
              className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-neutral-500 md:mt-6"
            >
              {['Live selfie verification', 'No credit card to join', 'Verified in hours'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <FiCheck className="h-3.5 w-3.5 text-primary-500" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </Shell>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Proof strip — process claims, because we do not publish size claims.
   Every line is true in production today.
   ═══════════════════════════════════════════════════════════════════ */
const PROOF = [
  ['Checked by a person', 'Every selfie reviewed by our team, not a model'],
  ['Verified in hours', 'Not days, and never from a file you upload'],
  ['Free to read and reply', 'Five replies over 48 hours when a match writes first'],
  ['Seven-day refund', 'Ask within a week of paying, no justification needed'],
];

const ProofStrip = () => (
  <section style={{ background: INK, color: INK_TEXT }}>
    <Shell className="py-10 md:py-12">
      <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {PROOF.map(([title, body], i) => (
          <motion.li
            key={title}
            {...reveal(i)}
            className="lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
            style={{ borderColor: INK_LINE }}
          >
            <p className="text-[15px] font-semibold leading-[1.4]">{title}</p>
            <p className="mt-1.5 text-[14px] leading-[1.55]" style={{ color: INK_TEXT_SOFT }}>{body}</p>
          </motion.li>
        ))}
      </ul>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Mechanisms — the machinery, not adjectives.

   Replaces a six-card "what makes us different" grid, the most generic shape in
   software marketing, which said nothing a competitor could not copy in an
   afternoon. Three real mechanisms instead, each of which is either our own
   published scoring, our own shipped process, or a component imported straight
   from the app.
   ═══════════════════════════════════════════════════════════════════ */
const Mechanisms = () => {
  /* The real component from the chat surface, rendered with a real-shaped
     window. Not a drawing of it. */
  const demoWindow = {
    active: true,
    messagesRemaining: 5,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };

  return (
    <section id="why" className="relative scroll-mt-24 bg-concrete py-16 md:py-24">
      <GridRules />
      <Shell>
        <SectionHead
          title="Open the machine and look"
          lead="Three things every other site describes in one sentence. Here is what they actually are."
        />

        {/* 1 — verification */}
        <div className="mt-14 grid gap-8 lg:grid-cols-12 lg:gap-6">
          <motion.div {...reveal()} className="lg:col-span-4">
            <Plaque>Verification</Plaque>
            <h3 className="mt-4 font-display text-[26px] font-semibold leading-[1.25] tracking-[-0.015em] text-neutral-900">
              A badge you cannot upload
            </h3>
            <p className="mt-3 max-w-[38ch] text-[15px] leading-[1.6] text-neutral-600">
              We dropped government-ID collection in July and background checks
              in the same month. We are not a state authority. What is left is
              the part that actually proves you are you.
            </p>
          </motion.div>

          <div className="grid gap-px border border-neutral-300/70 bg-neutral-300/70 dark:border-neutral-700 dark:bg-neutral-700 sm:grid-cols-3 lg:col-span-8">
            {VERIFY_STEPS.map(({ icon: Icon, t, b }, i) => (
              <motion.div key={t} {...reveal(i)} className="bg-white p-6">
                <Icon className="h-5 w-5 text-primary-500" aria-hidden="true" />
                <p className="mt-4 text-[16px] font-semibold leading-[1.35] text-neutral-900">{t}</p>
                <p className="mt-2 text-[14px] leading-[1.55] text-neutral-600">{b}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 2 — the 36 points. The page's centrepiece: nobody else in this
            category shows the actual scoring table before you sign up. */}
        <div className="mt-16 grid gap-8 lg:grid-cols-12 lg:gap-6">
          <motion.div {...reveal()} className="lg:col-span-4">
            <Plaque>Matching</Plaque>
            <h3 className="mt-4 font-display text-[26px] font-semibold leading-[1.25] tracking-[-0.015em] text-neutral-900">
              {GUNA_TOTAL} points of Ashtakoot, then the rest of your life
            </h3>
            <p className="mt-3 max-w-[38ch] text-[15px] leading-[1.6] text-neutral-600">
              These are the eight kutas we score and the points each can carry,
              exactly as the app computes them. Your parents already know this
              table. Now you can see it too, before paying anybody.
            </p>
            <Link
              to="/onboarding"
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-[15px] font-medium text-primary-500 underline-offset-4 hover:underline"
            >
              Get your own match report
              <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </motion.div>

          <motion.div {...reveal()} className="lg:col-span-8">
            <table className="w-full border-collapse bg-white text-left">
              <caption className="sr-only">
                The eight Ashtakoot kutas and the maximum points each contributes
              </caption>
              <thead>
                <tr className="border-b border-neutral-200">
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Kuta</th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">What it weighs</th>
                  <th scope="col" className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Points</th>
                </tr>
              </thead>
              <tbody>
                {GUNAS.map((g) => (
                  <tr key={g.n} className="border-b border-neutral-200">
                    <td className="px-5 py-3.5 text-[15px] font-semibold text-neutral-900">{g.n}</td>
                    <td className="px-5 py-3.5 text-[14px] text-neutral-600">{g.detail}</td>
                    <td className="px-5 py-3.5 text-right text-[15px] font-semibold tabular-nums text-neutral-900">{g.max}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-5 py-3.5 text-[15px] font-semibold text-neutral-900" colSpan={2}>Total</td>
                  <td className="px-5 py-3.5 text-right text-[15px] font-semibold tabular-nums text-primary-500">{GUNA_TOTAL}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-5 bg-white p-5">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                Weighed alongside it
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-neutral-600">
                {SIGNALS.map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <FiCheck className="h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>

        {/* 3 — the free reply window, shown with the app's own component */}
        <div className="mt-16 grid gap-8 lg:grid-cols-12 lg:gap-6">
          <motion.div {...reveal()} className="lg:col-span-4">
            <Plaque>Messaging</Plaque>
            <h3 className="mt-4 font-display text-[26px] font-semibold leading-[1.25] tracking-[-0.015em] text-neutral-900">
              Free members are not mute
            </h3>
            <p className="mt-3 max-w-[38ch] text-[15px] leading-[1.6] text-neutral-600">
              Every message you receive is free to read, always. When a premium
              match writes to you first, you get five replies over the next 48
              hours without paying anything. The big sites took this away in
              2026. We added it.
            </p>
          </motion.div>

          <motion.div {...reveal()} className="lg:col-span-8">
            <div className="bg-white p-6 md:p-8">
              <p className="flex flex-wrap items-baseline gap-x-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-none tracking-[-0.02em] text-neutral-900">
                <span className="tabular-nums">5</span>
                <span className="text-[16px] font-normal text-neutral-600">replies</span>
                <span className="tabular-nums">48</span>
                <span className="text-[16px] font-normal text-neutral-600">hours</span>
                <span className="tabular-nums">&#8377;0</span>
              </p>
              <div className="mt-6 border-t border-neutral-200 pt-5">
                <p className="text-[13px] text-neutral-500">
                  This is the meter itself, the same component that sits under
                  your composer in the app:
                </p>
                <ReplyMeter replyWindow={demoWindow} />
              </div>
            </div>
          </motion.div>
        </div>
      </Shell>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   How it works — four plaques on the grid.
   ═══════════════════════════════════════════════════════════════════ */
const HowItWorks = () => (
  <section id="how" className="relative scroll-mt-24 py-16 md:py-24">
    <GridRules />
    <Shell>
      <SectionHead title="How it works" lead="Four steps. Only the first one asks anything of you." />
      <ol className="mt-12 grid gap-y-10 border-t border-neutral-200 md:grid-cols-4 md:gap-x-6">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            {...reveal(i)}
            className="pt-6 md:border-l md:border-neutral-200 md:pl-5 md:first:border-l-0 md:first:pl-0"
          >
            <Plaque>{s.n}</Plaque>
            <h3 className="mt-4 text-[17px] font-semibold leading-[1.4] text-neutral-900">{s.t}</h3>
            <p className="mt-2 text-[15px] leading-[1.6] text-neutral-600">{s.b}</p>
          </motion.li>
        ))}
      </ol>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Cities — place as the proof. Full bleed, square edges, always visible.
   The previous version hid two thirds of this behind hover, with the labels
   rotated ninety degrees, on a site where half the traffic is touch.
   ═══════════════════════════════════════════════════════════════════ */
const Cities = () => (
  <section className="bg-white py-16 md:py-24">
    <div className="px-4 md:px-8">
      <SectionHead
        title="Three cities. You already know the roads."
        lead="Not a filter chip. The whole product is that your match is twenty minutes away and your families know the same people."
      />
    </div>

    <div className="mt-12 grid gap-px bg-neutral-200 dark:bg-neutral-700 md:grid-cols-3">
      {CITIES.map((c, i) => (
        <motion.div key={c.slug} {...reveal(i)} className="bg-white">
          <Link to={`/matrimony/${c.slug}`} className="tm-city group block">
            <figure className="overflow-hidden">
              <img
                src={c.image.src}
                alt={c.image.alt}
                width="800"
                height="600"
                loading="lazy"
                className="tm-city-img aspect-[4/3] w-full object-cover"
              />
            </figure>
            <div className="p-6 md:p-8">
              <Plaque>{c.plaque}</Plaque>
              <h3 className="mt-4 font-display text-[26px] font-semibold leading-[1.2] tracking-[-0.015em] text-neutral-900">
                {c.name}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.6] text-neutral-600">{c.line}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-[14px] font-medium text-primary-500 underline-offset-4 group-hover:underline">
                Browse {c.name}
                <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>

    {CITIES[0].image.aiGenerated && (
      <div className="mt-6 px-4 md:px-8">
        <p className="text-[12px] leading-[1.5] text-neutral-500">
          City photography is illustrative and AI-generated while the real
          Tricity shoot is in progress.
        </p>
      </div>
    )}
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Membership — the founding grant and the one plan.

   The price is read live from the same endpoint that charges it. Hardcoding it
   would go stale the first time somebody edits the offer in the admin pricing
   screen, which has already happened once in production.
   ═══════════════════════════════════════════════════════════════════ */
const Membership = ({ founding, plan }) => {
  const endsLabel = founding.endsAt
    ? new Date(founding.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <section id="membership" className="scroll-mt-24" style={{ background: INK, color: INK_TEXT }}>
      <Shell className="py-16 md:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <SectionHead
              onInk
              title={founding.open ? 'Founding members join free' : 'Joining is free'}
              lead={
                founding.open
                  ? `Make a profile, earn the badge and start matching at no cost${
                      founding.grantDays ? ` for ${founding.grantDays} days` : ''
                    }${
                      founding.contactUnlocks != null
                        ? `, with ${founding.contactUnlocks} contact unlock${founding.contactUnlocks === 1 ? '' : 's'}`
                        : ''
                    }.${endsLabel ? ` Open until ${endsLabel}.` : ''}`
                  : 'Making a profile, browsing and matching cost nothing. Premium buys the contact details and unlimited messaging, and that is all it buys.'
              }
            />
            <motion.ul {...reveal()} className="mt-8 space-y-3 text-[15px] leading-[1.5]">
              {[
                'Your profile, your photos, your verified badge',
                'Browsing, matching and daily recommendations',
                'Every message you receive, free to read',
              ].map((f) => (
                <li key={f} className="flex gap-3">
                  <FiCheck className="mt-1 h-4 w-4 shrink-0" style={{ color: GOLD_ON_INK }} aria-hidden="true" />
                  <span style={{ color: INK_TEXT_SOFT }}>{f}</span>
                </li>
              ))}
            </motion.ul>
            <motion.div {...reveal()} className="mt-8">
              <Link
                to="/onboarding"
                className="tm-press inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium transition-colors duration-150"
                style={{ background: INK_TEXT, color: '#8B2346' }}
              >
                {founding.open ? 'Become a founding member' : 'Create your free profile'}
                <FiArrowRight aria-hidden="true" />
              </Link>
            </motion.div>
          </div>

          <motion.div {...reveal()} className="p-7 md:p-8" style={{ background: 'rgba(253,248,242,0.06)' }}>
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: GOLD_ON_INK }}>
              Premium
            </h3>
            {plan?.amountLabel ? (
              <>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-[44px] font-semibold leading-none tabular-nums">
                    {plan.amountLabel}
                  </span>
                  {plan.durationLabel && (
                    <span className="text-[15px]" style={{ color: INK_TEXT_SOFT }}>
                      for {plan.durationLabel}
                    </span>
                  )}
                </p>
                {plan.mrpLabel && (
                  <p className="mt-2 text-[13px]" style={{ color: INK_TEXT_SOFT }}>
                    Launch price. The regular price is{' '}
                    <span className="tabular-nums line-through">{plan.mrpLabel}</span>.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-[15px]" style={{ color: INK_TEXT_SOFT }}>
                One plan, nothing to compare.
              </p>
            )}
            <ul className="mt-6 space-y-3 text-[15px] leading-[1.5]">
              {[
                'Unlimited contact unlocks',
                'Unlimited messaging',
                'Advanced filters and Incognito mode',
                'Profile boost and spotlight listing',
              ].map((f) => (
                <li key={f} className="flex gap-3">
                  <FiCheck className="mt-1 h-4 w-4 shrink-0" style={{ color: GOLD_ON_INK }} aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t pt-5 text-[14px] leading-[1.6]" style={{ borderColor: INK_LINE, color: INK_TEXT_SOFT }}>
              Ask for a refund within seven days of paying and you get the
              membership back in full, less only the unlocks you used.{' '}
              <Link to="/refund-policy" className="underline underline-offset-2" style={{ color: INK_TEXT }}>
                Read the refund policy
              </Link>
              .
            </p>
          </motion.div>
        </div>
      </Shell>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Stories — real, published, consented, or the section does not exist.

   No autoplay: a carousel that advances itself every six seconds is an idle
   loop, and it moves content somebody is halfway through reading.
   ═══════════════════════════════════════════════════════════════════ */
const Stories = ({ stories }) => {
  const [idx, setIdx] = useState(0);
  if (stories.length === 0) return null;

  const story = stories[idx];
  const go = (delta) => setIdx((i) => (i + delta + stories.length) % stories.length);

  return (
    <section id="stories" className="relative scroll-mt-24 py-16 md:py-24">
      <GridRules />
      <Shell>
        {/* Same two-column grammar the FAQ uses. Stories arrive with or without
            a photograph, and a layout that only composes when a photo happens
            to exist leaves half the section empty the rest of the time. */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <SectionHead
            className="lg:col-span-4"
            title="It has worked before"
            lead="Real couples, in their own words, published with their permission. We will show you the next one when there is one."
          />

          <motion.div {...reveal()} className="flex flex-col justify-center lg:col-span-8">
            {story.img && (
              <figure className="mb-8 overflow-hidden">
                <img
                  src={story.img}
                  alt={`${story.who}, who met on TricityMatch`}
                  width="900"
                  height="600"
                  loading="lazy"
                  className="aspect-[3/2] w-full object-cover"
                />
              </figure>
            )}

            <blockquote className="font-display text-[clamp(1.5rem,3vw,2.15rem)] font-medium leading-[1.3] tracking-[-0.015em] text-neutral-900">
              {story.quote}
            </blockquote>
            <p className="mt-6 text-[15px] font-semibold text-neutral-900">{story.who}</p>
            {story.where && <p className="mt-1 text-[14px] text-neutral-500">{story.where}</p>}

            {stories.length > 1 && (
              <div className="mt-8">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Previous story"
                    className="tm-story-nav tm-press flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-colors duration-150 hover:border-neutral-300"
                  >
                    <FiChevronLeft aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Next story"
                    className="tm-story-nav tm-press flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-colors duration-150 hover:border-neutral-300"
                  >
                    <FiChevronRight aria-hidden="true" />
                  </button>
                  <span className="text-[13px] tabular-nums text-neutral-500" aria-live="polite">
                    {idx + 1} of {stories.length}
                  </span>
                </div>
                <div className="mt-4 h-0.5 w-full max-w-[220px] bg-neutral-200">
                  <div
                    className="h-full bg-primary-500 transition-[width] duration-200"
                    style={{ width: `${((idx + 1) / stories.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </Shell>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   FAQ — the questions support actually receives.
   ═══════════════════════════════════════════════════════════════════ */
const Faq = () => {
  const [open, setOpen] = useState(-1);

  return (
    <section className="bg-concrete py-16 md:py-24">
      <Shell>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <SectionHead
              title="Questions, answered"
              lead="If yours is not here, write to us. We reply within a day, in English, Hindi or Punjabi."
            />
            <motion.div {...reveal()} className="mt-6">
              <Link
                to="/contact"
                className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-medium text-primary-500 underline-offset-4 hover:underline"
              >
                Contact support
                <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </motion.div>
          </div>

          <dl className="border-t border-neutral-300/70 dark:border-neutral-700 lg:col-span-8">
            {FAQS.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} className="border-b border-neutral-300/70 dark:border-neutral-700">
                  <dt>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? -1 : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-center justify-between gap-6 py-5 text-left"
                    >
                      <span className="font-display text-[19px] font-semibold leading-[1.35] tracking-[-0.01em] text-neutral-900">
                        {item.q}
                      </span>
                      <span className="tm-faq-toggle flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-300/70 text-neutral-700 dark:border-neutral-700">
                        {isOpen
                          ? <FiMinus className="h-4 w-4" aria-hidden="true" />
                          : <FiPlus className="h-4 w-4" aria-hidden="true" />}
                      </span>
                    </button>
                  </dt>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.dd
                        id={`faq-panel-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: DUR.accordion, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[62ch] pb-6 pr-12 text-[15px] leading-[1.65] text-neutral-600">
                          {item.a}
                        </p>
                      </motion.dd>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </dl>
        </div>
      </Shell>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Closing — the page's one filled burgundy surface, contained rather than
   full bleed so the accent stays an accent.
   ═══════════════════════════════════════════════════════════════════ */
const Closing = () => (
  <section className="px-4 py-16 md:px-8 md:py-24">
    <motion.div
      {...reveal()}
      className="mx-auto max-w-[1280px] bg-primary-500 px-6 py-16 text-center md:px-12 md:py-24"
    >
      <h2
        className="mx-auto max-w-[16ch] font-display text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.025em]"
        style={{ color: INK_TEXT }}
      >
        Start where the families you would actually meet are already looking.
      </h2>
      <p className="mx-auto mt-5 max-w-[44ch] text-[17px] leading-[1.6]" style={{ color: 'rgba(253,248,242,0.85)' }}>
        A free profile takes about two minutes. The rest can wait until Sunday.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/onboarding"
          className="tm-press inline-flex items-center gap-2 rounded-xl px-7 py-4 text-[15px] font-medium transition-colors duration-150"
          style={{ background: INK_TEXT, color: '#8B2346' }}
        >
          Create free profile
          <FiArrowRight aria-hidden="true" />
        </Link>
        <Link
          to="/login"
          className="tm-press inline-flex items-center gap-2 rounded-xl border px-7 py-4 text-[15px] font-medium transition-colors duration-150"
          style={{ borderColor: 'rgba(253,248,242,0.62)', color: INK_TEXT }}
        >
          I already have an account
        </Link>
      </div>
    </motion.div>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Footer.
   ═══════════════════════════════════════════════════════════════════ */
const FOOTER_COLUMNS = [
  {
    title: 'Platform',
    links: [
      ['Browse profiles', '/search'],
      ['How it works', '/#how'],
      ['Pricing', '/subscription'],
      ['Success stories', '/success-stories'],
      ['Create profile', '/onboarding'],
    ],
  },
  {
    title: 'Cities',
    links: [
      ['Matrimony in Chandigarh', '/matrimony/chandigarh'],
      ['Matrimony in Mohali', '/matrimony/mohali'],
      ['Matrimony in Panchkula', '/matrimony/panchkula'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About us', '/about'],
      ['Contact', '/contact'],
      ['Safety centre', '/safety'],
      ['Privacy policy', '/privacy'],
      ['Terms of service', '/terms'],
      ['Refunds', '/refund-policy'],
    ],
  },
];

const SiteFooter = () => {
  const socials = [
    { icon: FaInstagram, label: 'Instagram', href: 'https://www.instagram.com/tricitymatch' },
    { icon: FaFacebook, label: 'Facebook', href: 'https://www.facebook.com/tricitymatch' },
    /* WhatsApp renders only when a real number is configured. A placeholder
       number in the footer is worse than no number. */
    ...(support.whatsapp ? [{ icon: FaWhatsapp, label: 'WhatsApp', href: `https://wa.me/${support.whatsapp}` }] : []),
    { icon: FaTwitter, label: 'Twitter', href: 'https://twitter.com/tricitymatch' },
  ];

  const contactLinks = [
    [support.email, `mailto:${support.email}`, true],
    ...(support.phone ? [[support.phone, `tel:${support.phone}`, true]] : []),
    ...(support.address ? [[support.address, null, false]] : []),
    ['Help centre', '/help', false],
  ];

  return (
    <footer style={{ background: INK, color: INK_TEXT }}>
      <Shell className="pb-28 pt-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.1fr_1fr_1.2fr]">
          <div>
            <p className="font-display text-[26px] font-semibold leading-none tracking-[-0.02em]">TricityMatch</p>
            <p className="mt-4 max-w-[34ch] text-[14px] leading-[1.6]" style={{ color: INK_TEXT_SOFT }}>
              The Tricity's own matrimonial service. Verified profiles, local
              matches, and families brought in when you are ready.
            </p>
            <ul className="mt-6 flex gap-3">
              {socials.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="tm-social flex h-11 w-11 items-center justify-center rounded-lg border transition-colors duration-150"
                    style={{ borderColor: INK_LINE, color: INK_TEXT_SOFT }}
                  >
                    <Icon aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: GOLD_ON_INK }}>
                {col.title}
              </h2>
              <ul className="mt-3">
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="tm-footer-link flex min-h-[44px] items-center text-[14px] transition-colors duration-150"
                      style={{ color: INK_TEXT_SOFT }}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: GOLD_ON_INK }}>
              Contact
            </h2>
            <ul className="mt-3">
              {contactLinks.map(([label, href, external]) => (
                <li key={label}>
                  {href && external ? (
                    <a
                      href={href}
                      className="tm-footer-link flex min-h-[44px] items-center break-words text-[14px] transition-colors duration-150"
                      style={{ color: INK_TEXT_SOFT }}
                    >
                      {label}
                    </a>
                  ) : href ? (
                    <Link
                      to={href}
                      className="tm-footer-link flex min-h-[44px] items-center text-[14px] transition-colors duration-150"
                      style={{ color: INK_TEXT_SOFT }}
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="flex min-h-[44px] items-center text-[14px]" style={{ color: INK_TEXT_SOFT }}>
                      {label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-[13px]"
          style={{ borderColor: INK_LINE, color: INK_TEXT_SOFT }}
        >
          <span>&copy; {new Date().getFullYear()} TricityMatch. All rights reserved.</span>
          <span>Made in Chandigarh.</span>
          <span>
            Built by{' '}
            <a
              href="https://www.globoniks.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              style={{ color: INK_TEXT }}
            >
              Globoniks
            </a>
          </span>
        </div>
      </Shell>
    </footer>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Sticky mobile CTA — appears once the hero has left the viewport.
   IntersectionObserver, not a scroll listener.
   ═══════════════════════════════════════════════════════════════════ */
const StickyCTA = ({ heroRef }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = heroRef?.current;
    if (!hero) return undefined;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting));
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroRef]);

  return (
    <div className={`tm-sticky${show ? ' is-shown' : ''}`} aria-hidden={!show}>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold leading-tight">Free to join</p>
        <p className="truncate text-[12px] leading-tight" style={{ color: INK_TEXT_SOFT }}>
          About two minutes
        </p>
      </div>
      <Link
        to="/onboarding"
        tabIndex={show ? 0 : -1}
        className="tm-press inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-[14px] font-medium"
        style={{ background: INK_TEXT, color: '#8B2346' }}
      >
        Create profile
        <FiArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Page.
   ═══════════════════════════════════════════════════════════════════ */
const supportsScrollTimeline =
  typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: scroll()');

const Home = () => {
  const heroRef = useRef(null);
  const [stories, setStories] = useState([]);
  const [plan, setPlan] = useState(null);
  const [announcementOn, setAnnouncementOn] = useState(true);

  const founding = useFoundingWindow();
  const { scrollYProgress } = useScroll();
  const progressScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  /* Top of the funnel. Everything downstream is measured against this. */
  useEffect(() => { track(STAGES.LANDING); }, []);

  /* Published success stories. The section stays absent if there are none, and
     a failed request is indistinguishable from none on purpose: an error card
     where a testimonial should be is worse than no testimonial. */
  useEffect(() => {
    let active = true;
    api.get('/success-stories')
      .then((res) => {
        const list = res.data?.stories || [];
        if (!active || list.length === 0) return;
        setStories(list.map((s) => ({
          quote: s.quote,
          who: s.coupleNames,
          where: [s.location, s.marriedOn ? `Married ${new Date(s.marriedOn).getFullYear()}` : null]
            .filter(Boolean).join(' · '),
          /* No stock fallback: a real, named, consenting couple is never
             illustrated with a picture of somebody else. */
          img: s.photoUrl || null,
        })));
      })
      .catch(() => { /* section stays hidden */ });
    return () => { active = false; };
  }, []);

  /* The live price, from the endpoint that charges it. Fails closed to no
     figure rather than to a stale one. */
  useEffect(() => {
    let active = true;
    api.get('/subscription/plans')
      .then((res) => {
        if (!active) return;
        const plans = res.data?.plans || {};
        /* `price` is in rupees and `duration` is already a human label
           ("3 months"). Reading both off the response is the point: the admin
           pricing screen can change either without this page going stale. */
        const paid = Object.values(plans).find((p) => p && p.price > 0);
        if (!paid) return;
        setPlan({
          amountLabel: `₹${Number(paid.price).toLocaleString('en-IN')}`,
          durationLabel: paid.duration || null,
          mrpLabel: paid.mrp && paid.mrp > paid.price
            ? `₹${Number(paid.mrp).toLocaleString('en-IN')}`
            : null,
        });
      })
      .catch(() => { /* price stays hidden */ });
    return () => { active = false; };
  }, []);

  return (
    <div className="bg-neutral-50 text-neutral-900" style={{ overflowX: 'clip' }}>
      <Seo path="/" />
      <PageStyle />

      {supportsScrollTimeline
        ? <div className="tm-progress tm-progress-css" aria-hidden="true" />
        : <motion.div className="tm-progress" style={{ scaleX: progressScaleX }} aria-hidden="true" />}

      <Announcement
        founding={announcementOn ? founding : { ...founding, open: false }}
        onDismiss={() => setAnnouncementOn(false)}
      />

      <Hero heroRef={heroRef} />
      <ProofStrip />
      <Mechanisms />
      <HowItWorks />
      <Cities />
      <Membership founding={founding} plan={plan} />
      <Stories stories={stories} />
      <Faq />
      <Closing />
      <SiteFooter />

      <StickyCTA heroRef={heroRef} />
    </div>
  );
};

export default Home;
