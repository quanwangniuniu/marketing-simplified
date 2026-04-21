"use client";
import React from "react";
import Image from "next/image";
import { X, Play, Facebook, Instagram, Share2 } from "lucide-react";
import { CanvasBlock, PreviewTab, SocialPlatform } from "../types";

interface PreviewPanelProps {
  isPreviewOpen: boolean;
  setIsPreviewOpen: (open: boolean) => void;
  previewTab: PreviewTab;
  setPreviewTab: (tab: PreviewTab) => void;
  canvasBlocks: {
    header: CanvasBlock[];
    body: CanvasBlock[];
    footer: CanvasBlock[];
  };
  previewContainerRef?: React.RefObject<HTMLDivElement>;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  isPreviewOpen,
  setIsPreviewOpen,
  previewTab,
  setPreviewTab,
  canvasBlocks,
  previewContainerRef,
}) => {
  const buildHref = (
    value?: string,
    type: "Web" | "Email" | "Phone" = "Web"
  ) => {
    const rawValue = value?.trim();
    if (!rawValue) return null;
    switch (type) {
      case "Email": {
        const cleaned = rawValue.replace(/^mailto:/i, "");
        return cleaned ? `mailto:${cleaned}` : null;
      }
      case "Phone": {
        const cleaned = rawValue.replace(/^tel:/i, "");
        return cleaned ? `tel:${cleaned}` : null;
      }
      case "Web":
      default:
        if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(rawValue)) {
          return rawValue;
        }
        return `https://${rawValue}`;
    }
  };
  const getBoxStyleProps = (styles?: any) => {
    if (!styles) return {};
    const hasUnifiedPadding = styles.padding !== undefined;
    const hasUnifiedMargin = styles.margin !== undefined;

    return {
      backgroundColor: styles.backgroundColor,
      borderStyle: styles.borderStyle,
      borderWidth: styles.borderWidth,
      borderColor: styles.borderColor,
      borderRadius: styles.borderRadius,
      // 如果有统一的 padding，只使用统一的 padding，不包含独立的 padding 属性
      ...(hasUnifiedPadding ? { padding: styles.padding } : {}),
      // 如果没有统一的 padding，使用独立的 padding 属性
      ...(!hasUnifiedPadding
        ? {
            paddingTop: styles.paddingTop,
            paddingRight: styles.paddingRight,
            paddingBottom: styles.paddingBottom,
            paddingLeft: styles.paddingLeft,
          }
        : {}),
      // 如果有统一的 margin，只使用统一的 margin，不包含独立的 margin 属性
      ...(hasUnifiedMargin ? { margin: styles.margin } : {}),
      // 如果没有统一的 margin，使用独立的 margin 属性
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

  const renderLayoutPreview = (block: CanvasBlock) => {
    const columns = block.columns || block.columnsWidths?.length || 1;
    let widths = block.columnsWidths;
    if (!widths) {
      const baseWidth = Math.floor(12 / columns);
      const remainder = 12 % columns;
      widths = Array(columns).fill(baseWidth);
      for (let i = 0; i < remainder; i++) widths[i]++;
    }

    const isMobilePreview = previewTab === "Mobile";
    const layoutBlockStyles = block.layoutBlockStyles || {};
    const styleProps = getBoxStyleProps(layoutBlockStyles);

    // Check for nested columnBlocks (Klaviyo feature)
    const columnBlocks = (block as any).columnBlocks as CanvasBlock[][] | undefined;

    return (
      <div
        style={styleProps}
        className={isMobilePreview ? "flex flex-col gap-3" : "flex gap-3"}
      >
        {widths.map((width, idx) => {
          const nestedBlocks = columnBlocks && columnBlocks[idx] ? columnBlocks[idx] : [];
          const hasNestedContent = nestedBlocks.length > 0;

          return (
            <div
              key={idx}
              style={
                isMobilePreview
                  ? { width: "100%" }
                  : { width: `${(width / 12) * 100}%` }
              }
              className={
                hasNestedContent
                  ? ""
                  : "bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-sm text-gray-500 text-center"
              }
            >
              {hasNestedContent ? (
                <div>
                  {nestedBlocks.map((nestedBlock, nestedIdx) => (
                    <div key={nestedIdx}>
                      {renderPreviewBlock(nestedBlock)}
                    </div>
                  ))}
                </div>
              ) : (
                <span>Layout column</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const hasCustomPadding = (styles?: any) => {
    if (!styles) return false;
    return (
      styles.padding !== undefined ||
      styles.paddingTop !== undefined ||
      styles.paddingRight !== undefined ||
      styles.paddingBottom !== undefined ||
      styles.paddingLeft !== undefined
    );
  };

  // Helper function to get all style properties for text blocks
  const getStyleProps = (styles: any) => {
    // Handle undefined or null styles
    if (!styles) {
      return {
        fontFamily: "Helvetica, Arial, sans-serif",
        fontSize: undefined,
        fontWeight: undefined,
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: "center",
        color: undefined,
        backgroundColor: "transparent",
        borderStyle: undefined,
        borderWidth: 0,
        borderColor: undefined,
        borderRadius: undefined,
        padding: undefined,
        margin: undefined,
        paddingTop: undefined,
        paddingRight: undefined,
        paddingBottom: undefined,
        paddingLeft: undefined,
        marginTop: undefined,
        marginRight: undefined,
        marginBottom: undefined,
        marginLeft: undefined,
        direction: undefined,
        lineHeight: undefined,
        letterSpacing: undefined,
      };
    }
    return {
      fontFamily: styles.fontFamily || "Helvetica, Arial, sans-serif",
      fontSize: styles.fontSize ? `${styles.fontSize}px` : undefined,
      fontWeight: styles.fontWeight || undefined,
      fontStyle: styles.fontStyle || "normal",
      textDecoration: styles.textDecoration || "none",
      textAlign: styles.textAlign || "center",
      color: styles.color || undefined,
      backgroundColor: styles.blockBackgroundColor || "transparent",
      borderStyle: styles.borderStyle,
      borderWidth:
        styles.borderStyle && styles.borderStyle !== "none"
          ? styles.borderWidth || "1px"
          : 0,
      borderColor: styles.borderColor,
      borderRadius: styles.borderRadius,
      padding: styles.padding,
      margin: styles.margin,
      paddingTop: styles.paddingTop,
      paddingRight: styles.paddingRight,
      paddingBottom: styles.paddingBottom,
      paddingLeft: styles.paddingLeft,
      marginTop: styles.marginTop,
      marginRight: styles.marginRight,
      marginBottom: styles.marginBottom,
      marginLeft: styles.marginLeft,
      direction: styles.direction || undefined,
      lineHeight: styles.lineHeight
        ? typeof styles.lineHeight === "number"
          ? styles.lineHeight
          : styles.lineHeight
        : undefined,
      letterSpacing: styles.letterSpacing || undefined,
    };
  };

  // Helper function to render list items
  const renderListItems = (
    content: string,
    listType: "unordered" | "ordered"
  ) => {
    if (!content) return [];
    const items = content.split("\n").filter((item) => item.trim());
    return items;
  };

  const renderPreviewBlock = (block: CanvasBlock) => {
    switch (block.type) {
      case "Image": {
        const sizeMode = block.imageDisplayMode || "Original";
        const imageAlt = block.imageAltText?.trim() || "Image";
        const scalePercent = Math.min(
          100,
          Math.max(10, block.imageScalePercent ?? 85)
        );
        const imageStyle =
          sizeMode === "Scale"
            ? {
                width: `${scalePercent}%`,
                maxWidth: "100%",
                height: "auto",
              }
            : sizeMode === "Fill"
            ? { width: "100%", height: "100%" }
            : undefined;
        const imageBlockWrapperStyles = getBoxStyleProps(
          block.imageBlockStyles
        );
        const imageFrameStyles = block.imageFrameStyles || {};
        const hasBorder =
          imageFrameStyles.borderStyle !== undefined &&
          imageFrameStyles.borderStyle !== "none";
        const frameBorderStyles: React.CSSProperties = {
          ...(imageFrameStyles.borderStyle !== undefined && {
            borderStyle: imageFrameStyles.borderStyle,
          }),
          ...(hasBorder && {
            borderWidth: imageFrameStyles.borderWidth || "1px",
            borderColor: imageFrameStyles.borderColor || "#111827",
          }),
          ...(imageFrameStyles.borderRadius !== undefined && {
            borderRadius: imageFrameStyles.borderRadius,
          }),
        };

        const alignmentStyles: Record<
          "left" | "center" | "right",
          React.CSSProperties
        > = {
          left: { display: "flex", justifyContent: "flex-start" },
          center: { display: "flex", justifyContent: "center" },
          right: { display: "flex", justifyContent: "flex-end" },
        };

        const wrapperStyle: React.CSSProperties = {
          ...imageBlockWrapperStyles,
          ...frameBorderStyles,
          ...(alignmentStyles[block.imageAlignment || "center"] || {}),
          alignItems: "center",
          width: "100%",
        };

        return (
          <div className="w-full" style={wrapperStyle}>
            {block.imageUrl ? (
              <Image
                src={block.imageUrl}
                alt={imageAlt}
                width={800}
                height={600}
                style={imageStyle}
                className="block"
                unoptimized
                onError={() => {
                  // Fallback handled by CSS
                }}
              />
            ) : (
              <div className="border border-gray-200 w-[600px] h-[240px] flex items-center justify-center py-6">
                <div className="text-center text-gray-500 space-y-2">
                  <div className="h-16 w-16 rounded-full border-2 border-dashed border-gray-400 mx-auto"></div>
                  <p className="text-sm text-gray-500">Image</p>
                </div>
              </div>
            )}
          </div>
        );
      }
      case "Heading": {
        const headingStyles = block.styles || {};
        const headingStyleProps = getStyleProps(headingStyles);
        const textLinkActive = Boolean(block.textLinkValue?.trim());
        const linkHref =
          block.textLinkValue && block.textLinkValue.trim()
            ? buildHref(block.textLinkValue, block.textLinkType || "Web")
            : null;
        const linkNodeWrapper = (node: React.ReactNode) => {
          if (!linkHref) return node;
          const openInNewTab = block.textLinkOpenInNewTab ?? true;
          const linkColor =
            headingStyleProps.color || headingStyles.color || "#0f766e";
          return (
            <a
              href={linkHref}
              target={openInNewTab ? "_blank" : undefined}
              rel={openInNewTab ? "noreferrer noopener" : undefined}
              style={{
                color: linkColor,
                textDecoration: "underline",
              }}
            >
              {node}
            </a>
          );
        };

        // If list type is set, render as list
        if (headingStyles.listType) {
          const listItems = renderListItems(
            block.content || "",
            headingStyles.listType
          );
          const ListTag = headingStyles.listType === "ordered" ? "ol" : "ul";
          return (
            <ListTag
              className="text-2xl py-4"
              style={{
                ...headingStyleProps,
                color: headingStyleProps.color || "#111827",
                listStylePosition: "inside",
                paddingLeft: "0",
              }}
            >
              {listItems.length > 0 ? (
                listItems.map((item, idx) => (
                  <li key={idx}>
                    {linkNodeWrapper(
                      <span
                        style={{
                          backgroundColor: headingStyles.textHighlightColor,
                        }}
                      >
                        {item.trim()}
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <li>
                  {linkNodeWrapper(
                    <span
                      style={{
                        backgroundColor: headingStyles.textHighlightColor,
                      }}
                    >
                      Heading
                    </span>
                  )}
                </li>
              )}
            </ListTag>
          );
        }

        return (
          <h2
            className="text-2xl py-4"
            style={{
              ...headingStyleProps,
              color: headingStyleProps.color || "#111827",
            }}
          >
            {linkNodeWrapper(
              <span
                style={{
                  backgroundColor: headingStyles.textHighlightColor,
                }}
              >
                {block.content || "Heading"}
              </span>
            )}
          </h2>
        );
      }
      case "Paragraph": {
        const paragraphStyles = block.styles || {};
        const paragraphStyleProps = getStyleProps(paragraphStyles);
        const linkHref =
          block.textLinkValue && block.textLinkValue.trim()
            ? buildHref(block.textLinkValue, block.textLinkType || "Web")
            : null;
        const linkNodeWrapper = (node: React.ReactNode) => {
          if (!linkHref) return node;
          const openInNewTab = block.textLinkOpenInNewTab ?? true;
          const linkColor =
            paragraphStyleProps.color || paragraphStyles.color || "#0f766e";
          return (
            <a
              href={linkHref}
              target={openInNewTab ? "_blank" : undefined}
              rel={openInNewTab ? "noreferrer noopener" : undefined}
              style={{
                color: linkColor,
                textDecoration: "underline",
              }}
            >
              {node}
            </a>
          );
        };

        // If list type is set, render as list
        if (paragraphStyles.listType) {
          const listItems = renderListItems(
            block.content || "",
            paragraphStyles.listType
          );
          const ListTag = paragraphStyles.listType === "ordered" ? "ol" : "ul";
          return (
            <ListTag
              className="text-base py-4"
              style={{
                ...paragraphStyleProps,
                color: paragraphStyleProps.color || "#374151",
                listStylePosition: "inside",
                paddingLeft: "0",
              }}
            >
              {listItems.length > 0 ? (
                listItems.map((item, idx) => (
                  <li key={idx}>
                    {linkNodeWrapper(
                      <span
                        style={{
                          backgroundColor: paragraphStyles.textHighlightColor,
                        }}
                      >
                        {item.trim()}
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <li>
                  {linkNodeWrapper(
                    <span
                      style={{
                        backgroundColor: paragraphStyles.textHighlightColor,
                      }}
                    >
                      Text content
                    </span>
                  )}
                </li>
              )}
            </ListTag>
          );
        }

        return (
          <p
            className="text-base py-4"
            style={{
              ...paragraphStyleProps,
              color: paragraphStyleProps.color || "#374151",
            }}
          >
            {linkNodeWrapper(
              <span
                style={{
                  backgroundColor: paragraphStyles.textHighlightColor,
                }}
              >
                {block.content || "Text content"}
              </span>
            )}
          </p>
        );
      }
      case "Logo": {
        const sizeMode = block.imageDisplayMode || "Original";
        const imageAlt = block.imageAltText?.trim() || "Logo";
        const scalePercent = Math.min(
          100,
          Math.max(10, block.imageScalePercent ?? 85)
        );
        const hasUserInteracted =
          block.imageScalePercent !== undefined &&
          (block.imageScalePercent === 86 || block.imageScalePercent !== 85);
        const shouldShowInitialSize =
          sizeMode === "Original" && block.imageUrl && !hasUserInteracted;
        const imageStyle =
          sizeMode === "Scale"
            ? {
                width: `${scalePercent}%`,
                maxWidth: "100%",
                height: "auto",
              }
            : sizeMode === "Fill"
            ? { width: "100%", height: "100%" }
            : shouldShowInitialSize
            ? {
                maxWidth: "200px",
                maxHeight: "200px",
                width: "auto",
                height: "auto",
              }
            : undefined;
        const imageBlockWrapperStyles = getBoxStyleProps(
          block.imageBlockStyles
        );
        const imageFrameStyles = block.imageFrameStyles || {};
        const hasBorder =
          imageFrameStyles.borderStyle !== undefined &&
          imageFrameStyles.borderStyle !== "none";
        const frameBorderStyles: React.CSSProperties = {
          ...(imageFrameStyles.borderStyle !== undefined && {
            borderStyle: imageFrameStyles.borderStyle,
          }),
          ...(hasBorder && {
            borderWidth: imageFrameStyles.borderWidth || "1px",
            borderColor: imageFrameStyles.borderColor || "#111827",
          }),
          ...(imageFrameStyles.borderRadius !== undefined && {
            borderRadius: imageFrameStyles.borderRadius,
          }),
        };

        const alignmentStyles: Record<
          "left" | "center" | "right",
          React.CSSProperties
        > = {
          left: { display: "flex", justifyContent: "flex-start" },
          center: { display: "flex", justifyContent: "center" },
          right: { display: "flex", justifyContent: "flex-end" },
        };

        const wrapperStyle: React.CSSProperties = {
          ...imageBlockWrapperStyles,
          ...frameBorderStyles,
          ...(alignmentStyles[block.imageAlignment || "center"] || {}),
          alignItems: "center",
          width: "100%",
        };

        return (
          <div className="w-full" style={wrapperStyle}>
            {block.imageUrl ? (
              <Image
                src={block.imageUrl}
                alt={imageAlt}
                width={200}
                height={200}
                style={imageStyle}
                className="block"
                unoptimized
                onError={() => {
                  // Fallback handled by CSS
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center py-6"
                style={{ width: "200px", height: "200px", margin: "0 auto" }}
              >
                <div className="text-center text-gray-500 space-y-2">
                  <div className="h-16 w-16 rounded-full border-2 border-dashed border-gray-400 mx-auto"></div>
                  <p className="text-sm text-gray-500">Logo</p>
                </div>
              </div>
            )}
          </div>
        );
      }
      case "Button": {
        const buttonBlockStyles = getBoxStyleProps(
          block.buttonBlockStyles
        ) as React.CSSProperties;
        const buttonTextColor = block.buttonTextColor || "#ffffff";
        const buttonBackgroundColor = block.buttonBackgroundColor || "#111827";
        const buttonShape = block.buttonShape || "Square";
        const buttonAlignment = block.buttonAlignment || "center";
        const buttonSize = block.buttonSize || "Small";

        const sizeWidths: Record<string, string> = {
          Small: "150px",
          Medium: "200px",
          Large: "300px",
        };
        const buttonWidth = sizeWidths[buttonSize] || sizeWidths.Small;

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
          color: buttonTextColor,
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

        return (
          <div style={buttonWrapperStyle}>
            <button
              style={buttonStyle}
              className="px-6 py-2 font-medium transition-colors"
            >
              {block.content || "Button text"}
            </button>
          </div>
        );
      }
      case "Divider": {
        const dividerStyle = block.dividerStyle || "solid";
        const dividerLineColor = block.dividerLineColor || "#000000";
        const dividerThickness = block.dividerThickness
          ? typeof block.dividerThickness === "number"
            ? `${block.dividerThickness}px`
            : block.dividerThickness
          : "2px";
        const blockStyles = getBoxStyleProps(block.dividerBlockStyles);
        const hasUnifiedPadding =
          block.dividerBlockStyles?.padding !== undefined;
        const paddingTop =
          block.dividerBlockStyles?.paddingTop ||
          (hasUnifiedPadding ? block.dividerBlockStyles?.padding : undefined) ||
          "20px";
        const paddingBottom =
          block.dividerBlockStyles?.paddingBottom ||
          (hasUnifiedPadding ? block.dividerBlockStyles?.padding : undefined) ||
          "20px";
        const paddingLeft =
          block.dividerBlockStyles?.paddingLeft ||
          (hasUnifiedPadding ? block.dividerBlockStyles?.padding : undefined) ||
          "24px";
        const paddingRight =
          block.dividerBlockStyles?.paddingRight ||
          (hasUnifiedPadding ? block.dividerBlockStyles?.padding : undefined) ||
          "24px";

        return (
          <div
            style={{
              ...blockStyles,
              paddingTop,
              paddingBottom,
              paddingLeft,
              paddingRight,
            }}
          >
            <div
              style={{
                borderTopStyle: dividerStyle,
                borderTopWidth: dividerThickness,
                borderTopColor: dividerLineColor,
                width: "100%",
              }}
            />
          </div>
        );
      }
      case "Spacer": {
        const spacerHeight = block.spacerHeight
          ? typeof block.spacerHeight === "number"
            ? `${block.spacerHeight}px`
            : block.spacerHeight
          : "20px";
        const blockStyles = getBoxStyleProps(block.spacerBlockStyles);

        return (
          <div
            style={{
              height: spacerHeight,
              ...blockStyles,
            }}
          />
        );
      }
      case "Social": {
        const socialLinks = block.socialLinks || [];
        const socialDisplay = block.socialDisplay || "Icon only";
        const socialIconStyle = block.socialIconStyle || "Filled";
        const socialLayout = block.socialLayout || "Horizontal-right";
        const socialIconColor = block.socialIconColor || "#000000";
        const socialSize = block.socialSize || "Large";
        const socialAlignment = block.socialAlignment || "center";
        const socialSpacingValue = block.socialSpacing
          ? typeof block.socialSpacing === "number"
            ? block.socialSpacing
            : parseFloat(block.socialSpacing.replace("px", "")) || 24
          : 24;
        const socialSpacing = `${Math.max(
          2,
          Math.min(60, socialSpacingValue)
        )}px`;
        const blockStyles = getBoxStyleProps(block.socialBlockStyles);

        const sizeMap: Record<
          string,
          { icon: string; container: string; plainIcon: string }
        > = {
          Small: {
            icon: "h-4 w-4",
            container: "w-8 h-8",
            plainIcon: "h-8 w-8",
          },
          Medium: {
            icon: "h-5 w-5",
            container: "w-10 h-10",
            plainIcon: "h-10 w-10",
          },
          Large: {
            icon: "h-6 w-6",
            container: "w-12 h-12",
            plainIcon: "h-12 w-12",
          },
        };

        const isVerticalLayout =
          socialLayout === "Vertical-right" ||
          socialLayout === "Vertical-bottom";
        const isTextOnRight =
          socialLayout === "Horizontal-right" ||
          socialLayout === "Vertical-right";

        const getAlignmentClass = () => {
          if (isVerticalLayout) {
            const alignmentMap: Record<string, string> = {
              left: "items-start",
              center: "items-center",
              right: "items-end",
            };
            return alignmentMap[socialAlignment];
          } else {
            const alignmentMap: Record<string, string> = {
              left: "justify-start",
              center: "justify-center",
              right: "justify-end",
            };
            return alignmentMap[socialAlignment];
          }
        };

        const layoutMap: Record<string, string> = {
          "Horizontal-right": "flex-row",
          "Horizontal-bottom": "flex-row",
          "Vertical-right": "flex-col",
          "Vertical-bottom": "flex-col",
        };

        const getPlatformIcon = (
          platform: SocialPlatform,
          usePlainSize: boolean = false
        ) => {
          const iconSize = usePlainSize
            ? sizeMap[socialSize].plainIcon
            : sizeMap[socialSize].icon;
          switch (platform) {
            case "Facebook":
              return <Facebook className={iconSize} />;
            case "Instagram":
              return <Instagram className={iconSize} />;
            case "X":
              return <X className={iconSize} />;
            default:
              return <Share2 className={iconSize} />;
          }
        };

        const renderIconWithStyle = (
          platform: SocialPlatform,
          iconColor: string
        ) => {
          const containerSize = sizeMap[socialSize].container;
          const isXPlatform = platform === "X";

          switch (socialIconStyle) {
            case "Plain":
              const plainIcon = getPlatformIcon(platform, true);
              return (
                <div
                  className="flex items-center justify-center"
                  style={{ color: iconColor }}
                >
                  {plainIcon}
                </div>
              );
            case "Filled":
              const filledIcon = getPlatformIcon(platform, false);
              return (
                <div
                  className={`${containerSize} rounded-full flex items-center justify-center`}
                  style={{ backgroundColor: iconColor }}
                >
                  <div
                    style={{
                      color: isXPlatform ? "#ffffff" : "#ffffff",
                    }}
                  >
                    {filledIcon}
                  </div>
                </div>
              );
            case "Outlined":
              const outlinedIcon = getPlatformIcon(platform, false);
              return (
                <div
                  className={`${containerSize} rounded-full border-2 flex items-center justify-center`}
                  style={{
                    borderColor: iconColor,
                    color: iconColor,
                  }}
                >
                  {outlinedIcon}
                </div>
              );
            default:
              const defaultIcon = getPlatformIcon(platform, false);
              return (
                <div
                  className={`${containerSize} flex items-center justify-center`}
                  style={{ color: iconColor }}
                >
                  {defaultIcon}
                </div>
              );
          }
        };

        if (socialLinks.length === 0) {
          return (
            <div
              className="flex justify-center items-center py-8 border border-dashed border-gray-300 rounded-lg"
              style={blockStyles}
            >
              <div className="text-center text-gray-500">
                <Share2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No social links added</p>
              </div>
            </div>
          );
        }

        const containerClassName = `flex ${
          layoutMap[socialLayout]
        } ${getAlignmentClass()} flex-wrap`;

        return (
          <div style={blockStyles}>
            <div className={containerClassName} style={{ gap: socialSpacing }}>
              {socialLinks.map((link) => {
                const iconElement = renderIconWithStyle(
                  link.platform,
                  socialIconColor
                );

                if (socialDisplay === "Icon and text") {
                  const iconTextLayout = isTextOnRight
                    ? "flex-row"
                    : "flex-col";
                  const iconTextAlignment = isTextOnRight
                    ? "items-center"
                    : "items-center";
                  return (
                    <a
                      key={link.id}
                      href={link.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex ${iconTextLayout} ${iconTextAlignment} gap-2 hover:opacity-80 transition-opacity`}
                      title={link.label || link.platform}
                    >
                      {iconElement}
                      <span className="text-sm text-gray-900 text-center">
                        {link.label || link.platform}
                      </span>
                    </a>
                  );
                } else {
                  return (
                    <a
                      key={link.id}
                      href={link.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-80 transition-opacity"
                      title={link.label || link.platform}
                    >
                      {iconElement}
                    </a>
                  );
                }
              })}
            </div>
          </div>
        );
      }
      case "Text": {
        // Map Text blocks to Paragraph rendering logic
        const paragraphStyles = block.styles || {};
        const paragraphStyleProps = getStyleProps(paragraphStyles);
        const linkHref =
          block.textLinkValue && block.textLinkValue.trim()
            ? buildHref(block.textLinkValue, block.textLinkType || "Web")
            : null;
        const linkNodeWrapper = (node: React.ReactNode) => {
          if (!linkHref) return node;
          const openInNewTab = block.textLinkOpenInNewTab ?? true;
          const linkColor =
            paragraphStyleProps.color || paragraphStyles.color || "#0f766e";
          return (
            <a
              href={linkHref}
              target={openInNewTab ? "_blank" : undefined}
              rel={openInNewTab ? "noreferrer noopener" : undefined}
              style={{
                color: linkColor,
                textDecoration: "underline",
              }}
            >
              {node}
            </a>
          );
        };

        // If list type is set, render as list
        if (paragraphStyles.listType) {
          const listItems = renderListItems(
            block.content || "",
            paragraphStyles.listType
          );
          const ListTag = paragraphStyles.listType === "ordered" ? "ol" : "ul";
          return (
            <ListTag
              className="text-base py-4"
              style={{
                ...paragraphStyleProps,
                color: paragraphStyleProps.color || "#374151",
                listStylePosition: "inside",
                paddingLeft: "0",
              }}
            >
              {listItems.length > 0 ? (
                listItems.map((item, idx) => (
                  <li key={idx}>
                    {linkNodeWrapper(
                      <span
                        style={{
                          backgroundColor: paragraphStyles.textHighlightColor,
                        }}
                      >
                        {item.trim()}
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <li>
                  {linkNodeWrapper(
                    <span
                      style={{
                        backgroundColor: paragraphStyles.textHighlightColor,
                      }}
                    >
                      Text content
                    </span>
                  )}
                </li>
              )}
            </ListTag>
          );
        }

        return (
          <p
            className="text-base py-4"
            style={{
              ...paragraphStyleProps,
              color: paragraphStyleProps.color || "#374151",
            }}
          >
            {linkNodeWrapper(
              <span
                style={{
                  backgroundColor: paragraphStyles.textHighlightColor,
                }}
              >
                {block.content || "Text content"}
              </span>
            )}
          </p>
        );
      }
      case "Split":
        return renderLayoutPreview(block);
      case "Layout":
        return renderLayoutPreview(block);
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
                        width={120}
                        height={40}
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
                              <Image
                                src={item.imageUrl}
                                alt={item.imageAltText || "Image"}
                                width={32}
                                height={32}
                                className="object-contain"
                                unoptimized
                              />
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
                        const linkHref = buildHref(
                          item.linkAddress || "",
                          item.linkType || "Web"
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
                <Image
                  src={logoUrl}
                  alt="Logo"
                  width={120}
                  height={40}
                  className="object-contain"
                  unoptimized
                />
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
                          <Image
                            src={item.imageUrl}
                            alt={item.imageAltText || "Image"}
                            width={32}
                            height={32}
                            className="object-contain"
                            unoptimized
                          />
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
                    const linkHref = buildHref(
                      item.linkAddress || "",
                      item.linkType || "Web"
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
                <p className="text-sm font-medium">{block.label || "Header bar"}</p>
              </div>
            )}
          </div>
        );
      }
      default:
        return (
          <div className="border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-600">
            {block.label}
          </div>
        );
    }
  };

  const renderSectionPreview = (blocks: CanvasBlock[]) => (
    <div>
      {blocks
        .map((block) => renderPreviewBlock(block))
        .filter(Boolean)
        .map((content, idx) => (
          <div key={idx}>{content}</div>
        ))}
    </div>
  );

  const renderPreviewEmail = () => {
    const widthClass =
      previewTab === "Mobile"
        ? "max-w-sm"
        : previewTab === "Inbox"
        ? "max-w-2xl"
        : "max-w-3xl";

    return (
      <div className="flex justify-center px-6 pb-6">
        <div
          ref={previewContainerRef}
          className={`w-full ${widthClass} bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden`}
        >
          <div className="bg-gray-50 text-center text-xs text-gray-500 py-3 underline"></div>
          <div className="px-8 py-10">
            {renderSectionPreview(canvasBlocks.header)}
            {renderSectionPreview(canvasBlocks.body)}
            {renderSectionPreview(canvasBlocks.footer)}
          </div>
        </div>
      </div>
    );
  };

  const renderPreviewEmailInfo = () => (
    <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-200 bg-gray-50 px-6 py-6 space-y-6 text-sm text-gray-600">
      <div>
        <div className="flex items-center justify-between text-gray-900 font-semibold mb-4">
          <span>Email Info</span>
        </div>
        <label className="flex items-center justify-between text-sm text-gray-700">
          <span>Enable live merge tag info</span>
          <div className="w-10 h-6 bg-gray-200 rounded-full relative">
            <div className="absolute top-1 left-1 h-4 w-4 bg-white rounded-full shadow"></div>
          </div>
        </label>
        <p className="mt-3 text-xs text-gray-500">
          You haven&apos;t chosen an audience for this email yet. Learn more
          about merge tags.
        </p>
      </div>
    </div>
  );

  if (!isPreviewOpen) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col bg-black/40"
      onClick={() => setIsPreviewOpen(false)}
    >
      <div
        className="mt-auto bg-white rounded-t-3xl shadow-2xl border-t border-gray-200 h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
            <p className="text-sm text-gray-500">
              See how your email looks before sending
            </p>
          </div>
          <button
            onClick={() => setIsPreviewOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-6 pb-4 border-b border-gray-200 text-sm font-medium text-gray-600">
          {(["Desktop", "Mobile", "Inbox"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPreviewTab(tab)}
              className={`pb-2 border-b-2 ${
                previewTab === tab
                  ? "border-[#3CCED7] text-[#1a9ba3]"
                  : "border-transparent hover:text-gray-800"
              }`}
            >
              {tab}
            </button>
          ))}
          <button className="ml-auto inline-flex items-center gap-2 text-[#1a9ba3] hover:text-[#1a9ba3]">
            <Play className="h-4 w-4" />
            Send a Test Email
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 overflow-auto">{renderPreviewEmail()}</div>
          {renderPreviewEmailInfo()}
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;
