import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  icon: ReactNode;
  'aria-label': string;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const iconSizes: Record<IconButtonSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const variantClasses: Record<IconButtonVariant, string> = {
  primary:
    'border-transparent bg-[#3CCED7] text-white hover:bg-[#2AB5BD] focus-visible:ring-[#3CCED7]',
  secondary:
    'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost:
    'border-transparent bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400',
  danger:
    'border-transparent bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      icon,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoadingSpinner className={iconSizes[size]} /> : icon}
    </button>
  ),
);

IconButton.displayName = 'IconButton';

export default IconButton;
