'use client';

import type { ReactNode } from 'react';

interface MobileCardFrameProps {
  children: ReactNode;
  variantKey?: string;
}

const FULLSCREEN_VARIANTS = [
  'mobile.portrait.hero-logo-title-desc-buttons',
  'mobile.portrait.dark-hero-title-desc-biz-buttons',
  'mobile.sheet.logo-biz-title-desc-innerimage-ctabar',
  'mobile.landscape.image-plus-whitecard-below',
  'mobile.portrait.dark-hero-biz-title-desc-innerimage-pillcta',
  'mobile.sheet.logo-title-biz-desc-buttons',
  'mobile.sheet.dark-logo-title-desc-videothumb-buttons',
  'mobile.sheet.light-logoTitle-desc-video-cta',
];

// Check if variant key is a Gmail variant (starts with 'gmail.')
const isGmailVariant = (variantKey?: string) => {
  return variantKey?.startsWith('gmail.') ?? false;
};

// Check if variant key is a YouTube variant (starts with 'youtube.')
const isYouTubeVariant = (variantKey?: string) => {
  return variantKey?.startsWith('youtube.') ?? false;
};

// Check if variant key is a search ad variant (starts with 'search.')
const isSearchVariant = (variantKey?: string) => {
  return variantKey?.startsWith('search.') ?? false;
};

// Check if variant key is a video ad variant (starts with 'video.')
const isVideoVariant = (variantKey?: string) => {
  if (!variantKey) return false;
  return variantKey.startsWith('video.');
};

export default function MobileCardFrame({ children, variantKey }: MobileCardFrameProps) {
  const isFullscreen = variantKey && (FULLSCREEN_VARIANTS.includes(variantKey) || isGmailVariant(variantKey) || isYouTubeVariant(variantKey) || isVideoVariant(variantKey));
  const isSearch = isSearchVariant(variantKey);
  const isVideo = isVideoVariant(variantKey);
  
  // Render Google Search Results page for search ads
  if (isSearch) {
    return (
      <div className="w-[320px] h-[568px] flex-shrink-0 bg-white rounded-[20px] border border-gray-200 shadow-md overflow-hidden">
        <div className="w-full h-full bg-white flex flex-col">
          {/* Google Search Header */}
          <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              {/* Google Logo */}
              <div className="text-lg font-bold">
                <span style={{ color: '#4285f4' }}>G</span>
                <span style={{ color: '#ea4335' }}>o</span>
                <span style={{ color: '#fbbc04' }}>o</span>
                <span style={{ color: '#4285f4' }}>g</span>
                <span style={{ color: '#34a853' }}>l</span>
                <span style={{ color: '#ea4335' }}>e</span>
              </div>
              
              {/* User icon */}
              <div className="w-6 h-6 rounded-full bg-gray-300"></div>
            </div>
            
            {/* Search Bar */}
            <div className="h-9 bg-white border border-gray-300 rounded-full px-3 flex items-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <span className="text-xs text-gray-600 flex-1 ml-2">sample query</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-4 border-b border-gray-200">
            <div className="flex items-center gap-4 pb-2">
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-700 pb-1">All</span>
                <div className="w-full h-0.5 bg-[#3CCED7] rounded-full"></div>
              </div>
              <span className="text-xs text-gray-600">Images</span>
              <span className="text-xs text-gray-600">Videos</span>
              <span className="text-xs text-gray-600">News</span>
            </div>
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* Search Ad */}
            <div className="mb-4">
              {children}
            </div>

            {/* Organic Results Skeleton */}
            <div className="space-y-4">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300 mt-1 flex-shrink-0"></div>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-gray-200 rounded" style={{ width: `${70 + Math.random() * 15}%` }}></div>
                    <div className="h-2 bg-gray-100 rounded w-full"></div>
                    <div className="h-2 bg-gray-100 rounded" style={{ width: `${65 + Math.random() * 15}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (isFullscreen) {
    return (
      <div className="w-[320px] h-[568px] flex-shrink-0 bg-white rounded-[20px] border border-gray-200 shadow-md overflow-hidden">
        <div className="w-full h-full bg-white relative">
          <div className="px-3 pt-2 pb-1 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex-1 mx-2 h-6 bg-gray-200 rounded"></div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
          </div>
          
          <div className="w-full h-full relative overflow-hidden" style={{ height: 'calc(100% - 45px)', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Video ads - simple phone frame with no notch
  if (isVideo) {
    return (
      <div className="relative w-[375px] h-[667px] bg-white rounded-[36px] shadow-xl overflow-hidden border-[8px] border-gray-800">
        {/* Content area - fullscreen for video */}
        <div className="w-full h-full overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[320px] h-[568px] flex-shrink-0 bg-white rounded-[20px] border border-gray-200 shadow-md overflow-hidden">
      <div className="w-full h-full bg-white relative">
        <div className="px-3 pt-2 pb-1 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex-1 mx-2 h-6 bg-gray-200 rounded"></div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
        </div>

        <div className="px-3 py-2 space-y-2 bg-white">
          <div className="h-2 bg-gray-200 rounded w-3/4"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
          <div className="h-2 bg-gray-200 rounded w-5/6"></div>
        </div>

        <div className="px-2 py-2">
          {children}
        </div>

        <div className="px-3 py-2 space-y-2 bg-white">
          <div className="h-2 bg-gray-200 rounded w-4/5"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
          <div className="h-2 bg-gray-200 rounded w-3/4"></div>
          <div className="h-2 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  );
}
