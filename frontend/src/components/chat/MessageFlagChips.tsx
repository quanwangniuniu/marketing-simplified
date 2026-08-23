'use client';

import { useEffect, useRef, useState } from 'react';
import { Bookmark, Pin, PinOff } from 'lucide-react';

interface MessageFlagChipsProps {
  isPinned: boolean;
  isSaved: boolean;
  onUnpin?: () => void;
}

/**
 * Pinned/saved marker row under a message. Always mounted so the pinned chip
 * can finish its exit (red dissolve when unpinned via the chip, quiet fade for
 * external unpins) after the pin is gone; renders nothing when no flag shows.
 */
export default function MessageFlagChips({ isPinned, isSaved, onUnpin }: MessageFlagChipsProps) {
  // 'unpinning' → 'exiting': chip-initiated unpin, red confirmation then dissolve.
  // 'fading': unpin arrived from elsewhere (menu, drawer) — dissolve as-is, no red.
  const [phase, setPhase] = useState<'idle' | 'unpinning' | 'exiting' | 'fading'>('idle');
  const timerRef = useRef<number | null>(null);
  const wasPinnedRef = useRef(isPinned);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Once the pin is actually gone, dissolve the chip. A chip-initiated unpin is
  // already red, so it keeps that look; an external unpin (menu, drawer,
  // another admin) fades out unchanged so no red control appears to pop in.
  useEffect(() => {
    const wasPinned = wasPinnedRef.current;
    wasPinnedRef.current = isPinned;
    if (!wasPinned || isPinned) return;
    setPhase((current) => (current === 'unpinning' ? 'exiting' : 'fading'));
  }, [isPinned]);

  // Outlives the 300ms row collapse below so the chip unmounts only after
  // the surrounding messages have finished sliding into place.
  useEffect(() => {
    if (phase !== 'exiting' && phase !== 'fading') return undefined;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPhase('idle');
    }, 340);
    return clearTimer;
  }, [phase]);

  useEffect(() => clearTimer, []);

  const showPinned = isPinned || phase !== 'idle';
  const showRow = showPinned || isSaved;

  // Row height animates open/closed so surrounding messages slide instead of
  // jumping. Starts expanded when mounted with flags (initial history render).
  const [rowExpanded, setRowExpanded] = useState(showRow);
  useEffect(() => {
    if (!showRow) {
      setRowExpanded(false);
      return undefined;
    }
    const raf = window.requestAnimationFrame(() => setRowExpanded(true));
    return () => window.cancelAnimationFrame(raf);
  }, [showRow]);

  if (!showRow) return null;

  const exitingPin = phase === 'exiting' || phase === 'fading';
  const rowCollapsed = !rowExpanded || (exitingPin && !isPinned && !isSaved);

  const unpinned = phase === 'unpinning' || phase === 'exiting';
  const interactive = phase === 'idle' && !!onUnpin;

  const handleUnpin = () => {
    if (phase !== 'idle') return;
    setPhase('unpinning');
    clearTimer();
    // Watchdog: if the request fails the message stays pinned — revert.
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPhase((current) => (current === 'unpinning' ? 'idle' : current));
    }, 1600);
    onUnpin?.();
  };

  const pinnedClasses = [
    'group/pinchip inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors duration-200',
    unpinned
      ? 'border-red-200 bg-red-50 text-red-600 shadow-[0_1px_3px_rgba(220,38,38,0.15)]'
      : 'border-teal-200/70 bg-teal-50 text-teal-700 shadow-[0_1px_3px_rgba(13,148,136,0.15)]',
    interactive
      ? 'cursor-pointer hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:shadow-[0_1px_3px_rgba(220,38,38,0.15)]'
      : '',
    exitingPin ? 'pin-chip-exit' : 'pin-chip-enter',
  ].join(' ');

  const pinnedContent = unpinned ? (
    <span className="flex items-center gap-1">
      <PinOff className="h-2.5 w-2.5 shrink-0" />
      Unpinned from channel
    </span>
  ) : interactive ? (
    <>
      <span className="relative h-2.5 w-2.5 shrink-0">
        <Pin className="absolute inset-0 h-2.5 w-2.5 transition-opacity duration-200 group-hover/pinchip:opacity-0" />
        <PinOff className="absolute inset-0 h-2.5 w-2.5 opacity-0 transition-opacity duration-200 group-hover/pinchip:opacity-100" />
      </span>
      <span className="flex items-center">
        <span className="grid grid-cols-[1fr] transition-all duration-200 ease-out group-hover/pinchip:grid-cols-[0fr] group-hover/pinchip:opacity-0">
          <span className="overflow-hidden whitespace-nowrap">Pinned to channel</span>
        </span>
        <span className="grid grid-cols-[0fr] opacity-0 transition-all duration-200 ease-out group-hover/pinchip:grid-cols-[1fr] group-hover/pinchip:opacity-100">
          <span className="overflow-hidden whitespace-nowrap">Unpin from channel</span>
        </span>
      </span>
    </>
  ) : (
    <span className="flex items-center gap-1">
      <Pin className="h-2.5 w-2.5 shrink-0" />
      Pinned to channel
    </span>
  );

  return (
    <div
      className={[
        'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
        rowCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
      ].join(' ')}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex flex-wrap gap-1.5 pt-1">
          {showPinned && (
            interactive ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleUnpin(); }}
                className={pinnedClasses}
                aria-label="Unpin from channel"
                title="Unpin from channel"
              >
                {pinnedContent}
              </button>
            ) : (
              <span className={pinnedClasses}>{pinnedContent}</span>
            )
          )}
          {isSaved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              <Bookmark className="h-2.5 w-2.5 shrink-0" />
              Saved for later
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
