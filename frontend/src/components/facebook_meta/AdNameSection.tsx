'use client';

import React, { useState } from 'react';
import { CircleCheck } from 'lucide-react';

interface AdNameSectionProps {
  adName: string;
  onAdNameChange: (name: string) => void;
  onCreateTemplate: () => void;
}

export default function AdNameSection({ 
  adName, 
  onAdNameChange, 
  onCreateTemplate 
}: AdNameSectionProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    onAdNameChange(newName);
  };

  return (
    <div className="space-y-3">
      {/* Title with checkmark */}
      <div className="flex items-center">
        <CircleCheck className="w-5 h-5 text-green-500 mr-2" />
        <div className="text-base font-bold text-gray-900">Ad name</div>
      </div>

      {/* Input field and button */}
      <div className="flex items-center space-x-3 h-9">
        <input
          type="text"
          value={adName}
          onChange={handleNameChange}
          placeholder="New Awareness ad"
          className="h-full flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
        />
        <div className="relative">
          <button
            onClick={onCreateTemplate}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-sm font-medium px-4 py-2 bg-white border border-[#00000066] rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Create template
          </button>
          
          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-white text-gray-900 text-sm rounded shadow-lg whitespace-nowrap z-50 border border-gray-200">
              Standardise your ad names so that they are <br /> consistent and easier to organise.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
