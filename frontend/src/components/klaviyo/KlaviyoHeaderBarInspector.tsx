"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  GripVertical,
  Trash2,
  ImageIcon,
  Link as LinkIcon,
  Plus,
  Edit2,
  X,
} from "lucide-react";
import {
  CanvasBlock,
  TextStyles,
  BlockBoxStyles,
  ButtonLinkType,
} from "@/components/mailchimp/email-builder/types";
import KlaviyoImageSelectionModal from "./KlaviyoImageSelectionModal";
import { KlaviyoImageItem } from "@/lib/api/klaviyoApi";
import KlaviyoColorPicker from "./KlaviyoColorPicker";

interface KlaviyoHeaderBarInspectorProps {
  selectedBlockData: CanvasBlock | null;
  updateHeaderBarSettings: (updates: Partial<CanvasBlock>) => void;
}

type HeaderBarLayout = "logo-stacked" | "logo-inline" | "logo-centered" | "links-only";

const KlaviyoHeaderBarInspector: React.FC<KlaviyoHeaderBarInspectorProps> = ({
  selectedBlockData,
  updateHeaderBarSettings,
}) => {
  const [showLogoImageModal, setShowLogoImageModal] = useState(false);
  const [showItemImageModal, setShowItemImageModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isPaddingLinked, setIsPaddingLinked] = useState(true);
  const [isLinkTextColorPickerOpen, setIsLinkTextColorPickerOpen] = useState(false);

  const parseNumeric = (
    value: string | number | undefined,
    fallback: number
  ) => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number") return value;
    const parsed = parseFloat(value.toString().replace("px", ""));
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const generateItemId = () => {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleUpdate = (updates: Partial<CanvasBlock>) => {
    if (!selectedBlockData) return;
    updateHeaderBarSettings(updates);
  };

  // Get current values
  const layout: HeaderBarLayout = selectedBlockData?.headerBarLayout || "logo-stacked";
  const logoUrl = selectedBlockData?.headerBarLogoUrl;
  const items = selectedBlockData?.headerBarItems || [];
  const linkStyles: TextStyles = selectedBlockData?.headerBarLinkStyles || {};
  const blockStyles: BlockBoxStyles = selectedBlockData?.headerBarBlockStyles || {};
  const itemPadding = parseNumeric(selectedBlockData?.headerBarItemPadding, 10);
  const itemAlignment = selectedBlockData?.headerBarItemAlignment || "center";

  // Link text styles
  const fontFamily = linkStyles.fontFamily || "Arial";
  const fontSize = parseNumeric(linkStyles.fontSize, 14);
  const textColor = linkStyles.color || "#000000";
  const lineHeight = parseNumeric(linkStyles.lineHeight, 0);
  const isBold = linkStyles.fontWeight === "bold";
  const isItalic = linkStyles.fontStyle === "italic";
  const isUnderline = linkStyles.textDecoration === "underline";
  const isStrikethrough = linkStyles.textDecoration === "line-through";

  const updateLinkStyles = (updates: Partial<TextStyles>) => {
    const currentStyles = linkStyles;
    handleUpdate({
      headerBarLinkStyles: { ...currentStyles, ...updates },
    });
  };

  const handleLogoImageSelect = (image: KlaviyoImageItem) => {
    handleUpdate({ headerBarLogoUrl: image.preview_url });
    setShowLogoImageModal(false);
  };

  const handleAddImageItem = (image: KlaviyoImageItem) => {
    const newItem = {
      id: generateItemId(),
      type: "image" as const,
      imageUrl: image.preview_url,
      imageAltText: image.name || "Image",
    };
    handleUpdate({
      headerBarItems: [...items, newItem],
    });
    setShowItemImageModal(false);
  };

  const handleAddLink = () => {
    const newItem = {
      id: generateItemId(),
      type: "link" as const,
      content: "Link text",
      linkAddress: "",
      linkType: "Web" as ButtonLinkType,
      linkOpenInNewTab: true,
    };
    handleUpdate({
      headerBarItems: [...items, newItem],
    });
    setEditingItemId(newItem.id);
  };

  const handleUpdateItem = (itemId: string, updates: Partial<NonNullable<CanvasBlock["headerBarItems"]>[0]>) => {
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    handleUpdate({ headerBarItems: updatedItems });
  };

  const handleDeleteItem = (itemId: string) => {
    const updatedItems = items.filter((item) => item.id !== itemId);
    handleUpdate({ headerBarItems: updatedItems });
    if (editingItemId === itemId) {
      setEditingItemId(null);
    }
  };

  const layoutOptions = [
    { value: "logo-stacked", label: "Logo stacked" },
    { value: "logo-inline", label: "Logo inline" },
    { value: "logo-centered", label: "Logo centered" },
    { value: "links-only", label: "Links and buttons only" },
  ];

  const editingItem = editingItemId ? items.find((item) => item.id === editingItemId) : null;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {/* Layout Section */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-900">Desktop layout</label>
          <div className="relative">
            <select
              value={layout}
              onChange={(e) =>
                handleUpdate({ headerBarLayout: e.target.value as HeaderBarLayout })
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] appearance-none bg-white"
            >
              {layoutOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
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

        {/* Logo Image Upload Section (conditional) */}
        {layout !== "links-only" && (
          <div className="space-y-4">
            <span className="block text-sm font-semibold text-gray-900">Logo</span>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {logoUrl ? (
                <div className="relative w-full aspect-video rounded overflow-hidden bg-white mb-3">
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-full aspect-video rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm mb-3">
                  No logo selected
                </div>
              )}
              <button
                onClick={() => setShowLogoImageModal(true)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                {logoUrl ? "Replace logo" : "Select logo"}
              </button>
              {logoUrl && (
                <button
                  onClick={() => handleUpdate({ headerBarLogoUrl: undefined })}
                  className="mt-2 w-full px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="block text-sm font-semibold text-gray-900">Content</span>
          </div>
          
          {/* Items List */}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-3 bg-white"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {item.type === "image" ? (
                    <ImageIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <LinkIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {item.type === "image" ? (
                      <div className="text-sm text-gray-700 truncate">
                        {item.imageAltText || "Image"}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700 truncate">
                        {item.content || "Link text"}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setEditingItemId(editingItemId === item.id ? null : item.id)
                    }
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Edit2 className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>

                {/* Edit Item Form */}
                {editingItemId === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    {item.type === "image" ? (
                      <>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Image
                          </label>
                          {item.imageUrl ? (
                            <div className="relative w-full h-24 rounded overflow-hidden bg-gray-50 border border-gray-200">
                              <Image
                                src={item.imageUrl}
                                alt={item.imageAltText || "Image"}
                                fill
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-full h-24 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                              No image
                            </div>
                          )}
                          <button
                            onClick={() => setShowItemImageModal(true)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                          >
                            {item.imageUrl ? "Replace image" : "Select image"}
                          </button>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Alt Text
                          </label>
                          <input
                            type="text"
                            value={item.imageAltText || ""}
                            onChange={(e) =>
                              handleUpdateItem(item.id, { imageAltText: e.target.value })
                            }
                            placeholder="Describe the image"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Link Text
                          </label>
                          <input
                            type="text"
                            value={item.content || ""}
                            onChange={(e) =>
                              handleUpdateItem(item.id, { content: e.target.value })
                            }
                            placeholder="Link text"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Link Type
                          </label>
                          <select
                            value={item.linkType || "Web"}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                linkType: e.target.value as ButtonLinkType,
                              })
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          >
                            <option value="Web">Web</option>
                            <option value="Email">Email</option>
                            <option value="Phone">Phone</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Link Address
                          </label>
                          <input
                            type="text"
                            value={item.linkAddress || ""}
                            onChange={(e) =>
                              handleUpdateItem(item.id, { linkAddress: e.target.value })
                            }
                            placeholder={
                              item.linkType === "Email"
                                ? "name@example.com"
                                : item.linkType === "Phone"
                                ? "+1 (555) 123-4567"
                                : "https://example.com"
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                          />
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`open-new-tab-${item.id}`}
                            checked={item.linkOpenInNewTab ?? true}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                linkOpenInNewTab: e.target.checked,
                              })
                            }
                            className="h-4 w-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                          />
                          <label
                            htmlFor={`open-new-tab-${item.id}`}
                            className="ml-2 block text-sm text-gray-700"
                          >
                            Open in new tab
                          </label>
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => setEditingItemId(null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingItemId(null);
                setShowItemImageModal(true);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add image
            </button>
            <button
              onClick={handleAddLink}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add link
            </button>
          </div>
        </div>

        {/* Link Text Section */}
        <div className="space-y-4">
          <span className="block text-sm font-semibold text-gray-900">Link text</span>

          {/* Font Family */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Font Family</label>
            <div className="relative">
              <select
                value={fontFamily}
                onChange={(e) => updateLinkStyles({ fontFamily: e.target.value })}
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
            <label className="block text-xs font-medium text-gray-700">Font Size</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
              <input
                type="number"
                min={8}
                max={72}
                value={fontSize}
                onChange={(e) =>
                  updateLinkStyles({ fontSize: Number(e.target.value || 14) })
                }
                className="flex-1 text-sm outline-none"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>
          </div>

          {/* Text Color */}
          {isLinkTextColorPickerOpen ? (
            <KlaviyoColorPicker
              currentColor={textColor}
              onColorChange={(color) => updateLinkStyles({ color })}
              onClose={() => setIsLinkTextColorPickerOpen(false)}
              title="Text Color"
            />
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Text Color</label>
              <button
                type="button"
                onClick={() => setIsLinkTextColorPickerOpen(true)}
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

          {/* Line Height */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Line Height</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-sm">|A|</span>
              <input
                type="number"
                min={0}
                value={lineHeight}
                onChange={(e) =>
                  updateLinkStyles({ lineHeight: Number(e.target.value || 0) })
                }
                className="flex-1 text-sm outline-none"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>
          </div>

          {/* Text Styling Buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Text Styling</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateLinkStyles({ fontWeight: isBold ? "normal" : "bold" })
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
                  updateLinkStyles({ fontStyle: isItalic ? "normal" : "italic" })
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
                  updateLinkStyles({
                    textDecoration: isUnderline ? "none" : "underline",
                  })
                }
                className={`p-2 border rounded-lg ${
                  isUnderline
                    ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Underline className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateLinkStyles({
                    textDecoration: isStrikethrough ? "none" : "line-through",
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

        {/* Padding Section */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Padding</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 min-w-0">
              <div className="w-4 h-4 border border-gray-400 flex-shrink-0" />
              <input
                type="number"
                min={0}
                value={itemPadding}
                onChange={(e) =>
                  handleUpdate({ headerBarItemPadding: Number(e.target.value || 0) })
                }
                className="flex-1 text-sm outline-none min-w-0"
                placeholder="0"
              />
              <span className="text-xs text-gray-500 flex-shrink-0">px</span>
            </div>
            <button
              onClick={() => setIsPaddingLinked(!isPaddingLinked)}
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

        {/* Alignment Section */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Alignment</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleUpdate({ headerBarItemAlignment: "left" })}
              className={`p-2 border rounded-lg ${
                itemAlignment === "left"
                  ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleUpdate({ headerBarItemAlignment: "center" })}
              className={`p-2 border rounded-lg ${
                itemAlignment === "center"
                  ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleUpdate({ headerBarItemAlignment: "right" })}
              className={`p-2 border rounded-lg ${
                itemAlignment === "right"
                  ? "bg-[#3CCED7] text-white border-[#3CCED7]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <AlignRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Block Padding Section */}
        <div className="space-y-4">
          <span className="block text-sm font-semibold text-gray-900">Block padding</span>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="block text-xs font-medium text-gray-700 w-1/3">Top</label>
              <input
                type="number"
                value={parseNumeric(blockStyles.paddingTop, 0)}
                onChange={(e) =>
                  handleUpdate({
                    headerBarBlockStyles: {
                      ...blockStyles,
                      paddingTop: `${e.target.value}px`,
                    },
                  })
                }
                className="w-2/3 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-xs font-medium text-gray-700 w-1/3">Bottom</label>
              <input
                type="number"
                value={parseNumeric(blockStyles.paddingBottom, 0)}
                onChange={(e) =>
                  handleUpdate({
                    headerBarBlockStyles: {
                      ...blockStyles,
                      paddingBottom: `${e.target.value}px`,
                    },
                  })
                }
                className="w-2/3 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-xs font-medium text-gray-700 w-1/3">Left</label>
              <input
                type="number"
                value={parseNumeric(blockStyles.paddingLeft, 0)}
                onChange={(e) =>
                  handleUpdate({
                    headerBarBlockStyles: {
                      ...blockStyles,
                      paddingLeft: `${e.target.value}px`,
                    },
                  })
                }
                className="w-2/3 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-xs font-medium text-gray-700 w-1/3">Right</label>
              <input
                type="number"
                value={parseNumeric(blockStyles.paddingRight, 0)}
                onChange={(e) =>
                  handleUpdate({
                    headerBarBlockStyles: {
                      ...blockStyles,
                      paddingRight: `${e.target.value}px`,
                    },
                  })
                }
                className="w-2/3 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Image Selection Modals */}
      <KlaviyoImageSelectionModal
        isOpen={showLogoImageModal}
        onClose={() => setShowLogoImageModal(false)}
        onSelect={handleLogoImageSelect}
      />
      <KlaviyoImageSelectionModal
        isOpen={showItemImageModal}
        onClose={() => setShowItemImageModal(false)}
        onSelect={(image) => {
          if (editingItemId) {
            handleUpdateItem(editingItemId, {
              imageUrl: image.preview_url,
              type: "image",
            });
            setShowItemImageModal(false);
          } else {
            handleAddImageItem(image);
          }
        }}
      />
    </div>
  );
};

export default KlaviyoHeaderBarInspector;

