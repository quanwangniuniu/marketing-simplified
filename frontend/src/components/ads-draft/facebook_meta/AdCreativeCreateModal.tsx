'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import BrandDialog from '@/components/tasks/detail/BrandDialog';

export interface AdCreativeCreatePayload {
  name: string;
  object_story_id?: string;
  authorization_category?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: AdCreativeCreatePayload) => Promise<void>;
  submitting?: boolean;
}

const AUTH_OPTIONS = [
  { value: '', label: 'None (default)' },
  { value: 'NONE', label: 'Not a political ad' },
  { value: 'POLITICAL', label: 'Political ad' },
  { value: 'POLITICAL_WITH_DIGITALLY_CREATED_MEDIA', label: 'Political ad with digitally created media' },
];

const LABEL_CLASS = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500';
const INPUT_CLASS =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30';

export default function AdCreativeCreateModal({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
}: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [objectStoryId, setObjectStoryId] = useState('');
  const [authCategory, setAuthCategory] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; objectStoryId?: string }>({});

  useEffect(() => {
    if (!open) {
      setName('');
      setObjectStoryId('');
      setAuthCategory('');
      setFieldErrors({});
    }
  }, [open]);

  const validate = () => {
    const next: typeof fieldErrors = {};
    const trimmedName = name.trim();
    if (!trimmedName) next.name = 'Name is required';
    else if (trimmedName.length > 100) next.name = 'Name must be 100 characters or less';
    if (objectStoryId && !/^\d+_\d+$/.test(objectStoryId.trim())) {
      next.objectStoryId = 'Expected format: <page_id>_<post_id>';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || submitting) return;
    const payload: AdCreativeCreatePayload = { name: name.trim() };
    const trimmedStoryId = objectStoryId.trim();
    if (trimmedStoryId) payload.object_story_id = trimmedStoryId;
    if (authCategory) payload.authorization_category = authCategory;
    await onSubmit(payload);
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Facebook Meta ad creative"
      subtitle="Draft a creative record; content fields stay read-only after creation."
      width="max-w-lg"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        nameRef.current?.focus();
      }}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className={LABEL_CLASS} htmlFor="ad-creative-name">Name</label>
          <input
            ref={nameRef}
            id="ad-creative-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Spring campaign hero image"
            maxLength={100}
            className={INPUT_CLASS}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? 'ad-creative-name-error' : undefined}
            disabled={submitting}
          />
          {fieldErrors.name && (
            <p id="ad-creative-name-error" className="mt-1 text-xs text-rose-600" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="ad-creative-story">Object story ID (optional)</label>
          <input
            id="ad-creative-story"
            type="text"
            value={objectStoryId}
            onChange={(event) => setObjectStoryId(event.target.value)}
            placeholder="<page_id>_<post_id>"
            className={`${INPUT_CLASS} font-mono text-xs`}
            aria-invalid={!!fieldErrors.objectStoryId}
            aria-describedby={fieldErrors.objectStoryId ? 'ad-creative-story-error' : undefined}
            disabled={submitting}
          />
          {fieldErrors.objectStoryId && (
            <p id="ad-creative-story-error" className="mt-1 text-xs text-rose-600" role="alert">
              {fieldErrors.objectStoryId}
            </p>
          )}
          <p className="mt-1 text-[11px] text-gray-500">
            Reference a published Facebook page post if you want this creative to reuse it.
          </p>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="ad-creative-auth">Authorization category (optional)</label>
          <select
            id="ad-creative-auth"
            value={authCategory}
            onChange={(event) => setAuthCategory(event.target.value)}
            className={INPUT_CLASS}
            disabled={submitting}
          >
            {AUTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="-mx-5 -mb-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
            Create creative
          </button>
        </div>
      </form>
    </BrandDialog>
  );
}
