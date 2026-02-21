import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiHeart, FiMessageCircle, FiMapPin } from 'react-icons/fi';
import { API_BASE_URL } from '../../utils/api';
import { getImageUrl } from '../../utils/cloudinary';

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
  const fullName = `${match.firstName || ''} ${match.lastName || ''}`.trim() || 'Unknown';
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
      navigate('/chat');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -6 }}
      onClick={handleClick}
      className="card cursor-pointer group"
      role="article"
      aria-label={`Mutual match with ${fullName}`}
    >
      <div className="text-center">
        {/* Profile Image */}
        <div className="relative mx-auto mb-4">
          {(match.profilePhoto || match.profile_photo) ? (
            <img
              src={getImageUrl(match.profilePhoto || match.profile_photo, API_BASE_URL, 'profile')}
              alt={`Profile photo of ${fullName}`}
              className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-white shadow-lg group-hover:border-primary-100 transition-colors"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={`w-24 h-24 rounded-full mx-auto bg-gradient-to-br from-primary-100 to-gold-100 flex items-center justify-center text-neutral-600 text-2xl font-semibold border-4 border-white shadow-lg ${(match.profilePhoto || match.profile_photo) ? 'hidden' : ''}`}
          >
            {initials}
          </div>
          
          {/* Mutual Match Badge */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 bg-success text-white text-xs font-semibold rounded-full shadow-md flex items-center gap-1"
          >
            <FiHeart className="w-3 h-3" aria-hidden="true" />
            <span>Mutual</span>
          </motion.div>
        </div>
        
        <h3 className="text-lg font-semibold text-neutral-800 mb-1 group-hover:text-primary-500 transition-colors">
          {fullName}
        </h3>
        <p className="text-neutral-600 text-sm flex items-center justify-center gap-1 mb-3">
          <FiMapPin className="w-3.5 h-3.5" aria-hidden="true" />
          {match.city || 'Location not specified'}
        </p>
        
        {match.compatibilityScore && (
          <span className="inline-block px-3 py-1 bg-gold-50 text-gold-700 text-xs font-semibold rounded-full border border-gold-200">
            {Math.round(match.compatibilityScore)}% Compatible
          </span>
        )}
        
        {/* Chat Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleChatClick}
          aria-label={`Start chat with ${fullName}`}
          className="mt-4 w-full py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl text-sm font-semibold hover:from-gold-600 hover:to-gold-700 transition-all shadow-gold flex items-center justify-center gap-2"
        >
          <FiMessageCircle className="w-4 h-4" aria-hidden="true" />
          Message
        </motion.button>
      </div>
    </motion.div>
  );
};

export default MatchCard;
