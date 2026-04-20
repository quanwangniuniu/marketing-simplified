'use client';

import { useEffect, useRef, useState } from 'react';

export function useMinimumLoading(loading: boolean, minimumMs = 0) {
  const [visibleLoading, setVisibleLoading] = useState(loading);
  const loadingStartedAtRef = useRef<number | null>(loading ? Date.now() : null);
  const previousLoadingRef = useRef(loading);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const wasLoading = previousLoadingRef.current;
    previousLoadingRef.current = loading;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (loading) {
      if (!wasLoading) {
        loadingStartedAtRef.current = Date.now();
      }
      setVisibleLoading(true);
      return;
    }

    if (!wasLoading) {
      setVisibleLoading(false);
      return;
    }

    if (minimumMs <= 0 || loadingStartedAtRef.current == null) {
      loadingStartedAtRef.current = null;
      setVisibleLoading(false);
      return;
    }

    const elapsed = Date.now() - loadingStartedAtRef.current;
    const remaining = Math.max(minimumMs - elapsed, 0);

    if (remaining === 0) {
      loadingStartedAtRef.current = null;
      setVisibleLoading(false);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      loadingStartedAtRef.current = null;
      setVisibleLoading(false);
      timeoutRef.current = null;
    }, remaining);
  }, [loading, minimumMs]);

  return visibleLoading;
}
