import React from 'react';
import { cn } from '../../utils/cn';

/**
 * Badge Component
 * 
 * A small label for status, categories, or counts.
 * 
 * @example
 * <Badge variant="success">Verified</Badge>
 * <Badge variant="warning" dot>Pending</Badge>
 */

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pill = true,
  className,
  ...props
}) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    primary: 'bg-rose-100 text-rose-700',
    secondary: 'bg-pink-100 text-pink-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    premium: 'bg-gradient-to-r from-amber-400 to-orange-400 text-white',
    elite: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white',
  };

  const sizes = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const dotColors = {
    default: 'bg-gray-500',
    primary: 'bg-rose-500',
    secondary: 'bg-pink-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    premium: 'bg-white',
    elite: 'bg-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        variants[variant],
        sizes[size],
        pill ? 'rounded-full' : 'rounded-md',
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
