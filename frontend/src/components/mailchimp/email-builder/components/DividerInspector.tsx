"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, HelpCircle, ChevronRight } from "lucide-react";
import { CanvasBlock, BlockBoxStyles } from "../types";

interface DividerInspectorProps {
  selectedBlockData: CanvasBlock | null;
  activeBlockTab: "Content" | "Styles";
  setActiveBlockTab: (tab: "Content" | "Styles") => void;
  setSelectedBlock: (block: { section: string; id: string } | null) => void;
  updateDividerSettings: (updates: Partial<CanvasBlock>) => void;
  setIsDividerBlockBackgroundPickerOpen?: (open: boolean) => void;
  setIsDividerLineColorPickerOpen?: (open: boolean) => void;
}

const DividerInspector: React.FC<DividerInspectorProps> = ({
  selectedBlockData,
  activeBlockTab,
  setActiveBlockTab,
  setSelectedBlock,
  updateDividerSettings,
  setIsDividerBlockBackgroundPickerOpen,
  setIsDividerLineColorPickerOpen,
}) => {
  const [linkDeviceStyles, setLinkDeviceStyles] = useState(true);
  const [isPaddingLinked, setIsPaddingLinked] = useState(false);
  const [paddingValues, setPaddingValues] = useState({
    top: 20,
    bottom: 20,
    left: 24,
    right: 24,
  });

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

  const dividerStyle = selectedBlockData?.dividerStyle || "solid";
  const dividerLineColor = selectedBlockData?.dividerLineColor || "#000000";
  const dividerThickness = parseNumeric(selectedBlockData?.dividerThickness, 2);
  const blockBackgroundColor =
    selectedBlockData?.dividerBlockStyles?.backgroundColor || "transparent";

  const cleanStyles = (styles: BlockBoxStyles) => {
    const cleaned = { ...styles };
    (Object.keys(cleaned) as (keyof BlockBoxStyles)[]).forEach((key) => {
      if (
        cleaned[key] === undefined ||
        cleaned[key] === null ||
        cleaned[key] === ""
      ) {
        delete cleaned[key];
      }
    });
    return cleaned;
  };

  const updateBlockStyles = useCallback(
    (updates: Partial<BlockBoxStyles>) => {
      if (!selectedBlockData) return;
      const current = selectedBlockData.dividerBlockStyles || {};
      const merged = { ...current, ...updates };

      if (updates.padding !== undefined) {
        delete merged.paddingTop;
        delete merged.paddingRight;
        delete merged.paddingBottom;
        delete merged.paddingLeft;
      }

      if (
        updates.padding === undefined &&
        (updates.paddingTop !== undefined ||
          updates.paddingRight !== undefined ||
          updates.paddingBottom !== undefined ||
          updates.paddingLeft !== undefined)
      ) {
        delete merged.padding;
      }

      updateDividerSettings({
        dividerBlockStyles: cleanStyles(merged),
      });
    },
    [selectedBlockData, updateDividerSettings]
  );

  useEffect(() => {
    if (!selectedBlockData) return;
    const blockId = selectedBlockData.id || "";
    const blockStyles = selectedBlockData.dividerBlockStyles || {};
    const hasPadding =
      blockStyles.padding !== undefined ||
      blockStyles.paddingTop !== undefined ||
      blockStyles.paddingRight !== undefined ||
      blockStyles.paddingBottom !== undefined ||
      blockStyles.paddingLeft !== undefined;

    if (!hasPadding && !paddingInitializedRef.current.has(blockId)) {
      paddingInitializedRef.current.add(blockId);
      updateBlockStyles({
        padding: undefined,
        paddingTop: "20px",
        paddingBottom: "20px",
        paddingLeft: "24px",
        paddingRight: "24px",
      });
      setIsPaddingLinked(false);
      setPaddingValues({
        top: 20,
        bottom: 20,
        left: 24,
        right: 24,
      });
    } else {
      const linkable =
        blockStyles.padding !== undefined &&
        blockStyles.paddingTop === undefined &&
        blockStyles.paddingRight === undefined &&
        blockStyles.paddingBottom === undefined &&
        blockStyles.paddingLeft === undefined;
      setIsPaddingLinked(linkable);
      const basePadding = linkable
        ? parseFloat(getPxValue(blockStyles.padding) || "20") || 20
        : undefined;
      setPaddingValues({
        top:
          parseFloat(getPxValue(blockStyles.paddingTop) || "") ||
          basePadding ||
          20,
        bottom:
          parseFloat(getPxValue(blockStyles.paddingBottom) || "") ||
          basePadding ||
          20,
        left:
          parseFloat(getPxValue(blockStyles.paddingLeft) || "") ||
          basePadding ||
          24,
        right:
          parseFloat(getPxValue(blockStyles.paddingRight) || "") ||
          basePadding ||
          24,
      });
    }
  }, [selectedBlockData, updateBlockStyles]);

  const handlePaddingChange = (
    side: keyof typeof paddingValues,
    value: number
  ) => {
    const next = Math.max(0, value);
    setPaddingValues((prev) => ({ ...prev, [side]: next }));
    if (isPaddingLinked) {
      updateBlockStyles({
        padding: `${next}px`,
        paddingTop: undefined,
        paddingRight: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
      });
    } else {
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

  const handleTogglePaddingLink = (linked: boolean) => {
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

  const handleThicknessChange = (value: number) => {
    updateDividerSettings({
      dividerThickness: `${Math.max(1, Math.min(20, value))}px`,
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
                Style
              </span>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                value={dividerStyle}
                onChange={(e) =>
                  updateDividerSettings({
                    dividerStyle: e.target.value as
                      | "solid"
                      | "dashed"
                      | "dotted"
                      | "double",
                  })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="double">Double</option>
              </select>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-semibold text-gray-900">
                Colors
              </span>
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => setIsDividerLineColorPickerOpen?.(true)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
                >
                  <span>Divider Line</span>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full border border-gray-200"
                      style={{
                        backgroundColor: dividerLineColor,
                      }}
                    />
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDividerBlockBackgroundPickerOpen?.(true)}
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
                  Thickness
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={dividerThickness}
                    onChange={(e) =>
                      handleThicknessChange(Number(e.target.value))
                    }
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 min-w-[40px] text-right">
                    {dividerThickness}px
                  </span>
                </div>
              </div>

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
                        handleTogglePaddingLink(e.target.checked)
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
                      handlePaddingChange("top", Number(e.target.value || 0))
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
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const contentContent = (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Divider blocks don&apos;t have content settings.
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
        <span className="text-base font-semibold text-gray-900">Divider</span>
        <button className="text-[#3CCED7] hover:text-[#1a9ba3] text-xs flex items-center gap-1">
          {/* <HelpCircle className="h-4 w-4" />
          How to use divider blocks */}
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
              updateDividerSettings({
                dividerStyle: "solid",
                dividerLineColor: "#000000",
                dividerThickness: "2px",
                dividerBlockStyles: {
                  paddingTop: "20px",
                  paddingBottom: "20px",
                  paddingLeft: "24px",
                  paddingRight: "24px",
                },
              });
              setPaddingValues({
                top: 20,
                bottom: 20,
                left: 24,
                right: 24,
              });
              setIsPaddingLinked(false);
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

export default DividerInspector;
