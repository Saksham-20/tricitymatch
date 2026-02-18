import React from 'react';
import { cn } from '../../utils/cn';

/**
 * Avatar Component
 * 
 * Display user profile pictures with fallback to initials.
 * 
 * @example
 * <Avatar src="/user.jpg" name="John Doe" size="lg" />
 * <Avatar name="John Doe" online />
 */

const Avatar = ({
  src,
  name,
  size = 'md',
  online,
  verified,
  blur = false,
  className,
  ...props
}) => {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-28 h-28 text-2xl',
  };

  const indicatorSizes = {
    xs: 'w-1.5 h-1.5 border',
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-2',
    lg: 'w-3 h-3 border-2',
    xl: 'w-4 h-4 border-2',
    '2xl': 'w-5 h-5 border-2',
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getColorFromName = (name) => {
    if (!name) return 'bg-gray-400';
    const colors = [
      'bg-rose-500',
      'bg-pink-500',
      'bg-purple-500',
      'bg-indigo-500',
      'bg-blue-500',
      'bg-cyan-500',
      'bg-teal-500',
      'bg-emerald-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className={cn('relative inline-block', className)} {...props}>
      <div
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center font-semibold text-white',
          sizes[size],
          !src && getColorFromName(name)
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name || 'Avatar'}
            className={cn(
              'w-full h-full object-cover',
              blur && 'blur-md'
            )}
            loading="lazy"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {/* Online indicator */}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white',
            online ? 'bg-green-500' : 'bg-gray-400',
            indicatorSizes[size]
          )}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}

      {/* Verified badge */}
      {verified && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5',
            size === 'xs' && 'hidden',
            (size === 'sm' || size === 'md') && 'p-0.5',
            size === 'lg' && 'p-1',
            (size === 'xl' || size === '2xl') && 'p-1.5'
          )}
        >
          <svg
            className={cn(
              'text-white',
              (size === 'sm' || size === 'md') && 'w-2 h-2',
              size === 'lg' && 'w-3 h-3',
              (size === 'xl' || size === '2xl') && 'w-4 h-4'
            )}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
    </div>
  );
};

export default Avatar;
