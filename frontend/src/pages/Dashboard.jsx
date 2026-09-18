import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FiEye, FiHeart, FiUsers, FiTrendingUp, FiMessageCircle,
  FiStar, FiArrowRight, FiCheckCircle, FiSun, FiMoon, FiCoffee,
  FiSearch, FiLock, FiUnlock, FiCalendar, FiZap,
  FiAlertCircle, FiRefreshCw, FiCamera, FiUser, FiSliders,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { staggerContainer, fadeInUp, staggerIndex, DUR, EASE_OUT } from '../utils/animations';
import { API_BASE_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { MatchCard } from '../components/cards';
import ProfileCompletionMeter, { getCompletionData } from '../components/profile/ProfileCompletionMeter';
import { getImageUrl } from '../utils/cloudinary';
import UpgradeModal from '../components/common/UpgradeModal';
import SectionHeader from '../components/common/SectionHeader';
import FoundingBadge from '../components/common/FoundingBadge';
import InviteLink from '../components/common/InviteLink';
import PhotoNudge from '../components/profile/PhotoNudge';
import { Skeleton, EmptyState } from '../components/ui';
import StagedLoader, { useStagedReveal } from '../components/ui/StagedLoader';
import RetryImage from '../components/ui/RetryImage';

// ─── Card shell — declared once (doctrine §3.4: border OR shadow, never both).
// Light mode reads elevation from the burgundy-tinted `shadow-card`; a shadow
// barely registers on a dark surface, so dark mode reads it from a hairline
// border instead. Never both at the same time. ──────────────────────────────
const CARD = 'bg-white dark:bg-surface-dark-3 shadow-card dark:shadow-none dark:border dark:border-neutral-800';

// ─── Skeleton loaders — shaped to match the rebuilt layout below, not the
// old banner stack: a plain header row, then metric tiles, then a card rail.
const StatSkeleton = () => (
  <div className={`${CARD} rounded-2xl p-5`}>
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-14" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="w-12 h-12 rounded-2xl" />
    </div>
  </div>
);

const CardSkeleton = () => (
  <div className={`${CARD} rounded-2xl overflow-hidden flex-shrink-0 w-64 md:w-auto`}>
    <Skeleton className="h-52 w-full rounded-none" />
    <div className="p-4 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
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
      toast.success(next ? 'Interest expressed' : 'Removed from your interests');
    } catch (err) {
      setIsLiked(!next); // revert optimistic update
      toast.error(err.response?.data?.message || 'Could not update. Please try again');
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
  // Shown to every member regardless of plan — gold marks premium only
  // (doctrine §3.1), so this stays a two-tier scale, never a gold "good
  // match" tier.
  // `dark:` variants dropped here: `.text-success` is already recolored for
  // dark mode by a global !important rule in index.css, so a per-component
  // dark: override on it can never take effect.
  const scoreColor = score >= 85 ? 'text-success' : 'text-primary-500 dark:text-primary-300';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerIndex(index), duration: DUR.content, ease: EASE_OUT }}
      className={`relative ${CARD} rounded-2xl [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-card-hover [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 transition-[transform,box-shadow] duration-[200ms] overflow-hidden group flex-shrink-0 w-56 md:w-auto`}
    >
      {/* Photo */}
      <div className="relative h-52 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        {(profile.profilePhoto || profile.profile_photo) ? (
          <RetryImage
            src={getImageUrl(profile.profilePhoto || profile.profile_photo, API_BASE_URL, 'profile')}
            alt={fullName}
            className="w-full h-full object-cover [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-transform duration-200"
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
            <FiStar className="w-3 h-3 text-white fill-white" />
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
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors duration-[160ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:opacity-60 ${
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
          <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[70%]">{profile.education}</span>
        )}
        {score && (
          <span className={`text-xs font-bold ml-auto ${scoreColor}`}>{Math.round(score)}% match</span>
        )}
      </div>

      {/* D4: "why this match" chips — server-derived, present only on the
          daily set; existing pill idiom (DS10), capped at 3 by the server. */}
      {profile.reasons?.length > 0 && (
        <div className="px-3 pb-3 -mt-1 flex flex-wrap gap-1.5">
          {profile.reasons.map((r) => (
            <span key={r} className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[11px] font-medium">
              {r}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ─── Subscription status / upgrade card ────────────────────────────────────
const PLAN_META = {
  free:          { label: 'Free plan',      color: 'text-neutral-500 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800',   crown: null },
  basic_premium: { label: 'Basic Premium',  color: 'text-primary-600 dark:text-primary-300', bg: 'bg-primary-50 dark:bg-primary-900/20', crown: 'text-primary-400 dark:text-primary-300' },
  // `color` drops its `dark:` variant: `.text-gold-700` is already recolored
  // for dark mode by a global !important rule in index.css.
  premium_plus:  { label: 'Premium Plus',   color: 'text-gold-700',                           bg: 'bg-gold-50 dark:bg-gold-900/20',       crown: 'text-gold-500 dark:text-gold-400' },
  vip:           { label: 'VIP Member',     color: 'text-gold-700',                           bg: 'bg-gold-50 dark:bg-gold-900/20',       crown: 'text-gold-500 dark:text-gold-400' },
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

  // Free tier: a quiet card with a gold CTA, never a flat burgundy band —
  // doctrine §3.1 is explicit that burgundy is an accent, never a fill for a
  // whole region, and that gold is reserved for exactly this: an upgrade CTA.
  if (isFree) {
    return (
      <div className={`${CARD} rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}>
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gold-50 dark:bg-gold-900/20 flex items-center justify-center flex-shrink-0">
            <FaCrown className="w-5 h-5 text-gold-600 dark:text-gold-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-neutral-800 dark:text-neutral-100">Unlock premium features</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">See who viewed you, unlock contacts, and more</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/subscription')}
          className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gold text-[#1A1A1A] rounded-xl text-sm font-semibold hover:bg-gold-400 transition-colors duration-[160ms] shadow-gold"
        >
          Upgrade to premium
        </button>
      </div>
    );
  }

  return (
    <div className={`${meta.bg} rounded-2xl p-5 border border-neutral-100 dark:border-neutral-800`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Plan info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white dark:bg-surface-dark-3 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <FaCrown className={`w-5 h-5 ${meta.crown || 'text-neutral-400'}`} />
          </div>
          <div>
            <p className={`font-bold text-sm ${meta.color}`}>{meta.label}</p>
            {daysLeft !== null && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <FiCalendar className="w-3 h-3 text-neutral-400" />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
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
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Contact unlocks</span>
                </div>
                <span className="text-xs font-bold text-primary-600 dark:text-primary-300">{unlocksLeft} / {unlocksAllowed} left</span>
              </div>
              <div className="h-2 bg-white/70 dark:bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-[width] duration-[250ms]"
                  style={{ width: `${unlocksAllowed ? ((unlocksAllowed - unlocksLeft) / unlocksAllowed) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 dark:bg-black/20 rounded-full shadow-sm">
              <FiZap className="w-3.5 h-3.5 text-gold-500" />
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Unlimited unlocks</span>
            </div>
          )}
          <button
            onClick={() => navigate('/subscription')}
            className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-primary-500 transition-colors duration-[160ms] whitespace-nowrap py-3.5 px-2 -my-3.5 -mx-2"
          >
            Manage plan
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
  const [loadError, setLoadError]       = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [community, setCommunity] = useState(null);
  // Once-per-day labor-illusion loader over the daily-matches reveal (DS6).
  const { showTheater, skip: skipTheater } = useStagedReveal({
    key: 'daily',
    loading,
    error: loadError,
    maxHoldMs: 1500,
  });

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour      = new Date().getHours();
    const firstName = user?.firstName || user?.Profile?.firstName || user?.profile?.firstName || 'there';
    if (hour >= 5  && hour < 12) return { text: `Good morning, ${firstName}`, icon: FiCoffee, subtext: 'Start your day with meaningful connections' };
    if (hour >= 12 && hour < 17) return { text: `Good afternoon, ${firstName}`, icon: FiSun,    subtext: 'Perfect time to explore new profiles' };
    if (hour >= 17 && hour < 21) return { text: `Good evening, ${firstName}`, icon: FiSun,    subtext: 'New profiles from the Tricity are waiting to meet you' };
    return                               { text: `Good night, ${firstName}`,   icon: FiMoon,   subtext: 'Your perfect match might be just a click away' };
  }, [user]);

  useEffect(() => { loadDashboardData(); }, []);

  // Verification status drives the "get verified" nudge inside PhotoNudge
  // below (best-effort; page still renders if this fails).
  useEffect(() => {
    api.get('/verification/status')
      .then(r => setVerificationStatus(r.data?.verification?.status || 'not_submitted'))
      .catch(() => {});
  }, []);

  // Community pulse — "N new members this week" social proof (best-effort).
  useEffect(() => {
    api.get('/stats/community')
      .then(r => setCommunity(r.data?.stats || null))
      .catch(() => {});
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      // No per-request catch-to-stub here: a server failure must surface as the
      // error banner below, not render as zeros + "Complete Your Profile"
      // (which blames the user's profile for a 500).
      const settled = await Promise.allSettled([
        api.get('/profile/me/stats'),
        // Fetch a wider pool so "Curated for You" still has fresh picks after we
        // strip out anyone already shown in "Today's Matches" (see dedup below).
        api.get('/search/suggestions?limit=24'),
        api.get('/match/mutual'),
        api.get('/profile/me'),
        api.get('/subscription/my-subscription'),
        api.get('/match/daily'),
        api.get('/profile/me/recently-viewed?limit=8'),
      ]);
      const [statsRes, suggestionsRes, matchesRes, profileRes, subRes, dailyRes, recentRes] = settled;
      const failures = settled.filter(r => r.status === 'rejected').length;
      setLoadError(failures >= 3 || profileRes.status === 'rejected');

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
      iconBg:    'bg-primary-50 dark:bg-primary-900/30',
      iconColor: 'text-primary-500',
      numColor:  'text-primary-600 dark:text-primary-300',
    },
    {
      // Plain stat, shown to every tier — not a premium marker, so it stays
      // neutral rather than gold (doctrine §3.1).
      key:       'totalViews',
      label:     'Total Views',
      sublabel:  'All time',
      icon:      FiTrendingUp,
      iconBg:    'bg-neutral-100 dark:bg-neutral-800',
      iconColor: 'text-neutral-500 dark:text-neutral-400',
      numColor:  'text-neutral-900 dark:text-neutral-100',
    },
    {
      key:       'likesReceived',
      label:     'Interests Received',
      sublabel:  'Total',
      icon:      FiHeart,
      iconBg:    'bg-primary-50 dark:bg-primary-900/30',
      iconColor: 'text-primary-400',
      numColor:  'text-primary-500 dark:text-primary-300',
    },
    {
      key:        'mutualMatches',
      label:      'Mutual Matches',
      sublabel:   'Ready to chat',
      icon:       FiUsers,
      // `dark:` variants dropped on iconBg/iconColor/numColor: `.bg-success-50`
      // and `.text-success` are already recolored for dark mode by global
      // !important rules in index.css, so a per-component override here can
      // never take effect.
      iconBg:     'bg-success-50',
      iconColor:  'text-success',
      numColor:   'text-success',
      customValue: true,
      to:         '/chat',
    },
  ];

  // ── Loading: once/day staged reveal (DS6, ≤1.5s hold), else plain skeleton,
  // shaped like the rebuilt layout — a slim header row, not a big hero card.
  if (showTheater) {
    return (
      <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 py-6 md:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <StagedLoader onSkip={skipTheater} className="min-h-[60vh]" />
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 py-6 md:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header skeleton */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
              <Skeleton className="h-11 w-full sm:w-36 rounded-xl" />
              <Skeleton className="h-11 w-full sm:w-32 rounded-xl" />
            </div>
          </div>
          {/* "Needs you" skeleton */}
          <div className={`${CARD} rounded-2xl p-5`}>
            <div className="flex items-center gap-3.5">
              <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
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

  // First-run: a brand-new member sees a setup checklist instead of a row of
  // zero-stats ("quantified rejection") — profile under 60% complete or an
  // account younger than 48h counts as first-run.
  const profileForMeter = userProfile || user?.profile || {};
  const { percent: completionPercent, allImportantDone } = getCompletionData(profileForMeter);
  const accountIsNew = !!(userProfile?.createdAt) &&
    (Date.now() - new Date(userProfile.createdAt).getTime()) < 48 * 3600 * 1000;
  const isFirstRun = !loadError && (completionPercent < 60 || accountIsNew);
  const setupChecklist = [
    { id: 'photo', label: 'Add your photo', desc: 'Profiles with photos get 8x more views', done: !!profileForMeter.profilePhoto, icon: FiCamera },
    { id: 'bio',   label: 'Write about yourself', desc: 'A short bio helps families connect', done: !!(profileForMeter.bio && String(profileForMeter.bio).trim().length >= 20), icon: FiUser },
    { id: 'prefs', label: 'Set partner preferences', desc: 'Sharpen who we match you with', done: !!(profileForMeter.preferredAgeMin || profileForMeter.preferredCity || profileForMeter.preferredEducation), icon: FiSliders },
  ];

  // Verified or pending review both mean "nothing to prompt right now" — and
  // while the status hasn't loaded yet, default to true so the verify prompt
  // never flashes on before we know it doesn't apply.
  const verifiedOrPending = !verificationStatus || ['approved', 'pending'].includes(verificationStatus);
  const hasPhoto = !!profileForMeter.profilePhoto ||
    (Array.isArray(profileForMeter.photos) && profileForMeter.photos.length > 0);

  // ── Main render ────────────────────────────────────────────────────────────
  // One hierarchy, top to bottom: what's new (matches, viewers) → what needs
  // the member (photo/verify, profile completion, upgrade) → what they were
  // doing (recently viewed, curated browsing) — not a stack of independently
  // coloured banners (doctrine §3.1, audit finding #4).
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pb-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-8">

        {/* ── Load error — a server failure is never dressed up as an empty
               profile. Sits first: it explains why everything below may be
               thin or missing. Distinct banner + working retry. ─────────── */}
        {loadError && (
          <motion.div
            variants={fadeInUp}
            role="alert"
            className={`${CARD} border-destructive/20 dark:border-destructive/30 rounded-2xl p-5 flex items-center gap-4`}
          >
            <div className="w-10 h-10 rounded-xl bg-destructive-light dark:bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <FiAlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Couldn't load your dashboard</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Something went wrong on our side or your connection dropped. Your profile is safe.</p>
            </div>
            <button
              onClick={loadDashboardData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors duration-[160ms] flex-shrink-0"
            >
              <FiRefreshCw className="w-4 h-4" /> Retry
            </button>
          </motion.div>
        )}

        {/* ── Header — a plain greeting row, not a decorated hero band. No
               eyebrow label above the heading (doctrine §8 — it carries its
               own weight). Actions stack full-width on mobile so a label
               never wraps inside its own button (the 375px defect from the
               audit): row on sm+, column below it. ─────────────────────── */}
        <motion.header variants={fadeInUp} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
                <greeting.icon className="w-6 h-6 text-primary-500 flex-shrink-0" aria-hidden="true" />
                {greeting.text}
              </h1>
              <FoundingBadge user={user} />
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1.5">{greeting.subtext}</p>

            {(stats.viewsThisWeek > 5 || community?.newThisWeek > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.viewsThisWeek > 5 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800 rounded-full">
                    <FiStar className="w-3.5 h-3.5 text-primary-500" />
                    <span className="text-primary-700 dark:text-primary-300 text-xs font-medium">
                      {stats.viewsThisWeek} profile views this week
                    </span>
                  </div>
                )}
                {/* `dark:bg-success-500/15` dropped below: `.bg-success-50` is
                    already recolored for dark mode by a global !important
                    rule in index.css. */}
                {community?.newThisWeek > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success-50 border border-success-100 dark:border-success-500/30 rounded-full">
                    <FiUsers className="w-3.5 h-3.5 text-success dark:text-green-400" />
                    <span className="text-success dark:text-green-400 text-xs font-medium">
                      {community.newThisWeek} new {community.newThisWeek === 1 ? 'member' : 'members'} joined this week
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick actions — stacked full-width on mobile, side by side from
              sm up. Each is `flex-1` on mobile so both share the row evenly
              once there is room, and neither ever has to wrap its label. */}
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto flex-shrink-0">
            <Link
              to="/search"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl text-sm font-semibold [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 transition-transform duration-[160ms] shadow-burgundy"
            >
              <FiSearch className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Find matches</span>
            </Link>
            <Link
              to="/chat"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-transparent text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-700 rounded-xl text-sm font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors duration-[160ms]"
            >
              <FiMessageCircle className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Messages</span>
            </Link>
          </div>
        </motion.header>

        {/* ── "Needs you" — every profile/upgrade nudge grouped into one
               tight cluster instead of five independently-coloured bands.
               Exactly one photo/verify prompt (PhotoNudge's own priority
               order), then first-run checklist OR the fuller completion
               meter (never both), then the subscription/upgrade card. Any
               of the three can be absent; the group simply gets shorter. ── */}
        <motion.div variants={fadeInUp} className="space-y-3">
          <PhotoNudge hasPhoto={hasPhoto} isVerified={verifiedOrPending} allow={['photo', 'verify']} />

          {isFirstRun && !allImportantDone && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {setupChecklist.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    to="/profile/edit"
                    className={`${CARD} rounded-2xl p-4 flex items-start gap-3.5 transition-transform duration-[160ms] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-success-50 dark:bg-success-500/15' : 'bg-primary-50 dark:bg-primary-900/30'}`}>
                      {item.done ? <FiCheckCircle className="w-5 h-5 text-success dark:text-green-400" /> : <Icon className="w-5 h-5 text-primary-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${item.done ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-800 dark:text-neutral-100'}`}>{item.label}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{item.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {!isFirstRun && !allImportantDone && (
            <ProfileCompletionMeter profile={profileForMeter} />
          )}

          {subscription && (
            <SubscriptionStatusCard subscription={subscription} navigate={navigate} />
          )}
        </motion.div>

        {/* ── What's new: mutual matches, today's picks, who viewed you ──── */}
        <AnimatePresence>
          {mutualMatches.length > 0 && (
            <motion.section
              variants={fadeInUp}
              initial="initial"
              animate="animate"
            >
              <SectionHeader
                title="Mutual Matches"
                subtitle="These people liked you back. Start a conversation."
                count={`${mutualMatches.length} new`}
                countTone="ok"
                action={
                  <Link
                    to="/chat"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors duration-[160ms] shadow-burgundy"
                  >
                    <FiMessageCircle className="w-4 h-4" />
                    Open chat
                  </Link>
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {mutualMatches.slice(0, 3).map((match, i) => (
                  <MatchCard
                    key={`match-${match.userId}`}
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

        {dailyMatches.length > 0 && (
          <motion.section variants={fadeInUp}>
            <SectionHeader
              title="Today's Matches"
              subtitle="Hand-picked for you, refreshed every day"
              count="Daily"
            />

            <div className="flex gap-4 overflow-x-auto pb-3 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-5 scrollbar-hide snap-x snap-mandatory">
              {dailyMatches.map((profile, i) => (
                <div key={`daily-${profile.userId}`} className="snap-start">
                  <SuggestionCard profile={profile} index={i} />
                </div>
              ))}
            </div>

            {!dailyMeta.isPremium && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate('/subscription')}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-gold text-[#1A1A1A] text-sm font-semibold rounded-xl hover:bg-gold-400 transition-colors duration-[160ms] shadow-gold"
                >
                  <FaCrown className="w-3.5 h-3.5" /> Upgrade to see more matches today
                </button>
              </div>
            )}

            {/* Anticipation line — the daily set refreshes at midnight IST. */}
            <p className="mt-3 text-center text-xs text-neutral-400 dark:text-neutral-500">
              Fresh matches arrive at midnight. Check back tomorrow.
            </p>
          </motion.section>
        )}

        {/* ── Who Viewed Your Profile — hidden for free members until at
               least one real view exists (an upsell to see zero viewers reads
               as mockery on a fresh account). ────────────────────────────── */}
        {(hasPremium || (stats?.totalViews ?? 0) > 0) && (
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
                    key={`viewer-${viewer.userId}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: staggerIndex(i), duration: DUR.content, ease: EASE_OUT }}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${viewerName}'s profile`}
                    onClick={() => viewer.userId && navigate(`/profile/${viewer.userId}`)}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && viewer.userId) { e.preventDefault(); navigate(`/profile/${viewer.userId}`); } }}
                    className={`cursor-pointer ${CARD} rounded-xl overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 transition-transform duration-[160ms] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1`}
                  >
                    <div className="relative h-28 bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center bg-primary-100 dark:bg-primary-900/40">
                        <span className="font-display text-2xl font-semibold text-primary-700 dark:text-primary-300">{initials}</span>
                      </div>
                      {viewer.profilePhoto && (
                        <RetryImage
                          src={getImageUrl(viewer.profilePhoto, API_BASE_URL, 'profile')}
                          alt={viewerName}
                          className="relative w-full h-full object-cover [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-transform"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="p-2.5 text-center">
                      <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 truncate">{viewerName}</p>
                      {viewer.city && <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">{viewer.city}</p>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : hasPremium && profileViewers.length === 0 ? (
            <div className={`${CARD} rounded-2xl p-8 text-center`}>
              <FiEye className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No one has viewed your profile yet. Complete your profile to attract visitors.</p>
            </div>
          ) : (
            /* Locked state for free users */
            <div className={`relative ${CARD} rounded-2xl overflow-hidden`}>
              {/* Blurred placeholder */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-5 blur-sm pointer-events-none select-none" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-neutral-100 dark:bg-neutral-800 rounded-xl h-28" />
                ))}
              </div>
              {/* Overlay CTA */}
              <div className="absolute inset-0 bg-white/80 dark:bg-surface-dark-1/85 backdrop-blur-[2px] flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-gold-50 dark:bg-gold-900/30 flex items-center justify-center mb-3">
                  <FiLock className="w-5 h-5 text-gold-600 dark:text-gold-400" />
                </div>
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">Premium feature</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 max-w-xs text-center">See who's interested in your profile</p>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowUpgradeModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-gold text-[#1A1A1A] text-sm font-semibold rounded-xl hover:bg-gold-400 transition-colors duration-[160ms] shadow-gold"
                >
                  <FaCrown className="w-3.5 h-3.5" /> Upgrade to premium
                </motion.button>
              </div>
            </div>
          )}
        </motion.section>
        )}

        {/* ── Your week at a glance — quick-glance metrics for returning
               members. First-run members see the setup checklist above
               instead; showing both at once is the double-nag the rebuild
               removes. ─────────────────────────────────────────────────── */}
        {!isFirstRun && (
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: staggerIndex(i), duration: DUR.content, ease: EASE_OUT }}
                className={`${CARD} rounded-2xl p-5 transition-transform duration-[160ms] ${stat.to ? '[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1' : ''}`}
              >
                <Wrapper {...wrapperProps}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-xs font-medium mb-2">{stat.label}</p>
                    <p className={`font-display text-3xl font-bold ${stat.numColor}`}>
                      {value}
                    </p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{stat.sublabel}</p>
                  </div>
                  <div className={`w-11 h-11 ${stat.iconBg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                </div>
                </Wrapper>
              </motion.div>
            );
          })}
        </motion.div>
        )}

        {/* ── What you were doing: recently viewed, curated browsing ─────── */}
        {recentlyViewed.length > 0 && (
          <motion.section variants={fadeInUp}>
            <SectionHeader title="Recently Viewed" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {recentlyViewed.slice(0, 6).map((p, i) => {
                const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'User';
                const initials = (p.firstName?.[0] || '') + (p.lastName?.[0] || '') || '?';
                return (
                  <div
                    key={`recent-${p.userId}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${name}'s profile`}
                    onClick={() => navigate(`/profile/${p.userId}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/profile/${p.userId}`); } }}
                    className={`cursor-pointer ${CARD} rounded-xl overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1`}
                  >
                    <div className="relative h-28 bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center bg-primary-100 dark:bg-primary-900/40">
                        <span className="font-display text-2xl font-semibold text-primary-700 dark:text-primary-300">{initials}</span>
                      </div>
                      {p.profilePhoto && (
                        <RetryImage
                          src={getImageUrl(p.profilePhoto, API_BASE_URL, 'profile')}
                          alt={name}
                          className="relative w-full h-full object-cover [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-transform"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="p-2.5 text-center">
                      <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 truncate">{name}</p>
                      {p.city && <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">{p.city}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {curatedSuggestions.length > 0 && (
          <motion.section variants={fadeInUp}>
            <SectionHeader
              title="Curated for You"
              subtitle="A wider set of profiles matched to your preferences"
              count="For you"
              action={
                <Link
                  to="/search"
                  className="inline-flex items-center gap-1.5 text-primary-500 font-semibold text-sm hover:text-primary-600 transition-colors duration-[160ms] py-3 -my-3 px-1 -mx-1"
                >
                  View all
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              }
            />

            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="flex gap-4 overflow-x-auto pb-3 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-5 scrollbar-hide snap-x snap-mandatory">
              {curatedSuggestions.map((profile, i) => (
                <div key={`suggestion-${profile.userId}`} className="snap-start">
                  <SuggestionCard profile={profile} index={i} />
                </div>
              ))}
            </div>

            {/* Mobile: View all link */}
            <div className="mt-4 sm:hidden text-center">
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 text-primary-500 font-semibold text-sm py-3 px-3 -my-3 -mx-3"
              >
                View all profiles <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.section>
        )}

        {/* ── Empty state — genuinely no content in ANY section. Discovery-
               focused: the completion nudge already lives in the cluster
               above, so this card doesn't repeat it. ─────────────────────── */}
        {!loadError &&
          suggestions.length === 0 && mutualMatches.length === 0 &&
          dailyMatches.length === 0 && recentlyViewed.length === 0 && (
          <motion.div
            variants={fadeInUp}
            className={`${CARD} rounded-3xl`}
          >
            <EmptyState
              icon={FiUsers}
              title="You're early. That's the point."
              description="We're building this community one verified Tricity family at a time, so there isn't much here yet. Sharpen your preferences so we match you well from the first profile, and invite someone you'd trust with an introduction."
              actionLabel="Browse profiles"
              onAction={() => navigate('/search')}
              className="py-16"
            />
            <div className="flex flex-col sm:flex-row gap-3 justify-center -mt-4 pb-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/profile/edit')}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <FiSliders className="w-4 h-4" />
                Set preferences
              </motion.button>
            </div>
            <div className="mt-4 flex justify-center pb-6">
              <InviteLink variant="inline" />
            </div>
          </motion.div>
        )}

        {/* ── Invite — a standing action, not an empty-state consolation: the
               fastest route to a better match here is a member bringing
               someone they already vouch for. ─────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <InviteLink variant="card" />
        </motion.div>
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
