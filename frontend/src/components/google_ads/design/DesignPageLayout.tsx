'use client';

import React from 'react';
import { GoogleAd } from '@/lib/api/googleAdsApi';

interface DesignPageLayoutProps {
  children: React.ReactNode;
  ad: GoogleAd;
  completenessPercentage: number;
  isComplete: boolean;
  missingFields: string[];
  onSave: () => Promise<void>;
  onPublish: () => Promise<void>;
  onBack: () => void;
  saving: boolean;
  videoAdValidation?: { isValid: boolean; errors: string[] };
}

export default function DesignPageLayout({
  children,
  ad,
  completenessPercentage,
  isComplete,
  missingFields,
  onSave,
  onPublish,
  onBack,
  saving,
  videoAdValidation
}: DesignPageLayoutProps) {
  // Determine if the ad is ready to publish
  const isReadyToPublish = () => {
    if (ad.type === 'VIDEO_RESPONSIVE_AD' && videoAdValidation) {
      return videoAdValidation.isValid;
    }
    return isComplete;
  };

  const getPublishButtonText = () => {
    if (ad.type === 'VIDEO_RESPONSIVE_AD' && videoAdValidation && !videoAdValidation.isValid) {
      return 'Complete Required Fields';
    }
    return saving ? 'Publishing...' : 'Publish';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back Button */}
            <button
              onClick={() => {
                console.log('Back button clicked in DesignPageLayout');
                onBack();
              }}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Ads
            </button>

            {/* Ad Info */}
            <div className="flex-1 mx-6">
              <h1 className="text-lg font-semibold text-gray-900">
                {ad.name || 'Untitled Ad'}
              </h1>
              <p className="text-sm text-gray-500">
                {ad.type?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={onSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={onPublish}
                disabled={saving || !isReadyToPublish()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] border border-transparent rounded-md hover:bg-[#2AB5BD] focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:ring-offset-2 disabled:opacity-50"
              >
                {getPublishButtonText()}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#3CCED7]/15 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#3CCED7]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Basic Info</div>
                  <div className="text-xs text-gray-500">Completed</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  completenessPercentage > 0 ? 'bg-[#3CCED7]/15' : 'bg-gray-100'
                }`}>
                  <svg className={`w-4 h-4 ${
                    completenessPercentage > 0 ? 'text-[#3CCED7]' : 'text-gray-400'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Ad Content</div>
                  <div className="text-xs text-gray-500">{completenessPercentage}% Complete</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isReadyToPublish() ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <svg className={`w-4 h-4 ${
                    isReadyToPublish() ? 'text-green-600' : 'text-gray-400'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Ready to Publish</div>
                  <div className="text-xs text-gray-500">
                    {isReadyToPublish() ? 'Complete' : 'Incomplete'}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-[#3CCED7] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${completenessPercentage}%` }}
                />
              </div>
              <span className="text-sm text-gray-500">{completenessPercentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
}
