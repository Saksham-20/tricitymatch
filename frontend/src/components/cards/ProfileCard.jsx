import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiHeart, FiStar, FiBookmark, FiMapPin, FiCalendar, FiBook, FiBriefcase } from 'react-icons/fi';
import { API_BASE_URL } from '../../utils/api';

/**
 * ProfileCard Component - Reusable card for displaying user profiles
 * 
 * @param {Object} profile - Profile data object
 * @param {string} userId - User ID for navigation
 * @param {number} index - Index for stagger animation delay
 * @param {string} variant - 'full' (default) or 'compact' display mode
 * @param {function} onLike - Callback when like button is clicked
 * @param {function} onShortlist - Callback when shortlist button is clicked
 * @param {boolean} showActions - Whether to show action buttons (default: true)
 * @param {boolean} isAISuggested - Whether to show AI suggested badge
 */
const ProfileCard = ({ 
  profile, 
  userId, 
  index = 0, 
  variant = 'full',
  onLike, 
  onShortlist,
  showActions = true,
  isAISuggested = false
}) => {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(profile.matchStatus === 'like');
  const [isShortlisted, setIsShortlisted] = useState(profile.matchStatus === 'shortlist');
  
  // Calculate age from dateOfBirth if age not provided
  const getAge = () => {
    if (profile.age) return profile.age;
    if (profile.dateOfBirth) {
      const birthDate = new Date(profile.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      return monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
        ? age - 1 
        : age;
    }
    return 'N/A';
  };

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Profile';
  const initials = (profile.firstName?.[0] || '') + (profile.lastName?.[0] || '') || '?';
  
  const handleCardClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  const handleLike = (e) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    onLike?.();
  };

  const handleShortlist = (e) => {
    e.stopPropagation();
    setIsShortlisted(!isShortlisted);
    onShortlist?.();
  };

  // Compact variant - smaller card for sidebars or grids
  if (variant === 'compact') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.05, duration: 0.25 }}
        whileHover={{ y: -4 }}
        className="card p-0 overflow-hidden cursor-pointer group"
        onClick={handleCardClick}
        role="article"
        aria-label={`Profile of ${fullName}`}
      >
        <div className="flex items-center gap-3 p-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile.profilePhoto ? (
              <img
                src={`${API_BASE_URL}${profile.profilePhoto}`}
                alt={`Profile photo of ${fullName}`}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-md"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-hero flex items-center justify-center text-white font-bold text-lg ring-2 ring-white shadow-md">
                {initials}
              </div>
            )}
            {profile.compatibilityScore >= 85 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-gold rounded-full flex items-center justify-center">
                <FiStar className="w-3 h-3 text-white fill-white" />
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-800 truncate group-hover:text-primary-500 transition-colors">
              {fullName}
            </h3>
            <p className="text-sm text-neutral-600">{getAge()} yrs • {profile.city || 'Location N/A'}</p>
            {profile.compatibilityScore && (
              <span className="text-xs text-gold-600 font-medium">{Math.round(profile.compatibilityScore)}% Match</span>
            )}
          </div>
          
          {/* Quick Action */}
          {showActions && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLike}
              aria-label={isLiked ? "Unlike profile" : "Like profile"}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                isLiked 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-neutral-100 text-primary-500 hover:bg-primary-50'
              }`}
            >
              <FiHeart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  // Full variant - default card with all details
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -6 }}
      className="card p-0 overflow-hidden cursor-pointer group"
      onClick={handleCardClick}
      role="article"
      aria-label={`Profile of ${fullName}`}
    >
      {/* Photo Section */}
      <div className="relative h-52 overflow-hidden">
        {profile.profilePhoto ? (
          <img
            src={`${API_BASE_URL}${profile.profilePhoto}`}
            alt={`Profile photo of ${fullName}`}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={`w-full h-full bg-gradient-to-br from-primary-100 via-gold-50 to-primary-50 flex items-center justify-center ${profile.profilePhoto ? 'hidden' : ''}`}
        >
          <span className="text-4xl font-bold text-primary-300">
            {initials}
          </span>
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Action Icons */}
        {showActions && (
          <div className="absolute top-3 right-3 flex gap-2 z-10">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShortlist}
              aria-label={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                isShortlisted 
                  ? 'bg-gold text-white' 
                  : 'bg-white/95 backdrop-blur-sm text-neutral-700 hover:bg-white'
              }`}
            >
              <FiBookmark className={`w-5 h-5 ${isShortlisted ? 'fill-current' : ''}`} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLike}
              aria-label={isLiked ? "Unlike profile" : "Like profile"}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                isLiked 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-white/95 backdrop-blur-sm text-primary-500 hover:bg-white'
              }`}
            >
              <motion.div
                animate={isLiked ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <FiHeart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </motion.div>
            </motion.button>
          </div>
        )}
        
        {/* AI Suggested Badge */}
        {isAISuggested && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-3 left-3 px-3 py-1.5 bg-gradient-hero rounded-full text-xs font-semibold flex items-center gap-1.5 text-white shadow-lg"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            Suggested for you
          </motion.div>
        )}
        
        {/* Match Badge */}
        {!isAISuggested && profile.compatibilityScore && profile.compatibilityScore >= 80 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute top-3 left-3 px-3 py-1.5 bg-neutral-900/90 backdrop-blur-sm rounded-full text-xs font-bold flex items-center gap-1.5 text-white shadow-lg"
          >
            <FiStar className="w-3.5 h-3.5 text-gold fill-gold" />
            {Math.round(profile.compatibilityScore)}% Match
          </motion.div>
        )}
      </div>
      
      {/* Info Section */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-neutral-800 mb-2 group-hover:text-primary-500 transition-colors">
          {fullName}
        </h3>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-neutral-600">
            <FiCalendar className="w-4 h-4 text-primary-400" aria-hidden="true" />
            <span className="text-sm">{getAge()} years</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600">
            <FiMapPin className="w-4 h-4 text-primary-400" aria-hidden="true" />
            <span className="text-sm">{profile.city || 'Location not specified'}</span>
          </div>
          {profile.education && (
            <div className="flex items-center gap-2 text-neutral-500">
              <FiBook className="w-4 h-4 text-primary-400" aria-hidden="true" />
              <span className="text-sm truncate">{profile.education}</span>
            </div>
          )}
          {profile.profession && (
            <div className="flex items-center gap-2 text-neutral-500">
              <FiBriefcase className="w-4 h-4 text-primary-400" aria-hidden="true" />
              <span className="text-sm truncate">{profile.profession}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex gap-3 pt-4 border-t border-neutral-100">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLike}
              className="flex-1 btn-gold text-sm py-2.5"
            >
              Express Interest
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCardClick}
              className="flex-1 btn-secondary text-sm py-2.5"
            >
              View Profile
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfileCard;
