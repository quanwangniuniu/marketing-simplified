'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CanvasBlock, ImageSizeMode, ImageLinkType } from '@/components/mailchimp/email-builder/types';
import KlaviyoImageSelectionModal from './KlaviyoImageSelectionModal';
import { KlaviyoImageItem } from '@/lib/api/klaviyoApi';

interface KlaviyoImageInspectorProps {
  selectedBlockData: CanvasBlock | null;
  updateImageSettings: (updates: Partial<CanvasBlock>) => void;
}

const KlaviyoImageInspector: React.FC<KlaviyoImageInspectorProps> = ({
  selectedBlockData,
  updateImageSettings,
}) => {
  const [showImageSelectionModal, setShowImageSelectionModal] = useState(false);

  const sizeOptions: ImageSizeMode[] = ['Original', 'Fill', 'Scale'];
  const linkOptions: ImageLinkType[] = ['Web', 'Email', 'Phone'];

  const currentSize = selectedBlockData?.imageDisplayMode || 'Original';
  const currentLinkType = selectedBlockData?.imageLinkType || 'Web';
  const currentLinkValue = selectedBlockData?.imageLinkValue || '';
  const openInNewTab = selectedBlockData?.imageOpenInNewTab ?? true;
  const altText = selectedBlockData?.imageAltText || '';
  const scalePercent = Math.min(100, Math.max(10, selectedBlockData?.imageScalePercent ?? 85));

  const linkPlaceholders: Record<ImageLinkType, string> = {
    Web: 'https://example.com',
    Email: 'name@example.com',
    Phone: '+1 (555) 123-4567',
  };

  const handleUpdate = (updates: Partial<CanvasBlock>) => {
    if (!selectedBlockData) return;
    updateImageSettings(updates);
  };

  const handleImageSelect = (image: KlaviyoImageItem) => {
    handleUpdate({ imageUrl: image.preview_url });
    setShowImageSelectionModal(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {/* Image Preview */}
        <div className="space-y-4">
          <span className="block text-sm font-semibold text-gray-900">Image</span>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            {selectedBlockData?.imageUrl ? (
              <div className="relative w-full aspect-video rounded overflow-hidden bg-white">
                <Image
                  src={selectedBlockData.imageUrl}
                  alt={altText || 'Selected image'}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-full aspect-video rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                No image selected
              </div>
            )}
            <button
              onClick={() => setShowImageSelectionModal(true)}
              className="mt-3 w-full px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              {selectedBlockData?.imageUrl ? 'Replace image' : 'Select image'}
            </button>
            {selectedBlockData?.imageUrl && (
              <button
                onClick={() => handleUpdate({ imageUrl: undefined })}
                className="mt-2 w-full px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
              >
                Remove image
              </button>
            )}
          </div>
        </div>

        {/* Image Settings */}
        {selectedBlockData?.imageUrl && (
          <>
            {/* Alt Text */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Alt Text</label>
              <input
                type="text"
                placeholder="Describe what you see in the image"
                value={altText}
                onChange={(e) => handleUpdate({ imageAltText: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              />
            </div>

            {/* Link Settings */}
            <div className="space-y-4">
              <span className="block text-sm font-semibold text-gray-900">Link</span>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">Link Type</label>
                <select
                  value={currentLinkType}
                  onChange={(e) => handleUpdate({ imageLinkType: e.target.value as ImageLinkType })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                >
                  {linkOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {currentLinkType !== 'Web' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700">Link Address</label>
                  <input
                    type="text"
                    value={currentLinkValue}
                    onChange={(e) => handleUpdate({ imageLinkValue: e.target.value })}
                    placeholder={linkPlaceholders[currentLinkType]}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  />
                </div>
              )}

              {currentLinkType === 'Web' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700">Link Address</label>
                  <input
                    type="url"
                    value={currentLinkValue}
                    onChange={(e) => handleUpdate({ imageLinkValue: e.target.value })}
                    placeholder={linkPlaceholders[currentLinkType]}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="image-open-new-tab"
                  checked={openInNewTab}
                  onChange={(e) => handleUpdate({ imageOpenInNewTab: e.target.checked })}
                  className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                />
                <label htmlFor="image-open-new-tab" className="text-sm text-gray-700">
                  Open link in new tab
                </label>
              </div>
            </div>

            {/* Size Settings */}
            <div className="space-y-4">
              <span className="block text-sm font-semibold text-gray-900">Size</span>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">Display Mode</label>
                <select
                  value={currentSize}
                  onChange={(e) => handleUpdate({ imageDisplayMode: e.target.value as ImageSizeMode })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                >
                  {sizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {currentSize === 'Scale' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700">
                    Scale ({scalePercent}%)
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={scalePercent}
                    onChange={(e) =>
                      handleUpdate({ imageScalePercent: parseInt(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Alignment */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Alignment</label>
              <div className="flex gap-2">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => handleUpdate({ imageAlignment: align })}
                    className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                      selectedBlockData?.imageAlignment === align
                        ? 'bg-[#3CCED7] text-white border-[#3CCED7]'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {align.charAt(0).toUpperCase() + align.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Image Selection Modal */}
      <KlaviyoImageSelectionModal
        isOpen={showImageSelectionModal}
        onClose={() => setShowImageSelectionModal(false)}
        onSelect={handleImageSelect}
      />
    </div>
  );
};

export default KlaviyoImageInspector;

