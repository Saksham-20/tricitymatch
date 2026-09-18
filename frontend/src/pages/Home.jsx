import React, { useState, useRef, useEffect } from 'react';
import { track, STAGES } from '../utils/analytics';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Seo from '../components/common/Seo';
import {
  FiShield, FiCheckCircle, FiArrowRight, FiUsers,
  FiMessageCircle, FiLock, FiX,
} from 'react-icons/fi';
import { FaInstagram, FaFacebook, FaTwitter, FaWhatsapp } from 'react-icons/fa';
import api from '../api/axios';
import useFoundingWindow from '../hooks/useFoundingWindow';
import { support } from '../config';
import { revealOnce, staggerIndex } from '../utils/animations';
import { EDITORIAL_IMAGES } from '../data/editorialImages';

/* Testimonials come ONLY from published admin success stories — the section is
   hidden until at least one real story exists. Never seed fabricated couples. */

/* ── AI IMAGE DISCLOSURE ──────────────────────────────────────────
   Doctrine ruling 15 override (owner instruction, 2026-09-17): the landing
   photography is AI-generated for now, real photography to follow, and that
   fact must be disclosed wherever the imagery renders — small, quiet, never
   a banner. Self-contained contrast (near-opaque dark chip + white text) so
   it stays >=4.5:1 regardless of what photo sits behind it, the page theme,
   or elder mode. Reads `aiGenerated` off the manifest entry it is given, so
   swapping an entry for a licensed photograph removes the caption on its own. */
const AiTag = ({ entry, style }) => {
  if (!entry?.aiGenerated) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', zIndex: 5, pointerEvents: 'none',
        fontFamily: 'var(--sans)', fontSize: 11, lineHeight: 1.3, letterSpacing: '.01em',
        color: '#FFFFFF', background: 'rgba(0,0,0,.62)',
        padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
        ...style,
      }}
    >
      AI-generated image
    </span>
  );
};

/* ── FONT LOADER ─────────────────────────────────────────────── */
/* This block used to fork its own color and type scale — different burgundy/
   gold hex than index.css's real tokens, plus a third and fourth font family
   (neither Playfair Display nor Inter). Doctrine §3 bans that outright ("Do
   not fork them"; "No third family"). Every color below now either IS the
   real token's hex (burgundy/gold — locked, accent-only, same in both themes
   per index.css, which never overrides --primary/--gold under html.dark) or
   reads live off it via var() (the canvas/ink/border set), so this page
   inherits html.dark automatically instead of "being assumed fine because
   the page is a fixed palette." Fonts resolve to the real @font-face stack
   `index.html` requests (Playfair Display / Inter) — no separate family is
   loaded from here, so the preload-scanner note below still holds.

   --panel-cream / --panel-ink are the one deliberate exception: this page's
   established rhythm alternates a light canvas with full-bleed burgundy/ink
   bands (ribbon, founding, cities, trust, CTA, footer). Those bands' own
   background is the FIXED accent (burgundy) or a fixed dark panel tone, not
   the reactive canvas, so their cream-colored text/fills must stay fixed
   too — reusing the reactive --cream/--ink there would eventually put dark
   text on a dark band (or light text on a lightened one) under html.dark.
   --panel-cream/--panel-ink hold the exact pre-existing values so those
   bands render pixel-identical in both themes; every other token below is
   live. */
const FontLoader = () => (
  <style>{`
    :root {
      --burgundy: #8B2346;
      --burgundy-dk: #6B1D3A;
      --burgundy-lt: #D66E8E;
      --gold: #C9A227;
      --gold-lt: #F2D88A;
      --gold-text: #E8C34A; /* gold-400 — the same "bright gold, ~9:1 on dark" value index.css already uses for html.dark .text-gold-600 */
      /* Rule unchanged: --gold is for decoration (glyphs, dots, icons); every
         gold TEXT node uses --gold-text. --gold on --burgundy is only
         3.52:1, and these display headings clamp down to 22px on a 375px
         screen — under WCAG's 24px large-text threshold, so they need the
         full 4.5:1. */
      --cream: hsl(var(--background));       /* reactive canvas — #FAFAFA light, index.css's dark bg under html.dark */
      --cream-2: hsl(var(--muted));           /* reactive muted surface */
      --cream-3: hsl(var(--card));            /* reactive elevated surface — #FFFFFF light, per doctrine §3.1 */
      --ink: hsl(var(--foreground));          /* reactive default text */
      --ink-soft: hsl(var(--muted-foreground)); /* reactive secondary text */
      --mute: hsl(var(--muted-foreground));   /* reactive tertiary text — same token as ink-soft, not an invented gray */
      --line: hsl(var(--border));             /* reactive hairline */
      --line-on-dk: rgba(253,248,242,0.22);   /* fixed hairline for the always-dark bands below */
      --panel-cream: #FDF8F2;
      --panel-ink: #2D1A22;
      --display: 'Playfair Display', Georgia, serif;
      --serif: 'Playfair Display', Georgia, serif;
      --sans: 'Inter', -apple-system, system-ui, sans-serif;
      --mono: 'Inter', -apple-system, system-ui, sans-serif; /* was a real monospace family — doctrine bans both the third font family and monospace-as-costume on marketing labels; the uppercase+tracking treatment carries the "label" read on its own */
    }

    /* Doctrine §3.5: elder mode's hit targets are >=48px. These four sat at
       or under the 44px floor — the rest of the page's controls (CTA
       buttons, chips, the FAQ row itself) already clear 48px. */
    html.elder .faq-toggle { width: 48px; height: 48px; }
    html.elder .announce-dismiss { padding: 17px; }
    html.elder .story-nav-btn { width: 48px; height: 48px; }
    html.elder .social-icon { width: 48px; height: 48px; }

    .ht-display { font-family: var(--display) !important; }
    .ht-serif   { font-family: var(--serif) !important; }
    .ht-sans    { font-family: var(--sans) !important; }
    .ht-mono    { font-family: var(--mono) !important; }

    body { overflow-x: hidden; }

    /* ── Headings on dark panels ──
       index.css colours h1/h2/h3 with an ELEMENT rule, which beats the inherited
       light colour a dark section sets on its container. Two headlines on this
       page rendered near-black on near-black because of it (the founding band
       and the closing CTA). Scoping inherit to this page's dark sections fixes
       both and stops the next one; a heading with its own inline colour wins. */
    .section-dark h1, .section-dark h2, .section-dark h3,
    footer h1, footer h2, footer h3 { color: inherit; }

    /* ── Scroll progress bar ── */
    .scroll-bar {
      position: fixed; top: 0; left: 0; height: 2px; z-index: 200;
      background: linear-gradient(90deg, var(--burgundy), var(--gold));
      transform-origin: left;
    }

    /* ── Ribbon ── static now: an infinite marquee is an idle loop with no
       semantic exemption (doctrine §2 ruling 7), and this band sits on the
       single highest-traffic view of the site, so §4.1's frequency gate
       ("100+/day: no animation, ever") bans it a second way. Renders once,
       centered, wrapped — same words, no scroll. */

    /* ── Hero stack animations ── */
    @keyframes rise { from { opacity:0; transform: translateY(60px); } to { opacity:1; transform: translateY(0); } }
    /* drift-back/mid/front/pulse/drift removed with the idle-loop pass below
       (doctrine §2 ruling 7): none of the six elements that used them —
       ribbon, the "live" dot, the three hero photos, the CTA orbs, the
       footer status dot — is a semantically exempt loop (skeleton shimmer,
       chat typing indicator, spinner). Elements keep their settled resting
       transform; they just no longer breathe forever. */

    /* ── WHY horizontal scroll ── */
    .why-scroller { scrollbar-width: none; scroll-snap-type: x mandatory; }
    .why-scroller::-webkit-scrollbar { display: none; }
    /* Progress bar driven by CSS scroll-timeline, not a scroll listener —
       only applied when JS confirms support (.why-bar-css, set from
       supportsScrollTimeline), so the fill still tracks #why-scroller's
       own horizontal position on browsers that lack the feature. */
    @keyframes why-bar-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .why-bar-css { transform-origin: left; animation: why-bar-fill linear; animation-timeline: scroll(nearest inline); }

    /* ── Cities accordion ── */
    .city-strip { transition: flex 280ms var(--ease-out); }
    .city-bg { transition: transform 280ms var(--ease-out); }
    .city-strip.active .city-bg { transform: scale(1) !important; }

    /* ── Polaroid ── */
    .polaroid { transition: transform 250ms var(--ease-in-out), opacity 250ms var(--ease-in-out); }

    /* ── Responsive overrides ── */
    @media (max-width: 1000px) {
      /* Hero: single column */
      .hero-section { grid-template-columns: 1fr !important; min-height: auto !important; }
      /* Text block — nth-child(1) */
      .hero-section > div:nth-child(1) { padding: 32px 20px 24px !important; justify-content: flex-start !important; gap: 0 !important; }
      /* Title inside text block */
      .hero-section > div:nth-child(1) > div:nth-child(2) { margin: 16px 0 !important; }
      /* Photo block — nth-child(2) */
      .hero-section > div:nth-child(2) { padding: 8px 20px 72px !important; display: flex !important; justify-content: center !important; min-height: 280px !important; max-height: 380px !important; overflow: visible !important; }
      /* Baseline strip — nth-child(3) */
      .hero-baseline { padding: 10px 20px !important; flex-wrap: wrap !important; gap: 8px 14px !important; }
      /* CTA row: stack description above buttons */
      .hero-cta-row { grid-template-columns: 1fr !important; gap: 20px !important; align-items: flex-start !important; }
      /* Why section */
      #why { grid-template-columns: 1fr !important; padding: 48px 0 32px !important; }
      #why > div:first-child { position: static !important; padding: 0 20px 32px !important; }
      #why-scroller { padding: 0 20px 20px !important; scroll-padding-left: 20px !important; }
      /* why cards: slightly narrower on mobile */
      .why-tile { flex: 0 0 240px !important; }
      /* Matches */
      .matches-section { padding: 36px 20px !important; }
      .matches-section > div:first-child { flex-direction: column !important; align-items: flex-start !important; }
      .matches-grid { grid-template-columns: 1fr !important; }
      .matches-grid > div:last-child { display: none !important; }
      /* Process */
      .process-outer { display: none !important; }
      .process-steps-list { display: flex !important; flex-direction: column !important; gap: 16px !important; padding: 40px 20px !important; background: var(--cream-3) !important; border-top: 1px solid var(--line) !important; border-bottom: 1px solid var(--line) !important; }
      .process-step-card { padding: 20px !important; border: 1px solid var(--line) !important; border-radius: 4px !important; background: var(--cream) !important; }
      /* Cities: stack vertically */
      .cities-section > div:first-child { grid-template-columns: 1fr !important; padding: 40px 20px 24px !important; }
      .cities-section > div:last-child { flex-direction: column !important; height: auto !important; }
      .cities-section > div:last-child > div { flex: 1 !important; min-height: 260px !important; border-right: none !important; border-bottom: 1px solid var(--line-on-dk) !important; }
      /* City: hide rotated vertical label, always show expanded content */
      .cities-section > div:last-child > div > div:nth-child(2) { display: none !important; }
      .cities-section > div:last-child > div > div:nth-child(3) { opacity: 1 !important; padding: 16px 20px 20px !important; }
      /* Darken city overlay on mobile for readability */
      .city-strip > div:nth-child(2) { background: linear-gradient(180deg, rgba(45,26,34,0.5) 0%, rgba(45,26,34,0.92) 100%) !important; }
      /* City name: smaller on mobile */
      .cities-section > div:last-child > div > div:nth-child(3) > div:nth-child(2) { font-size: 28px !important; line-height: 1 !important; margin-bottom: 8px !important; }
      /* City top row: compact, hide count */
      .cities-section > div:last-child > div > div:nth-child(3) > div:nth-child(1) > div { display: none !important; }
      /* City expanded content: stack desc + button vertically */
      .city-content-bottom { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
      /* City desc: tighter */
      .city-content-bottom > p { font-size: 13px !important; line-height: 1.45 !important; max-width: 100% !important; }
      /* Quote */
      .quote-section { padding: 40px 20px !important; }
      .quote-attribution { flex-wrap: wrap !important; gap: 8px !important; justify-content: center !important; row-gap: 4px !important; }
      /* CTA */
      .cta-section { padding: 48px 20px !important; }
    }
    @media (max-width: 900px) {
      nav .nav-links-wrap { display: none !important; }
      nav { padding: 16px 20px !important; }
      /* Trust */
      .trust-section { padding: 40px 20px !important; }
      .trust-header { grid-template-columns: 1fr !important; }
      .trust-cards { grid-template-columns: 1fr 1fr !important; }
      /* Refund guarantee: single column, pledge rule moves from left edge to top */
      .refund-section { padding: 40px 20px !important; }
      .refund-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
      .refund-pledges { border-left: none !important; border-top: 1px solid var(--line) !important; padding-left: 0 !important; padding-top: 26px !important; }
      /* Testimonials */
      .testi-section { padding: 40px 20px !important; }
      .testi-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
      .testi-grid > div:first-child { height: 280px !important; margin-bottom: 40px !important; overflow: hidden !important; }
      /* FAQ */
      #faq { grid-template-columns: 1fr !important; padding: 48px 20px !important; }
      #faq > div:first-child { position: static !important; }
      /* Footer */
      .footer-grid-inner { grid-template-columns: 1fr 1fr !important; padding: 32px 20px !important; }
      .footer-mega-inner { padding: 32px 20px 20px !important; }
      .footer-bottom-inner { padding: 20px 20px 0 !important; flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
      /* Founding band: single column, pledge rule moves from left edge to top */
      .trust-strip-section { padding: 32px 16px 0 !important; }
      .founding-band { grid-template-columns: 1fr !important; gap: 28px !important; }
      .founding-pledges { border-left: none !important; border-top: 1px solid var(--line-on-dk) !important; padding-left: 0 !important; padding-top: 26px !important; }
      .ts-badges-row, .ts-momentum-row { flex-direction: column !important; gap: 8px !important; text-align: center !important; }
      .tsm-sep { display: none !important; }
      /* Parents */
      .parents-section { padding: 40px 20px !important; }
      .parents-head { grid-template-columns: 1fr !important; gap: 16px !important; }
      .parents-row { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 600px) {
      .trust-cards { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 480px) {
      .hero-section > div:nth-child(1) { padding: 24px 16px 20px !important; }
      .footer-grid-inner { grid-template-columns: 1fr !important; }
      .testi-grid > div:first-child { height: 240px !important; }
      .matches-section { padding: 28px 16px !important; }
      #why > div:first-child { padding: 0 16px 24px !important; }
      #why-scroller { padding: 0 16px 16px !important; }
    }
    @media (min-width: 1001px) {
      .process-steps-list { display: none !important; }
    }

    /* ── FAQ toggle ── */
    .faq-toggle::before, .faq-toggle::after {
      content:""; position:absolute; top:50%; left:50%;
      background: var(--ink); transition: transform 200ms var(--ease-out), background-color 160ms ease;
    }
    .faq-toggle::before { width:12px; height:1px; transform: translate(-50%,-50%); }
    .faq-toggle::after  { width:1px; height:12px; transform: translate(-50%,-50%); }
    .faq-item-open .faq-toggle { background: var(--burgundy); border-color: var(--burgundy); transform: rotate(180deg); transition: background-color 160ms ease, border-color 160ms ease, transform 200ms var(--ease-out); }
    .faq-item-open .faq-toggle::before,
    .faq-item-open .faq-toggle::after { background: var(--panel-cream); }
    .faq-item-open .faq-toggle::after { transform: translate(-50%,-50%) rotate(90deg); }
    .faq-a { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 200ms var(--ease-out), opacity 200ms var(--ease-out), margin-top 200ms var(--ease-out); }
    .faq-item-open .faq-a { max-height: 240px; opacity: 1; margin-top: 12px; }

    /* ── Sticky mobile CTA ── */
    .sticky-cta {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 120;
      background: hsl(var(--card) / 0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid var(--line); padding: 12px 20px;
      display: none; align-items: center; justify-content: space-between; gap: 16px;
      transform: translateY(100%); transition: transform 280ms var(--ease-drawer);
    }
    .sticky-cta.show { transform: translateY(0); }
    .sticky-cta .sc-text { display: flex; flex-direction: column; }
    .sticky-cta .sc-text strong { font-size: 14px; font-family: var(--sans); color: var(--ink); }
    .sticky-cta .sc-text span { font-family: var(--mono); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--mute); }
    @media (max-width: 900px) {
      .sticky-cta { display: flex; }
      /* Reserve space so the fixed sticky CTA never covers footer legal/copyright */
      footer { padding-bottom: 120px !important; }
    }

    /* ── Reduced motion: honor OS-level user preference (a11y + battery) ──
       Zeroing only animation-duration left animation-delay untouched — the
       hero's staggered "rise" keyframes hold their FROM state (opacity: 0)
       for the full delay (up to 0.9s) before snapping to visible, so a
       reduced-motion screenshot taken on load read as missing content, not
       merely unanimated. Delay is now zeroed too, so every element reaches
       its settled, visible state immediately. */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .001ms !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
        transition-duration: .001ms !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    }

    /* Fixed global navbar is taller on mobile (~89px) than the desktop bar the
       announcement clears by default → its first line hid under the navbar.
       Give the announcement explicit top clearance on small screens. */
    @media (max-width: 767px) {
      .home-announce { margin-top: 40px; }
    }
  `}</style>
);

/* ── STICKY CTA — mobile-only bottom bar ─────────────────────────── */
/* Was a raw `scroll` listener recomputing `window.scrollY > innerHeight * .8`
   on every scroll frame. Doctrine §8 bans that pattern; an IntersectionObserver
   watching the hero section do the equivalent job off the main thread — the
   bar shows once the hero has scrolled out of view. */
const StickyCTA = ({ heroRef }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = heroRef?.current;
    if (!hero) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { rootMargin: '0px' }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroRef]);
  return (
    <div className={`sticky-cta${show ? ' show' : ''}`}>
      <div className="sc-text">
        <strong>Free to join</strong>
        <span>No credit card · Verified in hours</span>
      </div>
      <Link to="/onboarding" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
        padding: '12px 20px', borderRadius: 999,
        background: 'var(--burgundy)', color: 'var(--panel-cream)',
        fontSize: 13, fontWeight: 500, fontFamily: 'var(--sans)', textDecoration: 'none',
      }}>Create profile <FiArrowRight /></Link>
    </div>
  );
};

/* ── HOME ─────────────────────────────────────────────────────── */
const supportsScrollTimeline =
  typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: scroll()');

/* Every onMouseEnter/onMouseLeave pair below mutates inline style directly
   (background/color/transform/shadow/border) instead of a CSS :hover rule,
   so none of it had a `(hover: hover)` escape hatch — a tap fires the same
   synthetic mouseenter a real hover would, and nothing fires a matching
   leave until some later, unrelated touch, so the element is left stuck in
   its "hovered" look after the finger lifts (doctrine §4.7). Every handler
   below checks this first. */
const canHover = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const Home = () => {
  // Top of the funnel. Everything downstream is measured against this number,
  // and until it existed there was no way to tell a quiet week from a broken
  // one.
  useEffect(() => { track(STAGES.LANDING); }, []);

  const [activeCity, setActiveCity]       = useState(0);
  const [matchIdx, setMatchIdx]           = useState(0);
  const [processActive, setProcessActive] = useState(0);
  const [storyIdx, setStoryIdx]           = useState(0);
  const [stories, setStories]             = useState([]);
  const [faqOpen, setFaqOpen]             = useState(-1);
  const [announcementOn, setAnnouncementOn] = useState(true);

  // Fail-closed: until the server confirms the window is open, the band shows
  // the weaker copy that is true regardless (see the FOUNDING BAND section).
  const founding = useFoundingWindow();
  const foundingEndsLabel = founding.endsAt
    ? new Date(founding.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const { scrollYProgress } = useScroll();
  const progressScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  /* "Just matched" live ticker removed — it showed fabricated couples as real activity. */

  const heroRef = useRef(null);

  /* process step selection — used to be scroll-scrubbed (a `useScroll`
     progress value mapped straight onto `processActive` while the section
     sat pinned under `position: sticky` for 150vh of scroll). Ruling 1 bans
     that outright regardless of implementation technology: "No pinning, no
     scroll hijack, no scrubbed scroll." `processActive` is now driven only
     by clicking a step, same as any tabbed content. */

  /* story auto-advance */
  useEffect(() => {
    const t = setInterval(() => setStoryIdx(i => (i + 1) % (stories.length || 1)), 6000);
    return () => clearInterval(t);
  }, [stories.length]);

  /* load published success stories from API; section stays hidden if none */
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
          tag: s.tag || '',
          // No stock-photo fallback: a real, named, consenting couple must
          // never be illustrated with a picture of someone else (the old
          // fallback pointed at an AI/stock image literally named after a
          // different fabricated couple). `img: null` renders an initials
          // mark instead — see the polaroid pile below.
          img: s.photoUrl || null,
        })));
        setStoryIdx(0);
      })
      .catch(() => { /* section stays hidden */ });
    return () => { active = false; };
  }, []);

  /* why-scroller progress bar — CSS scroll-timeline where supported (the
     `.why-bar-css` rule in FontLoader, gated on the same `supportsScrollTimeline`
     feature check the vertical scroll bar above already uses), a `scroll`
     listener only as the fallback for browsers without it. */
  useEffect(() => {
    if (supportsScrollTimeline) return undefined;
    const scroller = document.getElementById('why-scroller');
    const bar      = document.getElementById('why-bar');
    if (!scroller || !bar) return undefined;
    const onScroll = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      bar.style.width = (max > 0 ? (scroller.scrollLeft / max) * 100 : 0) + '%';
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  /* ── DATA ──
     `discoverPhotos` used to be `profiles`: five invented people with full
     names, exact ages, cities, employers and a fabricated compatibility
     score, rendered with a "✦ Verified" badge over the card (see the MATCHES
     section below). Doctrine ruling 15 bans exactly this — imagery may only
     ever be ambient art direction, never a member, never carrying a name,
     age, city, verified tick or match percentage. There is no honest way to
     keep the identity data, so it is gone; the photography stays as pure
     imagery via the editorial manifest. */
  const discoverPhotos = EDITORIAL_IMAGES.discoverGallery;

  const processSteps = [
    { n: '01', t: 'Create your profile',    b: 'Build a detailed profile that reflects who you truly are, then earn your verified badge with a live selfie.',       meta: ['~12 min', 'Selfie verified', 'Free'] },
    { n: '02', t: 'Discover matches',       b: 'Our matching engine surfaces compatible profiles across 40+ signals. You stay in full control of who sees you.',                    meta: ['Smart ranking', '40+ signals', 'Daily refresh'] },
    { n: '03', t: 'Connect securely',       b: 'Every conversation is encrypted in transit and stays private. Express interest, chat, and bring family in when ready.',                  meta: ['Encrypted in transit', 'Read receipts', 'No phone reveal'] },
    { n: '04', t: 'Begin your journey',     b: 'Meet in person with confidence. We\'ve done the groundwork on verification and compatibility.',                        meta: ['Verified meet', 'Family flow', 'Lifelong support'] },
  ];

  const cities = [
    { tag: 'City Beautiful',       name: 'Chandigarh', desc: 'India\'s most planned city. Cosmopolitan, career-forward, and deeply family-rooted.',         image: EDITORIAL_IMAGES.cities.chandigarh },
    { tag: "Punjab's Rising Star", name: 'Mohali',     desc: 'Tech parks, AIIMS, IIT. Young professionals building careers without leaving culture.',         image: EDITORIAL_IMAGES.cities.mohali },
    { tag: 'Roots Run Deep',       name: 'Panchkula',  desc: 'Quiet, established, close-knit. Tradition and aspiration in equal measure.',                   image: EDITORIAL_IMAGES.cities.panchkula },
  ];

  const faqs = [
    { q: 'Only Tricity residents?',              a: 'Yes. Every profile is from Chandigarh, Mohali, or Panchkula, or has direct family ties to the region. Hyperlocal is the point.' },
    { q: 'How does profile verification work?',  a: 'Members submit a live selfie, captured in the moment and never uploaded from files, that our team matches against their profile photos. The verified badge appears once approved.' },
    { q: 'Can I browse without an account?',     a: 'No, search and full profiles need a free account. Creating one takes about two minutes and you can start browsing right away.' },
    { q: 'I live abroad, can NRIs join?',       a: 'Yes, if you are from the Tricity or your family is. Where you live now does not matter; the roots do. Mark yourself as an NRI during sign-up and add your country, and families looking for an NRI alliance will see it. A parent or sibling here can search alongside you through Guardian access.' },
    { q: 'What does Premium include?',           a: 'One plan, no tiers to compare: unlimited contact unlocks, unlimited messaging, advanced filters, Incognito mode, a profile boost and a spotlight listing, for the full term. Browsing, matching and your profile stay free.' },
    { q: 'Is my data private?',                  a: 'Yes. Conversations are encrypted in transit and access is restricted to you and your match. We never share your phone number, never sell data, never display you to non-mutual interests.' },
    { q: 'Can families participate?',             a: 'Yes, gracefully. You choose when. They get their own view and chat channel kept respectfully separate from yours.' },
  ];

  {/* Doctrine §8 bans numbered section markers ("01 /", "02 /") — the `tag`
      field below used to read "01 / Security". Kept the plain category word,
      dropped the number. */}
  const whyCards = [
    { tag: 'Security',   title: 'Photo-verified profiles',   body: 'The verified badge is earned with a live selfie matched by human review. No uploads, no shortcuts.',           glyph: '◉' },
    { tag: 'Technology', title: 'Intelligent matching, 40+ signals',        body: 'Values, lifestyle, family expectations: far beyond age and location.',                                  glyph: '◇' },
    { tag: 'Hyperlocal', title: 'Built only for the Tricity',      body: 'Made for Chandigarh, Mohali, Panchkula. Meet partners from your community.',                            glyph: '▣' },
    { tag: 'Privacy',    title: 'Incognito browsing',              body: 'Browse privately. Appear only to those you\'ve expressed interest in.',                                  glyph: '◐' },
    { tag: 'Comms',      title: 'Private conversations',           body: 'Encrypted in transit, with read receipts. Free members read every message for free, and once a premium member you matched with reaches out, you get five free replies over the next 48 hours.', glyph: '▲' },
    { tag: 'Values',     title: 'Family-aware flow',               body: 'Bring family in at the right moment. Respect, not pressure.',                                            glyph: '✦' },
  ];

  const cur       = discoverPhotos[matchIdx];
  const curStep   = processSteps[processActive];
  const curStory  = stories[storyIdx];

  /* ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ background: 'var(--cream)', fontFamily: 'var(--sans)', color: 'var(--ink)', overflowX: 'clip' }}>
      <Seo path="/" />
      <FontLoader />

      {/* ── SCROLL BAR ── CSS scroll-timeline where supported (runs off the
          main thread); framer-motion baseline everywhere else. */}
      {supportsScrollTimeline ? (
        <div className="scroll-progress" aria-hidden="true" />
      ) : (
        <motion.div className="scroll-bar" style={{ scaleX: progressScaleX }} />
      )}

      {/* ── ANNOUNCEMENT ──
          Was a hardcoded, never-verified offer ("First month Premium free for
          Chandigarh residents") — no such offer exists, wrong on the benefit
          (the real founding grant is `founding.grantDays` days, not a month)
          and wrong on the geography (open to all three Tricity cities, not
          Chandigarh alone). Driven off the same `useFoundingWindow` read the
          FOUNDING BAND below already uses: fail-closed, so the strip renders
          only while the server confirms the window is open, and simply does
          not render otherwise rather than showing a claim nobody can redeem. */}
      <AnimatePresence>
        {announcementOn && founding.open && (
          <motion.div
            className="home-announce"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ background: 'var(--burgundy)', color: 'var(--panel-cream)', fontSize: 13, overflow: 'hidden', position: 'relative', zIndex: 40 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '10px 40px', fontFamily: 'var(--sans)' }}>
              {/* Static dot, not a perpetual pulse — doctrine §2 ruling 7 has
                  no exemption for a decorative "live" indicator. */}
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold-lt)', flexShrink: 0 }} />
              <p><span style={{ fontWeight: 600, color: 'var(--gold-text)' }}>Founding offer:</span> {founding.grantDays ? `${founding.grantDays} days` : 'A period'} of Premium free, open to all Tricity members.{founding.contactUnlocks != null ? ` Includes ${founding.contactUnlocks} contact unlock${founding.contactUnlocks === 1 ? '' : 's'}.` : ''}{' '}
                <Link to="/onboarding" style={{ textDecoration: 'underline', fontWeight: 600 }}>Claim now</Link>
              </p>
              {/* padding + compensating offset: 32px hit box, icon stays at right:16; html.elder bumps it to 48 */}
              <button className="announce-dismiss" onClick={() => setAnnouncementOn(false)} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', opacity: 0.7, padding: 9, lineHeight: 0 }} aria-label="Dismiss">
                <FiX style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════
          HERO — asymmetric split: monumental title left, fanned photo stack right
      ════════════════════════════════════════════════════════ */}
      <section ref={heroRef} style={{
        minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr',
        paddingTop: 64, position: 'relative', boxSizing: 'border-box',
      }} className="hero-section">

        {/* LEFT */}
        <div style={{ padding: '28px 28px 48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
          {/* Doctrine ruling 2: zero eyebrows, the heading carries itself. The
              pill that used to sit here ("Serious matrimony · Tricity only ·
              Founding members welcome") is removed rather than reworded —
              the trust chips and baseline strip below the fold already carry
              the same facts. */}

          {/* Headline — CRO messaging (h1 for SEO/a11y; one per page) */}
          <h1 style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(32px, 4.4vw, 70px)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            fontWeight: 'inherit',
            display: 'flex', flexDirection: 'column',
            margin: '20px 0',
          }}>
            {[
              { text: 'From match',                                                   style: { color: 'var(--ink)', animationDelay: '.25s' } },
              { text: 'to mandap,',                                                  style: { color: 'var(--ink)', animationDelay: '.4s' } },
              { text: <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>all in the Tricity.</em>, style: { animationDelay: '.55s' } },
            ].map((line, i) => (
              <span key={i} style={{
                display: 'inline-block',
                animation: `rise 1.2s var(--ease-out) ${line.style.animationDelay || '0s'} both`,
                ...line.style,
              }}>{line.text}</span>
            ))}
          </h1>

          {/* Trust chips — FiCheckCircle, not a raw "✓" glyph, so this reads
              as the same icon the rest of the page uses for "true/included"
              (e.g. the checklist on the DISCOVER panel below). */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, animation: 'rise 1.2s .7s both' }}>
            {['Live selfie verification', 'Chandigarh · Mohali · Panchkula', 'Family-first matchmaking'].map((t, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500, fontFamily: 'var(--sans)', color: 'var(--burgundy-dk)',
                background: 'var(--cream-3)', border: '1px solid var(--line)', borderRadius: 999, padding: '7px 14px',
              }}><FiCheckCircle style={{ width: 14, height: 14, flexShrink: 0 }} />{t}</span>
            ))}
          </div>

          <div className="hero-cta-row" style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 24,
            alignItems: 'end', paddingTop: 24,
            borderTop: '1px solid var(--line)',
            animation: 'rise 1.2s 0.9s both',
          }}>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', maxWidth: 420, fontFamily: 'var(--sans)' }}>
              Chandigarh, Mohali and Panchkula only: live selfie verification, private conversations, and every family close enough to meet this week. Founding members join free while we build Tricity's most carefully verified community.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <Link to="/onboarding" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 28px', borderRadius: 999,
                background: 'var(--burgundy)', color: 'var(--panel-cream)',
                fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)',
                transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
                textDecoration: 'none',
              }}
                onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--burgundy-dk)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 40px -12px rgba(124,29,58,.5)'; }}
                onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >Create free profile <FiArrowRight /></Link>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                Free to start · No credit card · Verified in hours
              </span>
              <a href="#why" style={{
                display: 'inline-flex', gap: 8, alignItems: 'center',
                fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase',
                padding: '14px 0', borderBottom: '1px solid var(--ink)',
                color: 'var(--ink)', textDecoration: 'none',
                transition: 'gap 160ms ease',
              }}
                onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.gap = '14px'; }}
                onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.gap = '8px'; }}
              >How it works <span>↓</span></a>
            </div>
          </div>
        </div>

        {/* RIGHT — fanned photo stack.
            Doctrine ruling 15 + the imagery override (docs/design-handoff/
            DOCTRINE_2026-09.md): AI-generated photography may set mood here as
            ambient art direction, but it may never carry a name, an age, a
            city or a match percentage, and it may never sit next to a
            verification claim. All three used to. The rotating "VERIFIED ·
            MATCHED · CONNECTED" ring sat directly over this stack and read as
            a claim about the pictured people — removed along with the 97%
            badge and the per-card names, rather than reworded, because
            nothing here is a real member to describe. The three photos stay:
            imagery is still allowed, just honest about being imagery. */}
        <div style={{ position: 'relative', padding: '0 36px 80px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 240, aspectRatio: '3/4' }}>
            {/* Back card — settled at its resting transform; the perpetual
                sway (`drift-back`, 8s infinite) is gone (doctrine §2 ruling
                7: no idle loops, and this is the single highest-traffic view
                on the site, so §4.1's frequency gate bans it a second way). */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden',
              boxShadow: '0 30px 80px -20px rgba(45,26,34,.35)',
              background: 'linear-gradient(140deg,#C9B5A6,#6E574B)',
              transform: 'rotate(-8deg) translateY(40px) translateX(-30px)',
            }}>
              <img src={EDITORIAL_IMAGES.heroStack.back.src} alt={EDITORIAL_IMAGES.heroStack.back.alt} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.45))' }} />
              <AiTag entry={EDITORIAL_IMAGES.heroStack.back} style={{ bottom: 10, left: 10 }} />
            </div>
            {/* Mid card — settled, `drift-mid` removed for the same reason. */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden',
              boxShadow: '0 30px 80px -20px rgba(45,26,34,.35)',
              background: 'linear-gradient(160deg,#B59C82,#5C4B40)',
              transform: 'rotate(4deg) translateY(20px) translateX(20px)',
            }}>
              <img src={EDITORIAL_IMAGES.heroStack.mid.src} alt={EDITORIAL_IMAGES.heroStack.mid.alt} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.45))' }} />
              <AiTag entry={EDITORIAL_IMAGES.heroStack.mid} style={{ bottom: 12, left: 12 }} />
            </div>
            {/* Front card — with real image; `drift-front` removed for the
                same reason. */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden',
              boxShadow: '0 30px 80px -20px rgba(45,26,34,.35)',
              transform: 'rotate(-2deg)',
              zIndex: 2,
            }}>
              {/* eslint-disable-next-line react/no-unknown-property -- React 18.2 drops the
                  camelCase `fetchPriority` prop with a warning; the lowercase DOM
                  attribute is what actually reaches the browser on this version. */}
              <img src={EDITORIAL_IMAGES.heroStack.front.src} alt={EDITORIAL_IMAGES.heroStack.front.alt} fetchpriority="high" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.55))' }} />
              <AiTag entry={EDITORIAL_IMAGES.heroStack.front} style={{ bottom: 14, left: 14 }} />
            </div>
          </div>
        </div>

        {/* Baseline strip */}
        <div className="hero-baseline" style={{
          gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
          color: 'var(--ink-soft)', padding: '12px 40px', borderTop: '1px solid var(--line)',
        }}>
          {['Live selfie verification', 'Chandigarh', 'Mohali', 'Panchkula'].map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ width: 24, height: 1, background: 'var(--mute)', opacity: .4, flexShrink: 0 }} />}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FOUNDING BAND — the old stats-band slot (Phase S, F2/F10)

          Trust register, in order: exclusivity → verification specificity →
          hyperlocality. Community/family language, never SaaS growth-speak, and
          no number anywhere: the band that replaced fabricated metrics must not
          smuggle new ones in.

          The stronger claim (a free premium PERIOD) renders ONLY while the
          server says the founding window is open — `useFoundingWindow` is
          fail-closed, so a failed/slow lookup shows the weaker, always-true copy
          rather than promising an entitlement the grant would not issue.
      ════════════════════════════════════════════════════════ */}
      <section className="trust-strip-section section-dark" style={{ background: 'var(--panel-ink)', color: 'var(--panel-cream)', padding: '56px 40px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 120%, rgba(124,29,58,.55), transparent 60%)' }} />

        <div className="founding-band" style={{
          position: 'relative', maxWidth: 1280, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 56, paddingBottom: 40, alignItems: 'center',
        }}>
          {/* Left — the claim. Doctrine ruling 2: zero eyebrows, so no
              "— Founding members" label above the heading. */}
          <div>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(28px,3.6vw,48px)', lineHeight: 1.1, letterSpacing: '-.02em', margin: 0 }}>
              Tricity's newest, most carefully verified matchmaking community. {founding.open
                ? <em style={{ fontStyle: 'italic', color: 'var(--gold-text)' }}>Founding members join free.</em>
                : <em style={{ fontStyle: 'italic', color: 'var(--gold-text)' }}>Built family-first.</em>}
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(253,248,242,.72)', fontFamily: 'var(--sans)', maxWidth: '34em', margin: '18px 0 28px' }}>
              We&apos;re starting the honest way: no inflated numbers, every verified badge earned with a
              live selfie, and matchmaking that stays inside Chandigarh, Mohali and Panchkula.
              {/* Was rendering the offer's CLOSING date as if it were the length of
                  the grant — someone joining today read "free until 18 November"
                  and received `grantDays` (30), not seven-plus months. Fixed per
                  docs/LEGAL_REVIEW_2026-09-17.md A-7: state the grant length, then
                  the join-by deadline, matching the announcement band above. */}
              {founding.open
                ? ` Founding members get ${founding.grantDays ? `${founding.grantDays} days` : 'full membership'} free, including ${founding.contactUnlocks} contact unlocks, if you join before ${foundingEndsLabel}.`
                : ' Founding members join free and shape what this becomes.'}
            </p>
            <Link to="/onboarding" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 28px', borderRadius: 999,
              background: 'var(--panel-cream)', color: 'var(--panel-ink)',
              fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)',
              textDecoration: 'none', transition: 'transform 160ms ease, box-shadow 160ms ease',
            }}
              onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 40px -12px rgba(0,0,0,.5)'; }}
              onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >Become a founding member <FiArrowRight /></Link>
            <p style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'rgba(253,248,242,.55)', marginTop: 14 }}>
              {founding.open ? 'Free during the founding period' : 'Free to join'} · Photo-verified profiles · Local, family-first
            </p>
          </div>

          {/* Right — the pledge column */}
          <div className="founding-pledges" style={{
            borderLeft: '1px solid var(--line-on-dk)', paddingLeft: 56,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26,
          }}>
            {/* "seen by a person" claimed we pre-screen every profile; Terms
                cl.6 says the opposite ("We do not screen members, and we
                cannot"). Human review only happens for verification selfies
                and reported profiles. Fixed per docs/LEGAL_REVIEW_2026-09-17.md
                A-9 — draft wording used as given. */}
            {[
              ['Verified, not vast', 'A smaller circle, where the verified badge is earned in front of a person, not assumed.'],
              ['Tricity only', 'Matches you can actually meet: same city, same community.'],
              ['Families welcome', 'Parents and guardians take part, the way Tricity actually matches.'],
            ].map(([title, body]) => (
              <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                <span aria-hidden="true" style={{ width: 22, height: 2, background: 'var(--gold)', flex: 'none', transform: 'translateY(-4px)' }} />
                <div>
                  <b style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, letterSpacing: '.02em' }}>{title}</b>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 13, lineHeight: 1.55, color: 'rgba(253,248,242,.68)' }}>{body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety facts kept as a quiet footer line — true, specific, unpromoted */}
        <div className="ts-badges-row" style={{ position: 'relative', borderTop: '1px solid var(--line-on-dk)', maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 16, padding: '18px 0 22px', flexWrap: 'wrap' }}>
          {[
            '◉ Photo-verified badge earned with a live selfie',
            '◉ Flagged profiles reviewed by our safety team',
            '◉ Conversations encrypted in transit · numbers never shared',
          ].map((t, i) => (
            <span key={i} style={{ fontSize: 13, color: 'rgba(253,248,242,.78)', fontFamily: 'var(--sans)' }}>{t}</span>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          RIBBON — static trust band. Used to be an infinite marquee
          (60s scroll loop): an idle loop with no semantic exemption on the
          single highest-traffic view of the site (doctrine §2 ruling 7,
          §4.1). Same words, one pass, centered and wrapped instead of
          scrolling — no `[...Array(3)]` repeat needed once nothing scrolls.
      ════════════════════════════════════════════════════════ */}
      <div className="ribbon-band section-dark" style={{
        background: 'var(--burgundy)', color: 'var(--panel-cream)',
        padding: '14px 0', overflow: 'hidden',
        borderTop: '1px solid var(--line-on-dk)', borderBottom: '1px solid var(--line-on-dk)',
      }}>
        <div className="ribbon-track" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 40px', fontFamily: 'var(--display)', fontSize: 22, fontStyle: 'italic', letterSpacing: '-.01em', padding: '0 20px' }}>
          {['Verified profiles', 'Expertly matched', 'Family-first', 'Hyperlocal', 'Encrypted in transit', 'Founding community', 'Tricity built', 'Privacy first'].map((t, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 40 }}>
              {t}
              <span style={{ color: 'var(--gold)', fontStyle: 'normal', fontSize: 20 }}>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          WHY — sticky title pane + horizontal scrolling cards
      ════════════════════════════════════════════════════════ */}
      <section id="why" style={{ display: 'grid', gridTemplateColumns: '0.85fr 2fr', padding: '64px 0 48px', alignItems: 'start' }}>
        {/* Sticky left */}
        <div style={{ position: 'sticky', top: 80, padding: '0 28px 0 40px' }}>
          <motion.div {...revealOnce}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', marginBottom: 24 }}>
              Six reasons<br />this <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>isn't</em><br />another app.
            </h2>
            <p style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', marginBottom: 32 }}>
              Scroll right to read. Each principle shapes a real product decision, not just marketing copy.
            </p>
            <div style={{ height: 2, background: 'var(--line)', borderRadius: 1, overflow: 'hidden' }}>
              <div id="why-bar" className={supportsScrollTimeline ? 'why-bar-css' : undefined}
                style={supportsScrollTimeline
                  ? { height: '100%', background: 'var(--burgundy)', width: '100%' }
                  : { height: '100%', background: 'var(--burgundy)', width: 0, transition: 'width .2s linear' }}
              />
            </div>
          </motion.div>
        </div>

        {/* Horizontal scroll */}
        <div id="why-scroller" className="why-scroller" tabIndex={0} role="group" aria-label="Why TricityMatch: scroll horizontally to read" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '0 24px 20px', scrollSnapType: 'x mandatory' }}>
          {whyCards.map((c, i) => (
            <motion.div key={i}
              initial={revealOnce.initial}
              whileInView={{ ...revealOnce.whileInView, transition: { ...revealOnce.whileInView.transition, delay: staggerIndex(i) } }}
              viewport={revealOnce.viewport}
              className="why-tile"
              style={{
                flex: '0 0 260px', scrollSnapAlign: 'start',
                padding: '24px 20px', background: 'var(--cream-3)',
                border: '1px solid var(--line)', borderRadius: 4, minHeight: 280,
                display: 'flex', flexDirection: 'column',
                transition: 'transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out), background-color 200ms ease, color 200ms ease',
                position: 'relative', overflow: 'hidden', cursor: 'default',
              }}
              onMouseEnter={e => {
                if (!canHover()) return;
                const el = e.currentTarget;
                el.style.background = 'var(--burgundy)';
                el.style.color = 'var(--panel-cream)';
                el.style.transform = 'translateY(-8px)';
                el.style.boxShadow = '0 30px 60px -20px rgba(124,29,58,.4)';
                el.querySelector('.wt-glyph').style.color = 'var(--gold)';
                /* --gold-text, not --gold: this hover puts these two nodes on
                   the fixed burgundy fill above as TEXT, and --gold only
                   clears ~3.5:1 there — below the 4.5:1 floor these small
                   uppercase labels need (doctrine §3.1). --gold-text is the
                   token the rest of the page already uses correctly for
                   gold text on burgundy/ink. */
                el.querySelector('.wt-tag').style.color = 'var(--gold-text)';
                el.querySelector('.wt-body').style.color = 'rgba(253,248,242,.8)';
                el.querySelector('.wt-foot').style.color = 'var(--gold-text)';
              }}
              onMouseLeave={e => {
                if (!canHover()) return;
                const el = e.currentTarget;
                el.style.background = 'var(--cream-3)';
                el.style.color = '';
                el.style.transform = '';
                el.style.boxShadow = '';
                el.querySelector('.wt-glyph').style.color = 'var(--burgundy)';
                el.querySelector('.wt-tag').style.color = 'var(--mute)';
                el.querySelector('.wt-body').style.color = 'var(--ink-soft)';
                el.querySelector('.wt-foot').style.color = 'var(--burgundy)';
              }}
            >
              <div className="wt-glyph" style={{ fontSize: 36, color: 'var(--burgundy)', marginBottom: 20, lineHeight: 1, transition: 'color 200ms ease' }}>{c.glyph}</div>
              <div className="wt-tag" style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 10, transition: 'color 200ms ease' }}>{c.tag}</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 22, lineHeight: 1.05, letterSpacing: '-.01em', marginBottom: 10 }}>{c.title}</div>
              <div className="wt-body" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)', marginBottom: 'auto', transition: 'color 200ms ease' }}>{c.body}</div>
              <div className="wt-foot" style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--burgundy)', paddingTop: 24, transition: 'color 200ms ease' }}>Learn more</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          DISCOVER — illustrates the product, not fabricated members.

          This section used to be five invented people — full names, exact
          ages, cities, employers — each with a fabricated compatibility
          percentage and a "✦ Verified" badge rendered over the card. On a
          matrimonial site, where the verified badge is the trust primitive
          the whole page argues is earned by human review, a fabricated
          verified badge over a synthetic face was the sharpest honesty risk
          on the page (docs/LEGAL_REVIEW_2026-09-17.md section D). Doctrine
          ruling 15 bans it outright: imagery may set mood but never carry a
          name, age, city, match percentage or verified tick.

          Recomposed to illustrate the DISCOVERY EXPERIENCE instead of naming
          members that do not exist — the photography stays as ambient art
          direction (disclosed, see AiTag), the copy describes what a real
          profile card shows once you join, and every route goes to a real
          place (/search, /onboarding), never a fabricated `/profile/:id`. */}
      <section id="matches" className="matches-section section-dark" style={{ background: 'var(--burgundy)', color: 'var(--panel-cream)', padding: '36px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', color: 'var(--panel-cream)' }}>
              See how you'll<br /><em style={{ fontStyle: 'italic', color: 'var(--gold-text)' }}>discover</em> matches.
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(253,248,242,.75)', maxWidth: 420, fontFamily: 'var(--sans)', marginTop: 12 }}>
              A compatibility score, a verified badge, and the details families check first. Every real profile shows them. The photography here is illustrative, not real members.
            </p>
          </div>
          <div style={{ fontFamily: 'var(--display)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <AnimatePresence mode="wait">
              <motion.span key={matchIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ fontSize: 36, lineHeight: 1, color: 'var(--gold-text)', fontStyle: 'italic' }}>
                0{matchIdx + 1}
              </motion.span>
            </AnimatePresence>
            <span style={{ fontSize: 24, opacity: .55 }}>/ 0{discoverPhotos.length}</span>
          </div>
        </div>

        <div className="matches-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Feature panel — ambient photo, no identity overlay */}
          <motion.div key={matchIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 40px 80px -30px rgba(0,0,0,.5)',
              background: 'rgba(45,26,34,0.55)',
            }}>
            <div style={{ position: 'relative', width: '100%', height: 340, flexShrink: 0 }}>
              <img
                src={cur.src} alt={cur.alt} loading="lazy" decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 60%,rgba(0,0,0,.4))' }} />
              <AiTag entry={cur} style={{ bottom: 14, left: 14 }} />
            </div>
            {/* Details panel — describes what a real profile card shows, never a
                specific fabricated person. Checklist, not name-sized text, so
                this does not read as a real member listing with a disclaimer
                pasted underneath. */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <span style={{ fontFamily: 'var(--display)', fontSize: 'clamp(18px,2vw,24px)', lineHeight: 1.15, letterSpacing: '-.01em', color: 'var(--panel-cream)' }}>
                What a real profile shows
              </span>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
                {[
                  'A photo-verified badge, earned with a live selfie',
                  'A compatibility score across the signals families weigh',
                  'Community, city, education and profession, at a glance',
                ].map((line) => (
                  <li key={line} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5, color: 'rgba(253,248,242,.85)' }}>
                    <FiCheckCircle style={{ width: 15, height: 15, color: 'var(--gold-text)', flexShrink: 0, marginTop: 2 }} />
                    {line}
                  </li>
                ))}
              </ul>
              <Link to="/onboarding" style={{
                marginTop: 'auto',
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
                padding: '11px 20px', background: 'var(--panel-cream)', color: 'var(--burgundy)',
                borderRadius: 999, alignSelf: 'flex-start',
                transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease', textDecoration: 'none',
              }}
                onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--panel-ink)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--panel-cream)'; e.currentTarget.style.color = 'var(--burgundy)'; e.currentTarget.style.transform = ''; }}
              >Create your free profile →</Link>
            </div>
          </motion.div>

          {/* Side rail — a gallery of the same ambient photography, no
              per-thumbnail caption (one disclosure on the feature image
              already covers this set; repeating it at 56px would be the
              banner doctrine bans, not the quiet label it asks for). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {discoverPhotos.map((photo, i) => (
              <div key={i} className="ms-row"
                role="button" tabIndex={0} aria-pressed={matchIdx === i} aria-label={`Show photo ${i + 1} of ${discoverPhotos.length}`}
                onClick={() => setMatchIdx(i)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMatchIdx(i); } }}
                style={{
                  display: 'grid', gridTemplateColumns: '56px 1fr 20px', gap: 12, alignItems: 'center',
                  padding: '10px 12px', border: `1px solid ${matchIdx === i ? 'var(--gold)' : 'var(--line-on-dk)'}`,
                  borderRadius: 4, cursor: 'pointer',
                  background: matchIdx === i ? 'rgba(253,248,242,.06)' : 'transparent',
                  transition: 'border-color 160ms ease',
                }}
                onMouseEnter={e => { if (!canHover() || matchIdx === i) return; e.currentTarget.style.borderColor = 'var(--gold)'; }}
                onMouseLeave={e => { if (!canHover() || matchIdx === i) return; e.currentTarget.style.borderColor = 'var(--line-on-dk)'; }}
              >
                <div style={{ width: 56, height: 64, borderRadius: 4, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={photo.src} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .7 }}>Photo {i + 1}</span>
                <span style={{ color: 'var(--gold)', fontSize: 12 }}>{matchIdx === i ? '●' : '○'}</span>
              </div>
            ))}
            <Link to="/search" style={{
              marginTop: 'auto', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase',
              padding: 14, border: '1px solid var(--gold)', borderRadius: 999, textAlign: 'center',
              color: 'var(--panel-cream)', textDecoration: 'none', transition: 'background-color 160ms ease, color 160ms ease',
            }}
              onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--panel-ink)'; }}
              onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--panel-cream)'; }}
            >Browse real profiles →</Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          PROCESS — sticky scroll, rotating SVG dial
      ════════════════════════════════════════════════════════ */}
      {/* Mobile process — flat list, hidden on desktop */}
      <div className="process-steps-list" style={{ display: 'none' }}>
        <div style={{ padding: '0 0 24px', background: 'var(--cream-3)' }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,6vw,36px)', lineHeight: .96, letterSpacing: '-.025em' }}>
            From hello<br />to <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>forever.</em>
          </h2>
        </div>
        {processSteps.map((s, i) => (
          <div key={i} className="process-step-card">
            <div style={{ fontFamily: 'var(--display)', fontSize: 48, lineHeight: .8, color: 'var(--burgundy)', fontStyle: 'italic', marginBottom: 8 }}>{s.n}</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 22, lineHeight: 1.1, marginBottom: 8 }}>{s.t}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)', marginBottom: 12 }}>{s.b}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              {s.meta.map((m, j) => <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: 'var(--burgundy)', fontSize: 7 }}>◆</span>{m}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop process — was a `position: sticky` panel pinned for 150vh of
          scroll while `processActive` scrubbed with scroll progress. Ruling
          1 bans pinning/scroll-hijack/scrubbed-scroll outright, regardless
          of implementation technology, with no desktop exemption. Now an
          ordinary (non-sticky, non-oversized) section: the same dial + stage
          layout, but `processActive` only changes when a step is clicked —
          the four rows at the bottom of the stage panel are now the control,
          not just a read-out. */}
      <div className="process-outer" style={{ position: 'relative' }}>
        <div className="process-sticky" style={{
          display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 32,
          padding: '64px 40px', alignItems: 'center',
          background: 'var(--cream-3)',
          borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', marginBottom: 24 }}>
              From hello<br />to <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>forever.</em>
            </h2>
            <p style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
              Four steps, designed with intentionality, because finding a partner deserves more than an algorithm.
            </p>
            {/* Dial */}
            <div style={{ position: 'relative', width: 140, height: 140, marginTop: 24 }}>
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                <circle cx="100" cy="100" r="80" stroke="rgba(45,26,34,0.15)" strokeWidth="1" fill="none" />
                <circle cx="100" cy="100" r="80" stroke="var(--burgundy)" strokeWidth="2" fill="none"
                  strokeDasharray={`${(processActive + 1) / processSteps.length * 502} 502`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                  style={{ transition: 'stroke-dasharray 250ms var(--ease-in-out)' }}
                />
                {processSteps.map((_, i) => {
                  const a = (i / processSteps.length) * Math.PI * 2 - Math.PI / 2;
                  return (
                    <circle key={i}
                      cx={100 + 80 * Math.cos(a)} cy={100 + 80 * Math.sin(a)}
                      r={i <= processActive ? 6 : 4}
                      fill={i <= processActive ? 'var(--burgundy)' : 'var(--cream-2)'}
                      stroke="var(--burgundy)" strokeWidth="1"
                      style={{ transition: 'r 200ms ease, fill 200ms ease' }}
                    />
                  );
                })}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontSize: 52, lineHeight: 1, color: 'var(--burgundy)', fontStyle: 'italic' }}>
                <AnimatePresence mode="wait">
                  <motion.span key={processActive} initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .8 }}>
                    {curStep.n}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span style={{ position: 'absolute', left: '50%', bottom: -32, transform: 'translateX(-50%)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--mute)' }}>step</span>
            </div>
          </div>

          {/* Right — stage */}
          <div style={{ padding: 24, background: 'var(--cream)', borderRadius: 4, border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 300 }}>
            <AnimatePresence mode="wait">
              <motion.div key={processActive} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ display: 'contents' }}>
                <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(36px,4vw,64px)', lineHeight: .8, letterSpacing: '-.05em', color: 'var(--burgundy)', fontStyle: 'italic' }}>{curStep.n}</div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.8vw,40px)', lineHeight: 1.05, letterSpacing: '-.02em' }}>{curStep.t}</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', maxWidth: 480, fontFamily: 'var(--sans)' }}>{curStep.b}</div>
                <div style={{ display: 'flex', gap: 24, padding: '16px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
                  {curStep.meta.map((m, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--burgundy)', fontSize: 8 }}>◆</span>{m}
                    </span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {processSteps.map((s, i) => (
                <div key={i}
                  role="button" tabIndex={0} aria-current={i === processActive}
                  aria-label={`Show step ${i + 1}: ${s.t}`}
                  onClick={() => setProcessActive(i)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProcessActive(i); } }}
                  style={{
                    display: 'grid', gridTemplateColumns: '32px 1fr 60px', gap: 12,
                    alignItems: 'center', padding: '8px 0', cursor: 'pointer',
                    opacity: i === processActive ? 1 : i < processActive ? 0.85 : 0.7,
                    transition: 'opacity 200ms ease',
                  }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em' }}>0{i + 1}</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--sans)' }}>{s.t}</span>
                  <span style={{
                    height: 1, background: 'var(--burgundy)',
                    transformOrigin: 'left', transform: i <= processActive ? 'scaleX(1)' : 'scaleX(0)',
                    transition: 'transform 250ms var(--ease-in-out)',
                  }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CITIES — horizontal accordion strips with real images
      ════════════════════════════════════════════════════════ */}
      <section id="cities" className="cities-section section-dark" style={{ background: 'var(--panel-ink)', color: 'var(--panel-cream)' }}>
        <div style={{ padding: '48px 40px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'end' }}>
          <motion.div {...revealOnce}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', color: 'var(--panel-cream)' }}>
              Three cities.<br />One <em style={{ fontStyle: 'italic', color: 'var(--gold-text)' }}>community.</em>
            </h2>
          </motion.div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(253,248,242,.75)', maxWidth: 520, fontFamily: 'var(--sans)' }}>
            Hover a strip to expand. Mass-market apps don't understand what matters here: shared roots, family values, the comfort of proximity.
          </p>
        </div>

        <div style={{ display: 'flex', height: 360, borderTop: '1px solid var(--line-on-dk)' }}>
          {cities.map((c, i) => (
            <div key={i}
              className={`city-strip${activeCity === i ? ' active' : ''}`}
              role="button" tabIndex={0} aria-pressed={activeCity === i} aria-label={`Expand ${c.name}`}
              onMouseEnter={() => { if (canHover()) setActiveCity(i); }}
              onClick={() => setActiveCity(i)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveCity(i); } }}
              style={{
                flex: activeCity === i ? 3 : 1,
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
                borderRight: i < 2 ? '1px solid var(--line-on-dk)' : 'none',
              }}
            >
              {/* Ambient background image (doctrine ruling 15) */}
              <img src={c.image.src} alt={c.image.alt} className="city-bg" loading="lazy" decoding="async"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: activeCity === i ? 'scale(1)' : 'scale(1.05)' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: activeCity === i
                  ? 'linear-gradient(180deg,rgba(124,29,58,.4) 0%,rgba(45,26,34,.95) 100%)'
                  : 'linear-gradient(180deg,transparent 30%,rgba(45,26,34,.85))',
                transition: 'background 250ms ease',
              }} />
              <AiTag entry={c.image} style={{ bottom: 10, right: 10, zIndex: 2 }} />

              {/* Vertical label (collapsed) */}
              <div style={{
                position: 'absolute', left: 24, bottom: 24,
                transformOrigin: 'left bottom', transform: 'rotate(-90deg) translateY(0)',
                whiteSpace: 'nowrap', opacity: activeCity === i ? 0 : 1, transition: 'opacity 200ms ease', zIndex: 2,
              }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold-text)' }}>{c.tag}</span>
              </div>

              {/* Expanded content */}
              <div style={{
                position: 'absolute', inset: 0, padding: 28,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                opacity: activeCity === i ? 1 : 0, transition: 'opacity 250ms ease .12s', zIndex: 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold-text)' }}>{c.tag}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(253,248,242,.7)', textAlign: 'right' }}>Covered<br />from day one</span>
                </div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(32px,4vw,64px)', lineHeight: .9, letterSpacing: '-.025em', color: 'var(--panel-cream)' }}>{c.name}</div>
                <div className="city-content-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(253,248,242,.75)', maxWidth: 320, fontFamily: 'var(--sans)' }}>{c.desc}</p>
                  <Link to="/search" aria-label={`Browse ${c.name} profiles`} onFocus={() => setActiveCity(i)} style={{
                    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase',
                    padding: '10px 18px', border: '1px solid rgba(253,248,242,.4)', borderRadius: 999, color: 'var(--panel-cream)',
                    textDecoration: 'none', transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease', whiteSpace: 'nowrap',
                  }}
                    onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--panel-cream)'; e.currentTarget.style.color = 'var(--burgundy)'; e.currentTarget.style.borderColor = 'var(--panel-cream)'; }}
                    onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--panel-cream)'; e.currentTarget.style.borderColor = 'rgba(253,248,242,.4)'; }}
                  >Browse {c.name} →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          QUOTE — giant overlapping serif
      ════════════════════════════════════════════════════════ */}
      <section className="quote-section" style={{ background: 'var(--cream)', padding: '52px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <span style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-55%)',
          fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 'clamp(160px,22vw,320px)', lineHeight: .7,
          color: 'var(--burgundy)', opacity: .06, userSelect: 'none', pointerEvents: 'none',
        }}>"</span>
        <motion.div {...revealOnce} style={{ position: 'relative' }}>
          <p style={{ fontFamily: 'var(--display)', fontSize: 'clamp(28px,4vw,62px)', lineHeight: 1.05, letterSpacing: '-.02em', maxWidth: 1100, margin: '0 auto 56px' }}>
            The right match isn't a number<br />away. <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>They're a neighbourhood</em><br />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 24 }}>
              <span style={{ display: 'inline-block', width: 80, height: 2, background: 'var(--gold)' }} />away.
            </span>
          </p>
          <p className="quote-attribution" style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--mute)', display: 'inline-flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span>Founders, TricityMatch</span>
            <span className="dot" style={{ color: 'var(--burgundy)' }}>·</span>
            <span>Chandigarh</span>
            <span className="dot" style={{ color: 'var(--burgundy)' }}>·</span>
            <span>2026</span>
          </p>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════
          TRUST — burgundy tile grid
      ════════════════════════════════════════════════════════ */}
      <section id="trust" className="trust-section section-dark" style={{ background: 'var(--burgundy)', color: 'var(--panel-cream)', padding: '52px 40px' }}>
        <div className="trust-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'end', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', color: 'var(--panel-cream)' }}>
              Built on trust. Backed by <em style={{ fontStyle: 'italic', color: 'var(--gold-text)' }}>action.</em>
            </h2>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(253,248,242,.75)', maxWidth: 520, fontFamily: 'var(--sans)' }}>
            We don't just ask for trust. We earn it. Every feature is designed to protect your privacy, safety, and dignity.
          </p>
        </div>
        <div className="trust-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { n: '01', t: 'Photo verified',         b: 'Live selfie verification earns the verified badge.',        Icon: FiShield },
            { n: '02', t: 'Encrypted in transit',   b: 'Conversations are encrypted over the network and never shared.', Icon: FiLock },
            { n: '03', t: 'Human-moderated',        b: 'Safety team reviews flagged profiles daily.',               Icon: FiCheckCircle },
            { n: '04', t: 'Family approved',        b: 'Designed to include families, never pressure.',             Icon: FiUsers },
          ].map((it, i) => (
            <motion.div key={i}
              initial={revealOnce.initial}
              whileInView={{ ...revealOnce.whileInView, transition: { ...revealOnce.whileInView.transition, delay: staggerIndex(i) } }}
              viewport={revealOnce.viewport}
              style={{ padding: '20px 18px', border: '1px solid var(--line-on-dk)', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200, transition: 'border-color 160ms ease, transform 160ms ease', cursor: 'default' }}
              onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.borderColor = 'var(--line-on-dk)'; e.currentTarget.style.transform = ''; }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', color: 'rgba(253,248,242,.75)' }}>{it.n}</span>
              <it.Icon style={{ width: 36, height: 36, color: 'var(--gold)' }} />
              <h3 style={{ fontFamily: 'var(--display)', fontSize: 20, lineHeight: 1.1, letterSpacing: '-.01em', fontWeight: 400, marginTop: 'auto', color: 'var(--panel-cream)' }}>{it.t}</h3>
              <p style={{ fontSize: 13, color: 'rgba(253,248,242,.75)', lineHeight: 1.5, fontFamily: 'var(--sans)' }}>{it.b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          REFUND GUARANTEE — a real trust pillar, not a footer link.

          Shaadi treats a money-back guarantee as trust pillar #1; ours had a
          real, generous policy sitting only on /refund-policy where nobody
          reads it before paying. Terms below are verified against
          pages/RefundPolicy.jsx: 7 days, full refund, no justification
          needed, minus any contact unlocks already used. Asymmetric split
          per doctrine ruling 14 (only the page hero may center).
      ════════════════════════════════════════════════════════ */}
      <section className="refund-section" style={{ background: 'var(--cream)', padding: '52px 40px', borderTop: '1px solid var(--line)' }}>
        <div className="refund-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'center', maxWidth: 1280, margin: '0 auto' }}>
          <motion.div {...revealOnce}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', marginBottom: 20 }}>
              Try it. If it's not right,<br /><em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>get your money back.</em>
            </h2>
            <p style={{ maxWidth: 480, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', marginBottom: 24 }}>
              Ask within seven days of paying and we refund the membership in full, no justification needed. If you've already unlocked a few contacts, we deduct only what those unlocks cost.
            </p>
            <Link to="/refund-policy" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase',
              padding: '12px 20px', border: '1px solid var(--line)', borderRadius: 999,
              color: 'var(--ink)', textDecoration: 'none', transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
            }}
              onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--panel-cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
              onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
            >
              Read the refund policy <FiArrowRight />
            </Link>
          </motion.div>

          <div className="refund-pledges" style={{
            borderLeft: '1px solid var(--line)', paddingLeft: 40,
            display: 'flex', flexDirection: 'column', gap: 22,
          }}>
            {[
              ['Seven days, no argument', 'Full refund if you ask within a week of paying.'],
              ['Unlocks deducted at cost', 'Already viewed a few numbers? We deduct only what those unlocks cost, nothing more.'],
              ['Real problems, always refunded', 'A dropped feature, a broken service, a double charge: refunded at any point in your term.'],
            ].map(([title, body]) => (
              <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                <span aria-hidden="true" style={{ width: 22, height: 2, background: 'var(--burgundy)', flex: 'none', transform: 'translateY(-4px)' }} />
                <div>
                  <b style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, letterSpacing: '.02em', color: 'var(--ink)' }}>{title}</b>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          TESTIMONIALS — published success stories ONLY; hidden until one exists
      ════════════════════════════════════════════════════════ */}
      {stories.length > 0 && (
      <section className="testi-section" style={{ background: 'var(--cream)', padding: '56px 40px', overflow: 'hidden' }}>
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em' }}>
            Stories that<br />began <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>here.</em>
          </h2>
        </div>
        <div className="testi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          {/* Polaroid pile */}
          <div className="polaroid-pile" style={{ position: 'relative', height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {stories.map((s, i) => {
              const offset = i - storyIdx;
              return (
                <div key={i} className="polaroid"
                  style={{
                    position: 'absolute', width: 220,
                    background: 'var(--cream-3)', padding: '16px 16px 28px',
                    border: '1px solid var(--line)', boxShadow: '0 30px 80px -20px rgba(45,26,34,.25)',
                    transform: `translateX(${offset * 30}px) translateY(${Math.abs(offset) * 14}px) rotate(${offset * 4}deg)`,
                    zIndex: 10 - Math.abs(offset),
                    opacity: Math.abs(offset) > 2 ? 0 : 1,
                  }}>
                  <div style={{ aspectRatio: '4/5', position: 'relative', overflow: 'hidden' }}>
                    {s.img ? (
                      <img src={s.img} alt={s.who} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      /* No photo submitted with this real story — an
                         initials mark, never a stock photo standing in for a
                         named, consenting couple (docs/LEGAL_REVIEW_2026-09-17.md
                         A-19, doctrine ruling 15). */
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream-2)' }}>
                        <span style={{ fontFamily: 'var(--display)', fontSize: 40, fontStyle: 'italic', color: 'var(--burgundy)' }}>
                          {s.who ? s.who.split(/\s|&/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('') : ''}
                        </span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 60%,rgba(0,0,0,.4))' }} />
                    <span style={{ position: 'absolute', top: 16, left: 16, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(253,248,242,.85)', zIndex: 2 }}>{s.tag}</span>
                  </div>
                  <div style={{ padding: '16px 4px 0' }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 26, fontStyle: 'italic' }}>{s.who}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 4 }}>{s.where}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quote pane */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 80, lineHeight: .5, color: 'var(--burgundy)' }}>&ldquo;</span>
            <AnimatePresence mode="wait">
              <motion.p key={storyIdx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                style={{ fontFamily: 'var(--display)', fontSize: 'clamp(28px,3.6vw,48px)', lineHeight: 1.15, letterSpacing: '-.015em', color: 'var(--ink)' }}>
                {curStory.quote}
              </motion.p>
            </AnimatePresence>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 24, borderTop: '1px solid var(--line)', marginTop: 'auto' }}>
              <button className="story-nav-btn" onClick={() => setStoryIdx((storyIdx - 1 + stories.length) % stories.length)}
                style={{ width: 44, height: 44, border: '1px solid var(--line)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease', cursor: 'pointer', background: 'transparent', color: 'var(--ink)', fontSize: 14 }}
                aria-label="Previous story"
                onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--panel-cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
                onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >←</button>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em' }}>0{storyIdx + 1} / 0{stories.length}</span>
              <button className="story-nav-btn" onClick={() => setStoryIdx((storyIdx + 1) % stories.length)}
                style={{ width: 44, height: 44, border: '1px solid var(--line)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease', cursor: 'pointer', background: 'transparent', color: 'var(--ink)', fontSize: 14 }}
                aria-label="Next story"
                onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--panel-cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
                onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >→</button>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Parents-testimonials section removed 2026-08-09: its three named quotes were
          fabricated. It returns only when real family testimonials exist to publish. */}

      {/* ════════════════════════════════════════════════════════
          FAQ — sticky 2-col with hairline rules
      ════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ background: 'var(--cream)', padding: '64px 40px', display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 48, alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 80 }}>
          <motion.div {...revealOnce}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', marginBottom: 24 }}>
              Questions?<br />We've got <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>answers.</em>
            </h2>
            <p style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', marginBottom: 32 }}>
              If you don't find what you need, reach out. We respond within 24 hours, in English, Hindi or Punjabi.
            </p>
            <a href="mailto:support@tricitymatch.com" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase',
              padding: '12px 20px', border: '1px solid var(--line)', borderRadius: 999,
              color: 'var(--ink)', textDecoration: 'none', transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
            }}
              onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--panel-cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
              onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
            >
              <FiMessageCircle /> Contact support
            </a>
          </motion.div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)' }}>
          {faqs.map((it, i) => (
            <div key={i} className={`faq-row${faqOpen === i ? ' faq-item-open' : ''}`}
              role="button" tabIndex={0} aria-expanded={faqOpen === i} aria-controls={`faq-answer-${i}`}
              onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFaqOpen(faqOpen === i ? -1 : i); } }}
              style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 36px', gap: 16,
                padding: `24px ${faqOpen === i ? '24px' : '0'} 24px ${faqOpen === i ? '8px' : '0'}`,
                borderBottom: '1px solid var(--line)', cursor: 'pointer',
                transition: 'padding 160ms ease',
              }}
              onMouseEnter={e => { if (!canHover() || faqOpen === i) return; e.currentTarget.style.paddingLeft = '8px'; }}
              onMouseLeave={e => { if (!canHover() || faqOpen === i) return; e.currentTarget.style.paddingLeft = '0'; }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.16em', color: 'var(--burgundy)', paddingTop: 6 }}>0{i + 1}</span>
              <div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 20, lineHeight: 1.15, letterSpacing: '-.01em' }}>{it.q}</div>
                <div id={`faq-answer-${i}`} className="faq-a" style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>{it.a}</div>
              </div>
              <div className="faq-toggle" style={{
                width: 36, height: 36, border: '1px solid var(--line)', borderRadius: '50%',
                position: 'relative', transition: 'background-color 160ms ease, border-color 160ms ease, transform 200ms var(--ease-out)',
                background: faqOpen === i ? 'var(--burgundy)' : 'transparent',
                borderColor: faqOpen === i ? 'var(--burgundy)' : 'var(--line)',
              }} />
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          CTA — burgundy with drifting orbs
      ════════════════════════════════════════════════════════ */}
      <section className="cta-section section-dark" style={{ background: 'var(--burgundy)', color: 'var(--panel-cream)', padding: '56px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Orbs — settled at their resting position; the perpetual drift is
            gone (doctrine §2 ruling 7: no idle loop with no semantic
            exemption). Still ambient blurred-color depth, just not breathing
            forever. */}
        {[
          { w: 600, h: 600, color: 'rgba(184,149,42,.5)',   top: '-200px', left: '0' },
          { w: 700, h: 700, color: 'rgba(124,29,58,.7)',    bottom: '-300px', right: '0' },
          { w: 400, h: 400, color: 'rgba(253,248,242,.15)', top: '40%', left: '40%' },
        ].map((o, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%', filter: 'blur(60px)',
            width: o.w, height: o.h,
            background: `radial-gradient(circle, ${o.color}, transparent 70%)`,
            top: o.top, left: o.left, bottom: o.bottom, right: o.right,
            pointerEvents: 'none',
          }} />
        ))}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div {...revealOnce}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.8vw,44px)', lineHeight: .92, letterSpacing: '-.025em', marginBottom: 32 }}>
              Every great<br />love story<br />starts with <em style={{ fontStyle: 'italic', color: 'var(--gold-text)' }}>one step.</em>
            </h2>
            <p style={{ maxWidth: 540, margin: '0 auto 32px', fontSize: 14, lineHeight: 1.5, color: 'rgba(253,248,242,.82)', fontFamily: 'var(--sans)' }}>
              Start where the families you'd actually meet are already looking. Free to start.
            </p>
            <div style={{ display: 'inline-flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}>
              <Link to="/onboarding" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 28px', borderRadius: 999,
                background: 'var(--panel-cream)', color: 'var(--burgundy)',
                fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', textDecoration: 'none',
                transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease',
              }}
                onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--panel-ink)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--panel-cream)'; e.currentTarget.style.color = 'var(--burgundy)'; e.currentTarget.style.transform = ''; }}
              >Create profile · Free <FiArrowRight /></Link>
              <Link to="/search" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 28px', borderRadius: 999,
                border: '1px solid rgba(253,248,242,.35)', color: 'var(--panel-cream)',
                fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', textDecoration: 'none',
                transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
              }}
                onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--panel-cream)'; e.currentTarget.style.color = 'var(--burgundy)'; e.currentTarget.style.borderColor = 'var(--panel-cream)'; }}
                onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--panel-cream)'; e.currentTarget.style.borderColor = 'rgba(253,248,242,.35)'; }}
              >Browse profiles</Link>
            </div>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(253,248,242,.55)' }}>
              No credit card · 12-min setup · Verified in hours
            </p>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FOOTER — mega wordmark + grid
      ════════════════════════════════════════════════════════ */}
      <footer style={{ background: 'var(--panel-ink)', color: 'var(--panel-cream)', paddingBottom: 40, overflow: 'hidden' }}>
        {/* Mega wordmark */}
        <div className="footer-mega-inner" style={{ padding: '36px 48px 24px', borderBottom: '1px solid var(--line-on-dk)' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(36px,7vw,100px)', lineHeight: .85, letterSpacing: '-.04em', color: 'var(--panel-cream)' }}>
            TricityMatch
          </div>
        </div>

        {/* Grid */}
        <div className="footer-grid-inner" style={{ padding: '36px 48px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 36, borderBottom: '1px solid var(--line-on-dk)' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold-text)', marginBottom: 20 }}>Chandigarh · Mohali · Panchkula</div>
            <p style={{ fontSize: 14, color: 'rgba(253,248,242,.7)', lineHeight: 1.55, maxWidth: 320, fontFamily: 'var(--sans)', marginBottom: 24 }}>
              Tricity's own matrimonial platform. Connecting families through verified profiles and intelligent matching.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { icon: <FaInstagram />, label: 'Instagram', href: 'https://www.instagram.com/tricitymatch' },
                { icon: <FaFacebook />, label: 'Facebook', href: 'https://www.facebook.com/tricitymatch' },
                // WhatsApp only renders when a real number is configured —
                // the old hardcoded link opened a chat with nobody.
                ...(support.whatsapp ? [{ icon: <FaWhatsapp />, label: 'WhatsApp', href: `https://wa.me/${support.whatsapp}` }] : []),
                { icon: <FaTwitter />, label: 'Twitter', href: 'https://twitter.com/tricitymatch' },
              ].map(s => (
                <a key={s.label} className="social-icon" href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  style={{ width: 44, height: 44, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line-on-dk)', color: 'rgba(253,248,242,.5)', transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease', textDecoration: 'none' }}
                  onMouseEnter={e => { if (!canHover()) return; e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--panel-cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
                  onMouseLeave={e => { if (!canHover()) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(253,248,242,.5)'; e.currentTarget.style.borderColor = 'var(--line-on-dk)'; }}
                >{s.icon}</a>
              ))}
            </div>
          </div>
          {[
            /* Doctrine §7: sentence case for headings/buttons, not Title Case.
               These five were the file's one drift from that rule. */
            { title: 'Platform', links: [['Browse profiles', '/search'], ['How it works', '/#why'], ['Pricing plans', '/subscription'], ['Success stories', '/#stories'], ['Create profile', '/onboarding']] },
            // Cities: the crawl path into the city landing pages. Without a real
            // internal link, /matrimony/* is sitemap-only — discoverable in
            // theory, orphaned in practice.
            { title: 'Cities',   links: [['Matrimony in Chandigarh', '/matrimony/chandigarh'], ['Matrimony in Mohali', '/matrimony/mohali'], ['Matrimony in Panchkula', '/matrimony/panchkula']] },
            { title: 'Company',  links: [['About Us', '/about'], ['Contact', '/contact'], ['Safety centre', '/safety'], ['Privacy policy', '/privacy'], ['Terms of service', '/terms'], ['Refunds', '/refund-policy']] },
            // Phone and address are config-gated for the same reason as WhatsApp:
            // a placeholder number in the footer is worse than no number.
            { title: 'Contact',  links: [
              [support.email, null],
              ...(support.phone ? [[support.phone, null]] : []),
              ...(support.address ? [[support.address, null]] : []),
              ['Help centre', '/help'],
            ] },
          ].map(col => (
            <div key={col.title}>
              <h3 style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold-text)', fontWeight: 500, marginBottom: 20 }}>{col.title}</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    {to ? (
                      <Link to={to} style={{ fontSize: 14, color: 'rgba(253,248,242,.85)', textDecoration: 'none', transition: 'color 160ms ease, padding-left 160ms ease', display: 'flex', alignItems: 'center', minHeight: 44, padding: '7px 0', fontFamily: 'var(--sans)' }}
                        onMouseEnter={e => { if (!canHover()) return; e.target.style.color = 'var(--gold)'; e.target.style.paddingLeft = '6px'; }}
                        onMouseLeave={e => { if (!canHover()) return; e.target.style.color = 'rgba(253,248,242,.85)'; e.target.style.paddingLeft = '0'; }}
                      >{label}</Link>
                    ) : (
                      <span style={{ fontSize: 14, color: 'rgba(253,248,242,.85)', fontFamily: 'var(--sans)', display: 'block', padding: '7px 0' }}>{label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom-inner" style={{ padding: '16px 48px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(253,248,242,.5)', flexWrap: 'wrap', gap: 16 }}>
          <span>© 2026 TricityMatch · All rights reserved</span>
          <span>
            Developed by{' '}
            <a
              href="https://www.globoniks.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgba(253,248,242,.8)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Globoniks
            </a>
          </span>
          <span>Made with care in Chandigarh</span>
          {/* Static dot — the perpetual pulse is gone (doctrine §2 ruling 7:
              no idle loop with no semantic exemption). */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            All systems operational
          </span>
        </div>
      </footer>

      <StickyCTA heroRef={heroRef} />
    </div>
  );
};

/* ── NAV ───────────────────────────────────────────────────────── */

export default Home;
