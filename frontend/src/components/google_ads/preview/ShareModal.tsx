'use client';

import React, { useState } from 'react';

interface ShareModalProps {
  link: string;
  days: number;
  onDaysChange: (days: number) => void;
  onClose: () => void;
  onCopy: () => void;
  viewOnlyNote?: string;
}

export default function ShareModal({
  link,
  days,
  onDaysChange,
  onClose,
  onCopy,
  viewOnlyNote = 'Only you can edit the ad',
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/45 grid place-items-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Share preview"
      onClick={(e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-[560px] max-w-[calc(100vw-32px)] bg-white rounded-lg shadow-xl p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Share preview</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-sm">Link will expire in</span>
            </div>
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 bg-white text-sm text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              value={days}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onDaysChange(parseInt(e.target.value, 10))}
              aria-label="Expiration"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          <div className="flex items-start gap-2 text-gray-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M1 12s4-4 11-4 11 4 11 4" />
              <path d="M1 12s4 4 11 4 11-4 11-4" />
              <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
            </svg>
            <span className="text-sm">If assets are updated, you'll need to share a new link</span>
          </div>

          <div className="flex items-start gap-2 text-gray-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 mt-0.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <div className="flex-1">
              <div className="text-sm">Anyone with the link can view the preview</div>
              <div className="text-sm text-gray-600 mt-1 ml-4">{viewOnlyNote}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <input
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              value={link}
            />
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                copied
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-[#3CCED7] text-white hover:bg-[#2AB5BD] cursor-pointer'
              }`}
              onClick={handleCopy}
              disabled={copied}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer rounded-md transition-colors"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
