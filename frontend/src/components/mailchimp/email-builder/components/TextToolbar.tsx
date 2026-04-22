"use client";
import React from "react";
import { createPortal } from "react-dom";
import {
  Link,
  Anchor,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  MoreHorizontal,
  List,
  ListOrdered,
  Strikethrough,
  Info,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import {
  ButtonLinkType,
  CanvasBlock,
  SelectedBlock,
  TextStyles,
} from "../types";

interface TextToolbarProps {
  isTextBlockSelected: boolean;
  selectedBlock: SelectedBlock | null;
  selectedBlockData: CanvasBlock | null;
  currentStyles: TextStyles;
  handleStyleChange: (styles: Partial<TextStyles>) => void;
  setCanvasBlocks: React.Dispatch<
    React.SetStateAction<{
      header: CanvasBlock[];
      body: CanvasBlock[];
      footer: CanvasBlock[];
    }>
  >;
  setIsTextColorPickerOpen: (open: boolean) => void;
  setIsTextHighlightPickerOpen: (open: boolean) => void;
}

const TextToolbar: React.FC<TextToolbarProps> = ({
  isTextBlockSelected,
  selectedBlock,
  selectedBlockData,
  currentStyles,
  handleStyleChange,
  setCanvasBlocks,
  setIsTextColorPickerOpen,
  setIsTextHighlightPickerOpen,
}) => {
  const baseToolbarButtonClasses =
    "rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 flex items-center justify-center";

  // State for dropdowns and inputs
  const [isTextDirectionDropdownOpen, setIsTextDirectionDropdownOpen] =
    React.useState(false);
  const [isLineHeightDropdownOpen, setIsLineHeightDropdownOpen] =
    React.useState(false);
  const [isLetterSpacingInputOpen, setIsLetterSpacingInputOpen] =
    React.useState(false);
  const [isMergeTagsDropdownOpen, setIsMergeTagsDropdownOpen] =
    React.useState(false);
  const [isInfoTooltipOpen, setIsInfoTooltipOpen] = React.useState(false);
  const [isTextLinkModalOpen, setIsTextLinkModalOpen] = React.useState(false);
  const [textLinkType, setTextLinkType] = React.useState<ButtonLinkType>("Web");
  const [textLinkValue, setTextLinkValue] = React.useState("");
  const [textLinkOpenInNewTab, setTextLinkOpenInNewTab] = React.useState(true);
  const [letterSpacingValue, setLetterSpacingValue] = React.useState<string>(
    currentStyles.letterSpacing?.toString().replace("px", "") || "0"
  );
  const textDirectionDropdownRef = React.useRef<HTMLDivElement>(null);
  const lineHeightDropdownRef = React.useRef<HTMLDivElement>(null);
  const letterSpacingInputRef = React.useRef<HTMLDivElement>(null);
  const mergeTagsDropdownRef = React.useRef<HTMLDivElement>(null);
  const infoTooltipRef = React.useRef<HTMLDivElement>(null);
  const linkOptions: ButtonLinkType[] = ["Web", "Email", "Phone"];
  const linkPlaceholders: Record<ButtonLinkType, string> = {
    Web: "https://example.com",
    Email: "name@example.com",
    Phone: "+1 (555) 123-4567",
  };

  // Helper function to get styles for a heading level
  const getStylesForHeadingLevel = React.useCallback((level: string) => {
    switch (level) {
      case "Heading 1":
        return { fontSize: 31, fontWeight: "bold" as const };
      case "Heading 2":
        return { fontSize: 25, fontWeight: "bold" as const };
      case "Heading 3":
        return { fontSize: 20, fontWeight: "bold" as const };
      case "Heading 4":
        return { fontSize: 16, fontWeight: "bold" as const };
      case "Paragraph":
        return { fontSize: 16, fontWeight: "normal" as const };
      default:
        return { fontSize: 16, fontWeight: "normal" as const };
    }
  }, []);

  // Helper function to determine heading level from current styles
  const getHeadingLevelFromStyles = React.useCallback((): string => {
    if (selectedBlockData?.type !== "Heading") {
      return "Paragraph";
    }

    const fontSize = currentStyles.fontSize;
    const fontWeight = currentStyles.fontWeight;

    // Check if it matches any heading level
    if (fontWeight === "bold") {
      if (fontSize === 31) return "Heading 1";
      if (fontSize === 25) return "Heading 2";
      if (fontSize === 20) return "Heading 3";
      if (fontSize === 16) return "Heading 4";
    }

    // If it's a Heading type but doesn't match any level, default to Heading 1
    if (selectedBlockData?.type === "Heading") {
      return "Heading 1";
    }

    return "Paragraph";
  }, [
    selectedBlockData?.type,
    currentStyles.fontSize,
    currentStyles.fontWeight,
  ]);

  const updateSelectedBlock = React.useCallback(
    (updates: Partial<CanvasBlock>) => {
      if (!selectedBlock) return;
      setCanvasBlocks((prev) => {
        const sectionBlocks = [
          ...prev[selectedBlock.section as keyof typeof prev],
        ];
        const blockIndex = sectionBlocks.findIndex(
          (b) => b.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;
        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...updatedBlocks[blockIndex],
          ...updates,
        };
        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });
    },
    [selectedBlock, setCanvasBlocks]
  );

  const handleOpenTextLinkModal = React.useCallback(() => {
    if (!selectedBlockData) return;
    setTextLinkType(selectedBlockData.textLinkType || "Web");
    setTextLinkValue(selectedBlockData.textLinkValue || "");
    setTextLinkOpenInNewTab(selectedBlockData.textLinkOpenInNewTab ?? true);
    setIsTextLinkModalOpen(true);
  }, [selectedBlockData]);

  const handleSaveTextLink = React.useCallback(() => {
    const trimmedValue = textLinkValue.trim();
    if (!selectedBlock) return;
    if (!trimmedValue) {
      updateSelectedBlock({
        textLinkType: undefined,
        textLinkValue: undefined,
        textLinkOpenInNewTab: undefined,
      });
    } else {
      updateSelectedBlock({
        textLinkType,
        textLinkValue: trimmedValue,
        textLinkOpenInNewTab,
      });
    }
    setIsTextLinkModalOpen(false);
  }, [
    selectedBlock,
    textLinkValue,
    textLinkType,
    textLinkOpenInNewTab,
    updateSelectedBlock,
  ]);

  const handleRemoveTextLink = React.useCallback(() => {
    updateSelectedBlock({
      textLinkType: undefined,
      textLinkValue: undefined,
      textLinkOpenInNewTab: undefined,
    });
    setTextLinkValue("");
    setIsTextLinkModalOpen(false);
  }, [updateSelectedBlock]);

  React.useEffect(() => {
    if (isTextLinkModalOpen) return;
    setTextLinkType(selectedBlockData?.textLinkType || "Web");
    setTextLinkValue(selectedBlockData?.textLinkValue || "");
    setTextLinkOpenInNewTab(selectedBlockData?.textLinkOpenInNewTab ?? true);
  }, [
    selectedBlockData?.id,
    selectedBlockData?.textLinkType,
    selectedBlockData?.textLinkValue,
    selectedBlockData?.textLinkOpenInNewTab,
    isTextLinkModalOpen,
  ]);

  const linkButtonIsActive = Boolean(selectedBlockData?.textLinkValue);

  const toolbarGroups = React.useMemo(
    () => [
      {
        key: "block-settings",
        element: (
          <div className="flex items-center gap-2">
            <select
              value={getHeadingLevelFromStyles()}
              onChange={(e) => {
                if (!selectedBlock) return;
                const selectedLevel = e.target.value;
                const newType =
                  selectedLevel === "Paragraph" ? "Paragraph" : "Heading";
                const styles = getStylesForHeadingLevel(selectedLevel);

                // Update block type
                setCanvasBlocks((prev) => {
                  const sectionBlocks = [
                    ...prev[selectedBlock.section as keyof typeof prev],
                  ];
                  const blockIndex = sectionBlocks.findIndex(
                    (b) => b.id === selectedBlock.id
                  );
                  if (blockIndex === -1) return prev;
                  const updatedBlocks = [...sectionBlocks];
                  updatedBlocks[blockIndex] = {
                    ...updatedBlocks[blockIndex],
                    type: newType,
                    label: newType === "Heading" ? "Heading" : "Text",
                  };
                  return {
                    ...prev,
                    [selectedBlock.section]: updatedBlocks,
                  };
                });

                // Apply styles
                handleStyleChange(styles);
              }}
              className="bg-white border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
            >
              <option>Paragraph</option>
              <option>Heading 1</option>
              <option>Heading 2</option>
              <option>Heading 3</option>
              <option>Heading 4</option>
            </select>
            <select
              value={currentStyles.fontFamily || "Helvetica"}
              onChange={(e) =>
                handleStyleChange({ fontFamily: e.target.value })
              }
              className="bg-white border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
            >
              <option>Helvetica</option>
              <option>Arial</option>
              <option>Georgia</option>
            </select>
            <input
              type="number"
              value={currentStyles.fontSize || 16}
              onChange={(e) =>
                handleStyleChange({ fontSize: parseInt(e.target.value) || 16 })
              }
              className="w-16 bg-white border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
            />
          </div>
        ),
      },
      {
        key: "text-style",
        element: (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsTextColorPickerOpen(true)}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.color ? "bg-gray-200" : ""
              }`}
            >
              <span className="underline">A</span>
            </button>
            <button
              type="button"
              onClick={() => setIsTextHighlightPickerOpen(true)}
              className={`rounded-md px-2 py-1 flex items-center justify-center
            text-white bg-gray-900 hover:bg-gray-800
              `}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => {
                const newWeight =
                  currentStyles.fontWeight === "bold" ? "normal" : "bold";
                handleStyleChange({ fontWeight: newWeight });
              }}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.fontWeight === "bold"
                  ? "bg-gray-200 font-semibold"
                  : ""
              }`}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => {
                const newStyle =
                  currentStyles.fontStyle === "italic" ? "normal" : "italic";
                handleStyleChange({ fontStyle: newStyle });
              }}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.fontStyle === "italic" ? "bg-gray-200 italic" : ""
              }`}
            >
              I
            </button>
            <button
              type="button"
              onClick={() => {
                const newDecoration =
                  currentStyles.textDecoration === "underline"
                    ? "none"
                    : "underline";
                handleStyleChange({ textDecoration: newDecoration });
              }}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.textDecoration === "underline"
                  ? "bg-gray-200 underline"
                  : ""
              }`}
            >
              U
            </button>
            <button
              type="button"
              onClick={() => {
                const newDecoration =
                  currentStyles.textDecoration === "line-through"
                    ? "none"
                    : "line-through";
                handleStyleChange({ textDecoration: newDecoration });
              }}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.textDecoration === "line-through"
                  ? "bg-gray-200 line-through"
                  : ""
              }`}
            >
              S
            </button>
          </div>
        ),
      },
      {
        key: "insert",
        element: (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpenTextLinkModal}
              className={`${baseToolbarButtonClasses} ${
                linkButtonIsActive ? "bg-gray-200 text-[#1a9ba3]" : ""
              }`}
              title="Add text link"
            >
              <Link className="h-4 w-4" />
            </button>
            {/* <button type="button" className={baseToolbarButtonClasses}>
              <Anchor className="h-4 w-4" />
            </button>
            <button type="button" className={baseToolbarButtonClasses}>
              <ImageIcon className="h-4 w-4" />
            </button> */}
          </div>
        ),
      },
      {
        key: "alignment",
        element: (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleStyleChange({ textAlign: "left" })}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.textAlign === "left" ? "bg-gray-200" : ""
              }`}
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange({ textAlign: "center" })}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.textAlign === "center" ? "bg-gray-200" : ""
              }`}
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange({ textAlign: "right" })}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.textAlign === "right" ? "bg-gray-200" : ""
              }`}
            >
              <AlignRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange({ textAlign: "justify" })}
              className={`${baseToolbarButtonClasses} ${
                currentStyles.textAlign === "justify" ? "bg-gray-200" : ""
              }`}
            >
              <AlignJustify className="h-4 w-4" />
            </button>
          </div>
        ),
      },
      {
        key: "spacing",
        element: (
          <div className="flex items-center gap-1">
            <div className="relative" ref={textDirectionDropdownRef}>
              {/* <button
                type="button"
                onClick={() =>
                  setIsTextDirectionDropdownOpen(!isTextDirectionDropdownOpen)
                }
                className={`${baseToolbarButtonClasses} ${
                  currentStyles.direction === "rtl" ? "bg-gray-200" : ""
                }`}
                title="Text direction"
              >
                A↔
              </button> */}
              {isTextDirectionDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
                  <div className="py-1">
                    {[
                      { label: "Left to Right", value: "ltr" as const },
                      { label: "Right to Left", value: "rtl" as const },
                    ].map((option) => {
                      // Default to "ltr" if direction is undefined
                      const isSelected =
                        (currentStyles.direction || "ltr") === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            handleStyleChange({ direction: option.value });
                            setIsTextDirectionDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-100 ${
                            isSelected
                              ? "bg-[#3CCED7]/10 text-[#1a9ba3]"
                              : "text-gray-700"
                          }`}
                        >
                          <span>{option.label}</span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-[#1a9ba3]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={lineHeightDropdownRef}>
              <button
                type="button"
                onClick={() =>
                  setIsLineHeightDropdownOpen(!isLineHeightDropdownOpen)
                }
                className={`${baseToolbarButtonClasses} ${
                  currentStyles.lineHeight ? "bg-gray-200" : ""
                }`}
                title="Line height"
              >
                A↕
              </button>
              {isLineHeightDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[120px]">
                  <div className="py-1">
                    {[
                      { label: "Normal", value: undefined },
                      { label: "1", value: 1 },
                      { label: "1.2", value: 1.2 },
                      { label: "1.5", value: 1.5 },
                      { label: "2", value: 2 },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => {
                          handleStyleChange({ lineHeight: option.value });
                          setIsLineHeightDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${
                          currentStyles.lineHeight === option.value
                            ? "bg-[#3CCED7]/10 text-[#1a9ba3]"
                            : "text-gray-700"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={letterSpacingInputRef}>
              <button
                type="button"
                onClick={() =>
                  setIsLetterSpacingInputOpen(!isLetterSpacingInputOpen)
                }
                className={`${baseToolbarButtonClasses} ${
                  currentStyles.letterSpacing ? "bg-gray-200" : ""
                }`}
                title="Letter spacing"
              >
                VA
              </button>
              {isLetterSpacingInputOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={letterSpacingValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        setLetterSpacingValue(value);
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue) && value !== "") {
                          handleStyleChange({
                            letterSpacing: `${numValue}px`,
                          });
                        } else if (value === "") {
                          // Allow empty input temporarily
                          handleStyleChange({
                            letterSpacing: undefined,
                          });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                          setIsLetterSpacingInputOpen(false);
                        }
                      }}
                      onBlur={() => {
                        const numValue = parseFloat(letterSpacingValue) || 0;
                        setLetterSpacingValue(numValue.toString());
                        handleStyleChange({
                          letterSpacing:
                            numValue === 0 ? undefined : `${numValue}px`,
                        });
                      }}
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#3CCED7] text-center"
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ),
      },
    ],
    [
      baseToolbarButtonClasses,
      currentStyles,
      selectedBlock,
      handleStyleChange,
      setCanvasBlocks,
      setIsTextColorPickerOpen,
      setIsTextHighlightPickerOpen,
      getStylesForHeadingLevel,
      getHeadingLevelFromStyles,
      isTextDirectionDropdownOpen,
      isLineHeightDropdownOpen,
      isLetterSpacingInputOpen,
      letterSpacingValue,
      textDirectionDropdownRef,
      lineHeightDropdownRef,
      letterSpacingInputRef,
      handleOpenTextLinkModal,
      linkButtonIsActive,
    ]
  );

  const [toolbarWidth, setToolbarWidth] = React.useState<number>(0);
  const [groupWidths, setGroupWidths] = React.useState<number[]>([]);
  const [isOverflowOpen, setIsOverflowOpen] = React.useState(false);
  const toolbarContainerRef = React.useRef<HTMLDivElement>(null);
  const overflowMenuRef = React.useRef<HTMLDivElement>(null);
  const measurementWrapperRef = React.useRef<HTMLDivElement>(null);
  const measurementRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Update toolbar width
  React.useLayoutEffect(() => {
    if (!isTextBlockSelected) return;

    const updateWidth = () => {
      const element = toolbarContainerRef.current;
      if (!element) return;
      setToolbarWidth(element.offsetWidth);
    };

    updateWidth();

    if (typeof ResizeObserver !== "undefined" && toolbarContainerRef.current) {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(toolbarContainerRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, [isTextBlockSelected]);

  const updateGroupWidths = React.useCallback(() => {
    if (!toolbarGroups.length) {
      setGroupWidths([]);
      return;
    }

    const widths = toolbarGroups.map((_, index) => {
      const el = measurementRefs.current[index];
      return el ? el.offsetWidth : 0;
    });
    setGroupWidths(widths);
  }, [toolbarGroups]);

  React.useLayoutEffect(() => {
    if (!isTextBlockSelected) return;

    updateGroupWidths();

    if (
      typeof ResizeObserver !== "undefined" &&
      measurementWrapperRef.current
    ) {
      const observer = new ResizeObserver(() => updateGroupWidths());
      observer.observe(measurementWrapperRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateGroupWidths);
    return () => {
      window.removeEventListener("resize", updateGroupWidths);
    };
  }, [isTextBlockSelected, updateGroupWidths]);

  const hasStaticOverflowContent = true;

  const effectiveVisibleCount = React.useMemo(() => {
    if (!toolbarGroups.length) return 0;
    if (!toolbarWidth) return toolbarGroups.length;

    const horizontalPadding = 32; // px-4 on each side
    const interGroupGap = 12;
    const overflowButtonWidth = 44;

    const widths =
      groupWidths.length && groupWidths.some((value) => value > 0)
        ? groupWidths.map((value) => (value > 0 ? value : 160))
        : toolbarGroups.map(() => 160);

    const capacity = Math.max(
      0,
      toolbarWidth -
        horizontalPadding -
        (hasStaticOverflowContent ? overflowButtonWidth : 0)
    );

    let used = 0;
    let count = 0;

    for (let i = 0; i < widths.length; i++) {
      const width = widths[i];
      const additional = width + (count > 0 ? interGroupGap : 0);
      if (used + additional > capacity) {
        break;
      }
      used += additional;
      count += 1;
    }

    if (count === 0) {
      return Math.min(1, widths.length);
    }

    return Math.min(count, widths.length);
  }, [toolbarWidth, toolbarGroups, groupWidths, hasStaticOverflowContent]);

  const visibleGroups = React.useMemo(
    () => toolbarGroups.slice(0, effectiveVisibleCount),
    [toolbarGroups, effectiveVisibleCount]
  );

  const overflowGroups = React.useMemo(
    () => toolbarGroups.slice(effectiveVisibleCount),
    [toolbarGroups, effectiveVisibleCount]
  );

  const shouldShowOverflowButton =
    hasStaticOverflowContent || overflowGroups.length > 0;

  // Update measurement refs array length
  React.useEffect(() => {
    measurementRefs.current = measurementRefs.current.slice(
      0,
      toolbarGroups.length
    );
  }, [toolbarGroups.length]);

  // Close overflow menu when clicking outside
  React.useEffect(() => {
    if (!isOverflowOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        overflowMenuRef.current &&
        !overflowMenuRef.current.contains(event.target as Node)
      ) {
        setIsOverflowOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOverflowOpen]);

  // Close text direction dropdown when clicking outside
  React.useEffect(() => {
    if (!isTextDirectionDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        textDirectionDropdownRef.current &&
        !textDirectionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTextDirectionDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTextDirectionDropdownOpen]);

  // Close line height dropdown when clicking outside
  React.useEffect(() => {
    if (!isLineHeightDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        lineHeightDropdownRef.current &&
        !lineHeightDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLineHeightDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLineHeightDropdownOpen]);

  // Close letter spacing input when clicking outside
  React.useEffect(() => {
    if (!isLetterSpacingInputOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        letterSpacingInputRef.current &&
        !letterSpacingInputRef.current.contains(event.target as Node)
      ) {
        setIsLetterSpacingInputOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLetterSpacingInputOpen]);

  // Close merge tags dropdown when clicking outside
  React.useEffect(() => {
    if (!isMergeTagsDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        mergeTagsDropdownRef.current &&
        !mergeTagsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsMergeTagsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMergeTagsDropdownOpen]);

  // Close info tooltip when clicking outside
  React.useEffect(() => {
    if (!isInfoTooltipOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        infoTooltipRef.current &&
        !infoTooltipRef.current.contains(event.target as Node)
      ) {
        setIsInfoTooltipOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isInfoTooltipOpen]);

  // Update letter spacing value when currentStyles change
  React.useEffect(() => {
    const spacing = currentStyles.letterSpacing;
    if (spacing) {
      const numValue =
        typeof spacing === "string"
          ? parseFloat(spacing.replace("px", ""))
          : spacing;
      setLetterSpacingValue(isNaN(numValue) ? "0" : numValue.toString());
    } else {
      setLetterSpacingValue("0");
    }
  }, [currentStyles.letterSpacing]);

  // Helper function to clear all styles and restore defaults
  const clearStyles = React.useCallback(() => {
    if (!selectedBlock || !selectedBlockData) return;

    const defaultStyles = getStylesForHeadingLevel(getHeadingLevelFromStyles());

    // Reset all styles to defaults
    handleStyleChange({
      ...defaultStyles,
      fontFamily: "Helvetica",
      textAlign: "center",
      color: selectedBlockData.type === "Heading" ? "#111827" : "#374151",
      backgroundColor: "transparent",
      textHighlightColor: undefined,
      direction: "ltr",
      lineHeight: undefined,
      letterSpacing: undefined,
      listType: null,
      textDecoration: "none",
      fontStyle: "normal",
    });
  }, [
    selectedBlock,
    selectedBlockData,
    handleStyleChange,
    getStylesForHeadingLevel,
    getHeadingLevelFromStyles,
  ]);

  // Helper function to insert merge tag into content
  const insertMergeTag = React.useCallback(
    (tag: string) => {
      if (!selectedBlock) return;

      setCanvasBlocks((prev) => {
        const sectionBlocks = [
          ...prev[selectedBlock.section as keyof typeof prev],
        ];
        const blockIndex = sectionBlocks.findIndex(
          (b) => b.id === selectedBlock.id
        );
        if (blockIndex === -1) return prev;

        const currentBlock = sectionBlocks[blockIndex];
        const currentContent = currentBlock.content || "";
        const newContent = currentContent + tag;

        const updatedBlocks = [...sectionBlocks];
        updatedBlocks[blockIndex] = {
          ...currentBlock,
          content: newContent,
        };

        return {
          ...prev,
          [selectedBlock.section]: updatedBlocks,
        };
      });

      setIsMergeTagsDropdownOpen(false);
    },
    [selectedBlock, setCanvasBlocks]
  );

  // Common merge tags
  const mergeTags = [
    { label: "First Name", value: "*|FNAME|*" },
    { label: "Last Name", value: "*|LNAME|*" },
    { label: "Email", value: "*|EMAIL|*" },
    { label: "Company", value: "*|COMPANY|*" },
    { label: "Address", value: "*|ADDRESS|*" },
    { label: "City", value: "*|CITY|*" },
    { label: "State", value: "*|STATE|*" },
    { label: "Zip", value: "*|ZIP|*" },
    { label: "Country", value: "*|COUNTRY|*" },
    { label: "Phone", value: "*|PHONE|*" },
  ];

  if (!isTextBlockSelected) return null;

  const renderTextLinkModal = () => {
    if (!isTextLinkModalOpen) return null;
    const modalBody = (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Text Link</h3>
              <p className="text-sm text-gray-500">
                Add a link for this text block
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsTextLinkModalOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-5 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">
                Link to
              </label>
              <select
                value={textLinkType}
                onChange={(e) =>
                  setTextLinkType(e.target.value as ButtonLinkType)
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              >
                {linkOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={textLinkValue}
                placeholder={linkPlaceholders[textLinkType]}
                onChange={(e) => setTextLinkValue(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded"
                checked={textLinkOpenInNewTab}
                onChange={(e) => setTextLinkOpenInNewTab(e.target.checked)}
              />
              Open link in new tab
            </label>
            <div className="flex items-center gap-3 pt-1">
              {selectedBlockData?.textLinkValue && (
                <button
                  type="button"
                  onClick={handleRemoveTextLink}
                  className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveTextLink}
                disabled={!textLinkValue.trim()}
                className={`flex-1 rounded-md px-3 py-2 text-sm text-white ${
                  textLinkValue.trim()
                    ? "bg-[#3CCED7] hover:bg-[#2AB5BD]"
                    : "bg-blue-200 cursor-not-allowed"
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
    return typeof document !== "undefined"
      ? createPortal(modalBody, document.body)
      : modalBody;
  };

  return (
    <>
      {/* Hidden measurement wrapper */}
      {isTextBlockSelected && (
        <div
          ref={measurementWrapperRef}
          style={{
            position: "fixed",
            top: 0,
            left: "-9999px",
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-3 px-4 py-2">
            {toolbarGroups.map((group, index) => (
              <div
                key={`measure-${group.key}`}
                ref={(el) => {
                  measurementRefs.current[index] = el;
                }}
                className="flex items-center gap-2"
              >
                {group.element}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actual toolbar */}
      <div
        ref={toolbarContainerRef}
        className="sticky top-0 inset-x-0 z-30 bg-white border-b border-gray-200 shadow-sm"
      >
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="flex items-center gap-3 flex-1 overflow-visible">
            {visibleGroups.map((group, index) => (
              <div
                key={group.key}
                className={`flex items-center gap-2 min-w-fit ${
                  index !== visibleGroups.length - 1
                    ? "pr-3 border-r border-gray-200"
                    : ""
                }`}
              >
                {group.element}
              </div>
            ))}
          </div>

          {shouldShowOverflowButton && (
            <div className="relative" ref={overflowMenuRef}>
              <button
                type="button"
                onClick={() => setIsOverflowOpen((prevState) => !prevState)}
                className={`${baseToolbarButtonClasses} bg-gray-100 text-gray-700`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {isOverflowOpen && (
                <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg p-3 z-50 min-w-[480px]">
                  <div className="flex items-center gap-3">
                    {overflowGroups.map((group) => (
                      <div key={group.key} className="flex items-center gap-2">
                        {group.element}
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      {/* <button
                        type="button"
                        onClick={() => {}}
                        className={`${baseToolbarButtonClasses} ${
                          currentStyles.listType === "unordered"
                            ? "border border-[#3CCED7] bg-[#3CCED7]/10 text-[#1a9ba3]"
                            : ""
                        }`}
                        title="Unordered list"
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {}}
                        className={`${baseToolbarButtonClasses} ${
                          currentStyles.listType === "ordered"
                            ? "border border-[#3CCED7] bg-[#3CCED7]/10 text-[#1a9ba3]"
                            : ""
                        }`}
                        title="Ordered list"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </button> */}
                      <span
                        className="h-5 w-px bg-gray-200"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={clearStyles}
                        className={baseToolbarButtonClasses}
                        title="Clear styles"
                      >
                        <Strikethrough className="h-4 w-4" />
                      </button>
                      <span
                        className="h-5 w-px bg-gray-200"
                        aria-hidden="true"
                      />
                      <div className="relative" ref={mergeTagsDropdownRef}>
                        <button
                          type="button"
                          onClick={() =>
                            setIsMergeTagsDropdownOpen(!isMergeTagsDropdownOpen)
                          }
                          className="flex items-center gap-1 border border-gray-200 rounded-md px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                        >
                          <span>Merge Tags</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        {isMergeTagsDropdownOpen && (
                          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                            <div className="py-1">
                              {mergeTags.map((tag) => (
                                <button
                                  key={tag.value}
                                  type="button"
                                  onClick={() => insertMergeTag(tag.value)}
                                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {tag.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="relative" ref={infoTooltipRef}>
                        <button
                          type="button"
                          onClick={() =>
                            setIsInfoTooltipOpen(!isInfoTooltipOpen)
                          }
                          className={baseToolbarButtonClasses}
                          title="Info"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                        {isInfoTooltipOpen && (
                          <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white text-xs rounded-md px-3 py-2 z-50 max-w-[250px] shadow-lg">
                            <div className="space-y-1">
                              <div className="font-semibold">
                                Text Block Info
                              </div>
                              <div>
                                Type: {selectedBlockData?.type || "Unknown"}
                              </div>
                              <div>
                                Font: {currentStyles.fontFamily || "Helvetica"}
                              </div>
                              <div>Size: {currentStyles.fontSize || 16}px</div>
                              {currentStyles.listType && (
                                <div>List: {currentStyles.listType}</div>
                              )}
                            </div>
                            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {renderTextLinkModal()}
    </>
  );
};

export default TextToolbar;
