"use client";
import React, { useState } from "react";
import { ChevronLeft, HelpCircle, ChevronRight } from "lucide-react";
import { CanvasBlock, BlockBoxStyles } from "../types";

interface SpacerInspectorProps {
  selectedBlockData: CanvasBlock | null;
  activeBlockTab: "Content" | "Styles";
  setActiveBlockTab: (tab: "Content" | "Styles") => void;
  setSelectedBlock: (block: { section: string; id: string } | null) => void;
  updateSpacerSettings: (updates: Partial<CanvasBlock>) => void;
  setIsSpacerBlockBackgroundPickerOpen?: (open: boolean) => void;
}

const SpacerInspector: React.FC<SpacerInspectorProps> = ({
  selectedBlockData,
  activeBlockTab,
  setActiveBlockTab,
  setSelectedBlock,
  updateSpacerSettings,
  setIsSpacerBlockBackgroundPickerOpen,
}) => {
  const [linkDeviceStyles, setLinkDeviceStyles] = useState(true);

  const parseNumeric = (
    value: string | number | undefined,
    fallback: number
  ) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number") return value;
    const parsed = parseFloat(value.toString().replace("px", ""));
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const spacerHeight = parseNumeric(selectedBlockData?.spacerHeight, 20);
  const blockBackgroundColor =
    selectedBlockData?.spacerBlockStyles?.backgroundColor || "transparent";

  const handleHeightChange = (value: number) => {
    updateSpacerSettings({
      spacerHeight: `${Math.max(20, Math.min(200, value))}px`,
    });
  };

  const updateBlockStyles = (updates: Partial<BlockBoxStyles>) => {
    if (!selectedBlockData) return;
    const current = selectedBlockData.spacerBlockStyles || {};
    const merged = { ...current, ...updates };

    // Remove undefined values
    Object.keys(merged).forEach((key) => {
      if (merged[key as keyof BlockBoxStyles] === undefined) {
        delete merged[key as keyof BlockBoxStyles];
      }
    });

    updateSpacerSettings({
      spacerBlockStyles: merged,
    });
  };

  const stylesContent = (
    <>
      <div className="space-y-8 text-sm text-gray-600">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            ALL DEVICES
          </h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-gray-900">
                Colors
              </span>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setIsSpacerBlockBackgroundPickerOpen?.(true)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
                >
                  <span>Block Background</span>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full border border-gray-200"
                      style={{
                        backgroundColor:
                          !blockBackgroundColor ||
                          blockBackgroundColor === "transparent"
                            ? "transparent"
                            : blockBackgroundColor,
                        backgroundImage:
                          !blockBackgroundColor ||
                          blockBackgroundColor === "transparent"
                            ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                            : undefined,
                        backgroundSize:
                          !blockBackgroundColor ||
                          blockBackgroundColor === "transparent"
                            ? "8px 8px"
                            : undefined,
                        backgroundPosition:
                          !blockBackgroundColor ||
                          blockBackgroundColor === "transparent"
                            ? "0 0, 0 4px, 4px -4px, -4px 0px"
                            : undefined,
                      }}
                    />
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            DEVICE-SPECIFIC
          </h3>
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Link Desktop and Mobile Styles
                </p>
                <p className="text-xs text-gray-500">
                  Keep the same styles across devices.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={linkDeviceStyles}
                  onChange={(e) => setLinkDeviceStyles(e.target.checked)}
                />
                <span
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition ${
                    linkDeviceStyles ? "bg-[#3CCED7]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                      linkDeviceStyles ? "translate-x-5" : ""
                    }`}
                  ></span>
                </span>
              </label>
            </div>

            <div className="px-4 py-4 space-y-6">
              <div className="space-y-3">
                <span className="text-sm font-semibold text-gray-900">
                  Height
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="20"
                    max="200"
                    value={spacerHeight}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 min-w-[40px] text-right">
                    {spacerHeight}px
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const contentContent = (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Spacer blocks don&apos;t have content settings.
      </p>
    </div>
  );

  const currentContent =
    activeBlockTab === "Content" ? contentContent : stylesContent;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => setSelectedBlock(null)}
          className="flex items-center text-sm text-[#1a9ba3] hover:text-[#1a9ba3] gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Done
        </button>
        <span className="text-base font-semibold text-gray-900">Spacer</span>
        <button className="text-[#3CCED7] hover:text-[#1a9ba3] text-xs flex items-center gap-1">
          {/* <HelpCircle className="h-4 w-4" />
          How to use spacer blocks */}
        </button>
      </div>

      <div className="flex border-b border-gray-200">
        {(["Content", "Styles"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveBlockTab(tab)}
            className={`flex-1 text-sm font-medium py-3 ${
              activeBlockTab === tab
                ? "text-[#1a9ba3] border-b-2 border-[#2AB5BD] bg-gray-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {currentContent}
      </div>

      {/* {activeBlockTab === "Styles" && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              updateSpacerSettings({
                spacerHeight: "20px",
                spacerBlockStyles: {},
              });
            }}
            className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear styles
          </button>
          <button className="flex-1 bg-[#2AB5BD] text-white rounded-md px-3 py-2 text-sm hover:bg-[#1a9ba3]">
            Apply to all
          </button>
        </div>
      )} */}
    </div>
  );
};

export default SpacerInspector;
