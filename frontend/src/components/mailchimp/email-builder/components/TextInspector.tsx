"use client";
import React, { useState } from "react";
import { ChevronLeft, HelpCircle, ChevronRight, Scan } from "lucide-react";
import { CanvasBlock, TextStyles } from "../types";

interface TextInspectorProps {
  selectedBlockData: CanvasBlock | null;
  activeBlockTab: "Content" | "Styles";
  setActiveBlockTab: (tab: "Content" | "Styles") => void;
  setSelectedBlock: (block: { section: string; id: string } | null) => void;
  isPaddingLinked: boolean;
  setIsPaddingLinked: (linked: boolean) => void;
  isMarginLinked: boolean;
  setIsMarginLinked: (linked: boolean) => void;
  currentStyles?: TextStyles;
  handleStyleChange?: (styles: Partial<TextStyles>) => void;
  setIsBlockBackgroundPickerOpen?: (open: boolean) => void;
  setIsBorderColorPickerOpen?: (open: boolean) => void;
  updateTextContent?: (content: string) => void;
}

const TextInspector: React.FC<TextInspectorProps> = ({
  selectedBlockData,
  activeBlockTab,
  setActiveBlockTab,
  setSelectedBlock,
  isPaddingLinked,
  setIsPaddingLinked,
  isMarginLinked,
  setIsMarginLinked,
  currentStyles,
  handleStyleChange,
  setIsBlockBackgroundPickerOpen,
  setIsBorderColorPickerOpen,
  updateTextContent,
}) => {
  const textInspectorTitleMap: Record<string, string> = {
    Paragraph: "Text",
    Heading: "Heading",
  };
  const textInspectorTitle = selectedBlockData?.type
    ? textInspectorTitleMap[selectedBlockData.type] || "Text"
    : "Text";
  const textInspectorHelpLabel = `How to use ${textInspectorTitle.toLowerCase()} blocks`;

  const [isRoundedLinked, setIsRoundedLinked] = useState(true);

  const parseNumeric = (
    value: string | number | undefined,
    fallback: number
  ) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number") return value;
    const parsed = parseFloat(value.toString().replace("px", ""));
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const blockBackgroundColor =
    currentStyles?.blockBackgroundColor || "transparent";
  const borderRadiusValue = parseNumeric(currentStyles?.borderRadius, 0);
  const borderStyle = currentStyles?.borderStyle || "none";
  const borderWidthValue = parseNumeric(currentStyles?.borderWidth, 1);

  const paddingAllValue = parseNumeric(currentStyles?.padding, 12);
  const paddingValues = {
    top: parseNumeric(currentStyles?.paddingTop, paddingAllValue),
    bottom: parseNumeric(currentStyles?.paddingBottom, paddingAllValue),
    left: parseNumeric(currentStyles?.paddingLeft, paddingAllValue),
    right: parseNumeric(currentStyles?.paddingRight, paddingAllValue),
  };

  const marginAllValue = parseNumeric(currentStyles?.margin, 0);
  const marginValues = {
    top: parseNumeric(currentStyles?.marginTop, marginAllValue),
    bottom: parseNumeric(currentStyles?.marginBottom, marginAllValue),
    left: parseNumeric(currentStyles?.marginLeft, marginAllValue),
    right: parseNumeric(currentStyles?.marginRight, marginAllValue),
  };

  const updatePaddingValue = (
    side: "all" | keyof typeof paddingValues,
    value: number
  ) => {
    if (!handleStyleChange) return;
    const pxValue = `${Math.max(0, value)}px`;
    if (side === "all") {
      handleStyleChange({
        padding: pxValue,
        paddingTop: undefined,
        paddingRight: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
      });
    } else {
      const keyMap = {
        top: "paddingTop",
        bottom: "paddingBottom",
        left: "paddingLeft",
        right: "paddingRight",
      } as const;
      handleStyleChange({
        padding: undefined,
        [keyMap[side]]: pxValue,
      } as Partial<TextStyles>);
    }
  };

  const updateMarginValue = (
    side: "all" | keyof typeof marginValues,
    value: number
  ) => {
    if (!handleStyleChange) return;
    const pxValue = `${Math.max(0, value)}px`;
    if (side === "all") {
      handleStyleChange({
        margin: pxValue,
        marginTop: undefined,
        marginRight: undefined,
        marginBottom: undefined,
        marginLeft: undefined,
      });
    } else {
      const keyMap = {
        top: "marginTop",
        bottom: "marginBottom",
        left: "marginLeft",
        right: "marginRight",
      } as const;
      handleStyleChange({
        margin: undefined,
        [keyMap[side]]: pxValue,
      } as Partial<TextStyles>);
    }
  };

  const handlePaddingLinkToggle = (linked: boolean) => {
    setIsPaddingLinked(linked);
    if (!handleStyleChange) return;
    if (linked) {
      updatePaddingValue("all", paddingValues.top);
    } else {
      updatePaddingValue("top", paddingValues.top);
      updatePaddingValue("bottom", paddingValues.bottom);
      updatePaddingValue("left", paddingValues.left);
      updatePaddingValue("right", paddingValues.right);
    }
  };

  const handleMarginLinkToggle = (linked: boolean) => {
    setIsMarginLinked(linked);
    if (!handleStyleChange) return;
    if (linked) {
      updateMarginValue("all", marginValues.top);
    } else {
      updateMarginValue("top", marginValues.top);
      updateMarginValue("bottom", marginValues.bottom);
      updateMarginValue("left", marginValues.left);
      updateMarginValue("right", marginValues.right);
    }
  };

  const stylesContent = (
    <>
      <div className="space-y-8 text-sm text-gray-600">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            All devices
          </h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-gray-900">
                Color
              </span>
              <div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setIsBlockBackgroundPickerOpen?.(true)}
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Rounded Corners
                </span>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={isRoundedLinked}
                    onChange={(e) => setIsRoundedLinked(e.target.checked)}
                    className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded"
                  />
                  Apply to all sides
                </label>
              </div>
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 w-full">
                <Scan className="h-4 w-4 text-gray-500" />
                <input
                  type="number"
                  min={0}
                  value={borderRadiusValue}
                  onChange={(e) =>
                    handleStyleChange?.({
                      borderRadius: e.target.value
                        ? `${e.target.value}px`
                        : undefined,
                    })
                  }
                  className="flex-1 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-semibold text-gray-900">
                Border
              </span>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                value={borderStyle}
                onChange={(e) => {
                  const value = e.target.value as TextStyles["borderStyle"];
                  handleStyleChange?.({
                    borderStyle: value,
                    borderWidth:
                      value === "none" ? undefined : `${borderWidthValue}px`,
                    borderColor:
                      currentStyles?.borderColor ?? "rgba(17,24,39,1)",
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
                <div className="flex items-end gap-3">
                  <div className="flex-1">
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
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                    />
                  </div>
                  <div className="space-y-1 flex items-center gap-2">
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full border border-gray-100"
                      onClick={() => setIsBorderColorPickerOpen?.(true)}
                      aria-label="Change border color"
                      style={{
                        backgroundColor:
                          currentStyles?.borderColor || "#111827",
                      }}
                    ></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Device-specific
        </h3>
        <div className="space-y-4 border border-gray-200 rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-2xl">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Link Desktop and Mobile Styles
              </p>
              <p className="text-xs text-gray-500">
                Keep the same styles across devices.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only" defaultChecked />
              <span className="w-11 h-6 flex items-center rounded-full p-1 bg-[#3CCED7]">
                <span className="bg-white w-4 h-4 rounded-full shadow transform translate-x-5"></span>
              </span>
            </label>
          </div>

          <div className="px-4 pb-4 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Padding
                </span>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded"
                    checked={isPaddingLinked}
                    onChange={(e) => handlePaddingLinkToggle(e.target.checked)}
                  />
                  Apply to all sides
                </label>
              </div>
              {isPaddingLinked ? (
                <input
                  type="number"
                  min={0}
                  value={paddingAllValue}
                  onChange={(e) =>
                    updatePaddingValue("all", Number(e.target.value || 0))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(["top", "bottom", "left", "right"] as const).map((side) => (
                    <div key={side} className="space-y-1">
                      <span className="text-xs text-gray-500 capitalize">
                        {side}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={paddingValues[side]}
                        onChange={(e) =>
                          updatePaddingValue(side, Number(e.target.value || 0))
                        }
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Margin
                </span>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded"
                    checked={isMarginLinked}
                    onChange={(e) => handleMarginLinkToggle(e.target.checked)}
                  />
                  Apply to all sides
                </label>
              </div>
              {isMarginLinked ? (
                <input
                  type="number"
                  min={0}
                  value={marginAllValue}
                  onChange={(e) =>
                    updateMarginValue("all", Number(e.target.value || 0))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(["top", "bottom", "left", "right"] as const).map((side) => (
                    <div key={side} className="space-y-1">
                      <span className="text-xs text-gray-500 capitalize">
                        {side}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={marginValues[side]}
                        onChange={(e) =>
                          updateMarginValue(side, Number(e.target.value || 0))
                        }
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const contentContent = (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-900">
          {textInspectorTitle === "Heading" ? "Heading text" : "Text"}
        </label>
        <textarea
          placeholder={
            textInspectorTitle === "Heading"
              ? "Heading text"
              : "Enter your text here"
          }
          value={selectedBlockData?.content || ""}
          onChange={(e) => updateTextContent?.(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] min-h-[100px] resize-y"
          rows={textInspectorTitle === "Heading" ? 2 : 4}
        />
      </div>
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
        <span className="text-base font-semibold text-gray-900">
          {textInspectorTitle}
        </span>
        <button className="text-[#3CCED7] hover:text-[#1a9ba3] text-xs flex items-center gap-1">
          {/* <HelpCircle className="h-4 w-4" />
          {textInspectorHelpLabel} */}
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
          <button className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
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

export default TextInspector;
