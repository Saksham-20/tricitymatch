import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Logo from '../components/common/Logo';
import {
  FiShield, FiCheckCircle, FiHeart, FiArrowRight, FiStar, FiUsers,
  FiMessageCircle, FiLock, FiMapPin, FiBookmark, FiChevronRight,
  FiChevronLeft, FiUser, FiX, FiZap, FiEye, FiPhone,
} from 'react-icons/fi';
import { FaInstagram, FaFacebook, FaTwitter, FaWhatsapp } from 'react-icons/fa';

/* ── FONT LOADER ─────────────────────────────────────────────── */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter+Tight:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --burgundy: #7C1D3A;
      --burgundy-dk: #5C1229;
      --burgundy-lt: #9B2248;
      --cream: #FDF8F2;
      --cream-2: #F5EDE0;
      --cream-3: #FFFAF6;
      --ink: #2D1A22;
      --ink-soft: #4A3B30;
      --gold: #B8952A;
      --gold-lt: #F0D080;
      --mute: rgba(45,26,34,0.65);
      --line: rgba(45,26,34,0.14);
      --line-on-dk: rgba(253,248,242,0.22);
      --display: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
      --serif: 'Cormorant Garamond', Georgia, serif;
      --sans: 'Inter Tight', -apple-system, system-ui, sans-serif;
      --mono: 'JetBrains Mono', ui-monospace, monospace;
    }

    .ht-display { font-family: var(--display) !important; }
    .ht-serif   { font-family: var(--serif) !important; }
    .ht-sans    { font-family: var(--sans) !important; }
    .ht-mono    { font-family: var(--mono) !important; }

    /* ── Custom cursor ── */
    body { cursor: none; overflow-x: hidden; }
    @media (max-width: 900px) { body { cursor: auto; } }
    .cur-dot, .cur-ring {
      position: fixed; pointer-events: none; z-index: 9999;
      top: 0; left: 0; transform: translate(-50%,-50%); will-change: transform;
    }
    .cur-dot {
      width: 6px; height: 6px; background: var(--burgundy); border-radius: 50%;
      transition: width .2s, height .2s, background .2s;
    }
    .cur-ring {
      width: 36px; height: 36px; border: 1px solid var(--burgundy); border-radius: 50%;
      transition: width .25s cubic-bezier(.2,.8,.2,1), height .25s, opacity .2s, border-color .2s;
    }
    body.cur-dk .cur-dot  { background: var(--cream); }
    body.cur-dk .cur-ring { border-color: var(--cream); }
    body.cur-hov .cur-ring { width: 64px; height: 64px; background: rgba(124,29,58,.08); }
    @media (max-width: 900px) { .cur-dot, .cur-ring { display: none; } }

    /* ── Scroll progress bar ── */
    .scroll-bar {
      position: fixed; top: 0; left: 0; height: 2px; z-index: 200;
      background: linear-gradient(90deg, var(--burgundy), var(--gold));
      transform-origin: left;
    }

    /* ── Ribbon marquee ── */
    @keyframes scrollx { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
    .ribbon-track { animation: scrollx 60s linear infinite; }

    /* ── Hero stack animations ── */
    @keyframes rise { from { opacity:0; transform: translateY(60px); } to { opacity:1; transform: translateY(0); } }
    @keyframes drawline { to { transform: scaleX(1); } }
    @keyframes pulse { 0%,100%{ transform:scale(1); opacity:1; } 50%{ transform:scale(1.4); opacity:.4; } }
    @keyframes drift-back { 0%,100%{ transform: rotate(-8deg) translateY(40px) translateX(-30px); } 50%{ transform: rotate(-10deg) translateY(50px) translateX(-40px); } }
    @keyframes drift-mid  { 0%,100%{ transform: rotate(4deg) translateY(20px) translateX(20px); }  50%{ transform: rotate(6deg) translateY(10px) translateX(30px); } }
    @keyframes drift-front{ 0%,100%{ transform: rotate(-2deg) translateY(0); } 50%{ transform: rotate(-3deg) translateY(-10px); } }
    @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(80px, 60px); } }
    @keyframes count-up-in { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }

    /* ── WHY horizontal scroll ── */
    .why-scroller { scrollbar-width: none; scroll-snap-type: x mandatory; }
    .why-scroller::-webkit-scrollbar { display: none; }

    /* ── Cities accordion ── */
    .city-strip { transition: flex .8s cubic-bezier(.2,.8,.2,1); }
    .city-bg { transition: transform .8s; }
    .city-strip.active .city-bg { transform: scale(1) !important; }

    /* ── Polaroid ── */
    .polaroid { transition: transform .8s cubic-bezier(.2,.8,.2,1), opacity .5s; }

    /* ── Global scale-down ── */
    html { font-size: 14px; }

    /* ── Responsive overrides ── */
    @media (max-width: 1000px) {
      .hero-section { grid-template-columns: 1fr !important; }
      .hero-section > div:nth-child(2) { padding: 48px 24px 56px !important; }
      .hero-section > div:nth-child(3) { padding: 24px 24px 64px !important; display: flex !important; justify-content: center !important; }
      #why { grid-template-columns: 1fr !important; }
      #why > div:first-child { position: static !important; padding: 0 24px 32px !important; }
      #why > div:last-child { padding: 0 24px 24px !important; }
      .matches-section { padding: 48px 24px !important; }
      .matches-section > div:last-child { grid-template-columns: 1fr !important; }
      .cities-section > div:first-child { grid-template-columns: 1fr !important; padding: 60px 24px !important; }
      .cities-section > div:last-child { flex-direction: column !important; height: auto !important; }
      .cities-section > div:last-child > div { flex: 1 !important; min-height: 320px !important; border-right: none !important; border-bottom: 1px solid var(--line-on-dk) !important; }
      .cities-section > div:last-child > div > div:nth-child(2) { display: none !important; }
      .cities-section > div:last-child > div > div:nth-child(3) { opacity: 1 !important; padding: 32px 24px !important; }
    }
    @media (max-width: 900px) {
      nav .nav-links-wrap { display: none !important; }
      nav { padding: 16px 20px !important; }
      #trust > div:first-child { grid-template-columns: 1fr !important; }
      #trust > div:last-child { grid-template-columns: 1fr 1fr !important; }
      .testi-grid { grid-template-columns: 1fr !important; }
      #faq { grid-template-columns: 1fr !important; padding: 80px 24px !important; }
      #faq > div:first-child { position: static !important; }
      .footer-grid-inner { grid-template-columns: 1fr 1fr !important; padding: 40px 24px !important; }
      .footer-mega-inner { padding: 40px 24px 24px !important; }
      .footer-bottom-inner { padding: 24px 24px 0 !important; }
    }

    /* ── FAQ toggle ── */
    .faq-toggle::before, .faq-toggle::after {
      content:""; position:absolute; top:50%; left:50%;
      background: var(--ink); transition: transform .4s, background .3s;
    }
    .faq-toggle::before { width:12px; height:1px; transform: translate(-50%,-50%); }
    .faq-toggle::after  { width:1px; height:12px; transform: translate(-50%,-50%); }
    .faq-item-open .faq-toggle { background: var(--burgundy); border-color: var(--burgundy); transform: rotate(180deg); }
    .faq-item-open .faq-toggle::before,
    .faq-item-open .faq-toggle::after { background: var(--cream); }
    .faq-item-open .faq-toggle::after { transform: translate(-50%,-50%) rotate(90deg); }
    .faq-a { max-height: 0; overflow: hidden; opacity: 0; transition: max-height .5s, opacity .4s, margin-top .3s; }
    .faq-item-open .faq-a { max-height: 240px; opacity: 1; margin-top: 12px; }
  `}</style>
);

/* ── CURSOR ──────────────────────────────────────────────────── */
function Cursor() {
  useEffect(() => {
    const dot  = document.querySelector('.cur-dot');
    const ring = document.querySelector('.cur-ring');
    if (!dot || !ring) return;
    let mx = 0, my = 0, rx = 0, ry = 0;
    const onMove = (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    };
    const tick = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove);
    tick();
    const addHov = (sel) => document.querySelectorAll(sel).forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cur-hov'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cur-hov'));
    });
    const addDk = (sel) => document.querySelectorAll(sel).forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cur-dk'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cur-dk'));
    });
    addHov('a, button, .why-tile, .city-strip, .faq-row, .ms-row, .tilt-card');
    addDk('.section-dark, .ribbon-band, .matches-section, .cities-section, .cta-section, footer');
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  return (
    <>
      <div className="cur-ring" />
      <div className="cur-dot" />
    </>
  );
}

/* ── COUNT UP ─────────────────────────────────────────────────── */
const CountUp = ({ to, suffix = '', duration = 1800 }) => {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.floor(to * eased));
      if (t < 1) requestAnimationFrame(tick); else setN(to);
    };
    requestAnimationFrame(tick);
  }, [inView, to, duration]);
  return <span ref={ref}>{n >= 1000 ? n.toLocaleString('en-IN') : n}<span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>{suffix}</span></span>;
};

/* ── HOME ─────────────────────────────────────────────────────── */
const Home = () => {
  const [activeCity, setActiveCity]       = useState(0);
  const [matchIdx, setMatchIdx]           = useState(0);
  const [processActive, setProcessActive] = useState(0);
  const [storyIdx, setStoryIdx]           = useState(0);
  const [faqOpen, setFaqOpen]             = useState(-1);
  const [announcementOn, setAnnouncementOn] = useState(true);
  const [liveIdx, setLiveIdx]             = useState(0);

  const { scrollYProgress } = useScroll();
  const progressScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  /* live match ticker */
  const liveMatches = [
    { who: 'Priya & Arjun',   where: 'Mohali',      pct: 97 },
    { who: 'Simran & Karan',  where: 'Chandigarh',  pct: 95 },
    { who: 'Anjali & Rohan',  where: 'Panchkula',   pct: 93 },
    { who: 'Meera & Vikram',  where: 'Panchkula',   pct: 96 },
  ];
  useEffect(() => {
    const t = setInterval(() => setLiveIdx(i => (i + 1) % liveMatches.length), 3200);
    return () => clearInterval(t);
  }, []);

  /* process scroll tracking */
  const processRef = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      const sec = processRef.current;
      if (!sec) return;
      const r = sec.getBoundingClientRect();
      const total = sec.offsetHeight - window.innerHeight;
      const scrolled = -r.top;
      const p = Math.max(0, Math.min(1, scrolled / total));
      setProcessActive(Math.min(3, Math.floor(p * 4)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* story auto-advance */
  useEffect(() => {
    const t = setInterval(() => setStoryIdx(i => (i + 1) % 3), 6000);
    return () => clearInterval(t);
  }, []);

  /* why-scroller progress bar */
  useEffect(() => {
    const scroller = document.getElementById('why-scroller');
    const bar      = document.getElementById('why-bar');
    if (!scroller || !bar) return;
    const onScroll = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      bar.style.width = (max > 0 ? (scroller.scrollLeft / max) * 100 : 0) + '%';
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  /* ── DATA ── */
  const profiles = [
    { name: 'Priya Sharma', age: 28, loc: 'Mohali',      tags: ['MBA · IIM', 'Family-first', 'Travel', 'Sufi'], match: 97, img: '/images/landing/profile-priya.jpg',  grad: 'linear-gradient(140deg,#C9B5A6,#6E574B)' },
    { name: 'Rahul Gupta',  age: 31, loc: 'Chandigarh',  tags: ['IIT', 'Founder', 'Trekking', 'Cinema'],        match: 95, img: '/images/landing/profile-rahul.jpg',  grad: 'linear-gradient(160deg,#8B7568,#3A2F28)' },
    { name: 'Anjali Nair',  age: 29, loc: 'Panchkula',   tags: ['Doctor · AIIMS', 'Spiritual', 'Reading'],      match: 93, img: '/images/landing/profile-anjali.jpg', grad: 'linear-gradient(150deg,#B59C82,#5C4B40)' },
    { name: 'Karan Bedi',   age: 30, loc: 'Chandigarh',  tags: ['CA', 'Cinephile', 'Cycling'],                  match: 91, img: '/images/landing/profile-karan.jpg',  grad: 'linear-gradient(170deg,#A28D78,#4A3D34)' },
    { name: 'Meera Kapoor', age: 27, loc: 'Panchkula',   tags: ['Design lead', 'Family-first', 'Yoga'],         match: 94, img: '/images/landing/profile-meera.jpg',  grad: 'linear-gradient(155deg,#BFA98E,#594336)' },
  ];

  const processSteps = [
    { n: '01', t: 'Create your profile',    b: 'Build a verified, detailed profile that reflects who you truly are. Government ID check completes within hours.',       meta: ['~12 min', 'ID verified', 'Free'] },
    { n: '02', t: 'Discover matches',       b: 'Our AI surfaces compatible profiles across 40+ signals. You stay in full control of who sees you.',                    meta: ['AI ranked', '40+ signals', 'Daily refresh'] },
    { n: '03', t: 'Connect securely',       b: 'Every conversation is end-to-end encrypted. Express interest, chat, and bring family in when ready.',                  meta: ['E2E encrypted', 'Read receipts', 'No phone reveal'] },
    { n: '04', t: 'Begin your journey',     b: 'Meet in person with confidence. We\'ve done the groundwork on verification and compatibility.',                        meta: ['Verified meet', 'Family flow', 'Lifelong support'] },
  ];

  const cities = [
    { tag: 'City Beautiful',       name: 'Chandigarh', count: '28K', desc: 'India\'s most planned city. Cosmopolitan, career-forward — and deeply family-rooted.',         img: '/images/landing/city-chandigarh.jpg' },
    { tag: "Punjab's Rising Star", name: 'Mohali',     count: '14K', desc: 'Tech parks, AIIMS, IIT. Young professionals building careers without leaving culture.',         img: '/images/landing/city-mohali.jpg' },
    { tag: 'Roots Run Deep',       name: 'Panchkula',  count: '8K',  desc: 'Quiet, established, close-knit. Tradition and aspiration in equal measure.',                   img: '/images/landing/city-panchkula.jpg' },
  ];

  const stories = [
    { quote: 'From the first message to our engagement, everything felt intentional. This platform respects both families.', who: 'Meera & Vikram', where: 'Panchkula · Married Sept 2024', tag: 'Story 042', img: '/images/landing/story-meera-vikram.jpg' },
    { quote: 'We met because of compatibility, not luck. Six months later, our families knew it was right.',                 who: 'Priya & Arjun',   where: 'Mohali · Married March 2025', tag: 'Story 067', img: '/images/landing/story-priya-arjun.jpg' },
    { quote: 'The Incognito mode let me take my time. When I was ready, my family stepped in beautifully.',                 who: 'Anjali & Rohan',  where: 'Chandigarh · Engaged 2025',  tag: 'Story 091', img: '/images/landing/story-anjali-rohan.jpg' },
  ];

  const faqs = [
    { q: 'Only Tricity residents?',              a: 'Yes — every profile is from Chandigarh, Mohali, or Panchkula, or has direct family ties to the region. Hyperlocal is the point.' },
    { q: 'How does ID verification work?',       a: 'Government ID (Aadhaar, PAN, Driving Licence, Passport) is verified before a profile goes live. Usually within hours.' },
    { q: 'Can I browse without an account?',     a: 'Preview a small selection without an account. Full profiles, photos, and chat require a verified account.' },
    { q: 'Premium vs VIP?',                      a: 'Premium: unlimited messaging, advanced filters, Incognito mode. VIP adds a relationship manager and curated weekly hand-picked matches.' },
    { q: 'Is my data private?',                  a: 'Yes. End-to-end encrypted conversations. We never share your phone number, never sell data, never display you to non-mutual interests.' },
    { q: 'Can families participate?',             a: 'Yes — gracefully. You choose when. They get their own view and chat channel kept respectfully separate from yours.' },
  ];

  const whyCards = [
    { tag: '01 / Security',   title: 'Government ID, every profile',    body: 'Strict government ID verification before going live. Zero fake accounts. Zero exceptions.',             glyph: '◉' },
    { tag: '02 / Technology', title: 'AI matching, 40+ signals',        body: 'Values, lifestyle, family expectations — far beyond age and location.',                                  glyph: '◇' },
    { tag: '03 / Hyperlocal', title: 'Built only for the Tricity',      body: 'Made for Chandigarh, Mohali, Panchkula. Meet partners from your community.',                            glyph: '▣' },
    { tag: '04 / Privacy',    title: 'Incognito browsing',              body: 'Browse privately. Appear only to those you\'ve expressed interest in.',                                  glyph: '◐' },
    { tag: '05 / Comms',      title: 'Encrypted conversations',         body: 'End-to-end encryption with read receipts. Phone numbers stay hidden.',                                   glyph: '▲' },
    { tag: '06 / Values',     title: 'Family-aware flow',               body: 'Bring family in at the right moment. Respect, not pressure.',                                            glyph: '✦' },
  ];

  const cur       = profiles[matchIdx];
  const curLive   = liveMatches[liveIdx];
  const curStep   = processSteps[processActive];
  const curStory  = stories[storyIdx];

  /* ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ background: 'var(--cream)', fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <FontLoader />
      <Cursor />

      {/* ── SCROLL BAR ── */}
      <motion.div className="scroll-bar" style={{ scaleX: progressScaleX }} />

      {/* ── ANNOUNCEMENT ── */}
      <AnimatePresence>
        {announcementOn && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ background: 'var(--burgundy)', color: 'var(--cream)', fontSize: 13, overflow: 'hidden', position: 'relative', zIndex: 40 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '10px 40px', fontFamily: 'var(--sans)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold-lt)', animation: 'pulse 1.6s ease-in-out infinite', flexShrink: 0 }} />
              <p><span style={{ fontWeight: 600, color: 'var(--gold-lt)' }}>Limited time:</span> First month Premium free for Chandigarh residents.{' '}
                <Link to="/onboarding" style={{ textDecoration: 'underline', fontWeight: 600 }}>Claim now</Link>
              </p>
              <button onClick={() => setAnnouncementOn(false)} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }} aria-label="Dismiss">
                <FiX style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════
          HERO — asymmetric split: monumental title left, fanned photo stack right
      ════════════════════════════════════════════════════════ */}
      <section style={{
        minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr',
        paddingTop: 64, position: 'relative'
      }} className="hero-section">

        {/* LEFT */}
        <div style={{ padding: '28px 28px 48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)', display: 'flex', gap: 10 }}>
            <span>Vol. 01</span><span>·</span><span>Spring 2026</span>
          </div>

          {/* Monumental stacked title */}
          <div style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(30px, 4vw, 64px)',
            lineHeight: 0.92,
            letterSpacing: '-0.035em',
            display: 'flex', flexDirection: 'column',
            margin: '20px 0',
          }}>
            {[
              { text: 'where',                  style: { color: 'var(--ink)', animationDelay: '.1s' } },
              { text: <>every <em style={{ color: 'var(--burgundy)', fontStyle: 'italic' }}>love</em></>, style: { paddingLeft: '1.2em', animationDelay: '.25s' } },
              { text: 'story',                  style: { color: 'var(--ink)', animationDelay: '.4s' } },
              { text: <><em style={{ fontStyle: 'italic' }}>begins</em>.</>, style: { color: 'var(--burgundy)', paddingLeft: '2em', animationDelay: '.55s', position: 'relative' } },
            ].map((line, i) => (
              <span key={i} style={{
                display: 'inline-block',
                animation: `rise 1.2s cubic-bezier(.2,.8,.2,1) ${line.style.animationDelay || '0s'} both`,
                ...line.style,
              }}>{line.text}</span>
            ))}
          </div>

          {/* Gold underline on "begins" — drawn via pseudo (handled inline) */}

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 24,
            alignItems: 'end', paddingTop: 24,
            borderTop: '1px solid var(--line)',
            animation: 'rise 1.2s 0.9s both',
          }}>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', maxWidth: 420, fontFamily: 'var(--sans)' }}>
              Tricity's most trusted matrimony — for Chandigarh, Mohali and Panchkula. Verified, intelligent, deeply local.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
              <Link to="/onboarding" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 28px', borderRadius: 999,
                background: 'var(--burgundy)', color: 'var(--cream)',
                fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)',
                transition: 'all .3s cubic-bezier(.2,.8,.2,1)',
                textDecoration: 'none',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--burgundy-dk)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 40px -12px rgba(124,29,58,.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >Create free profile <FiArrowRight /></Link>
              <a href="#why" style={{
                display: 'inline-flex', gap: 8, alignItems: 'center',
                fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase',
                padding: '14px 0', borderBottom: '1px solid var(--ink)',
                color: 'var(--ink)', textDecoration: 'none',
                transition: 'gap .3s',
              }}
                onMouseEnter={e => e.currentTarget.style.gap = '14px'}
                onMouseLeave={e => e.currentTarget.style.gap = '8px'}
              >How it works <span>↓</span></a>
            </div>
          </div>
        </div>

        {/* RIGHT — fanned photo stack */}
        <div style={{ position: 'relative', padding: '0 36px 80px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 240, aspectRatio: '3/4' }}>
            {/* Back card */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden',
              boxShadow: '0 30px 80px -20px rgba(45,26,34,.35)',
              background: 'linear-gradient(140deg,#C9B5A6,#6E574B)',
              animation: 'drift-back 8s ease-in-out infinite',
            }}>
              <img src="/images/landing/profile-anjali.jpg" alt="Anjali Nair" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.45))' }} />
              <span style={{ position: 'absolute', bottom: 16, left: 16, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(253,248,242,.85)', zIndex: 3 }}>Anjali, 29 · Panchkula</span>
            </div>
            {/* Mid card */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden',
              boxShadow: '0 30px 80px -20px rgba(45,26,34,.35)',
              background: 'linear-gradient(160deg,#B59C82,#5C4B40)',
              animation: 'drift-mid 10s ease-in-out infinite',
            }}>
              <img src="/images/landing/profile-rahul.jpg" alt="Rahul Gupta" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.45))' }} />
              <span style={{ position: 'absolute', bottom: 16, left: 16, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(253,248,242,.85)', zIndex: 3 }}>Rahul, 31 · Chandigarh</span>
            </div>
            {/* Front card — with real image */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden',
              boxShadow: '0 30px 80px -20px rgba(45,26,34,.35)',
              animation: 'drift-front 12s ease-in-out infinite',
              zIndex: 2,
            }}>
              <img src="/images/landing/profile-priya.jpg" alt="Priya Sharma" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 50%,rgba(0,0,0,.55))' }} />
              <span style={{ position: 'absolute', top: 14, right: 14, fontFamily: 'var(--display)', fontSize: 36, lineHeight: 1, color: 'var(--cream)', zIndex: 3, fontStyle: 'italic' }}>97<small style={{ fontSize: 16, opacity: .7 }}>%</small></span>
              <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 3, color: 'var(--cream)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontFamily: 'var(--display)', fontSize: 28, fontWeight: 400, letterSpacing: '-.01em' }}>Priya Sharma, 28</strong>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .85 }}>Mohali · MBA · Family-first</span>
              </div>
            </div>
          </div>

          {/* Live match pill */}
          <div style={{
            position: 'absolute', bottom: -28, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--cream-3)', border: '1px solid var(--line)',
            padding: '10px 18px', borderRadius: 999,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
            boxShadow: '0 14px 36px -14px rgba(45,26,34,.18)', zIndex: 5,
            animation: 'rise 1s 1.5s both', whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 8, height: 8, background: 'var(--burgundy)', borderRadius: '50%', animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>Just matched</span>
            <AnimatePresence mode="wait">
              <motion.span key={liveIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                style={{ fontFamily: 'var(--display)', fontSize: 16, fontStyle: 'italic' }}>
                {curLive.who} · {curLive.where} · {curLive.pct}%
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Rotating badge */}
          <div style={{ position: 'absolute', top: 20, right: 24, width: 110, height: 110, animation: 'spin 30s linear infinite' }}>
            <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
              <defs>
                <path id="circ" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
              </defs>
              <text fontFamily="JetBrains Mono" fontSize="11" letterSpacing="4" fill="var(--burgundy-dk)">
                <textPath href="#circ">VERIFIED · MATCHED · CONNECTED · IN TRICITY · VERIFIED · MATCHED · CONNECTED · </textPath>
              </text>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--burgundy)', fontSize: 18 }}>✦</div>
          </div>
        </div>

        {/* Baseline strip */}
        <div style={{
          gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
          color: 'var(--ink-soft)', padding: '12px 40px', borderTop: '1px solid var(--line)',
        }}>
          {['Est. 2011', '1,190+ matches', '50K+ verified', '15 years'].map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ width: 24, height: 1, background: 'var(--mute)', opacity: .4, flexShrink: 0 }} />}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          RIBBON — scrolling marquee
      ════════════════════════════════════════════════════════ */}
      <div className="ribbon-band section-dark" style={{
        background: 'var(--burgundy)', color: 'var(--cream)',
        padding: '14px 0', overflow: 'hidden',
        borderTop: '1px solid var(--line-on-dk)', borderBottom: '1px solid var(--line-on-dk)',
      }}>
        <div className="ribbon-track" style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', fontFamily: 'var(--display)', fontSize: 22, fontStyle: 'italic', letterSpacing: '-.01em' }}>
          {[...Array(3)].map((_, rep) => (
            ['Verified profiles', 'AI-matched', 'Family-first', 'Hyperlocal', 'End-to-end encrypted', 'Since 2011', 'Tricity built', 'Privacy first'].map((t, i) => (
              <React.Fragment key={`${rep}-${i}`}>
                <span>{t}</span>
                <span style={{ color: 'var(--gold)', fontStyle: 'normal', fontSize: 20 }}>✦</span>
              </React.Fragment>
            ))
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          STATS — dark horizontal strip with count-up
      ════════════════════════════════════════════════════════ */}
      <section className="section-dark" style={{ background: 'var(--ink)', color: 'var(--cream)', padding: '32px 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 100%, rgba(124,29,58,0.5), transparent 60%)' }} />
        <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          {[
            { to: 1190, suffix: '+', label: 'Matches' },
            { to: 50,   suffix: 'K+', label: 'Verified' },
            { to: 98,   suffix: '%',  label: 'Satisfied' },
            { to: 15,   suffix: 'yr', label: 'Trusted' },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ flex: '1 0 0', height: 1, background: 'var(--line-on-dk)', maxWidth: 100 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 'clamp(20px,2.4vw,36px)', lineHeight: 1, letterSpacing: '-.03em', color: 'var(--cream)' }}>
                  <CountUp to={s.to} suffix={s.suffix} />
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(253,248,242,.75)', marginTop: 12 }}>{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          WHY — sticky title pane + horizontal scrolling cards
      ════════════════════════════════════════════════════════ */}
      <section id="why" style={{ display: 'grid', gridTemplateColumns: '0.85fr 2fr', padding: '64px 0 48px', alignItems: 'start' }}>
        {/* Sticky left */}
        <div style={{ position: 'sticky', top: 80, padding: '0 28px 0 40px' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--burgundy)', marginBottom: 24, display: 'block' }}>— Why TricityShadi</span>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', marginBottom: 24 }}>
              Six reasons<br />this <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>isn't</em><br />another app.
            </h2>
            <p style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', marginBottom: 32 }}>
              Scroll right to read. Each principle shapes a real product decision — not just marketing copy.
            </p>
            <div style={{ height: 2, background: 'var(--line)', borderRadius: 1, overflow: 'hidden' }}>
              <div id="why-bar" style={{ height: '100%', background: 'var(--burgundy)', width: 0, transition: 'width .2s linear' }} />
            </div>
          </motion.div>
        </div>

        {/* Horizontal scroll */}
        <div id="why-scroller" className="why-scroller" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '0 24px 20px', scrollSnapType: 'x mandatory' }}>
          {whyCards.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="why-tile"
              style={{
                flex: '0 0 260px', scrollSnapAlign: 'start',
                padding: '24px 20px', background: 'var(--cream-3)',
                border: '1px solid var(--line)', borderRadius: 4, minHeight: 280,
                display: 'flex', flexDirection: 'column',
                transition: 'all .4s cubic-bezier(.2,.8,.2,1)',
                position: 'relative', overflow: 'hidden', cursor: 'default',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                el.style.background = 'var(--burgundy)';
                el.style.color = 'var(--cream)';
                el.style.transform = 'translateY(-8px)';
                el.style.boxShadow = '0 30px 60px -20px rgba(124,29,58,.4)';
                el.querySelector('.wt-glyph').style.color = 'var(--gold)';
                el.querySelector('.wt-tag').style.color = 'var(--gold)';
                el.querySelector('.wt-body').style.color = 'rgba(253,248,242,.8)';
                el.querySelector('.wt-foot').style.color = 'var(--gold)';
              }}
              onMouseLeave={e => {
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
              <div className="wt-glyph" style={{ fontSize: 36, color: 'var(--burgundy)', marginBottom: 20, lineHeight: 1, transition: 'color .4s' }}>{c.glyph}</div>
              <div className="wt-tag" style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 10, transition: 'color .4s' }}>{c.tag}</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 22, lineHeight: 1.05, letterSpacing: '-.01em', marginBottom: 10 }}>{c.title}</div>
              <div className="wt-body" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)', marginBottom: 'auto', transition: 'color .4s' }}>{c.body}</div>
              <div className="wt-foot" style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--burgundy)', paddingTop: 24, transition: 'color .4s' }}>— learn more</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          MATCHES — full-bleed featured profile + side rail
      ════════════════════════════════════════════════════════ */}
      <section id="matches" className="matches-section section-dark" style={{ background: 'var(--burgundy)', color: 'var(--cream)', padding: '36px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 24, display: 'block' }}>— Smart matches</span>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', color: 'var(--cream)' }}>
              Profiles matched<br /><em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>just</em> for you.
            </h2>
          </div>
          <div style={{ fontFamily: 'var(--display)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <AnimatePresence mode="wait">
              <motion.span key={matchIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ fontSize: 36, lineHeight: 1, color: 'var(--gold)', fontStyle: 'italic' }}>
                0{matchIdx + 1}
              </motion.span>
            </AnimatePresence>
            <span style={{ fontSize: 24, opacity: .55 }}>/ 0{profiles.length}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Feature card — photo left, details right */}
          <motion.div key={matchIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 40px 80px -30px rgba(0,0,0,.5)',
              background: 'rgba(45,26,34,0.55)',
            }}>
            {/* Rectangular photo — full width, fixed height, no cropping of face */}
            <div style={{ position: 'relative', width: '100%', height: 340, flexShrink: 0 }}>
              <img
                src={cur.img} alt={cur.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
              />
              {/* Subtle bottom gradient only */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 60%,rgba(0,0,0,.4))' }} />
              {/* Match % badge */}
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'baseline', gap: 6, color: 'var(--cream)', background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', padding: '8px 14px', borderRadius: 999 }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 28, lineHeight: 1, letterSpacing: '-.03em', fontStyle: 'italic' }}>
                  {cur.match}<small style={{ fontSize: 14, opacity: .7 }}>%</small>
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .85, lineHeight: 1.3 }}>Compat<br />score</span>
              </div>
              {/* Verified badge */}
              <span style={{ position: 'absolute', top: 16, right: 16, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold)', background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', padding: '6px 12px', borderRadius: 999 }}>✦ Verified</span>
            </div>
            {/* Details panel */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <div>
                <span style={{ fontFamily: 'var(--display)', fontSize: 'clamp(20px,2.4vw,32px)', lineHeight: 1.05, letterSpacing: '-.02em', color: 'var(--cream)' }}>{cur.name}, <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>{cur.age}</em></span>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .7, color: 'var(--cream)', marginTop: 4 }}>{cur.loc} · Tricity</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cur.tags.map((t, j) => (
                  <span key={j} style={{ padding: '5px 12px', border: '1px solid rgba(253,248,242,.3)', borderRadius: 999, color: 'var(--cream)', fontSize: 11 }}>{t}</span>
                ))}
              </div>
              <Link to={`/profile/${matchIdx + 1}`} style={{
                marginTop: 'auto',
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
                padding: '11px 20px', background: 'var(--cream)', color: 'var(--burgundy)',
                borderRadius: 999, alignSelf: 'flex-start',
                transition: 'all .3s', textDecoration: 'none',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--cream)'; e.currentTarget.style.color = 'var(--burgundy)'; e.currentTarget.style.transform = ''; }}
              >View full profile →</Link>
            </div>
          </motion.div>

          {/* Side rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profiles.map((p, i) => (
              <div key={i} className="ms-row" onClick={() => setMatchIdx(i)}
                style={{
                  display: 'grid', gridTemplateColumns: '56px 1fr 20px', gap: 12, alignItems: 'center',
                  padding: '10px 12px', border: `1px solid ${matchIdx === i ? 'var(--gold)' : 'var(--line-on-dk)'}`,
                  borderRadius: 4, cursor: 'pointer',
                  background: matchIdx === i ? 'rgba(253,248,242,.06)' : 'transparent',
                  transition: 'all .3s',
                }}
                onMouseEnter={e => { if (matchIdx !== i) e.currentTarget.style.borderColor = 'var(--gold)'; }}
                onMouseLeave={e => { if (matchIdx !== i) e.currentTarget.style.borderColor = 'var(--line-on-dk)'; }}
              >
                {/* Square thumbnail — small enough, centred on face */}
                <div style={{ width: 56, height: 56, borderRadius: 4, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 10%' }} />
                  <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'var(--cream)', color: 'var(--burgundy)', padding: '2px 6px', borderRadius: 999, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600 }}>{p.match}%</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: 'var(--display)', fontSize: 16, lineHeight: 1 }}>{p.name}, <em style={{ fontStyle: 'italic', opacity: .7 }}>{p.age}</em></span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .6 }}>{p.loc}</span>
                </div>
                <span style={{ color: 'var(--gold)', fontSize: 12 }}>{matchIdx === i ? '●' : '○'}</span>
              </div>
            ))}
            <Link to="/search" style={{
              marginTop: 'auto', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase',
              padding: 14, border: '1px solid var(--gold)', borderRadius: 999, textAlign: 'center',
              color: 'var(--cream)', textDecoration: 'none', transition: 'all .3s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--cream)'; }}
            >View all matches →</Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          PROCESS — sticky scroll, rotating SVG dial
      ════════════════════════════════════════════════════════ */}
      <div ref={processRef} style={{ height: '180vh', position: 'relative' }}>
        <div style={{
          position: 'sticky', top: 64, height: 'calc(100vh - 64px)',
          display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 32,
          padding: '32px 40px 24px', alignItems: 'center',
          background: 'var(--cream-3)',
          borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
          overflow: 'hidden',
        }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--burgundy)', marginBottom: 24, display: 'block' }}>— The process</span>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', marginBottom: 24 }}>
              From hello<br />to <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>forever.</em>
            </h2>
            <p style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
              Four steps, designed with intentionality — because finding a partner deserves more than an algorithm.
            </p>
            {/* Dial */}
            <div style={{ position: 'relative', width: 140, height: 140, marginTop: 24 }}>
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                <circle cx="100" cy="100" r="80" stroke="rgba(45,26,34,0.15)" strokeWidth="1" fill="none" />
                <circle cx="100" cy="100" r="80" stroke="var(--burgundy)" strokeWidth="2" fill="none"
                  strokeDasharray={`${(processActive + 1) / processSteps.length * 502} 502`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                  style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.2,0.8,0.2,1)' }}
                />
                {processSteps.map((_, i) => {
                  const a = (i / processSteps.length) * Math.PI * 2 - Math.PI / 2;
                  return (
                    <circle key={i}
                      cx={100 + 80 * Math.cos(a)} cy={100 + 80 * Math.sin(a)}
                      r={i <= processActive ? 6 : 4}
                      fill={i <= processActive ? 'var(--burgundy)' : 'var(--cream-2)'}
                      stroke="var(--burgundy)" strokeWidth="1"
                      style={{ transition: 'r .3s, fill .3s' }}
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
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 60px', gap: 12,
                  alignItems: 'center', padding: '8px 0',
                  opacity: i === processActive ? 1 : i < processActive ? 0.65 : 0.35,
                  transition: 'opacity .3s',
                }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em' }}>0{i + 1}</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--sans)' }}>{s.t}</span>
                  <span style={{
                    height: 1, background: 'var(--burgundy)',
                    transformOrigin: 'left', transform: i <= processActive ? 'scaleX(1)' : 'scaleX(0)',
                    transition: 'transform .5s',
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
      <section id="cities" className="cities-section section-dark" style={{ background: 'var(--ink)', color: 'var(--cream)' }}>
        <div style={{ padding: '48px 40px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'end' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 24, display: 'block' }}>— Made for Tricity</span>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', color: 'var(--cream)' }}>
              Three cities.<br />One <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>community.</em>
            </h2>
          </motion.div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(253,248,242,.75)', maxWidth: 520, fontFamily: 'var(--sans)' }}>
            Hover a strip to expand. Mass-market apps don't understand what matters here — shared roots, family values, the comfort of proximity.
          </p>
        </div>

        <div style={{ display: 'flex', height: 360, borderTop: '1px solid var(--line-on-dk)' }}>
          {cities.map((c, i) => (
            <div key={i}
              className={`city-strip${activeCity === i ? ' active' : ''}`}
              onMouseEnter={() => setActiveCity(i)}
              onClick={() => setActiveCity(i)}
              style={{
                flex: activeCity === i ? 3 : 1,
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
                borderRight: i < 2 ? '1px solid var(--line-on-dk)' : 'none',
              }}
            >
              {/* Real image background */}
              <img src={c.img} alt={c.name} className="city-bg"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: activeCity === i ? 'scale(1)' : 'scale(1.05)' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: activeCity === i
                  ? 'linear-gradient(180deg,rgba(124,29,58,.4) 0%,rgba(45,26,34,.95) 100%)'
                  : 'linear-gradient(180deg,transparent 30%,rgba(45,26,34,.85))',
                transition: 'background .5s',
              }} />

              {/* Vertical label (collapsed) */}
              <div style={{
                position: 'absolute', left: 24, bottom: 24,
                transformOrigin: 'left bottom', transform: 'rotate(-90deg) translateY(0)',
                whiteSpace: 'nowrap', opacity: activeCity === i ? 0 : 1, transition: 'opacity .4s', zIndex: 2,
              }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>{c.tag}</span>
              </div>

              {/* Expanded content */}
              <div style={{
                position: 'absolute', inset: 0, padding: 28,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                opacity: activeCity === i ? 1 : 0, transition: 'opacity .5s .2s', zIndex: 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold)' }}>{c.tag}</span>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 64, lineHeight: 1, color: 'var(--gold)', fontStyle: 'italic', textAlign: 'right' }}>
                    {c.count}<small style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(253,248,242,.7)', marginTop: 4, fontStyle: 'normal' }}>profiles</small>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(32px,4vw,64px)', lineHeight: .9, letterSpacing: '-.025em', color: 'var(--cream)' }}>{c.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(253,248,242,.75)', maxWidth: 320, fontFamily: 'var(--sans)' }}>{c.desc}</p>
                  <Link to="/search" style={{
                    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase',
                    padding: '10px 18px', border: '1px solid rgba(253,248,242,.4)', borderRadius: 999, color: 'var(--cream)',
                    textDecoration: 'none', transition: 'all .3s', whiteSpace: 'nowrap',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--cream)'; e.currentTarget.style.color = 'var(--burgundy)'; e.currentTarget.style.borderColor = 'var(--cream)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--cream)'; e.currentTarget.style.borderColor = 'rgba(253,248,242,.4)'; }}
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
      <section style={{ background: 'var(--cream)', padding: '52px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <span style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-55%)',
          fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 'clamp(160px,22vw,320px)', lineHeight: .7,
          color: 'var(--burgundy)', opacity: .06, userSelect: 'none', pointerEvents: 'none',
        }}>"</span>
        <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ position: 'relative' }}>
          <p style={{ fontFamily: 'var(--display)', fontSize: 'clamp(28px,4vw,62px)', lineHeight: 1.05, letterSpacing: '-.02em', maxWidth: 1100, margin: '0 auto 56px' }}>
            The right match isn't a number<br />away — <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>they're a neighbourhood</em><br />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 24 }}>
              <span style={{ display: 'inline-block', width: 80, height: 2, background: 'var(--gold)' }} />away.
            </span>
          </p>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--mute)', display: 'inline-flex', gap: 14, alignItems: 'center' }}>
            <span>— Founders, TricityShadi</span>
            <span style={{ color: 'var(--burgundy)' }}>·</span>
            <span>Chandigarh</span>
            <span style={{ color: 'var(--burgundy)' }}>·</span>
            <span>2026</span>
          </p>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════
          TRUST — burgundy tile grid
      ════════════════════════════════════════════════════════ */}
      <section id="trust" className="section-dark" style={{ background: 'var(--burgundy)', color: 'var(--cream)', padding: '52px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'end', marginBottom: 24 }}>
          <div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 24, display: 'block' }}>— Safety first</span>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', color: 'var(--cream)' }}>
              Built on trust. Backed by <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>action.</em>
            </h2>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(253,248,242,.75)', maxWidth: 520, fontFamily: 'var(--sans)' }}>
            We don't just ask for trust — we earn it. Every feature is designed to protect your privacy, safety, and dignity.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { n: '01', t: 'Identity verified',      b: 'Govt. ID required before going live.',                      Icon: FiShield },
            { n: '02', t: 'End-to-end encrypted',   b: 'Conversations encrypted in transit and at rest.',           Icon: FiLock },
            { n: '03', t: 'Human-moderated',        b: 'Safety team reviews flagged profiles daily.',               Icon: FiCheckCircle },
            { n: '04', t: 'Family approved',        b: 'Designed to include families, never pressure.',             Icon: FiUsers },
          ].map((it, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ padding: '20px 18px', border: '1px solid var(--line-on-dk)', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200, transition: 'all .4s', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line-on-dk)'; e.currentTarget.style.transform = ''; }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', color: 'rgba(253,248,242,.55)' }}>{it.n}</span>
              <it.Icon style={{ width: 36, height: 36, color: 'var(--gold)' }} />
              <h4 style={{ fontFamily: 'var(--display)', fontSize: 20, lineHeight: 1.1, letterSpacing: '-.01em', fontWeight: 400, marginTop: 'auto', color: 'var(--cream)' }}>{it.t}</h4>
              <p style={{ fontSize: 13, color: 'rgba(253,248,242,.75)', lineHeight: 1.5, fontFamily: 'var(--sans)' }}>{it.b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          TESTIMONIALS — polaroid stack carousel with real images
      ════════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--cream)', padding: '56px 40px' }}>
        <div style={{ marginBottom: 40 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--burgundy)', marginBottom: 24, display: 'block' }}>— Real couples</span>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em' }}>
            Stories that<br />began <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>here.</em>
          </h2>
        </div>
        <div className="testi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          {/* Polaroid pile */}
          <div style={{ position: 'relative', height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    <img src={s.img} alt={s.who} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
              <button onClick={() => setStoryIdx((storyIdx - 1 + 3) % 3)}
                style={{ width: 44, height: 44, border: '1px solid var(--line)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .3s', cursor: 'pointer', background: 'transparent', color: 'var(--ink)', fontSize: 14 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >←</button>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em' }}>0{storyIdx + 1} / 03</span>
              <button onClick={() => setStoryIdx((storyIdx + 1) % 3)}
                style={{ width: 44, height: 44, border: '1px solid var(--line)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .3s', cursor: 'pointer', background: 'transparent', color: 'var(--ink)', fontSize: 14 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >→</button>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FAQ — sticky 2-col with hairline rules
      ════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ background: 'var(--cream)', padding: '64px 40px', display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 48, alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 80 }}>
          <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--burgundy)', marginBottom: 24, display: 'block' }}>— FAQ</span>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.4vw,40px)', lineHeight: .96, letterSpacing: '-.025em', marginBottom: 24 }}>
              Questions?<br />We've got <em style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>answers.</em>
            </h2>
            <p style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', marginBottom: 32 }}>
              If you don't find what you need, reach out — we respond within 24 hours, in English, Hindi or Punjabi.
            </p>
            <a href="mailto:support@tricityshadi.com" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase',
              padding: '12px 20px', border: '1px solid var(--line)', borderRadius: 999,
              color: 'var(--ink)', textDecoration: 'none', transition: 'all .3s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
            >
              <FiMessageCircle /> Contact support
            </a>
          </motion.div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)' }}>
          {faqs.map((it, i) => (
            <div key={i} className={`faq-row${faqOpen === i ? ' faq-item-open' : ''}`}
              onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
              style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 36px', gap: 16,
                padding: `24px ${faqOpen === i ? '24px' : '0'} 24px ${faqOpen === i ? '8px' : '0'}`,
                borderBottom: '1px solid var(--line)', cursor: 'pointer',
                transition: 'padding .3s',
              }}
              onMouseEnter={e => { if (faqOpen !== i) e.currentTarget.style.paddingLeft = '8px'; }}
              onMouseLeave={e => { if (faqOpen !== i) e.currentTarget.style.paddingLeft = '0'; }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.16em', color: 'var(--burgundy)', paddingTop: 6 }}>0{i + 1}</span>
              <div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 20, lineHeight: 1.15, letterSpacing: '-.01em' }}>{it.q}</div>
                <div className="faq-a" style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>{it.a}</div>
              </div>
              <div className="faq-toggle" style={{
                width: 36, height: 36, border: '1px solid var(--line)', borderRadius: '50%',
                position: 'relative', transition: 'all .4s cubic-bezier(.2,.8,.2,1)',
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
      <section className="cta-section section-dark" style={{ background: 'var(--burgundy)', color: 'var(--cream)', padding: '56px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Orbs */}
        {[
          { w: 600, h: 600, color: 'rgba(184,149,42,.5)',   top: '-200px', left: '0',  dur: 18 },
          { w: 700, h: 700, color: 'rgba(124,29,58,.7)',    bottom: '-300px', right: '0', dur: 22 },
          { w: 400, h: 400, color: 'rgba(253,248,242,.15)', top: '40%', left: '40%', dur: 16 },
        ].map((o, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%', filter: 'blur(60px)',
            width: o.w, height: o.h,
            background: `radial-gradient(circle, ${o.color}, transparent 70%)`,
            top: o.top, left: o.left, bottom: o.bottom, right: o.right,
            animation: `drift ${o.dur}s ease-in-out infinite${i === 1 ? ' reverse' : ''}`,
            pointerEvents: 'none',
          }} />
        ))}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 32, display: 'block' }}>★ Your story awaits ★</span>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(22px,2.8vw,44px)', lineHeight: .92, letterSpacing: '-.025em', marginBottom: 32 }}>
              Every great<br />love story<br />starts with <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>one step.</em>
            </h2>
            <p style={{ maxWidth: 540, margin: '0 auto 32px', fontSize: 14, lineHeight: 1.5, color: 'rgba(253,248,242,.82)', fontFamily: 'var(--sans)' }}>
              Join thousands of families who trusted TricityShadi to find their forever partner. Free to start.
            </p>
            <div style={{ display: 'inline-flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}>
              <Link to="/onboarding" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 28px', borderRadius: 999,
                background: 'var(--cream)', color: 'var(--burgundy)',
                fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', textDecoration: 'none',
                transition: 'all .3s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--cream)'; e.currentTarget.style.color = 'var(--burgundy)'; e.currentTarget.style.transform = ''; }}
              >Create profile · Free <FiArrowRight /></Link>
              <Link to="/search" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '14px 28px', borderRadius: 999,
                border: '1px solid rgba(253,248,242,.35)', color: 'var(--cream)',
                fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', textDecoration: 'none',
                transition: 'all .3s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--cream)'; e.currentTarget.style.color = 'var(--burgundy)'; e.currentTarget.style.borderColor = 'var(--cream)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--cream)'; e.currentTarget.style.borderColor = 'rgba(253,248,242,.35)'; }}
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
      <footer style={{ background: 'var(--ink)', color: 'var(--cream)', paddingBottom: 40, overflow: 'hidden' }}>
        {/* Mega wordmark */}
        <div className="footer-mega-inner" style={{ padding: '36px 48px 24px', borderBottom: '1px solid var(--line-on-dk)' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 'clamp(36px,7vw,100px)', lineHeight: .85, letterSpacing: '-.04em', color: 'var(--cream)' }}>
            TricityShadi
          </div>
        </div>

        {/* Grid */}
        <div className="footer-grid-inner" style={{ padding: '36px 48px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 36, borderBottom: '1px solid var(--line-on-dk)' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 20 }}>Chandigarh · Mohali · Panchkula</div>
            <p style={{ fontSize: 14, color: 'rgba(253,248,242,.7)', lineHeight: 1.55, maxWidth: 320, fontFamily: 'var(--sans)', marginBottom: 24 }}>
              Tricity's most trusted matrimonial platform. Connecting families through verified profiles and intelligent matching since 2011.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { icon: <FaInstagram />, label: 'Instagram' },
                { icon: <FaFacebook />, label: 'Facebook' },
                { icon: <FaWhatsapp />, label: 'WhatsApp' },
                { icon: <FaTwitter />, label: 'Twitter' },
              ].map(s => (
                <a key={s.label} href="#" aria-label={s.label}
                  style={{ width: 36, height: 36, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line-on-dk)', color: 'rgba(253,248,242,.5)', transition: 'all .3s', textDecoration: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--burgundy)'; e.currentTarget.style.color = 'var(--cream)'; e.currentTarget.style.borderColor = 'var(--burgundy)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(253,248,242,.5)'; e.currentTarget.style.borderColor = 'var(--line-on-dk)'; }}
                >{s.icon}</a>
              ))}
            </div>
          </div>
          {[
            { title: 'Platform', links: [['Browse Profiles', '/search'], ['How It Works', '/#why'], ['Pricing Plans', '/subscription'], ['Success Stories', '/#stories'], ['Create Profile', '/onboarding']] },
            { title: 'Company',  links: [['About Us', '/about'], ['Contact', '/contact'], ['Safety Centre', '/safety'], ['Privacy Policy', '/privacy'], ['Terms of Service', '/terms']] },
            { title: 'Contact',  links: [['support@tricityshadi.com', null], ['+91 98765 43210', null], ['Sector 17, Chandigarh', null]] },
          ].map(col => (
            <div key={col.title}>
              <h5 style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 500, marginBottom: 20 }}>{col.title}</h5>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    {to ? (
                      <Link to={to} style={{ fontSize: 14, color: 'rgba(253,248,242,.85)', textDecoration: 'none', transition: 'color .3s, padding-left .3s', display: 'block', fontFamily: 'var(--sans)' }}
                        onMouseEnter={e => { e.target.style.color = 'var(--gold)'; e.target.style.paddingLeft = '6px'; }}
                        onMouseLeave={e => { e.target.style.color = 'rgba(253,248,242,.85)'; e.target.style.paddingLeft = '0'; }}
                      >{label}</Link>
                    ) : (
                      <span style={{ fontSize: 14, color: 'rgba(253,248,242,.85)', fontFamily: 'var(--sans)' }}>{label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom-inner" style={{ padding: '16px 48px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(253,248,242,.5)', flexWrap: 'wrap', gap: 16 }}>
          <span>© 2026 TricityShadi · All rights reserved</span>
          <span>Made with care in Chandigarh</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s ease-in-out infinite' }} />
            All systems operational
          </span>
        </div>
      </footer>
    </div>
  );
};

/* ── NAV ───────────────────────────────────────────────────────── */

export default Home;
