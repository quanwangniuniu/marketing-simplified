'use client';

import { Loader2 } from 'lucide-react';
import type { DecisionStatus } from '@/types/decision';

interface Props {
  status: DecisionStatus | null;
  canEdit: boolean;
  canApproveOrReview: boolean;
  saving?: boolean;
  committing?: boolean;
  approving?: boolean;
  archiving?: boolean;
  onPromoteToDraft?: () => void;
  onSaveDraft?: () => void;
  onCommit?: () => void;
  onApprove?: () => void;
  onArchive?: () => void;
  onAddReview?: () => void;
  onDelete?: () => void;
}

const primaryCls =
  'inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50';
const ghostCls =
  'inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50';
const dangerCls =
  'inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';

export default function DecisionFSMActionBar({
  status,
  canEdit,
  canApproveOrReview,
  saving,
  committing,
  approving,
  archiving,
  onPromoteToDraft,
  onSaveDraft,
  onCommit,
  onApprove,
  onArchive,
  onAddReview,
  onDelete,
}: Props) {
  if (!status) return null;

  const showCommit = (status === 'PREDRAFT' || status === 'DRAFT') && canEdit;
  const showSaveDraft = status === 'DRAFT' && canEdit;
  const showPromote = status === 'PREDRAFT' && canEdit;
  const showApprove = status === 'AWAITING_APPROVAL' && canApproveOrReview;
  const showAddReview =
    (status === 'COMMITTED' || status === 'REVIEWED') && canApproveOrReview;
  const showArchive =
    (status === 'COMMITTED' || status === 'REVIEWED') && canEdit;
  const showDelete = status !== 'ARCHIVED' && canEdit;

  const anyAction =
    showCommit || showSaveDraft || showPromote || showApprove || showAddReview || showArchive || showDelete;

  if (!anyAction) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {showDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={dangerCls}
          aria-label="Delete decision"
        >
          Delete
        </button>
      )}
      {showSaveDraft && (
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className={ghostCls}
          aria-label="Save draft"
        >
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save Draft
        </button>
      )}
      {showArchive && (
        <button
          type="button"
          onClick={onArchive}
          disabled={archiving}
          className={ghostCls}
          aria-label="Archive decision"
        >
          {archiving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Archive
        </button>
      )}
      {showPromote && (
        <button
          type="button"
          onClick={onPromoteToDraft}
          className={primaryCls}
          aria-label="Promote to draft"
        >
          Promote to Draft
        </button>
      )}
      {showCommit && (
        <button
          type="button"
          onClick={onCommit}
          disabled={committing}
          className={primaryCls}
          aria-label="Commit decision"
        >
          {committing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Commit
        </button>
      )}
      {showApprove && (
        <button
          type="button"
          onClick={onApprove}
          disabled={approving}
          className={primaryCls}
          aria-label="Approve decision"
        >
          {approving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Approve
        </button>
      )}
      {showAddReview && (
        <button
          type="button"
          onClick={onAddReview}
          className={primaryCls}
          aria-label="Add review"
        >
          Add Review
        </button>
      )}
    </div>
  );
}
