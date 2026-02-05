import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiMessageCircle, FiX, FiArrowRight } from 'react-icons/fi';
import { API_BASE_URL } from '../../utils/api';
import { getImageUrl } from '../../utils/cloudinary';

/**
 * MatchPopup Component - Celebration popup when two users match
 * 
 * @param {boolean} isOpen - Whether the popup is visible
 * @param {function} onClose - Callback to close the popup
 * @param {Object} currentUser - Current user data (with profilePhoto, firstName)
 * @param {Object} matchedUser - Matched user data (with profilePhoto, firstName)
 * @param {function} onChat - Callback when user clicks to chat
 * @param {function} onContinue - Callback when user clicks to continue browsing
 */
const MatchPopup = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  matchedUser, 
  onChat, 
  onContinue 
}) => {
  const [confetti, setConfetti] = useState([]);

  // Generate confetti particles on mount
  useEffect(() => {
    if (isOpen) {
      const particles = [];
      const colors = ['#8B2346', '#C9A227', '#F8E8EC', '#FDF6E3', '#E5A3B8'];
      
      for (let i = 0; i < 50; i++) {
        particles.push({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 0.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 720 - 360,
          size: Math.random() * 8 + 4,
        });
      }
      setConfetti(particles);
    }
  }, [isOpen]);

  const getInitials = (user) => {
    if (!user) return '?';
    return (user.firstName?.[0] || '') + (user.lastName?.[0] || '') || '?';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-popup-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confetti.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  left: `${particle.x}%`,
                  top: '50%',
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                }}
                initial={{ y: 0, opacity: 1, rotate: 0 }}
                animate={{
                  y: [-20, -500],
                  opacity: [1, 0],
                  rotate: particle.rotation,
                  x: [0, (Math.random() - 0.5) * 200],
                }}
                transition={{
                  duration: 3,
                  delay: particle.delay,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* Popup Content */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 overflow-hidden"
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-white to-gold-50/30 pointer-events-none" />
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-neutral-100 rounded-full transition-colors z-10"
              aria-label="Close"
            >
              <FiX className="w-5 h-5 text-neutral-500" />
            </button>

            <div className="relative z-10">
              {/* Hearts Animation */}
              <motion.div
                className="flex justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                <div className="relative">
                  {/* Animated rings */}
                  <motion.div
                    className="absolute inset-0 -m-4 rounded-full border-2 border-primary-200"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-0 -m-8 rounded-full border-2 border-gold-200"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  />
                  
                  {/* Heart icon */}
                  <motion.div
                    className="w-20 h-20 bg-gradient-hero rounded-full flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <FiHeart className="w-10 h-10 text-white fill-white" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                id="match-popup-title"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold font-display text-center mb-2 text-gradient-primary"
              >
                It's a Match!
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-neutral-600 text-center mb-8"
              >
                You and {matchedUser?.firstName || 'someone special'} have liked each other
              </motion.p>

              {/* Profile Photos */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center items-center gap-4 mb-8"
              >
                {/* Current User Photo */}
                <motion.div
                  className="relative"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {currentUser?.profilePhoto ? (
                    <img
                      src={getImageUrl(currentUser.profilePhoto, API_BASE_URL, 'profile')}
                      alt="Your profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-hero flex items-center justify-center text-white font-bold text-2xl border-4 border-white shadow-lg">
                      {getInitials(currentUser)}
                    </div>
                  )}
                </motion.div>

                {/* Heart between photos */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center"
                >
                  <FiHeart className="w-6 h-6 text-primary-500 fill-primary-500" />
                </motion.div>

                {/* Matched User Photo */}
                <motion.div
                  className="relative"
                  animate={{ x: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {matchedUser?.profilePhoto ? (
                    <img
                      src={getImageUrl(matchedUser.profilePhoto, API_BASE_URL, 'profile')}
                      alt={`${matchedUser?.firstName}'s profile`}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-bold text-2xl border-4 border-white shadow-lg">
                      {getInitials(matchedUser)}
                    </div>
                  )}
                </motion.div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onChat}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <FiMessageCircle className="w-5 h-5" />
                  Send a Message
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onContinue}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  Keep Browsing
                  <FiArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MatchPopup;
