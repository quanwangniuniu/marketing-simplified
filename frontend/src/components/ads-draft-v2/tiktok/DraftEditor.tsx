'use client';

import { ImagePlus, Film, ImageIcon } from 'lucide-react';
import type { TiktokMaterialItem } from '@/lib/api/tiktokApi';

export type CtaMode = 'dynamic' | 'standard';

export interface DraftEditorValue {
  name: string;
  adText: string;
  ctaEnabled: boolean;
  ctaMode: CtaMode;
  ctaLabel: string;
  primary: TiktokMaterialItem | null;
  images: TiktokMaterialItem[];
}

interface Props extends DraftEditorValue {
  disabled?: boolean;
  saving?: boolean;
  lastSavedAt?: Date | null;
  onChange: (patch: Partial<DraftEditorValue>) => void;
  onOpenLibrary: (forceType?: 'video' | 'image') => void;
}

const SECTION_CLS = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-100';
const H2_CLS = 'text-[13px] font-semibold uppercase tracking-wide text-gray-900';
const LABEL_CLS = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const INPUT_CLS =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:bg-gray-50';

const CTA_PRESETS = ['Sign up', 'Shop now', 'Learn more', 'Download', 'Book now'];

function CreativeChip({ item }: { item: TiktokMaterialItem }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1">
      {item.type === 'video' ? (
        <Film className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
      ) : (
        <ImageIcon className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate text-[11px] text-gray-700">{item.title || item.type}</span>
    </div>
  );
}

export default function DraftEditor({
  name,
  adText,
  ctaEnabled,
  ctaMode,
  ctaLabel,
  primary,
  images,
  disabled,
  saving,
  lastSavedAt,
  onChange,
  onOpenLibrary,
}: Props) {
  const lastSavedLabel = lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Not saved yet';

  return (
    <section className={`${SECTION_CLS} space-y-5 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={H2_CLS}>Editor</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Changes auto-save to the selected ad draft.
          </p>
        </div>
        <div className="text-[11px] text-gray-400">
          {saving ? 'Saving…' : lastSavedLabel}
        </div>
      </div>

      <div>
        <label className={LABEL_CLS} htmlFor="tt-name">Ad name</label>
        <input
          id="tt-name"
          type="text"
          value={name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Enter ad name…"
          disabled={disabled}
          className={`${INPUT_CLS} mt-1`}
        />
      </div>

      <div>
        <label className={LABEL_CLS} htmlFor="tt-text">Ad text</label>
        <textarea
          id="tt-text"
          value={adText}
          onChange={(event) => onChange({ adText: event.target.value })}
          maxLength={100}
          rows={3}
          placeholder="Write the ad copy (max 100 characters)…"
          disabled={disabled}
          className={`${INPUT_CLS} mt-1 resize-none`}
        />
        <div className="mt-1 text-right text-[10px] text-gray-400">{adText.length}/100</div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className={LABEL_CLS}>Call to action</span>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <span className="text-[11px] text-gray-500">{ctaEnabled ? 'On' : 'Off'}</span>
            <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-gray-200 transition has-[:checked]:bg-[#3CCED7]">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={ctaEnabled}
                onChange={(event) => onChange({ ctaEnabled: event.target.checked })}
                disabled={disabled}
              />
              <span className="absolute left-0.5 inline-block h-3 w-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-3" />
            </span>
          </label>
        </div>
        {ctaEnabled && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ ctaMode: 'dynamic' })}
                disabled={disabled}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  ctaMode === 'dynamic'
                    ? 'bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300'
                }`}
              >
                Dynamic
              </button>
              <button
                type="button"
                onClick={() => onChange({ ctaMode: 'standard' })}
                disabled={disabled}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  ctaMode === 'standard'
                    ? 'bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                    : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300'
                }`}
              >
                Standard
              </button>
            </div>
            {ctaMode === 'standard' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={(event) => onChange({ ctaLabel: event.target.value })}
                  placeholder="Custom CTA label"
                  disabled={disabled}
                  className={INPUT_CLS}
                />
                <div className="flex flex-wrap gap-1.5">
                  {CTA_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChange({ ctaLabel: preset })}
                      disabled={disabled}
                      className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 transition hover:bg-gray-200"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className={LABEL_CLS}>Creative</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenLibrary('video')}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Film className="h-3 w-3" aria-hidden="true" />
              Video
            </button>
            <button
              type="button"
              onClick={() => onOpenLibrary('image')}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImageIcon className="h-3 w-3" aria-hidden="true" />
              Images
            </button>
          </div>
        </div>
        <div className="mt-2 min-h-[64px] rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
          {!primary && images.length === 0 ? (
            <button
              type="button"
              onClick={() => onOpenLibrary()}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3CCED7] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImagePlus className="h-3 w-3" aria-hidden="true" />
              Add creative from library
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {primary && <CreativeChip item={primary} />}
              {images.map((image) => (
                <CreativeChip key={image.id} item={image} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
