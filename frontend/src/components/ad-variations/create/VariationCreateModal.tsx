'use client';

import { useRef } from 'react';
import BrandDialog from '@/components/tasks/detail/BrandDialog';
import type { AdGroup } from '@/types/adVariation';
import VariationForm from './VariationForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  adGroups: AdGroup[];
  onComplete: () => void | Promise<void>;
}

export default function VariationCreateModal({
  open,
  onOpenChange,
  campaignId,
  adGroups,
  onComplete,
}: Props) {
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Creative Variation"
      subtitle="Create a new ad variation to A/B test."
      width="max-w-2xl"
      onPointerDownOutside={(e) => e.preventDefault()}
      onInteractOutside={(e) => e.preventDefault()}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        nameRef.current?.focus();
      }}
    >
      <VariationForm
        ref={nameRef}
        campaignId={campaignId}
        adGroups={adGroups}
        onCancel={() => onOpenChange(false)}
        onComplete={async () => {
          await onComplete();
          onOpenChange(false);
        }}
      />
    </BrandDialog>
  );
}
