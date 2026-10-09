import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiHeart, FiMessageCircle, FiMapPin } from 'react-icons/fi';
import { API_BASE_URL } from '../../utils/api';
import { getImageUrl } from '../../utils/cloudinary';
import RetryImage from '../ui/RetryImage';
import { staggerIndex, DUR, EASE_OUT } from '../../utils/animations';

/**
 * MatchCard Component - Card for displaying mutual matches
 * 
 * @param {Object} match - Match data object
 * @param {string} userId - User ID for navigation
 * @param {number} index - Index for stagger animation delay
 * @param {function} onChat - Callback when chat button is clicked
 */
const MatchCard = ({ match, userId, index = 0, onChat }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fullName = `${match.firstName || ''} ${match.lastName || ''}`.trim() || t('cards.unknown');
  const initials = (match.firstName?.[0] || '') + (match.lastName?.[0] || '') || '?';
  
  const handleClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  const handleChatClick = (e) => {
    e.stopPropagation();
    if (onChat) {
      onChat();
    } else {
      // Deep-link into this match's thread when we know who they are, instead
      // of dropping the member into the generic conversation list.
      navigate(userId ? `/chat?to=${userId}` : '/chat');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16, ease: 'easeOut' } }}
      transition={{ delay: staggerIndex(index), duration: DUR.content, ease: EASE_OUT }}
      // Lift + shadow on hover already live on the `.card` class (index.css),
      // pointer-gated there — no separate whileHover needed here.
      onClick={handleClick}
      // rounded-xl (12px) overrides the .card class's rounded-2xl so mutual-match
      // cards share the app-wide card radius system ProfileCard was unified to.
      className="card rounded-xl cursor-pointer group"
      role="article"
      aria-label={t('cards.mutualMatchWith', { name: fullName })}
    >
      <div className="text-center">
        {/* Profile Image */}
        <div className="relative mx-auto mb-4">
          {(match.profilePhoto || match.profile_photo) ? (
            <RetryImage
              src={getImageUrl(match.profilePhoto || match.profile_photo, API_BASE_URL, 'profile')}
              alt={t('cards.photoOf', { name: fullName })}
              className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-white dark:border-neutral-800 shadow-lg group-hover:border-primary-100 transition-colors"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={`w-24 h-24 rounded-full mx-auto bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-display text-2xl font-semibold border-4 border-white dark:border-neutral-800 shadow-lg ${(match.profilePhoto || match.profile_photo) ? 'hidden' : ''}`}
          >
            {initials}
          </div>
          
          {/* Mutual Match Badge */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.2, ease: EASE_OUT }}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 bg-success text-white text-xs font-semibold rounded-full shadow-md flex items-center gap-1"
          >
            <FiHeart className="w-3 h-3" aria-hidden="true" />
            <span>{t('cards.mutual')}</span>
          </motion.div>
        </div>
        
        <h3 className="text-lg font-semibold text-neutral-800 mb-1 group-hover:text-primary-500 transition-colors">
          {userId ? (
            <Link
              to={`/profile/${userId}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 hover:underline"
            >
              {fullName}
            </Link>
          ) : (
            fullName
          )}
        </h3>
        <p className="text-neutral-600 text-sm flex items-center justify-center gap-1 mb-3">
          <FiMapPin className="w-3.5 h-3.5" aria-hidden="true" />
          {match.city || t('cards.locationNotSpecified')}
        </p>
        
        {match.compatibilityScore && (
          <span className="inline-block px-3 py-1 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full border border-primary-100">
            {t('cards.compatible', { n: Math.round(match.compatibilityScore) })}
          </span>
        )}
        
        {/* Chat Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleChatClick}
          aria-label={t('cards.startChatWith', { name: fullName })}
          className="mt-4 w-full min-h-[44px] py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
        >
          <FiMessageCircle className="w-4 h-4" aria-hidden="true" />
          {t('cards.message')}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default MatchCard;
