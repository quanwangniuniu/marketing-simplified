'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface CampaignScoreSectionProps {
  score?: number;
  recommendation?: string;
}

export default function CampaignScoreSection({ 
  score = 100, 
  recommendation = "You're using our recommended setup." 
}: CampaignScoreSectionProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="space-y-3">
      {/* Score Display */}
      <div className="flex items-center space-x-4">
        {/* Circular Score */}
        <div className="relative">
          <svg height="52" role="img" viewBox="0 0 52 52" width="52">
            <path 
              d="M 40.8492424049175 40.8492424049175A 21 21 0 1 0 11.150757595082503 40.8492424049175" 
              fill="none" 
              stroke="#E5E8F0" 
              strokeLinecap="round" 
              strokeWidth="5"
            />
            <path 
              d="M 40.84924240491752 40.84924240491748A 21 21 0 1 0 11.150757595082503 40.8492424049175" 
              fill="none" 
              stroke="#007E59" 
              strokeLinecap="round" 
              strokeWidth="5"
            />
            <text 
              fillOpacity="1" 
              fontSize="14px" 
              textAnchor="middle" 
              x="50%" 
              y="60%" 
              style={{fontWeight: "bold", letterSpacing: "normal"}}
            >
              {score}
            </text>
          </svg>
        </div>

        {/* Score Text */}
        <div className="flex-1">
            <div className="flex items-center space-x-2">
              <div className="text-base font-bold text-gray-900">Campaign score</div>
              <div className="relative z-[100]">
                <Info 
                  className="w-4 h-4 text-black cursor-pointer"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                />
                {showTooltip && (
                  <div className="absolute top-0 right-0 transform -translate-x-4 translate-y-4 w-80 bg-white text-gray-900 text-sm rounded-lg shadow-lg z-[1000] border border-gray-200 p-4">
                    <h4 className="font-semibold mb-3 text-gray-900">About campaign score</h4>
                    <p className="mb-3">
                      On a 0-100-point scale, this represents how optimised your campaign is before publishing. Your score is calculated based on the point values of each recommendation that you take.
                    </p>
                    <p className="mb-3">
                      Campaign score does not directly affect your account's <a href="#" className="text-[#3CCED7] hover:underline">opportunity score</a>.
                    </p>
                    
                    <h4 className="font-semibold mt-4 mb-2 text-gray-900">Points and potential outcomes</h4>
                    <p className="mb-3">
                      Points are personalised based on how valuable a recommendation may be for your campaign. Points can vary based on factors, such as your objective, campaign characteristics and number of ad sets.
                    </p>
                    <p className="mb-3">
                      Potential outcomes are based on our experimentation and may vary across advertisers.
                    </p>
                    <a href="#" className="text-[#3CCED7] hover:underline">About campaign score</a>
                  </div>
                )}
              </div>
            </div>
          <p className="text-sm mt-1">{recommendation}</p>
        </div>
      </div>
    </div>
  );
}
