"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Type, Square, StickyNote, Frame, Minus, Link2, PenTool, ArrowUpLeft, ScanSearch, Smile, Eraser, LayoutTemplate } from "lucide-react";
import { LineVariant, ToolOptions, ToolType, useToolDnD } from "./hooks/useToolDnD";
import { Tooltip } from "@/components/overlay/OverlayPrimitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EmojiClickData } from "emoji-picker-react";
import type { GraphTemplateId } from "@/components/miro/templates/graphTemplates";

const EmojiPicker = dynamic(() => import("emoji-picker-react").then((m) => m.default), {
  ssr: false,
});

interface BoardToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onToolPrimaryAction: (tool: ToolType, options?: ToolOptions) => void;
  onEmojiInsert: (emoji: string) => void;
  onInsertTemplate: (templateId: GraphTemplateId) => void;
  lineVariant: LineVariant;
  onLineVariantChange: (variant: LineVariant) => void;
}

export default function BoardToolbar({
  activeTool,
  onToolChange,
  onToolPrimaryAction,
  onEmojiInsert,
  onInsertTemplate,
  lineVariant,
  onLineVariantChange,
}: BoardToolbarProps) {
  const { handleDragStart, handleDragEnd } = useToolDnD();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsCompact(event.matches);
    };

    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (activeTool !== "emoji" && emojiOpen) {
      setEmojiOpen(false);
    }
  }, [activeTool, emojiOpen]);

  const overlaySide = isCompact ? "bottom" : "right";

  const toolGroups: Array<Array<{ type: ToolType; icon: React.ReactNode; label: string }>> = [
    // Select
    [
      { type: "select", icon: <ArrowUpLeft className="w-5 h-5" />, label: "Select" },
      { type: "multi_select", icon: <ScanSearch className="w-5 h-5" />, label: "Multi-select" },
    ],
    // Create
    [
      { type: "text", icon: <Type className="w-5 h-5" />, label: "Text" },
      { type: "shape", icon: <Square className="w-5 h-5" />, label: "Shape" },
      { type: "sticky_note", icon: <StickyNote className="w-5 h-5" />, label: "Sticky Note" },
      { type: "frame", icon: <Frame className="w-5 h-5" />, label: "Frame" },
      { type: "emoji", icon: <Smile className="w-5 h-5" />, label: "Emoji" },
    ],
    // Draw / Connect
    [
      { type: "line", icon: <Minus className="w-5 h-5" />, label: "Line" },
      { type: "connect", icon: <Link2 className="w-5 h-5" />, label: "Connect" },
      { type: "freehand", icon: <PenTool className="w-5 h-5" />, label: "brush" },
    ],
    // Edit
    [{ type: "eraser", icon: <Eraser className="w-5 h-5" />, label: "Eraser" }],
  ];

  return (
    <div className="z-20 mx-2 my-2 flex max-w-[calc(100vw-1rem)] shrink-0 flex-row items-center gap-1 overflow-x-auto rounded-xl bg-white p-1.5 shadow-md ring-1 ring-gray-100 sm:my-3 sm:w-14 sm:max-w-none sm:flex-col sm:self-start sm:overflow-visible">
      <div className="flex shrink-0 flex-row items-center sm:flex-col">
        <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <Tooltip content="Templates" side={overlaySide}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded text-gray-500 hover:bg-gray-50 hover:text-gray-900 sm:h-9 sm:w-9"
                aria-label="Templates"
              >
                <LayoutTemplate className="w-5 h-5" />
              </button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent
            side={overlaySide}
            align="start"
            className="w-56 p-2"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="text-sm font-medium text-gray-700 px-2 py-1">
              Graph templates
            </div>
            <div className="mt-1 flex flex-col gap-1">
              <button
                type="button"
                className="w-full rounded px-2 py-2 text-left text-sm hover:bg-gray-100"
                onClick={() => {
                  onInsertTemplate("mind_map");
                  setTemplatesOpen(false);
                }}
              >
                Mind map
              </button>
              <button
                type="button"
                className="w-full rounded px-2 py-2 text-left text-sm hover:bg-gray-100"
                onClick={() => {
                  onInsertTemplate("flowchart");
                  setTemplatesOpen(false);
                }}
              >
                Flowchart
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="mx-1 h-10 w-px shrink-0 bg-gray-200 sm:mx-0 sm:my-1 sm:h-px sm:w-10" />
      {toolGroups.map((group, groupIdx) => (
        <React.Fragment key={`group-${groupIdx}`}>
          {group.map((tool) => {
            if (tool.type === "emoji") {
              return (
                <div key="emoji" className="flex shrink-0 flex-row items-center sm:flex-col">
                  <Popover
                    open={emojiOpen}
                    onOpenChange={(open) => {
                      setEmojiOpen(open);
                      if (open) onToolChange("emoji");
                    }}
                  >
                    <Tooltip content={tool.label} side={overlaySide}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => handleDragStart(e, "emoji", { emoji: "😀" })}
                          onDragEnd={handleDragEnd}
                          className={`inline-flex h-10 w-10 cursor-move items-center justify-center rounded sm:h-9 sm:w-9 ${
                            activeTool === "emoji"
                              ? "bg-[#3CCED7]/10 text-[#3CCED7]"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                          aria-label={tool.label}
                        >
                          {tool.icon}
                        </button>
                      </PopoverTrigger>
                    </Tooltip>
                    <PopoverContent
                      side={overlaySide}
                      align="start"
                      className="w-auto max-h-[min(420px,70vh)] overflow-y-auto p-0 border-0 shadow-lg"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <EmojiPicker
                        onEmojiClick={(data: EmojiClickData) => {
                          onEmojiInsert(data.emoji);
                          setEmojiOpen(false);
                          onToolChange("select");
                        }}
                        width={isCompact ? 300 : 320}
                        height={400}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              );
            }

            const isSelect = tool.type === "select" || tool.type === "multi_select";
            const isPrimaryClickCreate =
              tool.type !== "select" &&
              tool.type !== "multi_select" &&
              tool.type !== "eraser" &&
              tool.type !== "freehand" &&
              tool.type !== "line" &&
              tool.type !== "connect";
            const lineToolIsActive = tool.type === "line" && activeTool === "line";

            return (
              <div key={tool.type} className="flex shrink-0 flex-row items-center sm:flex-col">
                <Tooltip content={tool.label} side={overlaySide}>
                  <button
                    onClick={() => {
                      if (isPrimaryClickCreate) {
                        onToolPrimaryAction(tool.type);
                      } else {
                        onToolChange(tool.type);
                      }
                    }}
                    draggable={!isSelect}
                    onDragStart={(e) =>
                      handleDragStart(e, tool.type, tool.type === "line" ? { lineVariant } : undefined)
                    }
                    onDragEnd={handleDragEnd}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded sm:h-9 sm:w-9 ${
                      activeTool === tool.type
                        ? "bg-[#3CCED7]/10 text-[#3CCED7]"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    } ${!isSelect ? "cursor-move" : ""}`}
                    aria-label={tool.label}
                    type="button"
                  >
                    {tool.icon}
                  </button>
                </Tooltip>

                {lineToolIsActive ? (
                  <div className="ml-1 flex flex-row items-center gap-1 rounded-lg border bg-white p-1 shadow-sm sm:ml-0 sm:mt-2 sm:flex-col">
                    <LineVariantButton
                      active={lineVariant === "straight_solid"}
                      label="Straight solid"
                      tooltipSide={overlaySide}
                      onClick={() => {
                        onLineVariantChange("straight_solid");
                        onToolPrimaryAction("line", { lineVariant: "straight_solid" });
                      }}
                    >
                      ─
                    </LineVariantButton>
                    <LineVariantButton
                      active={lineVariant === "straight_dashed"}
                      label="Straight dashed"
                      tooltipSide={overlaySide}
                      onClick={() => {
                        onLineVariantChange("straight_dashed");
                        onToolPrimaryAction("line", { lineVariant: "straight_dashed" });
                      }}
                    >
                      ─ ─
                    </LineVariantButton>
                    <LineVariantButton
                      active={lineVariant === "straight_dotted"}
                      label="Straight dotted"
                      tooltipSide={overlaySide}
                      onClick={() => {
                        onLineVariantChange("straight_dotted");
                        onToolPrimaryAction("line", { lineVariant: "straight_dotted" });
                      }}
                    >
                      · · ·
                    </LineVariantButton>
                    <LineVariantButton
                      active={lineVariant === "arrow_solid"}
                      label="Arrow solid"
                      tooltipSide={overlaySide}
                      onClick={() => {
                        onLineVariantChange("arrow_solid");
                        onToolPrimaryAction("line", { lineVariant: "arrow_solid" });
                      }}
                    >
                      ─▶
                    </LineVariantButton>
                    <LineVariantButton
                      active={lineVariant === "arrow_dashed"}
                      label="Arrow dashed"
                      tooltipSide={overlaySide}
                      onClick={() => {
                        onLineVariantChange("arrow_dashed");
                        onToolPrimaryAction("line", { lineVariant: "arrow_dashed" });
                      }}
                    >
                      ─ ─▶
                    </LineVariantButton>
                  </div>
                ) : null}
              </div>
            );
          })}

          {groupIdx < toolGroups.length - 1 ? (
            <div className="mx-1 h-10 w-px shrink-0 bg-gray-200 sm:mx-0 sm:my-1 sm:h-px sm:w-10" />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function LineVariantButton({
  active,
  label,
  tooltipSide,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  tooltipSide: "bottom" | "right";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label} side={tooltipSide}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        className={`h-8 w-12 rounded px-1 py-1 text-[10px] leading-none transition ${
          active ? "bg-[#3CCED7]/10 text-[#3CCED7]" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
        aria-pressed={active}
        aria-label={label}
      >
        {children}
      </button>
    </Tooltip>
  );
}
