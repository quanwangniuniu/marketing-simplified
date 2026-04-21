"use client";
import React from "react";
import Image from "next/image";
import {
  Image as ImageIcon,
  Sparkles,
  ListChecks,
  Code,
  Grid3x3,
  ShoppingBag,
  Heart,
  HexagonIcon,
  Facebook,
  Instagram,
  Share2,
  X,
} from "lucide-react";
import LayoutBlock from "../LayoutBlock";
import {
  BlockBoxStyles,
  CanvasBlock,
  DeviceMode,
  ImageSizeMode,
  SocialPlatform,
  SocialDisplay,
  SocialIconStyle,
  SocialLayout,
  SocialSize,
  SocialAlignment,
} from "../types";

interface CanvasBlockRendererProps {
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
}

const CanvasBlockRenderer: React.FC<CanvasBlockRendererProps> = ({
  block,
  section,
  isSelected,
  updateLayoutColumns,
  deviceMode,
  updateBlockContent,
}) => {
  const hasCustomPadding = (styles?: BlockBoxStyles) => {
    if (!styles) return false;
    return (
      styles.padding !== undefined ||
      styles.paddingTop !== undefined ||
      styles.paddingRight !== undefined ||
      styles.paddingBottom !== undefined ||
      styles.paddingLeft !== undefined
    );
  };

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

  const imageSizeClassMap: Record<ImageSizeMode, string> = {
    Original: "w-auto max-w-full h-auto object-contain",
    Fill: "w-full h-full object-cover",
    Scale: "max-w-full object-contain",
  };

  const normalizeWebUrl = (url: string) => {
    if (!url) return "";
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
      return url;
    }
    return `https://${url}`;
  };

  const buildImageHref = (currentBlock: CanvasBlock) => {
    const rawValue = currentBlock.imageLinkValue?.trim();
    if (!rawValue) return null;
    const linkType = currentBlock.imageLinkType || "Web";

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

  const buildButtonHref = (currentBlock: CanvasBlock) => {
    const rawValue = currentBlock.buttonLinkValue?.trim();
    if (!rawValue) return null;
    const linkType = currentBlock.buttonLinkType || "Web";

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

  const buildTextHref = (currentBlock: CanvasBlock) => {
    const rawValue = currentBlock.textLinkValue?.trim();
    if (!rawValue) return null;
    const linkType = currentBlock.textLinkType || "Web";

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

  const wrapTextWithLink = (node: React.ReactNode) => {
    const href = buildTextHref(block);
    if (!href) return node;
    const openInNewTab = block.textLinkOpenInNewTab ?? true;
    const linkStyle = getTextLinkStyle();
    return (
      <a
        href={href}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noreferrer noopener" : undefined}
        style={{
          color: linkStyle.color,
          textDecoration: linkStyle.textDecoration as
            | "underline"
            | "line-through"
            | "none",
        }}
      >
        {node}
      </a>
    );
  };

  const withOptionalLink = (imageNode: React.ReactNode) => {
    const href = buildImageHref(block);
    if (!href) return imageNode;
    const openInNewTab = block.imageOpenInNewTab ?? true;
    return (
      <a
        href={href}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noreferrer noopener" : undefined}
      >
        {imageNode}
      </a>
    );
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

  const inlineEditorRef = React.useRef<HTMLSpanElement | null>(null);
  const [inlineTextContent, setInlineTextContent] = React.useState(
    block.content || ""
  );
  const isInlineTextBlock =
    block.type === "Heading" || block.type === "Paragraph";

  React.useEffect(() => {
    if (isInlineTextBlock) {
      setInlineTextContent(block.content || "");
    }
  }, [block.content, block.id, isInlineTextBlock]);

  React.useEffect(() => {
    if (!isInlineTextBlock || !isSelected || !inlineEditorRef.current) {
      return;
    }
    const nextValue = inlineTextContent || "";
    if (inlineEditorRef.current.innerText !== nextValue) {
      inlineEditorRef.current.innerText = nextValue;
    }
  }, [inlineTextContent, isInlineTextBlock, isSelected]);

  const handleInlineTextInput = (event: React.FormEvent<HTMLSpanElement>) => {
    if (!isInlineTextBlock) return;
    const textValue = event.currentTarget.textContent ?? "";
    setInlineTextContent(textValue);
    if (section && updateBlockContent) {
      updateBlockContent(section, block.id, textValue);
    }
  };

  const handleInlineTextKeyDown = (
    event: React.KeyboardEvent<HTMLSpanElement>
  ) => {
    if (block.type === "Heading" && event.key === "Enter") {
      event.preventDefault();
    }
  };

  const textLinkActive = Boolean(block.textLinkValue?.trim());
  const getTextLinkStyle = () => ({
    color: block.styles?.color || "#0f766e",
    textDecoration: "underline",
  });

  const renderInlineEditableText = (
    Tag: "h2" | "p",
    className: string,
    styleProps: React.CSSProperties,
    defaultColor: string,
    highlightColor?: string,
    placeholder?: string,
    isTextLinkActive?: boolean
  ) => {
    const minHeight = Tag === "p" ? "1.5em" : "1.2em";
    return (
      <Tag
        className={className}
        style={{
          ...styleProps,
          color: styleProps.color || defaultColor,
        }}
        dir={styleProps.direction as "ltr" | "rtl" | undefined}
      >
        <div
          className="relative inline-block w-full"
          style={{ minHeight }}
          onClick={() => inlineEditorRef.current?.focus()}
        >
          {!inlineTextContent && placeholder && (
            <span
              className={`absolute left-0 top-0 pointer-events-none select-none text-gray-400 ${
                Tag === "p" ? "whitespace-pre-wrap" : ""
              }`}
              style={{
                backgroundColor: highlightColor,
                textDecoration: isTextLinkActive
                  ? "underline"
                  : styleProps.textDecoration,
                color: isTextLinkActive
                  ? (styleProps.color as string) || "#0f766e"
                  : undefined,
              }}
              dir={styleProps.direction as "ltr" | "rtl" | undefined}
            >
              {placeholder}
            </span>
          )}
          <span
            ref={inlineEditorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInlineTextInput}
            onKeyDown={handleInlineTextKeyDown}
            className={`outline-none ${
              Tag === "p" ? "whitespace-pre-wrap" : ""
            } ${inlineTextContent ? "" : "text-gray-900"}`}
            style={{
              backgroundColor: highlightColor,
              color: isTextLinkActive
                ? (styleProps.color as string) || "#0f766e"
                : styleProps.color || defaultColor,
              textDecoration: isTextLinkActive
                ? "underline"
                : styleProps.textDecoration,
              display: "inline",
            }}
            role="textbox"
            aria-label={placeholder || "Text block content"}
            spellCheck={false}
            dir={styleProps.direction as "ltr" | "rtl" | undefined}
          />
        </div>
      </Tag>
    );
  };

  // Helper function to get all style properties
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
      direction: styles.direction || undefined, // Only set if explicitly defined
      lineHeight: styles.lineHeight
        ? typeof styles.lineHeight === "number"
          ? styles.lineHeight
          : styles.lineHeight
        : undefined,
      letterSpacing: styles.letterSpacing || undefined,
    };
  };

  switch (block.type) {
    case "Image": {
      const sizeMode: ImageSizeMode = block.imageDisplayMode || "Original";
      const imageClasses = imageSizeClassMap[sizeMode];
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
      const imageBlockWrapperStyles = getBoxStyleProps(block.imageBlockStyles);
      const imageFrameStyles = getBoxStyleProps(block.imageFrameStyles);
      const framePaddingClass = hasCustomPadding(block.imageFrameStyles)
        ? ""
        : "px-6 py-3";
      const frameClassName = `${framePaddingClass}`.trim();

      const alignmentStyles: Record<
        NonNullable<CanvasBlock["imageAlignment"]>,
        React.CSSProperties
      > = {
        left: { display: "flex", justifyContent: "flex-start" },
        center: { display: "flex", justifyContent: "center" },
        right: { display: "flex", justifyContent: "flex-end" },
      };

      // 从 imageFrameStyles 中提取 border 和 borderRadius 相关属性
      const frameStyles = block.imageFrameStyles || {};
      const hasBorder =
        frameStyles.borderStyle !== undefined &&
        frameStyles.borderStyle !== "none";
      const frameBorderStyles: React.CSSProperties = {
        ...(frameStyles.borderStyle !== undefined && {
          borderStyle: frameStyles.borderStyle,
        }),
        // 如果有 border，设置 borderWidth（默认 1px）和 borderColor（默认黑色）
        ...(hasBorder && {
          borderWidth: frameStyles.borderWidth || "1px",
          borderColor: frameStyles.borderColor || "#111827",
        }),
        ...(frameStyles.borderRadius !== undefined && {
          borderRadius: frameStyles.borderRadius,
        }),
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
            withOptionalLink(
              <Image
                src={block.imageUrl}
                alt={imageAlt}
                width={800}
                height={600}
                className={`${imageClasses}`}
                style={imageStyle}
                unoptimized
                onError={() => {
                  // Fallback handled by CSS
                }}
              />
            )
          ) : (
            <div className="border border-gray-200 w-full max-w-full h-[240px] flex items-center justify-center py-6" style={{ width: "100%", maxWidth: "100%" }}>
              <div className="text-center text-gray-500 space-y-2">
                <ImageIcon className="h-8 w-8 mx-auto text-gray-400" />
                <span className="text-sm">Image</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    case "Logo": {
      const sizeMode: ImageSizeMode = block.imageDisplayMode || "Original";
      const imageClasses = imageSizeClassMap[sizeMode];
      const imageAlt = block.imageAltText?.trim() || "Logo";
      const scalePercent = Math.min(
        100,
        Math.max(10, block.imageScalePercent ?? 85)
      );
      // Logo 在刚添加图片时显示为 200x200
      // 一旦用户点击了任何 Size 选项（包括 Original），就按照正常逻辑显示原始大小
      // 当用户点击 Original 时，imageScalePercent 会被设置为 86 来标记用户已交互
      // 如果 imageScalePercent 是 86 或不是默认值 85，说明用户已经交互过
      const hasUserInteracted =
        block.imageScalePercent !== undefined &&
        (block.imageScalePercent === 86 || block.imageScalePercent !== 85);
      // 只在图片刚添加且用户还没有交互过时，显示为 200x200
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
      const imageBlockWrapperStyles = getBoxStyleProps(block.imageBlockStyles);
      const imageFrameStyles = getBoxStyleProps(block.imageFrameStyles);
      const framePaddingClass = hasCustomPadding(block.imageFrameStyles)
        ? ""
        : "px-6 py-3";
      const frameClassName = `${framePaddingClass}`.trim();

      const alignmentStyles: Record<
        NonNullable<CanvasBlock["imageAlignment"]>,
        React.CSSProperties
      > = {
        left: { display: "flex", justifyContent: "flex-start" },
        center: { display: "flex", justifyContent: "center" },
        right: { display: "flex", justifyContent: "flex-end" },
      };

      // 从 imageFrameStyles 中提取 border 和 borderRadius 相关属性
      const frameStyles = block.imageFrameStyles || {};
      const hasBorder =
        frameStyles.borderStyle !== undefined &&
        frameStyles.borderStyle !== "none";
      const frameBorderStyles: React.CSSProperties = {
        ...(frameStyles.borderStyle !== undefined && {
          borderStyle: frameStyles.borderStyle,
        }),
        // 如果有 border，设置 borderWidth（默认 1px）和 borderColor（默认黑色）
        ...(hasBorder && {
          borderWidth: frameStyles.borderWidth || "1px",
          borderColor: frameStyles.borderColor || "#111827",
        }),
        ...(frameStyles.borderRadius !== undefined && {
          borderRadius: frameStyles.borderRadius,
        }),
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
            withOptionalLink(
              <Image
                src={block.imageUrl}
                alt={imageAlt}
                width={200}
                height={200}
                className={`${imageClasses}`}
                style={imageStyle}
                unoptimized
                onError={() => {
                  // Fallback handled by CSS
                }}
              />
            )
          ) : (
            <div
              className="flex items-center justify-center py-6"
              style={{ width: "200px", height: "200px", margin: "0 auto" }}
            >
              <div className="text-center text-gray-500 space-y-2">
                <HexagonIcon className="h-16 w-16 mx-auto text-black" />
              </div>
            </div>
          )}
        </div>
      );
    }
    case "Heading":
      const headingStyles = block.styles || {};
      const headingStyleProps = getStyleProps(headingStyles);
      const canInlineEditHeading =
        block.type === "Heading" &&
        !headingStyles.listType &&
        !!section &&
        !!updateBlockContent;

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
                  <span
                    style={{
                      backgroundColor: headingStyles.textHighlightColor,
                    }}
                  >
                    {item.trim()}
                  </span>
                </li>
              ))
            ) : (
              <li>
                <span
                  style={{
                    backgroundColor: headingStyles.textHighlightColor,
                  }}
                >
                  Heading
                </span>
              </li>
            )}
          </ListTag>
        );
      }

      if (canInlineEditHeading && isSelected) {
        return renderInlineEditableText(
          "h2",
          "text-2xl py-4",
          headingStyleProps,
          "#111827",
          headingStyles.textHighlightColor,
          "Heading text",
          textLinkActive
        );
      }

      return (
        <h2
          className="text-2xl py-4"
          style={{
            ...headingStyleProps,
            color: headingStyleProps.color || "#111827",
          }}
          dir={headingStyleProps.direction as "ltr" | "rtl" | undefined}
        >
          {wrapTextWithLink(
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
    case "Paragraph":
      const paragraphStyles = block.styles || {};
      const paragraphStyleProps = getStyleProps(paragraphStyles);
      const canInlineEditParagraph =
        block.type === "Paragraph" &&
        !paragraphStyles.listType &&
        !!section &&
        !!updateBlockContent;

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
                  <span
                    style={{
                      backgroundColor: paragraphStyles.textHighlightColor,
                    }}
                  >
                    {item.trim()}
                  </span>
                </li>
              ))
            ) : (
              <li>
                <span
                  style={{
                    backgroundColor: paragraphStyles.textHighlightColor,
                  }}
                >
                  Text content
                </span>
              </li>
            )}
          </ListTag>
        );
      }

      if (canInlineEditParagraph && isSelected) {
        return renderInlineEditableText(
          "p",
          "text-base py-4",
          paragraphStyleProps,
          "#374151",
          paragraphStyles.textHighlightColor,
          "Text content",
          textLinkActive
        );
      }

      return (
        <p
          className="text-base py-4"
          style={{
            ...paragraphStyleProps,
            color: paragraphStyleProps.color || "#374151",
          }}
          dir={paragraphStyleProps.direction as "ltr" | "rtl" | undefined}
        >
          {wrapTextWithLink(
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
    case "Button":
      const buttonBlockStyles = getBoxStyleProps(
        block.buttonBlockStyles
      ) as React.CSSProperties;
      const buttonHref = buildButtonHref(block);
      const buttonOpenInNewTab = block.buttonOpenInNewTab ?? true;
      const buttonTextColor = block.buttonTextColor || "#ffffff";
      const buttonBackgroundColor = block.buttonBackgroundColor || "#111827";
      const buttonShape = block.buttonShape || "Square";
      const buttonAlignment = block.buttonAlignment || "center";
      const buttonSize = block.buttonSize || "Small";

      // Size-based width only
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
        // Padding is the space between button and external block
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
          className="px-6 py-2 font-medium transition-colors"
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
    case "Divider": {
      const dividerStyle = block.dividerStyle || "solid";
      const dividerLineColor = block.dividerLineColor || "#000000";
      const dividerThickness = block.dividerThickness
        ? typeof block.dividerThickness === "number"
          ? `${block.dividerThickness}px`
          : block.dividerThickness
        : "2px";
      const blockStyles = block.dividerBlockStyles || {};
      const blockBackgroundColor = blockStyles.backgroundColor || "transparent";
      const paddingTop =
        blockStyles.paddingTop || blockStyles.padding || "20px";
      const paddingBottom =
        blockStyles.paddingBottom || blockStyles.padding || "20px";
      const paddingLeft =
        blockStyles.paddingLeft || blockStyles.padding || "24px";
      const paddingRight =
        blockStyles.paddingRight || blockStyles.padding || "24px";

      return (
        <div
          style={{
            backgroundColor: blockBackgroundColor,
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
      const blockStyles = block.spacerBlockStyles || {};
      const blockBackgroundColor = blockStyles.backgroundColor || "transparent";

      return (
        <div
          style={{
            height: spacerHeight,
            backgroundColor: blockBackgroundColor,
          }}
        />
      );
    }
    case "Social": {
      const socialLinks = block.socialLinks || [];
      const socialType = block.socialType || "Follow";
      const socialDisplay: SocialDisplay = block.socialDisplay || "Icon only";
      const socialIconStyle: SocialIconStyle =
        block.socialIconStyle || "Filled";
      const socialLayout: SocialLayout =
        block.socialLayout || "Horizontal-right";
      const socialIconColor = block.socialIconColor || "#000000";
      const socialSize: SocialSize = block.socialSize || "Large";
      const socialAlignment: SocialAlignment =
        block.socialAlignment || "center";
      const socialSpacingValue = block.socialSpacing
        ? typeof block.socialSpacing === "number"
          ? block.socialSpacing
          : parseFloat(block.socialSpacing.replace("px", "")) || 24
        : 24;
      // Clamp spacing between 2px and 60px
      const socialSpacing = `${Math.max(
        2,
        Math.min(60, socialSpacingValue)
      )}px`;
      const blockStyles = getBoxStyleProps(block.socialBlockStyles);

      // Size mapping
      const sizeMap: Record<
        SocialSize,
        { icon: string; container: string; plainIcon: string }
      > = {
        Small: { icon: "h-4 w-4", container: "w-8 h-8", plainIcon: "h-8 w-8" },
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

      // Determine if layout is vertical (items stacked vertically)
      const isVerticalLayout =
        socialLayout === "Vertical-right" || socialLayout === "Vertical-bottom";

      // Determine if text should be on the right or bottom
      const isTextOnRight =
        socialLayout === "Horizontal-right" ||
        socialLayout === "Vertical-right";

      // Alignment mapping - depends on layout direction
      const getAlignmentClass = () => {
        if (isVerticalLayout) {
          // For vertical layout, alignment controls horizontal alignment (items-*)
          const alignmentMap: Record<SocialAlignment, string> = {
            left: "items-start",
            center: "items-center",
            right: "items-end",
          };
          return alignmentMap[socialAlignment];
        } else {
          // For horizontal layout, alignment controls horizontal alignment (justify-*)
          const alignmentMap: Record<SocialAlignment, string> = {
            left: "justify-start",
            center: "justify-center",
            right: "justify-end",
          };
          return alignmentMap[socialAlignment];
        }
      };

      // Layout mapping for container direction
      const layoutMap: Record<SocialLayout, string> = {
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
                // Determine icon-text layout based on socialLayout
                const iconTextLayout = isTextOnRight ? "flex-row" : "flex-col";
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
    case "CreativeAssistant":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
          <p className="text-sm font-medium">{block.label}</p>
        </div>
      );
    case "Survey":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <ListChecks className="h-8 w-8 mx-auto mb-2 text-[#3CCED7]" />
          <p className="text-sm font-medium">{block.label}</p>
        </div>
      );
    case "Code":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <Code className="h-8 w-8 mx-auto mb-2 text-gray-800" />
          <p className="text-sm font-medium">{block.label}</p>
        </div>
      );
    case "Apps":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <Grid3x3 className="h-8 w-8 mx-auto mb-2 text-purple-600" />
          <p className="text-sm font-medium">{block.label}</p>
        </div>
      );
    case "Product":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-orange-600" />
          <p className="text-sm font-medium">{block.label}</p>
        </div>
      );
    case "ProductRec":
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          <Heart className="h-8 w-8 mx-auto mb-2 text-pink-600" />
          <p className="text-sm font-medium">{block.label}</p>
        </div>
      );
    case "Layout": {
      const layoutBlockStyles = block.layoutBlockStyles || {};
      const styleProps = getBoxStyleProps(layoutBlockStyles);
      return (
        <div style={styleProps}>
          <LayoutBlock
            block={block}
            section={section}
            isSelected={isSelected}
            updateLayoutColumns={updateLayoutColumns}
            isMobile={deviceMode === "mobile"}
          />
        </div>
      );
    }
    default:
      return (
        <div className="py-4 border border-gray-200 rounded p-4 text-center text-gray-600">
          {block.label}
        </div>
      );
  }
};

export default CanvasBlockRenderer;
