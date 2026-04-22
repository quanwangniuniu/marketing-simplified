'use client';

interface DesktopCardFrameProps {
  children: React.ReactNode;
  variantKey?: string;
}

export default function DesktopCardFrame({ children, variantKey }: DesktopCardFrameProps) {
  // NOPQR variants: inline thumb variants that should be placed in main content area
  const isNOPQRVariant = variantKey && (
    variantKey === 'mobile.inline.thumb-longheadline-adbiz-button' ||
    variantKey === 'mobile.inline.thumb-title-desc-adbiz-button' ||
    variantKey === 'mobile.inline.thumb-title-adbiz-button' ||
    variantKey === 'mobile.inline.header-title-thumbgrid-desc-adbiz-button' ||
    variantKey === 'mobile.inline.header-title-thumb-desc-adbiz-button'
  );

  // Check if variant is a search ad
  const isSearchVariant = variantKey?.startsWith('search.') ?? false;

  // Render Google Search Results page for search ads
  if (isSearchVariant) {
    return (
      <div className="w-full max-w-[1200px] flex-shrink-0 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
        <div className="w-full bg-white">
          {/* Browser Chrome */}
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              </div>
              <div className="flex items-center gap-2 flex-1 mx-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                  <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 8v8M8 12h8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex-1 h-8 bg-white border border-gray-300 rounded-md px-3 flex items-center">
                <span className="text-xs text-gray-500">https://www.google.com/search</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Google Search Page Content */}
          <div className="bg-white p-6" style={{ maxWidth: '1140px', margin: '0 auto' }}>
            {/* Google Header */}
            <div className="mb-4">
              <div className="flex items-center gap-4 mb-4">
                {/* Google Logo */}
                <div className="text-2xl font-bold" style={{ height: '28px', lineHeight: '28px' }}>
                  <span style={{ color: '#4285f4' }}>G</span>
                  <span style={{ color: '#ea4335' }}>o</span>
                  <span style={{ color: '#fbbc04' }}>o</span>
                  <span style={{ color: '#4285f4' }}>g</span>
                  <span style={{ color: '#34a853' }}>l</span>
                  <span style={{ color: '#ea4335' }}>e</span>
                </div>
                
                {/* Search Bar */}
                <div className="flex-1" style={{ maxWidth: '720px' }}>
                  <div className="h-9 bg-white border border-gray-300 rounded-full px-4 flex items-center shadow-sm">
                    <span className="text-sm text-gray-600 flex-1">sample search query</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-3 border-b border-gray-200 pb-2" style={{ maxWidth: '720px' }}>
                <div className="flex flex-col items-center">
                  <div className="h-7 px-3 flex items-center text-sm text-gray-700">All</div>
                  <div className="w-full h-1 bg-[#3CCED7] rounded-full"></div>
                </div>
                <div className="h-7 px-3 flex items-center text-sm text-gray-600">Images</div>
                <div className="h-7 px-3 flex items-center text-sm text-gray-600">Videos</div>
                <div className="h-7 px-3 flex items-center text-sm text-gray-600">News</div>
                <div className="h-7 px-3 flex items-center text-sm text-gray-600">Maps</div>
              </div>
            </div>

            {/* Search Results */}
            <div style={{ maxWidth: '680px' }}>
              {/* Search Ad (inserted here) */}
              <div className="mb-6">
                {children}
              </div>

              {/* Organic Results Skeleton */}
              <div className="space-y-5">
                {[...Array(7)].map((_, idx) => (
                  <div key={idx} className="flex gap-3">
                    {/* Favicon placeholder */}
                    <div className="w-3 h-3 rounded-full bg-gray-300 mt-1 flex-shrink-0"></div>
                    
                    {/* Result content */}
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded" style={{ width: `${70 + Math.random() * 10}%` }}></div>
                      <div className="h-2.5 bg-gray-100 rounded" style={{ width: '85%' }}></div>
                      <div className="h-2.5 bg-gray-100 rounded" style={{ width: `${60 + Math.random() * 10}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] flex-shrink-0 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
      <div className="w-full bg-white">
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            </div>
            <div className="flex items-center gap-2 flex-1 mx-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 8v8M8 12h8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1 h-8 bg-white border border-gray-300 rounded-md px-3 flex items-center">
              <span className="text-xs text-gray-500">https://example.com</span>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6">
          {isNOPQRVariant ? (
            // NOPQR variants: ad in main content area below website header, keep original size
            <div>
              <div className="text-center mb-6">
                <h1 className="text-4xl font-bold italic text-gray-800 mb-4">website</h1>
                <div className="flex justify-center gap-4 mb-6">
                  <div className="h-2 w-16 bg-gray-300 rounded"></div>
                  <div className="h-2 w-16 bg-gray-300 rounded"></div>
                  <div className="h-2 w-16 bg-gray-300 rounded"></div>
                </div>
              </div>

              {/* Ad placed below website header, keep original size */}
              <div className="flex justify-center mb-6">
                <div className="inline-block">
                  {children}
                </div>
              </div>

              <div className="space-y-2 max-w-2xl mx-auto mb-6">
                <div className="h-2 bg-gray-200 rounded w-full"></div>
                <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                <div className="h-2 bg-gray-200 rounded w-4/5"></div>
              </div>

              <div className="max-w-2xl mx-auto">
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </div>
          ) : (
            // Other variants: ad in right sidebar
            <div className="flex gap-6">
              {/* Main content area (left, larger) */}
              <div className="flex-1">
                <div className="text-center mb-6">
                  <h1 className="text-4xl font-bold italic text-gray-800 mb-4">website</h1>
                  <div className="flex justify-center gap-4 mb-6">
                    <div className="h-2 w-16 bg-gray-300 rounded"></div>
                    <div className="h-2 w-16 bg-gray-300 rounded"></div>
                    <div className="h-2 w-16 bg-gray-300 rounded"></div>
                  </div>
                </div>

                <div className="space-y-2 max-w-2xl mx-auto mb-6">
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                  <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-2 bg-gray-200 rounded w-4/5"></div>
                </div>

                <div className="max-w-2xl mx-auto">
                  <div className="h-64 bg-gray-200 rounded"></div>
                </div>
              </div>

              {/* Ad sidebar (right, smaller) */}
              <div className="w-[300px] flex-shrink-0 border-l border-gray-200 pl-6">
                <div className="sticky top-6">
                  {children}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
