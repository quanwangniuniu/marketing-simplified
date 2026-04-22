"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ChevronLeft,
  HelpCircle,
  ChevronDown,
  Image as ImageIcon,
  Info,
  ChevronRight,
  Scan,
  Crop,
  Trash2,
} from "lucide-react";
import {
  BlockBoxStyles,
  CanvasBlock,
  ImageLinkType,
  ImageSizeMode,
} from "../types";

interface ImageInspectorProps {
  selectedBlockData: CanvasBlock | null;
  activeBlockTab: "Content" | "Styles";
  setActiveBlockTab: (tab: "Content" | "Styles") => void;
  setSelectedBlock: (block: { section: string; id: string } | null) => void;
  setIsContentStudioOpen: (open: boolean) => void;
  setIsAddImageDropdownOpen: (open: boolean) => void;
  isAddImageDropdownOpen: boolean;
  addImageDropdownRef: React.RefObject<HTMLDivElement>;
  updateImageSettings: (updates: Partial<CanvasBlock>) => void;
  setIsImageBlockBackgroundPickerOpen?: (open: boolean) => void;
}

const ImageInspector: React.FC<ImageInspectorProps> = ({
  selectedBlockData,
  activeBlockTab,
  setActiveBlockTab,
  setSelectedBlock,
  setIsContentStudioOpen,
  setIsAddImageDropdownOpen,
  isAddImageDropdownOpen,
  addImageDropdownRef,
  updateImageSettings,
  setIsImageBlockBackgroundPickerOpen,
}) => {
  const sizeOptions: ImageSizeMode[] = ["Original", "Fill", "Scale"];
  const linkOptions: ImageLinkType[] = ["Web", "Email", "Phone"];

  const currentSize = selectedBlockData?.imageDisplayMode || "Original";
  const currentLinkType = selectedBlockData?.imageLinkType || "Web";
  const currentLinkValue = selectedBlockData?.imageLinkValue || "";
  const openInNewTab = selectedBlockData?.imageOpenInNewTab ?? true;
  const altText = selectedBlockData?.imageAltText || "";
  const scalePercent = Math.min(
    100,
    Math.max(10, selectedBlockData?.imageScalePercent ?? 85)
  );

  const linkPlaceholders: Record<ImageLinkType, string> = {
    Web: "https://example.com",
    Email: "name@example.com",
    Phone: "+1 (555) 123-4567",
  };

  const handleUpdate = (updates: Partial<CanvasBlock>) => {
    if (!selectedBlockData) return;
    updateImageSettings(updates);
  };

  const [isRoundedLinked, setIsRoundedLinked] = useState(true);
  const [linkDeviceStyles, setLinkDeviceStyles] = useState(true);
  const [isPaddingLinked, setIsPaddingLinked] = useState(false);
  const [paddingValues, setPaddingValues] = useState({
    top: 12,
    bottom: 12,
    left: 24,
    right: 24,
  });
  const [isMarginLinked, setIsMarginLinked] = useState(true);
  const [marginValues, setMarginValues] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });
  const [isReplaceDropdownOpen, setIsReplaceDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const paddingInitializedRef = useRef<Set<string>>(new Set());
  const replaceDropdownRef = useRef<HTMLDivElement>(null);
  const portalDropdownRef = useRef<HTMLDivElement | null>(null);

  // Callback ref to ensure portal dropdown ref is set
  const setPortalDropdownRef = (element: HTMLDivElement | null) => {
    portalDropdownRef.current = element;
  };

  // Calculate dropdown position
  const calculateDropdownPosition = (buttonElement: HTMLElement | null) => {
    if (!buttonElement) return null;
    const rect = buttonElement.getBoundingClientRect();
    return {
      top: rect.bottom + 8, // mt-2 = 8px
      left: rect.left,
      width: Math.max(rect.width, 240), // min-w-[240px]
    };
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    if (!isReplaceDropdownOpen && !isAddImageDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is inside the portal dropdown menu
      const isInsidePortal =
        portalDropdownRef.current && portalDropdownRef.current.contains(target);

      // Check if click is inside the button container
      const isInsideReplaceButton =
        replaceDropdownRef.current &&
        replaceDropdownRef.current.contains(target);
      const isInsideAddButton =
        addImageDropdownRef.current &&
        addImageDropdownRef.current.contains(target);

      // Don't close if clicking inside portal menu or button
      if (isInsidePortal || isInsideReplaceButton || isInsideAddButton) {
        return;
      }

      // Close dropdowns if clicking outside
      if (isReplaceDropdownOpen) {
        setIsReplaceDropdownOpen(false);
      }
      if (isAddImageDropdownOpen) {
        setIsAddImageDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isReplaceDropdownOpen, isAddImageDropdownOpen]);

  // Update dropdown position when opened
  useEffect(() => {
    if (isReplaceDropdownOpen && replaceDropdownRef.current) {
      const position = calculateDropdownPosition(replaceDropdownRef.current);
      setDropdownPosition(position);
    } else if (isAddImageDropdownOpen && addImageDropdownRef.current) {
      const position = calculateDropdownPosition(addImageDropdownRef.current);
      setDropdownPosition(position);
    } else {
      setDropdownPosition(null);
    }
  }, [isReplaceDropdownOpen, isAddImageDropdownOpen]);

  const getPxValue = (value?: string | number) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "number") return value.toString();
    return value.replace(/px$/, "");
  };

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

  const updateBlockStyles = (updates: Partial<BlockBoxStyles>) => {
    if (!selectedBlockData) return;
    const current = selectedBlockData.imageBlockStyles || {};
    // 创建一个新对象，先应用更新
    const merged = { ...current, ...updates };

    // 如果设置了统一的 padding，明确删除所有独立的 padding 属性
    if (updates.padding !== undefined) {
      delete merged.paddingTop;
      delete merged.paddingRight;
      delete merged.paddingBottom;
      delete merged.paddingLeft;
    }

    // 如果设置了任何独立的 padding 属性，且 padding 被设为 undefined，删除统一的 padding
    if (
      updates.padding === undefined &&
      (updates.paddingTop !== undefined ||
        updates.paddingRight !== undefined ||
        updates.paddingBottom !== undefined ||
        updates.paddingLeft !== undefined)
    ) {
      delete merged.padding;
    }

    handleUpdate({
      imageBlockStyles: cleanStyles(merged),
    });
  };

  const updateFrameStyles = (updates: Partial<BlockBoxStyles>) => {
    if (!selectedBlockData) return;
    const current = selectedBlockData.imageFrameStyles || {};
    handleUpdate({
      imageFrameStyles: cleanStyles({
        ...current,
        ...updates,
      }),
    });
  };

  useEffect(() => {
    if (!selectedBlockData) return;
    const blockId = selectedBlockData.id || "";
    const blockStyles = selectedBlockData.imageBlockStyles || {};
    const hasPadding =
      blockStyles.padding !== undefined ||
      blockStyles.paddingTop !== undefined ||
      blockStyles.paddingRight !== undefined ||
      blockStyles.paddingBottom !== undefined ||
      blockStyles.paddingLeft !== undefined;

    // 如果没有padding设置且尚未初始化，应用默认padding（上下12，左右24，不linked）
    if (!hasPadding && !paddingInitializedRef.current.has(blockId)) {
      paddingInitializedRef.current.add(blockId);
      updateBlockStyles({
        padding: undefined,
        paddingTop: "12px",
        paddingBottom: "12px",
        paddingLeft: "24px",
        paddingRight: "24px",
      });
      setIsPaddingLinked(false);
      setPaddingValues({
        top: 12,
        bottom: 12,
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
        ? parseFloat(getPxValue(blockStyles.padding) || "12") || 12
        : undefined;
      setPaddingValues({
        top:
          parseFloat(getPxValue(blockStyles.paddingTop) || "") ||
          basePadding ||
          12,
        bottom:
          parseFloat(getPxValue(blockStyles.paddingBottom) || "") ||
          basePadding ||
          12,
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
    const blockStylesForMargin = selectedBlockData.imageBlockStyles || {};
    const marginLinkable =
      blockStylesForMargin.margin !== undefined &&
      blockStylesForMargin.marginTop === undefined &&
      blockStylesForMargin.marginRight === undefined &&
      blockStylesForMargin.marginBottom === undefined &&
      blockStylesForMargin.marginLeft === undefined;
    setIsMarginLinked(marginLinkable);
    const baseMargin = marginLinkable
      ? parseFloat(getPxValue(blockStylesForMargin.margin) || "0") || 0
      : undefined;
    setMarginValues({
      top:
        parseFloat(getPxValue(blockStylesForMargin.marginTop) || "") ||
        baseMargin ||
        0,
      bottom:
        parseFloat(getPxValue(blockStylesForMargin.marginBottom) || "") ||
        baseMargin ||
        0,
      left:
        parseFloat(getPxValue(blockStylesForMargin.marginLeft) || "") ||
        baseMargin ||
        0,
      right:
        parseFloat(getPxValue(blockStylesForMargin.marginRight) || "") ||
        baseMargin ||
        0,
    });
  }, [selectedBlockData]);

  const blockBackgroundColor =
    selectedBlockData?.imageBlockStyles?.backgroundColor || "";
  const blockBackgroundInputRef = useRef<HTMLInputElement>(null);
  const borderColorInputRef = useRef<HTMLInputElement>(null);
  const borderRadiusValue = getPxValue(
    selectedBlockData?.imageFrameStyles?.borderRadius
  );
  const borderStyle =
    selectedBlockData?.imageFrameStyles?.borderStyle || "none";
  const borderWidthValue = getPxValue(
    selectedBlockData?.imageFrameStyles?.borderWidth
  );
  const borderColor =
    selectedBlockData?.imageFrameStyles?.borderColor || "#111827";
  const alignment = selectedBlockData?.imageAlignment || "center";

  const handleClearStyles = () => {
    updateBlockStyles({});
    updateFrameStyles({});
    handleUpdate({ imageAlignment: "center" });
    setPaddingValues({
      top: 12,
      bottom: 12,
      left: 24,
      right: 24,
    });
    setIsPaddingLinked(false);
    setMarginValues({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
    setIsMarginLinked(true);
  };

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
      const avg = marginValues.top;
      updateBlockStyles({
        margin: `${avg}px`,
        marginTop: undefined,
        marginRight: undefined,
        marginBottom: undefined,
        marginLeft: undefined,
      });
      setMarginValues({
        top: avg,
        bottom: avg,
        left: avg,
        right: avg,
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
        <span className="text-base font-semibold text-gray-900">Image</span>
        <button className="text-[#3CCED7] hover:text-[#1a9ba3] text-xs flex items-center gap-1">
          {/* <HelpCircle className="h-4 w-4" />
          How to use image blocks */}
        </button>
      </div>

      <div className="flex border-b border-gray-200">
        {(["Content", "Styles"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveBlockTab(tab)}
            className={`flex-1 text-sm font-medium py-3 ${
              activeBlockTab === tab
                ? "text-[#1a9ba3] border-b-2 border-[#2AB5BD]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {activeBlockTab === "Content" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <span className="block text-xs font-medium text-gray-600">
                Image
              </span>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="border border-gray-200 rounded-xl bg-gray-50 h-24 flex items-center justify-center w-full overflow-hidden relative">
                  {selectedBlockData?.imageUrl ? (
                    <Image
                      src={selectedBlockData.imageUrl}
                      alt="Selected image"
                      fill
                      className="object-cover w-full"
                      unoptimized
                      onError={() => {
                        // Fallback handled by CSS
                      }}
                    />
                  ) : (
                    <div className="text-center text-sm text-gray-500">
                      <div className="h-12 w-12 mx-auto border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
                {selectedBlockData?.imageUrl ? (
                  <div className="flex items-center gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        handleUpdate({ imageUrl: undefined });
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors "
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                    <div className="relative flex-1" ref={replaceDropdownRef}>
                      <button
                        type="button"
                        onClick={() =>
                          setIsReplaceDropdownOpen(!isReplaceDropdownOpen)
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[#3CCED7] text-sm font-medium hover:bg-[#3CCED7]/10 transition-colors justify-center"
                      >
                        Replace
                        <ChevronDown className="h-4 w-4" />
                      </button>

                      {/* Replace Dropdown Menu - rendered via portal */}
                      {isReplaceDropdownOpen &&
                        dropdownPosition &&
                        createPortal(
                          <div
                            ref={setPortalDropdownRef}
                            className="fixed bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-[9999]"
                            style={{
                              top: `${dropdownPosition.top}px`,
                              left: `${dropdownPosition.left}px`,
                              width: `${dropdownPosition.width}px`,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Open ContentStudio on mousedown (before click outside handler)
                                setIsContentStudioOpen(true);
                                // Close dropdown
                                setIsReplaceDropdownOpen(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                Upload Image
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Anyone with the link can access uploaded files.
                              </div>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Open ContentStudio on mousedown (before click outside handler)
                                setIsContentStudioOpen(true);
                                // Close dropdown
                                setIsReplaceDropdownOpen(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-200"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                Browse Images
                              </div>
                            </button>
                          </div>,
                          document.body
                        )}
                    </div>
                  </div>
                ) : (
                  <div className="relative" ref={addImageDropdownRef}>
                    <button
                      onClick={() =>
                        setIsAddImageDropdownOpen(!isAddImageDropdownOpen)
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#3CCED7] text-white rounded-lg text-sm font-medium hover:bg-[#2AB5BD] transition-colors"
                    >
                      Add
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {/* Dropdown Menu - rendered via portal */}
                    {isAddImageDropdownOpen &&
                      dropdownPosition &&
                      createPortal(
                        <div
                          ref={setPortalDropdownRef}
                          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-[9999]"
                          style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            width: `${dropdownPosition.width}px`,
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Open ContentStudio on mousedown (before click outside handler)
                              setIsContentStudioOpen(true);
                              // Close dropdown
                              setIsAddImageDropdownOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="text-sm font-medium text-gray-900">
                              Upload Image
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Anyone with the link can access uploaded files.
                            </div>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Open ContentStudio on mousedown (before click outside handler)
                              setIsContentStudioOpen(true);
                              // Close dropdown
                              setIsAddImageDropdownOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-200"
                          >
                            <div className="text-sm font-medium text-gray-900">
                              Browse Images
                            </div>
                          </button>
                        </div>,
                        document.body
                      )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-semibold text-gray-900">
                  Size
                </span>
                <div className="grid grid-cols-3 bg-gray-100 rounded-lg p-1 text-sm font-medium text-gray-700">
                  {sizeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        handleUpdate({
                          imageDisplayMode: option,
                        })
                      }
                      className={`py-2 rounded-md ${
                        option === currentSize
                          ? "bg-white shadow text-gray-900"
                          : "hover:bg-gray-200 text-gray-600"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {currentSize === "Scale" && (
                  <div className="bg-gray-100 rounded-lg px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                      <span>Scale</span>
                      <span>{scalePercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={scalePercent}
                      onChange={(e) =>
                        handleUpdate({
                          imageScalePercent: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Link to
              </label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                value={currentLinkType}
                onChange={(e) =>
                  handleUpdate({
                    imageLinkType: e.target.value as ImageLinkType,
                  })
                }
              >
                {linkOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={linkPlaceholders[currentLinkType]}
                value={currentLinkValue}
                onChange={(e) =>
                  handleUpdate({
                    imageLinkValue: e.target.value,
                  })
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={openInNewTab}
                  onChange={(e) =>
                    handleUpdate({
                      imageOpenInNewTab: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded"
                />
                Open link in new tab
              </label>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                Alt Text
                <Info className="h-4 w-4 text-gray-400" />
              </label>
              <input
                type="text"
                placeholder="Describe what you see in the image"
                value={altText}
                onChange={(e) =>
                  handleUpdate({
                    imageAltText: e.target.value,
                  })
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              />
            </div>
          </div>
        )}

        {activeBlockTab === "Styles" && (
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
                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setIsImageBlockBackgroundPickerOpen?.(true)
                        }
                        className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
                      >
                        <span>Block Background</span>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-full border border-gray-200"
                            style={{
                              backgroundColor:
                                blockBackgroundColor || "transparent",
                              backgroundImage: !blockBackgroundColor
                                ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                                : undefined,
                              backgroundSize: !blockBackgroundColor
                                ? "8px 8px"
                                : undefined,
                              backgroundPosition: !blockBackgroundColor
                                ? "0 0, 0 4px, 4px -4px, -4px 0px"
                                : undefined,
                            }}
                          />
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </span>
                      </button>
                      <input
                        ref={blockBackgroundInputRef}
                        type="color"
                        value={blockBackgroundColor || "#ffffff"}
                        onChange={(e) =>
                          updateBlockStyles({
                            backgroundColor:
                              e.target.value === "#ffffff"
                                ? "#ffffff"
                                : e.target.value,
                          })
                        }
                        className="hidden"
                      />
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
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 w-full">
                      <span className="text-xs text-gray-500">
                        <Scan className="h-4 w-4 text-gray-500" />
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={borderRadiusValue}
                        onChange={(e) =>
                          updateFrameStyles({
                            borderRadius: e.target.value
                              ? `${e.target.value}px`
                              : undefined,
                          })
                        }
                        className="flex-1 text-sm outline-none"
                      />
                    </div>
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
                      const value = e.target.value;
                      if (value === "none") {
                        updateFrameStyles({
                          borderStyle: "none",
                          borderWidth: undefined,
                          borderColor: undefined,
                        });
                      } else {
                        updateFrameStyles({
                          borderStyle: value as BlockBoxStyles["borderStyle"],
                          borderWidth: borderWidthValue
                            ? `${borderWidthValue}px`
                            : "1px",
                        });
                      }
                    }}
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                  {borderStyle !== "none" && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="number"
                          min={0}
                          value={borderWidthValue || "1"}
                          onChange={(e) =>
                            updateFrameStyles({
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
                            updateFrameStyles({
                              borderColor: e.target.value,
                            })
                          }
                          className="hidden"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Device-specific
              </h3>
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                  <span className="text-sm font-semibold text-gray-900">
                    Link Desktop and Mobile Styles
                  </span>
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

                <div className="px-4 py-4 space-y-5">
                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-gray-900">
                      Alignment
                    </span>
                    <div className="grid grid-cols-3 border border-gray-200 rounded-lg overflow-hidden">
                      {(["left", "center", "right"] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() =>
                            handleUpdate({
                              imageAlignment: option,
                            })
                          }
                          className={`py-2 text-sm font-medium ${
                            alignment === option
                              ? "bg-[#3CCED7] text-white"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
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
                          handlePaddingChange(
                            "top",
                            Number(e.target.value || 0)
                          )
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

                  {/* <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Margin
                      </span>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded"
                          checked={isMarginLinked}
                          onChange={(e) =>
                            handleToggleMarginLink(e.target.checked)
                          }
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
                  </div> */}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      {/* {activeBlockTab === "Styles" && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleClearStyles}
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

export default ImageInspector;
