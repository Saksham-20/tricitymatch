/**
 * Home — the acquisition surface.
 *
 * Composition: "split spine". One vertical hairline runs down the page at the
 * same position in every light section, labels and running meta sit to its
 * left, content sits to its right, and a few elements deliberately cross it.
 * The cities break it on purpose, which is what makes it read as a decision
 * rather than a margin. It replaces the shape this page carried through three
 * earlier versions: a heading in four columns beside a body in eight, stacked
 * as ten identical bands. Ornament on an unchanged skeleton is reskinning, and
 * that is what "the same layout again" meant.
 *
 * Two product corrections from the owner, 2026-09-22, both load-bearing:
 *
 * 1. NO COMMUNITY IS THE DEFAULT. An earlier draft put a working Vedic
 *    Ashtakoot calculator at the centre of the page. The product serves Hindu,
 *    Sikh, Muslim, Christian, Jain and Buddhist families, and a guna table as
 *    the front door tells most of them this was not built for them. Horoscope
 *    matching is still in the product and still named here, as one signal among
 *    the forty-plus, for the families who want it. Nothing on this page now
 *    presumes a community. The front door is a plain call to action, not a
 *    pre-auth filter that asks a stranger four questions before they know what
 *    this is (owner, same day: "keep it simple").
 * 2. NO PROMOTIONS. The founding grant is live in production and new members
 *    still receive it; this page no longer advertises it. The only commercial
 *    figure is the launch price, read live from the endpoint that charges it,
 *    with no strike-through anchor beside it.
 *
 * Doctrine confirmed binding the same day: no pinning, no scroll-hijack, no
 * scrubbed scroll, no idle loops, no GSAP, no hover-only affordance. The motion
 * is a load wipe, entrances that differ per block, and press feedback.
 */
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useInView, animate } from 'framer-motion';
import {
  FiArrowRight, FiCheck, FiPlus, FiMinus, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { FaInstagram, FaFacebook, FaTwitter, FaWhatsapp } from 'react-icons/fa';

import Seo from '../components/common/Seo';
import api from '../api/axios';
import { track, STAGES } from '../utils/analytics';
import { support } from '../config';
import { revealOnce, fadeRise, staggerIndex, EASE_OUT, DUR } from '../utils/animations';
import { EDITORIAL_IMAGES } from '../data/editorialImages';

/* Fixed-palette ink surfaces. Deliberately not Tailwind neutral utilities:
   `html.dark` inverts `bg-neutral-900` to near-white, which would turn these
   inside out. `bg-concrete` and `bg-white` are theme-reactive tokens. */
const INK = '#241519';
const INK_TEXT = '#FDF8F2';
const INK_TEXT_SOFT = 'rgba(253,248,242,0.74)';
const INK_LINE = 'rgba(253,248,242,0.18)';
const GOLD_ON_INK = '#E8C34A';

/* Unequal spans and unequal crops. Three equal thirds is the shape the eye
   reads as a template. */
const CITIES = [
  {
    name: 'Chandigarh', slug: 'chandigarh', span: 'lg:col-span-5', ratio: 'aspect-[4/5]', offset: '',
    line: 'Sectors, roundabouts, and a coffee at 17 that turns into three hours.',
    image: EDITORIAL_IMAGES.cities.chandigarh,
  },
  {
    /* Dropped below the other two on desktop, on purpose: three photographs of
       equal height in a row is the "three-card feature row" the craft floor
       bans, and it was the one shape this composition hadn't broken yet. */
    name: 'Mohali', slug: 'mohali', span: 'lg:col-span-4', ratio: 'aspect-square', offset: 'lg:mt-14',
    line: 'IT parks, coworking towers, and half your school two phases away.',
    image: EDITORIAL_IMAGES.cities.mohali,
  },
  {
    name: 'Panchkula', slug: 'panchkula', span: 'lg:col-span-3', ratio: 'aspect-[3/4]', offset: 'lg:mt-6',
    line: 'Hills at the end of the road. Families three generations deep.',
    image: EDITORIAL_IMAGES.cities.panchkula,
  },
];

/* What the ranking actually weighs, by category. Named rather than weighted:
   the weights are real but they are tuning values that move, and publishing a
   number we then change is the kind of small dishonesty this page exists to
   avoid. Horoscope matching sits in the list, not above it. */
const SIGNALS = [
  { t: 'Who they are', d: 'Age, city and sector, height, marital status' },
  { t: 'What they do', d: 'Education, profession, income band, where they studied' },
  { t: 'Where they come from', d: 'Religion, community, gotra, mother tongue, NRI roots' },
  { t: 'How they live', d: 'Diet, smoking, drinking, interests you both listed' },
  { t: 'What the family weighs', d: 'Family type, values, what your parents said matters' },
  {
    t: 'Horoscope, if you want it',
    d: 'Ashtakoot guna matching, Manglik and rashi, computed in full',
    /* Set apart, not centred: this is the one signal that is not asked of
       everyone by default (owner, 2026-09-22 — "keep it general"), so it gets
       a different shape on the page as well as a different sentence. */
    aside: true,
  },
];

const STEPS = [
  { n: '01', t: 'Make a profile', b: 'Two screens, about two minutes. Fill in the rest whenever you feel like it.' },
  {
    n: '02', t: 'Earn the badge', b: 'One live selfie, captured in the app.',
    rules: [
      'There is no upload button, because a file can be anybody.',
      'A person on our team compares it to your photos. Not a model.',
      'It cannot be bought, and it is the only badge we have.',
    ],
  },
  { n: '03', t: 'See who fits', b: 'Ranked matches, refreshed daily. You control who can see you throughout.' },
  { n: '04', t: 'Talk, then meet', b: 'Encrypted in transit, your number stays yours, family joins when you say so.' },
];

const PROOF = [
  ['Checked by a person', 'Every selfie, by our team'],
  ['Verified in hours', 'Never from a file you upload'],
  ['Free to read and reply', 'Five replies, 48 hours, no charge'],
  ['Seven-day refund', 'No justification needed'],
];

const FAQS = [
  { q: 'Do you only accept Tricity residents?', a: 'Yes. Every profile is from Chandigarh, Mohali or Panchkula, or has direct family ties here. Hyperlocal is the whole point, not a filter.' },
  { q: 'Is this only for one community?', a: 'No. Hindu, Sikh, Muslim, Christian, Jain and Buddhist families all use it, and community is something you filter on, never something we assume. Horoscope matching is there for the families who want it and invisible to the ones who do not.' },
  { q: 'How does verification work?', a: 'You take a live selfie in the app, captured in the moment and never uploaded from a file, and someone on our team compares it to your profile photos. The badge appears once it is approved.' },
  { q: 'Can I look around without an account?', a: 'Search and full profiles need a free account. Making one takes about two minutes and you can start browsing straight away.' },
  { q: 'I live abroad. Can NRIs join?', a: 'Yes, if you are from the Tricity or your family is. Where you live now does not matter; the roots do. Mark yourself as an NRI at sign-up and add your country, and families looking for an NRI alliance will find you. A parent or sibling here can search alongside you through Guardian access.' },
  { q: 'What does Premium unlock?', a: 'Unlimited contact unlocks, unlimited messaging, advanced filters, Incognito mode, a profile boost and a spotlight listing, for the full term. Browsing, matching, your profile and reading every message you receive stay free.' },
  { q: 'Is my data private?', a: 'Conversations are encrypted in transit and readable only by you and your match. We never share your phone number, never sell data, and never show you to someone you have not matched with.' },
  { q: 'Do my parents have to be involved?', a: 'Only when you want them to be. Guardian access is opt-in, it gives them their own view and their own chat channel, and it never shows them your conversations.' },
];

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* `revealOnce` carries its transition inside the `whileInView` target, so a
   sibling `transition` prop is silently ignored: a staggered reveal has to
   rebuild the target. Doctrine 4.6 wants reduced motion to settle reveals
   immediately, and `MotionConfig reducedMotion="user"` only drops the
   translation, so the props come off entirely. */
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

/* A second entrance so not every block arrives the same way. */
const wipeUp = prefersReducedMotion ? {} : {
  initial: { clipPath: 'inset(14% 0 0 0)', opacity: 0 },
  whileInView: { clipPath: 'inset(0% 0 0 0)', opacity: 1, transition: { duration: 0.6, ease: EASE_OUT } },
  viewport: { once: true, amount: 0.25, margin: '-80px' },
};

/* ═══════════════════════════════════════════════════════════════════
   Scoped CSS.
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

    /* The load moment. Headline lines wipe up from their own baseline, the
       photograph wipes down, and the spine draws itself downward, all on
       clip-path or a single transform. Once, under 900ms. */
    /* The clip must never extend past the line box: a negative bottom inset
       uncovers the top of the FOLLOWING line, which reads as a glitch. The
       descender room comes from padding the box and pulling the margin back,
       so the line's own comma and 'p' stay inside the clip. */
    @keyframes tm-line-in {
      from { clip-path: inset(0 0 100% 0); transform: translateY(0.12em); }
      to   { clip-path: inset(0 0 0 0); transform: translateY(0); }
    }
    @keyframes tm-photo-in { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0 0); } }
    @keyframes tm-spine-in { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    .tm-line {
      display: block; padding-bottom: 0.14em; margin-bottom: -0.14em;
      animation: tm-line-in 700ms cubic-bezier(0.23,1,0.32,1) both;
    }
    .tm-line:nth-child(2) { animation-delay: 80ms; }
    .tm-line:nth-child(3) { animation-delay: 160ms; }
    .tm-photo { animation: tm-photo-in 820ms cubic-bezier(0.23,1,0.32,1) 120ms both; }
    .tm-spine-draw { transform-origin: top center; animation: tm-spine-in 760ms cubic-bezier(0.23,1,0.32,1) 200ms both; }

    /* Hover is pointer-gated: a tap fires a synthetic mouseenter with no
       matching leave, which strands a control in its hover state. */
    @media (hover: hover) and (pointer: fine) {
      .tm-city:hover .tm-city-img { transform: scale(1.04); }
      .tm-footer-link:hover { color: #E8C34A; }
      .tm-social:hover { background: #8B2346; border-color: #8B2346; color: #FDF8F2; }
    }
    .tm-city-img { transition: transform 500ms cubic-bezier(0.23,1,0.32,1); }
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

    html.elder .tm-faq-toggle { width: 48px; height: 48px; }
    html.elder .tm-story-nav { width: 48px; height: 48px; }
    html.elder .tm-social { width: 48px; height: 48px; }

    /* Reduced motion: fewer and gentler, not zero. Colour and opacity survive
       so the interface still shows it heard you. */
    @media (prefers-reduced-motion: reduce) {
      .tm-progress, .tm-progress-css { display: none; }
      .tm-line, .tm-photo, .tm-spine-draw { animation: none; clip-path: none; transform: none; }
      .tm-city-img, .tm-press { transition: none; }
      .tm-sticky { transform: none; transition: opacity 150ms ease; }
    }
  `}</style>
);

/* ═══════════════════════════════════════════════════════════════════
   The spine.

   `Spine` is the page's one layout primitive. The hairline lives on the
   content column and the vertical padding lives on the columns rather than on
   the section, so consecutive sections' hairlines meet and the spine reads as
   one continuous line down the page rather than as a repeated border.
   ═══════════════════════════════════════════════════════════════════ */
const Shell = ({ children, className = '' }) => (
  <div className={`relative mx-auto w-full max-w-[1280px] px-4 md:px-8 ${className}`}>{children}</div>
);

/**
 * Vertical rhythm, in two literal class strings per rhythm.
 *
 * On mobile the padding lives on the wrapper, because the rail and the content
 * are one stacked column and paying it twice leaves a dead screen between every
 * section. From `lg` up it moves inside the two columns so the hairline runs
 * through the padding, which is what lets consecutive sections' spines meet and
 * read as one line down the page.
 *
 * Both strings are spelled out rather than composed, because Tailwind scans
 * source text: a class assembled at runtime is never generated.
 */
const RHYTHM = {
  default:  { sm: 'py-16 md:py-24',                    lg: 'lg:py-24' }                   ,
  masthead: { sm: 'pt-10 pb-14 md:pt-14 md:pb-20',     lg: 'lg:pt-14 lg:pb-20' },
  tight:    { sm: 'py-16 md:py-20',                    lg: 'lg:py-20' },
};

/**
 * `railOnMobile={false}` drops the rail below `lg`. The masthead uses it: its
 * rail is two stacked blocks, and above the headline on a phone that is a
 * screen of metadata before the visitor learns what this is.
 */
const Spine = ({
  rail, children, rhythm = 'default', drawn = false,
  railOnMobile = true, className = '',
}) => {
  const r = RHYTHM[rhythm];
  return (
    <div className={`grid ${r.sm} lg:grid-cols-[22%_1fr] lg:py-0 ${className}`}>
      <div className={`${railOnMobile ? 'mb-8 lg:mb-0' : 'hidden lg:block'} ${r.lg} lg:pr-8 lg:text-right`}>
        {rail}
      </div>
      <div
        className={`border-neutral-300/70 dark:border-neutral-700 ${r.lg} lg:border-l lg:pl-10 ${drawn ? 'tm-spine-draw' : ''}`}
      >
        {children}
      </div>
    </div>
  );
};

/* Rail furniture: a label, and the small facts that hang under it. */
const RailLabel = ({ children, onInk = false }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={onInk ? { color: GOLD_ON_INK } : undefined}>
    <span className={onInk ? '' : 'text-primary-500'}>{children}</span>
  </p>
);

const RailNote = ({ children, className = '' }) => (
  <p className={`mt-2 text-[13px] leading-[1.6] text-neutral-500 ${className}`}>{children}</p>
);

/**
 * Every landing photograph is real and licensed, not a member and not
 * AI-generated (swapped 2026-09-22 — see `data/editorialImages.js` for the
 * sourcing note). `variant="overlay"` sits on the photograph itself, in a
 * dark scrim, matching how the city cards' own captions sit on their photos.
 * `variant="plain"` sits on the page background below an image.
 */
const PhotoCredit = ({ photo, variant = 'plain', className = '' }) => {
  const linkClass = variant === 'overlay'
    ? 'underline decoration-white/50 underline-offset-2 hover:decoration-white'
    : 'underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-700 dark:hover:decoration-neutral-300';
  return (
    <p
      className={`text-[11px] leading-[1.5] ${variant === 'overlay' ? 'text-white/85' : 'text-neutral-500'} ${className}`}
    >
      Photo:{' '}
      <a href={photo.creditUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {photo.credit}
      </a>
      {' '}&middot; {photo.license}. Not a member.
    </p>
  );
};

/**
 * The one animated number on the page. It counts up from zero to the real,
 * live-read launch price exactly once, the first time it scrolls into view —
 * a genuine value changing state, not an idle loop the doctrine would ban.
 * Reduced motion sets the final figure immediately.
 */
const CountUpRupee = ({ amount }) => {
  const nodeRef = useRef(null);
  const inView = useInView(nodeRef, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(prefersReducedMotion ? amount : 0);

  useEffect(() => {
    if (!inView || prefersReducedMotion) return undefined;
    const controls = animate(0, amount, {
      duration: 1.1,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, amount]);

  return <span ref={nodeRef}>&#8377;{display.toLocaleString('en-IN')}</span>;
};

/* ═══════════════════════════════════════════════════════════════════
   Masthead.
   ═══════════════════════════════════════════════════════════════════ */
const Masthead = ({ heroRef }) => {
  const photo = EDITORIAL_IMAGES.heroCouple;

  return (
    <section ref={heroRef} className="relative overflow-hidden">
      {/* Runs to the viewport edge. Square corners, full bleed. The source is
          landscape (a real couple at dusk, credited below) — object-position
          keeps them centred rather than the sky-heavy top third a portrait
          crop usually favours. */}
      <figure className="tm-photo absolute right-0 top-0 hidden h-full w-[30vw] max-w-[460px] lg:block">
        <img src={photo.src} alt={photo.alt} width="1200" height="1867" loading="eager" className="h-full w-full object-cover object-[50%_38%]" />
        <figcaption className="absolute bottom-0 left-0 right-0 px-4 py-2" style={{ background: 'rgba(0,0,0,0.62)' }}>
          <PhotoCredit photo={photo} variant="overlay" />
        </figcaption>
      </figure>

      <Shell>
        <Spine
          drawn
          rhythm="masthead"
          railOnMobile={false}
          rail={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}>
              <RailLabel>Tricity</RailLabel>
              <RailNote>Chandigarh<br />Mohali<br />Panchkula</RailNote>
              <div className="mt-8">
                <RailLabel>Verified</RailLabel>
                <RailNote>By a person,<br />usually within hours</RailNote>
              </div>
            </motion.div>
          }
        >
          <motion.div
            initial="initial" animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.06, delayChildren: 0.34 } } }}
            className="lg:pr-[26vw]"
          >
            <h1 className="font-display text-[clamp(2.75rem,5.6vw,4.5rem)] font-semibold leading-[1.03] tracking-[-0.03em] text-neutral-900">
              <span className="tm-line">From match</span>
              <span className="tm-line">to mandap,</span>
              <span className="tm-line italic text-primary-500">all in the Tricity.</span>
            </h1>

            <motion.p variants={fadeRise} className="mt-6 max-w-[40ch] text-[17px] leading-[1.6] text-neutral-600 md:text-[18px]" style={{ textWrap: 'pretty' }}>
              Three cities, one short list, and a person checking every face on
              it. Close enough that both families can meet this week.
            </motion.p>

          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.55 }}
            className="mt-8 flex flex-wrap items-center gap-3 lg:mt-10"
          >
            <Link to="/onboarding" className="btn-primary tm-press inline-flex items-center gap-2">
              Create free profile
              <FiArrowRight aria-hidden="true" />
            </Link>
            <Link
              to="/login"
              className="tm-press inline-flex min-h-[44px] items-center rounded-xl border border-neutral-300 px-6 py-3 text-[15px] font-medium text-neutral-800 dark:border-neutral-600"
            >
              Sign in
            </Link>
          </motion.div>


          {/* Mobile photograph, edge to edge. It sits below the call to action
              on purpose: ambient art direction never outranks the thing the
              visitor came to do. */}
          <motion.figure
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.7 }}
            className="-mx-4 mt-10 lg:hidden"
          >
            <img src={photo.src} alt={photo.alt} width="800" height="450" loading="eager" className="aspect-[16/9] w-full object-cover object-[50%_38%]" />
            <div className="px-4 pt-2">
              <PhotoCredit photo={photo} />
            </div>
          </motion.figure>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-neutral-500">
            {['Live selfie verification', 'No credit card to join', 'Verified in hours'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <FiCheck className="h-3.5 w-3.5 text-primary-500" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </Spine>
      </Shell>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Proof — a hairline row, not a dark band. Every line is true in production.
   ═══════════════════════════════════════════════════════════════════ */
const Proof = () => (
  <section className="bg-concrete">
    <Shell>
      <ul className="grid gap-x-8 gap-y-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {PROOF.map(([title, body], i) => (
          <motion.li key={title} {...reveal(i)}>
            <p className="text-[14px] font-semibold leading-[1.4] text-neutral-900">{title}</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-neutral-500">{body}</p>
          </motion.li>
        ))}
      </ul>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Matching — the categories the ranking weighs, horoscope among them.
   ═══════════════════════════════════════════════════════════════════ */
const Matching = () => (
  <section id="why" className="scroll-mt-24">
    <Shell>
      <Spine
        rail={
          <motion.div {...reveal()}>
            <RailLabel>Matching</RailLabel>
            <RailNote>Forty-plus signals,<br />refreshed daily</RailNote>
          </motion.div>
        }
      >
        <motion.h2 {...reveal()} className="max-w-[20ch] font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-neutral-900">
          What we actually weigh
        </motion.h2>
        <motion.p {...reveal()} className="mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-neutral-600">
          Not a compatibility percentage pulled out of the air. These are the
          categories behind the ranking, and you choose which of them matter.
        </motion.p>

        <dl className="mt-10 border-t border-neutral-300/70 dark:border-neutral-700">
          {SIGNALS.map((row, i) => (row.aside ? (
            /* The one row that isn't a row: horoscope matching breaks the
               table into an inset card rather than sitting level with
               "what they do" and "how they live", because it is the one
               signal this product does not ask of every family by default. */
            <motion.div
              key={row.t}
              initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1, transition: { duration: DUR.reveal, ease: EASE_OUT, delay: staggerIndex(i) } }}
              viewport={{ once: true, amount: 0.4 }}
              className="my-6 rounded-2xl border border-dashed border-primary-300/60 bg-primary-50/40 p-5 dark:border-primary-800/50 dark:bg-primary-950/20 md:ml-10"
            >
              <dt className="text-[16px] font-semibold leading-[1.4] text-neutral-900">{row.t}</dt>
              <dd className="mt-1 text-[15px] leading-[1.6] text-neutral-600">{row.d}, and never forced on anybody.</dd>
            </motion.div>
          ) : (
            <motion.div
              key={row.t}
              {...reveal(i)}
              className={`grid gap-x-8 gap-y-1 border-b border-neutral-300/70 py-5 dark:border-neutral-700 md:grid-cols-[minmax(0,15rem)_1fr] ${i % 2 === 1 ? 'md:pl-10' : ''}`}
            >
              <dt className="text-[16px] font-semibold leading-[1.4] text-neutral-900">{row.t}</dt>
              <dd className="text-[15px] leading-[1.6] text-neutral-600">{row.d}</dd>
            </motion.div>
          )))}
        </dl>
      </Spine>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Process — the four steps, with the verification rules hanging off step two.
   ═══════════════════════════════════════════════════════════════════ */
const Process = () => (
  <section id="how" className="scroll-mt-24 bg-white">
    <Shell>
      <Spine
        rail={
          <motion.div {...reveal()}>
            <RailLabel>Process</RailLabel>
            <RailNote>Two minutes to join.<br />The rest can wait.</RailNote>
          </motion.div>
        }
      >
        <motion.h2 {...reveal()} className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-neutral-900">
          What actually happens
        </motion.h2>

        <ol className="mt-10 border-t border-neutral-200">
          {STEPS.map((s, i) => (s.rules ? (
            /* The verification step is the one the rest of the product's
               trust claims stand on, so it is the one step that doesn't sit
               level with the other three: a highlighted card, not a row. */
            <motion.li
              key={s.n}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0, transition: { duration: DUR.reveal, ease: EASE_OUT, delay: staggerIndex(i) } }}
              viewport={{ once: true, amount: 0.35 }}
              className="my-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-800/40 md:p-8"
            >
              <div className="flex items-start gap-5">
                <motion.span
                  initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.6, rotate: -14 }}
                  whileInView={{ opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.5, ease: EASE_OUT, delay: staggerIndex(i) + 0.1 } }}
                  viewport={{ once: true, amount: 0.6 }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[13px] font-semibold tabular-nums text-white"
                >
                  {s.n}
                </motion.span>
                <div>
                  <h3 className="text-[19px] font-semibold leading-[1.3] text-neutral-900 md:text-[21px]">{s.t}</h3>
                  <p className="mt-1 text-[15px] leading-[1.6] text-neutral-600">{s.b}</p>
                  <ul className="mt-4 space-y-2">
                    {s.rules.map((r) => (
                      <li key={r} className="flex gap-2 text-[14px] leading-[1.55] text-neutral-500">
                        <FiCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden="true" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.li>
          ) : (
            <motion.li key={s.n} {...reveal(i)} className="grid gap-x-8 gap-y-3 border-b border-neutral-200 py-7 md:grid-cols-[auto_1fr_1fr]">
              <span className="self-start text-[13px] font-semibold tabular-nums tracking-[0.08em] text-primary-500">{s.n}</span>
              <h3 className="text-[19px] font-semibold leading-[1.3] text-neutral-900">{s.t}</h3>
              <p className="text-[15px] leading-[1.6] text-neutral-600">{s.b}</p>
            </motion.li>
          )))}
        </ol>
      </Spine>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Cities — the one section that ignores the spine, which is what makes the
   spine read as a decision rather than a margin.
   ═══════════════════════════════════════════════════════════════════ */
const Cities = () => (
  <section className="py-16 md:py-24">
    <Shell>
      <motion.h2 {...reveal()} className="max-w-[20ch] font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-neutral-900">
        Three cities. You already know the roads.
      </motion.h2>
      <motion.p {...reveal()} className="mt-4 max-w-[50ch] text-[17px] leading-[1.6] text-neutral-600">
        Not a filter chip. The whole product is that your match is twenty
        minutes away and both families know the same people.
      </motion.p>

      <div className="mt-10 grid gap-6 md:grid-cols-3 lg:grid-cols-12">
        {CITIES.map((c, i) => (
          <motion.div
            key={c.slug}
            {...(prefersReducedMotion ? {} : { ...wipeUp, whileInView: { ...wipeUp.whileInView, transition: { ...wipeUp.whileInView.transition, delay: staggerIndex(i) } } })}
            className={`${c.span} ${c.offset}`}
          >
            <Link to={`/matrimony/${c.slug}`} className="tm-city group relative block overflow-hidden">
              <img src={c.image.src} alt={c.image.alt} width="800" height="1000" loading="lazy" className={`tm-city-img w-full object-cover ${c.ratio}`} />
              {/* The scrim ships with the type, not as a hover flourish: it is
                  what makes the type legible on any photograph. */}
              <div className="absolute inset-x-0 bottom-0 p-5" style={{ background: 'linear-gradient(to top, rgba(20,12,15,0.88), rgba(20,12,15,0.55) 55%, rgba(20,12,15,0))' }}>
                <h3 className="font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.015em]" style={{ color: INK_TEXT }}>{c.name}</h3>
                <p className="mt-2 text-[14px] leading-[1.5]" style={{ color: 'rgba(253,248,242,0.85)' }}>{c.line}</p>
                <span className="mt-3 inline-flex items-center gap-2 text-[14px] font-medium underline-offset-4 group-hover:underline" style={{ color: GOLD_ON_INK }}>
                  Browse {c.name}
                  <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="mt-8 lg:mt-4 text-[12px] leading-[1.6] text-neutral-500">
        Photography:{' '}
        {CITIES.map((c, i) => (
          <span key={c.slug}>
            <a
              href={c.image.creditUrl} target="_blank" rel="noopener noreferrer"
              className="underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-700 dark:hover:decoration-neutral-300"
            >
              {c.image.credit}
            </a>
            {' '}({c.name}){i < CITIES.length - 1 ? ', ' : ''}
          </span>
        ))}
        {' '}&middot; Wikimedia Commons, CC BY-SA. Not members.
      </p>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Membership — one price, read live from the endpoint that charges it, with
   no promotion and no strike-through anchor beside it.
   ═══════════════════════════════════════════════════════════════════ */
const Membership = ({ plan }) => (
  <section id="membership" className="scroll-mt-24" style={{ background: INK, color: INK_TEXT }}>
    <Shell>
      <div className="grid py-16 md:py-24 lg:grid-cols-[22%_1fr] lg:py-0">
        <div className="mb-8 lg:mb-0 lg:py-24 lg:pr-8 lg:text-right">
          <motion.div {...reveal()}>
            <RailLabel onInk>Membership</RailLabel>
            <p className="mt-2 text-[13px] leading-[1.6]" style={{ color: INK_TEXT_SOFT }}>
              One plan.<br />Nothing to compare.
            </p>
          </motion.div>
        </div>
        <div className="lg:border-l lg:py-24 lg:pl-10" style={{ borderColor: INK_LINE }}>
          <div className="grid gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
            <motion.div {...reveal()}>
              {plan?.amount ? (
                <>
                  <p className="font-display text-[clamp(3.5rem,8vw,5.5rem)] font-semibold leading-none tabular-nums">
                    <CountUpRupee amount={plan.amount} />
                  </p>
                  <p className="mt-4 text-[17px]" style={{ color: INK_TEXT_SOFT }}>
                    {plan.durationLabel ? `for ${plan.durationLabel}.` : ''} Launch price.
                  </p>
                </>
              ) : (
                <p className="text-[17px]" style={{ color: INK_TEXT_SOFT }}>One plan, nothing to compare.</p>
              )}
              <p className="mt-8 border-t pt-6 text-[14px] leading-[1.6]" style={{ borderColor: INK_LINE, color: INK_TEXT_SOFT }}>
                Ask for a refund within seven days of paying and you get the
                membership back in full, less only the unlocks you used.{' '}
                <Link to="/refund-policy" className="underline underline-offset-2" style={{ color: INK_TEXT }}>
                  Read the refund policy
                </Link>.
              </p>
            </motion.div>

            <motion.div {...reveal()} className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-1 lg:gap-y-10">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: GOLD_ON_INK }}>Free, always</p>
                <ul className="mt-4 space-y-2.5 text-[15px] leading-[1.5]">
                  {['Your profile and your badge', 'Browsing and daily matches', 'Every message you receive'].map((f) => (
                    <li key={f} className="flex gap-3">
                      <FiCheck className="mt-1 h-4 w-4 shrink-0" style={{ color: GOLD_ON_INK }} aria-hidden="true" />
                      <span style={{ color: INK_TEXT_SOFT }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: GOLD_ON_INK }}>What Premium adds</p>
                <ul className="mt-4 space-y-2.5 text-[15px] leading-[1.5]">
                  {['Unlimited contact unlocks', 'Unlimited messaging', 'Filters and Incognito mode', 'Boost and spotlight'].map((f) => (
                    <li key={f} className="flex gap-3">
                      <FiCheck className="mt-1 h-4 w-4 shrink-0" style={{ color: GOLD_ON_INK }} aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Shell>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════
   Story and questions.
   ═══════════════════════════════════════════════════════════════════ */
const StoryAndQuestions = ({ stories }) => {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(-1);
  const story = stories[idx];
  const go = (delta) => setIdx((i) => (i + delta + stories.length) % stories.length);

  return (
    <section id="stories" className="scroll-mt-24 bg-white">
      <Shell>
        {story && (
          <Spine
            rhythm="tight"
            rail={
              <motion.div {...reveal()}>
                <RailLabel>Stories</RailLabel>
                <RailNote>Real couples,<br />published with<br />their permission</RailNote>
              </motion.div>
            }
          >
            <motion.figure {...wipeUp} className="max-w-[58ch]">
              <blockquote className="font-display text-[clamp(1.6rem,3.2vw,2.3rem)] font-medium leading-[1.3] tracking-[-0.015em] text-neutral-900">
                {story.quote}
              </blockquote>
              <figcaption className="mt-6 text-[15px] text-neutral-600">
                <span className="font-semibold text-neutral-900">{story.who}</span>
                {story.where && <span className="text-neutral-500">{` · ${story.where}`}</span>}
              </figcaption>
            </motion.figure>

            {stories.length > 1 && (
              <div className="mt-8 flex items-center gap-3">
                <button type="button" onClick={() => go(-1)} aria-label="Previous story"
                  className="tm-story-nav tm-press flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700">
                  <FiChevronLeft aria-hidden="true" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next story"
                  className="tm-story-nav tm-press flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700">
                  <FiChevronRight aria-hidden="true" />
                </button>
                <span className="text-[13px] tabular-nums text-neutral-500" aria-live="polite">{idx + 1} of {stories.length}</span>
              </div>
            )}
          </Spine>
        )}

        <Spine
          rhythm="tight"
          rail={
            <motion.div {...reveal()}>
              <RailLabel>Questions</RailLabel>
              <RailNote>
                We reply within a day,<br />in English, Hindi or Punjabi
              </RailNote>
            </motion.div>
          }
        >
          <motion.h2 {...reveal()} className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-neutral-900">
            Questions, answered
          </motion.h2>

          <dl className="mt-8 border-t border-neutral-200">
            {FAQS.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} className="border-b border-neutral-200">
                  <dt>
                    <button
                      type="button" onClick={() => setOpen(isOpen ? -1 : i)}
                      aria-expanded={isOpen} aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-center justify-between gap-6 py-5 text-left"
                    >
                      <span className="font-display text-[19px] font-semibold leading-[1.35] tracking-[-0.01em] text-neutral-900 md:text-[21px]">
                        {item.q}
                      </span>
                      <span className="tm-faq-toggle flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-700">
                        {isOpen ? <FiMinus className="h-4 w-4" aria-hidden="true" /> : <FiPlus className="h-4 w-4" aria-hidden="true" />}
                      </span>
                    </button>
                  </dt>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.dd
                        id={`faq-panel-${i}`}
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: DUR.accordion, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[62ch] pb-6 pr-12 text-[15px] leading-[1.65] text-neutral-600">{item.a}</p>
                      </motion.dd>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </dl>

          <motion.div {...reveal()} className="mt-8">
            <Link to="/contact" className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-medium text-primary-500 underline-offset-4 hover:underline">
              Ask us something else
              <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </motion.div>
        </Spine>
      </Shell>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Footer — the closing call to action is the top of it rather than a band of
   its own, so the page ends on an asymmetry instead of another stripe.
   ═══════════════════════════════════════════════════════════════════ */
const FOOTER_COLUMNS = [
  { title: 'Platform', links: [['Browse profiles', '/search'], ['How it works', '/#how'], ['Pricing', '/subscription'], ['Success stories', '/success-stories'], ['Create profile', '/onboarding']] },
  { title: 'Cities', links: [['Matrimony in Chandigarh', '/matrimony/chandigarh'], ['Matrimony in Mohali', '/matrimony/mohali'], ['Matrimony in Panchkula', '/matrimony/panchkula']] },
  { title: 'Company', links: [['About us', '/about'], ['Contact', '/contact'], ['Safety centre', '/safety'], ['Privacy policy', '/privacy'], ['Terms of service', '/terms'], ['Refunds', '/refund-policy']] },
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
      <Shell className="pt-16 md:pt-24">
        <div className="grid gap-10 border-b pb-14 md:pb-16 lg:grid-cols-12 lg:gap-6" style={{ borderColor: INK_LINE }}>
          <motion.h2
            {...reveal()}
            style={{ color: INK_TEXT }}
            className="font-display text-[clamp(2rem,4.2vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em] lg:col-span-7"
          >
            Start where the families you would actually meet are already looking.
          </motion.h2>
          <motion.div {...reveal()} className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <p className="text-[16px] leading-[1.6]" style={{ color: INK_TEXT_SOFT }}>
              A free profile takes about two minutes. The rest can wait until Sunday.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/onboarding" className="tm-press inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium" style={{ background: INK_TEXT, color: '#8B2346' }}>
                Create free profile
                <FiArrowRight aria-hidden="true" />
              </Link>
              <Link to="/login" className="tm-press inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-[15px] font-medium" style={{ borderColor: 'rgba(253,248,242,0.62)', color: INK_TEXT }}>
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </Shell>

      <Shell className="pb-28 pt-14 md:pb-16">
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
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                    className="tm-social flex h-11 w-11 items-center justify-center rounded-lg border transition-colors duration-150"
                    style={{ borderColor: INK_LINE, color: INK_TEXT_SOFT }}>
                    <Icon aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: GOLD_ON_INK }}>{col.title}</h2>
              <ul className="mt-3">
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="tm-footer-link flex min-h-[44px] items-center text-[14px] transition-colors duration-150" style={{ color: INK_TEXT_SOFT }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: GOLD_ON_INK }}>Contact</h2>
            <ul className="mt-3">
              {contactLinks.map(([label, href, external]) => (
                <li key={label}>
                  {href && external ? (
                    <a href={href} className="tm-footer-link flex min-h-[44px] items-center break-words text-[14px] transition-colors duration-150" style={{ color: INK_TEXT_SOFT }}>{label}</a>
                  ) : href ? (
                    <Link to={href} className="tm-footer-link flex min-h-[44px] items-center text-[14px] transition-colors duration-150" style={{ color: INK_TEXT_SOFT }}>{label}</Link>
                  ) : (
                    <span className="flex min-h-[44px] items-center text-[14px]" style={{ color: INK_TEXT_SOFT }}>{label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-[13px]" style={{ borderColor: INK_LINE, color: INK_TEXT_SOFT }}>
          <span>&copy; {new Date().getFullYear()} TricityMatch. All rights reserved.</span>
          <span>Made in Chandigarh.</span>
          <span>
            Built by{' '}
            <a href="https://www.globoniks.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: INK_TEXT }}>Globoniks</a>
          </span>
        </div>
      </Shell>
    </footer>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Sticky mobile CTA — IntersectionObserver, not a scroll listener.
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
        <p className="truncate text-[12px] leading-tight" style={{ color: INK_TEXT_SOFT }}>About two minutes</p>
      </div>
      <Link to="/onboarding" tabIndex={show ? 0 : -1}
        className="tm-press inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-[14px] font-medium"
        style={{ background: INK_TEXT, color: '#8B2346' }}>
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

  const { scrollYProgress } = useScroll();
  const progressScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  /* Top of the funnel. Everything downstream is measured against this. */
  useEffect(() => { track(STAGES.LANDING); }, []);

  /* Published stories only. A failed request is indistinguishable from none on
     purpose: an error card where a testimonial should be is worse than none. */
  useEffect(() => {
    let active = true;
    api.get('/success-stories')
      .then((res) => {
        const list = res.data?.stories || [];
        if (!active || list.length === 0) return;
        setStories(list.map((s) => ({
          quote: s.quote,
          who: s.coupleNames,
          where: [s.location, s.marriedOn ? `Married ${new Date(s.marriedOn).getFullYear()}` : null].filter(Boolean).join(' · '),
        })));
      })
      .catch(() => { /* section stays hidden */ });
    return () => { active = false; };
  }, []);

  /* The price, from the endpoint that charges it. Fails closed to no figure
     rather than to a stale one, and carries no anchor price beside it. */
  useEffect(() => {
    let active = true;
    api.get('/subscription/plans')
      .then((res) => {
        if (!active) return;
        const plans = res.data?.plans || {};
        /* `price` is in rupees and `duration` is already a human label. */
        const paid = Object.values(plans).find((p) => p && p.price > 0);
        if (!paid) return;
        setPlan({
          amount: Number(paid.price),
          durationLabel: paid.duration || null,
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

      <Masthead heroRef={heroRef} />
      <Proof />
      <Matching />
      <Process />
      <Cities />
      <Membership plan={plan} />
      <StoryAndQuestions stories={stories} />
      <SiteFooter />

      <StickyCTA heroRef={heroRef} />
    </div>
  );
};

export default Home;
