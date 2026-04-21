"use client";
import React from "react";
import Image from "next/image";
import CanvasBlockRenderer from "@/components/mailchimp/email-builder/components/CanvasBlockRenderer";
import {
  CanvasBlock,
  CanvasBlocks,
  DeviceMode,
  BlockBoxStyles,
  ButtonLinkType,
  SelectedBlock,
} from "@/components/mailchimp/email-builder/types";
import { mapKlaviyoBlockType } from "@/lib/utils/klaviyoBlockUtils";
import {
  Menu,
  Layers,
  Table,
  MessageSquare,
  Play,
  Code,
} from "lucide-react";
import KlaviyoLayoutBlock from "./KlaviyoLayoutBlock";

interface KlaviyoCanvasBlockRendererProps {
  block: CanvasBlock;
  section?: string;
  isSelected?: boolean;
  updateLayoutColumns: (
    section: string,
    blockId: string,
    columnIndex: number,
    delta: number
  ) => void;
  deviceMode: DeviceMode;
  updateBlockContent?: (
    section: string,
    blockId: string,
    content: string
  ) => void;
  handleDrop?: (e: React.DragEvent, section: string, index?: number) => void;
  handleDragOver?: (e: React.DragEvent, section: string, index: number) => void;
  handleDragLeave?: (e: React.DragEvent) => void;
  layoutBlockIndex?: number;
  onColumnBlockDrop?: (e: React.DragEvent, layoutBlockId: string, columnIndex: number) => void;
  setCanvasBlocks?: React.Dispatch<React.SetStateAction<CanvasBlocks>>;
  selectedBlock?: SelectedBlock | null;
  setSelectedBlock?: (block: SelectedBlock | null) => void;
  setSelectedSection?: (section: string | null) => void;
  layoutBlockId?: string; // ID of the parent layout block (for nested blocks)
  columnIndex?: number; // Index of the column within the layout block (for nested blocks)
}

// Helper functions for style and URL processing
const getBoxStyleProps = (styles?: BlockBoxStyles) => {
  if (!styles) return {};
  const hasUnifiedPadding = styles.padding !== undefined;
  const hasUnifiedMargin = styles.margin !== undefined;

  return {
    backgroundColor: styles.backgroundColor,
    borderStyle: styles.borderStyle,
    borderWidth: styles.borderWidth,
    borderColor: styles.borderColor,
    borderRadius: styles.borderRadius,
    ...(hasUnifiedPadding ? { padding: styles.padding } : {}),
    ...(!hasUnifiedPadding
      ? {
          paddingTop: styles.paddingTop,
          paddingRight: styles.paddingRight,
          paddingBottom: styles.paddingBottom,
          paddingLeft: styles.paddingLeft,
        }
      : {}),
    ...(hasUnifiedMargin ? { margin: styles.margin } : {}),
    ...(!hasUnifiedMargin
      ? {
          marginTop: styles.marginTop,
          marginRight: styles.marginRight,
          marginBottom: styles.marginBottom,
          marginLeft: styles.marginLeft,
        }
      : {}),
  };
};

const normalizeWebUrl = (url: string) => {
  if (!url) return "";
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
    return url;
  }
  return `https://${url}`;
};

const buildLinkHref = (linkType: ButtonLinkType, linkAddress: string): string | null => {
  const rawValue = linkAddress?.trim();
  if (!rawValue) return null;

  switch (linkType) {
    case "Email": {
      const value = rawValue.replace(/^mailto:/i, "");
      return value ? `mailto:${value}` : null;
    }
    case "Phone": {
      const value = rawValue.replace(/^tel:/i, "");
      return value ? `tel:${value}` : null;
    }
    case "Web":
    default:
      return normalizeWebUrl(rawValue);
  }
};

/**
 * Klaviyo-specific CanvasBlockRenderer wrapper
 * This component wraps the mailchimp CanvasBlockRenderer and adds support for
 * Klaviyo-specific block types (Text, Split, HeaderBar, DropShadow, Table, ReviewQuote)
 */
const KlaviyoCanvasBlockRenderer: React.FC<KlaviyoCanvasBlockRendererProps> = ({
  block,
  section,
  isSelected,
  updateLayoutColumns,
  deviceMode,
  updateBlockContent,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  layoutBlockIndex,
  onColumnBlockDrop,
  setCanvasBlocks,
  selectedBlock,
  setSelectedBlock,
  setSelectedSection,
  layoutBlockId,
  columnIndex,
}) => {
  // Handle Klaviyo-specific block types
  switch (block.type) {
    case "Text":
      // Text blocks use Paragraph rendering logic
      return (
        <CanvasBlockRenderer
          block={{ ...block, type: "Paragraph" }}
          section={section}
          isSelected={isSelected}
          updateLayoutColumns={updateLayoutColumns}
          deviceMode={deviceMode}
          updateBlockContent={updateBlockContent}
        />
      );
    case "Split":
    case "Layout": {
      // Use KlaviyoLayoutBlock for Layout/Split blocks with drop zones support
      const layoutBlockStyles = block.layoutBlockStyles || {};
      const styleProps = getBoxStyleProps(layoutBlockStyles);
      return (
        <div style={styleProps}>
          <KlaviyoLayoutBlock
            block={block as any}
            section={section || ""}
            isSelected={isSelected}
            updateLayoutColumns={updateLayoutColumns}
            isMobile={deviceMode === "mobile"}
            handleDrop={handleDrop}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            layoutBlockIndex={layoutBlockIndex}
            onColumnBlockDrop={onColumnBlockDrop}
            setCanvasBlocks={setCanvasBlocks}
            selectedBlock={selectedBlock}
            setSelectedBlock={setSelectedBlock}
            setSelectedSection={setSelectedSection}
          />
        </div>
      );
    }
    case "HeaderBar": {
      // Extract HeaderBar properties
      const layout = block.headerBarLayout || "logo-stacked";
      const logoUrl = block.headerBarLogoUrl;
      const items = block.headerBarItems || [];
      const linkStyles = block.headerBarLinkStyles || {};
      const blockStyles = block.headerBarBlockStyles || {};
      const itemPadding = block.headerBarItemPadding
        ? typeof block.headerBarItemPadding === "number"
          ? `${block.headerBarItemPadding}px`
          : block.headerBarItemPadding.toString().replace(/px$/, "") + "px"
        : "10px";
      const itemAlignment = block.headerBarItemAlignment || "center";

      // Get block style properties
      const blockStyleProps = getBoxStyleProps(blockStyles) as React.CSSProperties;

      // Link text styles
      const linkStyleProps: React.CSSProperties = {
        fontFamily: linkStyles.fontFamily,
        fontSize: linkStyles.fontSize ? `${linkStyles.fontSize}px` : undefined,
        color: linkStyles.color || "#000000",
        lineHeight: linkStyles.lineHeight ? `${linkStyles.lineHeight}px` : undefined,
        fontWeight: linkStyles.fontWeight,
        fontStyle: linkStyles.fontStyle,
        textDecoration: linkStyles.textDecoration,
      };

      // Alignment styles for items container
      const alignmentStyles: Record<
        "left" | "center" | "right",
        React.CSSProperties
      > = {
        left: { display: "flex", justifyContent: "flex-start", alignItems: "center" },
        center: { display: "flex", justifyContent: "center", alignItems: "center" },
        right: { display: "flex", justifyContent: "flex-end", alignItems: "center" },
      };

      // Block wrapper style
      const blockWrapperStyle: React.CSSProperties = {
        ...blockStyleProps,
        width: "100%",
      };

      // Items container style
      const itemsContainerStyle: React.CSSProperties = {
        ...alignmentStyles[itemAlignment],
        gap: "8px",
        flexWrap: "wrap",
      };

      // Item style (for padding)
      const itemStyle: React.CSSProperties = {
        padding: itemPadding,
      };

      // For logo-inline, we need a flex container
      if (layout === "logo-inline") {
        return (
          <div style={blockWrapperStyle}>
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              {/* Logo section */}
              {logoUrl && (
                <div style={{ marginRight: "16px", flexShrink: 0 }}>
                  <div style={{ position: "relative", width: "120px", height: "40px" }}>
                    <Image
                      src={logoUrl}
                      alt="Logo"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </div>
              )}

              {/* Items section */}
              {items.length > 0 && (
                <div style={{ ...itemsContainerStyle, flex: 1 }}>
                  {items.map((item) => {
                    if (item.type === "image") {
                      return (
                        <div key={item.id} style={itemStyle}>
                          {item.imageUrl ? (
                            <div style={{ position: "relative", width: "32px", height: "32px" }}>
                              <Image
                                src={item.imageUrl}
                                alt={item.imageAltText || "Image"}
                                fill
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                border: "1px dashed #ccc",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                color: "#999",
                              }}
                            >
                              Image
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      // Link item
                      const linkHref = buildLinkHref(
                        item.linkType || "Web",
                        item.linkAddress || ""
                      );
                      const linkItemStyle: React.CSSProperties = {
                        ...linkStyleProps,
                        ...itemStyle,
                        textDecoration: item.textStyles?.textDecoration || linkStyleProps.textDecoration || "none",
                        color: item.textStyles?.color || linkStyleProps.color,
                        cursor: "pointer",
                      };

                      const linkElement = (
                        <span style={linkItemStyle}>{item.content || "Link"}</span>
                      );

                      return (
                        <div key={item.id}>
                          {linkHref ? (
                            <a
                              href={linkHref}
                              target={item.linkOpenInNewTab ? "_blank" : undefined}
                              rel={item.linkOpenInNewTab ? "noreferrer noopener" : undefined}
                              style={{ textDecoration: "none" }}
                            >
                              {linkElement}
                            </a>
                          ) : (
                            linkElement
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
              )}

              {/* Empty state for inline layout */}
              {!logoUrl && items.length === 0 && (
                <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600 flex-1">
                  <Menu className="h-8 w-8 mx-auto mb-2 text-gray-700" />
                  <p className="text-sm font-medium">{block.label || "Header bar"}</p>
                </div>
              )}
            </div>
          </div>
        );
      }

      // For other layouts (logo-stacked, logo-centered, links-only)
      return (
        <div style={blockWrapperStyle}>
          {/* Logo section - only show if layout is not "links-only" */}
          {layout !== "links-only" && logoUrl && (
            <div
              style={{
                display: "flex",
                justifyContent: layout === "logo-centered" ? "center" : "flex-start",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div style={{ position: "relative", width: "120px", height: "40px" }}>
                <Image
                  src={logoUrl}
                  alt="Logo"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}

          {/* Items section */}
          {items.length > 0 && (
            <div style={itemsContainerStyle}>
              {items.map((item) => {
                if (item.type === "image") {
                  return (
                    <div key={item.id} style={itemStyle}>
                      {item.imageUrl ? (
                        <div style={{ position: "relative", width: "32px", height: "32px" }}>
                          <Image
                            src={item.imageUrl}
                            alt={item.imageAltText || "Image"}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            border: "1px dashed #ccc",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            color: "#999",
                          }}
                        >
                          Image
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // Link item
                  const linkHref = buildLinkHref(
                    item.linkType || "Web",
                    item.linkAddress || ""
                  );
                  const linkItemStyle: React.CSSProperties = {
                    ...linkStyleProps,
                    ...itemStyle,
                    textDecoration: item.textStyles?.textDecoration || linkStyleProps.textDecoration || "none",
                    color: item.textStyles?.color || linkStyleProps.color,
                    cursor: "pointer",
                  };

                  const linkElement = (
                    <span style={linkItemStyle}>{item.content || "Link"}</span>
                  );

                  return (
                    <div key={item.id}>
                      {linkHref ? (
                        <a
                          href={linkHref}
                          target={item.linkOpenInNewTab ? "_blank" : undefined}
                          rel={item.linkOpenInNewTab ? "noreferrer noopener" : undefined}
                          style={{ textDecoration: "none" }}
                        >
                          {linkElement}
                        </a>
                      ) : (
                        linkElement
                      )}
                    </div>
                  );
                }
              })}
            </div>
          )}

          {/* Empty state - show placeholder if no logo and no items */}
          {(!logoUrl || layout === "links-only") && items.length === 0 && (
            <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
              <Menu className="h-8 w-8 mx-auto mb-2 text-gray-700" />
              <p className="text-sm font-medium">{block.label || "Header bar"}</p>
            </div>
          )}
        </div>
      );
    }
    case "Video": {
      // Extract Video properties
      const videoUrl = block.videoUrl;
      const thumbnailUrl = block.videoThumbnailUrl;
      const thumbnailWidth = block.videoThumbnailWidth || "auto";
      const thumbnailHeight = block.videoThumbnailHeight || "auto";
      const thumbnailAlignment = block.videoThumbnailAlignment || "center";
      const fillColumn = block.videoFillColumn ?? true;
      const videoAreaPadding = block.videoAreaPadding || {};

      // Get padding style properties
      const paddingStyleProps = getBoxStyleProps(videoAreaPadding) as React.CSSProperties;

      // Alignment styles
      const alignmentStyles: Record<
        "left" | "center" | "right",
        React.CSSProperties
      > = {
        left: { display: "flex", justifyContent: "flex-start", alignItems: "center" },
        center: { display: "flex", justifyContent: "center", alignItems: "center" },
        right: { display: "flex", justifyContent: "flex-end", alignItems: "center" },
      };

      // Thumbnail wrapper style
      const thumbnailWrapperStyle: React.CSSProperties = {
        ...alignmentStyles[thumbnailAlignment],
        width: fillColumn ? "100%" : "auto",
        ...paddingStyleProps,
      };

      return (
        <div style={thumbnailWrapperStyle}>
          {thumbnailUrl ? (
            <div
              style={{
                position: "relative",
                width: thumbnailWidth === "auto" ? "100%" : thumbnailWidth,
                maxWidth: "100%",
              }}
            >
              {thumbnailHeight === "auto" ? (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    paddingBottom: "56.25%", // 16:9 aspect ratio
                  }}
                >
                  <Image
                    src={thumbnailUrl}
                    alt="Video thumbnail"
                    fill
                    className="object-cover rounded"
                    unoptimized
                  />
                  {/* Play icon overlay */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(0, 0, 0, 0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      pointerEvents: "none",
                    }}
                  >
                    <Play className="h-6 w-6 text-white ml-1" fill="white" />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    position: "relative",
                    width: thumbnailWidth === "auto" ? "100%" : thumbnailWidth,
                    height: thumbnailHeight,
                  }}
                >
                  <Image
                    src={thumbnailUrl}
                    alt="Video thumbnail"
                    width={thumbnailWidth !== "auto" ? parseInt(thumbnailWidth.toString().replace("px", "")) : 400}
                    height={parseInt(thumbnailHeight.toString().replace("px", ""))}
                    className="object-cover rounded"
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                    unoptimized
                  />
                  {/* Play icon overlay */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(0, 0, 0, 0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      pointerEvents: "none",
                    }}
                  >
                    <Play className="h-6 w-6 text-white ml-1" fill="white" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="border border-gray-200 rounded-lg p-8 text-center text-gray-400"
              style={{
                width: fillColumn ? "100%" : "auto",
                minHeight: "200px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">{block.label || "Video"}</p>
              {!videoUrl && (
                <p className="text-xs text-gray-400 mt-1">Add video URL and thumbnail</p>
              )}
            </div>
          )}
        </div>
      );
    }
    case "DropShadow":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <Layers className="h-8 w-8 mx-auto mb-2 text-gray-600" />
          <p className="text-sm font-medium">{block.label || "Drop shadow"}</p>
        </div>
      );
    case "Table":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <Table className="h-8 w-8 mx-auto mb-2 text-[#3CCED7]" />
          <p className="text-sm font-medium">{block.label || "Table"}</p>
        </div>
      );
    case "ReviewQuote":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 text-[#3CCED7]" />
          <p className="text-sm font-medium">{block.label || "Review quote"}</p>
        </div>
      );
    case "Button": {
      // Custom Button rendering with text styles support

      const buttonBlockStyles = getBoxStyleProps(
        block.buttonBlockStyles
      ) as React.CSSProperties;
      const buttonHref = buildLinkHref(
        block.buttonLinkType || "Web",
        block.buttonLinkValue || ""
      );
      const buttonOpenInNewTab = block.buttonOpenInNewTab ?? true;
      const buttonTextColor = block.buttonTextColor || "#ffffff";
      const buttonBackgroundColor = block.buttonBackgroundColor || "#111827";
      const buttonShape = block.buttonShape || "Square";
      const buttonAlignment = block.buttonAlignment || "center";
      const buttonSize = block.buttonSize || "Small";

      // Get text styles from block.styles
      const textStyles = block.styles || {};
      const textColor = textStyles.color || buttonTextColor;
      const fontFamily = textStyles.fontFamily;
      const fontSize = textStyles.fontSize
        ? `${textStyles.fontSize}px`
        : undefined;
      const fontWeight = textStyles.fontWeight;
      const fontStyle = textStyles.fontStyle;
      const textDecoration = textStyles.textDecoration;
      const lineHeight = textStyles.lineHeight
        ? `${textStyles.lineHeight}px`
        : undefined;

      // Size-based width
      const sizeWidths: Record<string, string> = {
        Small: "150px",
        Medium: "200px",
        Large: "300px",
      };
      const buttonWidth = sizeWidths[buttonSize] || sizeWidths.Small;

      // Calculate border radius based on shape
      const getShapeBorderRadius = (shape: string): string => {
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

      const buttonStyle: React.CSSProperties = {
        backgroundColor: buttonBackgroundColor,
        color: textColor,
        fontFamily: fontFamily,
        fontSize: fontSize,
        fontWeight: fontWeight,
        fontStyle: fontStyle,
        textDecoration: textDecoration,
        lineHeight: lineHeight,
        borderRadius:
          (buttonBlockStyles.borderRadius as string) ||
          getShapeBorderRadius(buttonShape),
        borderStyle: buttonBlockStyles.borderStyle as string,
        borderWidth: buttonBlockStyles.borderWidth as string,
        borderColor: buttonBlockStyles.borderColor as string,
        width: buttonWidth,
      };

      const alignmentStyles: Record<
        "left" | "center" | "right",
        React.CSSProperties
      > = {
        left: { display: "flex", justifyContent: "flex-start" },
        center: { display: "flex", justifyContent: "center" },
        right: { display: "flex", justifyContent: "flex-end" },
      };

      const buttonWrapperStyle: React.CSSProperties = {
        ...alignmentStyles[buttonAlignment],
        ...(buttonBlockStyles.padding && {
          padding: buttonBlockStyles.padding as string,
        }),
        ...(buttonBlockStyles.paddingTop && {
          paddingTop: buttonBlockStyles.paddingTop as string,
        }),
        ...(buttonBlockStyles.paddingRight && {
          paddingRight: buttonBlockStyles.paddingRight as string,
        }),
        ...(buttonBlockStyles.paddingBottom && {
          paddingBottom: buttonBlockStyles.paddingBottom as string,
        }),
        ...(buttonBlockStyles.paddingLeft && {
          paddingLeft: buttonBlockStyles.paddingLeft as string,
        }),
        ...(buttonBlockStyles.margin && {
          margin: buttonBlockStyles.margin as string,
        }),
        ...(buttonBlockStyles.marginTop && {
          marginTop: buttonBlockStyles.marginTop as string,
        }),
        ...(buttonBlockStyles.marginRight && {
          marginRight: buttonBlockStyles.marginRight as string,
        }),
        ...(buttonBlockStyles.marginBottom && {
          marginBottom: buttonBlockStyles.marginBottom as string,
        }),
        ...(buttonBlockStyles.marginLeft && {
          marginLeft: buttonBlockStyles.marginLeft as string,
        }),
        ...(buttonBlockStyles.backgroundColor && {
          backgroundColor: buttonBlockStyles.backgroundColor as string,
        }),
        width: "100%",
      };

      const buttonElement = (
        <button
          style={buttonStyle}
          className="px-6 py-2 transition-colors"
        >
          {block.content || "Button text"}
        </button>
      );

      return (
        <div style={buttonWrapperStyle}>
          {buttonHref ? (
            <a
              href={buttonHref}
              target={buttonOpenInNewTab ? "_blank" : undefined}
              rel={buttonOpenInNewTab ? "noreferrer noopener" : undefined}
              style={{ textDecoration: "none", display: "inline-block" }}
            >
              {buttonElement}
            </a>
          ) : (
            buttonElement
          )}
        </div>
      );
    }
    case "Code": {
      // Extract HTML content
      const htmlContent = block.content || "";

      // Render HTML content or show placeholder
      if (htmlContent.trim()) {
        return (
          <div
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            style={{ width: "100%" }}
          />
        );
      } else {
        return (
          <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
            <Code className="h-8 w-8 mx-auto mb-2 text-gray-600" />
            <p className="text-sm font-medium">{block.label || "HTML"}</p>
          </div>
        );
      }
    }
    default:
      // For all other block types, use the original renderer
      // Map Klaviyo types to mailchimp types if needed
      const mappedBlock = {
        ...block,
        type: mapKlaviyoBlockType(block.type),
      };
      return (
        <CanvasBlockRenderer
          block={mappedBlock}
          section={section}
          isSelected={isSelected}
          updateLayoutColumns={updateLayoutColumns}
          deviceMode={deviceMode}
          updateBlockContent={updateBlockContent}
        />
      );
  }
};

export default KlaviyoCanvasBlockRenderer;

