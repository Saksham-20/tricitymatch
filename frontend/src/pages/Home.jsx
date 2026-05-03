import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Logo from '../components/common/Logo';
import {
  FiShield, FiCheckCircle, FiHeart, FiArrowRight, FiStar, FiUsers,
  FiMessageCircle, FiLock, FiMapPin, FiBookmark, FiChevronRight,
  FiChevronLeft, FiUser, FiX, FiPlus, FiMinus, FiZap, FiEye,
  FiPhone,
} from 'react-icons/fi';
import { FaInstagram, FaFacebook, FaTwitter, FaWhatsapp } from 'react-icons/fa';

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Deep maroon #7C1D3A, antique gold #B8952A, warm ivory #FDF8F2
   Display: Cormorant Garamond (loaded via @import in tailwind / index.css)
   Body: Inter / system stack
───────────────────────────────────────────────────────────── */

/* Inline font import via style tag rendered once */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@300;400;500;600;700&display=swap');
    .font-cormorant { font-family: 'Cormorant Garamond', Georgia, serif; }
    .font-inter { font-family: 'Inter', system-ui, sans-serif; }
  `}</style>
);

/* ── SVG MOTIFS ─────────────────────────────────────────────── */
const MandalaSVG = ({ className = '', opacity = 0.07 }) => (
  <svg className={className} style={{ opacity }} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="0.5" />
    <circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="0.5" />
    <circle cx="100" cy="100" r="54" stroke="currentColor" strokeWidth="0.5" />
    <circle cx="100" cy="100" r="36" stroke="currentColor" strokeWidth="0.5" />
    <circle cx="100" cy="100" r="18" stroke="currentColor" strokeWidth="0.5" />
    {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => (
      <line key={deg}
        x1={100 + 18 * Math.cos(deg * Math.PI / 180)}
        y1={100 + 18 * Math.sin(deg * Math.PI / 180)}
        x2={100 + 90 * Math.cos(deg * Math.PI / 180)}
        y2={100 + 90 * Math.sin(deg * Math.PI / 180)}
        stroke="currentColor" strokeWidth="0.4" />
    ))}
    {[0,45,90,135,180,225,270,315].map(deg => (
      <circle key={`dot-${deg}`}
        cx={100 + 72 * Math.cos(deg * Math.PI / 180)}
        cy={100 + 72 * Math.sin(deg * Math.PI / 180)}
        r="2" fill="currentColor" />
    ))}
  </svg>
);

const PaisleySVG = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 60 90" fill="none" aria-hidden="true">
    <path d="M30 85 C10 75, 2 55, 8 35 C14 15, 30 5, 30 5 C30 5, 46 15, 52 35 C58 55, 50 75, 30 85Z" stroke="currentColor" strokeWidth="0.6" fill="none" />
    <path d="M30 75 C16 67, 10 52, 15 38 C20 24, 30 15, 30 15 C30 15, 40 24, 45 38 C50 52, 44 67, 30 75Z" stroke="currentColor" strokeWidth="0.4" fill="none" />
    <circle cx="30" cy="40" r="6" stroke="currentColor" strokeWidth="0.5" fill="none" />
    <path d="M30 35 C35 32, 40 36, 38 42" stroke="currentColor" strokeWidth="0.4" />
  </svg>
);

/* ── COUNT-UP ──────────────────────────────────────────────── */
const CountUp = ({ target, suffix = '', duration = 1800 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -50px 0px' });
  const numeric = parseInt(String(target).replace(/[^0-9]/g, ''), 10);
  const [count, setCount] = useState(numeric);
  useEffect(() => {
    if (!inView) return;
    setCount(0);
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * numeric));
      if (progress < 1) requestAnimationFrame(tick);
      else setCount(numeric);
    };
    requestAnimationFrame(tick);
  }, [inView, numeric, duration]);
  return <span ref={ref} className="tabular-nums">{count.toLocaleString('en-IN')}{suffix}</span>;
};

/* ── COMPATIBILITY RING ────────────────────────────────────── */
const CompatibilityRing = ({ score, size = 72 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const strokeW = 3;
  const r = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div ref={ref} className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0E8D5" strokeWidth={strokeW} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#B8952A" strokeWidth={strokeW}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: offset } : {}}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-semibold leading-none" style={{ color: '#B8952A', fontFamily: 'Inter, system-ui' }}>{score}%</span>
        <span className="text-[9px] mt-0.5" style={{ color: '#9C7E5A', fontFamily: 'Inter, system-ui' }}>match</span>
      </div>
    </div>
  );
};

/* ── MATCH PREVIEW CARD ────────────────────────────────────── */
const MatchPreviewCard = ({ profile }) => (
  <motion.div
    whileHover={{ y: -5 }}
    transition={{ duration: 0.25 }}
    className="relative flex-shrink-0 w-64 rounded-2xl overflow-hidden snap-start cursor-pointer"
    style={{ background: '#FDF8F2', border: '1px solid #EDE0CC', boxShadow: '0 4px 24px rgba(124,29,58,0.07)' }}
  >
    <div className="relative h-44 overflow-hidden">
      {profile.image ? (
        <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F5E6EE, #FDF8F2)' }}>
          <span className="font-cormorant text-3xl font-semibold" style={{ color: '#7C1D3A' }}>{profile.name.split(' ').map(n => n[0]).join('')}</span>
        </div>
      )}
      {profile.premium && (
        <div className="absolute inset-0 flex items-end justify-end p-3" style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-white text-[11px] font-medium" style={{ background: 'rgba(124,29,58,0.85)' }}>
            <FiLock className="w-3 h-3" />Upgrade to view
          </div>
        </div>
      )}
      {profile.online && !profile.premium && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(255,255,255,0.92)', color: '#3D3D3D' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Online
        </div>
      )}
      <button aria-label="Save profile" className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors" style={{ background: 'rgba(255,255,255,0.88)' }}>
        <FiBookmark className="w-3.5 h-3.5" style={{ color: '#7C1D3A' }} />
      </button>
    </div>
    <div className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-cormorant font-semibold text-base leading-tight truncate" style={{ color: '#2D1A22' }}>{profile.name}, {profile.age}</h3>
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#9C7E5A' }}>
            <FiMapPin className="w-3 h-3 flex-shrink-0" />{profile.location}
          </p>
        </div>
        <CompatibilityRing score={profile.match} size={48} />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {profile.tags.map((tag, i) => (
          <span key={i} className="px-2 py-0.5 text-[11px] rounded-full font-inter" style={{ background: '#F5E6EE', color: '#7C1D3A', border: '1px solid #E8C8D4' }}>{tag}</span>
        ))}
      </div>
      <Link to={`/profile/${profile.id}`} className="block text-center py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer" style={{ background: 'linear-gradient(135deg, #7C1D3A, #9B2248)', color: '#FDF8F2' }}>
        View Profile
      </Link>
    </div>
  </motion.div>
);

/* ── TIMELINE STEP ─────────────────────────────────────────── */
const TimelineStep = ({ step, index, total }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.12, ease: 'easeOut' }}
      className="flex gap-6"
    >
      <div className="flex flex-col items-center pt-0.5 flex-shrink-0">
        <motion.div
          initial={{ scale: 0 }} animate={inView ? { scale: 1 } : {}}
          transition={{ duration: 0.4, delay: index * 0.12 + 0.1, type: 'spring', stiffness: 240 }}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, #7C1D3A, #B8952A)' }}
        >
          {React.cloneElement(step.icon, { className: 'w-4.5 h-4.5' })}
        </motion.div>
        {index < total - 1 && (
          <motion.div initial={{ scaleY: 0 }} animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.8, delay: index * 0.12 + 0.3, ease: 'easeOut' }}
            className="w-px h-14 mt-2 origin-top"
            style={{ background: 'linear-gradient(to bottom, #B8952A55, #B8952A11)' }} />
        )}
      </div>
      <div className="pb-10 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] font-inter" style={{ color: '#B8952A' }}>Step {index + 1}</span>
        <h3 className="font-cormorant text-2xl font-semibold mt-0.5 mb-2" style={{ color: '#2D1A22' }}>{step.title}</h3>
        <p className="text-sm leading-relaxed font-inter" style={{ color: '#6B5C4E' }}>{step.desc}</p>
      </div>
    </motion.div>
  );
};

/* ── STORY CARD ────────────────────────────────────────────── */
const StoryCard = ({ story }) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45 }}
    className="grid md:grid-cols-[5fr_7fr] gap-10 md:gap-16 items-center"
  >
    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl">
      <img src={story.image} alt={`${story.names} — TricityShadi success story`} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(44,10,22,0.5), transparent 55%)' }} />
      <div className="absolute bottom-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(253,248,242,0.92)', backdropFilter: 'blur(8px)' }}>
        <FiCheckCircle className="w-3.5 h-3.5" style={{ color: '#2D7A4F' }} />
        <span className="text-xs font-semibold font-inter" style={{ color: '#2D1A22' }}>Verified Couple</span>
      </div>
    </div>
    <div>
      <div className="flex gap-1 mb-6">
        {[...Array(5)].map((_, i) => <FiStar key={i} className="w-4 h-4" style={{ color: '#B8952A', fill: '#B8952A' }} />)}
      </div>
      <blockquote className="font-cormorant text-3xl md:text-4xl leading-snug mb-8" style={{ color: '#FDF8F2', fontStyle: 'italic', fontWeight: 400 }}>
        "{story.quote}"
      </blockquote>
      <div className="flex items-center gap-4">
        <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(184,149,42,0.4), transparent)' }} />
        <div>
          <p className="font-semibold font-inter text-sm" style={{ color: '#FDF8F2' }}>{story.names}</p>
          <p className="text-xs mt-0.5 font-inter" style={{ color: 'rgba(253,248,242,0.55)' }}>{story.location} · Married {story.date}</p>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ── FAQ ITEM ──────────────────────────────────────────────── */
const FAQItem = ({ q, a, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}
      transition={{ delay: index * 0.07, duration: 0.45 }}
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        border: open ? '1px solid #D4A8B8' : '1px solid #EDE0CC',
        background: open ? '#FDF4F7' : '#FDF8F2',
      }}
    >
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer" aria-expanded={open}>
        <span className="font-semibold text-sm md:text-base leading-snug font-inter" style={{ color: '#2D1A22' }}>{q}</span>
        <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
          style={{ background: open ? '#7C1D3A' : '#EDE0CC', color: open ? '#FDF8F2' : '#7C1D3A' }}>
          {open ? <FiMinus className="w-3.5 h-3.5" /> : <FiPlus className="w-3.5 h-3.5" />}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <p className="px-6 pb-5 text-sm leading-relaxed font-inter" style={{ color: '#6B5C4E' }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── PRICING CARD ──────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════════
   HOME PAGE
══════════════════════════════════════════════════════════════ */
const Home = () => {
  const [activeStory, setActiveStory] = useState(0);
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  const featuredProfiles = [
    { id: 1, name: 'Priya Sharma', age: 28, location: 'Mohali, Punjab', match: 97, online: true, premium: false, tags: ['MBA IIM', 'Family-first', 'Travel'], image: '/images/optimized/profile-priya.webp' },
    { id: 2, name: 'Rahul Gupta', age: 31, location: 'Chandigarh', match: 95, online: false, premium: false, tags: ['IIT Graduate', 'Startup Founder', 'Trekking'], image: '/images/optimized/profile-rahul.webp' },
    { id: 3, name: 'Anjali Nair', age: 29, location: 'Panchkula', match: 94, online: true, premium: true, tags: ['Doctor AIIMS', 'Spiritual', 'Art'], image: '/images/optimized/profile-anjali.webp' },
    { id: 4, name: 'Arjun Patel', age: 32, location: 'Chandigarh', match: 93, online: false, premium: false, tags: ['Entrepreneur', 'Fitness', 'Books'], image: '/images/optimized/profile-arjun.webp' },
    { id: 5, name: 'Meera Reddy', age: 27, location: 'Mohali, Punjab', match: 96, online: true, premium: false, tags: ['Software Engineer', 'Cooking', 'Music'], image: '/images/optimized/profile-meera.webp' },
  ];

  const testimonials = [
    { names: 'Priya & Arjun', location: 'Chandigarh', date: 'June 2024', quote: 'We found each other in the most unexpected, yet perfectly right way. TricityShadi knew what we needed before we did.', years: '2', image: '/images/optimized/couple-testimonial.webp' },
    { names: 'Anjali & Rohan', location: 'Mohali', date: 'August 2024', quote: 'Trust was everything for us. The verification process gave us both the confidence to open up and truly connect.', years: '1', image: '/images/optimized/wedding-ceremony.webp' },
    { names: 'Meera & Vikram', location: 'Panchkula', date: 'September 2024', quote: 'From the first message to our engagement, everything felt intentional. This platform respects both families.', years: '1', image: '/images/optimized/couple-engagement.webp' },
  ];

  const timelineSteps = [
    { icon: <FiUser />, title: 'Create Your Profile', desc: 'Build a verified, detailed profile that reflects who you truly are — beyond the basics.' },
    { icon: <FiHeart />, title: 'Discover Matches', desc: 'Our AI surfaces compatible profiles based on values, lifestyle, and family expectations.' },
    { icon: <FiShield />, title: 'Connect Securely', desc: 'Every conversation is encrypted. Express interest, chat, and share when you\'re ready.' },
    { icon: <FiStar />, title: 'Begin Your Journey', desc: 'Meet in person with confidence. We\'ve done the groundwork so you can focus on what matters.' },
  ];

  const stats = [
    { value: '1190', label: 'Successful Matches', suffix: '+' },
    { value: '50000', label: 'Verified Profiles', suffix: '+' },
    { value: '98', label: 'Satisfaction Rate', suffix: '%' },
    { value: '15', label: 'Years Trusted', suffix: '+' },
  ];

  const features = [
    { icon: <FiShield />, title: 'Government ID Verified', desc: 'Every profile passes a strict government ID check before going live. Zero fake profiles.', badge: 'Security' },
    { icon: <FiZap />, title: 'AI-Powered Matching', desc: 'Our algorithm analyzes 40+ compatibility dimensions — not just age and location.', badge: 'Technology' },
    { icon: <FiMapPin />, title: 'Hyperlocal Focus', desc: 'Built exclusively for Chandigarh, Mohali & Panchkula. Meet partners from your community.', badge: 'Local' },
    { icon: <FiEye />, title: 'Incognito Mode', desc: 'Browse privately. Only appear to profiles you express interest in. Full control of your visibility.', badge: 'Privacy' },
    { icon: <FiMessageCircle />, title: 'Secure Encrypted Chat', desc: 'End-to-end encrypted messaging with read receipts. No phone number exposure ever.', badge: 'Communication' },
    { icon: <FiUsers />, title: 'Family-Friendly Flow', desc: 'Involve family at the right moment. Our process is designed to respect both sides.', badge: 'Values' },
  ];


  const faqs = [
    { q: 'Is TricityShadi only for people in Chandigarh, Mohali, and Panchkula?', a: 'Our platform is built for the Tricity region, but you can also find profiles from nearby areas like Ludhiana, Ambala, and Delhi who are open to matches in Tricity. Our hyperlocal focus means better cultural alignment and easier in-person meetings.' },
    { q: 'How does identity verification work?', a: 'Every user must submit a government-issued photo ID (Aadhaar, PAN, or passport) before their profile goes live. Our team manually reviews each submission within 24 hours. Verified profiles get a blue verification badge.' },
    { q: 'Can I browse profiles without creating an account?', a: 'You can see limited profile previews on the landing page. To browse full profiles, search with filters, and view contact details, you\'ll need to create a free account — which takes less than 3 minutes.' },
    { q: 'What\'s the difference between Premium and VIP plans?', a: 'Premium gives you 10 contact unlocks per month plus messaging and advanced filters. VIP is our flagship plan with unlimited contact unlocks, a dedicated relationship manager, permanent profile boost, and WhatsApp priority support — ideal if you want to find your match fast.' },
    { q: 'Is my data and conversation private?', a: 'Absolutely. All conversations are end-to-end encrypted. We never share your personal contact details, phone number, or email with other users unless you explicitly choose to share them. We are GDPR-compliant and follow strict data protection standards.' },
    { q: 'Can families participate in the matchmaking process?', a: 'Yes — TricityShadi is built with families in mind. You can add a family contact to your account who can browse matches on your behalf, and our messaging system allows you to loop in family members at the right time.' },
  ];

  useEffect(() => {
    const t = setInterval(() => setActiveStory(p => (p + 1) % testimonials.length), 6000);
    return () => clearInterval(t);
  }, [testimonials.length]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#FDF8F2', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <FontLoader />

      {/* ── SCROLL PROGRESS ─────────────────────── */}
      <motion.div
        className="fixed top-0 left-0 h-0.5 z-[100] origin-left"
        style={{ width: progressWidth, background: 'linear-gradient(90deg, #7C1D3A, #B8952A)' }}
      />

      {/* ── ANNOUNCEMENT BAR ────────────────────── */}
      <AnimatePresence>
        {announcementVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
            className="relative z-40 text-sm py-2.5 px-4 text-center overflow-hidden font-inter"
            style={{ background: '#7C1D3A', color: '#FDF8F2' }}
          >
            <div className="flex items-center justify-center gap-3 max-w-4xl mx-auto">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#F0D080' }} />
              <p className="text-sm">
                <span className="font-semibold" style={{ color: '#F0D080' }}>Limited time:</span> First month Premium free for Chandigarh residents.{' '}
                <Link to="/signup" className="underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity">Claim now</Link>
              </p>
              <button onClick={() => setAnnouncementVisible(false)} className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer" aria-label="Dismiss">
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════
          HERO — Full-bleed editorial split
      ══════════════════════════════════════════ */}
      <section className="relative min-h-screen flex overflow-hidden">

        {/* Left panel — copy */}
        <div className="relative z-10 flex flex-col justify-center w-full lg:w-[52%] pt-28 pb-20 px-8 sm:px-12 xl:px-20">

          {/* Subtle mandala behind copy */}
          <MandalaSVG className="absolute -left-32 top-1/2 -translate-y-1/2 w-[420px] h-[420px] pointer-events-none" style={{ color: '#7C1D3A', opacity: 0.05 }} />

          <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}>

            {/* Eyebrow */}
            <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } }}
              className="inline-flex items-center gap-3 mb-8"
            >
              <div className="h-px w-10" style={{ background: '#B8952A' }} />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#B8952A' }}>Tricity's Most Trusted Matrimony</span>
            </motion.div>

            {/* Headline — Cormorant Garamond, editorial */}
            <motion.h1 variants={{ hidden: { opacity: 0, y: 32 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7 } } }}
              className="font-cormorant leading-[0.95] mb-8"
              style={{ fontSize: 'clamp(3.2rem, 7vw, 5.5rem)', fontWeight: 600, color: '#2D1A22', letterSpacing: '-0.01em' }}
            >
              Where Every<br />
              <em style={{ color: '#7C1D3A', fontStyle: 'italic', fontWeight: 400 }}>Love Story</em><br />
              Begins.
            </motion.h1>

            {/* Sub */}
            <motion.p variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
              className="text-lg leading-relaxed mb-10 max-w-md font-inter"
              style={{ color: '#6B5C4E' }}
            >
              Connecting families across Chandigarh, Mohali and Panchkula through verified profiles,
              intelligent matching, and genuine human values.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
              className="flex flex-col sm:flex-row gap-3 mb-12"
            >
              <Link to="/signup"
                className="inline-flex items-center justify-center gap-2.5 px-9 py-4 text-base font-semibold rounded-xl transition-all duration-250 hover:-translate-y-0.5 cursor-pointer font-inter"
                style={{ background: 'linear-gradient(135deg, #7C1D3A 0%, #9B2248 100%)', color: '#FDF8F2', boxShadow: '0 8px 32px rgba(124,29,58,0.28)' }}
              >
                Create Free Profile
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/search"
                className="inline-flex items-center justify-center gap-2 px-9 py-4 text-base font-semibold rounded-xl transition-all duration-250 hover:-translate-y-0.5 cursor-pointer font-inter"
                style={{ background: 'transparent', border: '1.5px solid #B8952A', color: '#7C1D3A' }}
              >
                Browse Profiles
              </Link>
            </motion.div>

            {/* Trust strip */}
            <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5, delay: 0.25 } } }}
              className="flex flex-wrap items-center gap-5 font-inter"
            >
              {[
                { icon: <FiCheckCircle className="w-4 h-4" />, label: '100% Verified' },
                { icon: <FiShield className="w-4 h-4" />, label: 'Privacy First' },
                { icon: <FiHeart className="w-4 h-4" />, label: '1,190+ Matched' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm" style={{ color: '#6B5C4E' }}>
                  <span style={{ color: '#B8952A' }}>{t.icon}</span>
                  {t.label}
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Right panel — full-bleed image with editorial overlay */}
        <motion.div
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          className="hidden lg:block absolute right-0 top-0 bottom-0 w-[50%]"
        >
          <img src="/images/optimized/hero-couple.webp" alt="Happy couple — TricityShadi" className="w-full h-full object-cover" />
          {/* Vertical fade into left panel */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #FDF8F2 0%, rgba(253,248,242,0.3) 25%, transparent 55%)' }} />
          {/* Bottom fade */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(45,26,34,0.35), transparent 40%)' }} />

          {/* Floating match card */}
          <motion.div
            animate={{ y: [0, -10, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute bottom-16 left-10 rounded-2xl p-4 shadow-2xl"
            style={{ background: 'rgba(253,248,242,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(237,224,204,0.8)', minWidth: 200 }}
          >
            <div className="flex items-center gap-3">
              <CompatibilityRing score={97} size={46} />
              <div>
                <p className="text-sm font-semibold font-inter" style={{ color: '#2D1A22' }}>Perfect Match</p>
                <p className="text-xs font-inter" style={{ color: '#9C7E5A' }}>Priya & Arjun</p>
              </div>
            </div>
          </motion.div>

          {/* Verified badge float */}
          <motion.div
            animate={{ y: [0, 8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className="absolute top-1/3 left-4 rounded-xl p-3 shadow-xl"
            style={{ background: 'rgba(253,248,242,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(237,224,204,0.8)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E8F5EE' }}>
                <FiCheckCircle className="w-4 h-4" style={{ color: '#2D7A4F' }} />
              </div>
              <div>
                <p className="text-xs font-semibold font-inter" style={{ color: '#2D1A22' }}>ID Verified</p>
                <p className="text-[11px] font-inter" style={{ color: '#9C7E5A' }}>Govt. document</p>
              </div>
            </div>
          </motion.div>

          {/* New match notification float */}
          <motion.div
            animate={{ y: [0, -6, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-24 right-8 rounded-2xl p-3.5 shadow-xl"
            style={{ background: 'rgba(253,248,242,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(237,224,204,0.8)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F5E6EE' }}>
                <FiHeart className="w-4 h-4" style={{ color: '#7C1D3A' }} />
              </div>
              <div>
                <p className="text-xs font-semibold font-inter" style={{ color: '#2D1A22' }}>New match found!</p>
                <p className="text-[11px] font-inter" style={{ color: '#9C7E5A' }}>97% compatibility</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Paisley motifs */}
        <PaisleySVG className="absolute bottom-0 left-0 w-16 h-24 pointer-events-none" style={{ color: '#B8952A', opacity: 0.12 }} />
        <PaisleySVG className="absolute top-1/4 right-[50%] w-10 h-16 pointer-events-none hidden lg:block" style={{ color: '#7C1D3A', opacity: 0.07 }} />
      </section>

      {/* ══════════════════════════════════════════
          STATS — editorial horizontal rule
      ══════════════════════════════════════════ */}
      <section className="py-16 relative overflow-hidden" style={{ background: '#2D1A22', borderTop: '1px solid rgba(184,149,42,0.2)' }}>
        {/* Mandala watermark */}
        <MandalaSVG className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none" style={{ color: '#B8952A', opacity: 0.06 }} />

        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="text-center py-6 relative"
              >
                {i > 0 && <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 h-10 w-px" style={{ background: 'rgba(184,149,42,0.25)' }} />}
                <p className="font-cormorant font-semibold mb-1" style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', color: '#F0D080', lineHeight: 1 }}>
                  <CountUp target={s.value} duration={1800} />{s.suffix}
                </p>
                <p className="text-sm font-inter" style={{ color: 'rgba(253,248,242,0.55)', letterSpacing: '0.04em' }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          WHY TRICITYSHADI — feature bento
      ══════════════════════════════════════════ */}
      <section className="py-28 md:py-36 relative overflow-hidden" style={{ background: '#FDF8F2' }}>
        <MandalaSVG className="absolute -right-24 top-0 w-96 h-96 pointer-events-none" style={{ color: '#7C1D3A', opacity: 0.04 }} />

        <div className="container mx-auto px-6 lg:px-8 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.55 }} className="max-w-2xl mb-16">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-10" style={{ background: '#B8952A' }} />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#B8952A' }}>Why TricityShadi</span>
            </div>
            <h2 className="font-cormorant leading-[1.0] mb-5" style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 600, color: '#2D1A22' }}>
              Built for trust.<br />
              <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#7C1D3A' }}>Designed for people like you.</em>
            </h2>
            <p className="text-lg leading-relaxed font-inter" style={{ color: '#6B5C4E' }}>
              We're not a mass-market app. We're a focused, local platform built on trust, technology, and respect.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                whileHover={{ y: -5 }}
                className="group p-7 rounded-2xl transition-all duration-250 cursor-default"
                style={{ background: '#FFFAF6', border: '1px solid #EDE0CC' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4A8B8'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(124,29,58,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#EDE0CC'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: '#F5E6EE', border: '1px solid #E8C8D4' }}>
                    {React.cloneElement(f.icon, { className: 'w-5 h-5', style: { color: '#7C1D3A' } })}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider font-inter px-2.5 py-1 rounded-full" style={{ background: '#F0E8D5', color: '#9C7E5A', border: '1px solid #E0D0B8' }}>{f.badge}</span>
                </div>
                <h3 className="font-semibold text-base mb-2 font-inter" style={{ color: '#2D1A22' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed font-inter" style={{ color: '#6B5C4E' }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PROFILE CAROUSEL
      ══════════════════════════════════════════ */}
      <section className="py-24 md:py-28 overflow-hidden" style={{ background: '#F5EDE0' }}>
        <div className="container mx-auto px-6 lg:px-8 mb-10">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.55 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-10" style={{ background: '#B8952A' }} />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#B8952A' }}>Smart Matches</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h2 className="font-cormorant font-semibold leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#2D1A22' }}>
                Profiles Matched<br /><em style={{ fontStyle: 'italic', fontWeight: 400, color: '#7C1D3A' }}>Just For You</em>
              </h2>
              <Link to="/search" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold font-inter transition-colors cursor-pointer" style={{ color: '#7C1D3A' }}>
                View all matches <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-6 lg:px-8 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {featuredProfiles.map((profile, i) => (
            <motion.div key={profile.id} initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: i * 0.07, duration: 0.45 }}>
              <MatchPreviewCard profile={profile} />
            </motion.div>
          ))}
          <Link to="/search" className="snap-start flex-shrink-0 w-64 rounded-2xl flex flex-col items-center justify-center gap-4 p-8 transition-all group cursor-pointer"
            style={{ border: '2px dashed #C9B89A', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C1D3A'; e.currentTarget.style.background = 'rgba(124,29,58,0.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#C9B89A'; e.currentTarget.style.background = 'transparent'; }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center transition-colors" style={{ background: '#EDE0CC' }}>
              <FiArrowRight className="w-5 h-5" style={{ color: '#7C1D3A' }} />
            </div>
            <p className="text-sm font-medium font-inter text-center leading-snug" style={{ color: '#7C1D3A' }}>Explore all<br />50,000+ profiles</p>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS — timeline
      ══════════════════════════════════════════ */}
      <section className="py-28 md:py-36 relative overflow-hidden" style={{ background: '#FDF8F2' }}>
        <MandalaSVG className="absolute left-0 bottom-0 w-80 h-80 pointer-events-none" style={{ color: '#B8952A', opacity: 0.05 }} />

        <div className="container mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.6 }} className="lg:sticky lg:top-28">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px w-10" style={{ background: '#B8952A' }} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#B8952A' }}>The Process</span>
              </div>
              <h2 className="font-cormorant leading-tight mb-5" style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 600, color: '#2D1A22' }}>
                From Profile to<br />
                <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#7C1D3A' }}>Perfect Match</em>
              </h2>
              <p className="text-lg leading-relaxed mb-10 font-inter" style={{ color: '#6B5C4E' }}>
                We've designed every step with intentionality — because finding a life partner deserves more than an algorithm.
              </p>

              {/* Photo accent */}
              <div className="rounded-2xl overflow-hidden shadow-xl mb-10 hidden lg:block relative">
                <img src="/images/optimized/wedding-hands.webp" alt="Wedding ceremony — TricityShadi" className="w-full h-52 object-cover" loading="lazy" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(45,26,34,0.4), transparent 50%)' }} />
              </div>

              <Link to="/signup"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 cursor-pointer font-inter"
                style={{ background: 'linear-gradient(135deg, #7C1D3A, #9B2248)', color: '#FDF8F2', boxShadow: '0 8px 24px rgba(124,29,58,0.22)' }}
              >
                Begin Your Journey <FiArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <div>
              {timelineSteps.map((step, i) => (
                <TimelineStep key={i} step={step} index={i} total={timelineSteps.length} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          MADE FOR TRICITY — editorial identity section
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: '#2D1A22' }}>
        {/* Texture: dot grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#B8952A 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Mandala accent */}
        <MandalaSVG className="absolute right-0 top-1/2 -translate-y-1/2 w-[560px] h-[560px] pointer-events-none" style={{ color: '#B8952A', opacity: 0.06 }} />

        {/* Top rule */}
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(184,149,42,0.4), transparent)' }} />

        {/* Pull-quote banner */}
        <div className="py-20 md:py-28 relative z-10">
          <div className="container mx-auto px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7 }}
              className="max-w-4xl"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="h-px w-10" style={{ background: '#B8952A' }} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#B8952A' }}>Made for Tricity</span>
              </div>

              {/* Large pull quote */}
              <blockquote
                className="font-cormorant mb-10"
                style={{ fontSize: 'clamp(2.6rem, 6vw, 5.2rem)', fontWeight: 400, fontStyle: 'italic', color: '#FDF8F2', lineHeight: 1.05 }}
              >
                "The right match isn't<br />
                <em style={{ color: '#F0D080', fontStyle: 'normal', fontWeight: 600 }}>a number away.</em><br />
                They're a neighbourhood away."
              </blockquote>

              <p className="text-lg leading-relaxed font-inter max-w-xl" style={{ color: 'rgba(253,248,242,0.6)' }}>
                We built TricityShadi because mass-market apps don't understand what matters here — shared roots,
                family values, and the comfort of proximity. Every feature is shaped by this region.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Bottom rule */}
        <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(184,149,42,0.2), transparent)' }} />
      </section>

      {/* Three city cards */}
      <section className="py-0 relative overflow-hidden" style={{ background: '#F5EDE0' }}>
        <div className="grid md:grid-cols-3">
          {[
            {
              city: 'Chandigarh',
              label: 'City Beautiful',
              desc: 'India\'s most planned city. Educated, cosmopolitan, and career-forward — yet deeply family-rooted.',
              stat: '28,000+',
              statLabel: 'profiles from Chandigarh',
              accent: '#7C1D3A',
              image: '/images/optimized/wedding-ceremony.webp',
            },
            {
              city: 'Mohali',
              label: 'Punjab\'s Rising Star',
              desc: 'Tech parks, AIIMS, IIT. Young professionals building careers without leaving their culture behind.',
              stat: '14,000+',
              statLabel: 'profiles from Mohali',
              accent: '#5C1229',
              image: '/images/optimized/couple-engagement.webp',
            },
            {
              city: 'Panchkula',
              label: 'Where Roots Run Deep',
              desc: 'Quiet, established, and close-knit. Families here value tradition as much as aspiration.',
              stat: '8,000+',
              statLabel: 'profiles from Panchkula',
              accent: '#3D0D1B',
              image: '/images/optimized/couple-testimonial.webp',
            },
          ].map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: i * 0.12, duration: 0.55 }}
              className="relative overflow-hidden group cursor-default"
              style={{ minHeight: 420 }}
            >
              {/* Background image */}
              <img
                src={c.image}
                alt={c.city}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              {/* Overlay */}
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{ background: `linear-gradient(to top, ${c.accent}EE 0%, ${c.accent}99 40%, ${c.accent}55 100%)` }}
              />
              {/* Divider line between cards */}
              {i < 2 && (
                <div className="absolute right-0 top-0 bottom-0 w-px hidden md:block" style={{ background: 'rgba(184,149,42,0.25)' }} />
              )}

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-10" style={{ minHeight: 420 }}>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter mb-3 block" style={{ color: '#F0D080' }}>{c.label}</span>
                <h3 className="font-cormorant font-semibold mb-3" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#FDF8F2', lineHeight: 1.0 }}>{c.city}</h3>
                <p className="text-sm leading-relaxed font-inter mb-6" style={{ color: 'rgba(253,248,242,0.72)' }}>{c.desc}</p>
                <div className="flex items-end gap-2 pt-5" style={{ borderTop: '1px solid rgba(253,248,242,0.15)' }}>
                  <span className="font-cormorant font-semibold" style={{ fontSize: '2rem', color: '#F0D080', lineHeight: 1 }}>{c.stat}</span>
                  <span className="text-xs font-inter mb-1" style={{ color: 'rgba(253,248,242,0.5)' }}>{c.statLabel}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TRUST & SAFETY
      ══════════════════════════════════════════ */}
      <section className="py-28 md:py-36 relative" style={{ background: '#FDF8F2' }}>
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[5fr_7fr] gap-16 lg:gap-24 items-center">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.6 }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px w-10" style={{ background: '#B8952A' }} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#B8952A' }}>Safety First</span>
              </div>
              <h2 className="font-cormorant leading-tight mb-5" style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 600, color: '#2D1A22' }}>
                Built on Trust.<br />
                <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#7C1D3A' }}>Backed by Action.</em>
              </h2>
              <p className="text-lg leading-relaxed font-inter" style={{ color: '#6B5C4E' }}>
                We don't just ask for trust — we earn it. Every feature is designed to protect your privacy, safety, and dignity.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: <FiShield />, title: 'Identity Verified', desc: 'Every profile undergoes government ID verification before going live.' },
                { icon: <FiLock />, title: 'End-to-End Encrypted', desc: 'Your conversations and data are encrypted and never shared.' },
                { icon: <FiCheckCircle />, title: 'Human-Moderated', desc: 'Our safety team reviews profiles daily to keep the experience trustworthy.' },
                { icon: <FiUsers />, title: 'Family-Approved Process', desc: 'Designed to include families at every step — built on mutual respect.' },
              ].map((pt, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  whileHover={{ y: -4 }}
                  className="p-6 rounded-2xl transition-all duration-200 cursor-default group"
                  style={{ background: '#FFFAF6', border: '1px solid #EDE0CC' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4A8B8'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,29,58,0.09)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#EDE0CC'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #7C1D3A, #9B2248)' }}>
                    {React.cloneElement(pt.icon, { className: 'w-4.5 h-4.5', style: { color: '#FDF8F2' } })}
                  </div>
                  <h3 className="font-semibold mb-1.5 font-inter" style={{ color: '#2D1A22' }}>{pt.title}</h3>
                  <p className="text-sm leading-relaxed font-inter" style={{ color: '#6B5C4E' }}>{pt.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SUCCESS STORIES — editorial
      ══════════════════════════════════════════ */}
      <section className="py-28 md:py-36 relative overflow-hidden" style={{ background: '#2D1A22' }}>
        <MandalaSVG className="absolute -left-20 top-1/2 -translate-y-1/2 w-96 h-96 pointer-events-none" style={{ color: '#B8952A', opacity: 0.07 }} />

        <div className="container mx-auto px-6 lg:px-8 relative z-10">
          <div className="flex items-end justify-between mb-14">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-10" style={{ background: '#B8952A' }} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#B8952A' }}>Real Couples</span>
              </div>
              <h2 className="font-cormorant leading-tight" style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 600, color: '#FDF8F2' }}>
                Stories That<br />
                <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#F0D080' }}>Begin Here</em>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveStory(p => (p - 1 + testimonials.length) % testimonials.length)}
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                style={{ border: '1px solid rgba(184,149,42,0.35)', color: '#FDF8F2' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(184,149,42,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                aria-label="Previous story">
                <FiChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setActiveStory(p => (p + 1) % testimonials.length)}
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                style={{ border: '1px solid rgba(184,149,42,0.35)', color: '#FDF8F2' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(184,149,42,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                aria-label="Next story">
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <StoryCard key={activeStory} story={testimonials[activeStory]} />
          </AnimatePresence>

          <div className="flex items-center gap-2 mt-12">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setActiveStory(i)} aria-label={`Story ${i + 1}`}
                className="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
                style={{ width: i === activeStory ? 32 : 6, background: i === activeStory ? '#B8952A' : 'rgba(184,149,42,0.3)' }} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      <section className="py-28 md:py-36 relative overflow-hidden" style={{ background: '#FDF8F2' }}>
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[5fr_8fr] gap-16 lg:gap-24 items-start">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.6 }} className="lg:sticky lg:top-28">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px w-10" style={{ background: '#B8952A' }} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#B8952A' }}>FAQ</span>
              </div>
              <h2 className="font-cormorant leading-tight mb-5" style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 600, color: '#2D1A22' }}>
                Questions?<br />
                <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#7C1D3A' }}>We've got answers.</em>
              </h2>
              <p className="leading-relaxed mb-8 font-inter" style={{ color: '#6B5C4E' }}>
                If you don't find what you're looking for, reach out — we respond to every message within 24 hours.
              </p>
              <a href="mailto:support@tricityshadi.com"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer font-inter"
                style={{ border: '1.5px solid #B8952A', color: '#7C1D3A' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,29,58,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <FiMessageCircle className="w-4 h-4" />
                Contact Support
              </a>
            </motion.div>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA CLOSURE — dark editorial with mandala
      ══════════════════════════════════════════ */}
      <section className="py-28 md:py-36 relative overflow-hidden" style={{ background: '#7C1D3A' }}>
        {/* Large mandala centrepiece */}
        <MandalaSVG className="absolute inset-0 m-auto w-[700px] h-[700px] pointer-events-none" style={{ color: '#FDF8F2', opacity: 0.05 }} />
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(184,149,42,0.4), transparent)' }} />

        <div className="container mx-auto px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.65 }}>
              <div className="flex items-center justify-center gap-3 mb-7">
                <div className="h-px w-14" style={{ background: 'rgba(240,208,128,0.5)' }} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] font-inter" style={{ color: '#F0D080' }}>Your Story Awaits</span>
                <div className="h-px w-14" style={{ background: 'rgba(240,208,128,0.5)' }} />
              </div>
              <h2 className="font-cormorant mb-7" style={{ fontSize: 'clamp(2.8rem, 6vw, 5rem)', fontWeight: 600, color: '#FDF8F2', lineHeight: 1.0 }}>
                Every great love story<br />
                <em style={{ fontStyle: 'italic', fontWeight: 400, color: '#F0D080' }}>starts with one step.</em>
              </h2>
              <p className="text-lg mb-12 leading-relaxed font-inter" style={{ color: 'rgba(253,248,242,0.65)' }}>
                Join thousands of families who trusted TricityShadi to find their forever partner.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/signup"
                  className="inline-flex items-center justify-center gap-2.5 px-9 py-4 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 cursor-pointer font-inter"
                  style={{ background: '#FDF8F2', color: '#7C1D3A', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
                >
                  Create Your Profile — Free
                  <FiArrowRight className="w-5 h-5" />
                </Link>
                <Link to="/search"
                  className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 cursor-pointer font-inter"
                  style={{ border: '1.5px solid rgba(253,248,242,0.35)', color: '#FDF8F2' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(253,248,242,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Browse Profiles
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="pt-16 pb-8" style={{ background: '#1A0E15', borderTop: '1px solid rgba(184,149,42,0.15)' }}>
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">

            {/* Brand */}
            <div className="lg:col-span-1">
              <Logo variant="white" size="lg" linkTo="/" />
              <p className="text-xs mt-1 mb-4 font-inter" style={{ color: 'rgba(184,149,42,0.7)' }}>Chandigarh · Mohali · Panchkula</p>
              <p className="text-sm leading-relaxed mb-6 font-inter" style={{ color: 'rgba(253,248,242,0.4)' }}>
                Tricity's most trusted matrimonial platform. Connecting families through verified profiles and intelligent matching.
              </p>
              <div className="flex items-center gap-3">
                {[
                  { icon: <FaInstagram className="w-4 h-4" />, label: 'Instagram', href: '#' },
                  { icon: <FaFacebook className="w-4 h-4" />, label: 'Facebook', href: '#' },
                  { icon: <FaWhatsapp className="w-4 h-4" />, label: 'WhatsApp', href: '#' },
                  { icon: <FaTwitter className="w-4 h-4" />, label: 'Twitter', href: '#' },
                ].map(s => (
                  <a key={s.label} href={s.href} aria-label={s.label}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer"
                    style={{ background: 'rgba(253,248,242,0.06)', color: 'rgba(253,248,242,0.5)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#7C1D3A'; e.currentTarget.style.color = '#FDF8F2'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(253,248,242,0.06)'; e.currentTarget.style.color = 'rgba(253,248,242,0.5)'; }}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.18em] mb-5 font-inter" style={{ color: 'rgba(253,248,242,0.6)' }}>Platform</h4>
              <ul className="space-y-3">
                {[
                  { label: 'Browse Profiles', to: '/search' },
                  { label: 'How It Works', to: '/#how' },
                  { label: 'Pricing Plans', to: '/subscription' },
                  { label: 'Success Stories', to: '/#stories' },
                  { label: 'Create Profile', to: '/signup' },
                ].map(l => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm font-inter transition-colors duration-200 cursor-pointer" style={{ color: 'rgba(253,248,242,0.4)' }}
                      onMouseEnter={e => { e.target.style.color = '#FDF8F2'; }}
                      onMouseLeave={e => { e.target.style.color = 'rgba(253,248,242,0.4)'; }}
                    >{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.18em] mb-5 font-inter" style={{ color: 'rgba(253,248,242,0.6)' }}>Company</h4>
              <ul className="space-y-3">
                {[
                  { label: 'About Us', to: '/about' },
                  { label: 'Contact', to: '/contact' },
                  { label: 'Safety Centre', to: '/safety' },
                  { label: 'Privacy Policy', to: '/privacy' },
                  { label: 'Terms of Service', to: '/terms' },
                ].map(l => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm font-inter transition-colors duration-200 cursor-pointer" style={{ color: 'rgba(253,248,242,0.4)' }}
                      onMouseEnter={e => { e.target.style.color = '#FDF8F2'; }}
                      onMouseLeave={e => { e.target.style.color = 'rgba(253,248,242,0.4)'; }}
                    >{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.18em] mb-5 font-inter" style={{ color: 'rgba(253,248,242,0.6)' }}>Contact</h4>
              <ul className="space-y-4 mb-6">
                {[
                  { icon: <FiPhone className="w-4 h-4 flex-shrink-0" />, text: '+91 98765 43210' },
                  { icon: <FiMessageCircle className="w-4 h-4 flex-shrink-0" />, text: 'support@tricityshadi.com' },
                  { icon: <FiMapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />, text: 'Sector 17, Chandigarh\n160017, India' },
                ].map((c, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-inter" style={{ color: 'rgba(253,248,242,0.4)' }}>
                    <span style={{ color: 'rgba(184,149,42,0.6)' }}>{c.icon}</span>
                    <span style={{ whiteSpace: 'pre-line' }}>{c.text}</span>
                  </li>
                ))}
              </ul>
              <div className="p-4 rounded-xl" style={{ border: '1px solid rgba(184,149,42,0.2)', background: 'rgba(184,149,42,0.05)' }}>
                <p className="text-xs font-semibold mb-1 font-inter" style={{ color: 'rgba(253,248,242,0.7)' }}>Looking for a match?</p>
                <Link to="/signup" className="text-xs font-medium font-inter transition-colors cursor-pointer" style={{ color: '#B8952A' }}
                  onMouseEnter={e => { e.target.style.color = '#F0D080'; }}
                  onMouseLeave={e => { e.target.style.color = '#B8952A'; }}
                >
                  Start for free — no credit card needed →
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(184,149,42,0.1)' }}>
            <p className="text-xs font-inter" style={{ color: 'rgba(253,248,242,0.25)' }}>© 2026 TricityShadi. All rights reserved. Made with care in Chandigarh.</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-inter" style={{ color: 'rgba(253,248,242,0.25)' }}>All systems operational</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Home;
