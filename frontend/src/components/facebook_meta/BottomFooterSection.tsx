'use client';

import React from 'react';

interface BottomFooterSectionProps {
  onClose: () => void;
  onBack: () => void;
  onPublish: () => void;
  isPublishing?: boolean;
}

export default function BottomFooterSection({
  onClose,
  onBack,
  onPublish,
  isPublishing = false
}: BottomFooterSectionProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50" style={{ marginLeft: '256px' }}>
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Disclaimer */}
        <div className="text-sm">
          By clicking <span className="font-bold">Publish</span>, you acknowledge that your use of Meta's ad tools is subject to our{' '}
          <a
            href="#"
            className="text-[#3CCED7] hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            Terms and Conditions
          </a>
          .
        </div>
        <div className="flex items-center justify-between">
          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="h-8 px-4 bg-white text-sm border border-gray-400 rounded-sm hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="h-8 px-4 bg-white text-sm border border-gray-400 rounded-sm hover:bg-gray-100 transition-colors"
            >
              Back
            </button>
            <button
              onClick={onPublish}
              disabled={isPublishing}
              className="h-8 px-4 bg-green-700 text-sm text-white rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
