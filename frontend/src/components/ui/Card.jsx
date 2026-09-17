import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

// Hover-driven lift/shadow is a mouse-only affordance (doctrine §4.7): touch
// fires a false hover on tap, which would leave a card stuck "raised" after
// the finger lifts. Computed once — this never needs to react to a mouse
// being plugged in mid-session for a card lift effect.
const HOVER_CAPABLE =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Card Component
 * 
 * A flexible card container with optional header, footer, and animations.
 * 
 * @example
 * <Card>
 *   <Card.Header>
 *     <h3>Card Title</h3>
 *   </Card.Header>
 *   <Card.Body>
 *     Card content goes here
 *   </Card.Body>
 *   <Card.Footer>
 *     <Button>Action</Button>
 *   </Card.Footer>
 * </Card>
 */

const Card = React.forwardRef(
  (
    {
      children,
      className,
      variant = 'elevated',
      padding = 'md',
      hover = false,
      animate = false,
      onClick,
      ...props
    },
    ref
  ) => {
    const variants = {
      // Elevation declared once (shadow, no border) — doctrine §3.4.
      elevated: 'bg-white dark:bg-neutral-900 shadow-md',
      outlined: 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800',
      filled: 'bg-neutral-50 dark:bg-neutral-800/60',
      // Premium-tinted surface (mirrors the existing .card-premium convention
      // in index.css, which uses the same gold-100 cream) — replaces the
      // off-token #FDF8F2 literal.
      gradient: 'bg-gold-50 dark:bg-gold-900/10 border border-gold-100 dark:border-gold-800/30',
    };

    const paddings = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4 md:p-6',
      lg: 'p-6 md:p-8',
    };

    const baseClasses = cn(
      'rounded-2xl overflow-hidden',
      variants[variant],
      paddings[padding],
      // Named properties at doctrine §4.3 duration, pointer-gated (§4.7): a
      // raised shadow on tap-and-hold would otherwise stick on touch devices.
      hover && `transition-shadow duration-[160ms] ${HOVER_CAPABLE ? 'hover:shadow-lg' : ''} cursor-pointer`,
      onClick && 'cursor-pointer',
      className
    );

    if (animate) {
      return (
        <motion.div
          ref={ref}
          className={baseClasses}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          whileHover={hover && HOVER_CAPABLE ? { y: -2 } : undefined}
          onClick={onClick}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={baseClasses} onClick={onClick} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card subcomponents
const CardHeader = ({ children, className, ...props }) => (
  <div
    className={cn('pb-4 border-b border-neutral-100 dark:border-neutral-800', className)}
    {...props}
  >
    {children}
  </div>
);
CardHeader.displayName = 'Card.Header';

const CardBody = ({ children, className, ...props }) => (
  <div className={cn('py-4', className)} {...props}>
    {children}
  </div>
);
CardBody.displayName = 'Card.Body';

const CardFooter = ({ children, className, ...props }) => (
  <div
    className={cn('pt-4 border-t border-neutral-100 dark:border-neutral-800', className)}
    {...props}
  >
    {children}
  </div>
);
CardFooter.displayName = 'Card.Footer';

// Attach subcomponents
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
