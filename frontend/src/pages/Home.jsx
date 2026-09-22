/**
 * Home — the acquisition surface.
 *
 * Rebuilt 2026-09-22. The previous version was eleven sections each carrying a
 * different device (a fanned photo stack, a sparkle marquee, a horizontal
 * scroller, hover-to-expand city strips with rotated labels, giant serif
 * numerals in a progress ring, a mesh-gradient closing band, an oversized
 * footer wordmark) and every H2 built to the same "<statement>. <italic accent
 * word>." formula. Individually defensible, collectively the templated look —
 * and several of the devices are on the doctrine's own banned list (eyebrow
 * labels, section numbers, hover-only affordances, flat burgundy across a large
 * region, unicode glyphs standing in for icons).
 *
 * What replaced it: ONE section grammar, repeated. Heading, one lead line, the
 * content. Alternating cream / white / fixed-ink bands for rhythm instead of a
 * new trick per section. Burgundy appears as a filled surface exactly once, in
 * the closing panel, and is contained rather than full-bleed so it stays an
 * accent (doctrine §3.1). The Playfair italic accent line survives in the hero
 * headline and nowhere else — used once it is the brand's voice, used nine
 * times it was the tell.
 *
 * Built on Tailwind utilities rather than the previous inline-style + forked
 * CSS-variable block, so `index.css`'s dark-mode utility layer applies on its
 * own. The only fixed-palette surfaces are the ink bands, which set their
 * colours inline precisely so the dark-mode overrides do NOT invert them.
 *
 * Product truth preserved verbatim: founding window is server-gated and
 * fail-closed, the Premium price is read live rather than hardcoded, success
 * stories render only when real published ones exist, and the AI imagery
 * carries its disclosure (doctrine ruling 15).
 */
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  FiArrowRight, FiCheck, FiX, FiPlus, FiMinus, FiShield, FiMapPin,
  FiEyeOff, FiMessageCircle, FiUsers, FiSliders, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { FaInstagram, FaFacebook, FaTwitter, FaWhatsapp } from 'react-icons/fa';

import Seo from '../components/common/Seo';
import api from '../api/axios';
import { track, STAGES } from '../utils/analytics';
import useFoundingWindow from '../hooks/useFoundingWindow';
import { support } from '../config';
import { revealOnce, fadeRise, staggerIndex, EASE_OUT, DUR } from '../utils/animations';
import { EDITORIAL_IMAGES } from '../data/editorialImages';

/* The two fixed-palette surfaces. These are deliberately NOT Tailwind neutral
   utilities: `html.dark` inverts `bg-neutral-900` to near-white, which would
   flip these bands inside out. They are the same values the previous page used
   for its dark panels, so the rhythm is unchanged in both themes. */
const INK = '#241519';
const INK_TEXT = '#FDF8F2';
const INK_TEXT_SOFT = 'rgba(253,248,242,0.74)';
const INK_LINE = 'rgba(253,248,242,0.18)';
const GOLD_ON_INK = '#E8C34A'; /* gold-400 — the ~9:1-on-dark value index.css already uses */

const CITIES = [
  {
    name: 'Chandigarh',
    slug: 'chandigarh',
    line: "India's most planned city. Cosmopolitan, career-forward, deeply family-rooted.",
    image: EDITORIAL_IMAGES.cities.chandigarh,
  },
  {
    name: 'Mohali',
    slug: 'mohali',
    line: 'Tech parks, AIIMS, IIT. Young professionals building careers without leaving home.',
    image: EDITORIAL_IMAGES.cities.mohali,
  },
  {
    name: 'Panchkula',
    slug: 'panchkula',
    line: 'Quiet, established, close-knit. Tradition and aspiration in equal measure.',
    image: EDITORIAL_IMAGES.cities.panchkula,
  },
];

/* Six differentiators. Previously rendered as an eyebrow-labelled horizontal
   scroller that faded its own text out; now a plain hairline grid, because the
   content is a list and a list is what it should look like. Glyphs were
   `◉ ◇ ▣ ◐ ▲ ✦` — unicode standing in for an icon system, which both the
   craft floor and doctrine §8 ban. One family, one stroke: react-icons/fi. */
const PILLARS = [
  {
    icon: FiShield,
    title: 'Photo-verified profiles',
    body: 'The verified badge is earned with a live selfie, captured in the moment and matched by a person. No file uploads, no shortcuts.',
  },
  {
    icon: FiSliders,
    title: 'Matched on 40+ signals',
    body: 'Values, lifestyle, community and family expectations, not just age and location.',
  },
  {
    icon: FiMapPin,
    title: 'Built only for the Tricity',
    body: 'Chandigarh, Mohali and Panchkula. Every match is close enough for both families to actually meet.',
  },
  {
    icon: FiEyeOff,
    title: 'Incognito browsing',
    body: 'Look around privately. You appear only to the people you have expressed interest in.',
  },
  {
    icon: FiMessageCircle,
    title: 'Free members can reply',
    body: 'Messages are free to read, always. When a premium match writes first, you get five replies over the next 48 hours without paying.',
  },
  {
    icon: FiUsers,
    title: 'Family-aware, not family-run',
    body: 'Bring parents in when you choose. They get their own view and their own chat, kept separate from yours.',
  },
];

/* A real four-step sequence, so the numerals carry information and are allowed
   (doctrine §8 bans section numbers "unless the sequence itself carries
   information the reader needs"). They are 12px labels here, not the previous
   72px serif numeral inside an animated ring. */
const STEPS = [
  { n: '01', t: 'Create your profile', b: 'Two screens and about two minutes to join. Fill in the rest whenever you like.' },
  { n: '02', t: 'Earn your badge', b: 'Take a live selfie. A person on our team matches it to your photos, usually within hours.' },
  { n: '03', t: 'Meet your matches', b: 'Compatible profiles, ranked daily. You control who can see you throughout.' },
  { n: '04', t: 'Talk, then meet', b: 'Conversations stay encrypted in transit and your number is never revealed. Bring family in when it is time.' },
];

const FAQS = [
  {
    q: 'Do you only accept Tricity residents?',
    a: 'Yes. Every profile is from Chandigarh, Mohali or Panchkula, or has direct family ties to the region. Hyperlocal is the point.',
  },
  {
    q: 'How does verification work?',
    a: 'Members take a live selfie, captured in the moment and never uploaded from a file, and our team matches it against their profile photos. The verified badge appears once it is approved.',
  },
  {
    q: 'Can I look around without an account?',
    a: 'Search and full profiles need a free account. Creating one takes about two minutes and you can start browsing straight away.',
  },
  {
    q: 'I live abroad. Can NRIs join?',
    a: 'Yes, if you are from the Tricity or your family is. Where you live now does not matter; the roots do. Mark yourself as an NRI during sign-up and add your country, and families looking for an NRI alliance will find you. A parent or sibling here can search alongside you through Guardian access.',
  },
  {
    q: 'What does Premium include?',
    a: 'One plan, nothing to compare: unlimited contact unlocks, unlimited messaging, advanced filters, Incognito mode, a profile boost and a spotlight listing, for the full term. Browsing, matching and your profile stay free.',
  },
  {
    q: 'Is my data private?',
    a: 'Conversations are encrypted in transit and readable only by you and your match. We never share your phone number, never sell data, and never show you to someone you have not matched with.',
  },
  {
    q: 'Can families take part?',
    a: 'Yes, and on your terms. You decide when to invite them. They get a separate view and a separate chat channel, kept respectfully apart from your own conversations.',
  },
];

/* Mad-libs option sets. Ages are the ones our own onboarding accepts. */
const LOOKING_FOR = [
  { value: 'bride', label: 'bride' },
  { value: 'groom', label: 'groom' },
];
const AGES = Array.from({ length: 33 }, (_, i) => 21 + i); // 21..53

/* ═══════════════════════════════════════════════════════════════════
   Scoped CSS — only what utilities cannot express.
   ═══════════════════════════════════════════════════════════════════ */
const PageStyle = () => (
  <style>{`
    /* Scroll progress. CSS scroll-timeline where the browser has it (runs off
       the main thread); the framer-motion fallback is mounted instead. */
    .tm-progress {
      position: fixed; top: 0; left: 0; right: 0; height: 2px;
      transform-origin: 0 50%; z-index: 60;
      background: linear-gradient(90deg, #8B2346, #C9A227);
    }
    @supports (animation-timeline: scroll()) {
      .tm-progress-css {
        animation: tm-progress-grow linear both;
        animation-timeline: scroll();
      }
    }
    @keyframes tm-progress-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

    /* The mad-libs selects read as inline words in a sentence, so they carry an
       underline rather than a box. 16px floor: iOS Safari force-zooms a focused
       input below it and the hero layout breaks (doctrine §3.2). */
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
    .tm-inline-select:focus-visible {
      outline: 2px solid #8B2346; outline-offset: 3px;
    }
    /* index.css gives every select under html.dark a filled box with its own
       border and colour, with !important and higher specificity than a class.
       These selects are words in a sentence, not form boxes, so they have to
       win that fight explicitly. */
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
       matching leave, which leaves a control stuck in its hover look. */
    @media (hover: hover) and (pointer: fine) {
      .tm-inline-select:hover { background-color: rgba(139,35,70,0.06); }
      .tm-city:hover .tm-city-img { transform: scale(1.03); }
      .tm-footer-link:hover { color: #E8C34A; }
      .tm-social:hover { background: #8B2346; border-color: #8B2346; color: #FDF8F2; }
    }
    .tm-city-img { transition: transform 240ms cubic-bezier(0.23,1,0.32,1); }

    /* Mobile sticky CTA. Enters and leaves along the same edge. */
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

    /* Elder mode raises every target to 48px. These four are the controls that
       sit at or below the 44px floor at default scale. */
    html.elder .tm-faq-toggle { width: 48px; height: 48px; }
    html.elder .tm-announce-dismiss { padding: 16px; }
    html.elder .tm-story-nav { width: 48px; height: 48px; }
    html.elder .tm-social { width: 48px; height: 48px; }

    /* Reduced motion: fewer and gentler, not zero (doctrine §4.6). Opacity and
       colour survive so the interface still shows it heard you; translation,
       scale and the scroll progress bar do not. */
    @media (prefers-reduced-motion: reduce) {
      .tm-progress, .tm-progress-css { display: none; }
      .tm-city-img { transition: none; }
      .tm-sticky { transform: none; transition: opacity 150ms ease; }
    }
  `}</style>
);

/* ═══════════════════════════════════════════════════════════════════
   Shared section furniture — the single grammar every section uses.
   ═══════════════════════════════════════════════════════════════════ */
const Shell = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-[1200px] px-4 md:px-8 ${className}`}>{children}</div>
);

/* Scroll reveals.
 *
 * Two things this has to get right. First, `revealOnce` carries its transition
 * inside the `whileInView` target, so a sibling `transition` prop is silently
 * ignored: a staggered reveal has to rebuild the target rather than layer a
 * prop on top of it. Second, doctrine §4.6 asks that reduced motion put scroll
 * reveals at their settled state IMMEDIATELY rather than fading them in more
 * gently. `MotionConfig reducedMotion="user"` at the App root drops the
 * translation but keeps the opacity animation, which still leaves content
 * invisible until it is scrolled past, so the props are dropped outright here.
 *
 * Read once at module scope, like the scroll-timeline probe below it: the
 * preference does not change mid-session in practice, and reading it per
 * component would put a hook in eight places to no visible end. */
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

const SectionHead = ({ title, lead, onInk = false, align = 'left', className = '' }) => (
  <motion.div
    {...reveal()}
    className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-[46ch] ${className}`}
  >
    <h2
      className="font-display text-[clamp(1.75rem,3.4vw,2.25rem)] font-semibold leading-[1.2] tracking-[-0.02em]"
      style={onInk ? { color: INK_TEXT } : undefined}
    >
      {title}
    </h2>
    {lead && (
      <p
        className={`mt-4 text-[16px] leading-[1.65] ${onInk ? '' : 'text-neutral-600'}`}
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
        <div className="relative mx-auto flex max-w-[1200px] items-center justify-center gap-3 px-10 py-2.5 text-[13px] leading-[1.5]">
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

   Every competitor in this market opens with a product action, not a signup
   ask; ours opens with "Create free profile". This composes one English
   sentence out of three controls and hands the answer to the funnel. The
   subline states plainly that a free account comes first, because a control
   that says "find matches" and silently lands on a signup wall is the trade
   this product cannot afford to make.
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
     silently clamping is kinder than telling someone they chose wrong. */
  const onMinChange = (value) => {
    setAgeMin(value);
    if (value > ageMax) setAgeMax(value);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-5 rounded-2xl bg-white p-4 shadow-card md:mt-8 md:p-6"
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
        <button type="submit" className="btn-primary inline-flex items-center gap-2">
          Show me matches
          <FiArrowRight aria-hidden="true" />
        </button>
        <p className="text-[13px] text-neutral-500">
          Free account first. About two minutes.
        </p>
      </div>
    </form>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Hero — split composition, one photograph, one italic accent line.
   ═══════════════════════════════════════════════════════════════════ */
const Hero = ({ heroRef }) => {
  const photo = EDITORIAL_IMAGES.heroStack.front;

  return (
    <section ref={heroRef} className="relative overflow-hidden pb-16 pt-6 md:pb-24 md:pt-16">
      <Shell>
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          {/* Text column. On mobile the headline and lead come first, then the
              photograph, then the finder: the face still lands inside the first
              screen, which the previous all-text mobile fold never managed. */}
          <motion.div
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }}
            className="order-1"
          >
            <motion.h1
              variants={fadeRise}
              className="font-display text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.05] tracking-[-0.025em] text-neutral-900"
            >
              From match<br />
              to mandap,<br />
              <em className="italic text-primary-500">all in the Tricity.</em>
            </motion.h1>

            <motion.p
              variants={fadeRise}
              className="mt-5 max-w-[44ch] text-[17px] leading-[1.65] text-neutral-600 md:mt-6"
              style={{ textWrap: 'pretty' }}
            >
              Chandigarh, Mohali and Panchkula only. Every member is checked by a
              person, and every match is close enough for both families to meet
              this week.
            </motion.p>

            {/* The photograph, on mobile only, sits here so it is above the fold
                at 375px. On desktop the right column carries it instead. */}
            <motion.figure variants={fadeRise} className="mt-6 lg:hidden">
              <img
                src={photo.src}
                alt={photo.alt}
                width="800"
                height="550"
                loading="eager"
                className="aspect-[16/9] w-full rounded-2xl object-cover object-top"
              />
              {photo.aiGenerated && (
                <figcaption className="mt-2 text-[12px] leading-[1.5] text-neutral-500">
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

          {/* Photo column, desktop only. One image, held still. The previous
              three-card fan clipped its own captions at 1440 and stacked three
              disclosure chips on top of each other. */}
          <motion.figure
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.08 }}
            className="order-2 hidden lg:block"
          >
            <img
              src={photo.src}
              alt={photo.alt}
              width="900"
              height="1100"
              loading="eager"
              className="aspect-[4/5] w-full rounded-2xl object-cover object-top shadow-card"
            />
            {photo.aiGenerated && (
              <figcaption className="mt-3 text-[12px] leading-[1.5] text-neutral-500">
                Illustrative photography, AI-generated. Not a member.
              </figcaption>
            )}
          </motion.figure>
        </div>
      </Shell>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Proof band — process claims, because we do not have size claims.

   Everyone in this category pairs a trust claim with a number and we publish
   none, deliberately. These four are the numbers we do have: they describe
   process, and every one of them is true today in production.
   ═══════════════════════════════════════════════════════════════════ */
const PROOF = [
  ['Checked by a person', 'Every selfie is reviewed by our team, not a model'],
  ['Verified in hours', 'Not days, and never a file upload'],
  ['Free to read and reply', 'Five replies over 48 hours when a match writes first'],
  ['Seven-day refund', 'Ask within a week of paying, no justification needed'],
];

const ProofBand = () => (
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
   Pillars — hairline grid, no cards. Cards are the lazy container and six
   identical icon+heading+body boxes are the page structure the craft floor
   refuses outright.
   ═══════════════════════════════════════════════════════════════════ */
const Pillars = () => (
  <section id="why" className="scroll-mt-24 bg-white py-16 md:py-24">
    <Shell>
      <SectionHead
        title="What makes this different"
        lead="Six decisions that shape the product, not six adjectives."
      />
      <div className="mt-12 grid border-t border-neutral-200 md:grid-cols-2">
        {PILLARS.map(({ icon: Icon, title, body }, i) => (
          <motion.div
            key={title}
            {...reveal(i)}
            className="border-b border-neutral-200 py-7 md:odd:pr-10 md:even:border-l md:even:pl-10"
          >
            <Icon className="h-5 w-5 text-primary-500" aria-hidden="true" />
            <h3 className="mt-4 font-sans text-[18px] font-semibold leading-[1.4] tracking-normal text-neutral-900">
              {title}
            </h3>
            <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.6] text-neutral-600">{body}</p>
          </motion.div>
        ))}
      </div>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   How it works — four steps, read in one pass, no interaction required.
   ═══════════════════════════════════════════════════════════════════ */
const HowItWorks = () => (
  <section id="how" className="scroll-mt-24 py-16 md:py-24">
    <Shell>
      <SectionHead
        title="How it works"
        lead="Four steps. The first one is the only one that takes any effort."
      />
      <ol className="mt-12 grid gap-y-8 border-t border-neutral-200 md:grid-cols-4 md:gap-x-8">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            {...reveal(i)}
            className="pt-6 md:border-l md:border-neutral-200 md:pl-5 md:first:border-l-0 md:first:pl-0"
          >
            <span className="text-[12px] font-semibold tabular-nums tracking-[0.06em] text-primary-500">
              {s.n}
            </span>
            <h3 className="mt-3 font-sans text-[17px] font-semibold leading-[1.4] tracking-normal text-neutral-900">
              {s.t}
            </h3>
            <p className="mt-2 text-[15px] leading-[1.6] text-neutral-600">{s.b}</p>
          </motion.li>
        ))}
      </ol>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Cities — three links, always visible. The previous version hid two thirds
   of this content behind hover, with the labels rotated 90 degrees, on a site
   where half the traffic is touch.
   ═══════════════════════════════════════════════════════════════════ */
const Cities = () => (
  <section className="bg-white py-16 md:py-24">
    <Shell>
      <SectionHead
        title="Three cities, one community"
        lead="Shared roots, the same circles, and a match you can actually go and meet."
      />
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {CITIES.map((c, i) => (
          <motion.div
            key={c.slug}
            {...reveal(i)}
          >
            <Link to={`/matrimony/${c.slug}`} className="tm-city group block rounded-2xl">
              <figure className="overflow-hidden rounded-2xl">
                <img
                  src={c.image.src}
                  alt={c.image.alt}
                  width="600"
                  height="450"
                  loading="lazy"
                  className="tm-city-img aspect-[4/3] w-full object-cover"
                />
              </figure>
              <h3 className="mt-4 font-display text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-neutral-900">
                {c.name}
              </h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-neutral-600">{c.line}</p>
              <span className="mt-3 inline-flex items-center gap-2 text-[14px] font-medium text-primary-500 underline-offset-4 group-hover:underline">
                Browse {c.name}
                <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
      {CITIES[0].image.aiGenerated && (
        <p className="mt-6 text-[12px] leading-[1.5] text-neutral-500">
          City photography is illustrative and AI-generated.
        </p>
      )}
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Membership — the founding grant and the one plan, side by side.

   The price is read live from the same endpoint that charges it. The previous
   page carried no price at all, and hardcoding one here would have gone stale
   the first time somebody edited the offer in the admin pricing screen — which
   has already happened once in production.
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
                  ? `Build a profile, earn your badge and start matching at no cost${
                      founding.grantDays ? ` for ${founding.grantDays} days` : ''
                    }${
                      founding.contactUnlocks != null
                        ? `, including ${founding.contactUnlocks} contact unlock${founding.contactUnlocks === 1 ? '' : 's'}`
                        : ''
                    }.${endsLabel ? ` Open until ${endsLabel}.` : ''}`
                  : 'Building a profile, browsing and matching cost nothing. Premium only buys the contact details and the unlimited messaging.'
              }
            />
            <motion.ul {...reveal()} className="mt-8 space-y-3 text-[15px] leading-[1.5]">
              {[
                'Your profile, your photos and your verified badge',
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
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium transition-colors duration-150"
                style={{ background: INK_TEXT, color: '#8B2346' }}
              >
                {founding.open ? 'Become a founding member' : 'Create your free profile'}
                <FiArrowRight aria-hidden="true" />
              </Link>
            </motion.div>
          </div>

          <motion.div
            {...reveal()}
            className="rounded-2xl p-7 md:p-8"
            style={{ background: 'rgba(253,248,242,0.06)' }}
          >
            <h3 className="font-sans text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: GOLD_ON_INK }}>
              Premium
            </h3>
            {plan?.amountLabel ? (
              <>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-[40px] font-semibold leading-none tabular-nums">
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
   loop, and it moves content the reader is in the middle of reading. The rail
   under the controls reports position honestly at any story count.
   ═══════════════════════════════════════════════════════════════════ */
const Stories = ({ stories }) => {
  const [idx, setIdx] = useState(0);
  if (stories.length === 0) return null;

  const story = stories[idx];
  const go = (delta) => setIdx((i) => (i + delta + stories.length) % stories.length);

  return (
    <section id="stories" className="scroll-mt-24 py-16 md:py-24">
      <Shell>
        {/* Same two-column grammar the FAQ uses: heading left, content right.
            Stories arrive from the API with or without a photograph, and a
            layout that only composes when a photo happens to exist leaves half
            the section empty the rest of the time. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
          <SectionHead
            title="Stories that began here"
            lead="Real couples, in their own words, published with their permission."
          />

          <motion.div {...reveal()} className="flex flex-col justify-center">
            {story.img && (
              <figure className="mb-8 overflow-hidden rounded-2xl">
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
            <blockquote className="font-display text-[clamp(1.35rem,2.6vw,1.9rem)] font-medium leading-[1.35] tracking-[-0.01em] text-neutral-900">
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
                    className="tm-story-nav flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-colors duration-150 hover:border-neutral-300"
                  >
                    <FiChevronLeft aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Next story"
                    className="tm-story-nav flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-colors duration-150 hover:border-neutral-300"
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
    <section className="bg-white py-16 md:py-24">
      <Shell>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
          <div>
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

          <dl className="border-t border-neutral-200">
            {FAQS.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} className="border-b border-neutral-200">
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
                      <span className="tm-faq-toggle flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-700">
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
   full-bleed so the accent stays an accent (doctrine §3.1).
   ═══════════════════════════════════════════════════════════════════ */
const Closing = () => (
  <section className="px-4 pb-16 pt-4 md:px-8 md:pb-24">
    <motion.div
      {...reveal()}
      className="mx-auto max-w-[1200px] rounded-2xl bg-primary-500 px-6 py-14 text-center md:px-12 md:py-20"
    >
      <h2
        className="mx-auto max-w-[18ch] font-display text-[clamp(1.75rem,3.6vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.02em]"
        style={{ color: INK_TEXT }}
      >
        Start where the families you would actually meet are already looking.
      </h2>
      <p className="mx-auto mt-5 max-w-[46ch] text-[16px] leading-[1.6]" style={{ color: 'rgba(253,248,242,0.82)' }}>
        A free profile takes about two minutes, and you can fill in the rest later.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium transition-colors duration-150"
          style={{ background: INK_TEXT, color: '#8B2346' }}
        >
          Create free profile
          <FiArrowRight aria-hidden="true" />
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-[15px] font-medium transition-colors duration-150"
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
              <h2 className="font-sans text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: GOLD_ON_INK }}>
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
            <h2 className="font-sans text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: GOLD_ON_INK }}>
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
          <span>© {new Date().getFullYear()} TricityMatch. All rights reserved.</span>
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
        className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-[14px] font-medium"
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
           pricing screen can change either one without this page going stale. */
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
      <ProofBand />
      <Pillars />
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
