import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus } from '../../hooks';

/**
 * Offline Indicator Component
 * Shows a banner when the user is offline
 */
const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white py-2 px-4 text-center shadow-lg"
        >
          <div className="flex items-center justify-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-3.536 3.536L6 12m0 0l5.636-5.636M6 12l5.636 5.636"
              />
            </svg>
            <span className="font-medium">
              You're offline. Some features may be unavailable.
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
