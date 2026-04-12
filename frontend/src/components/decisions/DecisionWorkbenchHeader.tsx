'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, PencilLine, Trash2 } from 'lucide-react';

interface DecisionWorkbenchHeaderProps {
  projectLabel: string;
  status: string;
  title: string;
  dirty: boolean;
  lastSavedAt?: string | null;
  saving?: boolean;
  committing?: boolean;
  deleting?: boolean;
  onTitleChange: (nextTitle: string) => void;
  onSave: () => void;
  onCommit: () => void;
  onDelete?: () => void;
  mode?: 'edit' | 'readOnly';
  onBack?: () => void;
  onTitleSave?: (nextTitle: string) => void;
  titleError?: string;
  focusMode?: boolean;
}

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const statusColor = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'bg-amber-100 text-amber-800';
    case 'AWAITING_APPROVAL':
      return 'bg-blue-100 text-blue-800';
    case 'COMMITTED':
      return 'bg-emerald-100 text-emerald-800';
    case 'REVIEWED':
      return 'bg-purple-100 text-purple-800';
    case 'ARCHIVED':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const DecisionWorkbenchHeader = ({
  projectLabel,
  status,
  title,
  dirty,
  lastSavedAt,
  saving,
  committing,
  deleting = false,
  onTitleChange,
  onSave,
  onCommit,
  onDelete,
  mode = 'edit',
  onBack,
  onTitleSave,
  titleError,
  focusMode = false,
}: DecisionWorkbenchHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  const indicator = useMemo(() => {
    if (dirty) return 'Unsaved changes';
    if (saving) return 'Saving...';
    return `Last saved ${formatTime(lastSavedAt)}`;
  }, [dirty, saving, lastSavedAt]);

  const handleStartEdit = () => {
    setDraftTitle(title || '');
    setIsEditing(true);
  };

  const handleCommitTitle = (shouldSave?: boolean) => {
    const next = draftTitle.trim();
    if (next !== title) {
      onTitleChange(next);
      if (shouldSave) {
        onTitleSave?.(next);
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setDraftTitle(title || '');
    setIsEditing(false);
  };

  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div
            id="decision-field-title"
            className={`flex flex-col rounded-md ${
              focusMode && titleError
                ? 'bg-white p-2 ring-2 ring-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]'
                : ''
            }`}
          >
            <span className="text-xs uppercase tracking-wide text-gray-400">
              {projectLabel}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(status)}`}
              >
                {status}
              </span>
              {isEditing && mode === 'edit' ? (
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => handleCommitTitle(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleCommitTitle(true);
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      handleCancelEdit();
                    }
                  }}
                  autoFocus
                  className="w-full max-w-xl rounded border border-gray-300 px-3 py-1 text-lg font-semibold text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Decision title"
                />
              ) : (
                <button
                  type="button"
                  onClick={mode === 'edit' ? handleStartEdit : undefined}
                  className={`group flex items-center gap-2 text-left ${
                    mode === 'readOnly' ? 'cursor-default' : ''
                  }`}
                >
                  <span className="truncate text-lg font-semibold text-gray-900">
                    {title || 'Untitled decision'}
                  </span>
                  {mode === 'edit' ? (
                    <PencilLine className="h-4 w-4 text-gray-400 opacity-0 transition group-hover:opacity-100" />
                  ) : null}
                </button>
              )}
            </div>
            {titleError ? (
              <span className="mt-1 text-xs font-medium text-red-500">{titleError}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {!dirty && !saving ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : null}
            <span>{indicator}</span>
          </div>
        </div>
        {mode === 'edit' || onDelete ? (
          <div className="flex items-center gap-2">
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting || saving || committing}
                className={`rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 ${
                  deleting || saving || committing
                    ? 'cursor-not-allowed opacity-50'
                    : 'bg-red-50 hover:bg-red-100'
                }`}
                title="Delete decision"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </span>
              </button>
            ) : null}
            {mode === 'edit' ? (
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                dirty && !saving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-500'
              }`}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            ) : null}
            {mode === 'edit' ? (
            <button
              type="button"
              onClick={onCommit}
              disabled={committing || saving}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                committing || saving
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {committing ? 'Committing...' : 'Commit'}
            </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DecisionWorkbenchHeader;
