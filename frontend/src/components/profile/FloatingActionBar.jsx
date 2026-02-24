import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiBookmark, FiMessageCircle, FiCheck } from 'react-icons/fi';

/**
 * FloatingActionBar — Mobile-only sticky bottom action bar for profile pages.
 *
 * Usage:
 *   <FloatingActionBar
 *     onSendInterest={fn}
 *     onShortlist={fn}
 *     onMessage={fn}
 *     isInterestSent={bool}
 *     isShortlisted={bool}
 *   />
 *
 * Only visible on mobile (md:hidden).
 * Elevated with blur backdrop, rounded, pill-shaped.
 */
const FloatingActionBar = ({
  onSendInterest,
  onShortlist,
  onMessage,
  isInterestSent = false,
  isShortlisted = false,
}) => {
  const [interestSent, setInterestSent] = useState(isInterestSent);
  const [shortlisted, setShortlisted]   = useState(isShortlisted);
  const [showSuccess, setShowSuccess]   = useState(false);

  const handleInterest = () => {
    if (interestSent) return;
    setInterestSent(true);
    setShowSuccess(true);
    onSendInterest?.();
    setTimeout(() => setShowSuccess(false), 2200);
  };

  const handleShortlist = () => {
    setShortlisted(!shortlisted);
    onShortlist?.();
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe">
      {/* Success toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.28 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 bg-success text-white text-sm font-semibold rounded-full shadow-lg whitespace-nowrap"
          >
            <FiCheck className="w-4 h-4" />
            Interest sent successfully
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bar */}
      <div
        className="mx-4 mb-4 flex items-center gap-2 p-2 rounded-2xl border border-white/60"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(139,35,70,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {/* Send Interest — primary, takes most space */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleInterest}
          disabled={interestSent}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
            interestSent
              ? 'bg-success-50 text-success border border-success-100 cursor-default'
              : 'bg-primary-500 text-white shadow-burgundy hover:bg-primary-600 active:bg-primary-700'
          }`}
          aria-label={interestSent ? 'Interest already sent' : 'Send interest'}
        >
          <motion.div
            animate={interestSent ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            {interestSent
              ? <FiCheck className="w-4 h-4" />
              : <FiHeart className="w-4 h-4" />}
          </motion.div>
          {interestSent ? 'Interest Sent' : 'Send Interest'}
        </motion.button>

        {/* Shortlist */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={handleShortlist}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
            shortlisted
              ? 'bg-gold text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-gold-50 hover:text-gold-600'
          }`}
          aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
        >
          <FiBookmark className={`w-5 h-5 ${shortlisted ? 'fill-current' : ''}`} />
        </motion.button>

        {/* Message */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onMessage}
          className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center hover:bg-primary-50 hover:text-primary-500 transition-all duration-200 flex-shrink-0"
          aria-label="Send message"
        >
          <FiMessageCircle className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
};

export default FloatingActionBar;
