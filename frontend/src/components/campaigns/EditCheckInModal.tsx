'use client';

import { useState, useEffect } from 'react';
import { CheckInSentiment, CampaignCheckIn } from '@/types/campaign';
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
import { CheckCircle, Minus, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  checkIn: CampaignCheckIn | null;
  onSuccess: () => void;
}

const sentimentOptions: Array<{
  value: CheckInSentiment;
  label: string;
  icon: typeof CheckCircle;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
}> = [
  {
    value: 'POSITIVE',
    label: 'Positive',
    icon: CheckCircle,
    color: 'text-green-800',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    iconColor: 'text-green-600',
  },
  {
    value: 'NEUTRAL',
    label: 'Neutral',
    icon: Minus,
    color: 'text-gray-800',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    iconColor: 'text-gray-600',
  },
  {
    value: 'NEGATIVE',
    label: 'Negative',
    icon: AlertCircle,
    color: 'text-red-800',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    iconColor: 'text-red-600',
  },
];

export default function EditCheckInModal({
  isOpen,
  onClose,
  campaignId,
  checkIn,
  onSuccess,
}: EditCheckInModalProps) {
  const [selectedSentiment, setSelectedSentiment] = useState<CheckInSentiment | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (checkIn && isOpen) {
      setSelectedSentiment(checkIn.sentiment);
      setNote(checkIn.note || '');
      setError(null);
    }
  }, [checkIn, isOpen]);

  const handleSubmit = async () => {
    if (!selectedSentiment || !checkIn) {
      setError('Please select a sentiment');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await CampaignAPI.updateCheckIn(campaignId, checkIn.id, {
        sentiment: selectedSentiment,
        note: note.trim() || undefined,
      });
      toast.success('Check-in updated successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update check-in:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to update check-in';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!checkIn) return;

    if (!window.confirm('Are you sure you want to delete this check-in? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await CampaignAPI.deleteCheckIn(campaignId, checkIn.id);
      toast.success('Check-in deleted successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete check-in:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to delete check-in';
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!submitting && !deleting) {
      setSelectedSentiment(null);
      setNote('');
      setError(null);
      onClose();
    }
  };

  if (!checkIn) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Check-in</DialogTitle>
          <DialogDescription>
            Update the sentiment or note for this check-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sentiment Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How is the campaign performing?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {sentimentOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedSentiment === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedSentiment(option.value)}
                    disabled={submitting || deleting}
                    className={`
                      flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all
                      ${isSelected 
                        ? `${option.bgColor} ${option.borderColor} border-2` 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                      }
                      ${(submitting || deleting) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <Icon className={`h-6 w-6 ${option.iconColor}`} />
                    <span className={`text-sm font-medium ${isSelected ? option.color : 'text-gray-700'}`}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Field */}
          <div>
            <label htmlFor="checkin-note" className="block text-sm font-medium text-gray-700 mb-2">
              Note (Optional)
            </label>
            <textarea
              id="checkin-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a brief note about the campaign's performance..."
              disabled={submitting || deleting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={handleDelete}
            disabled={submitting || deleting}
            loading={deleting}
            leftIcon={<Trash2 className="h-4 w-4" />}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={submitting || deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || deleting || !selectedSentiment}
              loading={submitting}
            >
              Update Check-in
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

