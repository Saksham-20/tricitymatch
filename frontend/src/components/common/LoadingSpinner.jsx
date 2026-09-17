import React from 'react';
import { motion } from 'framer-motion';

/**
 * Primary page loading spinner
 */
const LoadingSpinner = ({
  size = 'default',
  fullScreen = false,
  message = 'Loading...',
  showMessage = true,
}) => {
  const sizeMap = {
    small:   'w-6 h-6',
    default: 'w-10 h-10',
    large:   'w-16 h-16',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`${fullScreen ? 'min-h-[100dvh]' : 'min-h-[200px]'} flex flex-col items-center justify-center`}
    >
      {/* Spinner ring — one of doctrine's 3 sanctioned idle loops (no skeleton
          shape is possible here, the caller hasn't told us what's coming). The
          decorative heart that used to pulse in the center is gone: it was the
          same "heart-pulse" idle-loop pattern doctrine retired from
          tailwind.config, just reimplemented inline via framer-motion instead
          of the Tailwind class — motion performs, it doesn't breathe. */}
      <div className="relative">
        <motion.div
          className={`${sizeMap[size]} rounded-full border-[3px] border-primary-100 dark:border-primary-900/40`}
          style={{ borderTopColor: '#8B2346' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {showMessage && (
        <motion.p
          className="mt-4 text-neutral-500 dark:text-neutral-400 text-sm font-medium"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );
};

/**
 * Full-page skeleton used while lazy chunks are loading
 */
export const PageSkeleton = () => (
  <div className="min-h-[100dvh] bg-neutral-50 dark:bg-[#0f1117] p-4 md:p-8">
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="skeleton h-8 w-48 rounded-xl mb-2" />
        <div className="skeleton h-4 w-64 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl shadow-card overflow-hidden">
            <div className="skeleton h-48" />
            <div className="p-4 space-y-3">
              <div className="skeleton h-5 w-3/4 rounded-lg" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Inline loader for smaller loading states within components
 */
export const InlineLoader = ({ message = 'Loading...' }) => (
  <div className="flex items-center gap-2 text-neutral-500">
    <motion.div
      className="w-4 h-4 rounded-full border-2 border-primary-100"
      style={{ borderTopColor: '#8B2346' }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
    <span className="text-sm">{message}</span>
  </div>
);

/**
 * Spinner for inside buttons (white ring)
 */
export const ButtonLoader = () => (
  <motion.div
    className="w-5 h-5 rounded-full border-2 border-white/30"
    style={{ borderTopColor: 'white' }}
    animate={{ rotate: 360 }}
    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
  />
);

export default LoadingSpinner;
