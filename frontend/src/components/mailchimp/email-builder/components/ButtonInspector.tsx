"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  HelpCircle,
  ChevronRight,
  Scan,
} from "lucide-react";
import {
  BlockBoxStyles,
  CanvasBlock,
  ButtonLinkType,
  ButtonShape,
  ButtonSize,
} from "../types";

interface ButtonInspectorProps {
  selectedBlockData: CanvasBlock | null;
  activeBlockTab: "Content" | "Styles";
  setActiveBlockTab: (tab: "Content" | "Styles") => void;
  setSelectedBlock: (block: { section: string; id: string } | null) => void;
  updateButtonSettings: (updates: Partial<CanvasBlock>) => void;
  setIsButtonBlockBackgroundPickerOpen?: (open: boolean) => void;
}

const ButtonInspector: React.FC<ButtonInspectorProps> = ({
  selectedBlockData,
  activeBlockTab,
  setActiveBlockTab,
  setSelectedBlock,
  updateButtonSettings,
  setIsButtonBlockBackgroundPickerOpen,
}) => {
  const linkOptions: ButtonLinkType[] = ["Web", "Email", "Phone"];

  const currentLinkType = selectedBlockData?.buttonLinkType || "Web";
  const currentLinkValue = selectedBlockData?.buttonLinkValue || "";
  const openInNewTab = selectedBlockData?.buttonOpenInNewTab ?? true;
  const buttonText = selectedBlockData?.content || "";
  const buttonShape = selectedBlockData?.buttonShape || "Square";
  const buttonAlignment = selectedBlockData?.buttonAlignment || "center";
  const buttonSize = selectedBlockData?.buttonSize || "Small";

  const linkPlaceholders: Record<ButtonLinkType, string> = {
    Web: "https://example.com",
    Email: "name@example.com",
    Phone: "+1 (555) 123-4567",
  };

  const handleUpdate = (updates: Partial<CanvasBlock>) => {
    if (!selectedBlockData) return;
    updateButtonSettings(updates);
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

  const paddingInitializedRef = useRef<Set<string>>(new Set());

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
    const current = selectedBlockData.buttonBlockStyles || {};
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

    handleUpdate({
      buttonBlockStyles: cleanStyles(merged),
    });
  };

  useEffect(() => {
    if (!selectedBlockData) return;
    const blockId = selectedBlockData.id || "";
    const blockStyles = selectedBlockData.buttonBlockStyles || {};
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
  }, [selectedBlockData]);

  const blockBackgroundColor =
    selectedBlockData?.buttonBlockStyles?.backgroundColor || "";
  const blockBackgroundInputRef = useRef<HTMLInputElement>(null);
  const borderColorInputRef = useRef<HTMLInputElement>(null);
  const borderRadiusValue = getPxValue(
    selectedBlockData?.buttonBlockStyles?.borderRadius
  );
  const borderStyle =
    selectedBlockData?.buttonBlockStyles?.borderStyle || "none";
  const borderWidthValue = getPxValue(
    selectedBlockData?.buttonBlockStyles?.borderWidth
  );
  const borderColor =
    selectedBlockData?.buttonBlockStyles?.borderColor || "#111827";
  const buttonTextColor = selectedBlockData?.buttonTextColor || "#ffffff";
  const buttonBackgroundColor =
    selectedBlockData?.buttonBackgroundColor || "#111827";

  const handleClearStyles = () => {
    updateBlockStyles({});
    handleUpdate({
      buttonAlignment: "center",
      buttonShape: "Square",
      buttonTextColor: "#ffffff",
      buttonBackgroundColor: "#111827",
    });
    setPaddingValues({
      top: 12,
      bottom: 12,
      left: 24,
      right: 24,
    });
    setIsPaddingLinked(false);
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

  // Calculate border radius based on shape
  const getShapeBorderRadius = (shape: ButtonShape): string => {
    switch (shape) {
      case "Round":
        return "8px";
      case "Pill":
        return "9999px";
      case "Square":
      default:
        return "0px";
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
        <span className="text-base font-semibold text-gray-900">Button</span>
        <button className="text-[#3CCED7] hover:text-[#1a9ba3] text-xs flex items-center gap-1">
          {/* <HelpCircle className="h-4 w-4" />
          How to use button blocks */}
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
        {activeBlockTab === "Content" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">
                Button text
              </label>
              <input
                type="text"
                placeholder="Button text"
                value={buttonText}
                onChange={(e) =>
                  handleUpdate({
                    content: e.target.value,
                  })
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              />
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
                    buttonLinkType: e.target.value as ButtonLinkType,
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
                    buttonLinkValue: e.target.value,
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
                      buttonOpenInNewTab: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded"
                />
                Open link in new tab
              </label>
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
                    Shape
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-3 bg-gray-100 rounded-lg p-1 text-sm font-medium text-gray-700 flex-1">
                      {(["Square", "Round", "Pill"] as ButtonShape[]).map(
                        (option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              handleUpdate({
                                buttonShape: option,
                              });
                              // Update border radius based on shape
                              updateBlockStyles({
                                borderRadius: getShapeBorderRadius(option),
                              });
                            }}
                            className={`py-2 rounded-md ${
                              buttonShape === option
                                ? "bg-white shadow text-gray-900"
                                : "hover:bg-gray-200 text-gray-600"
                            }`}
                          >
                            {option}
                          </button>
                        )
                      )}
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

                <div className="space-y-2">
                  <span className="block text-sm font-semibold text-gray-900">
                    Colors
                  </span>
                  <div className="mt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        const colorInput = document.createElement("input");
                        colorInput.type = "color";
                        colorInput.value = buttonBackgroundColor;
                        colorInput.onchange = (e) => {
                          const target = e.target as HTMLInputElement;
                          handleUpdate({
                            buttonBackgroundColor: target.value,
                          });
                        };
                        colorInput.click();
                      }}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
                    >
                      <span>Button</span>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full border border-gray-200"
                          style={{
                            backgroundColor: buttonBackgroundColor,
                          }}
                        />
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const colorInput = document.createElement("input");
                        colorInput.type = "color";
                        colorInput.value = buttonTextColor;
                        colorInput.onchange = (e) => {
                          const target = e.target as HTMLInputElement;
                          handleUpdate({
                            buttonTextColor: target.value,
                          });
                        };
                        colorInput.click();
                      }}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
                    >
                      <span>Text</span>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full border border-gray-200"
                          style={{
                            backgroundColor: buttonTextColor,
                          }}
                        />
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setIsButtonBlockBackgroundPickerOpen?.(true)
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
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Text
                      </span>
                      <span className="text-xs text-gray-500">
                        Use toolbar for customization
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Changes to font size will apply when email is viewed on a
                      desktop device.
                    </p>
                  </div>

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
                              buttonAlignment: option,
                            })
                          }
                          className={`py-2 text-sm font-medium ${
                            buttonAlignment === option
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
                    <span className="text-sm font-semibold text-gray-900">
                      Size
                    </span>
                    <div className="grid grid-cols-4 bg-gray-100 rounded-lg p-1 text-sm font-medium text-gray-700">
                      {(["Small", "Medium", "Large"] as ButtonSize[]).map(
                        (option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              handleUpdate({
                                buttonSize: option,
                              })
                            }
                            className={`py-2 rounded-md ${
                              buttonSize === option
                                ? "bg-white shadow text-gray-900"
                                : "hover:bg-gray-200 text-gray-600"
                            }`}
                          >
                            {option}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        className="py-2 rounded-md hover:bg-gray-200 text-gray-600"
                        disabled
                      >
                        ...
                      </button>
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

export default ButtonInspector;

