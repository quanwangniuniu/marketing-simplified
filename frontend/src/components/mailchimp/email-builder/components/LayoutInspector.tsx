"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { CanvasBlock, BlockBoxStyles } from "../types";

interface LayoutInspectorProps {
  selectedBlockData: CanvasBlock | null;
  activeBlockTab: "Content" | "Styles";
  setActiveBlockTab: (tab: "Content" | "Styles") => void;
  setSelectedBlock: (block: { section: string; id: string } | null) => void;
  updateLayoutSettings: (updates: Partial<CanvasBlock>) => void;
  setIsLayoutBlockBackgroundPickerOpen?: (open: boolean) => void;
  updateLayoutColumns?: (columns: number) => void;
}

const LayoutInspector: React.FC<LayoutInspectorProps> = ({
  selectedBlockData,
  activeBlockTab,
  setActiveBlockTab,
  setSelectedBlock,
  updateLayoutSettings,
  setIsLayoutBlockBackgroundPickerOpen,
  updateLayoutColumns,
}) => {
  const [linkDeviceStyles, setLinkDeviceStyles] = useState(true);
  const [isRoundedCornersLinked, setIsRoundedCornersLinked] = useState(true);
  const [roundedCornersValue, setRoundedCornersValue] = useState(0);
  const [isPaddingLinked, setIsPaddingLinked] = useState(false);
  const [isMarginLinked, setIsMarginLinked] = useState(true);
  const [paddingValues, setPaddingValues] = useState({
    top: 12,
    bottom: 12,
    left: 0,
    right: 0,
  });
  const [marginValues, setMarginValues] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });
  const borderColorInputRef = useRef<HTMLInputElement>(null);
  const paddingInitializedRef = useRef<Set<string>>(new Set());

  const getPxValue = (value?: string | number) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "number") return value.toString();
    return value.replace(/px$/, "");
  };

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
    selectedBlockData?.layoutBlockStyles?.backgroundColor || "transparent";
  const borderStyle =
    selectedBlockData?.layoutBlockStyles?.borderStyle || "none";
  const borderWidthValue = getPxValue(
    selectedBlockData?.layoutBlockStyles?.borderWidth
  );
  const borderColor =
    selectedBlockData?.layoutBlockStyles?.borderColor || "#111827";
  const borderRadius = parseNumeric(
    selectedBlockData?.layoutBlockStyles?.borderRadius,
    0
  );
  const columns = selectedBlockData?.columns || 1;
  const columnRatio = selectedBlockData?.columnRatio || "Equal";
  const mobileContentOrientation =
    selectedBlockData?.mobileContentOrientation || "Stack left";

  useEffect(() => {
    setRoundedCornersValue(borderRadius);
  }, [borderRadius]);

  useEffect(() => {
    if (!selectedBlockData) return;
    const blockId = selectedBlockData.id || "";
    const blockStyles = selectedBlockData.layoutBlockStyles || {};

    // Initialize padding values
    const hasPadding =
      blockStyles.padding !== undefined ||
      blockStyles.paddingTop !== undefined ||
      blockStyles.paddingRight !== undefined ||
      blockStyles.paddingBottom !== undefined ||
      blockStyles.paddingLeft !== undefined;

    if (!hasPadding && !paddingInitializedRef.current.has(blockId)) {
      paddingInitializedRef.current.add(blockId);
      setIsPaddingLinked(false);
      setPaddingValues({ top: 12, bottom: 12, left: 0, right: 0 });
    } else {
      const linkable =
        blockStyles.padding !== undefined &&
        blockStyles.paddingTop === undefined &&
        blockStyles.paddingRight === undefined &&
        blockStyles.paddingBottom === undefined &&
        blockStyles.paddingLeft === undefined;
      setIsPaddingLinked(linkable);
      const basePadding = linkable
        ? parseNumeric(blockStyles.padding, 12)
        : undefined;
      setPaddingValues({
        top: parseNumeric(blockStyles.paddingTop, basePadding || 12),
        bottom: parseNumeric(blockStyles.paddingBottom, basePadding || 12),
        left: parseNumeric(blockStyles.paddingLeft, basePadding || 0),
        right: parseNumeric(blockStyles.paddingRight, basePadding || 0),
      });
    }

    // Initialize margin values
    const hasMargin =
      blockStyles.margin !== undefined ||
      blockStyles.marginTop !== undefined ||
      blockStyles.marginRight !== undefined ||
      blockStyles.marginBottom !== undefined ||
      blockStyles.marginLeft !== undefined;

    if (!hasMargin && !paddingInitializedRef.current.has(blockId)) {
      setIsMarginLinked(true);
      setMarginValues({ top: 0, bottom: 0, left: 0, right: 0 });
    } else {
      const linkable =
        blockStyles.margin !== undefined &&
        blockStyles.marginTop === undefined &&
        blockStyles.marginRight === undefined &&
        blockStyles.marginBottom === undefined &&
        blockStyles.marginLeft === undefined;
      setIsMarginLinked(linkable);
      const baseMargin = linkable
        ? parseNumeric(blockStyles.margin, 0)
        : undefined;
      setMarginValues({
        top: parseNumeric(blockStyles.marginTop, baseMargin || 0),
        bottom: parseNumeric(blockStyles.marginBottom, baseMargin || 0),
        left: parseNumeric(blockStyles.marginLeft, baseMargin || 0),
        right: parseNumeric(blockStyles.marginRight, baseMargin || 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockData?.id, selectedBlockData?.layoutBlockStyles]);

  const updateBlockStyles = (updates: Partial<BlockBoxStyles>) => {
    if (!selectedBlockData) return;
    const current = selectedBlockData.layoutBlockStyles || {};
    const merged = { ...current, ...updates };

    // Remove undefined values
    Object.keys(merged).forEach((key) => {
      if (merged[key as keyof BlockBoxStyles] === undefined) {
        delete merged[key as keyof BlockBoxStyles];
      }
    });

    updateLayoutSettings({
      layoutBlockStyles: merged,
    });
  };

  const handleRoundedCornersChange = (value: number) => {
    const next = Math.max(0, value);
    setRoundedCornersValue(next);
    if (isRoundedCornersLinked) {
      updateBlockStyles({
        borderRadius: `${next}px`,
      });
    } else {
      // For individual corners, we'd need separate properties
      // For now, we'll just use borderRadius for all
      updateBlockStyles({
        borderRadius: `${next}px`,
      });
    }
  };

  const handleToggleRoundedCornersLink = (linked: boolean) => {
    setIsRoundedCornersLinked(linked);
    if (linked) {
      updateBlockStyles({
        borderRadius: `${roundedCornersValue}px`,
      });
    } else {
      // When unlinking, keep the same value but allow individual control
      updateBlockStyles({
        borderRadius: `${roundedCornersValue}px`,
      });
    }
  };

  const handleColumnsChange = (newColumns: number) => {
    if (updateLayoutColumns) {
      updateLayoutColumns(newColumns);
    } else {
      updateLayoutSettings({ columns: newColumns });
    }
  };

  const handlePaddingChange = (
    side: "all" | keyof typeof paddingValues,
    value: number
  ) => {
    const next = Math.max(0, value);
    if (side === "all") {
      setPaddingValues({ top: next, bottom: next, left: next, right: next });
      updateBlockStyles({
        padding: `${next}px`,
        paddingTop: undefined,
        paddingRight: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
      });
    } else {
      setPaddingValues((prev) => ({ ...prev, [side]: next }));
      const keyMap: Record<keyof typeof paddingValues, keyof BlockBoxStyles> = {
        top: "paddingTop",
        bottom: "paddingBottom",
        left: "paddingLeft",
        right: "paddingRight",
      };
      updateBlockStyles({
        padding: undefined,
        [keyMap[side]]: `${next}px`,
      });
    }
  };

  const handlePaddingLinkToggle = (linked: boolean) => {
    setIsPaddingLinked(linked);
    if (linked) {
      const average = paddingValues.top;
      updateBlockStyles({
        padding: `${average}px`,
        paddingTop: undefined,
        paddingRight: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
      });
      setPaddingValues({
        top: average,
        bottom: average,
        left: average,
        right: average,
      });
    } else {
      updateBlockStyles({
        padding: undefined,
        paddingTop: `${paddingValues.top}px`,
        paddingRight: `${paddingValues.right}px`,
        paddingBottom: `${paddingValues.bottom}px`,
        paddingLeft: `${paddingValues.left}px`,
      });
    }
  };

  const handleMarginChange = (
    side: keyof typeof marginValues,
    value: number
  ) => {
    const next = Math.max(0, value);
    setMarginValues((prev) => ({ ...prev, [side]: next }));
    if (isMarginLinked) {
      updateBlockStyles({
        margin: `${next}px`,
        marginTop: undefined,
        marginRight: undefined,
        marginBottom: undefined,
        marginLeft: undefined,
      });
    } else {
      const keyMap: Record<keyof typeof marginValues, keyof BlockBoxStyles> = {
        top: "marginTop",
        bottom: "marginBottom",
        left: "marginLeft",
        right: "marginRight",
      };
      updateBlockStyles({
        margin: undefined,
        [keyMap[side]]: `${next}px`,
      });
    }
  };

  const handleToggleMarginLink = (linked: boolean) => {
    setIsMarginLinked(linked);
    if (linked) {
      const average = marginValues.top;
      updateBlockStyles({
        margin: `${average}px`,
        marginTop: undefined,
        marginRight: undefined,
        marginBottom: undefined,
        marginLeft: undefined,
      });
      setMarginValues({
        top: average,
        bottom: average,
        left: average,
        right: average,
      });
    } else {
      updateBlockStyles({
        margin: undefined,
        marginTop: `${marginValues.top}px`,
        marginRight: `${marginValues.right}px`,
        marginBottom: `${marginValues.bottom}px`,
        marginLeft: `${marginValues.left}px`,
      });
    }
  };

  const stylesContent = (
    <>
      <div className="space-y-8 text-sm text-gray-600">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            ALL DEVICES
          </h3>
          <div className="space-y-6">
            {/* Color */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Color
              </label>
              <button
                type="button"
                onClick={() => setIsLayoutBlockBackgroundPickerOpen?.(true)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
              >
                <span>Layout Background</span>
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

            {/* Border */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Border
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
                        borderWidth: borderWidthValue
                          ? `${borderWidthValue}px`
                          : "1px",
                      });
                    }
                  }}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent appearance-none bg-white"
                >
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="double">Double</option>
                </select>
                <ChevronDown className="h-4 w-4 text-gray-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              {borderStyle !== "none" && (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      min={0}
                      value={borderWidthValue || "1"}
                      onChange={(e) =>
                        updateBlockStyles({
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
                      onClick={() => borderColorInputRef.current?.click()}
                      className="w-10 h-10 rounded-full border border-gray-100"
                      style={{ backgroundColor: borderColor }}
                      aria-label="Change border color"
                    ></button>
                    <input
                      ref={borderColorInputRef}
                      type="color"
                      value={borderColor}
                      onChange={(e) =>
                        updateBlockStyles({
                          borderColor: e.target.value,
                        })
                      }
                      className="hidden"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Rounded Corners */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-900">
                  Rounded Corners
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded"
                    checked={isRoundedCornersLinked}
                    onChange={(e) =>
                      handleToggleRoundedCornersLink(e.target.checked)
                    }
                  />
                  Apply to all sides
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-600"
                  aria-label="Individual corners"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4zm12 0h4v4h-4v-4z"
                    />
                  </svg>
                </button>
                <input
                  type="number"
                  min={0}
                  value={roundedCornersValue}
                  onChange={(e) =>
                    handleRoundedCornersChange(Number(e.target.value || 0))
                  }
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                />
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() =>
                      handleRoundedCornersChange(roundedCornersValue + 1)
                    }
                    className="p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Increase"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleRoundedCornersChange(
                        Math.max(0, roundedCornersValue - 1)
                      )
                    }
                    className="p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Decrease"
                  >
                    <svg
                      className="w-3 h-3"
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
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            DEVICE-SPECIFIC
          </h3>

          <div className="px-4 py-4 space-y-5">
            {/* Number of columns */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Number of columns
              </label>
              <div className="grid grid-cols-4 border border-gray-200 rounded-lg overflow-hidden">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleColumnsChange(num)}
                    className={`py-2 text-sm font-medium ${
                      columns === num
                        ? "bg-white text-gray-900"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop column ratio */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Desktop column ratio
              </label>
              <div className="relative">
                <select
                  value={columnRatio}
                  onChange={(e) =>
                    updateLayoutSettings({
                      columnRatio: e.target.value as
                        | "Equal"
                        | "Wide left"
                        | "Wide right"
                        | "Narrow center",
                    })
                  }
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent appearance-none bg-white"
                >
                  <option value="Equal">Equal</option>
                  <option value="Wide left">Wide left</option>
                  <option value="Wide right">Wide right</option>
                  <option value="Narrow center">Narrow center</option>
                </select>
                <ChevronDown className="h-4 w-4 text-gray-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Mobile content orientation */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Mobile content orientation
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateLayoutSettings({
                      mobileContentOrientation: "Stack left",
                    })
                  }
                  className={`flex-1 border-2 rounded-lg px-4 py-3 flex items-center justify-center transition ${
                    mobileContentOrientation === "Stack left"
                      ? "border-[#2AB5BD] bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <svg
                    className="w-5 h-5 text-gray-900"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {/* Two squares */}
                    <rect
                      x="3"
                      y="3"
                      width="6"
                      height="6"
                      strokeWidth={1.5}
                      fill="none"
                    />
                    <rect
                      x="3"
                      y="13"
                      width="6"
                      height="6"
                      strokeWidth={1.5}
                      fill="none"
                    />
                    {/* Left arrow */}
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11 6l-3 3 3 3"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateLayoutSettings({
                      mobileContentOrientation: "Stack right",
                    })
                  }
                  className={`flex-1 border-2 rounded-lg px-4 py-3 flex items-center justify-center transition ${
                    mobileContentOrientation === "Stack right"
                      ? "border-[#2AB5BD] bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <svg
                    className="w-5 h-5 text-gray-900"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {/* Two squares */}
                    <rect
                      x="15"
                      y="3"
                      width="6"
                      height="6"
                      strokeWidth={1.5}
                      fill="none"
                    />
                    <rect
                      x="15"
                      y="13"
                      width="6"
                      height="6"
                      strokeWidth={1.5}
                      fill="none"
                    />
                    {/* Right arrow */}
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 6l3 3-3 3"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateLayoutSettings({
                      mobileContentOrientation: "Stack center",
                    })
                  }
                  className={`flex-1 border-2 rounded-lg px-4 py-3 flex items-center justify-center transition ${
                    mobileContentOrientation === "Stack center"
                      ? "border-[#2AB5BD] bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <svg
                    className="w-5 h-5 text-gray-900"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {/* Two solid squares */}
                    <rect
                      x="3"
                      y="3"
                      width="6"
                      height="6"
                      strokeWidth={1.5}
                      fill="currentColor"
                    />
                    <rect
                      x="3"
                      y="13"
                      width="6"
                      height="6"
                      strokeWidth={1.5}
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
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

            <div className="px-4 pb-4 space-y-6">
              {/* Padding Section */}
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
                      onChange={(e) =>
                        handlePaddingLinkToggle(e.target.checked)
                      }
                    />
                    Apply to all sides
                  </label>
                </div>
                {isPaddingLinked ? (
                  <input
                    type="number"
                    min={0}
                    value={paddingValues.top}
                    onChange={(e) =>
                      handlePaddingChange("all", Number(e.target.value || 0))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(["top", "bottom", "left", "right"] as const).map(
                      (side) => (
                        <div key={side} className="space-y-1">
                          <span className="text-xs text-gray-500 capitalize">
                            {side}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={paddingValues[side]}
                            onChange={(e) =>
                              handlePaddingChange(
                                side,
                                Number(e.target.value || 0)
                              )
                            }
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
                          />
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Margin Section */}
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
                      onChange={(e) => handleToggleMarginLink(e.target.checked)}
                    />
                    Apply to all sides
                  </label>
                </div>
                {isMarginLinked ? (
                  <input
                    type="number"
                    min={0}
                    value={marginValues.top}
                    onChange={(e) =>
                      handleMarginChange("top", Number(e.target.value || 0))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(["top", "bottom", "left", "right"] as const).map(
                      (side) => (
                        <div key={side} className="space-y-1">
                          <span className="text-xs text-gray-500 capitalize">
                            {side}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={marginValues[side]}
                            onChange={(e) =>
                              handleMarginChange(
                                side,
                                Number(e.target.value || 0)
                              )
                            }
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
                          />
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const contentContent = (
    <div className="space-y-6 text-sm text-gray-600">
      <p>Layout content settings will appear here.</p>
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
        <span className="text-base font-semibold text-gray-900">Layout</span>
        <button className="text-[#3CCED7] hover:text-[#1a9ba3] text-xs flex items-center gap-1">
          {/* <HelpCircle className="h-4 w-4" />
          <span>How to use layout blocks</span> */}
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
              updateLayoutSettings({
                layoutBlockStyles: {},
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

export default LayoutInspector;
