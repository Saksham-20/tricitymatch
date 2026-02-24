import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiEye, FiHeart, FiUsers, FiTrendingUp, FiMessageCircle,
  FiStar, FiArrowRight, FiCheckCircle, FiSun, FiMoon, FiCoffee,
  FiSearch, FiChevronRight,
} from 'react-icons/fi';
import { formatCompatibilityScore } from '../utils/compatibility';
import { staggerContainer, fadeInUp } from '../utils/animations';
import { API_BASE_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { MatchCard } from '../components/cards';
import ProfileCompletionMeter from '../components/profile/ProfileCompletionMeter';
import { getImageUrl } from '../utils/cloudinary';

// ─── Skeleton loaders ──────────────────────────────────────────────────────
const StatSkeleton = () => (
  <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-5 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <div className="h-3 w-24 bg-neutral-200 rounded" />
        <div className="h-8 w-14 bg-neutral-200 rounded-lg" />
        <div className="h-2.5 w-16 bg-neutral-100 rounded" />
      </div>
      <div className="w-12 h-12 bg-neutral-100 rounded-2xl" />
    </div>
  </div>
);

const CardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden animate-pulse flex-shrink-0 w-64 md:w-auto">
    <div className="h-52 bg-neutral-200" />
    <div className="p-4 space-y-2">
      <div className="h-4 w-3/4 bg-neutral-200 rounded" />
      <div className="h-3 w-1/2 bg-neutral-100 rounded" />
      <div className="h-3 w-2/3 bg-neutral-100 rounded" />
    </div>
  </div>
);

// ─── Suggestion card — premium inline component ────────────────────────────
const SuggestionCard = ({ profile, index }) => {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(profile.matchStatus === 'like');

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Profile';
  const initials  = (profile.firstName?.[0] || '') + (profile.lastName?.[0] || '') || '?';
  const age = profile.age || (profile.dateOfBirth
    ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
    : null);
  const score = profile.compatibilityScore;
  const scoreColor = score >= 85 ? 'text-success' : score >= 70 ? 'text-gold-600' : 'text-primary-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      onClick={() => profile.userId && navigate(`/profile/${profile.userId}`)}
      className="cursor-pointer bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden group flex-shrink-0 w-56 sm:w-auto"
    >
      {/* Photo */}
      <div className="relative h-52 overflow-hidden bg-neutral-100">
        {(profile.profilePhoto || profile.profile_photo) ? (
          <img
            src={getImageUrl(profile.profilePhoto || profile.profile_photo, API_BASE_URL, 'profile')}
            alt={fullName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div className={`absolute inset-0 bg-gradient-to-br from-primary-100 via-gold-50 to-primary-50 items-center justify-center ${(profile.profilePhoto || profile.profile_photo) ? 'hidden' : 'flex'}`}>
          <span className="text-4xl font-bold text-primary-300">{initials}</span>
        </div>

        {/* Gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Match score badge */}
        {score >= 75 && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-neutral-900/85 backdrop-blur-sm rounded-full flex items-center gap-1.5">
            <FiStar className="w-3 h-3 text-gold fill-gold" />
            <span className="text-white text-[11px] font-bold">{Math.round(score)}%</span>
          </div>
        )}

        {/* Shortlist / heart overlay */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); setIsLiked(!isLiked); }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all ${
            isLiked ? 'bg-primary-500 text-white' : 'bg-white/90 backdrop-blur-sm text-neutral-500 hover:text-primary-500'
          }`}
        >
          <FiHeart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </motion.button>

        {/* Name on image */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white font-semibold text-sm leading-tight">{fullName}</p>
          {age && <p className="text-white/80 text-xs">{age} yrs · {profile.city || 'India'}</p>}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-3 flex items-center justify-between">
        {profile.education && (
          <span className="text-xs text-neutral-500 truncate max-w-[70%]">{profile.education}</span>
        )}
        {score && (
          <span className={`text-xs font-bold ml-auto ${scoreColor}`}>{Math.round(score)}% match</span>
        )}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats]               = useState({ viewsThisWeek: 0, totalViews: 0, likesReceived: 0 });
  const [suggestions, setSuggestions]   = useState([]);
  const [mutualMatches, setMutualMatches] = useState([]);
  const [userProfile, setUserProfile]   = useState(null);
  const [loading, setLoading]           = useState(true);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour      = new Date().getHours();
    const firstName = user?.firstName || 'there';
    if (hour >= 5  && hour < 12) return { text: `Good morning, ${firstName}`, icon: FiCoffee, subtext: 'Start your day with meaningful connections' };
    if (hour >= 12 && hour < 17) return { text: `Good afternoon, ${firstName}`, icon: FiSun,    subtext: 'Perfect time to explore new profiles' };
    if (hour >= 17 && hour < 21) return { text: `Good evening, ${firstName}`, icon: FiSun,    subtext: 'Wind down with some profile browsing' };
    return                               { text: `Good night, ${firstName}`,   icon: FiMoon,   subtext: 'Your perfect match might be just a click away' };
  }, [user]);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, suggestionsRes, matchesRes, profileRes] = await Promise.allSettled([
        api.get('/profile/me/stats').catch(() => ({ data: { stats: null } })),
        api.get('/search/suggestions?limit=8').catch(() => ({ data: { suggestions: [] } })),
        api.get('/match/mutual').catch(() => ({ data: { mutualMatches: [] } })),
        api.get('/profile/me').catch(() => ({ data: { profile: null } })),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data?.stats) {
        setStats(statsRes.value.data.stats);
      }

      if (suggestionsRes.status === 'fulfilled') {
        const res = suggestionsRes.value?.data;
        const raw = Array.isArray(res) ? res
          : res?.suggestions ?? res?.data?.suggestions ?? [];
        setSuggestions(
          raw.map(p => ({
            ...p,
            userId:       p.userId || p.id || p.User?.id,
            firstName:    p.firstName || p.first_name || 'Unknown',
            lastName:     p.lastName  || p.last_name  || '',
            city:         p.city      || p.location   || 'India',
            profilePhoto: p.profilePhoto || p.profile_photo || null,
          })).filter(p => p.userId)
        );
      }

      if (matchesRes.status === 'fulfilled') {
        const res = matchesRes.value?.data;
        const raw = Array.isArray(res) ? res
          : res?.mutualMatches ?? res?.data?.mutualMatches ?? [];
        setMutualMatches(
          raw.map(m => ({
            ...m,
            userId:       m.userId || m.id || m.User?.id,
            firstName:    m.firstName || m.first_name || 'Unknown',
            lastName:     m.lastName  || m.last_name  || '',
            city:         m.city      || m.location   || 'India',
            profilePhoto: m.profilePhoto || m.profile_photo || null,
          })).filter(m => m.userId)
        );
      }

      // ── Real profile data for completion meter ──────────────────────────
      if (profileRes.status === 'fulfilled') {
        const res = profileRes.value?.data;
        // Backend returns { success: true, profile: {...} }
        const p = res?.profile ?? res?.data?.profile ?? null;
        if (p && typeof p === 'object' && (p.id || p.userId || p.firstName)) {
          setUserProfile(p);
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Stat cards config ──────────────────────────────────────────────────────
  const statsConfig = [
    {
      key:       'viewsThisWeek',
      label:     'Profile Views',
      sublabel:  'This week',
      icon:      FiEye,
      iconBg:    'bg-primary-50',
      iconColor: 'text-primary-500',
      numColor:  'text-primary-600',
    },
    {
      key:       'totalViews',
      label:     'Total Views',
      sublabel:  'All time',
      icon:      FiTrendingUp,
      iconBg:    'bg-gold-50',
      iconColor: 'text-gold-600',
      numColor:  'text-gold-700',
    },
    {
      key:       'likesReceived',
      label:     'Interests Received',
      sublabel:  'Total',
      icon:      FiHeart,
      iconBg:    'bg-primary-50',
      iconColor: 'text-primary-400',
      numColor:  'text-primary-500',
    },
    {
      key:        'mutualMatches',
      label:      'Mutual Matches',
      sublabel:   'Ready to chat',
      icon:       FiUsers,
      iconBg:     'bg-success-50',
      iconColor:  'text-success',
      numColor:   'text-success',
      customValue: true,
    },
  ];

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Greeting skeleton */}
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-card p-8 animate-pulse">
            <div className="h-5 w-36 bg-neutral-200 rounded mb-3" />
            <div className="h-9 w-72 bg-neutral-200 rounded-xl mb-2" />
            <div className="h-4 w-56 bg-neutral-100 rounded" />
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => <StatSkeleton key={i} />)}
          </div>
          {/* Cards skeleton */}
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="min-h-screen bg-neutral-50 pb-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── 1. Greeting Card ─────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #8B2346 0%, #6B1D3A 60%, #401123 100%)',
            }}
          >
            {/* Decorative rings */}
            <div className="absolute -top-16 -right-16 w-64 h-64 border border-white/10 rounded-full pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 border border-white/10 rounded-full pointer-events-none" />
            <div className="absolute top-6 right-48 w-3 h-3 bg-gold/40 rounded-full pointer-events-none" />
            <div className="absolute bottom-6 right-24 w-2 h-2 bg-white/30 rounded-full pointer-events-none" />

            <div className="relative z-10 px-6 py-8 md:px-10 md:py-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Greeting */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center">
                      <greeting.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white/70 text-sm font-medium">Your Dashboard</span>
                  </div>
                  <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
                    {greeting.text}
                  </h1>
                  <p className="text-white/75 text-base">{greeting.subtext}</p>

                  {stats.viewsThisWeek > 5 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 rounded-full"
                    >
                      <FiStar className="w-3.5 h-3.5 text-gold" />
                      <span className="text-white text-xs font-medium">
                        {stats.viewsThisWeek} profile views this week
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Right: Quick actions */}
                <div className="flex flex-row md:flex-col gap-3 flex-shrink-0">
                  <Link
                    to="/search"
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-white text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-50 transition-colors shadow-md"
                  >
                    <FiSearch className="w-4 h-4" />
                    Find Matches
                  </Link>
                  <Link
                    to="/chat"
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-white/15 text-white border border-white/25 rounded-xl text-sm font-semibold hover:bg-white/25 transition-colors"
                  >
                    <FiMessageCircle className="w-4 h-4" />
                    Messages
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 2. Stats row ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsConfig.map((stat, i) => {
            const Icon  = stat.icon;
            const value = stat.customValue ? mutualMatches.length : (stats?.[stat.key] ?? 0);
            return (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="bg-white rounded-2xl border border-neutral-100 shadow-card p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-neutral-500 text-xs font-medium mb-2">{stat.label}</p>
                    <motion.p
                      className={`text-4xl font-bold ${stat.numColor}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                    >
                      {value}
                    </motion.p>
                    <p className="text-[11px] text-neutral-400 mt-1">{stat.sublabel}</p>
                  </div>
                  <div className={`w-11 h-11 ${stat.iconBg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── 3. Profile Completion ─────────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <ProfileCompletionMeter profile={userProfile || user?.profile || {}} />
        </motion.div>

        {/* ── 4. Mutual Matches ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {mutualMatches.length > 0 && (
            <motion.section
              variants={fadeInUp}
              initial="initial"
              animate="animate"
            >
              {/* Section header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-1 h-6 bg-gold rounded-full" />
                    <h2 className="font-display text-2xl md:text-3xl font-bold text-neutral-900">
                      Mutual Matches
                    </h2>
                    <span className="px-2.5 py-0.5 bg-success-50 text-success text-xs font-bold rounded-full border border-success-100">
                      {mutualMatches.length} new
                    </span>
                  </div>
                  <p className="text-neutral-500 text-sm ml-3.5">
                    These people liked you back — start a conversation
                  </p>
                </div>
                <Link
                  to="/chat"
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors shadow-burgundy"
                >
                  <FiMessageCircle className="w-4 h-4" />
                  Open Chat
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {mutualMatches.slice(0, 3).map((match, i) => (
                  <MatchCard
                    key={`match-${match.userId}-${i}`}
                    match={match}
                    userId={match.userId}
                    index={i}
                    onChat={() => navigate('/chat')}
                  />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── 5. Suggested Profiles ─────────────────────────────────────────── */}
        {suggestions.length > 0 && (
          <motion.section variants={fadeInUp}>
            {/* Section header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-1 h-6 bg-primary-400 rounded-full" />
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-neutral-900">
                    Curated for You
                  </h2>
                  <span className="px-2.5 py-0.5 bg-primary-50 text-primary-600 text-xs font-semibold rounded-full border border-primary-100">
                    AI matched
                  </span>
                </div>
                <p className="text-neutral-500 text-sm ml-3.5">
                  Handpicked profiles based on your preferences
                </p>
              </div>
              <Link
                to="/search"
                className="hidden sm:inline-flex items-center gap-1.5 text-primary-500 font-semibold text-sm hover:text-primary-600 transition-colors"
              >
                View all
                <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="flex gap-4 overflow-x-auto pb-3 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-5 scrollbar-hide snap-x snap-mandatory">
              {suggestions.map((profile, i) => (
                <div key={`suggestion-${profile.userId}-${i}`} className="snap-start">
                  <SuggestionCard profile={profile} index={i} />
                </div>
              ))}
            </div>

            {/* Mobile: View all link */}
            <div className="mt-4 sm:hidden text-center">
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 text-primary-500 font-semibold text-sm"
              >
                View all profiles <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.section>
        )}

        {/* ── 6. Empty state ─────────────────────────────────────────────────── */}
        {suggestions.length === 0 && mutualMatches.length === 0 && (
          <motion.div
            variants={fadeInUp}
            className="bg-white border border-neutral-100 rounded-3xl shadow-card text-center py-16 px-6"
          >
            <motion.div
              className="w-20 h-20 bg-gradient-to-br from-primary-50 to-gold-50 rounded-2xl flex items-center justify-center mx-auto mb-6"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <FiUsers className="w-10 h-10 text-primary-400" />
            </motion.div>
            <h3 className="font-display text-2xl font-bold text-neutral-900 mb-2">
              Complete Your Profile
            </h3>
            <p className="text-neutral-500 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
              Add more details and photos to get personalised match suggestions from the Tricity area.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/profile/edit')}
                className="btn-primary inline-flex items-center gap-2"
              >
                <FiCheckCircle className="w-4 h-4" />
                Complete Profile
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/search')}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <FiSearch className="w-4 h-4" />
                Browse Profiles
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Dashboard;
