'use client';

import { memo, useEffect, useState } from 'react';
import {
  getCursorXYFromOffset,
  getSelectionRects,
  selectionHighlightBackground,
  type SelectionRect,
} from './cursorGeometry';

export type RemoteCursor = {
  presenceKey: string;
  userId: number;
  username: string;
  x: number;
  y: number;
  cursorOffset?: number;
  selectionStart?: number;
  selectionEnd?: number;
  selectionRects: SelectionRect[];
  color: string;
};

interface Props {
  cursors: RemoteCursor[];
  editorRef: React.RefObject<HTMLDivElement | null>;
  scrollTick: number;
}

function PresenceCursorsInner({ cursors, editorRef, scrollTick }: Props) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    forceTick((t) => t + 1);
  }, [scrollTick]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[100] overflow-visible" aria-hidden="true">
      {cursors.map((cursor) => {
        const editor = editorRef.current;
        let position: { left: number; top: number } = {
          left: Math.max(cursor.x, 0),
          top: Math.max(cursor.y, 0),
        };
        if (editor && typeof cursor.cursorOffset === 'number') {
          const pos = getCursorXYFromOffset(editor, cursor.cursorOffset);
          if (pos) {
            position = { left: Math.max(pos.x, 0), top: Math.max(pos.y, 0) };
          }
        }

        const hasOffsetRange =
          typeof cursor.selectionStart === 'number' &&
          typeof cursor.selectionEnd === 'number' &&
          cursor.selectionEnd > cursor.selectionStart;
        let selectionRects: SelectionRect[] = [];
        if (hasOffsetRange && editor) {
          try {
            selectionRects = getSelectionRects(editor, cursor.selectionStart!, cursor.selectionEnd!);
          } catch {
            selectionRects = [];
          }
        }
        if (selectionRects.length === 0 && cursor.selectionRects.length > 0) {
          selectionRects = cursor.selectionRects;
        }

        const highlightBg = selectionHighlightBackground(cursor.color);
        const nameLabelTop = position.top >= 22 ? position.top - 20 : position.top + 6;

        return (
          <div key={cursor.presenceKey}>
            {selectionRects.map((rect, idx) => (
              <div
                key={`sel-${cursor.presenceKey}-${idx}`}
                className="pointer-events-none absolute rounded-[2px]"
                style={{
                  left: `${Math.max(rect.left, 0)}px`,
                  top: `${Math.max(rect.top, 0)}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  backgroundColor: highlightBg,
                }}
              />
            ))}
            <div
              className="pointer-events-none absolute z-[1] max-w-[200px] truncate whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
              style={{
                left: `${Math.max(position.left, 0)}px`,
                top: `${Math.max(0, nameLabelTop)}px`,
                backgroundColor: cursor.color,
              }}
            >
              {cursor.username}
            </div>
            <div
              className="pointer-events-none absolute"
              style={{ left: `${position.left}px`, top: `${position.top}px` }}
            >
              <div
                className="h-5 w-0.5 rounded-sm"
                style={{ backgroundColor: cursor.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PresenceCursors = memo(PresenceCursorsInner);
export default PresenceCursors;
