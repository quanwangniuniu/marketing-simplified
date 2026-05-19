'use client';

import React, { createContext, useContext } from 'react';

export interface TrackingTarget {
  contentType: string;
  objectId: number;
  projectId?: number | null;
}

export interface TrackingContextValue {
  // Tracking is now server-side. Context kept as extension point.
}

const TrackingContext = createContext<TrackingContextValue>({});

export function useTracking(): TrackingContextValue {
  return useContext(TrackingContext);
}

export function TrackingProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <TrackingContext.Provider value={{}}>
      {children}
    </TrackingContext.Provider>
  );
}
