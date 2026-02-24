import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  FiShield, FiCheckCircle, FiHeart, FiArrowRight, FiStar, FiUsers,
  FiMessageCircle, FiLock, FiMapPin, FiBookmark, FiChevronRight,
  FiChevronLeft, FiUser,
} from 'react-icons/fi';

// ─────────────────────────────────────────────
// Compatibility Ring  — animated SVG circle
// ─────────────────────────────────────────────
const CompatibilityRing = ({ score, size = 72 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const strokeW = 4;
  const r = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#2E7D32' : score >= 75 ? '#C9A227' : '#8B2346';

  return (
    <div ref={ref} className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#F5F5F5" strokeWidth={strokeW}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: offset } : {}}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold leading-none" style={{ color }}>{score}%</span>
        <span className="text-[9px] text-neutral-400 mt-0.5">match</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Match Preview Card
// ─────────────────────────────────────────────
const MatchPreviewCard = ({ profile }) => (
  <motion.div
    whileHover={{ y: -6, boxShadow: '0 16px 48px rgba(139,35,70,0.14)' }}
    transition={{ duration: 0.2 }}
    className="relative flex-shrink-0 w-[17rem] bg-white rounded-2xl overflow-hidden border border-neutral-100 shadow-card snap-start"
  >
    {/* Image */}
    <div className="relative h-48 bg-gradient-to-br from-primary-100 via-primary-50 to-gold-50 flex items-center justify-center overflow-hidden">
      <FiUser className="w-14 h-14 text-primary-300" />

      {profile.premium && (
        <div className="absolute inset-0 flex flex-col items-end justify-end p-3"
          style={{ backdropFilter: 'blur(3px)', background: 'rgba(255,255,255,0.18)' }}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900/70 rounded-full text-white text-[11px] font-medium">
            <FiLock className="w-3 h-3" />
            Upgrade to view
          </div>
        </div>
      )}

      {profile.online && !profile.premium && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-white/90 rounded-full shadow-sm text-xs font-medium text-neutral-700">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft" />
          Online now
        </div>
      )}

      <button className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors">
        <FiBookmark className="w-3.5 h-3.5 text-neutral-600" />
      </button>
    </div>

    {/* Body */}
    <div className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-neutral-800 text-sm leading-tight truncate">
            {profile.name}, {profile.age}
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
            <FiMapPin className="w-3 h-3 flex-shrink-0" />
            {profile.location}
          </p>
        </div>
        <CompatibilityRing score={profile.match} size={52} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {profile.tags.map((tag, i) => (
          <span key={i} className="px-2 py-0.5 text-[11px] rounded-full bg-primary-50 text-primary-600 border border-primary-100">
            {tag}
          </span>
        ))}
      </div>

      <Link
        to={`/profile/${profile.id}`}
        className="block text-center py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors"
      >
        View Full Profile
      </Link>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────
// Timeline Step
// ─────────────────────────────────────────────
const TimelineStep = ({ step, index, total }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.12, ease: 'easeOut' }}
      className="flex gap-5"
    >
      {/* Left — dot + line */}
      <div className="flex flex-col items-center pt-0.5 flex-shrink-0">
        <motion.div
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ duration: 0.4, delay: index * 0.12 + 0.1, type: 'spring', stiffness: 260 }}
          className="w-11 h-11 rounded-full bg-primary-500 flex items-center justify-center text-white shadow-burgundy"
        >
          {React.cloneElement(step.icon, { className: 'w-4.5 h-4.5' })}
        </motion.div>
        {index < total - 1 && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.7, delay: index * 0.12 + 0.3, ease: 'easeOut' }}
            className="w-px h-14 bg-gradient-to-b from-primary-300 to-primary-100 mt-2 origin-top"
          />
        )}
      </div>

      {/* Right — text */}
      <div className="pb-10 flex-1">
        <span className="text-[10px] font-semibold text-primary-400 uppercase tracking-widest">Step {index + 1}</span>
        <h3 className="font-display text-xl font-semibold text-neutral-800 mt-0.5 mb-1.5">{step.title}</h3>
        <p className="text-sm text-neutral-500 leading-relaxed">{step.desc}</p>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────
// Story Card
// ─────────────────────────────────────────────
const StoryCard = ({ story }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -16 }}
    transition={{ duration: 0.45 }}
    className="grid md:grid-cols-[2fr_3fr] gap-8 md:gap-14 items-center"
  >
    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-primary-100 to-gold-100 flex items-center justify-center">
      <FiHeart className="w-20 h-20 text-primary-300" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-white/90 rounded-full shadow-sm">
        <FiCheckCircle className="w-3.5 h-3.5 text-success" />
        <span className="text-xs font-semibold text-neutral-800">Verified Couple</span>
      </div>
    </div>

    <div>
      <div className="flex gap-1 mb-5">
        {[...Array(5)].map((_, i) => (
          <FiStar key={i} className="w-4 h-4 text-gold" style={{ fill: '#C9A227' }} />
        ))}
      </div>
      <blockquote className="font-display text-2xl md:text-3xl leading-snug text-neutral-800 mb-7">
        "{story.quote}"
      </blockquote>
      <div>
        <p className="font-semibold text-neutral-800">{story.names}</p>
        <p className="text-sm text-neutral-500 mt-0.5">{story.location} · Married {story.date}</p>
        <span className="inline-block mt-3 px-3 py-1 bg-primary-50 text-primary-600 text-xs font-medium rounded-full border border-primary-100">
          Together {story.years} year{story.years !== '1' ? 's' : ''}
        </span>
      </div>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────
// Home Page
// ─────────────────────────────────────────────
const Home = () => {
  const [activeStory, setActiveStory] = useState(0);

  const featuredProfiles = [
    { id: 1, name: 'Priya Sharma', age: 28, location: 'Mohali, Punjab', match: 97, online: true,  premium: false, tags: ['MBA IIM', 'Family-first', 'Travel'] },
    { id: 2, name: 'Rahul Gupta',  age: 31, location: 'Chandigarh',     match: 95, online: false, premium: false, tags: ['IIT Graduate', 'Startup Founder', 'Trekking'] },
    { id: 3, name: 'Anjali Nair',  age: 29, location: 'Panchkula',      match: 94, online: true,  premium: true,  tags: ['Doctor AIIMS', 'Spiritual', 'Art'] },
    { id: 4, name: 'Arjun Patel',  age: 32, location: 'Chandigarh',     match: 93, online: false, premium: false, tags: ['Entrepreneur', 'Fitness', 'Books'] },
    { id: 5, name: 'Meera Reddy',  age: 27, location: 'Mohali, Punjab', match: 96, online: true,  premium: false, tags: ['Software Engineer', 'Cooking', 'Music'] },
  ];

  const testimonials = [
    {
      names: 'Priya & Arjun',
      location: 'Chandigarh',
      date: 'June 2024',
      quote: 'We found each other in the most unexpected, yet perfectly right way. TricityMatch knew what we needed before we did.',
      years: '2',
    },
    {
      names: 'Anjali & Rohan',
      location: 'Mohali',
      date: 'August 2024',
      quote: 'Trust was everything for us. The verification process gave us both the confidence to open up and truly connect.',
      years: '1',
    },
    {
      names: 'Meera & Vikram',
      location: 'Panchkula',
      date: 'September 2024',
      quote: 'From the first message to our engagement, everything felt intentional. This platform respects both families.',
      years: '1',
    },
  ];

  const timelineSteps = [
    {
      icon: <FiUser />,
      title: 'Create Your Profile',
      desc: 'Build a verified, detailed profile that reflects who you truly are — beyond the basics.',
    },
    {
      icon: <FiHeart />,
      title: 'Discover Matches',
      desc: 'Our AI surfaces compatible profiles based on values, lifestyle, and family expectations.',
    },
    {
      icon: <FiShield />,
      title: 'Connect Securely',
      desc: 'Every conversation is encrypted. Express interest, chat, and share when you\'re ready.',
    },
    {
      icon: <FiStar />,
      title: 'Begin Your Journey',
      desc: 'Meet in person with confidence. We\'ve done the groundwork so you can focus on what matters.',
    },
  ];

  const trustPoints = [
    { icon: <FiShield />, title: 'Identity Verified',        desc: 'Every profile undergoes government ID verification before going live.' },
    { icon: <FiLock />,   title: 'End-to-End Encrypted',    desc: 'Your conversations and data are encrypted and never shared.' },
    { icon: <FiCheckCircle />, title: 'Human-Moderated',    desc: 'Our safety team reviews profiles daily to keep the experience trustworthy.' },
    { icon: <FiUsers />,  title: 'Family-Approved Process', desc: 'Designed to include families at every step — built on mutual respect.' },
  ];

  const stats = [
    { value: '1,190+', label: 'Successful Matches' },
    { value: '50K+',   label: 'Verified Profiles' },
    { value: '98%',    label: 'Satisfaction Rate' },
    { value: '15+',    label: 'Years Trusted' },
  ];

  useEffect(() => {
    const t = setInterval(() => setActiveStory(p => (p + 1) % testimonials.length), 6000);
    return () => clearInterval(t);
  }, [testimonials.length]);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── HERO ────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
        {/* Background tint */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_65%_-10%,rgba(139,35,70,0.055),transparent)]" />

        {/* Rotating decorative rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
          className="absolute top-16 right-4 md:right-16 w-[28rem] h-[28rem] rounded-full border border-primary-100/50 pointer-events-none"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
          className="absolute top-24 right-10 md:right-24 w-[18rem] h-[18rem] rounded-full border border-gold-200/40 pointer-events-none"
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] gap-12 xl:gap-24 items-center">

            {/* Left — copy */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
              className="max-w-xl"
            >
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
                className="flex items-center gap-2.5 mb-7"
              >
                <span className="w-8 h-px bg-primary-400" />
                <span className="text-xs font-semibold text-primary-500 uppercase tracking-widest">
                  Tricity's Most Trusted Matrimony
                </span>
              </motion.div>

              <motion.h1
                variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.65 } } }}
                className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-neutral-900 leading-[1.04] mb-6"
              >
                Find Someone<br />
                <span className="relative inline-block">
                  <span className="relative z-10 text-primary-500">Worth Forever</span>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.9, delay: 0.85, ease: 'easeOut' }}
                    className="absolute bottom-1 left-0 right-0 h-2.5 bg-gold-200/55 rounded-full z-0 origin-left"
                  />
                </span>
              </motion.h1>

              <motion.p
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
                className="text-lg text-neutral-500 mb-10 leading-relaxed"
              >
                Connecting families across Chandigarh, Mohali and Panchkula through verified profiles,
                intelligent matching, and genuine human values.
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
                className="flex flex-col sm:flex-row gap-3 mb-10"
              >
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-all duration-200 shadow-burgundy hover:shadow-burgundy-lg hover:-translate-y-0.5"
                >
                  Create Free Profile
                  <FiArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/search"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border-2 border-neutral-200 text-neutral-700 font-semibold rounded-xl hover:border-primary-300 hover:text-primary-600 transition-all duration-200"
                >
                  Browse Profiles
                </Link>
              </motion.div>

              {/* Social proof */}
              <motion.div
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5, delay: 0.2 } } }}
                className="flex flex-wrap items-center gap-5 text-sm text-neutral-500"
              >
                <div className="flex items-center gap-1.5">
                  <FiCheckCircle className="w-4 h-4 text-success" />
                  <span>100% Verified</span>
                </div>
                <span className="h-4 w-px bg-neutral-200 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <FiShield className="w-4 h-4 text-success" />
                  <span>Privacy First</span>
                </div>
                <span className="h-4 w-px bg-neutral-200 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-primary-300 to-gold-400" />
                    ))}
                  </div>
                  <span>1,190+ matched</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right — stacked profile card (desktop) */}
            <motion.div
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease: 'easeOut' }}
              className="hidden lg:block relative"
            >
              {/* Stacked back layers */}
              <div className="absolute inset-0 rounded-2xl bg-primary-50 border border-primary-100 rotate-[-5deg] origin-bottom-left" />
              <div className="absolute inset-0 rounded-2xl bg-white border border-neutral-100 shadow-card rotate-[-2.5deg] origin-bottom-left" />

              {/* Front card */}
              <div className="relative bg-white rounded-2xl overflow-hidden border border-neutral-100 shadow-card-hover">
                <div className="h-52 bg-gradient-to-br from-primary-100 via-primary-50 to-gold-50 flex items-center justify-center relative">
                  <FiUser className="w-16 h-16 text-primary-300" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-white/90 rounded-full shadow-sm text-xs font-medium text-neutral-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Active now
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-neutral-800">Priya Sharma, 28</h4>
                      <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                        <FiMapPin className="w-3 h-3" /> Mohali, Punjab
                      </p>
                    </div>
                    <CompatibilityRing score={97} size={58} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {['MBA IIM', 'Family-first', 'Career-driven'].map((t, i) => (
                      <span key={i} className="px-2 py-0.5 text-[11px] rounded-full bg-primary-50 text-primary-600 border border-primary-100">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors">
                      Send Interest
                    </button>
                    <button className="w-10 h-10 border border-neutral-200 rounded-xl flex items-center justify-center hover:border-primary-200 hover:bg-primary-50 transition-colors">
                      <FiBookmark className="w-4 h-4 text-neutral-500" />
                    </button>
                    <button className="w-10 h-10 border border-neutral-200 rounded-xl flex items-center justify-center hover:border-primary-200 hover:bg-primary-50 transition-colors">
                      <FiMessageCircle className="w-4 h-4 text-neutral-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Floating notification */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-5 -left-10 bg-white rounded-2xl shadow-card-hover p-3 border border-neutral-100"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-success-50 flex items-center justify-center">
                    <FiHeart className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-800">New match found!</p>
                    <p className="text-[10px] text-neutral-400">97% compatibility</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── STATS STRIP ─────────────────────────── */}
      <section className="py-12 border-y border-neutral-100 bg-neutral-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09, duration: 0.5 }}
                className="text-center relative"
              >
                {i > 0 && (
                  <span className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 h-8 w-px bg-neutral-200" />
                )}
                <p className="font-display text-4xl font-bold text-primary-500 mb-1">{s.value}</p>
                <p className="text-sm text-neutral-500">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SMART MATCH PREVIEW ─────────────────── */}
      <section className="py-20 md:py-28 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <span className="text-xs font-semibold text-primary-400 uppercase tracking-widest block mb-3">
              Smart Matches
            </span>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-neutral-900">
                Profiles Matched<br />Just For You
              </h2>
              <Link
                to="/search"
                className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-primary-500 hover:text-primary-700 transition-colors"
              >
                View all matches <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Horizontal scroll */}
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-4 sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {featuredProfiles.map((profile, i) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.45 }}
            >
              <MatchPreviewCard profile={profile} />
            </motion.div>
          ))}

          {/* View more placeholder */}
          <Link
            to="/search"
            className="snap-start flex-shrink-0 w-[17rem] rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-3 p-8 hover:border-primary-300 hover:bg-primary-50/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-neutral-100 group-hover:bg-white flex items-center justify-center transition-colors shadow-sm">
              <FiArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-primary-500 transition-colors" />
            </div>
            <p className="text-sm font-medium text-neutral-500 group-hover:text-primary-500 transition-colors text-center leading-snug">
              Explore all<br />50,000+ profiles
            </p>
          </Link>
        </div>

        <div className="container mx-auto px-4 sm:px-6 mt-5">
          <Link
            to="/search"
            className="sm:hidden inline-flex items-center gap-2 text-sm font-semibold text-primary-500"
          >
            View all matches <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────── */}
      <section className="py-20 md:py-28 bg-neutral-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-start">

            {/* Left — sticky heading */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:sticky lg:top-28"
            >
              <span className="text-xs font-semibold text-primary-400 uppercase tracking-widest block mb-3">
                The Process
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 mb-5">
                From Profile to<br />Perfect Match
              </h2>
              <p className="text-neutral-500 leading-relaxed mb-8">
                We've designed every step with intentionality — because finding a life partner
                deserves more than an algorithm.
              </p>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-all duration-200 shadow-burgundy hover:-translate-y-0.5"
              >
                Begin Your Journey
                <FiArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Right — timeline */}
            <div>
              {timelineSteps.map((step, i) => (
                <TimelineStep key={i} step={step} index={i} total={timelineSteps.length} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST & SAFETY ──────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[2fr_3fr] gap-14 lg:gap-20 items-center">

            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-xs font-semibold text-primary-400 uppercase tracking-widest block mb-3">
                Safety First
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 mb-5">
                Built on Trust,<br />Backed by Action
              </h2>
              <p className="text-neutral-500 leading-relaxed">
                We don't just ask for trust — we earn it. Every feature and every process is designed
                to protect your privacy, safety, and dignity.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-4">
              {trustPoints.map((pt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  whileHover={{ y: -4 }}
                  className="p-5 rounded-2xl border border-neutral-100 bg-neutral-50 hover:bg-white hover:border-primary-100 hover:shadow-card transition-all duration-200 group cursor-default"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    {React.cloneElement(pt.icon, { className: 'w-4.5 h-4.5' })}
                  </div>
                  <h4 className="font-semibold text-neutral-800 mb-1.5">{pt.title}</h4>
                  <p className="text-sm text-neutral-500 leading-relaxed">{pt.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── REAL STORIES ────────────────────────── */}
      <section className="py-20 md:py-28 bg-neutral-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="text-xs font-semibold text-primary-400 uppercase tracking-widest block mb-3">
                Real Couples
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-neutral-900">
                Stories That<br />Begin Here
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStory(p => (p - 1 + testimonials.length) % testimonials.length)}
                className="w-10 h-10 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-primary-300 hover:bg-primary-50 transition-all"
                aria-label="Previous story"
              >
                <FiChevronLeft className="w-4 h-4 text-neutral-600" />
              </button>
              <button
                onClick={() => setActiveStory(p => (p + 1) % testimonials.length)}
                className="w-10 h-10 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-primary-300 hover:bg-primary-50 transition-all"
                aria-label="Next story"
              >
                <FiChevronRight className="w-4 h-4 text-neutral-600" />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <StoryCard key={activeStory} story={testimonials[activeStory]} />
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-10">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveStory(i)}
                aria-label={`Story ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeStory ? 'w-8 bg-primary-500' : 'w-1.5 bg-neutral-300 hover:bg-neutral-400'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA CLOSURE ─────────────────────────── */}
      <section className="py-24 md:py-32 relative overflow-hidden bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/75 via-neutral-900 to-neutral-900" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
          className="absolute -right-40 -bottom-40 w-[30rem] h-[30rem] rounded-full border border-white/5 pointer-events-none"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          className="absolute -left-24 -top-24 w-[20rem] h-[20rem] rounded-full border border-white/5 pointer-events-none"
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65 }}
            >
              <span className="text-xs font-semibold text-gold uppercase tracking-widest block mb-6">
                Your Story Awaits
              </span>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Every great love story<br />starts with one step.
              </h2>
              <p className="text-neutral-400 text-lg mb-10 leading-relaxed">
                Join thousands of families who trusted TricityMatch to find their forever partner.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-400 transition-all duration-200 shadow-burgundy hover:-translate-y-0.5"
                >
                  Create Your Profile — Free
                  <FiArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/search"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/5 transition-all duration-200"
                >
                  Browse Profiles
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────── */}
      <footer className="py-10 bg-neutral-900 border-t border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="font-display text-2xl font-bold text-white">TricityMatch</span>
              <p className="text-xs text-neutral-500 mt-1">Chandigarh · Mohali · Panchkula</p>
            </div>
            <nav className="flex flex-wrap justify-center gap-6 text-sm text-neutral-500">
              {['About', 'Contact', 'Privacy', 'Terms', 'Safety'].map(l => (
                <Link key={l} to={`/${l.toLowerCase()}`} className="hover:text-neutral-300 transition-colors">
                  {l}
                </Link>
              ))}
            </nav>
            <p className="text-xs text-neutral-600">© 2026 TricityMatch</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Home;
