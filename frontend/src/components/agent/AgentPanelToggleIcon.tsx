'use client';

/**
 * Panel-style glyph: rounded frame with a solid left bar (toggle affordance).
 */
export function AgentPanelToggleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={14}
      viewBox="0 0 18 14"
      aria-hidden
    >
      <rect
        x="1"
        y="1"
        width="16"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect x="3.25" y="3.25" width="4.5" height="7.5" rx="0.5" fill="currentColor" opacity={0.4} />
    </svg>
  );
}
