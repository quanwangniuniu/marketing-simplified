'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

const ToolbarIconButton = forwardRef<HTMLButtonElement, Props>(function ToolbarIconButton(
  { label, active = false, className = '', children, ...rest },
  ref
) {
  const base =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:opacity-40';
  const activeCls =
    'bg-[#3CCED7]/10 text-[#0E8A96] ring-1 ring-[#3CCED7]/30 hover:bg-[#3CCED7]/15';
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`${base} ${active ? activeCls : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default ToolbarIconButton;
