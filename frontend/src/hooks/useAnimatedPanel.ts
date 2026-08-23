'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AnimatedPanelState = 'closed' | 'opening' | 'open' | 'closing';

/**
 * Drives a side panel through a full open/close transition cycle so both the
 * panel and the layout width it pushes can animate instead of snapping.
 */
export function useAnimatedPanel() {
  const [state, setState] = useState<AnimatedPanelState>('closed');
  const stateRef = useRef<AnimatedPanelState>('closed');
  const timerRef = useRef<number | null>(null);

  const setPanelState = (next: AnimatedPanelState) => {
    stateRef.current = next;
    setState(next);
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Mount with collapsed classes first, then expand on the next tick so the
  // width/transform transition actually plays.
  const open = useCallback(() => {
    if (stateRef.current === 'open' || stateRef.current === 'opening') return;
    clearTimer();
    setPanelState('opening');
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPanelState('open');
    }, 30);
  }, []);

  const close = useCallback(() => {
    if (stateRef.current === 'closed' || stateRef.current === 'closing') return;
    clearTimer();
    setPanelState('closing');
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPanelState('closed');
    }, 300);
  }, []);

  // Instant close without transition (e.g. when switching chats).
  const reset = useCallback(() => {
    clearTimer();
    setPanelState('closed');
  }, []);

  // Unmounting mid-transition is ordinary — closing takes 300ms and the user
  // can navigate away inside it. Nothing else cancels the timer on that path,
  // so it would fire against a component that no longer exists.
  useEffect(() => clearTimer, []);

  return { panelState: state, openPanel: open, closePanel: close, resetPanel: reset };
}
