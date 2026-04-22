'use client';

import React, { useState, useEffect, useRef } from 'react';
import FacebookAdPreviews from './FacebookAdPreviews';
import ShareLinkModal from './ShareLinkModal';
import {
  Monitor,
  Square,
  ChevronDown,
  Share2,
  Expand,
  TriangleAlert,
  MonitorSmartphone,
  RectangleVertical,
  RectangleHorizontal,
  Info,
  Maximize2,
  Link,
  Facebook
} from 'lucide-react';

interface MediaFile {
  id: number;
  type: 'photo' | 'video';
  thumbnail?: string;
  caption?: string;
  url?: string;
}

interface AdCreative {
  id: string;
  name?: string;
  // Add other AdCreative properties as needed
}

interface AdPreviewSectionProps {
  isPreviewEnabled: boolean;
  onPreviewToggle: (enabled: boolean) => void;
  selectedFormat: 'desktop' | 'mobile' | 'story' | 'reel';
  onFormatChange: (format: 'desktop' | 'mobile' | 'story' | 'reel') => void;
  onAdvancedPreview: () => void;
  onShare: () => void;
  selectedMedia?: MediaFile[];
  primaryText?: string;
  adCreative?: AdCreative;
}

export default function AdPreviewSection({
  isPreviewEnabled,
  onPreviewToggle,
  selectedFormat,
  onFormatChange,
  onAdvancedPreview,
  onShare,
  selectedMedia = [],
  primaryText = '',
  adCreative
}: AdPreviewSectionProps) {
  const [selectedContent, setSelectedContent] = useState<'all' | string>('all');
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target as Node)) {
        setShowShareDropdown(false);
      }
    };

    if (showShareDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShareDropdown]);

  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-shrink-0 p-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onPreviewToggle(!isPreviewEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPreviewEnabled ? 'bg-[#3CCED7]' : 'bg-gray-200'
              }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPreviewEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-900">Ad preview</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onAdvancedPreview}
            className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm"
          >
            <Expand className="w-4 h-4 mr-2" />
            Advanced Preview
          </button>
          <div className="relative" ref={shareDropdownRef}>
            <button
              onClick={() => setShowShareDropdown(!showShareDropdown)}
              className={`flex items-center px-3 py-2 border rounded-md text-sm transition-colors ${showShareDropdown
                ? 'bg-gray-200 border-gray-400 text-gray-800'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              <Share2 className="w-4 h-4 mr-2" />
              <ChevronDown className="w-4 h-4" />
            </button>

            {showShareDropdown && (
              <div className="absolute top-full right-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                {/* Share previews section */}
                <div className="py-2">
                  <div className="px-2 font-semibold text-sm mb-2">Share previews</div>
                  <div className="mx-1 pb-2 border-b border-gray-200">
                    <button
                      onClick={() => {
                        setShowShareLinkModal(true);
                        setShowShareDropdown(false);
                      }}
                      className="w-full flex items-center px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Link className="w-4 h-4 mr-2 text-gray-500" />
                      Share a link
                    </button>
                  </div>
                </div>

                {/* Preview on device section */}
                <div className="py-2">
                  <div className="font-semibold text-sm mb-2 px-2">Preview on device</div>
                  <div className="mx-1">
                    <button
                      onClick={() => {
                        console.log('Send notification to Facebook clicked');
                        setShowShareDropdown(false);
                      }}
                      className="flex items-center w-full px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Facebook className="w-4 h-4 mr-2 text-gray-500" />
                      Send notification to Facebook (iOS only)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPreviewEnabled && (
        <>
          {/* seperator */}
          <div className="h-px bg-gray-300 flex-shrink-0"></div>
          {/* Preview Controls */}
          <div className="p-4 flex-shrink-0">
            {/* Device Icons and Warning Row */}
            <div className="flex items-center justify-between mb-3">
              {/* Empty space for left alignment */}
              <div className="flex-1"></div>

              {/* Device Preview Icons - Centered */}
              <div className="flex items-center space-x-2 justify-center">
                <button
                  onClick={() => onFormatChange('desktop')}
                  className={`px-3 py-2 rounded-md transition-colors ${selectedFormat === 'desktop'
                    ? 'bg-[#3CCED7]/15 text-[#3CCED7] hover:bg-blue-200'
                    : 'hover:bg-gray-200'
                    }`}
                >
                  <MonitorSmartphone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onFormatChange('mobile')}
                  className={`px-3 py-2 rounded-md transition-colors ${selectedFormat === 'mobile'
                    ? 'bg-[#3CCED7]/15 text-[#3CCED7] hover:bg-blue-200'
                    : 'hover:bg-gray-200'
                    }`}
                >
                  <Square className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onFormatChange('story')}
                  className={`px-3 py-2 rounded-md transition-colors ${selectedFormat === 'story'
                    ? 'bg-[#3CCED7]/15 text-[#3CCED7] hover:bg-blue-200'
                    : 'hover:bg-gray-200'
                    }`}
                >
                  <RectangleVertical className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onFormatChange('reel')}
                  className={`px-3 py-2 rounded-md transition-colors ${selectedFormat === 'reel'
                    ? 'bg-[#3CCED7]/15 text-[#3CCED7] hover:bg-blue-200'
                    : 'hover:bg-gray-200'
                    }`}
                >
                  <RectangleHorizontal className="w-4 h-4" />
                </button>
              </div>

              {/* Warning Indicator - Right Side */}
              <div className="flex-1 flex justify-end">
                <div className="flex items-center space-x-1 text-orange-600">
                  <TriangleAlert className="w-4 h-4" />
                  <span className="text-sm font-medium">16</span>
                </div>
              </div>
            </div>

            {/* Filter Button and Media Thumbnails - Separate Line */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSelectedContent('all')}
                className={`w-12 h-12 rounded-md text-sm font-medium transition-colors ${selectedContent === 'all'
                  ? 'border-2 border-[#3CCED7] hover:bg-gray-100'
                  : 'bg-gray-50 hover:bg-gray-200'
                  }`}
              >
                All
              </button>

              {/* Media Thumbnails - Show when media is selected */}
              {selectedMedia.length > 0 && (
                <div className="flex items-center space-x-2">
                  {selectedMedia.map((media, index) => {
                    const mediaKey = `${media.type}-${media.id}`;
                    const isSelected = selectedContent === mediaKey;
                    return (
                      <button
                        key={mediaKey}
                        onClick={() => setSelectedContent(mediaKey)}
                        className={`w-12 h-12 rounded-md overflow-hidden flex-shrink-0 ${isSelected ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]' : ''
                          }`}
                      >
                        {media.url || media.thumbnail ? (
                          media.type === 'video' ? (
                            <video
                              src={media.url}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={media.url || media.thumbnail}
                              alt={media.caption || `${media.type} preview`}
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : media.type === 'photo' ? (
                          <div className="w-full h-full bg-[#3CCED7] flex items-center justify-center">
                            <span className="text-white text-xs font-bold">IMG</span>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">VID</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 flex flex-col">
            {selectedMedia.length === 0 ? (
              <>
                {/* No Preview State */}
                <div className="bg-gray-50 overflow-y-auto flex flex-col items-center justify-center min-h-[600px]">
                  {/* Illustration */}
                  <div className="mb-6">
                    <i data-visualcompletion="css-img" className="img mx-auto" style={{ backgroundImage: 'url("https://static.xx.fbcdn.net/rsrc.php/v4/yU/r/KdGwMZTiP7I.png")', backgroundPosition: '0px 0px', backgroundSize: '401px 2108px', width: '400px', height: '250px', backgroundRepeat: 'no-repeat', display: 'inline-block' }}></i>
                  </div>

                  {/* Message */}
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    There is no preview to show for this ad.
                  </h3>

                  {/* Help Button */}
                  <button className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium">
                    Help me fix it
                  </button>
                </div>

                {/* Disclaimer */}
                <div className="flex items-center space-x-2 text-xs text-gray-500 py-3 px-2">
                  <span>Ad rendering and interaction may vary based on device, format and other factors.</span>
                  <Info className="w-3 h-3" />
                </div>
              </>
            ) : (
              <>
                {/* Preview Content */}
                <div className="bg-gray-100 overflow-y-auto px-4 h-[600px]">
                  <FacebookAdPreviews
                    selectedMedia={selectedMedia}
                    selectedContent={selectedContent}
                    primaryText={primaryText}
                  />
                  <div className="flex justify-center mb-4">
                    <button className='border border-gray-500 rounded-md inline-flex px-4 py-2 items-center text-sm hover:bg-gray-300'>
                      <Maximize2 className='w-4 h-4 mr-2' />
                      See more variations
                    </button>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="flex items-center space-x-2 text-xs text-gray-500 py-3 px-2">
                  <span>Ad rendering and interaction may vary based on device, format and other factors.</span>
                  <Info className="w-3 h-3" />
                </div>
              </>
            )}
          </div>
        </>
      )}
      
      {/* Share Link Modal */}
      <ShareLinkModal
        isOpen={showShareLinkModal}
        onClose={() => setShowShareLinkModal(false)}
        adCreative={adCreative}
      />
    </div>
  );
}
