"use client";
import React, { useState, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  Info,
  Image as ImageIcon,
  Type,
  FileText,
  RectangleHorizontal,
  Minus,
  Square,
  Video,
  Share2,
  Hexagon,
  Sparkles,
  ListChecks,
  Code,
  Grid3x3,
  ShoppingBag,
  Heart,
  Columns2,
  Columns3,
  Columns4,
  LucideIcon,
  ChevronRight,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  X,
  ArrowRight,
  ArrowLeft,
  MoreHorizontal,
  Check,
} from "lucide-react";

interface ContentBlock {
  icon: LucideIcon;
  label: string;
  color: string;
  type: string;
}

interface BlankLayout {
  columns: number;
  label: string;
  icon: LucideIcon;
}

interface NavigationSidebarProps {
  activeNav: string;
  contentBlocks: ContentBlock[];
  blankLayouts: BlankLayout[];
  showMoreBlocks: boolean;
  setShowMoreBlocks: (show: boolean) => void;
  showMoreLayouts: boolean;
  setShowMoreLayouts: (show: boolean) => void;
  handleDragStart: (
    e: React.DragEvent,
    blockType: string,
    columns?: number
  ) => void;
  emailBackgroundColor?: string;
  setEmailBackgroundColor?: (color: string) => void;
  emailBodyColor?: string;
  setEmailBodyColor?: (color: string) => void;
  emailMobilePaddingLeft?: number;
  setEmailMobilePaddingLeft?: (value: number) => void;
  emailMobilePaddingRight?: number;
  setEmailMobilePaddingRight?: (value: number) => void;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeNav,
  contentBlocks,
  blankLayouts,
  showMoreBlocks,
  setShowMoreBlocks,
  showMoreLayouts,
  setShowMoreLayouts,
  handleDragStart,
  emailBackgroundColor = "transparent",
  setEmailBackgroundColor,
  emailBodyColor = "#ffffff",
  setEmailBodyColor,
  emailMobilePaddingLeft = 16,
  setEmailMobilePaddingLeft,
  emailMobilePaddingRight = 16,
  setEmailMobilePaddingRight,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const backgroundImageInputRef = useRef<HTMLInputElement>(null);
  const backgroundColorInputRef = useRef<HTMLInputElement>(null);
  const bodyColorInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleIncrement = (value: number, setValue?: (val: number) => void) => {
    if (setValue) {
      setValue(value + 1);
    }
  };

  const handleDecrement = (value: number, setValue?: (val: number) => void) => {
    if (setValue) {
      setValue(Math.max(0, value - 1));
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      {activeNav === "Add" && (
        <>
          {/* Content Blocks */}
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                CONTENT BLOCKS
              </h3>
              <p className="text-xs text-gray-500">
                Drag to add content to your email
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(showMoreBlocks ? contentBlocks : contentBlocks.slice(0, 9)).map(
                (block, index) => {
                  const Icon = block.icon;
                  return (
                    <div
                      key={index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, block.type)}
                      className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded hover:border-gray-300 hover:shadow-sm transition-all cursor-move"
                    >
                      <Icon className={`h-6 w-6 text-black mb-1`} />
                      <span className="text-xs text-gray-700 text-center">
                        {block.label}
                      </span>
                    </div>
                  );
                }
              )}
            </div>

            {/* {contentBlocks.length > 9 && (
              <button
                onClick={() => setShowMoreBlocks(!showMoreBlocks)}
                className="text-xs text-[#3CCED7] hover:underline flex items-center gap-1"
              >
                {showMoreBlocks ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    Show more
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )} */}
          </div>

          {/* Blank Layouts */}
          <div className="p-4 border-t border-gray-200">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                BLANK LAYOUTS
              </h3>
              <p className="text-xs text-gray-500">
                Drag to add layouts to your email
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(showMoreLayouts ? blankLayouts : blankLayouts.slice(0, 3)).map(
                (layout, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(e, "Layout", layout.columns)
                    }
                    className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded hover:border-gray-300 hover:shadow-sm transition-all cursor-move"
                  >
                    <div className="flex items-center justify-center mb-2">
                      {React.createElement(layout.icon, {
                        className: "h-5 w-5 text-gray-700",
                      })}
                    </div>
                    <span className="text-sm font-bold text-gray-700">
                      {layout.label}
                    </span>
                  </div>
                )
              )}
            </div>

            {/* {blankLayouts.length > 3 && (
              <button
                onClick={() => setShowMoreLayouts(!showMoreLayouts)}
                className="text-xs text-[#3CCED7] hover:underline flex items-center gap-1"
              >
                {showMoreLayouts ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    Show more
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )} */}
          </div>

          {/* Prebuilt Layouts */}
          {/* <div className="p-4 border-t border-gray-200">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                PREBUILT LAYOUTS
              </h3>
              <p className="text-xs text-gray-500">
                Drag to add layouts to your email
              </p>
            </div>

            <button className="w-full p-3 bg-white border border-gray-200 rounded hover:border-gray-300 hover:shadow-sm transition-all text-left">
              <span className="text-sm text-gray-700">Image & Text</span>
            </button> */}

            {/* <button className="text-xs text-[#3CCED7] hover:underline mt-4">
              Show more
            </button> */}
          {/* </div> */}
        </>
      )}

      {/* Whole Email styles changing section is disabled for now */}
      {activeNav === "Styles" && false && (
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Email Design
            </h3>
            <button className="text-gray-400 hover:text-gray-600">
              <Info className="h-5 w-5" />
            </button>
          </div>

          {[
            "Background",
            "Text",
            "Link",
            "Button",
            "Divider",
            "Image",
            "Logo",
          ].map((section) => {
            const isExpanded = expandedSections.has(section);
            return (
              <div key={section} className="border-b border-gray-200 pb-3">
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between text-left text-sm font-semibold text-[#3CCED7]"
                >
                  <span>{section}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-[#3CCED7]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#3CCED7]" />
                  )}
                </button>

                {isExpanded && section === "Background" && (
                  <div className="mt-4 space-y-6">
                    {/* ALL DEVICES Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ALL DEVICES
                      </h4>

                      {/* Background color */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-900">
                          Background color
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            backgroundColorInputRef.current?.click()
                          }
                          className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
                        >
                          <span>Select color</span>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-6 h-6 rounded-full border border-gray-200"
                              style={{ backgroundColor: emailBackgroundColor }}
                            />
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </span>
                        </button>
                        <input
                          ref={backgroundColorInputRef}
                          type="color"
                          value={emailBackgroundColor}
                          onChange={(e) =>
                            setEmailBackgroundColor?.(e.target.value)
                          }
                          className="hidden"
                        />
                      </div>

                      {/* Body color */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-900">
                          Body color
                        </label>
                        <button
                          type="button"
                          onClick={() => bodyColorInputRef.current?.click()}
                          className="w-full border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-800 hover:border-gray-300"
                        >
                          <span>Select color</span>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-6 h-6 rounded-full border border-gray-200"
                              style={{ backgroundColor: emailBodyColor }}
                            />
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </span>
                        </button>
                        <input
                          ref={bodyColorInputRef}
                          type="color"
                          value={emailBodyColor}
                          onChange={(e) => setEmailBodyColor?.(e.target.value)}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Background image */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="block text-sm font-medium text-gray-900">
                          Background image
                        </label>
                        <button className="text-gray-400 hover:text-gray-600">
                          <Info className="h-4 w-4" />
                        </button>
                      </div>
                      <div
                        onClick={() => backgroundImageInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-gray-400" />
                          </div>
                          <div className="text-sm text-gray-600 text-center">
                            Drop an Image or{" "}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                backgroundImageInputRef.current?.click();
                              }}
                              className="text-[#3CCED7] hover:text-[#1a9ba3] underline"
                            >
                              Browse
                            </button>
                          </div>
                        </div>
                        <input
                          ref={backgroundImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            // Handle image upload
                            const file = e.target.files?.[0];
                            if (file) {
                              // TODO: Handle image upload
                              console.log("Background image selected:", file);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Mobile Padding */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Mobile Padding
                      </h4>

                      <div className="space-y-3">
                        {/* Left padding */}
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-900">
                            Left
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={emailMobilePaddingLeft}
                              onChange={(e) =>
                                setEmailMobilePaddingLeft?.(
                                  Math.max(0, Number(e.target.value) || 0)
                                )
                              }
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                            />
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() =>
                                  handleIncrement(
                                    emailMobilePaddingLeft,
                                    setEmailMobilePaddingLeft
                                  )
                                }
                                className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                              >
                                <ChevronUp className="h-3 w-3 text-gray-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDecrement(
                                    emailMobilePaddingLeft,
                                    setEmailMobilePaddingLeft
                                  )
                                }
                                className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                              >
                                <ChevronDown className="h-3 w-3 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Right padding */}
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-900">
                            Right
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={emailMobilePaddingRight}
                              onChange={(e) =>
                                setEmailMobilePaddingRight?.(
                                  Math.max(0, Number(e.target.value) || 0)
                                )
                              }
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                            />
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() =>
                                  handleIncrement(
                                    emailMobilePaddingRight,
                                    setEmailMobilePaddingRight
                                  )
                                }
                                className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                              >
                                <ChevronUp className="h-3 w-3 text-gray-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDecrement(
                                    emailMobilePaddingRight,
                                    setEmailMobilePaddingRight
                                  )
                                }
                                className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                              >
                                <ChevronDown className="h-3 w-3 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isExpanded && section === "Text" && (
                  <div className="mt-4 space-y-6">
                    {/* Text Style Tabs */}
                    <div className="flex items-center gap-1 border-b border-gray-200">
                      {["P", "H1", "H2", "H3", "H4"].map((tab) => (
                        <button
                          key={tab}
                          className={`px-3 py-2 text-sm font-medium relative ${
                            tab === "P"
                              ? "text-[#3CCED7]"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          {tab}
                          {tab === "P" && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3CCED7]" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* ALL DEVICES Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ALL DEVICES
                      </h4>

                      {/* Paragraph Section */}
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-gray-900">
                          Paragraph
                        </label>

                        {/* Font and Color Row */}
                        <div className="flex items-center gap-2">
                          <select className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]">
                            <option>Helvetica</option>
                            <option>Arial</option>
                            <option>Georgia</option>
                          </select>
                          <button className="w-8 h-8 rounded-full bg-black border border-gray-200 hover:border-gray-300" />
                        </div>

                        {/* Bold/Italic and Alignment Row */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                            <button className="px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 border-r border-gray-200">
                              B
                            </button>
                            <button className="px-3 py-2 text-sm italic text-gray-700 hover:bg-gray-50">
                              I
                            </button>
                          </div>
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                            <button className="px-2 py-2 text-gray-700 hover:bg-gray-50 border-r border-gray-200">
                              <AlignLeft className="h-4 w-4" />
                            </button>
                            <button className="px-2 py-2 text-[#3CCED7] bg-[#3CCED7]/10 hover:bg-[#3CCED7]/15 border-r border-gray-200">
                              <AlignCenter className="h-4 w-4" />
                            </button>
                            <button className="px-2 py-2 text-gray-700 hover:bg-gray-50 border-r border-gray-200">
                              <AlignRight className="h-4 w-4" />
                            </button>
                            <button className="px-2 py-2 text-gray-700 hover:bg-gray-50">
                              <AlignJustify className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Letter spacing */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Letter spacing
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            defaultValue={0}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronUp className="h-3 w-3 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronDown className="h-3 w-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Colors */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Colors
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Block Background"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <button className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg hover:border-gray-300">
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                          <button className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg hover:border-gray-300">
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      </div>

                      {/* Rounded Corners */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-gray-900">
                            Rounded Corners
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                            />
                            <span className="text-sm text-gray-700">
                              Apply to all sides
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            defaultValue={0}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronUp className="h-3 w-3 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronDown className="h-3 w-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Border */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Border
                        </label>
                        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]">
                          <option>None</option>
                          <option>Solid</option>
                          <option>Dashed</option>
                          <option>Dotted</option>
                        </select>
                      </div>

                      {/* Text Direction */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Text Direction
                        </label>
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg overflow-hidden">
                          <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border-r border-gray-200">
                            <div className="flex flex-col items-center">
                              <span className="text-base font-semibold">A</span>
                              <ArrowRight className="h-3 w-3" />
                            </div>
                            <span>Left to right</span>
                          </button>
                          <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <div className="flex flex-col items-center">
                              <span className="text-base font-semibold">A</span>
                              <ArrowLeft className="h-3 w-3" />
                            </div>
                            <span>Right to left</span>
                          </button>
                        </div>
                      </div>

                      {/* DEVICE-SPECIFIC */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          DEVICE-SPECIFIC
                        </h4>

                        {/* On Desktop */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-semibold text-gray-900">
                            On Desktop
                          </h5>

                          {/* Font size */}
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-900">
                              Font size
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={16}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Line height */}
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-900">
                              Line height
                            </label>
                            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]">
                              <option>1.5</option>
                              <option>1</option>
                              <option>1.2</option>
                              <option>2</option>
                            </select>
                          </div>

                          {/* Paragraph spacing */}
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-900">
                              Paragraph spacing
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={0}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* On Mobile */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-semibold text-gray-900">
                            On Mobile
                          </h5>

                          {/* Font size */}
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-900">
                              Font size
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={16}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Line height */}
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-900">
                              Line height
                            </label>
                            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]">
                              <option>1.5</option>
                              <option>1</option>
                              <option>1.2</option>
                              <option>2</option>
                            </select>
                          </div>

                          {/* Paragraph spacing */}
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-900">
                              Paragraph spacing
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={0}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isExpanded && section === "Link" && (
                  <div className="mt-4 space-y-6">
                    {/* ALL DEVICES Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ALL DEVICES
                      </h4>

                      {/* Link color and Style row */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Link color */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-900">
                            Link color
                          </label>
                          <button className="w-8 h-8 rounded-full bg-black border border-gray-200 hover:border-gray-300" />
                        </div>

                        {/* Style */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-900">
                            Style
                          </label>
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                            <button className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                              B
                            </button>
                            <button className="px-3 py-2 text-sm italic text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                              I
                            </button>
                            <button className="px-3 py-2 text-sm underline text-[#3CCED7] bg-[#3CCED7]/10 hover:bg-[#3CCED7]/15 border-[#3CCED7]/30">
                              U
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isExpanded && section === "Button" && (
                  <div className="mt-4 space-y-6">
                    {/* ALL DEVICES Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ALL DEVICES
                      </h4>

                      {/* Shape */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Shape
                        </label>
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                          <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border-r border-gray-200">
                            Square
                          </button>
                          <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                            Round
                          </button>
                          <div className="flex items-center gap-1 flex-1">
                            <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50">
                              Pill
                            </button>
                            <button className="px-2 py-2 text-gray-400 hover:text-gray-600">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Colors */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Colors
                        </label>
                        <div className="space-y-2">
                          {/* Button color */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">
                              Button
                            </span>
                            <div className="flex items-center gap-2">
                              <button className="w-6 h-6 rounded-full bg-black border border-gray-200 hover:border-gray-300" />
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                          {/* Text color */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Text</span>
                            <div className="flex items-center gap-2">
                              <button className="w-6 h-6 rounded-full bg-white border border-gray-200 hover:border-gray-300" />
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                          {/* Block Background */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">
                              Block Background
                            </span>
                            <div className="flex items-center gap-2">
                              <button className="w-6 h-6 rounded-full bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center">
                                <X className="h-3 w-3 text-gray-400" />
                              </button>
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Border */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Border
                        </label>
                        <select
                          defaultValue="Solid"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] mb-2"
                        >
                          <option>None</option>
                          <option>Solid</option>
                          <option>Dashed</option>
                          <option>Dotted</option>
                        </select>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            defaultValue={2}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronUp className="h-3 w-3 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronDown className="h-3 w-3 text-gray-600" />
                            </button>
                          </div>
                          <button className="w-8 h-8 rounded-full bg-black border border-gray-200 hover:border-gray-300" />
                        </div>
                      </div>

                      {/* Button font */}
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-gray-900">
                          Button font
                        </label>
                        <div className="flex items-center gap-2">
                          <select className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]">
                            <option>Helvetica</option>
                            <option>Arial</option>
                            <option>Georgia</option>
                          </select>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              defaultValue={16}
                              className="w-16 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                            />
                            <div className="flex flex-col">
                              <button
                                type="button"
                                className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                              >
                                <ChevronUp className="h-3 w-3 text-gray-600" />
                              </button>
                              <button
                                type="button"
                                className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                              >
                                <ChevronDown className="h-3 w-3 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {/* Text Style Buttons */}
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                          <button className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                            B
                          </button>
                          <button className="px-3 py-2 text-sm italic text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                            I
                          </button>
                          <button className="px-3 py-2 text-sm underline text-gray-700 bg-white hover:bg-gray-50">
                            U
                          </button>
                        </div>
                        {/* Text Alignment Buttons */}
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                          <button className="px-2 py-2 text-gray-700 hover:bg-gray-50 border-r border-gray-200">
                            <AlignLeft className="h-4 w-4" />
                          </button>
                          <button className="px-2 py-2 text-[#3CCED7] bg-[#3CCED7]/10 hover:bg-[#3CCED7]/15 border-r border-gray-200">
                            <AlignCenter className="h-4 w-4" />
                          </button>
                          <button className="px-2 py-2 text-gray-700 hover:bg-gray-50 border-r border-gray-200">
                            <AlignRight className="h-4 w-4" />
                          </button>
                          <button className="px-2 py-2 text-gray-700 hover:bg-gray-50">
                            <AlignJustify className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Letter spacing */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Letter spacing
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            defaultValue={0}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronUp className="h-3 w-3 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronDown className="h-3 w-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* DEVICE-SPECIFIC */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          DEVICE-SPECIFIC
                        </h4>

                        {/* Link Desktop and Mobile Styles toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">
                            Link Desktop and Mobile Styles
                          </span>
                          <button className="relative w-11 h-6 bg-[#3CCED7] rounded-full flex items-center justify-end px-1">
                            <Check className="h-4 w-4 text-white" />
                          </button>
                        </div>

                        {/* Alignment */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-900">
                            Alignment
                          </label>
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                            <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border-r border-gray-200">
                              Left
                            </button>
                            <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                              Center
                            </button>
                            <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50">
                              Right
                            </button>
                          </div>
                        </div>

                        {/* Button size */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-900">
                            Button size
                          </label>
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                            <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                              Small
                            </button>
                            <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border-r border-gray-200">
                              Medium
                            </button>
                            <div className="flex items-center gap-1 flex-1">
                              <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100">
                                Large
                              </button>
                              <button className="px-2 py-2 text-gray-400 hover:text-gray-600">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Padding */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-semibold text-gray-900">
                              Padding
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                              />
                              <span className="text-sm text-gray-700">
                                Apply to all sides
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {/* Top */}
                            <div className="space-y-1">
                              <label className="block text-xs text-gray-600">
                                Top
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  defaultValue={12}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                                />
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                  >
                                    <ChevronUp className="h-3 w-3 text-gray-600" />
                                  </button>
                                  <button
                                    type="button"
                                    className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                  >
                                    <ChevronDown className="h-3 w-3 text-gray-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            {/* Bottom */}
                            <div className="space-y-1">
                              <label className="block text-xs text-gray-600">
                                Bottom
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  defaultValue={12}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                                />
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                  >
                                    <ChevronUp className="h-3 w-3 text-gray-600" />
                                  </button>
                                  <button
                                    type="button"
                                    className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                  >
                                    <ChevronDown className="h-3 w-3 text-gray-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            {/* Left */}
                            <div className="space-y-1">
                              <label className="block text-xs text-gray-600">
                                Left
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  defaultValue={24}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                                />
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                  >
                                    <ChevronUp className="h-3 w-3 text-gray-600" />
                                  </button>
                                  <button
                                    type="button"
                                    className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                  >
                                    <ChevronDown className="h-3 w-3 text-gray-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            {/* Right */}
                            <div className="space-y-1">
                              <label className="block text-xs text-gray-600">
                                Right
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  defaultValue={24}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                                />
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                  >
                                    <ChevronUp className="h-3 w-3 text-gray-600" />
                                  </button>
                                  <button
                                    type="button"
                                    className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                  >
                                    <ChevronDown className="h-3 w-3 text-gray-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isExpanded && section === "Divider" && (
                  <div className="mt-4 space-y-6">
                    {/* ALL DEVICES Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ALL DEVICES
                      </h4>

                      {/* Style */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Style
                        </label>
                        <select
                          defaultValue="Solid"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                        >
                          <option>None</option>
                          <option>Solid</option>
                          <option>Dashed</option>
                          <option>Dotted</option>
                        </select>
                      </div>

                      {/* Colors */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Colors
                        </label>
                        <div className="space-y-2">
                          {/* Line color */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Line</span>
                            <div className="flex items-center gap-2">
                              <button className="w-6 h-6 rounded-full bg-black border border-gray-200 hover:border-gray-300" />
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                          {/* Block Background */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">
                              Block Background
                            </span>
                            <div className="flex items-center gap-2">
                              <button className="w-6 h-6 rounded-full bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center">
                                <X className="h-3 w-3 text-gray-400" />
                              </button>
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DEVICE-SPECIFIC */}
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        DEVICE-SPECIFIC
                      </h4>

                      {/* Link Desktop and Mobile Styles toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          Link Desktop and Mobile Styles
                        </span>
                        <button className="relative w-11 h-6 bg-[#3CCED7] rounded-full flex items-center justify-end px-1">
                          <Check className="h-4 w-4 text-white" />
                        </button>
                      </div>

                      {/* Thickness */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Thickness
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            defaultValue={2}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <span className="text-sm text-gray-700 w-12 text-right">
                            2px
                          </span>
                        </div>
                      </div>

                      {/* Padding */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-gray-900">
                            Padding
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                            />
                            <span className="text-sm text-gray-700">
                              Apply to all sides
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Top */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Top
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={12}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Bottom */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Bottom
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={12}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Left */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Left
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={24}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Right */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Right
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={24}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isExpanded && section === "Image" && (
                  <div className="mt-4 space-y-6">
                    {/* ALL DEVICES Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ALL DEVICES
                      </h4>

                      {/* Colors */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Colors
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Block Background"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <button className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg hover:border-gray-300">
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                          <button className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg hover:border-gray-300">
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      </div>

                      {/* Rounded Corners */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-gray-900">
                            Rounded Corners
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                            />
                            <span className="text-sm text-gray-700">
                              Apply to all sides
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            defaultValue={0}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronUp className="h-3 w-3 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronDown className="h-3 w-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Border */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Border
                        </label>
                        <select
                          defaultValue="None"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                        >
                          <option>None</option>
                          <option>Solid</option>
                          <option>Dashed</option>
                          <option>Dotted</option>
                        </select>
                      </div>
                    </div>

                    {/* DEVICE-SPECIFIC */}
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        DEVICE-SPECIFIC
                      </h4>

                      {/* Link Desktop and Mobile Styles toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          Link Desktop and Mobile Styles
                        </span>
                        <button className="relative w-11 h-6 bg-[#3CCED7] rounded-full flex items-center justify-end px-1">
                          <Check className="h-4 w-4 text-white" />
                        </button>
                      </div>

                      {/* Alignment */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Alignment
                        </label>
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                          <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border-r border-gray-200">
                            Left
                          </button>
                          <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                            Center
                          </button>
                          <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100">
                            Right
                          </button>
                        </div>
                      </div>

                      {/* Padding */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-gray-900">
                            Padding
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                            />
                            <span className="text-sm text-gray-700">
                              Apply to all sides
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Top */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Top
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={12}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Bottom */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Bottom
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={12}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Left */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Left
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={24}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Right */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Right
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={24}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isExpanded && section === "Logo" && (
                  <div className="mt-4 space-y-6">
                    {/* ALL DEVICES Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        ALL DEVICES
                      </h4>

                      {/* Colors */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Colors
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Block Background"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <button className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg hover:border-gray-300">
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                          <button className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg hover:border-gray-300">
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      </div>

                      {/* Rounded Corners */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-gray-900">
                            Rounded Corners
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                            />
                            <span className="text-sm text-gray-700">
                              Apply to all sides
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            defaultValue={0}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronUp className="h-3 w-3 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                            >
                              <ChevronDown className="h-3 w-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Border */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Border
                        </label>
                        <select
                          defaultValue="None"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                        >
                          <option>None</option>
                          <option>Solid</option>
                          <option>Dashed</option>
                          <option>Dotted</option>
                        </select>
                      </div>
                    </div>

                    {/* DEVICE-SPECIFIC */}
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        DEVICE-SPECIFIC
                      </h4>

                      {/* Link Desktop and Mobile Styles toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          Link Desktop and Mobile Styles
                        </span>
                        <button className="relative w-11 h-6 bg-[#3CCED7] rounded-full flex items-center justify-end px-1">
                          <Check className="h-4 w-4 text-white" />
                        </button>
                      </div>

                      {/* Alignment */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                          Alignment
                        </label>
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                          <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border-r border-gray-200">
                            Left
                          </button>
                          <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 border-r border-gray-200">
                            Center
                          </button>
                          <button className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100">
                            Right
                          </button>
                        </div>
                      </div>

                      {/* Padding */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-gray-900">
                            Padding
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                            />
                            <span className="text-sm text-gray-700">
                              Apply to all sides
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Top */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Top
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={12}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Bottom */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Bottom
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={12}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Left */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Left
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={24}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Right */}
                          <div className="space-y-1">
                            <label className="block text-xs text-gray-600">
                              Right
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={24}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                              />
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="border border-gray-200 rounded-t px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronUp className="h-3 w-3 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  className="border border-t-0 border-gray-200 rounded-b px-2 py-1 hover:bg-gray-50"
                                >
                                  <ChevronDown className="h-3 w-3 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* {activeNav === "Optimize" && (
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Optimization
          </h3>
          <p className="text-sm text-gray-600">
            Optimization settings will be added here.
          </p>
        </div>
      )} */}
    </div>
  );
};

export default NavigationSidebar;
