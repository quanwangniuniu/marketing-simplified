/**
 * Converters between TipTap's ProseMirror JSON format and the Slate-format
 * block nodes stored by the backend (`{ type, children }`).
 *
 * Direction:
 *   TipTap JSON  →  tiptapToSlate()  →  POST content (Slate)  → backend
 *   backend Slate →  slateToTiptap() →  TipTap JSON            → render
 */

export interface SlateText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  [key: string]: unknown;
}

export interface SlateElement {
  type: string;
  children: (SlateText | SlateElement)[];
  url?: string;
  [key: string]: unknown;
}

export type SlateNode = SlateText | SlateElement;

// ---------------------------------------------------------------------------
// TipTap → Slate
// ---------------------------------------------------------------------------

function tiptapMarksToSlate(marks: { type: string; attrs?: Record<string, unknown> }[] = []): Partial<SlateText> {
  const result: Partial<SlateText> = {};
  for (const mark of marks) {
    if (mark.type === "bold") result.bold = true;
    if (mark.type === "italic") result.italic = true;
    if (mark.type === "underline") result.underline = true;
    if (mark.type === "strike") result.strikethrough = true;
    if (mark.type === "code") result.code = true;
    if (mark.type === "link") result.url = mark.attrs?.href as string;
    if (mark.type === "textStyle" && mark.attrs?.color) result.color = mark.attrs.color as string;
  }
  return result;
}

function tiptapNodeToSlate(node: Record<string, unknown>): SlateNode {
  const type = node.type as string;
  const content = (node.content as Record<string, unknown>[] | undefined) ?? [];

  if (type === "text") {
    const marks = (node.marks as { type: string; attrs?: Record<string, unknown> }[]) ?? [];
    return { text: (node.text as string) ?? "", ...tiptapMarksToSlate(marks) };
  }

  if (type === "hardBreak") {
    return { text: "\n" };
  }

  const children: SlateNode[] = content.length
    ? content.map(tiptapNodeToSlate)
    : [{ text: "" }];

  switch (type) {
    case "paragraph":
      return { type: "paragraph", children };
    case "heading": {
      const level = (node.attrs as Record<string, unknown> | undefined)?.level ?? 1;
      return { type: `heading-${level}`, children };
    }
    case "bulletList":
      return { type: "bulleted-list", children };
    case "orderedList":
      return { type: "numbered-list", children };
    case "listItem":
      return { type: "list-item", children };
    case "blockquote":
      return { type: "block-quote", children };
    case "codeBlock":
      return { type: "code-block", children };
    case "horizontalRule":
      return { type: "divider", children: [{ text: "" }] };
    case "taskList":
      return { type: "task-list", children };
    case "taskItem": {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      return { type: "task-item", checked: attrs?.checked ?? false, children };
    }
    case "image": {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      return { type: "image", url: attrs?.src as string, alt: attrs?.alt as string, children: [{ text: "" }] };
    }
    case "table":
      return { type: "table", children };
    case "tableRow":
      return { type: "table-row", children };
    case "tableCell":
      return { type: "table-cell", children };
    case "tableHeader":
      return { type: "table-header", children };
    default:
      return { type: "paragraph", children };
  }
}

export function tiptapToSlate(doc: Record<string, unknown>): SlateElement[] {
  const content = (doc.content as Record<string, unknown>[] | undefined) ?? [];
  if (!content.length) {
    return [{ type: "paragraph", children: [{ text: "" }] }];
  }
  return content.map(tiptapNodeToSlate) as SlateElement[];
}

// ---------------------------------------------------------------------------
// Slate → TipTap
// ---------------------------------------------------------------------------

function slateTextToTiptap(node: SlateText): Record<string, unknown> {
  const marks: { type: string; attrs?: Record<string, unknown> }[] = [];
  if (node.bold) marks.push({ type: "bold" });
  if (node.italic) marks.push({ type: "italic" });
  if (node.underline) marks.push({ type: "underline" });
  if (node.strikethrough) marks.push({ type: "strike" });
  if (node.code) marks.push({ type: "code" });
  if (node.url) marks.push({ type: "link", attrs: { href: node.url } });
  if (node.color) marks.push({ type: "textStyle", attrs: { color: node.color } });

  const result: Record<string, unknown> = { type: "text", text: node.text };
  if (marks.length) result.marks = marks;
  return result;
}

function slateNodeToTiptap(node: SlateNode): Record<string, unknown> {
  if ("text" in node) {
    return slateTextToTiptap(node as SlateText);
  }

  const element = node as SlateElement;
  const children = element.children.map(slateNodeToTiptap);

  switch (element.type) {
    case "paragraph":
      return { type: "paragraph", content: children };
    case "heading-1":
      return { type: "heading", attrs: { level: 1 }, content: children };
    case "heading-2":
      return { type: "heading", attrs: { level: 2 }, content: children };
    case "heading-3":
      return { type: "heading", attrs: { level: 3 }, content: children };
    case "bulleted-list":
      return { type: "bulletList", content: children };
    case "numbered-list":
      return { type: "orderedList", content: children };
    case "list-item":
      return { type: "listItem", content: children };
    case "block-quote":
      return { type: "blockquote", content: children };
    case "code-block":
      return { type: "codeBlock", content: children };
    case "divider":
      return { type: "horizontalRule" };
    case "task-list":
      return { type: "taskList", content: children };
    case "task-item":
      return { type: "taskItem", attrs: { checked: element.checked ?? false }, content: children };
    case "image":
      return { type: "image", attrs: { src: element.url, alt: element.alt ?? "" } };
    case "table":
      return { type: "table", content: children };
    case "table-row":
      return { type: "tableRow", content: children };
    case "table-cell":
      return { type: "tableCell", content: children };
    case "table-header":
      return { type: "tableHeader", content: children };
    default:
      return { type: "paragraph", content: children };
  }
}

export function slateToTiptap(blocks: SlateElement[]): Record<string, unknown> {
  if (!blocks || !blocks.length) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return {
    type: "doc",
    content: blocks.map(slateNodeToTiptap),
  };
}
