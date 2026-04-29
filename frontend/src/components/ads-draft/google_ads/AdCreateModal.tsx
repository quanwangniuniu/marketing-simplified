'use client';

import { Loader2, Search, Image as ImageIcon, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import BrandDialog from '@/components/tasks/detail/BrandDialog';
import type { AdType } from '@/lib/api/googleAdsApi';

export interface AdCreateRequestV2 {
  name: string;
  type: AdType;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[];
  submitting?: boolean;
  onSubmit: (payload: AdCreateRequestV2) => Promise<void>;
}

const TYPE_OPTIONS: Array<{
  value: AdType;
  label: string;
  description: string;
  icon: typeof Search;
}> = [
  {
    value: 'RESPONSIVE_SEARCH_AD',
    label: 'Responsive Search Ad',
    description: 'Up to 15 headlines and 4 descriptions on Google Search.',
    icon: Search,
  },
  {
    value: 'RESPONSIVE_DISPLAY_AD',
    label: 'Responsive Display Ad',
    description: 'Image + text combinations served across the Display Network.',
    icon: ImageIcon,
  },
  {
    value: 'VIDEO_RESPONSIVE_AD',
    label: 'Video Responsive Ad',
    description: 'YouTube video ads with companion banners and CTAs.',
    icon: Video,
  },
];

const LABEL_CLS = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500';
const INPUT_CLS =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:bg-gray-50';

export default function AdCreateModal({
  open,
  onOpenChange,
  existingNames,
  submitting = false,
  onSubmit,
}: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AdType>('RESPONSIVE_SEARCH_AD');
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setType('RESPONSIVE_SEARCH_AD');
      setNameError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Name is required');
      return;
    }
    if (existingNames.includes(trimmed)) {
      setNameError('This ad name is already in use');
      return;
    }
    setNameError(null);
    await onSubmit({ name: trimmed, type });
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Google Ad"
      subtitle="Choose an ad format and give it a unique name."
      width="max-w-xl"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        nameRef.current?.focus();
      }}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className={LABEL_CLS} htmlFor="ga-name">Name</label>
          <input
            ref={nameRef}
            id="ga-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Spring 2026 search ad"
            disabled={submitting}
            maxLength={255}
            className={INPUT_CLS}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'ga-name-error' : undefined}
          />
          {nameError && (
            <p id="ga-name-error" role="alert" className="mt-1 text-xs text-rose-600">
              {nameError}
            </p>
          )}
        </div>

        <div>
          <span className={LABEL_CLS}>Ad type</span>
          <div className="mt-1 space-y-2">
            {TYPE_OPTIONS.map((option) => {
              const selected = type === option.value;
              const Icon = option.icon;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition ${
                    selected
                      ? 'border-[#3CCED7] bg-[#3CCED7]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="ga-type"
                    value={option.value}
                    checked={selected}
                    onChange={() => setType(option.value)}
                    disabled={submitting}
                    className="sr-only"
                  />
                  <span
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                      selected ? 'bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
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
            Create ad
          </button>
        </div>
      </form>
    </BrandDialog>
  );
}
