"use client";
import React from "react";
import { CanvasBlock } from "@/components/mailchimp/email-builder/types";

interface KlaviyoHtmlInspectorProps {
  selectedBlockData: CanvasBlock | null;
  updateHtmlSettings: (updates: Partial<CanvasBlock>) => void;
}

const KlaviyoHtmlInspector: React.FC<KlaviyoHtmlInspectorProps> = ({
  selectedBlockData,
  updateHtmlSettings,
}) => {
  const htmlContent = selectedBlockData?.content || "";

  const handleContentChange = (value: string) => {
    updateHtmlSettings({
      content: value,
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {/* HTML Code Editor */}
        <div className="space-y-3">
          <span className="block text-sm font-semibold text-gray-900">
            HTML Code
          </span>
          <textarea
            value={htmlContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Enter your HTML code here..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] font-mono min-h-[200px] resize-y"
            spellCheck={false}
          />
          <p className="text-xs text-gray-500">
            Enter HTML code to render in the email
          </p>
        </div>
      </div>
    </div>
  );
};

export default KlaviyoHtmlInspector;

