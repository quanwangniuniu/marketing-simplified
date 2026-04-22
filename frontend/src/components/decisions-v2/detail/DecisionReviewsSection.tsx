'use client';

import { Plus } from 'lucide-react';

type Quality = 'GOOD' | 'ACCEPTABLE' | 'POOR';

interface Review {
  id: number;
  outcomeText?: string;
  reflectionText?: string;
  decisionQuality?: Quality;
  reviewedAt?: string;
  reviewerId?: number | null;
}

interface Props {
  reviews: Review[];
  canAddReview: boolean;
  onAddReview: () => void;
}

const QUALITY_STYLES: Record<Quality, { bg: string; text: string; label: string }> = {
  GOOD: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Good' },
  ACCEPTABLE: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Acceptable' },
  POOR: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Poor' },
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DecisionReviewsSection({ reviews, canAddReview, onAddReview }: Props) {
  return (
    <section
      id="decision-section-reviews"
      className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Reviews
          {reviews.length > 0 && (
            <span className="ml-2 text-[11px] font-medium normal-case text-gray-400">
              {reviews.length}
            </span>
          )}
        </h2>
        {canAddReview && (
          <button
            type="button"
            onClick={onAddReview}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 text-xs font-medium text-white shadow-sm transition hover:opacity-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Add review
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-xs text-gray-400">No reviews yet.</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => {
            const quality = review.decisionQuality ?? 'ACCEPTABLE';
            const style = QUALITY_STYLES[quality];
            return (
              <li key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {formatDate(review.reviewedAt)}
                  </span>
                </div>
                {review.outcomeText && (
                  <div className="mt-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      Outcome
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {review.outcomeText}
                    </p>
                  </div>
                )}
                {review.reflectionText && (
                  <div className="mt-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      Reflection
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {review.reflectionText}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
