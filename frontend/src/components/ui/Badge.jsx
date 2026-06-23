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
    default: 'bg-neutral-100 text-neutral-700',
    primary: 'bg-primary-100 text-primary-700',
    secondary: 'bg-neutral-100 text-neutral-600',
    success: 'bg-success-50 text-success',
    warning: 'bg-warning-light text-warning',
    danger: 'bg-destructive-light text-destructive',
    info: 'bg-info-light text-info',
    premium: 'bg-gradient-to-r from-gold-400 to-gold-600 text-neutral-900',
    elite: 'bg-gradient-to-r from-primary-500 to-primary-700 text-white',
    vip: 'bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 text-neutral-900 shadow-sm',
  };

  const sizes = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const dotColors = {
    default: 'bg-neutral-500',
    primary: 'bg-primary-500',
    secondary: 'bg-neutral-400',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    info: 'bg-info',
    premium: 'bg-white',
    elite: 'bg-white',
    vip: 'bg-white',
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
