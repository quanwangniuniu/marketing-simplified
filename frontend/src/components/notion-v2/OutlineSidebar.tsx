import React from 'react';
import { OutlineItem } from '@/hooks/useOutline';

interface OutlineSidebarProps {
  variant: 'pills' | 'list';
  items: OutlineItem[];
  activeId: string | null;
  hoveredId?: string | null;
  setHoveredId?: (id: string | null) => void;
  onItemClick: (id: string) => void;
}

const MAX_PILLS = 30;
const PILL_BG = 'rgba(55,53,47,0.18)';
const PILL_ACTIVE = 'rgba(55,53,47,0.6)';
const PILL_HOVER = 'rgba(55,53,47,0.35)';
/** Notion-style horizontal dashes: L1=16px, L2=12px, L3=8px */
const PILL_WIDTH_BY_LEVEL = { 1: 16, 2: 12, 3: 8 } as const;

export default function OutlineSidebar({
  variant,
  items,
  activeId,
  hoveredId = null,
  setHoveredId,
  onItemClick,
}: OutlineSidebarProps) {
  if (variant === 'pills') {
    return (
      <div
        className="flex flex-col items-end justify-between w-full h-full"
        style={{ paddingTop: '2vh', paddingBottom: '22vh' }}
      >
        {Array.from({ length: MAX_PILLS }, (_, i) => {
          const item = items[i];
          if (item) {
            const level = item.level as 1 | 2 | 3;
            const isActive = activeId === item.id;
            const isHovered = hoveredId === item.id && !isActive;
            const pillColor = isActive ? PILL_ACTIVE : isHovered ? PILL_HOVER : PILL_BG;
            return (
              <button
                key={item.id}
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 m-0 h-[3px] rounded-full shrink-0"
                style={{
                  width: PILL_WIDTH_BY_LEVEL[level],
                  background: pillColor,
                  transition: 'opacity 160ms cubic-bezier(0.4,0,0.2,1), background 160ms cubic-bezier(0.4,0,0.2,1)',
                }}
                onClick={() => onItemClick(item.id)}
                onMouseEnter={() => setHoveredId?.(item.id)}
                onMouseLeave={() => setHoveredId?.(null)}
                aria-label={item.label || 'Outline item'}
              />
            );
          }
          return (
            <button
              key={`placeholder-${i}`}
              type="button"
              disabled
              className="h-[3px] rounded-full shrink-0 border-0 bg-transparent p-0 m-0"
              style={{
                width: 10,
                background: 'rgba(55,53,47,0.07)',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col py-3">
      {items.length === 0 ? (
        <div
          style={{
            padding: '12px 20px',
            fontSize: 12,
            color: '#9ca3af',
            fontStyle: 'italic',
          }}
        >
          Add headings to see outline
        </div>
      ) : (
        items.map((item) => {
          const isActive = activeId === item.id;
          const isHovered = hoveredId === item.id && !isActive;
          const bgStyle = isActive ? 'rgba(60, 206, 215, 0.08)' : isHovered ? '#f3f4f6' : 'transparent';
          const barColor = isActive ? '#3CCED7' : 'transparent';
          const fontWeight = isActive ? 600 : 400;
          const textColor = isActive ? '#111' : '#6b7280';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                minHeight: 32,
                padding: '0 12px 0 0',
                paddingLeft: 0,
                margin: 0,
                border: 'none',
                borderLeft: isActive ? '2px solid #3CCED7' : '2px solid transparent',
                background: bgStyle,
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: 0,
                transition: 'background 0.1s, border-color 0.1s',
              }}
              onMouseEnter={() => setHoveredId?.(item.id)}
              onMouseLeave={() => setHoveredId?.(null)}
            >
              <div
                style={{
                  width: 3,
                  alignSelf: 'stretch',
                  flexShrink: 0,
                  background: barColor,
                  borderRadius: '0 2px 2px 0',
                  marginRight: 0,
                  transition: 'background 0.15s',
                }}
              />
              <span
                style={{
                  paddingLeft: item.level === 1 ? 17 : item.level === 2 ? 29 : 41,
                  paddingRight: 20,
                  fontSize: 13,
                  lineHeight: '1.4',
                  fontWeight,
                  color: textColor,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {item.label || 'Untitled heading'}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
