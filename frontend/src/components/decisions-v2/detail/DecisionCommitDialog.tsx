'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import BrandDialog from '@/components/tasks-v2/detail/BrandDialog';

export interface FieldError {
  field: string;
  message: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskLevel?: string | null;
  onConfirm: () => Promise<FieldError[] | null>;
  onReviewInPage?: (firstErrorField: string | null) => void;
}

export default function DecisionCommitDialog({
  open,
  onOpenChange,
  riskLevel,
  onConfirm,
  onReviewInPage,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);

  useEffect(() => {
    if (!open) setErrors([]);
  }, [open]);

  const requiresApproval = riskLevel === 'HIGH';

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const result = await onConfirm();
      if (result && result.length > 0) {
        setErrors(result);
        return;
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleReview = () => {
    onOpenChange(false);
    onReviewInPage?.(errors[0]?.field ?? null);
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={requiresApproval ? 'Submit for approval' : 'Commit decision'}
      subtitle={
        requiresApproval
          ? 'High-risk decisions go to an approver before they are committed. All signals, options, and reasoning must be complete.'
          : 'Committed decisions are locked. Ensure signals, options, reasoning, risk, and confidence are set.'
      }
    >
      {errors.length > 0 && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <div className="font-semibold">{errors.length} field error{errors.length === 1 ? '' : 's'}</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px]">
            {errors.slice(0, 6).map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.field}:</span> {e.message}
              </li>
            ))}
            {errors.length > 6 && <li>…and {errors.length - 6} more</li>}
          </ul>
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        {errors.length > 0 && (
          <button
            type="button"
            onClick={handleReview}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
          >
            Review in page
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {requiresApproval ? 'Submit for approval' : 'Commit'}
        </button>
      </div>
    </BrandDialog>
  );
}
