// src/components/tiktok/TikTokActionBar.tsx
import React from 'react';

interface Props {
  onSave?: () => void;
  isSaving?: boolean;
  hasUnsaved?: boolean;
  lastSavedAt?: Date | null;
  onSharePreview?: () => void;
}

const TikTokActionBar: React.FC<Props> = ({ onSave, isSaving, hasUnsaved, lastSavedAt, onSharePreview }) => {
  const savedText = isSaving ? 'Saving…' : hasUnsaved ? 'Unsaved changes' : lastSavedAt ? `Draft saved at ${lastSavedAt.toLocaleTimeString()}` : '';
  return (
    <div className="bg-white border-t border-gray-200 shadow-lg">
      <div className="py-3">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: Save button */}
          <div className="flex items-center space-x-4">
            {/* text button Save */}
            <button
              className="px-2 py-1 text-[#3CCED7] hover:text-[#1a9ba3] underline-offset-4 hover:underline"
              onClick={onSave}
            >
              Save
            </button>
            <div className="h-5 w-px bg-gray-300" />
            {savedText && (
              <div className="flex items-center space-x-2">
                <span className={`text-sm ${isSaving ? 'text-gray-500' : hasUnsaved ? 'text-amber-600' : 'text-green-600'}`}>{savedText}</span>
              </div>
            )}
          </div>

          {/* Right: Share preview */}
          <div className="flex items-center space-x-3">
            {/* container button - light style */}
            <button
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 bg-white hover:bg-gray-50 transition-colors"
              onClick={onSharePreview}
            >
              Share preview
            </button>
            {/* tooltip */}
            <div className="relative group">
              <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs">?</button>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 p-3 rounded-md bg-gray-900 text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                <div>This shared link shows a snapshot of your ad draft at the time it was created.</div>
                <div className="mt-1">Any future edits or auto-saves will not be reflected in the shared preview.</div>
                <div className="mt-1">To update the shared link with your latest changes, please generate a new snapshot.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TikTokActionBar;
