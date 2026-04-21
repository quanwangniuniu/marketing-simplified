'use client';

import { useState, useRef, useEffect } from 'react';
import { PerformanceSnapshot, MilestoneType, MetricType, UpdateSnapshotData } from '@/types/campaign';
import { CampaignAPI } from '@/lib/api/campaignApi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Button from '@/components/button/Button';
import { Image as ImageIcon, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  snapshot: PerformanceSnapshot | null;
  onSuccess: () => void;
  onDelete?: () => void;
}

const milestoneOptions: { value: MilestoneType; label: string }[] = [
  { value: 'LAUNCH', label: 'Campaign Launch' },
  { value: 'MID_TEST', label: 'Mid-Test Review' },
  { value: 'TEST_COMPLETE', label: 'Test Completion' },
  { value: 'OPTIMIZATION', label: 'Major Optimization' },
  { value: 'WEEKLY_REVIEW', label: 'Weekly Review' },
  { value: 'MONTHLY_REVIEW', label: 'Monthly Review' },
  { value: 'CUSTOM', label: 'Custom Milestone' },
];

const metricOptions: { value: MetricType; label: string }[] = [
  { value: 'CPA', label: 'Cost Per Acquisition' },
  { value: 'ROAS', label: 'Return on Ad Spend' },
  { value: 'CTR', label: 'Click-Through Rate' },
  { value: 'CPM', label: 'Cost Per Mille' },
  { value: 'CPC', label: 'Cost Per Click' },
  { value: 'CONVERSIONS', label: 'Conversions' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'IMPRESSIONS', label: 'Impressions' },
  { value: 'CLICKS', label: 'Clicks' },
  { value: 'ENGAGEMENT_RATE', label: 'Engagement Rate' },
];

export default function EditSnapshotModal({
  isOpen,
  onClose,
  campaignId,
  snapshot,
  onSuccess,
  onDelete,
}: EditSnapshotModalProps) {
  const [milestoneType, setMilestoneType] = useState<MilestoneType | ''>('');
  const [spend, setSpend] = useState<string>('');
  const [metricType, setMetricType] = useState<MetricType | ''>('');
  const [metricValue, setMetricValue] = useState<string>('');
  const [percentageChange, setPercentageChange] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [existingScreenshotUrl, setExistingScreenshotUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form when snapshot changes
  useEffect(() => {
    if (snapshot) {
      setMilestoneType(snapshot.milestone_type);
      setSpend(snapshot.spend);
      setMetricType(snapshot.metric_type);
      setMetricValue(snapshot.metric_value);
      setPercentageChange(snapshot.percentage_change || '');
      setNotes(snapshot.notes || '');
      setExistingScreenshotUrl(snapshot.screenshot_url);
      setScreenshot(null);
      setScreenshotPreview(null);
      setError(null);
    }
  }, [snapshot]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshot(null);
      setScreenshotPreview(null);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File size must be less than 10MB');
      return;
    }

    setScreenshot(file);
    setError(null);
    setExistingScreenshotUrl(null); // Clear existing URL when new file is selected

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    setExistingScreenshotUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!snapshot) return;

    // Validation
    if (!milestoneType) {
      setError('Please select a milestone type');
      return;
    }
    if (!spend || isNaN(parseFloat(spend)) || parseFloat(spend) < 0) {
      setError('Please enter a valid spend amount');
      return;
    }
    if (!metricType) {
      setError('Please select a metric type');
      return;
    }
    if (!metricValue || isNaN(parseFloat(metricValue))) {
      setError('Please enter a valid metric value');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data: UpdateSnapshotData = {
        milestone_type: milestoneType as MilestoneType,
        spend: parseFloat(spend),
        metric_type: metricType as MetricType,
        metric_value: parseFloat(metricValue),
      };

      if (percentageChange && !isNaN(parseFloat(percentageChange))) {
        data.percentage_change = parseFloat(percentageChange);
      } else if (percentageChange === '') {
        data.percentage_change = undefined;
      }

      if (notes !== undefined) {
        data.notes = notes.trim() || undefined;
      }

      if (screenshot) {
        data.screenshot = screenshot;
      } else if (existingScreenshotUrl === null && !screenshotPreview) {
        // If user removed screenshot, we need to handle this
        // Note: Backend might need a special flag to remove screenshot
        // For now, we'll just not include it if it's null
      }

      await CampaignAPI.updateSnapshot(campaignId, snapshot.id, data);
      toast.success('Snapshot updated successfully');
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Failed to update snapshot:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to update snapshot';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!snapshot) return;

    if (!window.confirm('Are you sure you want to delete this snapshot? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await CampaignAPI.deleteSnapshot(campaignId, snapshot.id);
      toast.success('Snapshot deleted successfully');
      if (onDelete) {
        onDelete();
      }
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Failed to delete snapshot:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to delete snapshot';
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!submitting && !deleting) {
      setMilestoneType('');
      setSpend('');
      setMetricType('');
      setMetricValue('');
      setPercentageChange('');
      setNotes('');
      setScreenshot(null);
      setScreenshotPreview(null);
      setExistingScreenshotUrl(null);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  if (!snapshot) {
    return null;
  }

  const displayScreenshot = screenshotPreview || existingScreenshotUrl;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Performance Snapshot</DialogTitle>
          <DialogDescription>
            Update the performance snapshot details. Spend and primary metric are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Milestone Type - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Milestone Type <span className="text-red-500">*</span>
            </label>
            <Select
              value={milestoneType}
              onValueChange={(value) => setMilestoneType(value as MilestoneType)}
              disabled={submitting || deleting}
            >
              <SelectTrigger className={error && !milestoneType ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select milestone type" />
              </SelectTrigger>
              <SelectContent>
                {milestoneOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Spend - Required */}
          <div>
            <label htmlFor="spend" className="block text-sm font-medium text-gray-700 mb-2">
              Spend (USD) <span className="text-red-500">*</span>
            </label>
            <input
              id="spend"
              type="number"
              step="0.01"
              min="0"
              value={spend}
              onChange={(e) => setSpend(e.target.value)}
              placeholder="0.00"
              disabled={submitting || deleting}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] text-sm ${
                error && !spend ? 'border-red-500' : 'border-gray-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          </div>

          {/* Metric Type and Value - Required */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metric Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={metricType}
                onValueChange={(value) => setMetricType(value as MetricType)}
                disabled={submitting || deleting}
              >
                <SelectTrigger className={error && !metricType ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="metric-value" className="block text-sm font-medium text-gray-700 mb-2">
                Metric Value <span className="text-red-500">*</span>
              </label>
              <input
                id="metric-value"
                type="number"
                step="0.0001"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                placeholder="0.0000"
                disabled={submitting || deleting}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] text-sm ${
                  error && !metricValue ? 'border-red-500' : 'border-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            </div>
          </div>

          {/* Percentage Change - Optional */}
          <div>
            <label htmlFor="percentage-change" className="block text-sm font-medium text-gray-700 mb-2">
              Percentage Change (Optional)
            </label>
            <input
              id="percentage-change"
              type="number"
              step="0.01"
              value={percentageChange}
              onChange={(e) => setPercentageChange(e.target.value)}
              placeholder="e.g., 15.5 or -10.2"
              disabled={submitting || deleting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">Positive for improvement, negative for decline</p>
          </div>

          {/* Notes - Optional */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Observations (Optional)
            </label>
            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add free-form observations about the campaign performance..."
              disabled={submitting || deleting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Screenshot - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Screenshot (Optional)
            </label>
            {displayScreenshot ? (
              <div className="relative border border-gray-200 rounded-md overflow-hidden">
                <img
                  src={displayScreenshot}
                  alt="Screenshot preview"
                  className="w-full h-auto max-h-64 object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveScreenshot}
                  disabled={submitting || deleting}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="screenshot"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
                <input
                  id="screenshot"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={submitting || deleting}
                  ref={fileInputRef}
                  className="hidden"
                />
              </label>
            )}
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
              disabled={submitting || deleting || !milestoneType || !spend || !metricType || !metricValue}
              loading={submitting}
            >
              Update Snapshot
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

