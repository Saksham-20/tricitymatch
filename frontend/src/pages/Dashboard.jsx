import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiEye, FiHeart, FiUsers, FiTrendingUp, FiMessageCircle,
  FiStar, FiArrowRight, FiCheckCircle, FiSun, FiMoon, FiCoffee,
  FiSearch, FiChevronRight, FiLock, FiUnlock, FiCalendar, FiZap,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { formatCompatibilityScore } from '../utils/compatibility';
import { staggerContainer, fadeInUp } from '../utils/animations';
import { API_BASE_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { MatchCard } from '../components/cards';
import ProfileCompletionMeter, { getCompletionData } from '../components/profile/ProfileCompletionMeter';
import { getImageUrl } from '../utils/cloudinary';
import UpgradeModal from '../components/common/UpgradeModal';
import SectionHeader from '../components/common/SectionHeader';

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
  const [isLiked, setIsLiked] = useState(profile.matchStatus === 'like');
  const [likeBusy, setLikeBusy] = useState(false);

  // Persist the shortlist/interest to the backend (optimistic + revert on error).
  const toggleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (likeBusy || !profile.userId) return;
    const next = !isLiked;
    setIsLiked(next);
    setLikeBusy(true);
    try {
      await api.post(`/match/${profile.userId}`, { action: next ? 'like' : 'pass' });
      toast.success(next ? 'Interest expressed!' : 'Removed from your interests');
    } catch (err) {
      setIsLiked(!next); // revert optimistic update
      toast.error(err.response?.data?.message || 'Could not update — please try again');
    } finally {
      setLikeBusy(false);
    }
  };

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
      className="relative bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden group flex-shrink-0 w-56 sm:w-auto"
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
        <div className={`absolute inset-0 bg-primary-100 dark:bg-primary-900/40 items-center justify-center ${(profile.profilePhoto || profile.profile_photo) ? 'hidden' : 'flex'}`}>
          <span className="font-display text-4xl font-semibold text-primary-700 dark:text-primary-300">{initials}</span>
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
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={toggleLike}
          disabled={likeBusy}
          aria-pressed={isLiked}
          aria-label={isLiked ? `Remove ${fullName} from your interests` : `Express interest in ${fullName}`}
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:opacity-60 ${
            isLiked ? 'bg-primary-500 text-white' : 'bg-white/90 backdrop-blur-sm text-neutral-500 hover:text-primary-500'
          }`}
        >
          <FiHeart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </motion.button>

        {/* Name on image — stretched Link makes the whole card a single
            keyboard-focusable navigation target (no nested-interactive issue). */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {profile.userId ? (
            <Link
              to={`/profile/${profile.userId}`}
              className="text-white font-semibold text-sm leading-tight rounded after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1"
            >
              {fullName}
            </Link>
          ) : (
            <p className="text-white font-semibold text-sm leading-tight">{fullName}</p>
          )}
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

// ─── Subscription Status Card ─────────────────────────────────────────────
const PLAN_META = {
  free:          { label: 'Free Plan',      color: 'text-neutral-500', bg: 'bg-neutral-100',      crown: null },
  basic_premium: { label: 'Basic Premium',  color: 'text-primary-600', bg: 'bg-primary-50',        crown: 'text-primary-400' },
  premium_plus:  { label: 'Premium Plus',   color: 'text-gold-700',    bg: 'bg-gold-50',           crown: 'text-gold-500' },
  vip:           { label: 'VIP Member',     color: 'text-gold-700',    bg: 'bg-gold-50',           crown: 'text-gold-500' },
};

const SubscriptionStatusCard = ({ subscription, navigate }) => {
  const plan   = subscription?.planType || 'free';
  const meta   = PLAN_META[plan] || PLAN_META.free;
  const isFree = plan === 'free' || subscription?.status !== 'active';

  const unlocksAllowed = subscription?.contactUnlocksAllowed ?? null;
  const unlocksUsed    = subscription?.contactUnlocksUsed    ?? 0;
  const unlocksLeft    = unlocksAllowed === null ? null : Math.max(0, unlocksAllowed - unlocksUsed);
  const showUnlockBar  = plan === 'basic_premium' && unlocksAllowed !== null;

  const endDate = subscription?.endDate ? new Date(subscription.endDate) : null;
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  if (isFree) {
    return (
      <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <FaCrown className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Unlock Premium Features</p>
            <p className="text-white/70 text-xs">View contacts, see who viewed you &amp; more</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/subscription')}
          className="flex-shrink-0 px-5 py-2.5 bg-white text-primary-600 rounded-xl text-sm font-bold hover:bg-primary-50 transition-colors shadow-md"
        >
          Upgrade Now
        </button>
      </div>
    );
  }

  return (
    <div className={`${meta.bg} rounded-2xl p-5 border border-neutral-100`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Plan info */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <FaCrown className={`w-5 h-5 ${meta.crown || 'text-neutral-400'}`} />
          </div>
          <div>
            <p className={`font-bold text-sm ${meta.color}`}>{meta.label}</p>
            {daysLeft !== null && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <FiCalendar className="w-3 h-3 text-neutral-400" />
                <span className="text-xs text-neutral-500">
                  {daysLeft > 0 ? `${daysLeft} days remaining` : 'Expires today'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Unlock counter (basic_premium only) or unlimited badge */}
        <div className="flex items-center gap-4">
          {showUnlockBar ? (
            <div className="flex-1 sm:flex-none sm:w-48">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <FiUnlock className="w-3.5 h-3.5 text-primary-500" />
                  <span className="text-xs font-semibold text-neutral-700">Contact Unlocks</span>
                </div>
                <span className="text-xs font-bold text-primary-600">{unlocksLeft} / {unlocksAllowed} left</span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all"
                  style={{ width: `${unlocksAllowed ? ((unlocksAllowed - unlocksLeft) / unlocksAllowed) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-sm">
              <FiZap className="w-3.5 h-3.5 text-gold-500" />
              <span className="text-xs font-semibold text-neutral-700">Unlimited Unlocks</span>
            </div>
          )}
          <button
            onClick={() => navigate('/subscription')}
            className="text-xs font-semibold text-neutral-500 hover:text-primary-500 transition-colors whitespace-nowrap"
          >
            Manage Plan
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats]               = useState({ viewsThisWeek: 0, totalViews: 0, likesReceived: 0 });
  const [suggestions, setSuggestions]   = useState([]);
  const [dailyMatches, setDailyMatches] = useState([]);
  const [dailyMeta, setDailyMeta]       = useState({ isPremium: false });
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [mutualMatches, setMutualMatches] = useState([]);
  const [userProfile, setUserProfile]   = useState(null);
  const [profileViewers, setProfileViewers] = useState([]);
  const [hasPremium, setHasPremium]      = useState(false);
  const [subscription, setSubscription]  = useState(null);
  const [loading, setLoading]           = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour      = new Date().getHours();
    const firstName = user?.firstName || user?.Profile?.firstName || user?.profile?.firstName || 'there';
    if (hour >= 5  && hour < 12) return { text: `Good morning, ${firstName}`, icon: FiCoffee, subtext: 'Start your day with meaningful connections' };
    if (hour >= 12 && hour < 17) return { text: `Good afternoon, ${firstName}`, icon: FiSun,    subtext: 'Perfect time to explore new profiles' };
    if (hour >= 17 && hour < 21) return { text: `Good evening, ${firstName}`, icon: FiSun,    subtext: 'Wind down with some profile browsing' };
    return                               { text: `Good night, ${firstName}`,   icon: FiMoon,   subtext: 'Your perfect match might be just a click away' };
  }, [user]);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, suggestionsRes, matchesRes, profileRes, subRes, dailyRes, recentRes] = await Promise.allSettled([
        api.get('/profile/me/stats').catch(() => ({ data: { stats: null } })),
        // Fetch a wider pool so "Curated for You" still has fresh picks after we
        // strip out anyone already shown in "Today's Matches" (see dedup below).
        api.get('/search/suggestions?limit=24').catch(() => ({ data: { suggestions: [] } })),
        api.get('/match/mutual').catch(() => ({ data: { mutualMatches: [] } })),
        api.get('/profile/me').catch(() => ({ data: { profile: null } })),
        api.get('/subscription/my-subscription').catch(() => ({ data: { subscription: null } })),
        api.get('/match/daily').catch(() => ({ data: { matches: [] } })),
        api.get('/profile/me/recently-viewed?limit=8').catch(() => ({ data: { profiles: [] } })),
      ]);

      const normalizeProfile = (p) => ({
        ...p,
        userId:       p.userId || p.id || p.User?.id,
        firstName:    p.firstName || p.first_name || 'Unknown',
        lastName:     p.lastName  || p.last_name  || '',
        city:         p.city      || p.location   || 'India',
        profilePhoto: p.profilePhoto || p.profile_photo || null,
      });

      if (dailyRes.status === 'fulfilled') {
        const d = dailyRes.value?.data;
        setDailyMatches((d?.matches ?? []).map(normalizeProfile).filter(p => p.userId));
        setDailyMeta({ isPremium: !!d?.isPremium });
      }

      if (recentRes.status === 'fulfilled') {
        const r = recentRes.value?.data;
        setRecentlyViewed((r?.profiles ?? []).map(normalizeProfile).filter(p => p.userId));
      }

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
        const p = res?.profile ?? res?.data?.profile ?? null;
        if (p && typeof p === 'object' && (p.id || p.userId || p.firstName)) {
          setUserProfile(p);
        }
      }

      // ── Subscription status ───────────────────────────────────────────
      if (subRes.status === 'fulfilled') {
        const res = subRes.value?.data;
        const currentSubscription = res?.subscription ?? null;
        setSubscription(currentSubscription);

        const isPremiumActive =
          !!currentSubscription &&
          ['basic_premium', 'premium_plus', 'vip'].includes(currentSubscription.planType) &&
          (currentSubscription.status === 'active' || currentSubscription.isActive === true);

        setHasPremium(isPremiumActive);

        if (isPremiumActive) {
          try {
            const viewersRes = await api.get('/profile/me/viewers?limit=6');
            const viewers = viewersRes?.data?.viewers ?? [];
            setProfileViewers(viewers);
          } catch {
            // Premium check can race with backend sync right after payment; keep UI stable.
            setProfileViewers([]);
          }
        } else {
          setProfileViewers([]);
        }
      } else {
        setSubscription(null);
        setHasPremium(false);
        setProfileViewers([]);
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
      to:         '/chat',
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

  // "Today's Matches" (/match/daily) and "Curated for You" (/search/suggestions)
  // rank the same candidate pool the same way, so the top picks overlap and the
  // two sections showed identical people. Hide anyone already in Today's Matches
  // from Curated so each section earns its place.
  const dailyIds = new Set(dailyMatches.map(p => p.userId));
  const curatedSuggestions = suggestions.filter(p => !dailyIds.has(p.userId)).slice(0, 8);

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="min-h-screen bg-neutral-50 pb-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── 1. Greeting Card — LIGHT hero (burgundy as accent, not flat fill) ── */}
        <motion.div variants={fadeInUp}>
          <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-[#1a1f2e] border border-neutral-100 dark:border-neutral-800 shadow-card">
            {/* Thin burgundy left rail + subtle primary wash */}
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary-500 to-primary-700 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary-50/70 dark:from-primary-900/20 via-transparent to-transparent pointer-events-none" />
            {/* Faint neutral decorative rings */}
            <div className="absolute -top-16 -right-16 w-64 h-64 border border-neutral-200/60 dark:border-neutral-700/40 rounded-full pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-44 h-44 border border-neutral-200/50 dark:border-neutral-700/30 rounded-full pointer-events-none" />

            <div className="relative z-10 px-6 py-8 md:px-10 md:py-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Greeting */}
                <div>
                  <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 bg-gold-50 border border-gold-200 rounded-full">
                    <greeting.icon className="w-3.5 h-3.5 text-gold-600" />
                    <span className="text-gold-700 text-xs font-semibold uppercase tracking-wide">Your Dashboard</span>
                  </div>
                  <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    {greeting.text}
                  </h1>
                  <p className="text-neutral-500 text-base">{greeting.subtext}</p>

                  {stats.viewsThisWeek > 5 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800 rounded-full"
                    >
                      <FiStar className="w-3.5 h-3.5 text-gold-500" />
                      <span className="text-primary-700 dark:text-primary-300 text-xs font-medium">
                        {stats.viewsThisWeek} profile views this week
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Right: Quick actions — 1 primary + 1 ghost */}
                <div className="flex flex-row md:flex-col gap-3 flex-shrink-0">
                  <Link
                    to="/search"
                    className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl text-sm font-semibold hover:-translate-y-0.5 transition-transform shadow-burgundy"
                  >
                    <FiSearch className="w-4 h-4" />
                    Find Matches
                  </Link>
                  <Link
                    to="/chat"
                    className="flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-transparent text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-700 rounded-xl text-sm font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
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
            // Only cards with a real destination get the hover-lift + link wrapper —
            // otherwise the lift implies a click that goes nowhere.
            const Wrapper = stat.to ? Link : 'div';
            const wrapperProps = stat.to
              ? { to: stat.to, className: 'block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-2xl' }
              : {};
            return (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={stat.to ? { y: -3, transition: { duration: 0.2 } } : undefined}
                className="bg-white rounded-2xl border border-neutral-100 shadow-card p-5"
              >
                <Wrapper {...wrapperProps}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-neutral-500 text-xs font-medium mb-2">{stat.label}</p>
                    <motion.p
                      className="font-display text-3xl font-bold text-neutral-900 dark:text-neutral-100"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                    >
                      {value}
                    </motion.p>
                    <p className="text-[11px] text-neutral-400 mt-1">{stat.sublabel}</p>
                  </div>
                  <div className="w-11 h-11 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary-500" />
                  </div>
                </div>
                </Wrapper>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── 3. Subscription Status Card ──────────────────────────────── */}
        {subscription && (
          <motion.div variants={fadeInUp}>
            <SubscriptionStatusCard subscription={subscription} navigate={navigate} />
          </motion.div>
        )}

        {/* ── 4. Profile Completion — hidden when all important fields done ── */}
        {!getCompletionData(userProfile || user?.profile || {}).allImportantDone && (
          <motion.div variants={fadeInUp}>
            <ProfileCompletionMeter profile={userProfile || user?.profile || {}} />
          </motion.div>
        )}

        {/* ── 4. Mutual Matches ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {mutualMatches.length > 0 && (
            <motion.section
              variants={fadeInUp}
              initial="initial"
              animate="animate"
            >
              <SectionHeader
                title="Mutual Matches"
                subtitle="These people liked you back — start a conversation"
                count={`${mutualMatches.length} new`}
                countTone="ok"
                action={
                  <Link
                    to="/chat"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors shadow-burgundy"
                  >
                    <FiMessageCircle className="w-4 h-4" />
                    Open Chat
                  </Link>
                }
              />

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

        {/* ── 4b. Who Viewed Your Profile ───────────────────────────────── */}
        <motion.section variants={fadeInUp}>
          <SectionHeader
            tone="gold"
            title="Who Viewed You"
            subtitle={hasPremium ? 'People who visited your profile recently' : 'Upgrade to see who viewed your profile'}
            count={hasPremium && profileViewers.length > 0 ? `${profileViewers.length} recent` : undefined}
            countTone="gold"
          />

          {hasPremium && profileViewers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {profileViewers.slice(0, 6).map((viewer, i) => {
                const viewerName = `${viewer.firstName || ''} ${viewer.lastName || ''}`.trim() || 'User';
                const initials = (viewer.firstName?.[0] || '') + (viewer.lastName?.[0] || '') || '?';
                return (
                  <motion.div
                    key={`viewer-${viewer.userId}-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -3 }}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${viewerName}'s profile`}
                    onClick={() => viewer.userId && navigate(`/profile/${viewer.userId}`)}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && viewer.userId) { e.preventDefault(); navigate(`/profile/${viewer.userId}`); } }}
                    className="cursor-pointer bg-white rounded-xl border border-neutral-100 shadow-card overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                  >
                    <div className="h-28 bg-neutral-100 overflow-hidden">
                      {viewer.profilePhoto ? (
                        <img
                          src={getImageUrl(viewer.profilePhoto, API_BASE_URL, 'profile')}
                          alt={viewerName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/40">
                          <span className="font-display text-2xl font-semibold text-primary-700 dark:text-primary-300">{initials}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 text-center">
                      <p className="text-xs font-semibold text-neutral-800 truncate">{viewerName}</p>
                      {viewer.city && <p className="text-[10px] text-neutral-400 truncate">{viewer.city}</p>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : hasPremium && profileViewers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-8 text-center">
              <FiEye className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No one has viewed your profile yet. Complete your profile to attract visitors!</p>
            </div>
          ) : (
            /* Locked state for free users */
            <div className="relative bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden">
              {/* Blurred placeholder */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-5 blur-sm pointer-events-none select-none" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-neutral-100 rounded-xl h-28 animate-pulse" />
                ))}
              </div>
              {/* Overlay CTA */}
              <div className="absolute inset-0 bg-white/80 dark:bg-[#0f1117]/85 backdrop-blur-[2px] flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-gold-50 dark:bg-[#2a2010] flex items-center justify-center mb-3">
                  <FiLock className="w-5 h-5 text-gold-600" />
                </div>
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">Premium Feature</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 max-w-xs text-center">See who's interested in your profile</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowUpgradeModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-neutral-900 text-sm font-semibold rounded-xl hover:bg-gold-400 transition-colors shadow-gold"
                >
                  <FaCrown className="w-3.5 h-3.5" /> Upgrade to Premium
                </motion.button>
              </div>
            </div>
          )}
        </motion.section>

        {/* ── 4c. Today's Matches (daily cached set) ───────────────────────── */}
        {dailyMatches.length > 0 && (
          <motion.section variants={fadeInUp}>
            <SectionHeader
              tone="gold"
              title="Today's Matches"
              subtitle="Hand-picked for you, refreshed every day"
              count="Daily"
              countTone="gold"
            />

            <div className="flex gap-4 overflow-x-auto pb-3 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-5 scrollbar-hide snap-x snap-mandatory">
              {dailyMatches.map((profile, i) => (
                <div key={`daily-${profile.userId}-${i}`} className="snap-start">
                  <SuggestionCard profile={profile} index={i} />
                </div>
              ))}
            </div>

            {!dailyMeta.isPremium && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate('/subscription')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-neutral-900 text-sm font-semibold rounded-xl hover:bg-gold-400 transition-colors shadow-gold"
                >
                  <FaCrown className="w-3.5 h-3.5" /> Upgrade to see more matches today
                </button>
              </div>
            )}
          </motion.section>
        )}

        {/* ── 4d. Recently Viewed ──────────────────────────────────────────── */}
        {recentlyViewed.length > 0 && (
          <motion.section variants={fadeInUp}>
            <SectionHeader title="Recently Viewed" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {recentlyViewed.slice(0, 6).map((p, i) => {
                const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'User';
                const initials = (p.firstName?.[0] || '') + (p.lastName?.[0] || '') || '?';
                return (
                  <div
                    key={`recent-${p.userId}-${i}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${name}'s profile`}
                    onClick={() => navigate(`/profile/${p.userId}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/profile/${p.userId}`); } }}
                    className="cursor-pointer bg-white rounded-xl border border-neutral-100 shadow-card overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                  >
                    <div className="h-28 bg-neutral-100 overflow-hidden">
                      {p.profilePhoto ? (
                        <img
                          src={getImageUrl(p.profilePhoto, API_BASE_URL, 'profile')}
                          alt={name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/40">
                          <span className="font-display text-2xl font-semibold text-primary-700 dark:text-primary-300">{initials}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 text-center">
                      <p className="text-xs font-semibold text-neutral-800 truncate">{name}</p>
                      {p.city && <p className="text-[10px] text-neutral-400 truncate">{p.city}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* ── 5. Suggested Profiles ─────────────────────────────────────────── */}
        {curatedSuggestions.length > 0 && (
          <motion.section variants={fadeInUp}>
            <SectionHeader
              title="Curated for You"
              subtitle="Handpicked profiles based on your preferences"
              count="AI matched"
              action={
                <Link
                  to="/search"
                  className="inline-flex items-center gap-1.5 text-primary-500 font-semibold text-sm hover:text-primary-600 transition-colors"
                >
                  View all
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              }
            />

            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="flex gap-4 overflow-x-auto pb-3 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-5 scrollbar-hide snap-x snap-mandatory">
              {curatedSuggestions.map((profile, i) => (
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

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="Profile Viewers"
        description="See who's viewing your profile and show your interest"
      />
    </motion.div>
  );
};

export default Dashboard;
