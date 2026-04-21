"use client";
import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";

interface KlaviyoColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
  title?: string;
}

const KlaviyoColorPicker: React.FC<KlaviyoColorPickerProps> = ({
  currentColor,
  onColorChange,
  onClose,
  title = "Color",
}) => {
  const [hexInput, setHexInput] = useState(currentColor);

  // Colors used in this email
  const emailColors = [
    { color: "#ffffff", isAdd: true },
    { color: "#ffffff", isAdd: false },
    { color: "#1f2937", isAdd: false },
    { color: "#000000", isAdd: false },
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

  const handleSelect = (color: string) => {
    onColorChange(color);
    onClose();
  };

  const handleHexInputChange = (value: string) => {
    setHexInput(value);
    // Validate hex color format
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onColorChange(value);
    }
  };

  const renderSwatch = (
    color: string,
    key: string | number,
    selected: boolean
  ) => (
    <button
      key={key}
      onClick={() => handleSelect(color)}
      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
        selected
          ? "border-[#3CCED7] ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300"
      }`}
      style={{ backgroundColor: color }}
      aria-label={`Select color ${color}`}
    />
  );

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center text-sm text-[#1a9ba3] hover:text-[#1a9ba3] gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Done
        </button>
        <span className="text-base font-semibold text-gray-900">{title}</span>
        <div className="w-16"></div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {/* Hex Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Hex Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => {
                const value = e.target.value;
                setHexInput(value);
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  handleSelect(value);
                }
              }}
              placeholder="#000000"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              maxLength={7}
            />
            <button
              type="button"
              onClick={() => handleSelect(hexInput)}
              className="w-10 h-10 rounded border-2 border-gray-200 flex items-center justify-center"
              style={{ backgroundColor: hexInput }}
              disabled={!/^#[0-9A-Fa-f]{6}$/.test(hexInput)}
            />
          </div>
        </div>

        {/* In this email */}
        <div className="space-y-3">
          <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            In this email
          </span>
          <div className="flex items-center gap-3">
            {emailColors.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  if ((item as any).isAdd) {
                    // future: add custom color
                  } else {
                    handleSelect(item.color as string);
                  }
                }}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                  currentColor === item.color
                    ? "border-[#3CCED7] ring-2 ring-blue-200"
                    : (item as any).isAdd
                    ? "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={
                  !(item as any).isAdd
                    ? { backgroundColor: item.color as string }
                    : undefined
                }
              >
                {(item as any).isAdd && (
                  <span className="text-gray-600 text-lg font-bold">+</span>
                )}
              </button>
            ))}
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
                currentColor === item.color
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
              renderSwatch(color, index, currentColor === color)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KlaviyoColorPicker;

