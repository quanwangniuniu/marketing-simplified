'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { MeetingStatus } from '@/types/meeting';

interface Props {
  projectId: number;
  meetingId: number;
  currentStatus: MeetingStatus;
  availableTransitions: string[];
  preCheck: (target: string) => string | null;
  onTransitioned: (nextStatus: MeetingStatus, nextAvailable: string[]) => void;
}

const LABELS: Record<string, string> = {
  draft: 'Move to draft',
  planned: 'Plan meeting',
  in_progress: 'Start meeting',
  completed: 'Complete meeting',
  archived: 'Archive meeting',
};

function labelFor(to: string): string {
  return LABELS[to] || `Move to ${to}`;
}

function normalizeErr(err: unknown): string {
  const e = err as {
    response?: { data?: { transition?: string | string[]; to_state?: string; detail?: string } };
    message?: string;
  };
  const d = e.response?.data;
  if (Array.isArray(d?.transition)) return d!.transition.join(' · ');
  return (
    (typeof d?.transition === 'string' ? d.transition : '') ||
    d?.to_state ||
    d?.detail ||
    e.message ||
    'Transition failed.'
  );
}

export default function MeetingFSMActionBar({
  projectId,
  meetingId,
  availableTransitions,
  preCheck,
  onTransitioned,
}: Props) {
  const [busyTarget, setBusyTarget] = useState<string | null>(null);

  if (availableTransitions.length === 0) {
    return null;
  }

  const handleClick = async (target: string) => {
    const blockReason = preCheck(target);
    if (blockReason) {
      toast.error(blockReason);
      return;
    }
    setBusyTarget(target);
    try {
      const res = await MeetingsAPI.executeTransition(projectId, meetingId, target);
      toast.success(`Meeting moved to ${res.status.replace('_', ' ')}`);
      onTransitioned(res.status as MeetingStatus, res.available_transitions);
    } catch (e) {
      toast.error(normalizeErr(e));
    } finally {
      setBusyTarget(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {availableTransitions.map((to, idx) => {
        const blockReason = preCheck(to);
        const isBusy = busyTarget === to;
        const primary = idx === 0;
        return (
          <button
            key={to}
            type="button"
            onClick={() => handleClick(to)}
            disabled={!!blockReason || isBusy}
            title={blockReason || undefined}
            className={
              primary
                ? 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50'
                : 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {labelFor(to)}
          </button>
        );
      })}
    </div>
  );
}
