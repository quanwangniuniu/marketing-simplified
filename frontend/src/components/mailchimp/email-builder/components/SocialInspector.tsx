"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Trash2,
  MoreVertical,
  Plus,
  Users,
  Share2,
  Link,
  Sparkles,
} from "lucide-react";
import {
  CanvasBlock,
  BlockBoxStyles,
  SocialType,
  SocialLink,
  SocialPlatform,
  SocialDisplay,
  SocialIconStyle,
  SocialLayout,
  SocialSize,
  SocialAlignment,
} from "../types";

interface SocialInspectorProps {
  selectedBlockData: CanvasBlock | null;
  activeBlockTab: "Content" | "Styles";
  setActiveBlockTab: (tab: "Content" | "Styles") => void;
  setSelectedBlock: (block: { section: string; id: string } | null) => void;
  updateSocialSettings: (updates: Partial<CanvasBlock>) => void;
  setIsSocialBlockBackgroundPickerOpen?: (open: boolean) => void;
  setIsSocialIconColorPickerOpen?: (open: boolean) => void;
}

const SocialInspector: React.FC<SocialInspectorProps> = ({
  selectedBlockData,
  activeBlockTab,
  setActiveBlockTab,
  setSelectedBlock,
  updateSocialSettings,
  setIsSocialBlockBackgroundPickerOpen,
  setIsSocialIconColorPickerOpen,
}) => {
  const [linkDeviceStyles, setLinkDeviceStyles] = useState(true);
  const [isIconColorPickerOpen, setIsIconColorPickerOpen] = useState(false);
  const [isPaddingLinked, setIsPaddingLinked] = useState(false);
  const [paddingValues, setPaddingValues] = useState({
    top: 12,
    bottom: 12,
    left: 0,
    right: 0,
  });
  const paddingInitializedRef = useRef<Set<string>>(new Set());
  const borderColorInputRef = useRef<HTMLInputElement>(null);

  const socialType: SocialType = selectedBlockData?.socialType || "Follow";
  const socialLinks: SocialLink[] = selectedBlockData?.socialLinks || [];
  const blockBackgroundColor =
    selectedBlockData?.socialBlockStyles?.backgroundColor || "transparent";
  const socialDisplay: SocialDisplay =
    selectedBlockData?.socialDisplay || "Icon only";
  const socialIconStyle: SocialIconStyle =
    selectedBlockData?.socialIconStyle || "Filled";
  const socialLayout: SocialLayout =
    selectedBlockData?.socialLayout || "Horizontal-right";
  const socialIconColor = selectedBlockData?.socialIconColor || "#000000";
  const borderStyle =
    selectedBlockData?.socialBlockStyles?.borderStyle || "none";

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

  const socialSize: SocialSize = selectedBlockData?.socialSize || "Large";
  const socialAlignment: SocialAlignment =
    selectedBlockData?.socialAlignment || "center";
  const socialSpacing = parseFloat(
    getPxValue(selectedBlockData?.socialSpacing) || "24"
  );

  const borderWidthValue = getPxValue(
    selectedBlockData?.socialBlockStyles?.borderWidth
  );
  const borderColor =
    selectedBlockData?.socialBlockStyles?.borderColor || "#111827";

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

  useEffect(() => {
    if (!selectedBlockData) return;
    const blockId = selectedBlockData.id || "";
    const blockStyles = selectedBlockData.socialBlockStyles || {};
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
        paddingTop: "12px",
        paddingBottom: "12px",
        paddingLeft: "0px",
        paddingRight: "0px",
      });
      setIsPaddingLinked(false);
      setPaddingValues({
        top: 12,
        bottom: 12,
        left: 0,
        right: 0,
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
          0,
        right:
          parseFloat(getPxValue(blockStyles.paddingRight) || "") ||
          basePadding ||
          0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockData?.id, selectedBlockData?.socialBlockStyles]);

  const platformConfigs: Record<
    SocialPlatform,
    { icon: string; baseUrl: string; defaultLabel: string }
  > = {
    Facebook: {
      icon: "f",
      baseUrl: "https://facebook.com/",
      defaultLabel: "Facebook",
    },
    Instagram: {
      icon: "IG",
      baseUrl: "https://instagram.com/",
      defaultLabel: "Instagram",
    },
    X: { icon: "X", baseUrl: "https://x.com/", defaultLabel: "Twitter" },
    LinkedIn: {
      icon: "in",
      baseUrl: "https://linkedin.com/",
      defaultLabel: "LinkedIn",
    },
    YouTube: {
      icon: "▶",
      baseUrl: "https://youtube.com/",
      defaultLabel: "YouTube",
    },
    TikTok: {
      icon: "♪",
      baseUrl: "https://tiktok.com/",
      defaultLabel: "TikTok",
    },
    Pinterest: {
      icon: "P",
      baseUrl: "https://pinterest.com/",
      defaultLabel: "Pinterest",
    },
    Snapchat: {
      icon: "👻",
      baseUrl: "https://snapchat.com/",
      defaultLabel: "Snapchat",
    },
  };

  const handleSocialTypeChange = (type: SocialType) => {
    updateSocialSettings({ socialType: type });
  };

  const handleAddSocialLink = () => {
    const newLink: SocialLink = {
      id: `social-${Date.now()}`,
      platform: "Facebook",
      url: "https://facebook.com/",
      label: "Facebook",
    };
    updateSocialSettings({
      socialLinks: [...socialLinks, newLink],
    });
  };

  const handleRemoveSocialLink = (id: string) => {
    updateSocialSettings({
      socialLinks: socialLinks.filter((link) => link.id !== id),
    });
  };

  const handleUpdateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    updateSocialSettings({
      socialLinks: socialLinks.map((link) =>
        link.id === id ? { ...link, ...updates } : link
      ),
    });
  };

  const updateBlockStyles = (updates: Partial<BlockBoxStyles>) => {
    if (!selectedBlockData) return;
    const current = selectedBlockData.socialBlockStyles || {};
    const merged = { ...current, ...updates };

    // Remove undefined values
    Object.keys(merged).forEach((key) => {
      if (merged[key as keyof BlockBoxStyles] === undefined) {
        delete merged[key as keyof BlockBoxStyles];
      }
    });

    updateSocialSettings({
      socialBlockStyles: merged,
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
            {/* Display */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Display
              </label>
              <div className="relative">
                <select
                  value={socialDisplay}
                  onChange={(e) =>
                    updateSocialSettings({
                      socialDisplay: e.target.value as SocialDisplay,
                    })
                  }
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent appearance-none bg-white"
                >
                  <option value="Icon only">Icon only</option>
                  <option value="Icon and text">Icon and text</option>
                </select>
                <ChevronDown className="h-4 w-4 text-gray-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Icon Style */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Icon Style
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateSocialSettings({ socialIconStyle: "Plain" })
                  }
                  className={`flex-1 border-2 rounded-lg px-4 py-3 flex items-center justify-center transition ${
                    socialIconStyle === "Plain"
                      ? "border-[#2AB5BD] bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Link className="h-5 w-5 text-gray-900" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateSocialSettings({ socialIconStyle: "Filled" })
                  }
                  className={`flex-1 border-2 rounded-lg px-4 py-3 flex items-center justify-center transition ${
                    socialIconStyle === "Filled"
                      ? "border-[#2AB5BD] bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center">
                    <Link className="h-3 w-3 text-white" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateSocialSettings({ socialIconStyle: "Outlined" })
                  }
                  className={`flex-1 border-2 rounded-lg px-4 py-3 flex items-center justify-center transition ${
                    socialIconStyle === "Outlined"
                      ? "border-[#2AB5BD] bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-5 h-5 border-2 border-black rounded-full flex items-center justify-center">
                    <Link className="h-3 w-3 text-gray-900" />
                  </div>
                </button>
              </div>
            </div>

            {/* Layout */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Layout
              </label>
              {socialDisplay === "Icon only" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSocialSettings({ socialLayout: "Horizontal-right" })
                    }
                    className={`flex-1 border-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      socialLayout === "Horizontal-right" ||
                      socialLayout === "Horizontal-bottom"
                        ? "border-[#2AB5BD] bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Horizontal
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSocialSettings({ socialLayout: "Vertical-right" })
                    }
                    className={`flex-1 border-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      socialLayout === "Vertical-right" ||
                      socialLayout === "Vertical-bottom"
                        ? "border-[#2AB5BD] bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Vertical
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSocialSettings({ socialLayout: "Horizontal-right" })
                    }
                    className={`border-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      socialLayout === "Horizontal-right"
                        ? "border-[#2AB5BD] bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Horizontal (Right)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSocialSettings({
                        socialLayout: "Horizontal-bottom",
                      })
                    }
                    className={`border-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      socialLayout === "Horizontal-bottom"
                        ? "border-[#2AB5BD] bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Horizontal (Bottom)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSocialSettings({ socialLayout: "Vertical-right" })
                    }
                    className={`border-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      socialLayout === "Vertical-right"
                        ? "border-[#2AB5BD] bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Vertical (Right)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSocialSettings({ socialLayout: "Vertical-bottom" })
                    }
                    className={`border-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      socialLayout === "Vertical-bottom"
                        ? "border-[#2AB5BD] bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Vertical (Bottom)
                  </button>
                </div>
              )}
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Color
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsIconColorPickerOpen(true)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
                >
                  <span>Dark Icons</span>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full border border-gray-200"
                      style={{ backgroundColor: socialIconColor }}
                    />
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSocialBlockBackgroundPickerOpen?.(true)}
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

            <div className="px-4 py-4 space-y-5">
              {/* Size */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Size
                </label>
                <div className="grid grid-cols-3 border border-gray-200 rounded-lg overflow-hidden">
                  {(["Small", "Medium", "Large"] as SocialSize[]).map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          updateSocialSettings({ socialSize: option })
                        }
                        className={`py-2 text-sm font-medium ${
                          socialSize === option
                            ? "bg-white text-gray-900"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {option}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Alignment */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Alignment
                </label>
                <div className="grid grid-cols-3 border border-gray-200 rounded-lg overflow-hidden">
                  {(["left", "center", "right"] as SocialAlignment[]).map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          updateSocialSettings({ socialAlignment: option })
                        }
                        className={`py-2 text-sm font-medium ${
                          socialAlignment === option
                            ? "bg-white text-gray-900"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Spacing */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Spacing
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="2"
                    max="60"
                    value={Math.max(2, Math.min(60, socialSpacing))}
                    onChange={(e) => {
                      const value = Math.max(
                        2,
                        Math.min(60, parseInt(e.target.value) || 2)
                      );
                      updateSocialSettings({
                        socialSpacing: `${value}px`,
                      });
                    }}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 min-w-[50px] text-right">
                    {Math.max(2, Math.min(60, socialSpacing))}px
                  </span>
                </div>
              </div>

              {/* Padding */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-900">
                    Padding
                  </label>
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
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
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
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Select a social type
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSocialTypeChange("Follow")}
            className={`p-4 border-2 rounded-lg text-left transition ${
              socialType === "Follow"
                ? "border-[#2AB5BD] bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-gray-600" />
              </div>
            </div>
            <div className="font-semibold text-sm text-gray-900 mb-1">
              Follow
            </div>
            <div className="text-xs text-gray-500">
              Links to your social channels
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleSocialTypeChange("Share")}
            className={`p-4 border-2 rounded-lg text-left transition ${
              socialType === "Share"
                ? "border-[#2AB5BD] bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Share2 className="h-5 w-5 text-gray-600" />
              </div>
            </div>
            <div className="font-semibold text-sm text-gray-900 mb-1">
              Share
            </div>
            <div className="text-xs text-gray-500">
              Recipients post to their social channels
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {socialLinks.map((link) => {
          const config = platformConfigs[link.platform];
          return (
            <div
              key={link.id}
              className="border border-gray-200 rounded-lg bg-white overflow-hidden"
            >
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-gray-900 text-sm font-medium flex-shrink-0">
                    {config.icon}
                  </span>
                  <div className="flex-1 relative">
                    <select
                      value={link.platform}
                      onChange={(e) =>
                        handleUpdateSocialLink(link.id, {
                          platform: e.target.value as SocialPlatform,
                          url: platformConfigs[e.target.value as SocialPlatform]
                            .baseUrl,
                          label:
                            platformConfigs[e.target.value as SocialPlatform]
                              .defaultLabel,
                        })
                      }
                      className="w-full px-3 py-1.5 pr-8 border border-gray-200 rounded-md text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent bg-transparent appearance-none cursor-pointer"
                    >
                      {Object.keys(platformConfigs).map((platform) => (
                        <option key={platform} value={platform}>
                          {platform === "X" ? "X (formerly Twitter)" : platform}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 text-gray-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRemoveSocialLink(link.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div>
                  <input
                    type="text"
                    value={link.url}
                    onChange={(e) =>
                      handleUpdateSocialLink(link.id, { url: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
                    placeholder={config.baseUrl}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) =>
                      handleUpdateSocialLink(link.id, { label: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
                    placeholder={config.defaultLabel}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddSocialLink}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add another social link
        </button>
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
        <span className="text-base font-semibold text-gray-900">Social</span>
        <button className="text-[#3CCED7] hover:text-[#1a9ba3] text-xs flex items-center gap-1">
          {/* <HelpCircle className="h-4 w-4" />
          <span>How to use social blocks</span> */}
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
              updateSocialSettings({
                socialBlockStyles: {},
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

export default SocialInspector;
