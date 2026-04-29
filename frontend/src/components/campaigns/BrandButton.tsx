'use client';

import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BrandButton = forwardRef<HTMLButtonElement, ButtonProps>(function BrandButton(
  { className, children, ...rest },
  ref
) {
  return (
    <Button
      ref={ref}
      className={cn(
        'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow hover:brightness-105 border-0',
        className
      )}
      {...rest}
    >
      {children}
    </Button>
  );
});

export default BrandButton;
