"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { BoardItem } from "@/lib/api/miroApi";
import { Trash2 } from "lucide-react";
import { ToolType } from "./hooks/useToolDnD";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EmojiClickData } from "emoji-picker-react";

const EmojiPicker = dynamic(() => import("emoji-picker-react").then((m) => m.default), {
  ssr: false,
});

interface BoardPropertiesPanelProps {
  selectedItem: BoardItem | null;
  selectedItemsCount?: number;
  activeTool?: ToolType;
  brushSettings?: {
    strokeColor: string;
    strokeWidth: number;
  };
  onBrushSettingsChange?: (settings: { strokeColor: string; strokeWidth: number }) => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
  onDelete: () => void;
}

export default function BoardPropertiesPanel({
  selectedItem,
  selectedItemsCount = 0,
  activeTool,
  brushSettings,
  onBrushSettingsChange,
  onUpdate,
  onDelete,
}: BoardPropertiesPanelProps) {
  const [emojiReplaceOpen, setEmojiReplaceOpen] = useState(false);

  // Show brush configuration when freehand tool is active and no item is selected
  if (!selectedItem && activeTool === "freehand" && brushSettings && onBrushSettingsChange) {
    return (
      <div className="w-64 border-l bg-white p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Brush Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Stroke Color</label>
            <input
              type="color"
              value={brushSettings.strokeColor}
              onChange={(e) =>
                onBrushSettingsChange({
                  ...brushSettings,
                  strokeColor: e.target.value,
                })
              }
              className="w-full h-8 border rounded mt-1 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              Stroke Width: {brushSettings.strokeWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSettings.strokeWidth}
              onChange={(e) =>
                onBrushSettingsChange({
                  ...brushSettings,
                  strokeWidth: parseInt(e.target.value, 10),
                })
              }
              className="w-full mt-1"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!selectedItem) {
    if (selectedItemsCount > 1) {
      return (
        <div className="w-64 border-l bg-white p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Multi-selection</h3>
          <p className="text-sm text-gray-500 mb-4">{selectedItemsCount} items selected</p>
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">Delete Selected</span>
          </button>
        </div>
      );
    }
    return (
      <div className="w-64 border-l bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Board Properties
        </h3>
        <p className="text-sm text-gray-500">Select an item to edit properties</p>
      </div>
    );
  }

  return (
    <div className="w-64 border-l bg-white p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Properties</h3>

      <div className="space-y-4">
        {/* Position */}
        <div>
          <label className="text-xs font-medium text-gray-600">Position</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <input
              type="number"
              value={Math.round(selectedItem.x)}
              onChange={(e) =>
                onUpdate({ x: parseFloat(e.target.value) || 0 })
              }
              className="text-sm border rounded px-2 py-1"
              placeholder="X"
            />
            <input
              type="number"
              value={Math.round(selectedItem.y)}
              onChange={(e) =>
                onUpdate({ y: parseFloat(e.target.value) || 0 })
              }
              className="text-sm border rounded px-2 py-1"
              placeholder="Y"
            />
          </div>
        </div>

        {/* Size */}
        <div>
          <label className="text-xs font-medium text-gray-600">Size</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <input
              type="number"
              value={Math.round(selectedItem.width)}
              onChange={(e) =>
                onUpdate({ width: parseFloat(e.target.value) || 0 })
              }
              className="text-sm border rounded px-2 py-1"
              placeholder="Width"
            />
            <input
              type="number"
              value={Math.round(selectedItem.height)}
              onChange={(e) =>
                onUpdate({ height: parseFloat(e.target.value) || 0 })
              }
              className="text-sm border rounded px-2 py-1"
              placeholder="Height"
            />
          </div>
        </div>

        {selectedItem.type === "emoji" && (
          <div>
            <label className="text-xs font-medium text-gray-600">Emoji</label>
            <div className="flex gap-2 mt-1 items-center">
              <input
                type="text"
                value={selectedItem.content || ""}
                onChange={(e) => onUpdate({ content: e.target.value })}
                className="flex-1 text-sm border rounded px-2 py-1"
                placeholder="Paste or type an emoji"
              />
              <Popover open={emojiReplaceOpen} onOpenChange={setEmojiReplaceOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50 shrink-0"
                  >
                    Replace…
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto max-h-[min(420px,70vh)] overflow-y-auto p-0 border-0 shadow-lg"
                  align="end"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <EmojiPicker
                    onEmojiClick={(data: EmojiClickData) => {
                      onUpdate({ content: data.emoji });
                      setEmojiReplaceOpen(false);
                    }}
                    width={280}
                    height={360}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Resize the box to scale; optional fixed size below overrides auto sizing.
            </p>
            <label className="text-xs font-medium text-gray-600 mt-2 block">
              Font size:{" "}
              {typeof selectedItem.style?.fontSize === "number"
                ? `${selectedItem.style.fontSize}px`
                : `Auto (${Math.round(
                    Math.max(16, Math.min(selectedItem.height * 0.72, selectedItem.width * 0.72))
                  )}px preview)`}
            </label>
            <input
              type="range"
              min={8}
              max={200}
              value={
                typeof selectedItem.style?.fontSize === "number"
                  ? selectedItem.style.fontSize
                  : Math.round(
                      Math.max(16, Math.min(selectedItem.height * 0.72, selectedItem.width * 0.72))
                    )
              }
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onUpdate({
                  style: {
                    ...selectedItem.style,
                    fontSize: n,
                  },
                });
              }}
              className="w-full mt-1"
            />
            <input
              type="number"
              min={8}
              max={200}
              value={
                typeof selectedItem.style?.fontSize === "number"
                  ? selectedItem.style.fontSize
                  : ""
              }
              placeholder="Auto"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  const { fontSize: _f, ...rest } = selectedItem.style || {};
                  onUpdate({ style: rest });
                  return;
                }
                const n = parseInt(v, 10);
                if (!Number.isFinite(n)) return;
                onUpdate({
                  style: {
                    ...selectedItem.style,
                    fontSize: n,
                  },
                });
              }}
              className="w-full text-sm border rounded px-2 py-1 mt-1"
            />
          </div>
        )}

        {/* Content (for text, sticky notes, and shapes) */}
        {(selectedItem.type === "text" || selectedItem.type === "sticky_note" || selectedItem.type === "shape") && (
          <div>
            <label className="text-xs font-medium text-gray-600">Content</label>
            <textarea
              value={selectedItem.content || ""}
              onChange={(e) => onUpdate({ content: e.target.value })}
              className="w-full text-sm border rounded px-2 py-1 mt-1"
              rows={3}
            />
          </div>
        )}

        {/* Text properties */}
        {selectedItem.type === "text" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-600">Font Family</label>
              <select
                value={selectedItem.style?.fontFamily || "Arial"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      fontFamily: e.target.value,
                    },
                  })
                }
                className="w-full text-sm border rounded px-2 py-1 mt-1"
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
                <option value="Georgia">Georgia</option>
                <option value="Palatino">Palatino</option>
                <option value="Garamond">Garamond</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
                <option value="Impact">Impact</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Font Size: {selectedItem.style?.fontSize || 16}px
              </label>
              <input
                type="range"
                min="8"
                max="72"
                value={selectedItem.style?.fontSize || 16}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      fontSize: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full mt-1"
              />
              <input
                type="number"
                value={selectedItem.style?.fontSize || 16}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      fontSize: parseInt(e.target.value, 10) || 16,
                    },
                  })
                }
                className="w-full text-sm border rounded px-2 py-1 mt-1"
                min="8"
                max="72"
                placeholder="Font size"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Text Color</label>
              <input
                type="color"
                value={selectedItem.style?.color || "#000000"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      color: e.target.value,
                    },
                  })
                }
                className="w-full h-8 border rounded mt-1 cursor-pointer"
              />
            </div>
          </>
        )}

        {/* Shape properties */}
        {selectedItem.type === "shape" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-600">Shape Type</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        shapeType: "rect",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.shapeType === "rect" || !selectedItem.style?.shapeType
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                >
                  Rectangle
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        shapeType: "roundRect",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.shapeType === "roundRect"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                >
                  Rounded
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        shapeType: "ellipse",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.shapeType === "ellipse"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                >
                  Ellipse
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        shapeType: "diamond",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.shapeType === "diamond"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                >
                  Diamond
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Background Color</label>
              <input
                type="color"
                value={selectedItem.style?.backgroundColor || "#ffffff"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      backgroundColor: e.target.value,
                    },
                  })
                }
                className="w-full h-8 border rounded mt-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Border Color</label>
              <input
                type="color"
                value={selectedItem.style?.borderColor || "#000000"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      borderColor: e.target.value,
                    },
                  })
                }
                className="w-full h-8 border rounded mt-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Border Width: {selectedItem.style?.borderWidth || 2}px
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={selectedItem.style?.borderWidth || 2}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      borderWidth: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full mt-1"
              />
            </div>
          </>
        )}

        {/* Sticky note background colors */}
        {selectedItem.type === "sticky_note" && (
          <div>
            <label className="text-xs font-medium text-gray-600">Background Color</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {[
                { name: "Yellow", color: "#fef08a" },
                { name: "Pink", color: "#fce7f3" },
                { name: "Green", color: "#dcfce7" },
                { name: "Blue", color: "#dbeafe" },
                { name: "Purple", color: "#f3e8ff" },
                { name: "Orange", color: "#fed7aa" },
                { name: "Gray", color: "#f3f4f6" },
                { name: "White", color: "#ffffff" },
              ].map((preset) => (
                <button
                  key={preset.color}
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        backgroundColor: preset.color,
                      },
                    })
                  }
                  className={`h-8 border-2 rounded ${
                    (selectedItem.style?.backgroundColor || "#fef08a") === preset.color
                      ? "border-[#3CCED7] ring-2 ring-[#3CCED7]/30"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Freehand stroke properties */}
        {selectedItem.type === "freehand" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-600">Stroke Color</label>
              <input
                type="color"
                value={selectedItem.style?.strokeColor || "#000000"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      strokeColor: e.target.value,
                    },
                  })
                }
                className="w-full h-8 border rounded mt-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Stroke Width: {selectedItem.style?.strokeWidth || 4}px
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={selectedItem.style?.strokeWidth || 4}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      strokeWidth: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full mt-1"
              />
            </div>
          </>
        )}

        {/* Line properties */}
        {selectedItem.type === "line" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-600">Content</label>
              <textarea
                value={selectedItem.content || ""}
                onChange={(e) => onUpdate({ content: e.target.value })}
                className="w-full text-sm border rounded px-2 py-1 mt-1"
                rows={2}
                placeholder="Label text"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Line Style</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        strokeDasharray: undefined,
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    !selectedItem.style?.strokeDasharray
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                  title="Solid"
                >
                  ─
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        strokeDasharray: "8,4",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.strokeDasharray === "8,4"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                  title="Dashed"
                >
                  ─ ─
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        strokeDasharray: "2,4",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.strokeDasharray === "2,4"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                  title="Dotted"
                >
                  · · ·
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        strokeDasharray: "8,4,2,4",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.strokeDasharray === "8,4,2,4"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                  title="Dash-Dot"
                >
                  ─ ·
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Length</label>
              <input
                type="number"
                value={Math.round(selectedItem.width)}
                onChange={(e) =>
                  onUpdate({ width: parseFloat(e.target.value) || 200 })
                }
                className="w-full text-sm border rounded px-2 py-1 mt-1"
                placeholder="Length"
                min="1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Stroke Color</label>
              <input
                type="color"
                value={selectedItem.style?.strokeColor || "#111827"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      strokeColor: e.target.value,
                    },
                  })
                }
                className="w-full h-8 border rounded mt-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Stroke Width: {selectedItem.style?.strokeWidth || 4}px
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={selectedItem.style?.strokeWidth || 4}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      strokeWidth: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full mt-1"
              />
            </div>
          </>
        )}

        {/* Connector properties */}
        {selectedItem.type === "connector" && (
          <>
            {selectedItem.style?.connection && (
              <p className="text-xs text-gray-500 mb-2">
                Linked connector — moving attached items updates the curve. Adjust stroke below.
              </p>
            )}
            {!selectedItem.style?.connection && (
            <>
            <div>
              <label className="text-xs font-medium text-gray-600">Content</label>
              <textarea
                value={selectedItem.content || ""}
                onChange={(e) => onUpdate({ content: e.target.value })}
                className="w-full text-sm border rounded px-2 py-1 mt-1"
                rows={2}
                placeholder="Label text"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Line Style</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        strokeDasharray: undefined,
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    !selectedItem.style?.strokeDasharray
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                  title="Solid"
                >
                  ─
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        strokeDasharray: "8,4",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.strokeDasharray === "8,4"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                  title="Dashed"
                >
                  ─ ─
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        strokeDasharray: "2,4",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.strokeDasharray === "2,4"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                  title="Dotted"
                >
                  · · ·
                </button>
                <button
                  onClick={() =>
                    onUpdate({
                      style: {
                        ...selectedItem.style,
                        strokeDasharray: "8,4,2,4",
                      },
                    })
                  }
                  className={`px-2 py-1 text-xs border rounded ${
                    selectedItem.style?.strokeDasharray === "8,4,2,4"
                      ? "bg-[#3CCED7]/10 border-[#3CCED7]"
                      : "bg-white border-gray-300"
                  }`}
                  title="Dash-Dot"
                >
                  ─ ·
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Length</label>
              <input
                type="number"
                value={Math.round(selectedItem.width)}
                onChange={(e) =>
                  onUpdate({ width: parseFloat(e.target.value) || 200 })
                }
                className="w-full text-sm border rounded px-2 py-1 mt-1"
                placeholder="Length"
                min="1"
              />
            </div>
            </>
            )}
            <div>
              <label className="text-xs font-medium text-gray-600">Stroke Color</label>
              <input
                type="color"
                value={selectedItem.style?.strokeColor || "#111827"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      strokeColor: e.target.value,
                    },
                  })
                }
                className="w-full h-8 border rounded mt-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Stroke Width: {selectedItem.style?.strokeWidth || 4}px
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={selectedItem.style?.strokeWidth || 4}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      strokeWidth: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full mt-1"
              />
            </div>
          </>
        )}

        {/* Parent item info (for items inside frames) */}
        {selectedItem.parent_item_id && (
          <div>
            <label className="text-xs font-medium text-gray-600">Parent Frame</label>
            <div className="text-xs text-gray-500 mt-1 p-2 bg-gray-50 rounded">
              ID: {selectedItem.parent_item_id}
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                // Use pointer down to avoid click being cancelled after slight pointer movement
                // (common after panning/drag interactions on the canvas).
                e.preventDefault();
                e.stopPropagation();
                onUpdate({ parent_item_id: null });
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#3CCED7]/10 text-[#3CCED7] rounded hover:bg-[#3CCED7]/10"
            >
              <span className="text-sm">Remove from frame</span>
            </button>
          </div>
        )}

        {/* Frame properties */}
        {selectedItem.type === "frame" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-600">Frame Label</label>
              <input
                type="text"
                value={selectedItem.content || selectedItem.style?.label || ""}
                onChange={(e) =>
                  onUpdate({
                    content: e.target.value,
                    style: {
                      ...selectedItem.style,
                      label: e.target.value,
                    },
                  })
                }
                className="w-full text-sm border rounded px-2 py-1 mt-1"
                placeholder="Frame name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Background Color</label>
              <input
                type="color"
                value={selectedItem.style?.backgroundColor || "#f3f4f6"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      backgroundColor: e.target.value,
                    },
                  })
                }
                className="w-full h-8 border rounded mt-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Border Color</label>
              <input
                type="color"
                value={selectedItem.style?.borderColor || "#9ca3af"}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...selectedItem.style,
                      borderColor: e.target.value,
                    },
                  })
                }
                className="w-full h-8 border rounded mt-1 cursor-pointer"
              />
            </div>
          </>
        )}

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">Delete</span>
        </button>
      </div>
    </div>
  );
}

