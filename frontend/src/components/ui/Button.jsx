import React from 'react';
import { motion } from 'framer-motion';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { ButtonLoader } from '../common/LoadingSpinner';

/**
 * Button Component
 * 
 * A versatile button component with multiple variants, sizes, and states.
 * 
 * @example
 * // Primary button
 * <Button variant="primary">Click me</Button>
 * 
 * // Loading state
 * <Button loading>Submitting...</Button>
 * 
 * // With icon
 * <Button leftIcon={<Icon />}>With Icon</Button>
 */

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 focus:ring-primary-500 shadow-burgundy hover:shadow-lg',
        secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus:ring-neutral-500',
        outline: 'border-2 border-primary-500 text-primary-500 hover:bg-primary-50 focus:ring-primary-500',
        ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:ring-neutral-500',
        danger: 'bg-destructive text-white hover:bg-destructive-700 focus:ring-destructive',
        success: 'bg-success text-white hover:bg-success-700 focus:ring-success',
        link: 'text-primary-500 hover:text-primary-600 underline-offset-4 hover:underline focus:ring-primary-500 p-0',
        gold: 'bg-gradient-to-r from-gold-500 to-gold-600 text-neutral-900 hover:from-gold-600 hover:to-gold-700 focus:ring-gold-500 shadow-gold hover:shadow-lg font-semibold',
      },
      size: {
        xs: 'text-xs px-2.5 py-1.5 rounded-md',
        sm: 'text-sm px-3 py-2 rounded-lg',
        md: 'text-sm px-4 py-2.5 rounded-xl',
        lg: 'text-base px-6 py-3 rounded-xl',
        xl: 'text-lg px-8 py-4 rounded-2xl',
        icon: 'p-2 rounded-full',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

const Button = React.forwardRef(
  (
    {
      children,
      variant,
      size,
      fullWidth,
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      className,
      onClick,
      type = 'button',
      animate = true,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const content = (
      <>
        {loading ? (
          <ButtonLoader />
        ) : leftIcon ? (
          <span className="flex-shrink-0">{leftIcon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {!loading && rightIcon && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </>
    );

    const buttonProps = {
      ref,
      type,
      disabled: isDisabled,
      onClick: isDisabled ? undefined : onClick,
      className: cn(buttonVariants({ variant, size, fullWidth }), className),
      'aria-busy': loading,
      'aria-disabled': isDisabled,
      ...props,
    };

    if (animate && !isDisabled) {
      return (
        <motion.button
          {...buttonProps}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.1 }}
        >
          {content}
        </motion.button>
      );
    }

    return <button {...buttonProps}>{content}</button>;
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
