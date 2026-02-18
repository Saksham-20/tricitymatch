import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind CSS classes
 * Combines clsx for conditional classes with tailwind-merge to handle conflicts
 * 
 * @example
 * cn('px-4 py-2', isActive && 'bg-blue-500', 'px-6') // => 'py-2 px-6 bg-blue-500'
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
