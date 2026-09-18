import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiHeart, FiBookmark, FiMapPin, FiBook, FiBriefcase,
  FiLock, FiCheckCircle, FiArrowRight, FiCheck, FiMessageCircle,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { API_BASE_URL } from '../../utils/api';
import { getImageUrl } from '../../utils/cloudinary';
import RetryImage from '../ui/RetryImage';
import { staggerIndex, DUR, EASE_OUT } from '../../utils/animations';

// Pointer-gated hover — touch fires a false hover on tap that would otherwise
// leave a card stuck lifted/scaled after the finger lifts (doctrine §4.7).
const HOVER = '[@media(hover:hover)_and_(pointer:fine)]:hover';

/* ──────────────────────────────────────────────────────────
   Animated compatibility arc — circular score indicator
   ────────────────────────────────────────────────────────── */
const CompatArc = ({ score }) => {
  if (!score) return null;
  // Compatibility is shown to every member, free or paid — gold is reserved
  // for premium marks (doctrine §3.1), so the match-quality scale is two-tier
  // (strong / standard), never a gold middle tier.
  // Tailwind tokens (`text-success` / `text-primary-500`) via `currentColor`,
  // not inline hex — the tokens carry dark-mode overrides (index.css) an
  // inline `stroke`/`style` color would silently bypass (audit finding #6).
  const strong = score >= 85;
  const colorClass = strong ? 'text-success' : 'text-primary-500';
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-12 h-12 flex-shrink-0" title={`${Math.round(score)}% match`}>
      <svg width="48" height="48" viewBox="0 0 48 48" className="transform -rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-neutral-100" />
        <motion.circle
          cx="24" cy="24" r={radius} fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          className={colorClass}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.15, ease: EASE_OUT, delay: 0.1 }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${colorClass}`}>
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
  // Compatibility is shown to every member, free or paid — gold is reserved
  // for premium marks (doctrine §3.1), so the match-quality scale is two-tier
  // (strong / standard), never a gold middle tier.
  // Tailwind gradient utilities, not inline hex (audit finding #6) — the
  // two-stop fill stays the doctrine §2 ruling #11 progress-bar exception,
  // it just reads its colors from the design system. (An `hsl(var(--primary))`
  // inline-style version was tried and reverted: `--primary`'s stored HSL
  // triplet in index.css doesn't round-trip to the exact `#8B2346` every
  // `primary-500` utility elsewhere uses — `success` doesn't have that
  // drift, but the mismatch would have shown up as a slightly different
  // burgundy only on this bar. `from-X to-X/85` reads the same hex Tailwind
  // classes already use everywhere else, with no rounding step.)
  const strong = score >= 85;
  return (
    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.15, ease: EASE_OUT, delay: 0.05 }}
        className={`h-full rounded-full bg-gradient-to-r ${strong ? 'from-success to-success/85' : 'from-primary-500 to-primary-500/85'}`}
      />
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
      <FiLock className="w-5 h-5 text-gold-600" />
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
  // 'interest' (default) shows the Express-Interest primary CTA.
  // 'message' is for people you've already matched with (Mutual) —
  // the primary CTA becomes "Message" and deep-links into the chat.
  primaryCta = 'interest',
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
  const isVerified = profile.verificationStatus === 'approved' || profile.User?.verificationStatus === 'approved' || profile.isVerified;

  // ── Compact ───────────────────────────────────
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: staggerIndex(index), duration: DUR.content, ease: EASE_OUT }}
        // Radius unified to the app-wide `rounded-xl` button/card system
        // (doctrine §2 ruling #6, §3.4); elevation declared once via
        // `shadow-card` alone — the border this dropped made it a ghost card
        // (doctrine §3.4, audit finding).
        className={`bg-white rounded-xl shadow-card ${HOVER}:shadow-card-hover ${HOVER}:-translate-y-1 transition-[transform,box-shadow] duration-[160ms] p-4 cursor-pointer group`}
        onClick={handleCardClick}
        role="article"
        aria-label={`Profile of ${fullName}`}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {hasPhoto ? (
              <RetryImage
                src={getImageUrl(profile.profilePhoto || profile.profile_photo, API_BASE_URL, 'thumbnail')}
                alt={`${fullName}`}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-md"
                loading="lazy"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-display font-semibold text-lg ring-2 ring-white dark:ring-surface-dark-3 shadow-md">
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
                      ? 'text-gold-500'
                      : profile.premiumPlan === 'premium_plus'
                      ? 'text-primary-500'
                      : 'text-primary-400'
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
              whileTap={{ scale: 0.9 }}
              onClick={handleLike}
              aria-label={isLiked ? 'Unlike' : 'Like'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-[160ms] flex-shrink-0 ${HOVER}:scale-110 ${isLiked ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-primary-400 hover:bg-primary-50'
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
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16, ease: 'easeOut' } }}
      transition={{ delay: staggerIndex(index), duration: DUR.content, ease: EASE_OUT }}
      // Shadow tokens come from tailwind.config (doctrine §3.4) instead of the
      // hand-typed literals + JS mouseenter/leave this replaced — same reason
      // the lift is a pointer-gated CSS class, not a framer whileHover: a tap
      // synthesizes an enter without a reliable leave and leaves the card
      // stuck raised.
      // `h-full flex flex-col` here + `mt-auto` on the action row below are
      // the grid row-alignment fix (audit Part 5 #10): a CSS Grid row already
      // stretches every card to the tallest one, but only a flex column
      // turns that spare height into the shorter cards' button row landing
      // on the same baseline instead of just leaving blank space beneath it.
      // Radius unified to `rounded-xl` (doctrine §2 ruling #6, §3.4 — "one
      // system, no exceptions"); was `rounded-3xl` (24px), off the card/button
      // scale.
      className={`group relative bg-white rounded-xl overflow-hidden cursor-pointer shadow-card ${HOVER}:shadow-card-hover ${HOVER}:-translate-y-1.5 transition-[transform,box-shadow] duration-[200ms] h-full flex flex-col`}
      onClick={handleCardClick}
      role="article"
      aria-label={`Profile of ${fullName}`}
    >
      {hasPhoto ? (
        /* ── Photo Section ──────────────────────────── */
        <div className="relative h-56 overflow-hidden flex-shrink-0">
          <RetryImage
            src={getImageUrl(profile.profilePhoto || profile.profile_photo, API_BASE_URL, 'profile')}
            alt={`${fullName}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
            onError={() => setImgError(true)}
          />

          {/* Premium blur lock */}
          {isPremiumLocked && <PremiumBlur />}

          {/* Bottom scrim — always visible for legibility */}
          {!isPremiumLocked && (
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none" />
          )}

          {/* Online indicator */}
          {isOnline && (
            <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-2.5 py-1 bg-white/85 backdrop-blur-md rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-success" />
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
              // Never scale(0) (doctrine §4.5/§8) — starts at 0.95 + opacity 0.
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
              className={`absolute top-3.5 right-14 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-lg ${
                profile.premiumPlan === 'vip'
                  ? 'bg-gold-500'
                  : profile.premiumPlan === 'premium_plus'
                  ? 'bg-primary-600'
                  : 'bg-primary-400'
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
                whileTap={{ scale: 0.88 }}
                onClick={handleShortlist}
                aria-label={isShortlisted ? 'Remove from shortlist' : 'Shortlist'}
                // 44px hit-target floor (doctrine §3.5) — was w-10/40px,
                // below the floor the photoless header's equivalent button
                // already meets.
                className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors duration-[160ms] ${HOVER}:scale-110 ${isShortlisted
                    ? 'bg-neutral-800 text-white'
                    : 'bg-white/70 backdrop-blur-md text-neutral-500 hover:bg-white hover:text-neutral-800 ring-1 ring-white/50'
                  }`}
              >
                <FiBookmark className={`w-4.5 h-4.5 ${isShortlisted ? 'fill-current' : ''}`} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleLike}
                aria-label={isLiked ? 'Unlike' : 'Express interest'}
                className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors duration-[160ms] ${HOVER}:scale-110 ${isLiked
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
      ) : (
        /* ── Photoless identity header (audit Part 5 #3) ──────────────────
           A missing photo is a real, common production state, not an edge
           case, so it no longer reserves a 220px full-bleed hero for a flat
           tint and a monogram. It leads with what we do know instead: name,
           verification, age, city and compatibility, at a height set by that
           content rather than a fixed hero slot. The quick shortlist/like
           actions move here too, since there is no photo to float them on. */
        <div className="relative flex items-center gap-2.5 px-4 pt-4 pb-3.5 flex-shrink-0">
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center ring-1 ring-primary-500/15">
              {isPremiumLocked ? (
                <FiLock className="w-4 h-4 text-primary-400" aria-hidden="true" />
              ) : (
                <span className="text-sm font-display font-semibold text-primary-700 dark:text-primary-300">
                  {initials}
                </span>
              )}
            </div>
            {isOnline && !isPremiumLocked && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-white dark:border-surface-dark-3" />
            )}
          </div>

          {/* Name gets the width budget: at 3-up desktop a card is ~300px, so
              the compat pill (not the full CompatArc dial) and a single quick
              action are what's left after the avatar — the dial and a
              second icon button once truncated the name to "Lo…". */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="font-display text-[15px] font-semibold text-neutral-800 truncate leading-snug">
                {fullName}
              </h3>
              {isVerified && (
                <FiCheckCircle
                  className="w-3.5 h-3.5 text-primary-600 flex-shrink-0"
                  role="img"
                  aria-label="Verified profile"
                />
              )}
              {profile.isPremium && (
                <FaCrown
                  className={`w-3 h-3 flex-shrink-0 ${
                    profile.premiumPlan === 'vip'
                      ? 'text-gold-500'
                      : profile.premiumPlan === 'premium_plus'
                      ? 'text-primary-500'
                      : 'text-primary-400'
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
            <p className="text-[12px] text-neutral-500 truncate">
              {getAge()} yrs{profile.city ? ` · ${profile.city}` : ''}
            </p>
          </div>

          {profile.compatibilityScore ? (
            // Tailwind tokens, not inline hex — `text-primary-700`/`bg-primary-50`/
            // `text-success`/`bg-success-50` all carry dark-mode overrides
            // (index.css) that a hardcoded inline `style` color would silently
            // bypass. `bg-success/10` (an arbitrary-opacity utility, not one of
            // those tokens) had no such override and rendered an un-tuned raw
            // green wash in dark mode — same fix family as the AA failure this
            // replaced (burgundy text measured straight through onto a
            // near-black card), just the ≥85% branch, and matching the
            // `bg-success-50` convention used everywhere else in the app for
            // this exact "text-success on a tint" chip (e.g. SectionHeader,
            // Verification, Subscription).
            <span
              className={`flex-shrink-0 px-2 py-1 rounded-full text-[11px] font-bold ${
                profile.compatibilityScore >= 85 ? 'text-success bg-success-50' : 'text-primary-700 bg-primary-50'
              }`}
              title={`${Math.round(profile.compatibilityScore)}% match`}
            >
              {Math.round(profile.compatibilityScore)}%
            </span>
          ) : null}

          {/* Only the shortlist quick-action survives here — "like" already
              has the full-width Express Interest button below, and keeping
              both icons is what left no room for the name. 44px (doctrine
              §3.5's hit-target floor, not the 32px an icon this size would
              otherwise get) — the icon glyph stays small, the tappable
              circle doesn't. */}
          {showActions && !isPremiumLocked && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleShortlist}
              aria-label={isShortlisted ? 'Remove from shortlist' : 'Shortlist'}
              // `hover:bg-neutral-100` has a dark-mode override (index.css);
              // `hover:text-neutral-800` doesn't, so it stayed near-black on
              // that dark hover background — dropped rather than adding a
              // hover-only dark override this file's scope doesn't cover; the
              // resting `text-neutral-500` (already dark-safe) carries the icon
              // through hover too.
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-[160ms] ${HOVER}:scale-110 ${isShortlisted
                  ? 'bg-neutral-800 text-white'
                  : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                }`}
            >
              <FiBookmark className={`w-3.5 h-3.5 ${isShortlisted ? 'fill-current' : ''}`} />
            </motion.button>
          )}
        </div>
      )}

      {/* ── Info Section ───────────────────────────── */}
      <div className="p-5 flex flex-col flex-1 min-h-0">
        {/* Name + age + score arc — the photoless header above already shows
            this, so it's only repeated here when there's a photo. */}
        {hasPhoto && (
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-display text-lg font-semibold text-neutral-800 group-hover:text-primary-500 transition-colors truncate leading-snug">
                  {fullName}
                </h3>
                {isVerified && (
                  <motion.div
                    // Never scale(0) (doctrine §4.5/§8) — starts at 0.95 + opacity 0.
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 260 }}
                    title="Verified profile"
                    className="flex items-center gap-0.5 px-2 py-1 bg-primary-50 rounded-full border border-primary-200"
                  >
                    <FiCheckCircle className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">Verified</span>
                  </motion.div>
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
        )}

        {/* Shimmer bar */}
        {profile.compatibilityScore && (
          <div className={hasPhoto ? 'mb-4' : 'mb-4 mt-0.5'}>
            <ShimmerBar score={profile.compatibilityScore} />
          </div>
        )}

        {/* Detail chips — city already reads in the photoless header above,
            so it isn't repeated there. */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {hasPhoto && profile.city && (
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
        {/* `mt-auto` is the other half of the row-alignment fix (audit Part 5
            #10, doctrine §6 — buttons in a card group share a baseline
            regardless of how much content sits above them): whatever grew
            above — a photo hero vs. the shorter photoless header, one detail
            chip vs. three — this row still lands at the same height as its
            neighbours in the grid row. Buttons use `rounded-xl`, unified with
            the card root and the app-wide button system (doctrine §2 ruling
            #6, §3.4) — was `rounded-2xl`, off the scale. */}
        {showActions && (
          <div className="flex gap-2.5 pt-4 border-t border-neutral-100 mt-auto">
            {isPremiumLocked ? (
              <button
                onClick={(e) => { e.stopPropagation(); navigate('/subscription'); }}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-gold-400 to-gold-500 text-primary-900 text-sm font-semibold rounded-xl hover:from-gold-500 hover:to-gold-600 transition-colors duration-[160ms] shadow-gold"
              >
                <FaCrown className="w-3.5 h-3.5" />
                Unlock profile
              </button>
            ) : primaryCta === 'message' ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/chat?to=${userId}`); }}
                  className="flex-1 py-3 text-sm font-semibold rounded-xl transition-colors duration-[160ms] bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-burgundy inline-flex items-center justify-center gap-1.5"
                >
                  <FiMessageCircle className="w-4 h-4" /> Message
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCardClick}
                  className="flex-1 py-3 text-sm font-semibold rounded-xl transition-colors duration-[160ms] border border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/50 flex items-center justify-center gap-1.5"
                >
                  View Profile
                  <FiArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleLike}
                  className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-colors duration-[160ms] ${isLiked
                      ? 'bg-primary-50 text-primary-600 border border-primary-200'
                      : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-burgundy'
                    }`}
                >
                  {isLiked ? (
                    <span className="inline-flex items-center justify-center gap-1.5"><FiCheck className="w-4 h-4" /> Interest Sent</span>
                  ) : 'Express Interest'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCardClick}
                  className="flex-1 py-3 text-sm font-semibold rounded-xl transition-colors duration-[160ms] border border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/50 flex items-center justify-center gap-1.5"
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
