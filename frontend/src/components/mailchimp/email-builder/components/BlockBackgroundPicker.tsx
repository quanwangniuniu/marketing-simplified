"use client";
import React from "react";
import { ChevronLeft } from "lucide-react";
import { TextStyles } from "../types";

interface BlockBackgroundPickerProps {
  currentStyles: Partial<TextStyles>;
  handleStyleChange: (styleUpdates: Partial<TextStyles>) => void;
  setIsBlockBackgroundPickerOpen: (open: boolean) => void;
}

const BlockBackgroundPicker: React.FC<BlockBackgroundPickerProps> = ({
  currentStyles,
  handleStyleChange,
  setIsBlockBackgroundPickerOpen,
}) => {
  // Colors used in this email
  const emailColors = [
    { color: "#ffffff", isAdd: true },
    { color: "transparent", isTransparent: true },
    { color: "#1f2937" }, // gray-800
    { color: "#000000" },
  ];

  // Brand kit colors
  const brandKitColors = [
    { color: "#ffffff" },
    { color: "#000000" },
    { color: "#374151" },
  ];

  // Default color palette (6 rows x 8 columns)
  const defaultColors = [
    // Row 1: Neutrals
    "#ffffff",
    "#f9fafb",
    "#f3f4f6",
    "#e5e7eb",
    "#d1d5db",
    "#9ca3af",
    "#6b7280",
    "#000000",
    // Row 2
    "#1e293b",
    "#0f172a",
    "#1e40af",
    "#1e3a8a",
    "#312e81",
    "#581c87",
    "#7c2d12",
    "#991b1b",
    // Row 3
    "#3b82f6",
    "#2563eb",
    "#6366f1",
    "#7c3aed",
    "#a855f7",
    "#dc2626",
    "#ea580c",
    "#f59e0b",
    // Row 4
    "#60a5fa",
    "#818cf8",
    "#a78bfa",
    "#c084fc",
    "#f472b6",
    "#fb7185",
    "#fb923c",
    "#fbbf24",
    // Row 5
    "#93c5fd",
    "#a5b4fc",
    "#c4b5fd",
    "#d8b4fe",
    "#f9a8d4",
    "#fda4af",
    "#fcd34d",
    "#fde047",
    // Row 6
    "#bfdbfe",
    "#c7d2fe",
    "#ddd6fe",
    "#e9d5ff",
    "#fce7f3",
    "#fecdd3",
    "#fef3c7",
    "#fef9c3",
  ];

  const handleBgSelect = (color: string) => {
    handleStyleChange({
      blockBackgroundColor: color === "transparent" ? undefined : color,
    });
    setIsBlockBackgroundPickerOpen(false);
  };

  const renderSwatch = (
    color: string,
    key: string | number,
    selected: boolean
  ) => (
    <button
      key={key}
      onClick={() => handleBgSelect(color)}
      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
        selected
          ? "border-[#3CCED7] ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300"
      }`}
      style={{ backgroundColor: color }}
    />
  );

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => setIsBlockBackgroundPickerOpen(false)}
          className="flex items-center text-sm text-[#1a9ba3] hover:text-[#1a9ba3] gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Done
        </button>
        <span className="text-base font-semibold text-gray-900">
          Block Background
        </span>
        <div className="w-16"></div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {/* In this email */}
        <div className="space-y-3">
          <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            In this email
          </span>
          <div className="flex items-center gap-3">
            {emailColors.map((item, index) => {
              const isSelected =
                (item.isTransparent && !currentStyles.blockBackgroundColor) ||
                currentStyles.blockBackgroundColor === (item as any).color;
              return (
                <button
                  key={index}
                  onClick={() => {
                    if ((item as any).isAdd) {
                      // future: custom color picker
                    } else if ((item as any).isTransparent) {
                      handleBgSelect("transparent");
                    } else {
                      handleBgSelect(item.color as string);
                    }
                  }}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? "border-[#3CCED7] ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={
                    (item as any).isTransparent
                      ? {
                          backgroundImage:
                            "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                          backgroundSize: "8px 8px",
                          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                        }
                      : { backgroundColor: (item as any).color }
                  }
                >
                  {(item as any).isAdd && (
                    <span className="text-gray-600 text-lg font-bold">+</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Brand kit */}
        <div className="space-y-3 border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Brand kit
            </span>
            <button className="text-sm text-[#3CCED7] hover:text-[#1a9ba3] font-medium">
              Edit
            </button>
          </div>
          <div className="flex items-center gap-3">
              {brandKitColors.map((item, index) =>
              renderSwatch(
                item.color as string,
                index,
                 currentStyles.blockBackgroundColor === item.color
              )
            )}
          </div>
        </div>

        {/* Default */}
        <div className="space-y-3 border-t border-gray-200 pt-6">
          <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Default
          </span>
          <div className="grid grid-cols-8 gap-2">
            {defaultColors.map((color, index) =>
              renderSwatch(
                color,
                index,
                currentStyles.blockBackgroundColor === color
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockBackgroundPicker;
