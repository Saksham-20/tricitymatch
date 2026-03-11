import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiHeart, FiBookmark, FiMapPin, FiBook, FiBriefcase,
  FiLock, FiCheckCircle, FiArrowRight,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { API_BASE_URL } from '../../utils/api';
import { getImageUrl } from '../../utils/cloudinary';

/* ──────────────────────────────────────────────────────────
   Animated compatibility arc — circular score indicator
   ────────────────────────────────────────────────────────── */
const CompatArc = ({ score }) => {
  if (!score) return null;
  const color = score >= 90 ? '#2E7D32' : score >= 75 ? '#C9A227' : '#8B2346';
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-12 h-12 flex-shrink-0" title={`${Math.round(score)}% match`}>
      <svg width="48" height="48" viewBox="0 0 48 48" className="transform -rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#F5F5F5" strokeWidth="3" />
        <motion.circle
          cx="24" cy="24" r={radius} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
        style={{ color }}
      >
        {Math.round(score)}%
      </span>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────
   Shimmer compatibility bar (linear)
   ────────────────────────────────────────────────────────── */
const ShimmerBar = ({ score }) => {
  if (!score) return null;
  const color = score >= 90 ? '#2E7D32' : score >= 75 ? '#C9A227' : '#8B2346';
  return (
    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.25 }}
        className="h-full rounded-full relative"
        style={{
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
        }}
      >
        {/* shimmer effect */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: 1.5 }}
        />
      </motion.div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────
   Premium blur overlay
   ────────────────────────────────────────────────────────── */
const PremiumBlur = () => (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
    style={{
      backdropFilter: 'blur(10px)',
      background: 'rgba(255,255,255,0.25)',
    }}
  >
    <div className="w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
      <FiLock className="w-5 h-5 text-primary-500" />
    </div>
    <p className="text-xs font-semibold text-neutral-800 bg-white/80 px-4 py-1.5 rounded-full shadow-sm">
      Upgrade to view
    </p>
  </div>
);

/* ──────────────────────────────────────────────────────────
   Detail chip
   ────────────────────────────────────────────────────────── */
const DetailChip = ({ icon: Icon, text }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-50 rounded-lg text-neutral-600 border border-neutral-100">
    <Icon className="w-3 h-3 text-primary-400 flex-shrink-0" />
    <span className="text-[12px] truncate leading-tight">{text}</span>
  </div>
);

/**
 * ProfileCard — full + compact variants (redesigned)
 */
const ProfileCard = ({
  profile,
  userId,
  index = 0,
  variant = 'full',
  onLike,
  onShortlist,
  showActions = true,
  isAISuggested = false,
  isPremiumLocked = false,
  isOnline = false,
}) => {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(profile.matchStatus === 'like');
  const [isShortlisted, setIsShortlisted] = useState(profile.matchStatus === 'shortlist');
  const [imgError, setImgError] = useState(false);

  const getAge = () => {
    if (profile.age) return profile.age;
    if (profile.dateOfBirth) {
      const d = new Date(profile.dateOfBirth);
      const t = new Date();
      const a = t.getFullYear() - d.getFullYear();
      const m = t.getMonth() - d.getMonth();
      return m < 0 || (m === 0 && t.getDate() < d.getDate()) ? a - 1 : a;
    }
    return 'N/A';
  };

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Profile';
  const initials = ((profile.firstName?.[0] || '') + (profile.lastName?.[0] || '')).toUpperCase() || '?';

  const handleCardClick = () => userId && navigate(`/profile/${userId}`);
  const handleLike = (e) => { e.stopPropagation(); setIsLiked(!isLiked); onLike?.(); };
  const handleShortlist = (e) => { e.stopPropagation(); setIsShortlisted(!isShortlisted); onShortlist?.(); };

  const hasPhoto = (profile.profilePhoto || profile.profile_photo) && !imgError;

  // ── Compact ───────────────────────────────────
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.25 }}
        whileHover={{ y: -3 }}
        className="bg-white rounded-2xl border border-neutral-100 shadow-card hover:shadow-card-hover transition-all duration-200 p-4 cursor-pointer group"
        onClick={handleCardClick}
        role="article"
        aria-label={`Profile of ${fullName}`}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {hasPhoto ? (
              <img
                src={getImageUrl(profile.profilePhoto || profile.profile_photo, API_BASE_URL, 'thumbnail')}
                alt={`${fullName}`}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-md"
                loading="lazy"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-500 font-bold text-lg ring-2 ring-white shadow-md">
                {initials}
              </div>
            )}
            {isOnline && (
              <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-success border-2 border-white" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="font-semibold text-sm text-neutral-800 truncate group-hover:text-primary-500 transition-colors">
                {fullName}
              </h3>
              {profile.isPremium && (
                <FaCrown
                  className={`w-3 h-3 flex-shrink-0 ${
                    profile.premiumPlan === 'vip'
                      ? 'text-amber-400'
                      : profile.premiumPlan === 'premium_plus'
                      ? 'text-purple-500'
                      : 'text-rose-400'
                  }`}
                  title={
                    profile.premiumPlan === 'vip'
                      ? 'VIP Member'
                      : profile.premiumPlan === 'premium_plus'
                      ? 'Premium Plus Member'
                      : 'Premium Member'
                  }
                />
              )}
            </div>
            <p className="text-xs text-neutral-500">{getAge()} yrs · {profile.city || '—'}</p>
            {profile.compatibilityScore && (
              <div className="mt-1.5">
                <ShimmerBar score={profile.compatibilityScore} />
              </div>
            )}
          </div>

          {/* Like */}
          {showActions && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLike}
              aria-label={isLiked ? 'Unlike' : 'Like'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${isLiked ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-primary-400 hover:bg-primary-50'
                }`}
            >
              <FiHeart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Full (Redesigned) ──────────────────────────
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -6 }}
      className="group relative bg-white rounded-3xl overflow-hidden cursor-pointer transition-all duration-300"
      style={{
        boxShadow: '0 4px 24px rgba(139, 35, 70, 0.07), 0 1px 4px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(139, 35, 70, 0.14), 0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(139, 35, 70, 0.07), 0 1px 4px rgba(0,0,0,0.04)';
      }}
      onClick={handleCardClick}
      role="article"
      aria-label={`Profile of ${fullName}`}
    >
      {/* ── Photo Section ──────────────────────────── */}
      <div className="relative h-56 overflow-hidden">
        {hasPhoto ? (
          <img
            src={getImageUrl(profile.profilePhoto || profile.profile_photo, API_BASE_URL, 'profile')}
            alt={`${fullName}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          /* ── Premium no-photo placeholder ─────────── */
          <div className="w-full h-full bg-gradient-to-br from-primary-50 via-primary-100 to-gold-50 flex items-center justify-center relative">
            {/* decorative circles */}
            <div className="absolute top-4 right-6 w-20 h-20 rounded-full bg-primary-200/30" />
            <div className="absolute bottom-6 left-4 w-14 h-14 rounded-full bg-gold-200/40" />
            {/* frosted avatar */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg relative z-[1]"
              style={{
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.8)',
              }}
            >
              <span className="text-3xl font-display font-bold text-primary-400">
                {initials}
              </span>
            </div>
          </div>
        )}

        {/* Premium blur lock */}
        {isPremiumLocked && <PremiumBlur />}

        {/* Bottom scrim — always visible for legibility */}
        {!isPremiumLocked && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none" />
        )}

        {/* Online indicator */}
        {isOnline && (
          <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-2.5 py-1 bg-white/85 backdrop-blur-md rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
            <span className="text-[11px] font-semibold text-neutral-700">Online</span>
          </div>
        )}

        {/* AI badge */}
        {isAISuggested && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-3.5 left-3.5 px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full text-[11px] font-semibold flex items-center gap-1.5 text-white shadow-burgundy"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            AI Suggested
          </motion.div>
        )}

        {/* Match badge */}
        {!isAISuggested && profile.compatibilityScore >= 80 && !isPremiumLocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="absolute top-3.5 left-3.5 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-white shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(30,30,30,0.85), rgba(50,50,50,0.8))',
              backdropFilter: 'blur(6px)',
            }}
          >
            <FiCheckCircle className="w-3.5 h-3.5 text-success" />
            {Math.round(profile.compatibilityScore)}% Match
          </motion.div>
        )}

        {/* Premium crown badge — tier-specific */}
        {profile.isPremium && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className={`absolute top-3.5 right-14 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-lg ${
              profile.premiumPlan === 'vip'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                : profile.premiumPlan === 'premium_plus'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                : 'bg-gradient-to-r from-rose-400 to-pink-500'
            }`}
          >
            <FaCrown className="w-3 h-3" />
            {profile.premiumPlan === 'vip'
              ? 'VIP'
              : profile.premiumPlan === 'premium_plus'
              ? 'Plus'
              : 'Premium'}
          </motion.div>
        )}

        {/* ── Action buttons (bookmark + like) ──── */}
        {showActions && !isPremiumLocked && (
          <div className="absolute top-3.5 right-3 flex gap-2 z-10">
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.88 }}
              onClick={handleShortlist}
              aria-label={isShortlisted ? 'Remove from shortlist' : 'Shortlist'}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${isShortlisted
                  ? 'bg-gold text-white'
                  : 'bg-white/70 backdrop-blur-md text-neutral-500 hover:bg-white hover:text-gold-500 ring-1 ring-white/50'
                }`}
            >
              <FiBookmark className={`w-4.5 h-4.5 ${isShortlisted ? 'fill-current' : ''}`} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.88 }}
              onClick={handleLike}
              aria-label={isLiked ? 'Unlike' : 'Express interest'}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${isLiked
                  ? 'bg-primary-500 text-white'
                  : 'bg-white/70 backdrop-blur-md text-primary-400 hover:bg-white hover:text-primary-500 ring-1 ring-white/50'
                }`}
            >
              <motion.div
                animate={isLiked ? { scale: [1, 1.35, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <FiHeart className={`w-4.5 h-4.5 ${isLiked ? 'fill-current' : ''}`} />
              </motion.div>
            </motion.button>
          </div>
        )}
      </div>

      {/* ── Info Section ───────────────────────────── */}
      <div className="p-5">
        {/* Name + age + score arc */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-display text-lg font-semibold text-neutral-800 group-hover:text-primary-500 transition-colors truncate leading-snug">
                {fullName}
              </h3>
              {(profile.verificationStatus === 'approved' || profile.User?.verificationStatus === 'approved' || profile.isVerified) && (
                <FiCheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" title="Verified profile" />
              )}
            </div>
            <p className="text-[13px] text-neutral-400 mt-0.5 font-medium">
              {getAge()} yrs
            </p>
          </div>
          {profile.compatibilityScore && (
            <CompatArc score={profile.compatibilityScore} />
          )}
        </div>

        {/* Shimmer bar */}
        {profile.compatibilityScore && (
          <div className="mb-4">
            <ShimmerBar score={profile.compatibilityScore} />
          </div>
        )}

        {/* Detail chips */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {profile.city && (
            <DetailChip icon={FiMapPin} text={profile.city} />
          )}
          {profile.education && (
            <DetailChip icon={FiBook} text={profile.education} />
          )}
          {profile.profession && (
            <DetailChip icon={FiBriefcase} text={profile.profession} />
          )}
        </div>

        {/* ── Action buttons ──────────────────────── */}
        {showActions && (
          <div className="flex gap-2.5 pt-4 border-t border-neutral-100">
            {isPremiumLocked ? (
              <button
                onClick={(e) => { e.stopPropagation(); navigate('/subscription'); }}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-400 to-gold-500 text-white text-sm font-semibold rounded-2xl hover:from-gold-500 hover:to-gold-600 transition-all shadow-gold"
              >
                <FaCrown className="w-3.5 h-3.5" />
                Unlock Profile
              </button>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleLike}
                  className={`flex-1 py-3 text-sm font-semibold rounded-2xl transition-all duration-200 ${isLiked
                      ? 'bg-primary-50 text-primary-600 border border-primary-200'
                      : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-burgundy'
                    }`}
                >
                  {isLiked ? '✓ Interest Sent' : 'Express Interest'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCardClick}
                  className="flex-1 py-3 text-sm font-semibold rounded-2xl transition-all duration-200 border border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/50 flex items-center justify-center gap-1.5"
                >
                  View Profile
                  <FiArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfileCard;
