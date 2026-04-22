'use client';

import React from 'react';
import { TiktokMaterialItem } from '@/lib/api/tiktokApi';
import TiktokMaterialSelection from './TiktokMaterialSelection';

interface TiktokAdDetailProps {
  selectedCreative: TiktokMaterialItem | null;
  selectedImages: TiktokMaterialItem[];
  text?: string;
  ctaMode?: 'dynamic' | 'standard';
  ctaLabel?: string;
  ctaEnabled?: boolean;
  onOpenLibrary: () => void;
  onOpenLibraryVideo?: () => void;
  onOpenLibraryImages?: () => void;
  onRemoveImage?: (id: number) => void;
  onClearImages?: () => void;
  onPreviewImage?: (img: TiktokMaterialItem) => void;
  onChange?: (value: { text: string; cta: { mode: 'dynamic' | 'standard'; label: string } }) => void;
  onToggleCta?: (enabled: boolean) => void;
}

const TiktokAdDetail: React.FC<TiktokAdDetailProps> = ({ selectedCreative, selectedImages, text = '', ctaMode = 'standard', ctaLabel = 'Sign up', ctaEnabled = true, onOpenLibrary, onOpenLibraryVideo, onOpenLibraryImages, onRemoveImage, onClearImages, onPreviewImage, onChange, onToggleCta }) => {

  return (
    <div className="space-y-8">
      {/* Ad creative */}
      <div>
        <div className="text-gray-900 font-medium mb-3">Ad creative</div>
        <TiktokMaterialSelection
          selectedVideo={selectedCreative && selectedCreative.type === 'video' ? selectedCreative : null}
          selectedImages={selectedImages}
          onOpenLibrary={onOpenLibrary}
          onOpenLibraryVideo={onOpenLibraryVideo || (() => {})}
          onOpenLibraryImages={onOpenLibraryImages || (() => {})}
          onRemoveImage={onRemoveImage}
          onClearImages={onClearImages}
          onPreviewImage={onPreviewImage}
        />
      </div>

      <hr className="border-t border-gray-200" />

      {/* Text */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-gray-900 font-medium">Text</div>
        </div>
        <div className="relative">
          <input
            type="text"
            value={text}
            onChange={(e) => onChange?.({ text: e.target.value, cta: { mode: ctaMode, label: ctaLabel } })}
            placeholder="Enter ad text"
            className="w-full pr-16 px-3 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent outline-none"
          />
          {(() => { const len = (text || '').length; const max = 100; return (
            <div className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm ${len > max ? 'text-red-500' : 'text-gray-400'}`}>{len}/{max}</div>
          ); })()}
        </div>
        <div className="mt-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed">
            <span>Smart Text</span>
            <span className="text-gray-400 text-xs">(coming soon)</span>
          </button>
        </div>
      </div>

      <hr className="border-t border-gray-200" />

      {/* Call to action */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900 font-medium">
            <button
              type="button"
              onClick={() => onToggleCta?.(!ctaEnabled)}
              className={`inline-flex items-center justify-${ctaEnabled ? 'end' : 'start'} w-12 h-6 rounded-full transition-colors ${ctaEnabled ? 'bg-teal-600' : 'bg-gray-300'}`}
              aria-pressed={ctaEnabled}
            >
              <span className="w-5 h-5 bg-white rounded-full shadow" />
            </button>
            <span>Call to action</span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 text-gray-700">
            <input
              type="radio"
              name="cta_mode"
              className="h-4 w-4"
              checked={ctaMode === 'dynamic'}
              onChange={() => onChange?.({ text, cta: { mode: 'dynamic', label: ctaLabel } })}
              disabled={!ctaEnabled}
            />
            <span>Dynamic</span>
          </label>
          <label className="flex items-center gap-3 text-gray-900 font-medium">
            <input
              type="radio"
              name="cta_mode"
              className="h-4 w-4"
              checked={ctaMode === 'standard'}
              onChange={() => onChange?.({ text, cta: { mode: 'standard', label: ctaLabel } })}
              disabled={!ctaEnabled}
            />
            <span>Standard</span>
          </label>
          <select
            className={`w-full px-3 py-3 border rounded-md focus:ring-2 focus:ring-teal-600 focus:border-teal-600 border-teal-600 ${!ctaEnabled || ctaMode !== 'standard' ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-70' : 'text-gray-900'}`}
            value={ctaLabel}
            onChange={(e) => onChange?.({ text, cta: { mode: ctaMode, label: e.target.value } })}
            disabled={!ctaEnabled || ctaMode !== 'standard'}
          >
            <option>Sign up</option>
            <option>Learn more</option>
            <option>Shop now</option>
            <option>Download</option>
          </select>

          {/* Helper note when Dynamic is selected */}
          {ctaEnabled && ctaMode === 'dynamic' && (
            <div className="text-xs text-gray-500">Dynamic call-to-action is coming soon.</div>
          )}
          {!ctaEnabled && (
            <div className="text-xs text-gray-400">CTA is disabled for this ad draft.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TiktokAdDetail;
