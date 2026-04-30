"use client";

import { useEffect, useRef } from "react";

interface Props {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  ariaLabel?: string;
  disabled?: boolean;
  disabledTitle?: string;
}

/**
 * Three-state header checkbox used by every meta-ads selectable table.
 *
 * - empty (selectedCount === 0)            → click selects every visible row
 * - partial (0 < selectedCount < totalCount) → click clears the selection
 * - full (selectedCount === totalCount)    → click clears the selection
 *
 * Disabled when totalCount is zero. The visual indeterminate state is
 * driven by the standard HTMLInputElement.indeterminate flag so screen
 * readers and the styled accent ring both behave correctly.
 */
export default function SelectAllHeader({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  ariaLabel = "Select all visible rows",
  disabled = false,
  disabledTitle,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isFull = totalCount > 0 && selectedCount === totalCount;
  const isPartial = selectedCount > 0 && selectedCount < totalCount;
  const isDisabled = disabled || totalCount === 0;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = isPartial && !isDisabled;
    }
  }, [isPartial, isDisabled]);

  const handleChange = () => {
    if (isDisabled) return;
    if (selectedCount === 0) {
      onSelectAll();
    } else {
      onClear();
    }
  };

  return (
    <input
      ref={inputRef}
      type="checkbox"
      aria-label={ariaLabel}
      title={isDisabled ? disabledTitle : undefined}
      checked={isFull}
      disabled={isDisabled}
      onChange={handleChange}
      className={`h-4 w-4 rounded accent-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30 ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    />
  );
}
