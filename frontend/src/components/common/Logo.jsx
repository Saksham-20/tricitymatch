import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Responsive Logo component — mobile-first.
 *
 * Variants:
 *   "default"  – image + text side-by-side (navbar)
 *   "icon"     – image only (compact spaces)
 *   "stacked"  – image on top, text below (auth pages, footer)
 *   "white"    – like default but white text (dark backgrounds)
 *
 * Sizes: "xs" | "sm" | "md" | "lg" | "xl"
 */

const sizeMap = {
  xs: { img: 'w-8 h-8',   text: 'text-base', gap: 'gap-1.5' },
  sm: { img: 'w-10 h-10', text: 'text-xl',   gap: 'gap-2'   },
  md: { img: 'w-12 h-12', text: 'text-2xl',  gap: 'gap-2'   },
  lg: { img: 'w-16 h-16', text: 'text-3xl',  gap: 'gap-2.5' },
  xl: { img: 'w-24 h-24', text: 'text-4xl',  gap: 'gap-3'   },
};

const Logo = ({
  variant = 'default',
  size = 'md',
  linkTo = '/',
  className = '',
  showText = true,
}) => {
  const s = sizeMap[size] || sizeMap.md;

  const isWhite = variant === 'white';
  const isStacked = variant === 'stacked';
  const isIcon = variant === 'icon';

  const textColor = isWhite
    ? 'text-white'
    : 'bg-gradient-to-r from-primary-500 to-gold-500 bg-clip-text text-transparent';

  const wrapperLayout = isStacked
    ? `flex flex-col items-center ${s.gap}`
    : `flex items-center ${s.gap}`;

  const content = (
    <span className={`${wrapperLayout} ${className}`}>
      <img
        src="/images/logo.svg"
        alt="TricityShadi logo"
        className={`${s.img} object-contain flex-shrink-0 rounded-lg`}
        loading="eager"
        width={40}
        height={40}
      />
      {showText && !isIcon && (
        <span className={`font-display font-bold ${s.text} ${textColor} leading-tight`}>
          TricityShadi
        </span>
      )}
    </span>
  );

  if (!linkTo) return content;

  return (
    <Link to={linkTo} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg">
      {content}
    </Link>
  );
};

export default Logo;
