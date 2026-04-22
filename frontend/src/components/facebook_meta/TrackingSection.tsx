'use client';

import React, { useState } from 'react';
import { CircleCheck, Info } from 'lucide-react';

export default function TrackingSection() {
  const [showWebsiteEventsTooltip, setShowWebsiteEventsTooltip] = useState(false);
  const [showAppEventsTooltip, setShowAppEventsTooltip] = useState(false);
  const [showOfflineEventsTooltip, setShowOfflineEventsTooltip] = useState(false);
  const [showUrlParamsTooltip, setShowUrlParamsTooltip] = useState(false);

  return (
    <div className="space-y-6">
      {/* Title with checkmark icon */}
      <div className="flex items-center">
        <CircleCheck className="w-5 h-5 text-green-500 mr-2" />
        <h3 className="text-base font-bold text-gray-900">Tracking</h3>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700">
        Choose conversion events to track. This ad account's selected conversion dataset will be tracked by default.
      </p>

      {/* Website Events */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-bold text-gray-900">Website events</h4>
          <div className="relative">
            <Info 
              className="w-4 h-4 text-black cursor-pointer"
              onMouseEnter={() => setShowWebsiteEventsTooltip(true)}
              onMouseLeave={() => setShowWebsiteEventsTooltip(false)}
            />
            {showWebsiteEventsTooltip && (
              <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                <p>
                  Add pixel code to your website and Instant
                  Experience to report conversions, see activity
                  and build audiences for ad targeting.<br />
                  <a href="#" className="text-[#3CCED7] hover:underline">
                    Learn more
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* App Events */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-bold text-gray-900">App events</h4>
            <div className="relative">
              <Info 
                className="w-4 h-4 text-black cursor-pointer"
                onMouseEnter={() => setShowAppEventsTooltip(true)}
                onMouseLeave={() => setShowAppEventsTooltip(false)}
              />
              {showAppEventsTooltip && (
                <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                <p>
                  Add events to your app to view analytics,
                  measure ad performance and build audiences
                  for ad targeting.<br />
                  <a href="#" className="text-[#3CCED7] hover:underline">
                    Learn more
                  </a>
                </p>
                </div>
              )}
            </div>
          </div>
          <button className="px-4 py-2 bg-white border border-[#00000066] rounded-md text-sm font-medium hover:bg-gray-100 transition-colors">
            Set up
          </button>
        </div>
      </div>

      {/* Offline Events */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-bold text-gray-900">Offline events</h4>
          <div className="relative">
            <Info 
              className="w-4 h-4 text-black cursor-pointer"
              onMouseEnter={() => setShowOfflineEventsTooltip(true)}
              onMouseLeave={() => setShowOfflineEventsTooltip(false)}
            />
            {showOfflineEventsTooltip && (
              <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                <p>
                  Upload offline sales and interaction data to measure ad conversions. Then build audiences for ad targeting based on these transactions.<br />
                  <a href="#" className="text-[#3CCED7] hover:underline">
                    Learn more
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* URL Parameters */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-bold text-gray-900">URL parameters</h4>
          <div className="relative">
            <Info 
              className="w-4 h-4 text-black cursor-pointer"
              onMouseEnter={() => setShowUrlParamsTooltip(true)}
              onMouseLeave={() => setShowUrlParamsTooltip(false)}
            />
            {showUrlParamsTooltip && (
              <div className="absolute bottom-0 left-0 transform translate-x-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-50 border border-gray-200 p-4">
                <p>
                  Add parameters to the end of your website URL to track where your visitors are coming from.&nbsp;
                  <a href="#" className="text-[#3CCED7] hover:underline">
                    About URL parameters
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* URL Parameters Input */}
        <input
          type="text"
          placeholder="key1=value1&key2=value2"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent text-sm"
        />
        
        {/* Build URL parameter link */}
        <div>
          <a href="#" className="text-[#3CCED7] hover:underline text-sm pt-2">
            Build a URL parameter
          </a>
        </div>
      </div>
    </div>
  );
}
