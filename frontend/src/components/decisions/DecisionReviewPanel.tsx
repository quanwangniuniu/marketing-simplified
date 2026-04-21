'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { DecisionAPI } from '@/lib/api/decisionApi';
import type { DecisionQuality, DecisionReviewPayload, DecisionStatus } from '@/types/decision';

interface DecisionReviewPanelProps {
  decisionId: number;
  projectId?: number | null;
  status?: DecisionStatus | null;
  onReviewed?: (nextStatus: DecisionStatus) => void;
  mode?: 'edit' | 'readOnly';
  review?: DecisionReviewPayload | null;
}

const qualityOptions: { label: string; value: DecisionQuality }[] = [
  { label: 'Good', value: 'GOOD' },
  { label: 'Acceptable', value: 'ACCEPTABLE' },
  { label: 'Poor', value: 'POOR' },
];

const DecisionReviewPanel = ({
  decisionId,
  projectId,
  status,
  onReviewed,
  mode = 'edit',
  review = null,
}: DecisionReviewPanelProps) => {
  const [outcomeText, setOutcomeText] = useState(review?.outcomeText || '');
  const [reflectionText, setReflectionText] = useState(review?.reflectionText || '');
  const [decisionQuality, setDecisionQuality] = useState<DecisionQuality | ''>(
    review?.decisionQuality || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canReview = mode === 'edit' && (status === 'COMMITTED' || status === 'REVIEWED');
  const showForm = mode === 'readOnly' || canReview;

  const handleSubmit = async () => {
    if (!canReview) return;
    const nextErrors: Record<string, string> = {};
    if (!outcomeText.trim()) nextErrors.outcomeText = 'Outcome is required.';
    if (!reflectionText.trim()) nextErrors.reflectionText = 'Reflection is required.';
    if (!decisionQuality) nextErrors.decisionQuality = 'Decision quality is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload: DecisionReviewPayload = {
        outcomeText: outcomeText.trim(),
        reflectionText: reflectionText.trim(),
        decisionQuality: decisionQuality as DecisionQuality,
      };
      const response = await DecisionAPI.createReview(decisionId, payload, projectId);
      toast.success(response.detail || 'Review submitted.');
      setOutcomeText(payload.outcomeText);
      setReflectionText(payload.reflectionText);
      setDecisionQuality(payload.decisionQuality);
      onReviewed?.(response.status);
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full border-l border-gray-200 bg-white px-5 py-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Review</h3>
        {canReview ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            Enabled
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
            Locked
          </span>
        )}
      </div>

      {!showForm ? (
        <p className="mt-4 text-sm text-gray-500">
          Reviews can be submitted only after the decision is committed.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {mode === 'readOnly' ? (
            <p className="text-sm text-gray-500">
              Reviews are read-only after submission.
            </p>
          ) : null}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">Outcome</label>
            <textarea
              value={outcomeText}
              onChange={(event) => setOutcomeText(event.target.value)}
              rows={4}
              disabled={!canReview}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#3CCED7] focus:outline-none"
              placeholder="What happened after the decision?"
            />
            {errors.outcomeText ? (
              <p className="text-xs text-red-500">{errors.outcomeText}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">Reflection</label>
            <textarea
              value={reflectionText}
              onChange={(event) => setReflectionText(event.target.value)}
              rows={4}
              disabled={!canReview}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#3CCED7] focus:outline-none"
              placeholder="What would you do differently next time?"
            />
            {errors.reflectionText ? (
              <p className="text-xs text-red-500">{errors.reflectionText}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">Decision quality</label>
            <div className="flex flex-wrap gap-2">
              {qualityOptions.map((option) => {
                const selected = decisionQuality === option.value;
                const selectedStyle =
                  option.value === 'GOOD'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : option.value === 'ACCEPTABLE'
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-red-500 bg-red-50 text-red-700';
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDecisionQuality(option.value)}
                    disabled={!canReview}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      selected
                        ? selectedStyle
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {errors.decisionQuality ? (
              <p className="text-xs text-red-500">{errors.decisionQuality}</p>
            ) : null}
          </div>

          {mode === 'edit' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={`w-full rounded-md px-4 py-2 text-sm font-semibold transition ${
                submitting
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {submitting ? 'Submitting...' : 'Submit review'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default DecisionReviewPanel;
