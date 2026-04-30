export type SelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PlainTextSelectionState = { anchor: number; focus: number };

export function getEditorPlainText(editor: HTMLElement): string {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let n = walker.nextNode();
  while (n) {
    parts.push(n.textContent ?? '');
    n = walker.nextNode();
  }
  return parts.join('');
}

export function getTotalPlainTextLength(editor: HTMLElement): number {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let total = 0;
  let n = walker.nextNode();
  while (n) {
    total += (n.textContent ?? '').length;
    n = walker.nextNode();
  }
  return total;
}

export function resolveTextNodeAtOffset(
  editor: HTMLElement,
  targetOffset: number,
): { node: Node; offset: number } | null {
  const target = Math.max(0, targetOffset);
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let textNode = walker.nextNode();
  while (textNode) {
    const text = textNode.textContent ?? '';
    const next = consumed + text.length;
    if (target <= next) {
      return { node: textNode, offset: Math.max(0, Math.min(target - consumed, text.length)) };
    }
    consumed = next;
    textNode = walker.nextNode();
  }
  if (editor.lastChild) {
    const fallbackOffset =
      editor.lastChild.nodeType === Node.TEXT_NODE
        ? (editor.lastChild.textContent ?? '').length
        : editor.lastChild.childNodes.length;
    return { node: editor.lastChild, offset: fallbackOffset };
  }
  return { node: editor, offset: 0 };
}

export function getPlainTextOffsetBeforePosition(
  editor: HTMLElement,
  container: Node,
  offset: number,
): number {
  const endPoint = document.createRange();
  try {
    endPoint.setStart(container, offset);
    endPoint.collapse(true);
  } catch {
    return 0;
  }
  let total = 0;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode() as Text | null;
  while (textNode) {
    const len = (textNode.textContent ?? '').length;
    const nodeStart = document.createRange();
    nodeStart.setStart(textNode, 0);
    nodeStart.collapse(true);
    const nodeEnd = document.createRange();
    nodeEnd.setStart(textNode, len);
    nodeEnd.collapse(true);
    if (endPoint.compareBoundaryPoints(Range.START_TO_START, nodeEnd) > 0) {
      total += len;
      textNode = walker.nextNode() as Text | null;
      continue;
    }
    if (endPoint.compareBoundaryPoints(Range.START_TO_START, nodeStart) <= 0) {
      break;
    }
    if (container === textNode) {
      total += Math.max(0, Math.min(offset, len));
      break;
    }
    const measure = document.createRange();
    measure.setStart(textNode, 0);
    measure.setEnd(container, offset);
    total += measure.toString().length;
    break;
  }
  return total;
}

export function getPlainTextSelectionState(
  editor: HTMLElement,
): PlainTextSelectionState | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  if (!sel.anchorNode || !sel.focusNode) return null;
  if (!editor.contains(sel.anchorNode) || !editor.contains(sel.focusNode)) return null;
  try {
    const anchor = getPlainTextOffsetBeforePosition(editor, sel.anchorNode, sel.anchorOffset);
    const focus = getPlainTextOffsetBeforePosition(editor, sel.focusNode, sel.focusOffset);
    return { anchor, focus };
  } catch {
    return null;
  }
}

export function restorePlainTextSelectionState(
  editor: HTMLElement,
  state: PlainTextSelectionState,
): void {
  const sel = window.getSelection();
  if (!sel) return;
  const total = getTotalPlainTextLength(editor);
  const clamp = (n: number) => Math.max(0, Math.min(n, total));
  const a = clamp(state.anchor);
  const f = clamp(state.focus);
  const start = Math.min(a, f);
  const end = Math.max(a, f);
  const startPos = resolveTextNodeAtOffset(editor, start);
  const endPos = resolveTextNodeAtOffset(editor, end);
  if (!startPos || !endPos) return;
  const range = document.createRange();
  try {
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    /* ignore */
  }
}

export function computeOffsetTransform(
  oldPlain: string,
  newPlain: string,
): (offset: number) => number {
  if (oldPlain === newPlain) return (o) => o;
  let prefixLen = 0;
  const minLen = Math.min(oldPlain.length, newPlain.length);
  while (prefixLen < minLen && oldPlain[prefixLen] === newPlain[prefixLen]) {
    prefixLen++;
  }
  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldPlain[oldPlain.length - 1 - suffixLen] === newPlain[newPlain.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  const oldEditEnd = oldPlain.length - suffixLen;
  const newEditEnd = newPlain.length - suffixLen;
  const delta = newEditEnd - oldEditEnd;
  return (offset: number): number => {
    if (offset < prefixLen) return offset;
    if (offset >= oldEditEnd) return offset + delta;
    return newEditEnd;
  };
}

export function getCaretClientRect(
  range: Range,
  editor: HTMLElement,
): { left: number; top: number; height: number } | null {
  const r = range.cloneRange();
  r.collapse(true);
  const rawRects = Array.from(r.getClientRects());
  const lineRects = rawRects.filter((cr) => cr.height > 0);
  if (lineRects.length >= 2) {
    const topmost = lineRects.reduce((a, b) => (a.top <= b.top ? a : b));
    return { left: topmost.left, top: topmost.top, height: topmost.height };
  }
  if (lineRects.length === 1) {
    const c = lineRects[0]!;
    return { left: c.left, top: c.top, height: c.height };
  }
  const br = r.getBoundingClientRect();
  const maxH = Math.max(editor.clientHeight * 0.5, 24);
  if (br.height > 0 && br.height <= maxH) {
    return { left: br.left, top: br.top, height: br.height };
  }
  const { startContainer, startOffset } = r;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    const tn = startContainer as Text;
    const text = tn.textContent ?? '';
    const expand = r.cloneRange();
    if (startOffset < text.length) {
      expand.setEnd(tn, startOffset + 1);
      const ers = Array.from(expand.getClientRects()).filter((cr) => cr.height > 0);
      if (ers.length > 0) {
        const lr = ers[ers.length - 1]!;
        return { left: lr.left, top: lr.top, height: lr.height };
      }
    }
    if (startOffset > 0) {
      expand.setStart(tn, startOffset - 1);
      expand.setEnd(tn, startOffset);
      const ers = Array.from(expand.getClientRects()).filter((cr) => cr.height > 0);
      if (ers.length > 0) {
        const lr = ers[ers.length - 1]!;
        return { left: lr.right, top: lr.top, height: lr.height };
      }
    }
  }
  if (br.height > 0) {
    return { left: br.left, top: br.top, height: br.height };
  }
  return null;
}

export function clientPointToEditorOverlay(
  editor: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const r = editor.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}

export function isNodeInsideEditor(editor: HTMLElement, n: Node | null): boolean {
  return Boolean(n && (n === editor || editor.contains(n)));
}

export function ensureSelectionAnchoredInEditor(editor: HTMLElement): void {
  if (document.activeElement !== editor) return;
  const sel = window.getSelection();
  if (!sel) return;
  if (sel.rangeCount > 0 && isNodeInsideEditor(editor, sel.anchorNode)) return;
  const total = getTotalPlainTextLength(editor);
  const pos = resolveTextNodeAtOffset(editor, total);
  try {
    if (pos) {
      const range = document.createRange();
      range.setStart(pos.node, pos.offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    try {
      editor.focus();
    } catch {
      /* ignore */
    }
  }
}

export function getSelectionOffsets(
  editor: HTMLElement,
): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  if (!isNodeInsideEditor(editor, sel.anchorNode) || !isNodeInsideEditor(editor, sel.focusNode))
    return null;
  const range = sel.getRangeAt(0).cloneRange();
  const startRange = range.cloneRange();
  startRange.collapse(true);
  const endRange = range.cloneRange();
  endRange.collapse(false);
  const start = getPlainTextOffsetBeforePosition(editor, startRange.endContainer, startRange.endOffset);
  const end = getPlainTextOffsetBeforePosition(editor, endRange.endContainer, endRange.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

export function getLiveSelectionRects(editor: HTMLElement): SelectionRect[] {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return [];
  if (!isNodeInsideEditor(editor, sel.anchorNode) || !isNodeInsideEditor(editor, sel.focusNode))
    return [];
  const range = sel.getRangeAt(0);
  if (range.collapsed) return [];
  const r = editor.getBoundingClientRect();
  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      left: rect.left - r.left,
      top: rect.top - r.top,
      width: rect.width,
      height: rect.height,
    }));
}

export function getSelectionRects(
  editor: HTMLElement,
  start: number,
  end: number,
): SelectionRect[] {
  if (end <= start) return [];
  const startPos = resolveTextNodeAtOffset(editor, start);
  const endPos = resolveTextNodeAtOffset(editor, end);
  if (!startPos || !endPos) return [];
  const range = document.createRange();
  try {
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
  } catch {
    return [];
  }
  const r = editor.getBoundingClientRect();
  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      left: rect.left - r.left,
      top: rect.top - r.top,
      width: rect.width,
      height: rect.height,
    }));
}

export function getCursorXYFromOffset(
  editor: HTMLElement,
  offset: number,
): { x: number; y: number } | null {
  const total = getTotalPlainTextLength(editor);
  const clamped = Math.max(0, Math.min(Math.trunc(offset), total));
  const resolved = resolveTextNodeAtOffset(editor, clamped);
  if (!resolved) return null;
  const range = document.createRange();
  try {
    range.setStart(resolved.node, resolved.offset);
    range.setEnd(resolved.node, resolved.offset);
  } catch {
    return null;
  }
  const caret = getCaretClientRect(range, editor);
  if (!caret) return null;
  return clientPointToEditorOverlay(editor, caret.left, caret.top);
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const sf = Math.max(0, Math.min(100, s)) / 100;
  const lf = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lf - 1)) * sf;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = lf - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const to = (v: number) =>
    Math.round(Math.max(0, Math.min(255, (v + m) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hashColorForUser(userId: number, presenceKey: string): string {
  let hash = userId >>> 0;
  for (let i = 0; i < presenceKey.length; i += 1) {
    hash = (hash * 31 + presenceKey.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const sat = 48 + (hash % 14);
  const light = 44 + (hash % 10);
  return hslToHex(hue, sat, light);
}

export function selectionHighlightBackground(hexColor: string): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hexColor.trim());
  if (!m) return `${hexColor}33`;
  const rr = parseInt(m[1], 16);
  const gg = parseInt(m[2], 16);
  const bb = parseInt(m[3], 16);
  return `rgba(${rr},${gg},${bb},0.18)`;
}
