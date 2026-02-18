import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

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
      elevated: 'bg-white shadow-md',
      outlined: 'bg-white border border-gray-200',
      filled: 'bg-gray-50',
      gradient: 'bg-gradient-to-br from-rose-50 to-pink-50',
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
      hover && 'transition-all duration-200 hover:shadow-lg cursor-pointer',
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
          whileHover={hover ? { y: -2 } : undefined}
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
    className={cn('pb-4 border-b border-gray-100', className)}
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
    className={cn('pt-4 border-t border-gray-100', className)}
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
