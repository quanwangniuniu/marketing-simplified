"use client";
import React, { useState } from "react";
import {
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
} from "lucide-react";
import {
  CanvasBlock,
  TextStyles,
  BlockBoxStyles,
  ButtonLinkType,
  ButtonSize,
  ButtonShape,
} from "@/components/mailchimp/email-builder/types";

interface KlaviyoButtonInspectorProps {
  selectedBlockData: CanvasBlock | null;
  updateButtonSettings: (updates: Partial<CanvasBlock>) => void;
  setIsButtonTextColorPickerOpen?: (open: boolean) => void;
  setIsButtonBackgroundColorPickerOpen?: (open: boolean) => void;
  setIsButtonBorderColorPickerOpen?: (open: boolean) => void;
}

const KlaviyoButtonInspector: React.FC<KlaviyoButtonInspectorProps> = ({
  selectedBlockData,
  updateButtonSettings,
  setIsButtonTextColorPickerOpen,
  setIsButtonBackgroundColorPickerOpen,
  setIsButtonBorderColorPickerOpen,
}) => {
  const [isPaddingLinked, setIsPaddingLinked] = useState(true);

  const parseNumeric = (
    value: string | number | undefined,
    fallback: number
  ) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number") return value;
    const parsed = parseFloat(value.toString().replace("px", ""));
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  // Button text properties
  const buttonText = selectedBlockData?.content || "";
  const buttonLinkType: ButtonLinkType =
    selectedBlockData?.buttonLinkType || "Web";
  const buttonLinkValue = selectedBlockData?.buttonLinkValue || "";
  const buttonOpenInNewTab = selectedBlockData?.buttonOpenInNewTab ?? true;

  // Text styles
  const textStyles: TextStyles = selectedBlockData?.styles || {};
  const fontFamily = textStyles.fontFamily || "Arial";
  const fontSize = parseNumeric(textStyles.fontSize, 16);
  const textColor = textStyles.color || selectedBlockData?.buttonTextColor || "#FFFFFF";
  const lineHeight = parseNumeric(textStyles.lineHeight, 0);
  const isBold = textStyles.fontWeight === "bold";
  const isItalic = textStyles.fontStyle === "italic";
  const isUnderline = textStyles.textDecoration === "underline";
  const isStrikethrough = textStyles.textDecoration === "line-through";

  // Style properties
  const buttonBackgroundColor =
    selectedBlockData?.buttonBackgroundColor || "#AD11CC";
  const buttonSize: ButtonSize = selectedBlockData?.buttonSize || "Medium";
  const buttonAlignment =
    selectedBlockData?.buttonAlignment || "center";
  const buttonShape: ButtonShape = selectedBlockData?.buttonShape || "Square";
  const buttonBlockStyles: BlockBoxStyles =
    selectedBlockData?.buttonBlockStyles || {};
  const borderRadius = parseNumeric(buttonBlockStyles.borderRadius, 5);
  // Check if button has full width by checking if width is set to 100%
  // We'll store this in a custom way since BlockBoxStyles doesn't have width
  const buttonWidth = (selectedBlockData as any)?.buttonWidth;
  const isFullWidth = buttonWidth === "100%";

  // Border properties
  const borderStyle =
    buttonBlockStyles.borderStyle || "none";
  const borderWidth = parseNumeric(buttonBlockStyles.borderWidth, 1);
  const borderColor = buttonBlockStyles.borderColor || "#000000";

  // Padding
  const paddingVertical = parseNumeric(
    buttonBlockStyles.paddingTop || buttonBlockStyles.padding,
    15
  );
  const paddingHorizontal = parseNumeric(
    buttonBlockStyles.paddingLeft || buttonBlockStyles.padding,
    15
  );

  const updateTextStyles = (updates: Partial<TextStyles>) => {
    const currentStyles = selectedBlockData?.styles || {};
    updateButtonSettings({
      styles: { ...currentStyles, ...updates },
    });
  };

  const updateBlockStyles = (updates: Partial<BlockBoxStyles>) => {
    const current = selectedBlockData?.buttonBlockStyles || {};
    const merged = { ...current, ...updates };

    // Remove undefined values
    Object.keys(merged).forEach((key) => {
      if (merged[key as keyof BlockBoxStyles] === undefined) {
        delete merged[key as keyof BlockBoxStyles];
      }
    });

    updateButtonSettings({
      buttonBlockStyles: merged,
    });
  };

  const updatePadding = (type: "horizontal" | "vertical", value: number) => {
    const pxValue = `${Math.max(0, value)}px`;

    if (isPaddingLinked) {
      updateBlockStyles({
        padding: pxValue,
        paddingTop: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
        paddingRight: undefined,
      });
    } else {
      if (type === "vertical") {
        updateBlockStyles({
          padding: undefined,
          paddingTop: pxValue,
          paddingBottom: pxValue,
        });
      } else {
        updateBlockStyles({
          padding: undefined,
          paddingLeft: pxValue,
          paddingRight: pxValue,
        });
      }
    }
  };

  const handlePaddingLinkToggle = (linked: boolean) => {
    setIsPaddingLinked(linked);
    if (linked) {
      const value = Math.max(paddingVertical, paddingHorizontal);
      updateBlockStyles({
        padding: `${value}px`,
        paddingTop: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
        paddingRight: undefined,
      });
    }
  };

  const linkPlaceholders: Record<ButtonLinkType, string> = {
    Web: "https://example.com",
    Email: "name@example.com",
    Phone: "+1 (555) 123-4567",
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {/* Button text section */}
        <div className="space-y-4">
          <span className="block text-sm font-semibold text-gray-900">
            Button text
          </span>

          {/* Text input */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Text
            </label>
            <input
              type="text"
              value={buttonText}
              onChange={(e) =>
                updateButtonSettings({ content: e.target.value })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              placeholder="SHOP NOW"
            />
          </div>

          {/* Link address */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Link address
            </label>
            <input
              type="text"
              value={buttonLinkValue}
              onChange={(e) =>
                updateButtonSettings({ buttonLinkValue: e.target.value })
              }
              placeholder={linkPlaceholders[buttonLinkType]}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
            />
          </div>

          {/* Font Family */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Font Family
            </label>
            <div className="relative">
              <select
                value={fontFamily}
                onChange={(e) =>
                  updateTextStyles({ fontFamily: e.target.value })
                }
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
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Font Size
            </label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
              <input
                type="number"
                min={8}
                max={72}
                value={fontSize}
                onChange={(e) =>
                  updateTextStyles({
                    fontSize: Number(e.target.value || 16),
                  })
                }
                className="flex-1 text-sm outline-none"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>
          </div>

          {/* Text Color */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Text Color
            </label>
            <button
              type="button"
              onClick={() => setIsButtonTextColorPickerOpen?.(true)}
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

          {/* Line Height / Spacing */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Line Height
            </label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-sm">|A|</span>
              <input
                type="number"
                min={0}
                value={lineHeight}
                onChange={(e) =>
                  updateTextStyles({
                    lineHeight: Number(e.target.value || 0),
                  })
                }
                className="flex-1 text-sm outline-none"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>
          </div>

          {/* Text Styling Buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Text Styling
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateTextStyles({
                    fontWeight: isBold ? "normal" : "bold",
                  })
                }
                className={`p-2 border rounded-lg ${
                  isBold
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateTextStyles({
                    fontStyle: isItalic ? "normal" : "italic",
                  })
                }
                className={`p-2 border rounded-lg ${
                  isItalic
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateTextStyles({
                    textDecoration:
                      isUnderline && !isStrikethrough
                        ? "none"
                        : "underline",
                  })
                }
                className={`p-2 border rounded-lg ${
                  isUnderline && !isStrikethrough
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Underline className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateTextStyles({
                    textDecoration:
                      isStrikethrough ? "none" : "line-through",
                  })
                }
                className={`p-2 border rounded-lg ${
                  isStrikethrough
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Strikethrough className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Style section */}
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <span className="block text-sm font-semibold text-gray-900">
            Style
          </span>

          {/* Background Color */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Button Color
            </label>
            <button
              type="button"
              onClick={() => setIsButtonBackgroundColorPickerOpen?.(true)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded border border-gray-200"
                  style={{ backgroundColor: buttonBackgroundColor }}
                />
                <span>{buttonBackgroundColor.toUpperCase()}</span>
              </span>
            </button>
          </div>

          {/* Width Options */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Width
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  updateButtonSettings({ buttonWidth: undefined } as any);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                  !isFullWidth
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Fit to text
              </button>
              <button
                type="button"
                onClick={() => {
                  updateButtonSettings({ buttonWidth: "100%" } as any);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                  isFullWidth
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Full width
              </button>
            </div>
          </div>

          {/* Alignment */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Alignment
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateButtonSettings({ buttonAlignment: "left" })
                }
                className={`p-2 border rounded-lg ${
                  buttonAlignment === "left"
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateButtonSettings({ buttonAlignment: "center" })
                }
                className={`p-2 border rounded-lg ${
                  buttonAlignment === "center"
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateButtonSettings({ buttonAlignment: "right" })
                }
                className={`p-2 border rounded-lg ${
                  buttonAlignment === "right"
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AlignRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Padding */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Padding
            </label>
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

          {/* Button Size */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Size
            </label>
            <select
              value={buttonSize}
              onChange={(e) =>
                updateButtonSettings({
                  buttonSize: e.target.value as ButtonSize,
                })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
            >
              <option value="Small">Small</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
            </select>
          </div>
        </div>

        {/* Border section */}
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between">
            <span className="block text-sm font-semibold text-gray-900">
              Border
            </span>
            <button className="text-gray-400 hover:text-gray-600">
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* Border Style */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Border Style
            </label>
            <div className="relative">
              <select
                value={borderStyle}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "none") {
                    updateBlockStyles({
                      borderStyle: "none",
                      borderWidth: undefined,
                      borderColor: undefined,
                    });
                  } else {
                    updateBlockStyles({
                      borderStyle: value as BlockBoxStyles["borderStyle"],
                      borderWidth: borderWidth ? `${borderWidth}px` : "1px",
                    });
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] appearance-none bg-white"
              >
                <option value="none">None</option>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
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

          {/* Border Width and Color */}
          {borderStyle !== "none" && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  value={borderWidth}
                  onChange={(e) =>
                    updateBlockStyles({
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
                  onClick={() => setIsButtonBorderColorPickerOpen?.(true)}
                  aria-label="Change border color"
                  style={{
                    backgroundColor: borderColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KlaviyoButtonInspector;

