'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CampaignData, CampaignStatus } from '@/types/campaign';
import { CampaignAPI } from '@/lib/api/campaignApi';
import BrandDialog from '@/components/tasks-v2/detail/BrandDialog';
import { Button } from '@/components/ui/button';
import BrandButton from '../BrandButton';

interface Props {
  campaign: CampaignData;
  onTransitioned: (next: CampaignData) => void;
}

interface TransitionSpec {
  action: string;
  label: string;
  target: CampaignStatus;
  hint?: string;
  tone?: 'default' | 'danger';
}

const TRANSITIONS: Record<CampaignStatus, TransitionSpec[]> = {
  PLANNING: [
    { action: 'start-testing', label: 'Start Testing', target: 'TESTING' },
  ],
  TESTING: [
    {
      action: 'start-scaling',
      label: 'Start Scaling',
      target: 'SCALING',
      hint: 'Requires at least one performance snapshot on file.',
    },
    { action: 'start-optimizing', label: 'Start Optimizing', target: 'OPTIMIZING' },
    { action: 'pause', label: 'Pause', target: 'PAUSED' },
    { action: 'complete', label: 'Complete', target: 'COMPLETED' },
  ],
  SCALING: [
    { action: 'start-optimizing', label: 'Start Optimizing', target: 'OPTIMIZING' },
    { action: 'pause', label: 'Pause', target: 'PAUSED' },
    { action: 'complete', label: 'Complete', target: 'COMPLETED' },
  ],
  OPTIMIZING: [
    { action: 'pause', label: 'Pause', target: 'PAUSED' },
    { action: 'complete', label: 'Complete', target: 'COMPLETED' },
  ],
  PAUSED: [
    {
      action: 'resume',
      label: 'Resume',
      target: 'TESTING',
      hint: 'Resume always returns to Testing, not the previous stage.',
    },
    { action: 'complete', label: 'Complete', target: 'COMPLETED' },
  ],
  COMPLETED: [
    { action: 'archive', label: 'Archive', target: 'ARCHIVED', tone: 'danger' },
  ],
  ARCHIVED: [
    { action: 'restore', label: 'Restore', target: 'COMPLETED' },
  ],
};

export default function CampaignFSMActionBar({ campaign, onTransitioned }: Props) {
  const [pending, setPending] = useState<TransitionSpec | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transitions = TRANSITIONS[campaign.status] || [];

  const handleOpen = (spec: TransitionSpec) => {
    setPending(spec);
    setNote('');
    setError(null);
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) {
      setPending(null);
      setNote('');
      setError(null);
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await CampaignAPI.transitionStatus(
        campaign.id,
        pending.action,
        note.trim() || undefined
      );
      toast.success(`Campaign moved to ${pending.target.toLowerCase()}`);
      onTransitioned(res.data as CampaignData);
      setPending(null);
      setNote('');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.response?.data?.status ||
          err?.message ||
          'Transition failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (transitions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {transitions.map((t) => {
          const isPrimary = t === transitions[0] && t.tone !== 'danger';
          const className = t.tone === 'danger'
            ? 'border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800'
            : '';
          if (isPrimary) {
            return (
              <BrandButton
                key={t.action}
                size="sm"
                title={t.hint}
                onClick={() => handleOpen(t)}
              >
                {t.label}
              </BrandButton>
            );
          }
          return (
            <Button
              key={t.action}
              variant="outline"
              size="sm"
              title={t.hint}
              className={className}
              onClick={() => handleOpen(t)}
            >
              {t.label}
            </Button>
          );
        })}
      </div>

      <BrandDialog
        open={!!pending}
        onOpenChange={handleClose}
        title={pending ? `${pending.label}?` : ''}
        subtitle={pending?.hint}
        width="max-w-md"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Move campaign from{' '}
            <span className="font-medium">{campaign.status.toLowerCase()}</span>{' '}
            to <span className="font-medium">{pending?.target.toLowerCase()}</span>.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Status Note (optional)
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              placeholder="Reason or context for the transition..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30 disabled:opacity-50"
            />
          </div>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs text-rose-800">{error}</p>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => handleClose(false)}
          >
            Cancel
          </Button>
          {pending?.tone === 'danger' ? (
            <Button
              size="sm"
              disabled={submitting}
              onClick={handleConfirm}
              className="bg-rose-600 text-white hover:bg-rose-700 border-0"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending?.label}
            </Button>
          ) : (
            <BrandButton size="sm" disabled={submitting} onClick={handleConfirm}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </BrandButton>
          )}
        </div>
      </BrandDialog>
    </>
  );
}
