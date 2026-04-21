'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';

export default function CreativeTestingSection() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="space-y-4">
      {/* Title with info icon */}
      <div className="flex items-center space-x-2">
        <h3 className="text-base font-bold text-gray-900">Creative testing</h3>
        <div className="relative">
          <Info 
            className="w-4 h-4 text-black cursor-pointer"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          />
          {showTooltip && (
            <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
              <p>
                This test is conducted in your existing campaign, so
                you can continue to run top performers with delivery
                system learnings retained when it ends.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
          <p className="text-sm text-gray-700">
              Compare up to 5 different versions of your creative in a test that helps ensure delivery to new test ads.&nbsp;
              <a href="#" className="text-[#3CCED7] hover:underline text-sm">
                About creative testing
              </a>
          </p>

      {/* About link */}


      {/* Set up test button */}
      <button className="px-4 py-2 bg-white border border-[#00000066] rounded-md text-sm font-medium hover:bg-gray-100 transition-colors">
        Set up test
      </button>
    </div>
  );
}
