'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CanvasBlock, BlockBoxStyles } from '@/components/mailchimp/email-builder/types';
import KlaviyoImageSelectionModal from './KlaviyoImageSelectionModal';
import { KlaviyoImageItem } from '@/lib/api/klaviyoApi';
import { AlignLeft, AlignCenter, AlignRight, Info } from 'lucide-react';

interface KlaviyoVideoInspectorProps {
  selectedBlockData: CanvasBlock | null;
  updateVideoSettings: (updates: Partial<CanvasBlock>) => void;
}

const KlaviyoVideoInspector: React.FC<KlaviyoVideoInspectorProps> = ({
  selectedBlockData,
  updateVideoSettings,
}) => {
  const [showThumbnailModal, setShowThumbnailModal] = useState(false);

  const parseNumeric = (
    value: string | number | undefined,
    fallback: number
  ) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number") return value;
    const parsed = parseFloat(value.toString().replace("px", ""));
    return Number.isNaN(parsed) ? fallback : parsed;
  };


  const handleUpdate = (updates: Partial<CanvasBlock>) => {
    if (!selectedBlockData) return;
    updateVideoSettings(updates);
  };

  const handleThumbnailSelect = (image: KlaviyoImageItem) => {
    handleUpdate({ videoThumbnailUrl: image.preview_url });
    setShowThumbnailModal(false);
  };

  // Get current values
  const videoUrl = selectedBlockData?.videoUrl || '';
  const thumbnailUrl = selectedBlockData?.videoThumbnailUrl;
  const thumbnailAlignment = selectedBlockData?.videoThumbnailAlignment || "center";
  const fillColumn = selectedBlockData?.videoFillColumn ?? true;
  const fillColumnMobile = selectedBlockData?.videoFillColumnMobile ?? false;
  const videoAreaPadding = selectedBlockData?.videoAreaPadding || {};

  // Padding value
  const padding = parseNumeric(
    videoAreaPadding.padding ||
    videoAreaPadding.paddingTop ||
    videoAreaPadding.paddingLeft ||
    0,
    0
  );

  const updatePadding = (value: number) => {
    const pxValue = `${Math.max(0, value)}px`;
    handleUpdate({
      videoAreaPadding: {
        ...videoAreaPadding,
        padding: pxValue,
        paddingTop: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
        paddingRight: undefined,
      },
    });
  };


  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {/* Video URL Section */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-900">Video URL</label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => handleUpdate({ videoUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
          />
        </div>

        {/* Upload Video Thumbnail Section */}
        <div className="space-y-4">
          <span className="block text-sm font-semibold text-gray-900">Upload a video thumbnail</span>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            {thumbnailUrl ? (
              <div className="relative w-full aspect-video rounded overflow-hidden bg-white mb-3">
                <Image
                  src={thumbnailUrl}
                  alt="Video thumbnail"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-full aspect-video rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm mb-3">
                No thumbnail selected
              </div>
            )}
            <button
              onClick={() => setShowThumbnailModal(true)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              {thumbnailUrl ? 'Replace image' : 'Select image'}
            </button>
            {thumbnailUrl && (
              <button
                onClick={() => handleUpdate({ videoThumbnailUrl: undefined })}
                className="mt-2 w-full px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
              >
                Remove image
              </button>
            )}
          </div>
        </div>

        {/* Video Thumbnail Layout Section */}
        <div className="space-y-4">
          <span className="block text-sm font-semibold text-gray-900">Video thumbnail layout</span>

          {/* Layout Selection Buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Alignment</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdate({ videoThumbnailAlignment: "left" })}
                className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                  thumbnailAlignment === "left"
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AlignLeft className="h-4 w-4 mx-auto" />
              </button>
              <button
                onClick={() => handleUpdate({ videoThumbnailAlignment: "center" })}
                className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                  thumbnailAlignment === "center"
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AlignCenter className="h-4 w-4 mx-auto" />
              </button>
              <button
                onClick={() => handleUpdate({ videoThumbnailAlignment: "right" })}
                className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                  thumbnailAlignment === "right"
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AlignRight className="h-4 w-4 mx-auto" />
              </button>
            </div>
          </div>

          {/* Fill Column Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="block text-xs font-medium text-gray-700">
                  Fill column
                </label>
                <Info className="h-3 w-3 text-gray-400" />
              </div>
              <button
                onClick={() => handleUpdate({ videoFillColumn: !fillColumn })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  fillColumn ? "bg-[#3CCED7]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    fillColumn ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="block text-xs font-medium text-gray-700">
                  Fill column on mobile
                </label>
                <Info className="h-3 w-3 text-gray-400" />
              </div>
              <button
                onClick={() => handleUpdate({ videoFillColumnMobile: !fillColumnMobile })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  fillColumnMobile ? "bg-[#3CCED7]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    fillColumnMobile ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Video Area Padding Section */}
        <div className="space-y-4">
          <span className="block text-sm font-semibold text-gray-900">Video area padding</span>
          
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <input
                  type="number"
                  min={0}
                  value={padding}
                  onChange={(e) => updatePadding(Number(e.target.value || 0))}
                  className="flex-1 text-xs outline-none min-w-0"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 flex-shrink-0">px</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnail Selection Modal */}
      <KlaviyoImageSelectionModal
        isOpen={showThumbnailModal}
        onClose={() => setShowThumbnailModal(false)}
        onSelect={handleThumbnailSelect}
      />
    </div>
  );
};

export default KlaviyoVideoInspector;

