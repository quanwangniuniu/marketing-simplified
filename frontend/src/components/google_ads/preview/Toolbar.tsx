'use client';

type SurfaceType = 'ALL' | 'DISPLAY' | 'GMAIL' | 'YOUTUBE';

interface ToolbarProps {
  surface: SurfaceType;
  onSurfaceChange: (v: SurfaceType) => void;
  onShare: () => void;
  onPreviewAds: () => void;
  showCanvas: boolean;
  disabled?: boolean;
  banner?: string | null;
}

export default function Toolbar({
  surface,
  onSurfaceChange,
  onShare,
  onPreviewAds,
  showCanvas,
  disabled = false,
  banner,
}: ToolbarProps) {
  return (
    <div className="sticky top-0 bg-white z-10 border-b border-gray-200">
      {banner && (
        <div className="px-4 py-2 bg-[#3CCED7]/10 border-b border-[#3CCED7]/30 text-sm text-gray-700">
          {banner}
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3">
        <div></div>

        <div className="flex items-center gap-4">
          <button
            className={`text-sm font-medium cursor-pointer ${
              disabled
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-[#3CCED7] hover:text-[#1a9ba3]'
            }`}
            onClick={onShare}
            disabled={disabled}
          >
            Share
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer ${
              showCanvas
                ? 'bg-[#3CCED7]/15 text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={onPreviewAds}
            disabled={disabled}
          >
            Preview ads
          </button>
        </div>
      </div>

      <div className={`flex items-center justify-center gap-8 px-4 pb-3 ${disabled ? 'opacity-50' : ''}`}>
        <button
          className={`flex flex-col items-center gap-2 cursor-pointer ${
            disabled ? 'cursor-not-allowed' : ''
          }`}
          onClick={() => !disabled && onSurfaceChange('ALL')}
          disabled={disabled}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span
            className={`text-sm ${
              surface === 'ALL'
                ? 'text-[#3CCED7] border-b-2 border-[#3CCED7] pb-1'
                : 'text-gray-700'
            }`}
          >
            All
          </span>
        </button>

        <button
          className={`flex flex-col items-center gap-2 cursor-pointer ${
            disabled ? 'cursor-not-allowed' : ''
          }`}
          onClick={() => !disabled && onSurfaceChange('DISPLAY')}
          disabled={disabled}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-current">
              <path
                d="M3 3h18v18H3V3z"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={surface === 'DISPLAY' ? 'text-green-600' : 'text-gray-400'}
              />
              <path
                d="M3 9h18M9 3v18"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={surface === 'DISPLAY' ? 'text-green-600' : 'text-gray-400'}
              />
            </svg>
          </div>
          <span
            className={`text-sm ${
              surface === 'DISPLAY'
                ? 'text-[#3CCED7] border-b-2 border-[#3CCED7] pb-1'
                : 'text-gray-700'
            }`}
          >
            Display
          </span>
        </button>

        <button
          className={`flex flex-col items-center gap-2 cursor-pointer ${
            disabled ? 'cursor-not-allowed' : ''
          }`}
          onClick={() => !disabled && onSurfaceChange('GMAIL')}
          disabled={disabled}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 8l6 4 6-4M6 16l6-4 6 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={surface === 'GMAIL' ? 'text-[#3CCED7]' : 'text-gray-400'}
              />
            </svg>
          </div>
          <span
            className={`text-sm ${
              surface === 'GMAIL'
                ? 'text-[#3CCED7] border-b-2 border-[#3CCED7] pb-1'
                : 'text-gray-700'
            }`}
          >
            Gmail
          </span>
        </button>

        <button
          className={`flex flex-col items-center gap-2 cursor-pointer ${
            disabled ? 'cursor-not-allowed' : ''
          }`}
          onClick={() => !disabled && onSurfaceChange('YOUTUBE')}
          disabled={disabled}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect
                x="3"
                y="6"
                width="18"
                height="12"
                rx="2"
                className={surface === 'YOUTUBE' ? 'text-red-600' : 'text-gray-400'}
              />
              <path
                d="M10 12l5 3-5 3v-6z"
                fill="white"
              />
            </svg>
          </div>
          <span
            className={`text-sm ${
              surface === 'YOUTUBE'
                ? 'text-[#3CCED7] border-b-2 border-[#3CCED7] pb-1'
                : 'text-gray-700'
            }`}
          >
            YouTube
          </span>
        </button>
      </div>
    </div>
  );
}
