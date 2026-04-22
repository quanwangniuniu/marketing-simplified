"use client";
import React, { useState } from "react";
import { Minus, HelpCircle, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import { CanvasBlock, TextStyles } from "@/components/mailchimp/email-builder/types";
import KlaviyoColorPicker from "./KlaviyoColorPicker";

interface KlaviyoTextInspectorProps {
  currentStyles?: TextStyles;
  handleStyleChange?: (styles: Partial<TextStyles>) => void;
  setIsTextAreaBackgroundPickerOpen?: (open: boolean) => void;
  setIsBlockBackgroundPickerOpen?: (open: boolean) => void;
  setIsBorderColorPickerOpen?: (open: boolean) => void;
  setIsTextColorPickerOpen?: (open: boolean) => void;
  isTextColorPickerOpen?: boolean;
}

const KlaviyoTextInspector: React.FC<KlaviyoTextInspectorProps> = ({
  currentStyles,
  handleStyleChange,
  setIsTextAreaBackgroundPickerOpen,
  setIsBlockBackgroundPickerOpen,
  setIsBorderColorPickerOpen,
  setIsTextColorPickerOpen,
  isTextColorPickerOpen = false,
}) => {
  const [isPaddingLinked, setIsPaddingLinked] = useState(true);
  const [isFullWidthMobile, setIsFullWidthMobile] = useState(false);

  const parseNumeric = (
    value: string | number | undefined,
    fallback: number
  ) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number") return value;
    const parsed = parseFloat(value.toString().replace("px", ""));
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  // Font settings
  const fontFamily = currentStyles?.fontFamily || "Arial";
  const fontSize = parseNumeric(currentStyles?.fontSize, 16);
  const textAlign = currentStyles?.textAlign || "left";
  const textColor = currentStyles?.color || "#000000";

  // Text area background color (using backgroundColor from styles)
  // Note: In TextStyles, backgroundColor is for text area, blockBackgroundColor is for block
  const textAreaBackgroundColor =
    currentStyles?.backgroundColor || "transparent";

  // Block background color
  const blockBackgroundColor =
    currentStyles?.blockBackgroundColor || "transparent";

  // Border settings
  const borderStyle = currentStyles?.borderStyle || "none";
  const borderWidthValue = parseNumeric(currentStyles?.borderWidth, 1);
  const borderColor = currentStyles?.borderColor || "#000000";

  // Padding (horizontal and vertical)
  // We'll use paddingTop/paddingBottom for vertical and paddingLeft/paddingRight for horizontal
  const paddingVertical = parseNumeric(
    currentStyles?.paddingTop || currentStyles?.padding,
    0
  );
  const paddingHorizontal = parseNumeric(
    currentStyles?.paddingLeft || currentStyles?.padding,
    0
  );

  const updatePadding = (type: "horizontal" | "vertical", value: number) => {
    if (!handleStyleChange) return;
    const pxValue = `${Math.max(0, value)}px`;
    
    if (isPaddingLinked) {
      // When linked, update both horizontal and vertical
      handleStyleChange({
        padding: pxValue,
        paddingTop: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
        paddingRight: undefined,
      });
    } else {
      if (type === "vertical") {
        handleStyleChange({
          padding: undefined,
          paddingTop: pxValue,
          paddingBottom: pxValue,
        });
      } else {
        handleStyleChange({
          padding: undefined,
          paddingLeft: pxValue,
          paddingRight: pxValue,
        });
      }
    }
  };

  const handlePaddingLinkToggle = (linked: boolean) => {
    setIsPaddingLinked(linked);
    if (!handleStyleChange) return;
    if (linked) {
      const value = Math.max(paddingVertical, paddingHorizontal);
      handleStyleChange({
        padding: `${value}px`,
        paddingTop: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
        paddingRight: undefined,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {/* Text Color */}
        {isTextColorPickerOpen ? (
          <KlaviyoColorPicker
            currentColor={textColor}
            onColorChange={(color) => handleStyleChange?.({ color })}
            onClose={() => setIsTextColorPickerOpen?.(false)}
            title="Text Color"
          />
        ) : (
          <div className="space-y-3">
            <span className="block text-sm font-semibold text-gray-900">
              Text Color
            </span>
            <button
              type="button"
              onClick={() => setIsTextColorPickerOpen?.(true)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded border border-gray-200"
                  style={{ backgroundColor: textColor }}
                />
                <span>{textColor.toUpperCase()}</span>
              </span>
            </button>
          </div>
        )}

        {/* Font Family */}
        <div className="space-y-3">
          <span className="block text-sm font-semibold text-gray-900">
            Font Family
          </span>
          <div className="relative">
            <select
              value={fontFamily}
              onChange={(e) => handleStyleChange?.({ fontFamily: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] appearance-none bg-white"
            >
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Verdana">Verdana</option>
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-3">
          <span className="block text-sm font-semibold text-gray-900">
            Font Size
          </span>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <input
              type="number"
              min={8}
              max={72}
              value={fontSize}
              onChange={(e) =>
                handleStyleChange?.({ fontSize: Number(e.target.value || 16) })
              }
              className="flex-1 text-sm outline-none"
            />
            <span className="text-xs text-gray-500">px</span>
          </div>
        </div>

        {/* Text Alignment */}
        <div className="space-y-3">
          <span className="block text-sm font-semibold text-gray-900">
            Alignment
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStyleChange?.({ textAlign: "left" })}
              className={`p-2 border rounded-lg ${
                textAlign === "left"
                  ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange?.({ textAlign: "center" })}
              className={`p-2 border rounded-lg ${
                textAlign === "center"
                  ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange?.({ textAlign: "right" })}
              className={`p-2 border rounded-lg ${
                textAlign === "right"
                  ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <AlignRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange?.({ textAlign: "justify" })}
              className={`p-2 border rounded-lg ${
                textAlign === "justify"
                  ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <AlignJustify className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Padding */}
        <div className="space-y-3">
          <span className="block text-sm font-semibold text-gray-900">
            Padding
          </span>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 min-w-0">
              <div className="w-4 h-4 border border-gray-400 flex-shrink-0" />
              <input
                type="number"
                min={0}
                value={paddingHorizontal}
                onChange={(e) =>
                  updatePadding("horizontal", Number(e.target.value || 0))
                }
                className="flex-1 text-sm outline-none min-w-0"
                placeholder="0"
              />
              <span className="text-xs text-gray-500 flex-shrink-0">px</span>
            </div>
            <button
              onClick={() => handlePaddingLinkToggle(!isPaddingLinked)}
              className={`p-2 border border-gray-200 rounded-lg flex-shrink-0 ${
                isPaddingLinked
                  ? "bg-gray-100 border-gray-300"
                  : "hover:bg-gray-50"
              }`}
              title={isPaddingLinked ? "Unlink padding" : "Link padding"}
            >
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

      

        {/* Border */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="block text-sm font-semibold text-gray-900">
              Border
            </span>
            <button className="text-gray-400 hover:text-gray-600">
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
            value={borderStyle}
            onChange={(e) => {
              const value = e.target.value as TextStyles["borderStyle"];
              handleStyleChange?.({
                borderStyle: value,
                borderWidth:
                  value === "none" ? undefined : `${borderWidthValue}px`,
                borderColor: value === "none" ? undefined : borderColor,
              });
            }}
          >
            {[
              "none",
              "solid",
              "dashed",
              "dotted",
              "double",
              "groove",
              "ridge",
              "inset",
              "outset",
            ].map((style) => (
              <option key={style} value={style}>
                {style[0].toUpperCase() + style.slice(1)}
              </option>
            ))}
          </select>
          {borderStyle !== "none" && (
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={borderWidthValue}
                onChange={(e) =>
                  handleStyleChange?.({
                    borderWidth: e.target.value
                      ? `${e.target.value}px`
                      : undefined,
                  })
                }
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              />
              <span className="text-xs text-gray-500">px</span>
              <button
                type="button"
                className="w-10 h-10 rounded border border-gray-200"
                onClick={() => setIsBorderColorPickerOpen?.(true)}
                aria-label="Change border color"
                style={{
                  backgroundColor: borderColor,
                }}
              />
            </div>
          )}
        </div>

        {/* Block background color */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="block text-sm font-semibold text-gray-900">
              Block background color
            </span>
            <button className="text-gray-400 hover:text-gray-600">
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsBlockBackgroundPickerOpen?.(true)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
          >
            <span className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded border border-gray-200"
                style={{
                  backgroundColor:
                    !blockBackgroundColor || blockBackgroundColor === "transparent"
                      ? "transparent"
                      : blockBackgroundColor,
                  backgroundImage:
                    !blockBackgroundColor || blockBackgroundColor === "transparent"
                      ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                      : undefined,
                  backgroundSize:
                    !blockBackgroundColor || blockBackgroundColor === "transparent"
                      ? "8px 8px"
                      : undefined,
                  backgroundPosition:
                    !blockBackgroundColor || blockBackgroundColor === "transparent"
                      ? "0 0, 0 4px, 4px -4px, -4px 0px"
                      : undefined,
                }}
              />
              <span>{blockBackgroundColor === "transparent" || !blockBackgroundColor ? "#000000" : blockBackgroundColor.toUpperCase()}</span>
            </span>
          </button>
        </div>

        {/* Full width on mobile */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="block text-sm font-semibold text-gray-900">
                Full width on mobile
              </span>
              <HelpCircle className="h-4 w-4 text-gray-400" />
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={isFullWidthMobile}
                onChange={(e) => setIsFullWidthMobile(e.target.checked)}
              />
              <span
                className={`w-11 h-6 flex items-center rounded-full p-1 transition ${
                  isFullWidthMobile ? "bg-[#3CCED7]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                    isFullWidthMobile ? "translate-x-5" : ""
                  }`}
                />
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KlaviyoTextInspector;

