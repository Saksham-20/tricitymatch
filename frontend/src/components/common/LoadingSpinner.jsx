import React from 'react';
import { motion } from 'framer-motion';

/**
 * Loading Spinner Component
 * Used as fallback for lazy-loaded components
 */
const LoadingSpinner = ({ 
  size = 'default', 
  fullScreen = false,
  message = 'Loading...',
  showMessage = true 
}) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    default: 'w-10 h-10',
    large: 'w-16 h-16',
  };

  const spinner = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`${fullScreen ? 'min-h-screen' : 'min-h-[200px]'} flex flex-col items-center justify-center`}
    >
      {/* Animated Logo/Spinner */}
      <div className="relative">
        <motion.div
          className={`${sizeClasses[size]} rounded-full border-4 border-rose-200`}
          style={{ borderTopColor: '#E11D48' }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        
        {/* Optional heart pulse in center */}
        {size !== 'small' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <svg
              className="w-4 h-4 text-rose-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </motion.div>
        )}
      </div>

      {/* Loading message */}
      {showMessage && (
        <motion.p
          className="mt-4 text-gray-500 text-sm font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );

  return spinner;
};

/**
 * Page Loading Skeleton
 * Shows a skeleton UI while page is loading
 */
export const PageSkeleton = () => (
  <div className="min-h-screen bg-gray-50 p-4 md:p-8">
    <div className="max-w-6xl mx-auto">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="h-48 bg-gray-200 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Inline Loading Component
 * For smaller loading states within components
 */
export const InlineLoader = ({ message = 'Loading...' }) => (
  <div className="flex items-center gap-2 text-gray-500">
    <motion.div
      className="w-4 h-4 rounded-full border-2 border-gray-300"
      style={{ borderTopColor: '#E11D48' }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
    <span className="text-sm">{message}</span>
  </div>
);

/**
 * Button Loading State
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
