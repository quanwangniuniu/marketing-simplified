'use client';

import { useState, useEffect } from 'react';
import { CampaignData, CampaignStatus } from '@/types/campaign';
import { CampaignAPI } from '@/lib/api/campaignApi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import Button from '@/components/button/Button';
import CampaignStatusBadge from './CampaignStatusBadge';
import { AlertCircle, Info } from 'lucide-react';

interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignData;
  onSuccess: () => void;
}

interface TransitionOption {
  value: string;
  label: string;
  targetStatus: CampaignStatus;
  description: string;
  validation?: {
    check: (campaign: CampaignData) => boolean;
    message: string;
  };
}

const getAvailableTransitions = (campaign: CampaignData): TransitionOption[] => {
  const transitions: TransitionOption[] = [];

  switch (campaign.status) {
    case 'PLANNING':
      transitions.push({
        value: 'start-testing',
        label: 'Start Testing',
        targetStatus: 'TESTING',
        description: 'Move campaign from Planning to Testing phase',
        validation: {
          check: (c) => {
            const startDate = new Date(c.start_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startDate.setHours(0, 0, 0, 0);
            return startDate >= today;
          },
          message: 'Start date must be today or in the future',
        },
      });
      break;

    case 'TESTING':
      transitions.push({
        value: 'start-scaling',
        label: 'Start Scaling',
        targetStatus: 'SCALING',
        description: 'Move campaign to Scaling phase (requires documented performance data)',
        validation: {
          check: () => true, // Backend will validate performance data
          message: 'Requires documented performance data',
        },
      });
      transitions.push({
        value: 'start-optimizing',
        label: 'Start Optimizing',
        targetStatus: 'OPTIMIZING',
        description: 'Move campaign to Optimizing phase',
      });
      transitions.push({
        value: 'pause',
        label: 'Pause',
        targetStatus: 'PAUSED',
        description: 'Pause the campaign',
      });
      transitions.push({
        value: 'complete',
        label: 'Complete',
        targetStatus: 'COMPLETED',
        description: 'Mark campaign as completed',
        validation: {
          check: (c) => !!c.end_date,
          message: 'Completed campaigns must have an end date',
        },
      });
      break;

    case 'SCALING':
      transitions.push({
        value: 'start-optimizing',
        label: 'Start Optimizing',
        targetStatus: 'OPTIMIZING',
        description: 'Move campaign to Optimizing phase',
      });
      transitions.push({
        value: 'pause',
        label: 'Pause',
        targetStatus: 'PAUSED',
        description: 'Pause the campaign',
      });
      transitions.push({
        value: 'complete',
        label: 'Complete',
        targetStatus: 'COMPLETED',
        description: 'Mark campaign as completed',
        validation: {
          check: (c) => !!c.end_date,
          message: 'Completed campaigns must have an end date',
        },
      });
      break;

    case 'OPTIMIZING':
      transitions.push({
        value: 'pause',
        label: 'Pause',
        targetStatus: 'PAUSED',
        description: 'Pause the campaign',
      });
      transitions.push({
        value: 'complete',
        label: 'Complete',
        targetStatus: 'COMPLETED',
        description: 'Mark campaign as completed',
        validation: {
          check: (c) => !!c.end_date,
          message: 'Completed campaigns must have an end date',
        },
      });
      break;

    case 'PAUSED':
      transitions.push({
        value: 'resume',
        label: 'Resume',
        targetStatus: 'TESTING',
        description: 'Resume the paused campaign',
      });
      transitions.push({
        value: 'complete',
        label: 'Complete',
        targetStatus: 'COMPLETED',
        description: 'Mark campaign as completed',
        validation: {
          check: (c) => !!c.end_date,
          message: 'Completed campaigns must have an end date',
        },
      });
      break;

    case 'COMPLETED':
      transitions.push({
        value: 'archive',
        label: 'Archive',
        targetStatus: 'ARCHIVED',
        description: 'Archive the completed campaign (cannot be edited after archiving)',
      });
      break;

    case 'ARCHIVED':
      transitions.push({
        value: 'restore',
        label: 'Restore',
        targetStatus: 'COMPLETED',
        description: 'Restore archived campaign back to Completed status',
      });
      break;
  }

  return transitions;
};

export default function ChangeStatusModal({
  isOpen,
  onClose,
  campaign,
  onSuccess,
}: ChangeStatusModalProps) {
  const [selectedTransition, setSelectedTransition] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTransitions = getAvailableTransitions(campaign);

  useEffect(() => {
    if (isOpen) {
      setSelectedTransition('');
      setStatusNote('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedTransition) {
      setError('Please select a status transition');
      return;
    }

    const transition = availableTransitions.find((t) => t.value === selectedTransition);
    if (!transition) {
      setError('Invalid transition selected');
      return;
    }

    // Client-side validation
    if (transition.validation && !transition.validation.check(campaign)) {
      setError(transition.validation.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await CampaignAPI.transitionStatus(campaign.id, selectedTransition, statusNote || undefined);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to transition status:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to change campaign status';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTransitionOption = availableTransitions.find(
    (t) => t.value === selectedTransition
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change Campaign Status</DialogTitle>
          <DialogDescription>
            Select a status transition for this campaign. Current status:{' '}
            <CampaignStatusBadge status={campaign.status} />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status Info */}
          <div className="bg-gray-50 rounded-md p-3">
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700">
                <strong>Current Status:</strong> {campaign.status}
              </span>
            </div>
          </div>

          {/* Transition Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select New Status
            </label>
            <div className="space-y-2">
              {availableTransitions.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No status transitions available for campaigns in {campaign.status} status.
                </p>
              ) : (
                availableTransitions.map((transition) => {
                  const isValid = !transition.validation || transition.validation.check(campaign);
                  return (
                    <label
                      key={transition.value}
                      className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                        selectedTransition === transition.value
                          ? 'border-[#3CCED7] bg-[#3CCED7]/10'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${!isValid ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="transition"
                        value={transition.value}
                        checked={selectedTransition === transition.value}
                        onChange={(e) => setSelectedTransition(e.target.value)}
                        disabled={!isValid}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{transition.label}</span>
                          <CampaignStatusBadge status={transition.targetStatus} />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{transition.description}</p>
                        {transition.validation && !isValid && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                            <AlertCircle className="h-3 w-3" />
                            <span>{transition.validation.message}</span>
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Status Note */}
          <div>
            <label htmlFor="status-note" className="block text-sm font-medium text-gray-700 mb-2">
              Status Note (Optional)
            </label>
            <textarea
              id="status-note"
              rows={3}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Add a note explaining the reason for this status change..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] text-sm"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedTransition}
            loading={submitting}
          >
            Change Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

