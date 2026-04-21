"use client";

import React, { useEffect, useRef } from "react";

interface InlineContentEditorProps {
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  multiline?: boolean;
}

export default function InlineContentEditor({
  rect,
  value,
  onChange,
  onCommit,
  onCancel,
  multiline = false,
}: InlineContentEditorProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }

    if (multiline) {
      // For multiline (sticky_note, shape): Enter commits, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        onCommit();
        return;
      }
    } else {
      // For single-line (text, line, connector): Enter commits
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onCommit();
        return;
      }
    }
  };

  const handleBlur = () => {
    // Commit on blur
    onCommit();
  };

  const commonProps = {
    ref: inputRef as any,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onKeyDown: handleKeyDown,
    onMouseDown: (e: React.MouseEvent) => {
      // Prevent canvas background handlers from committing immediately
      e.stopPropagation();
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
    },
    onBlur: handleBlur,
    style: {
      position: "fixed" as const,
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${Math.max(rect.width, 100)}px`, // Min width for usability
      height: `${Math.max(rect.height, 24)}px`, // Min height for usability
      border: "2px solid #3b82f6",
      borderRadius: "4px",
      padding: "4px 8px",
      fontSize: "14px",
      fontFamily: "inherit",
      outline: "none",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      backgroundColor: "white",
      zIndex: 10000,
    },
  };

  if (multiline) {
    return (
      <textarea
        {...commonProps}
        style={{
          ...commonProps.style,
          resize: "both" as const,
          minHeight: "60px",
        }}
      />
    );
  }

  return <input {...commonProps} type="text" />;
}

