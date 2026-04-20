'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { AdVariationAPI } from '@/lib/api/adVariationApi';
import type { AdVariation, VariationStatus } from '@/types/adVariation';

type Variant = 'primary' | 'ghost' | 'danger';

const BASE =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm hover:opacity-95',
  ghost: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300',
  danger: 'bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50',
};

interface Props {
  variation: AdVariation;
  campaignId: number;
  onMutated: () => void | Promise<void>;
}

interface ButtonSpec {
  label: string;
  variant: Variant;
  to: VariationStatus;
  reason?: string;
  title?: string;
}

function buttonsFor(status: VariationStatus): ButtonSpec[] {
  switch (status) {
    case 'Draft':
      return [{ label: 'Start Testing', variant: 'primary', to: 'Testing' }];
    case 'Testing':
      return [
        { label: 'Promote to Live', variant: 'primary', to: 'Live' },
        { label: 'Pause', variant: 'ghost', to: 'Paused' },
      ];
    case 'Live':
      return [
        { label: 'Mark Winner', variant: 'primary', to: 'Winner', reason: 'Declared winner' },
        { label: 'Pause', variant: 'ghost', to: 'Paused' },
        { label: 'Mark Loser', variant: 'danger', to: 'Loser', reason: 'Underperforming' },
      ];
    case 'Paused':
      return [
        {
          label: 'Resume to Testing',
          variant: 'primary',
          to: 'Testing',
          title: 'Restart testing before going live',
        },
        {
          label: 'Resume to Live',
          variant: 'ghost',
          to: 'Live',
          title: 'Resume to Live without re-testing',
        },
      ];
    case 'Winner':
    case 'Loser':
      return [{ label: 'Revert to Testing', variant: 'ghost', to: 'Testing' }];
    default:
      return [];
  }
}

export default function FSMActionBar({ variation, campaignId, onMutated }: Props) {
  const [busy, setBusy] = useState(false);

  const transition = async (to: VariationStatus, reason?: string) => {
    setBusy(true);
    try {
      await AdVariationAPI.changeStatus(campaignId, variation.id, { toStatus: to, reason });
      await onMutated();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Status change failed');
    } finally {
      setBusy(false);
    }
  };

  const buttons = buttonsFor(variation.status);
  if (!buttons.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((b) => (
        <button
          key={b.to + b.label}
          type="button"
          disabled={busy}
          title={b.title}
          onClick={() => transition(b.to, b.reason)}
          className={`${BASE} ${VARIANT[b.variant]}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
