'use client';

import React, { useState } from 'react';
import { CircleCheck, Info } from 'lucide-react';

interface AdSetupSectionProps {
  format: 'single' | 'carousel';
  onFormatChange: (format: 'single' | 'carousel') => void;
  multiAdvertiserAds: boolean;
  onMultiAdvertiserAdsChange: (enabled: boolean) => void;
}

export default function AdSetupSection({
  format,
  onFormatChange,
  multiAdvertiserAds,
  onMultiAdvertiserAdsChange
}: AdSetupSectionProps) {
  const [showFormatTooltip, setShowFormatTooltip] = useState(false);

  return (
    <div className="space-y-4">
      {/* Title with checkmark */}
      <div className="flex items-center">
      <CircleCheck className="w-5 h-5 text-green-500 mr-2" />
        <h3 className="text-base font-bold text-gray-900">Ad setup</h3>
      </div>

      {/* Format Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-bold">Format</h4>
          <div className="relative">
            <Info 
              className="w-4 h-4 text-black cursor-pointer"
              onMouseEnter={() => setShowFormatTooltip(true)}
              onMouseLeave={() => setShowFormatTooltip(false)}
            />
            {showFormatTooltip && (
              <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                <p className="mb-2">
                  Single image or video format will show one image or video that you select.
                </p>
                <p>
                  Carousel format will show two or more scrollable cards that contain images or videos.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-600">
          Dynamic creative is enabled. Multiple ads will be automatically generated using your individual creative assets.
        </p>

        {/* Radio Options */}
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="single"
              checked={format === 'single'}
              onChange={() => onFormatChange('single')}
              className="w-4 h-4 text-[#3CCED7] border-gray-300 focus:ring-[#3CCED7]"
            />
            <span className="text-sm font-medium text-gray-900">Single image or video</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="carousel"
              checked={format === 'carousel'}
              onChange={() => onFormatChange('carousel')}
              className="w-4 h-4 text-[#3CCED7] border-gray-300 focus:ring-[#3CCED7]"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Carousel</span>
              <p className="text-xs text-gray-500 mt-1">2 or more scrollable images</p>
            </div>
          </label>
        </div>
      </div>

      {/* Separator line */}
      <div className="border-t border-gray-200"></div>

      {/* Multi-advertiser ads checkbox */}
      <div className="space-y-2">
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={multiAdvertiserAds}
            onChange={(e) => onMultiAdvertiserAdsChange(e.target.checked)}
            className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7] mt-0.5"
          />
          <div>
            <span className="text-sm font-semibold">Multi-advertiser ads</span>
            <p className="text-xs text-gray-600 mt-1">
              Your ad can appear with others in the same ad unit to help promote discoverability. Your ad creative may be resized or cropped.{' '}
              <a href="#" className="text-[#3CCED7] hover:underline">About multi-advertiser ads</a>
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}
