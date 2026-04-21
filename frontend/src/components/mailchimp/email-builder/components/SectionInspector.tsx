"use client";
import React from "react";
import { ChevronLeft, XCircle, ChevronDown } from "lucide-react";

// Section inspector is disabled for now
const SECTION_INSPECTOR_ENABLED = false;

interface SectionInspectorProps {
  selectedSection: string | null;
  setSelectedSection: (section: string | null) => void;
}

const SectionInspector: React.FC<SectionInspectorProps> = ({
  selectedSection,
  setSelectedSection,
}) => {
  if (!SECTION_INSPECTOR_ENABLED || !selectedSection) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => setSelectedSection(null)}
          className="flex items-center text-sm text-[#1a9ba3] hover:text-[#1a9ba3] gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Done
        </button>
        <span className="text-base font-semibold text-gray-900 capitalize">
          {selectedSection} Section
        </span>
        <button
          onClick={() => setSelectedSection(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircle className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 text-sm">
        <div className="space-y-2">
          {["Section Backgrounds", "Text", "Link", "Padding", "Border"].map(
            (label) => (
              <div key={label} className="border border-gray-200 rounded">
                <button className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50">
                  <span>{label}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )
          )}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
        <button className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 rounded">
          Clear section styles
        </button>
      </div>
    </div>
  );
};

export default SectionInspector;
