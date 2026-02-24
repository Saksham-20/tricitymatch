import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiHeart, FiBookmark, FiMapPin, FiBook, FiBriefcase,
  FiLock, FiCheckCircle,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { API_BASE_URL } from '../../utils/api';
import { getImageUrl } from '../../utils/cloudinary';

// ─── Inline mini compatibility bar ──────────
const MiniCompatBar = ({ score }) => {
  if (!score) return null;
  const color = score >= 90 ? '#2E7D32' : score >= 75 ? '#C9A227' : '#8B2346';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-bold flex-shrink-0" style={{ color }}>
        {Math.round(score)}%
      </span>
    </div>
  );
};

// ─── Premium blur overlay ────────────────────
const PremiumBlur = () => (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
    style={{
      backdropFilter: 'blur(8px)',
      background: 'rgba(255,255,255,0.22)',
    }}
  >
    <div className="w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center">
      <FiLock className="w-4.5 h-4.5 text-primary-500" />
    </div>
    <p className="text-xs font-semibold text-neutral-800 bg-white/80 px-3 py-1 rounded-full shadow-sm">
      Upgrade to view
    </p>
  </div>
);

/**
 * ProfileCard — full + compact variants
 *
 * New props:
 *  @param {boolean} isPremiumLocked  — blur photo for non-premium users
 *  @param {boolean} isOnline         — show online indicator
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
  const [isLiked, setIsLiked]         = useState(profile.matchStatus === 'like');
  const [isShortlisted, setIsShortlisted] = useState(profile.matchStatus === 'shortlist');
  const [imgError, setImgError]       = useState(false);

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
  const handleLike      = (e) => { e.stopPropagation(); setIsLiked(!isLiked); onLike?.(); };
  const handleShortlist = (e) => { e.stopPropagation(); setIsShortlisted(!isShortlisted); onShortlist?.(); };

  const hasPhoto = (profile.profilePhoto || profile.profile_photo) && !imgError;

  // ── Compact ─────────────────────────────────
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
            <h3 className="font-semibold text-sm text-neutral-800 truncate group-hover:text-primary-500 transition-colors">
              {fullName}
            </h3>
            <p className="text-xs text-neutral-500">{getAge()} yrs · {profile.city || '—'}</p>
            {profile.compatibilityScore && (
              <div className="mt-1.5">
                <MiniCompatBar score={profile.compatibilityScore} />
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
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                isLiked ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-primary-400 hover:bg-primary-50'
              }`}
            >
              <FiHeart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Full ─────────────────────────────────────
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -6 }}
      className="bg-white rounded-2xl border border-neutral-100 shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden cursor-pointer group"
      onClick={handleCardClick}
      role="article"
      aria-label={`Profile of ${fullName}`}
    >
      {/* Photo */}
      <div className="relative h-52 overflow-hidden">
        {hasPhoto ? (
          <img
            src={getImageUrl(profile.profilePhoto || profile.profile_photo, API_BASE_URL, 'profile')}
            alt={`${fullName}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-100 via-primary-50 to-gold-50 flex items-center justify-center">
            <span className="text-5xl font-bold text-primary-300">{initials}</span>
          </div>
        )}

        {/* Premium blur lock */}
        {isPremiumLocked && <PremiumBlur />}

        {/* Gradient scrim (hover) */}
        {!isPremiumLocked && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}

        {/* Online indicator */}
        {isOnline && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-white/90 rounded-full shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft" />
            <span className="text-[11px] font-semibold text-neutral-700">Online</span>
          </div>
        )}

        {/* AI badge */}
        {isAISuggested && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-3 left-3 px-2.5 py-1.5 bg-gradient-to-r from-primary-500 to-primary-700 rounded-full text-[11px] font-semibold flex items-center gap-1.5 text-white shadow-md"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            Suggested
          </motion.div>
        )}

        {/* Match badge */}
        {!isAISuggested && profile.compatibilityScore >= 80 && !isPremiumLocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute top-3 left-3 px-2.5 py-1 bg-neutral-900/80 backdrop-blur-sm rounded-full text-[11px] font-bold flex items-center gap-1.5 text-white"
          >
            <FiCheckCircle className="w-3 h-3 text-success" />
            {Math.round(profile.compatibilityScore)}% Match
          </motion.div>
        )}

        {/* Premium crown */}
        {profile.isPremium && (
          <div className="absolute top-3 right-12 w-7 h-7 rounded-full bg-gold-400 flex items-center justify-center shadow-gold">
            <FaCrown className="w-3.5 h-3.5 text-white" />
          </div>
        )}

        {/* Actions */}
        {showActions && !isPremiumLocked && (
          <div className="absolute top-3 right-3 flex gap-1.5 z-10">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShortlist}
              aria-label={isShortlisted ? 'Remove from shortlist' : 'Shortlist'}
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${
                isShortlisted ? 'bg-gold text-white' : 'bg-white/95 backdrop-blur-sm text-neutral-600 hover:bg-white'
              }`}
            >
              <FiBookmark className={`w-4 h-4 ${isShortlisted ? 'fill-current' : ''}`} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLike}
              aria-label={isLiked ? 'Unlike' : 'Express interest'}
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${
                isLiked ? 'bg-primary-500 text-white' : 'bg-white/95 backdrop-blur-sm text-primary-500 hover:bg-white'
              }`}
            >
              <motion.div
                animate={isLiked ? { scale: [1, 1.35, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <FiHeart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </motion.div>
            </motion.button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-neutral-800 group-hover:text-primary-500 transition-colors truncate">
              {fullName}
            </h3>
            <p className="text-sm text-neutral-500 mt-0.5">{getAge()} yrs</p>
          </div>
          {profile.compatibilityScore && (
            <div className="flex-shrink-0 text-right">
              <span
                className="text-xs font-bold"
                style={{
                  color: profile.compatibilityScore >= 90 ? '#2E7D32'
                       : profile.compatibilityScore >= 75 ? '#C9A227'
                       : '#8B2346',
                }}
              >
                {Math.round(profile.compatibilityScore)}%
              </span>
              <p className="text-[10px] text-neutral-400">match</p>
            </div>
          )}
        </div>

        {/* Compatibility bar */}
        {profile.compatibilityScore && (
          <div className="mb-3">
            <MiniCompatBar score={profile.compatibilityScore} />
          </div>
        )}

        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-neutral-500">
            <FiMapPin className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
            <span className="text-xs truncate">{profile.city || '—'}</span>
          </div>
          {profile.education && (
            <div className="flex items-center gap-2 text-neutral-500">
              <FiBook className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
              <span className="text-xs truncate">{profile.education}</span>
            </div>
          )}
          {profile.profession && (
            <div className="flex items-center gap-2 text-neutral-500">
              <FiBriefcase className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
              <span className="text-xs truncate">{profile.profession}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-4 border-t border-neutral-100">
            {isPremiumLocked ? (
              <button
                onClick={(e) => { e.stopPropagation(); navigate('/subscription'); }}
                className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-gold text-neutral-900 text-sm font-semibold rounded-xl hover:bg-gold-400 transition-colors"
              >
                <FaCrown className="w-3.5 h-3.5" />
                Unlock Profile
              </button>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLike}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                    isLiked
                      ? 'bg-primary-100 text-primary-600 border border-primary-200'
                      : 'bg-primary-500 text-white hover:bg-primary-600 shadow-burgundy'
                  }`}
                >
                  {isLiked ? 'Interest Sent' : 'Express Interest'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCardClick}
                  className="flex-1 py-2.5 border-2 border-neutral-200 text-primary-500 text-sm font-semibold rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all duration-200"
                >
                  View Profile
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
