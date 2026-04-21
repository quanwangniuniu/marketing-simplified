'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { OutlineItem } from '@/hooks/useOutline';
import OutlineSidebar from './OutlineSidebar';

interface OutlineOverlayProps {
  items: OutlineItem[];
  activeId: string | null;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  onItemClick: (id: string) => void;
  editorScrollRef?: RefObject<HTMLDivElement | null>;
}

/** H1 pill width (24px) + padding (4px) for viewport indicator */
const VIEWPORT_INDICATOR_WIDTH = 16;
const VIEWPORT_INDICATOR_RADIUS = 3;
const VIEWPORT_INDICATOR_BG = 'rgba(55, 53, 47, 0.04)';
const VIEWPORT_INDICATOR_BORDER = '1px solid rgba(55, 53, 47, 0.08)';

export default function OutlineOverlay({
  items,
  activeId,
  hoveredId,
  setHoveredId,
  onItemClick,
  editorScrollRef,
}: OutlineOverlayProps) {
  const MINIMAP_RIGHT = 20;
  const PILL_WIDTH = 28;
  const TOC_GAP = 8;
  const TOC_WIDTH = 280;
  const TOC_RADIUS = 16;
  const TOC_BG = '#fdfdfc';
  const TOC_BORDER = '1px solid rgba(55,53,47,0.08)';
  const TOC_SHADOW = '0 20px 60px rgba(0,0,0,0.06)';
  const ANIMATION_DURATION = 160;
  const ANIMATION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  const [isExpanded, setIsExpanded] = useState(false);
  const [viewportIndicator, setViewportIndicator] = useState<{ top: number; height: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const handleMouseEnter = () => setIsExpanded(true);
  const handleMouseLeave = () => setIsExpanded(false);

  useEffect(() => {
    const root = editorScrollRef?.current;
    if (!root) return;

    const updateIndicator = () => {
      const { scrollTop, scrollHeight, clientHeight } = root;
      if (scrollHeight <= clientHeight) {
        setViewportIndicator(null);
        return;
      }
      const railHeight = clientHeight;
      const ratio = railHeight / scrollHeight;
      setViewportIndicator({
        top: (scrollTop / scrollHeight) * railHeight,
        height: Math.max(20, ratio * railHeight),
      });
    };

    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateIndicator);
    };

    updateIndicator();
    root.addEventListener('scroll', handleScroll, { passive: true });
    const resizeObs = new ResizeObserver(handleScroll);
    resizeObs.observe(root);

    return () => {
      root.removeEventListener('scroll', handleScroll);
      resizeObs.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [editorScrollRef]);

  return (
    <div className="pointer-events-none">
      {/* Single Anchor: fixed root, handles hover. Child A (Minimap) and Child B (Panel) are siblings. */}
      <div
        className="outline-overlay-anchor"
        style={{
          position: 'fixed',
          top: '24%',
          bottom: '14%',
          right: MINIMAP_RIGHT,
          width: isExpanded ? PILL_WIDTH + TOC_GAP + TOC_WIDTH : PILL_WIDTH,
          transition: `width ${ANIMATION_DURATION}ms ${ANIMATION_EASING}`,
          zIndex: 50,
          pointerEvents: 'auto',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Child A: Minimap Track — pills only, scrollbar nuked */}
        <div
          className="outline-minimap-track"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: PILL_WIDTH,
            height: '100%',
            zIndex: 1,
            pointerEvents: 'none',
            opacity: isExpanded ? 0 : 1,
            transition: `opacity ${ANIMATION_DURATION}ms ${ANIMATION_EASING}`,
            overflow: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          aria-label="Outline minimap"
        >
          {viewportIndicator && !isExpanded && (
            <div
              className="absolute rounded z-20 pointer-events-none"
              style={{
                left: (PILL_WIDTH - VIEWPORT_INDICATOR_WIDTH) / 2,
                top: viewportIndicator.top,
                width: VIEWPORT_INDICATOR_WIDTH,
                height: viewportIndicator.height,
                borderRadius: VIEWPORT_INDICATOR_RADIUS,
                backgroundColor: VIEWPORT_INDICATOR_BG,
                border: VIEWPORT_INDICATOR_BORDER,
              }}
            />
          )}
          <OutlineSidebar
            variant="pills"
            items={items}
            activeId={activeId}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
            onItemClick={onItemClick}
          />
        </div>
        {/* Child B: Expanded Panel — appears on hover, has custom scrollbar with arrows */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: PILL_WIDTH + TOC_GAP,
            width: TOC_WIDTH,
            height: '100%',
            zIndex: 2,
            pointerEvents: isExpanded ? 'auto' : 'none',
            visibility: isExpanded ? 'visible' : 'hidden',
            transform: isExpanded ? 'translateX(0)' : 'translateX(6px)',
            opacity: isExpanded ? 1 : 0,
            transition: `opacity ${ANIMATION_DURATION}ms ${ANIMATION_EASING}, transform ${ANIMATION_DURATION}ms ${ANIMATION_EASING}`,
            borderRadius: TOC_RADIUS,
            backgroundColor: isExpanded ? TOC_BG : 'transparent',
            border: TOC_BORDER,
            boxShadow: TOC_SHADOW,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              paddingTop: 16,
              paddingBottom: 16,
              boxSizing: 'border-box',
            }}
          >
            <div
              className="outline-overlay-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
              }}
            >
              <OutlineSidebar
                variant="list"
                items={items}
                activeId={activeId}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                onItemClick={onItemClick}
              />
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .outline-minimap-track::-webkit-scrollbar {
          display: none !important;
        }
        .outline-overlay-scroll::-webkit-scrollbar {
          display: block;
          width: 12px;
        }
        .outline-overlay-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .outline-overlay-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 6px;
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        .outline-overlay-scroll::-webkit-scrollbar-button:single-button:vertical:decrement {
          display: block;
          height: 12px;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%236b7280' d='M4 1L1 7h6z'/%3E%3C/svg%3E") no-repeat center;
        }
        .outline-overlay-scroll::-webkit-scrollbar-button:single-button:vertical:increment {
          display: block;
          height: 12px;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%236b7280' d='M4 7L7 1H1z'/%3E%3C/svg%3E") no-repeat center;
        }
      `}</style>
    </div>
  );
}
