'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, Link2, PencilLine, X } from 'lucide-react';
import type { DecisionGraphEdge, DecisionGraphNode } from '@/types/decision';

interface DecisionTreeProps {
  nodes: DecisionGraphNode[];
  edges: DecisionGraphEdge[];
  projectId?: number | null;
  mode?: 'viewer' | 'selector' | 'link-editor';
  onAddDecision?: (decision: DecisionGraphNode) => void;
  selectedSeqs?: Set<number> | number[];
  focusSeq?: number | null;
  onEditDecision?: (decision: DecisionGraphNode) => void;
  onCreateDecision?: () => void;
  autoFocusToday?: boolean;
  focusDateKey?: string | null;
  canReview?: boolean;
  removedSeqs?: Set<number> | number[];
  onToggleLink?: (decision: DecisionGraphNode) => void;
  onEditLinks?: (decision: DecisionGraphNode) => void;
  onDelete?: (decision: DecisionGraphNode) => void;
  canDelete?: boolean;
  selectedNodeId?: number | null;
  onSelectNode?: (id: number) => void;
  /** When true, show link handles and clickable edges; drag to connect, click edge to unlink */
  linkingEnabled?: boolean;
  /** When true, disable link handles and edge unlink (e.g. while saving) */
  linkingDisabled?: boolean;
  onCreateLink?: (fromId: number, toId: number) => void;
  onRemoveLink?: (fromId: number, toId: number) => void;
  /** Override URL builder for detail popover link. Defaults to /decisions/{id}. */
  getDecisionUrl?: (id: number, projectId?: number | null) => string;
  /** Override URL builder for review popover link. Defaults to /decisions/{id}/review. */
  getReviewUrl?: (id: number, projectId?: number | null) => string;
}

const defaultGetDecisionUrl = (id: number, projectId?: number | null) =>
  `/decisions/${id}${projectId ? `?project_id=${projectId}` : ''}`;

const defaultGetReviewUrl = (id: number, projectId?: number | null) =>
  `/decisions/${id}/review${projectId ? `?project_id=${projectId}` : ''}`;

type PositionedNode = DecisionGraphNode & { x: number; y: number; dateKey: string };
type DateColumn = { dateKey: string; x: number; count: number };

const NODE_WIDTH = 240;
const NODE_HEIGHT = 76;
const COLUMN_GAP = 120;
const COLUMN_PADDING_X = 24;
const ROW_GAP = 32;
const PADDING = 56;
const EXTRA_SCROLL = 240;
const HEADER_BAND_HEIGHT = 36;
const BAND_TOP_PADDING = 20;
const NODE_Y_BASE = BAND_TOP_PADDING + HEADER_BAND_HEIGHT + 12;
const BASE_ZOOM = 0.7;
const ZOOM_MIN = BASE_ZOOM * 0.5;
const ZOOM_MAX = BASE_ZOOM * 2.0;
const DEFAULT_ZOOM = BASE_ZOOM;
const ZOOM_STEP = BASE_ZOOM * 0.1;
const EDGE_END_GAP = 6;
const EDGE_STROKE_NORMAL = '#cbd5f5';
const EDGE_STROKE_HOVER = '#94a3b8';

const formatDateKey = (value?: string) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toISOString().slice(0, 10);
};

const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (dateKey: string) => {
  if (dateKey === 'Unknown') return 'Unknown';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatDateLabelFull = (dateKey: string) => {
  if (dateKey === 'Unknown') return 'Unknown';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatDateLabelMinimal = (dateKey: string) => {
  if (dateKey === 'Unknown') return 'Unknown';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
  }).format(date);
};

const formatDateTooltip = (dateKey: string) => {
  if (dateKey === 'Unknown') return 'Unknown';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
  }).format(date);
  return `${dateKey} (${weekday})`;
};

const getWeekdayStyle = (dateKey: string) => {
  if (dateKey === 'Unknown') {
    return {
      backgroundColor: '#f1f5f9',
      borderColor: '#e2e8f0',
      color: '#0f172a',
      tickColor: '#cbd5f5',
    };
  }
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return {
      backgroundColor: '#f1f5f9',
      borderColor: '#e2e8f0',
      color: '#0f172a',
      tickColor: '#cbd5f5',
    };
  }
  const day = date.getDay();
  switch (day) {
    case 1: // Mon
      return {
        backgroundColor: '#e0f2fe',
        borderColor: '#bae6fd',
        color: '#0c4a6e',
        tickColor: '#7dd3fc',
      };
    case 2: // Tue
      return {
        backgroundColor: '#ecfccb',
        borderColor: '#d9f99d',
        color: '#365314',
        tickColor: '#a3e635',
      };
    case 3: // Wed
      return {
        backgroundColor: '#fef3c7',
        borderColor: '#fde68a',
        color: '#92400e',
        tickColor: '#fbbf24',
      };
    case 4: // Thu
      return {
        backgroundColor: '#ede9fe',
        borderColor: '#ddd6fe',
        color: '#4c1d95',
        tickColor: '#c4b5fd',
      };
    case 5: // Fri
      return {
        backgroundColor: '#ffe4e6',
        borderColor: '#fecdd3',
        color: '#9f1239',
        tickColor: '#fda4af',
      };
    case 6: // Sat
      return {
        backgroundColor: '#dcfce7',
        borderColor: '#bbf7d0',
        color: '#166534',
        tickColor: '#86efac',
      };
    case 0: // Sun
    default:
      return {
        backgroundColor: '#e2e8f0',
        borderColor: '#cbd5f5',
        color: '#1e293b',
        tickColor: '#94a3b8',
      };
  }
};

const clamp = (min: number, value: number, max: number) =>
  Math.min(max, Math.max(min, value));

const statusColor = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-700';
    case 'AWAITING_APPROVAL':
      return 'bg-amber-50 text-amber-700';
    case 'COMMITTED':
      return 'bg-emerald-50 text-emerald-700';
    case 'REVIEWED':
      return 'bg-violet-50 text-violet-700';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const riskLeftBorder = (risk?: string | null) => {
  switch (risk) {
    case 'HIGH':
      return 'border-l-[3px] border-l-rose-400';
    case 'MEDIUM':
      return 'border-l-[3px] border-l-amber-400';
    case 'LOW':
      return 'border-l-[3px] border-l-sky-400';
    default:
      return 'border-l-[3px] border-l-transparent';
  }
};

const riskPillStyle = (risk?: string | null) => {
  switch (risk) {
    case 'HIGH':
      return 'bg-rose-50 text-rose-700';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700';
    case 'LOW':
      return 'bg-sky-50 text-sky-700';
    default:
      return 'bg-gray-100 text-gray-500';
  }
};

const statusCardOpacity = (status: string) => {
  switch (status) {
    case 'ARCHIVED':
      return 'opacity-60';
    default:
      return '';
  }
};

const DecisionTree = ({
  nodes,
  edges,
  projectId,
  mode = 'viewer',
  onAddDecision,
  onEditDecision,
  selectedSeqs,
  focusSeq,
  onCreateDecision,
  autoFocusToday = false,
  focusDateKey,
  canReview = false,
  removedSeqs,
  onToggleLink,
  onEditLinks,
  onDelete,
  canDelete = false,
  selectedNodeId,
  onSelectNode,
  linkingEnabled = false,
  linkingDisabled = false,
  onCreateLink,
  onRemoveLink,
  getDecisionUrl,
  getReviewUrl,
}: DecisionTreeProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [scale, setScale] = useState(DEFAULT_ZOOM);
  const [popover, setPopover] = useState<{
    node: DecisionGraphNode;
    x: number;
    y: number;
  } | null>(null);
  const [headerTooltip, setHeaderTooltip] = useState<{
    dateKey: string;
    x: number;
    y: number;
    count: number;
  } | null>(null);
  const [linkDragFrom, setLinkDragFrom] = useState<{
    nodeId: number;
    node: PositionedNode;
  } | null>(null);
  const [linkDragPointer, setLinkDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);

  const selectedSeqSet = useMemo(() => {
    if (!selectedSeqs) return new Set<number>();
    return selectedSeqs instanceof Set ? selectedSeqs : new Set(selectedSeqs);
  }, [selectedSeqs]);

  const removedSeqSet = useMemo(() => {
    if (!removedSeqs) return new Set<number>();
    return removedSeqs instanceof Set ? removedSeqs : new Set(removedSeqs);
  }, [removedSeqs]);

  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const { positionedNodes, dateColumns } = useMemo(() => {
    const byDate = new Map<string, DecisionGraphNode[]>();
    nodes.forEach((node) => {
      const key = formatDateKey(node.createdAt);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)?.push(node);
    });
    const sortedDates = Array.from(byDate.keys());
    sortedDates.sort();
    const indexMap = new Map<number, number>();
    const columnIndexMap = new Map<string, number>();
    sortedDates.forEach((dateKey, index) => {
      columnIndexMap.set(dateKey, index);
    });
    const outgoing = edges.reduce<Record<number, number[]>>((acc, edge) => {
      acc[edge.from] = acc[edge.from] || [];
      acc[edge.from].push(edge.to);
      return acc;
    }, {});

    let all: PositionedNode[] = [];
    const columns: DateColumn[] = [];
    sortedDates.forEach((dateKey, dateIndex) => {
      columns.push({
        dateKey,
        x: PADDING + dateIndex * (NODE_WIDTH + COLUMN_GAP),
        count: byDate.get(dateKey)?.length ?? 0,
      });
      const columnNodes = byDate.get(dateKey) || [];
      const ordered: DecisionGraphNode[] = [];
      const remaining = new Set(columnNodes.map((n) => n.id));

      columnNodes.forEach((node) => {
        const parentsInSameDate = edges
          .filter((edge) => edge.to === node.id)
          .map((edge) => edge.from)
          .filter((parentId) => byDate.get(dateKey)?.some((n) => n.id === parentId));
        if (parentsInSameDate.length === 0 && remaining.has(node.id)) {
          ordered.push(node);
          remaining.delete(node.id);
        }
      });

      let guard = 0;
      while (remaining.size > 0 && guard < columnNodes.length * 2) {
        guard += 1;
        for (const nodeId of Array.from(remaining)) {
          const parentId = edges.find((edge) => edge.to === nodeId)?.from;
          const parentIndex = ordered.findIndex((n) => n.id === parentId);
          if (parentIndex !== -1) {
            const node = columnNodes.find((n) => n.id === nodeId);
            if (node) {
              ordered.splice(parentIndex + 1, 0, node);
              remaining.delete(nodeId);
            }
          }
        }
      }

      for (const nodeId of Array.from(remaining)) {
        const node = columnNodes.find((n) => n.id === nodeId);
        if (node) ordered.push(node);
      }

      ordered.forEach((node, rowIndex) => {
        indexMap.set(node.id, rowIndex);
        all.push({
          ...node,
          dateKey,
          x: PADDING + dateIndex * (NODE_WIDTH + COLUMN_GAP),
          y: NODE_Y_BASE + rowIndex * (NODE_HEIGHT + ROW_GAP),
        });
      });
    });

    if (sortedDates.length === 0 && nodes.length > 0) {
      columns.push({ dateKey: 'Unknown', x: PADDING, count: nodes.length });
      nodes.forEach((node, index) => {
        all.push({
          ...node,
          dateKey: 'Unknown',
          x: PADDING,
          y: NODE_Y_BASE + index * (NODE_HEIGHT + ROW_GAP),
        });
      });
    }

    return { positionedNodes: all, dateColumns: columns };
  }, [nodes, edges]);

  const headerLayout = useMemo(() => {
    const preferredSpacing = NODE_WIDTH + COLUMN_GAP;
    const spacing = preferredSpacing * scale;
    let labelMode: 'full' | 'short' | 'minimal' = 'short';
    if (spacing >= 120) labelMode = 'full';
    else if (spacing >= 80) labelMode = 'short';
    else labelMode = 'minimal';
    const densityEvery =
      spacing < 80 ? clamp(2, Math.ceil(80 / Math.max(spacing, 1)), 6) : 1;
    const fontSize = clamp(12, Math.round(spacing / 10), 14);
    return { labelMode, densityEvery, fontSize, spacing };
  }, [scale]);

  const nodeCountByColumn = useMemo(() => {
    const map = new Map<string, number>();
    dateColumns.forEach((col) => {
      const count = positionedNodes.filter((n) => n.dateKey === col.dateKey).length;
      map.set(col.dateKey, count);
    });
    return map;
  }, [dateColumns, positionedNodes]);

  const contentSize = useMemo(() => {
    const maxX = Math.max(0, ...positionedNodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(0, ...positionedNodes.map((node) => node.y + NODE_HEIGHT));
    const createBarExtra = onCreateDecision ? NODE_HEIGHT + ROW_GAP : 0;
    const createPanelWidth = onCreateDecision ? NODE_WIDTH + COLUMN_PADDING_X * 2 + COLUMN_GAP : 0;
    const emptyMinWidth = onCreateDecision && positionedNodes.length === 0
      ? PADDING + NODE_WIDTH + COLUMN_PADDING_X * 2 + PADDING
      : 0;
    const emptyMinHeight = onCreateDecision && positionedNodes.length === 0
      ? NODE_Y_BASE + NODE_HEIGHT + PADDING
      : 0;
    return {
      width: Math.max(emptyMinWidth, maxX + createPanelWidth + PADDING + EXTRA_SCROLL),
      height: Math.max(emptyMinHeight, maxY + createBarExtra + PADDING + EXTRA_SCROLL),
    };
  }, [positionedNodes, onCreateDecision]);

  const nodeMap = useMemo(() => {
    return positionedNodes.reduce<Record<number, PositionedNode>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});
  }, [positionedNodes]);

  const clientToCanvas = useMemo(() => {
    return (clientX: number, clientY: number) => {
      const content = contentRef.current;
      if (!content) return null;
      const rect = content.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    };
  }, [scale]);

  const findNodeAtCanvas = useCallback(
    (canvasX: number, canvasY: number) => {
      return positionedNodes.find(
        (n) =>
          canvasX >= n.x &&
          canvasX <= n.x + NODE_WIDTH &&
          canvasY >= n.y &&
          canvasY <= n.y + NODE_HEIGHT
      ) ?? null;
    },
    [positionedNodes]
  );

  const handleLinkHandlePointerDown = useCallback(
    (e: React.PointerEvent, node: PositionedNode) => {
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setLinkDragFrom({ nodeId: node.id, node });
      setLinkDragPointer(null);
    },
    []
  );

  const handleLinkHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pt = clientToCanvas(e.clientX, e.clientY);
      if (pt) setLinkDragPointer(pt);
    },
    [clientToCanvas]
  );

  const handleLinkHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const pt = clientToCanvas(e.clientX, e.clientY);
      const from = linkDragFrom;
      setLinkDragFrom(null);
      setLinkDragPointer(null);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      if (!from || !pt || !onCreateLink) return;
      const target = findNodeAtCanvas(pt.x, pt.y);
      if (target && target.id !== from.nodeId) {
        onCreateLink(from.nodeId, target.id);
      }
    },
    [linkDragFrom, clientToCanvas, findNodeAtCanvas, onCreateLink]
  );

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const isZoomGesture = event.ctrlKey || event.metaKey;
    if (!isZoomGesture) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale + delta));
    if (nextScale === scale) return;

    const rect = viewport.getBoundingClientRect();
    const offsetX = event.clientX - rect.left + viewport.scrollLeft;
    const offsetY = event.clientY - rect.top + viewport.scrollTop;
    const scaleRatio = nextScale / scale;
    const nextScrollLeft = offsetX * scaleRatio - (event.clientX - rect.left);
    const nextScrollTop = offsetY * scaleRatio - (event.clientY - rect.top);
    viewport.scrollLeft = nextScrollLeft;
    viewport.scrollTop = nextScrollTop;
    setScale(nextScale);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const delta = direction === 'in' ? ZOOM_STEP : -ZOOM_STEP;
    const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale + delta));
    if (nextScale === scale) return;
    const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
    const centerY = viewport.scrollTop + viewport.clientHeight / 2;
    const scaleRatio = nextScale / scale;
    viewport.scrollLeft = centerX * scaleRatio - viewport.clientWidth / 2;
    viewport.scrollTop = centerY * scaleRatio - viewport.clientHeight / 2;
    setScale(nextScale);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest?.('[data-decision-link-handle]')) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragState.current = {
      dragging: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !dragState.current.dragging) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    if (!dragState.current.moved && Math.hypot(dx, dy) > 4) {
      dragState.current.moved = true;
    }
    const nextScrollLeft = dragState.current.scrollLeft - dx;
    const nextScrollTop = dragState.current.scrollTop - dy;
    viewport.scrollLeft = nextScrollLeft;
    viewport.scrollTop = nextScrollTop;
  };

  const handleMouseUp = () => {
    dragState.current.dragging = false;
  };

  const handleNodeClick = (node: DecisionGraphNode, event: React.MouseEvent<HTMLButtonElement>) => {
    if (dragState.current.dragging || dragState.current.moved) return;
    if (mode === 'link-editor') {
      onToggleLink?.(node);
      return;
    }
    if (onSelectNode) {
      onSelectNode(node.id);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setPopover({
      node,
      x: rect.right + 12,
      y: rect.top,
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest('[data-decision-popover]')) return;
      if (event.target.closest('[data-decision-node]')) return;
      setPopover(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mode === 'link-editor') {
      setPopover(null);
    }
  }, [mode]);

  useEffect(() => {
    if (!focusSeq) return;
    const target = positionedNodes.find((node) => node.projectSeq === focusSeq);
    const viewport = viewportRef.current;
    if (!target || !viewport) return;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const targetX = (target.x + NODE_WIDTH / 2) * scale;
    const targetY = (target.y + NODE_HEIGHT / 2) * scale;
    const nextLeft = Math.max(0, targetX - viewportWidth / 2);
    const nextTop = Math.max(0, targetY - viewportHeight / 2);
    requestAnimationFrame(() => {
      viewport.scrollLeft = nextLeft;
      viewport.scrollTop = nextTop;
    });
  }, [focusSeq, positionedNodes, scale]);

  const todayColumn = dateColumns.find((column) => column.dateKey === todayKey);
  const autoFocusDone = useRef(false);

  useEffect(() => {
    if (!autoFocusToday || autoFocusDone.current) return;
    if (!todayColumn) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const targetX = (todayColumn.x + NODE_WIDTH / 2) * scale;
    const targetY = (NODE_Y_BASE / 2) * scale;
    autoFocusDone.current = true;
    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, targetX - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, targetY - viewport.clientHeight / 2);
    });
  }, [autoFocusToday, todayColumn, scale]);

  useEffect(() => {
    if (!focusDateKey) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const decisionColumns = dateColumns.filter((column) => column.count > 0);
    if (decisionColumns.length === 0) return;
    const targetDate = new Date(`${focusDateKey}T00:00:00`);
    if (Number.isNaN(targetDate.getTime())) return;
    let nearest = decisionColumns[0];
    let nearestDiff = Math.abs(
      new Date(`${nearest.dateKey}T00:00:00`).getTime() - targetDate.getTime()
    );
    for (const column of decisionColumns.slice(1)) {
      const diff = Math.abs(
        new Date(`${column.dateKey}T00:00:00`).getTime() - targetDate.getTime()
      );
      if (diff < nearestDiff) {
        nearest = column;
        nearestDiff = diff;
      }
    }
    const targetX = (nearest.x + NODE_WIDTH / 2) * scale;
    const targetY = (NODE_Y_BASE / 2) * scale;
    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, targetX - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, targetY - viewport.clientHeight / 2);
    });
  }, [focusDateKey, dateColumns, scale]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl ring-1 ring-gray-100 bg-gray-50">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-1 shadow-sm ring-1 ring-gray-200 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => handleZoom('out')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="min-w-[44px] text-center text-[11px] font-medium text-gray-600">
          {Math.round((scale / BASE_ZOOM) * 100)}%
        </span>
        <button
          type="button"
          onClick={() => handleZoom('in')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(15, 23, 42, 0.06) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
        className={`h-full w-full overflow-auto ${dragState.current.dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div
          ref={contentRef}
          style={{
            width: contentSize.width,
            height: contentSize.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          className="relative"
        >
          {dateColumns.map((column, colIdx) => {
            const nodeCount = nodeCountByColumn.get(column.dateKey) ?? 0;
            const isLastColumn = colIdx === dateColumns.length - 1;
            const createSlot = isLastColumn && onCreateDecision ? 1 : 0;
            const effectiveCount = Math.max(nodeCount + createSlot, 1);
            const panelHeight = Math.max(160, HEADER_BAND_HEIGHT + effectiveCount * (NODE_HEIGHT + ROW_GAP) + ROW_GAP);
            return (
              <div
                key={`panel-${column.dateKey}`}
                className="absolute rounded-xl bg-white/70 ring-1 ring-gray-100 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur-sm"
                style={{
                  left: column.x - COLUMN_PADDING_X,
                  top: BAND_TOP_PADDING,
                  width: NODE_WIDTH + COLUMN_PADDING_X * 2,
                  height: panelHeight,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
            );
          })}

          {dateColumns.length === 0 && onCreateDecision && (
            <div
              className="absolute rounded-xl bg-white/70 ring-1 ring-gray-100 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur-sm"
              style={{
                left: PADDING - COLUMN_PADDING_X,
                top: BAND_TOP_PADDING,
                width: NODE_WIDTH + COLUMN_PADDING_X * 2,
                height: HEADER_BAND_HEIGHT + NODE_HEIGHT + ROW_GAP * 2,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
          )}

          {onCreateDecision && (() => {
            const lastCol = dateColumns[dateColumns.length - 1];
            const createPanelX = lastCol
              ? lastCol.x + NODE_WIDTH + COLUMN_PADDING_X + COLUMN_GAP - COLUMN_PADDING_X
              : PADDING - COLUMN_PADDING_X;
            return (
              <div
                className="group absolute flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/50 transition hover:border-[#3CCED7]/60 hover:bg-white"
                style={{
                  left: createPanelX,
                  top: BAND_TOP_PADDING,
                  width: NODE_WIDTH + COLUMN_PADDING_X * 2,
                  height: 140,
                  zIndex: 25,
                  pointerEvents: 'auto',
                }}
              >
                <button
                  type="button"
                  onClick={onCreateDecision}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition group-hover:text-[#3CCED7] cursor-pointer"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition group-hover:bg-[#3CCED7]/10 group-hover:text-[#3CCED7]">+</span>
                  Create Decision
                </button>
              </div>
            );
          })()}

          <svg
            className="absolute inset-0 h-full w-full"
            style={{ pointerEvents: linkingEnabled && !linkingDisabled ? 'auto' : 'none', zIndex: 10 }}
          >
            <defs>
              <marker
                id="decision-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={EDGE_STROKE_NORMAL} />
              </marker>
              <marker
                id="decision-arrow-hover"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={EDGE_STROKE_HOVER} />
              </marker>
              <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#94a3b8" floodOpacity="0.4" />
              </filter>
            </defs>
            <g style={{ pointerEvents: 'none' }}>
              {edges.map((edge, idx) => {
                const fromNode = nodeMap[edge.from];
                const toNode = nodeMap[edge.to];
                if (!fromNode || !toNode) return null;
                const sameColumn = fromNode.x === toNode.x;
                const startX = fromNode.x + NODE_WIDTH;
                const startY = fromNode.y + NODE_HEIGHT / 2;
                const endX = sameColumn
                  ? toNode.x + NODE_WIDTH - EDGE_END_GAP
                  : toNode.x - EDGE_END_GAP;
                const endY = toNode.y + NODE_HEIGHT / 2;
                const curve = Math.max(40, (endX - startX) / 2);
                const loopOffset = 36;
                const path = sameColumn
                  ? `M ${startX} ${startY} C ${startX + loopOffset} ${startY}, ${
                      startX + loopOffset
                    } ${endY}, ${endX} ${endY}`
                  : `M ${startX} ${startY} C ${startX + curve} ${startY}, ${
                      endX - curve
                    } ${endY}, ${endX} ${endY}`;
                const hovered = linkingEnabled && !linkingDisabled && hoveredEdgeIdx === idx;
                return (
                  <path
                    key={`edge-${idx}`}
                    d={path}
                    stroke={hovered ? EDGE_STROKE_HOVER : EDGE_STROKE_NORMAL}
                    strokeWidth={hovered ? 3 : 2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={hovered ? 'url(#decision-arrow-hover)' : 'url(#decision-arrow)'}
                    filter={hovered ? 'url(#edge-glow)' : undefined}
                  />
                );
              })}
              {linkDragFrom && (
                <path
                  d={(() => {
                    const startX = linkDragFrom.node.x + NODE_WIDTH;
                    const startY = linkDragFrom.node.y + NODE_HEIGHT / 2;
                    const endX = linkDragPointer?.x ?? startX;
                    const endY = linkDragPointer?.y ?? startY;
                    const curve = Math.max(40, (endX - startX) / 2);
                    return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
                  })()}
                  stroke={EDGE_STROKE_NORMAL}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#decision-arrow)"
                />
              )}
            </g>
            {linkingEnabled && !linkingDisabled && onRemoveLink && (
              <g style={{ pointerEvents: 'auto' }}>
                {edges.map((edge, idx) => {
                  const fromNode = nodeMap[edge.from];
                  const toNode = nodeMap[edge.to];
                  if (!fromNode || !toNode) return null;
                  const sameColumn = fromNode.x === toNode.x;
                  const startX = fromNode.x + NODE_WIDTH;
                  const startY = fromNode.y + NODE_HEIGHT / 2;
                  const endX = sameColumn
                    ? toNode.x + NODE_WIDTH - EDGE_END_GAP
                    : toNode.x - EDGE_END_GAP;
                  const endY = toNode.y + NODE_HEIGHT / 2;
                  const curve = Math.max(40, (endX - startX) / 2);
                  const loopOffset = 36;
                  const path = sameColumn
                    ? `M ${startX} ${startY} C ${startX + loopOffset} ${startY}, ${
                        startX + loopOffset
                      } ${endY}, ${endX} ${endY}`
                    : `M ${startX} ${startY} C ${startX + curve} ${startY}, ${
                        endX - curve
                      } ${endY}, ${endX} ${endY}`;
                  return (
                    <path
                      key={`edge-hit-${idx}`}
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      cursor="pointer"
                      onMouseEnter={() => setHoveredEdgeIdx(idx)}
                      onMouseLeave={() => setHoveredEdgeIdx(null)}
                      onClick={() => onRemoveLink(edge.from, edge.to)}
                      aria-label={`Remove link between decisions`}
                    />
                  );
                })}
              </g>
            )}
          </svg>

          <div className="pointer-events-none absolute inset-0" style={{ zIndex: 20 }}>
            {dateColumns.map((column, index) => {
              const { labelMode, densityEvery, fontSize } = headerLayout;
              const showLabel = index % densityEvery === 0;
              const label =
                labelMode === 'full'
                  ? formatDateLabelFull(column.dateKey)
                  : labelMode === 'short'
                    ? formatDateLabel(column.dateKey)
                    : formatDateLabelMinimal(column.dateKey);
              const chipHeight = 24;
              const chipY = BAND_TOP_PADDING + (HEADER_BAND_HEIGHT - chipHeight) / 2;
              const centerX = column.x + NODE_WIDTH / 2;
              const chipWidth = Math.max(54, label.length * (fontSize * 0.6) + 18);

              if (!showLabel) {
                const { tickColor } = getWeekdayStyle(column.dateKey);
                return (
                  <div
                    key={`header-${column.dateKey}`}
                    className="absolute"
                    style={{
                      left: centerX - 4,
                      top: chipY + chipHeight / 2 - 2,
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: tickColor,
                    }}
                  />
                );
              }

              return (
                <button
                  key={`header-${column.dateKey}`}
                  type="button"
                  className="pointer-events-auto absolute flex items-center justify-center rounded-md text-[11px] font-medium uppercase tracking-wider text-gray-400 transition hover:text-gray-600"
                  style={{
                    left: centerX - chipWidth / 2,
                    top: chipY,
                    width: chipWidth,
                    height: chipHeight,
                    fontSize,
                    letterSpacing: '0.06em',
                  }}
                  onMouseEnter={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setHeaderTooltip({
                      dateKey: column.dateKey,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      count: column.count,
                    });
                  }}
                  onMouseLeave={() => setHeaderTooltip(null)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {positionedNodes.map((node) => (
            <div
              key={node.id}
              className="group absolute"
              style={{
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                left: node.x,
                top: node.y,
                zIndex: 20,
              }}
            >
              {linkingEnabled && !linkingDisabled && (
                <div
                  data-decision-link-handle
                  role="button"
                  tabIndex={0}
                  aria-label={`Drag to link decision ${node.title || node.id}`}
                  className="absolute right-1 top-1/2 z-10 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-[#3CCED7] bg-white shadow-sm hover:bg-[#3CCED7]/10"
                  style={{ right: 4 }}
                  onPointerDown={(e) => handleLinkHandlePointerDown(e, node)}
                  onPointerMove={handleLinkHandlePointerMove}
                  onPointerUp={handleLinkHandlePointerUp}
                  onPointerCancel={handleLinkHandlePointerUp}
                />
              )}
              <button
                type="button"
                data-decision-node
                onClick={(event) => handleNodeClick(node, event)}
                className={`w-full h-full overflow-hidden rounded-xl bg-white px-3 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 will-change-transform hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] ${statusCardOpacity(node.status)} ${riskLeftBorder(node.riskLevel)} ${
                  mode === 'link-editor' && node.projectSeq && removedSeqSet.has(node.projectSeq)
                    ? 'ring-2 ring-rose-200'
                    : mode === 'link-editor' && node.projectSeq && selectedSeqSet.has(node.projectSeq)
                      ? 'ring-2 ring-emerald-200'
                      : mode === 'selector' && node.projectSeq && selectedSeqSet.has(node.projectSeq)
                        ? 'ring-2 ring-emerald-200'
                        : selectedNodeId != null && node.id === selectedNodeId
                          ? 'ring-2 ring-[#3CCED7]'
                          : 'ring-1 ring-gray-200 hover:ring-gray-300'
                } ${
                  focusSeq && node.projectSeq === focusSeq
                    ? 'ring-2 ring-[#3CCED7]'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900 leading-tight">
                    {node.title || 'Untitled'}
                  </div>
                  {node.projectSeq ? (
                    <span className="shrink-0 text-[12px] font-medium text-gray-400">
                      #{node.projectSeq}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(
                      node.status
                    )}`}
                  >
                    <span className="mr-1 h-1 w-1 rounded-full bg-current opacity-70" />
                    {node.status}
                  </span>
                  {node.riskLevel ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${riskPillStyle(node.riskLevel)}`}
                    >
                      {node.riskLevel}
                    </span>
                  ) : null}
                </div>
              </button>
              {canDelete && onDelete && mode === 'viewer' ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(node);
                  }}
                  className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-rose-500 opacity-0 shadow-sm ring-1 ring-rose-200 transition-all hover:bg-rose-50 group-hover:opacity-100"
                  aria-label="Delete decision"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}

          {onCreateDecision ? (() => {
            const lastCol = dateColumns[dateColumns.length - 1];
            const lastColNodeCount = lastCol ? (nodeCountByColumn.get(lastCol.dateKey) ?? 0) : 0;
            const createLeft = lastCol ? lastCol.x : PADDING;
            const createTop = lastCol
              ? NODE_Y_BASE + lastColNodeCount * (NODE_HEIGHT + ROW_GAP)
              : NODE_Y_BASE;
            return (
              <div
                className="absolute"
                style={{
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  left: createLeft,
                  top: createTop,
                  zIndex: 25,
                  pointerEvents: 'auto',
                }}
              >
                <button
                  type="button"
                  onClick={onCreateDecision}
                  className="group w-full h-full rounded-xl border border-dashed border-gray-200 bg-white/60 px-3 py-2 text-left transition hover:border-[#3CCED7]/60 hover:bg-white hover:shadow-[0_2px_8px_rgba(60,206,215,0.08)] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition group-hover:bg-[#3CCED7]/10 group-hover:text-[#3CCED7]">+</span>
                  <span className="text-xs font-medium text-gray-400 transition group-hover:text-[#3CCED7]">Create Decision</span>
                </button>
              </div>
            );
          })() : null}
        </div>
      </div>

      {popover ? (
        <div
          data-decision-popover
          className="fixed z-50 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
          style={{ left: popover.x, top: popover.y }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-gray-900">
              {popover.node.title || 'Untitled'}
            </div>
            {onEditLinks ? (
              <button
                type="button"
                onClick={() => {
                  setPopover(null);
                  onEditLinks(popover.node);
                }}
                disabled={!popover.node.projectSeq}
                title="Edit Links"
                aria-label="Edit Links"
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs ${
                  popover.node.projectSeq
                    ? 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    : 'cursor-not-allowed border-gray-100 text-gray-300'
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(
                popover.node.status
              )}`}
            >
              {popover.node.status}
            </span>
            {popover.node.riskLevel ? (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {popover.node.riskLevel}
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Created: {new Date(popover.node.createdAt).toLocaleString()}
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              {mode === 'selector' ? (
                <button
                  type="button"
                  onClick={() => onAddDecision?.(popover.node)}
                  disabled={
                    !popover.node.projectSeq ||
                    selectedSeqSet.has(popover.node.projectSeq)
                  }
                  className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold ${
                    !popover.node.projectSeq ||
                    selectedSeqSet.has(popover.node.projectSeq)
                      ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {!popover.node.projectSeq ||
                  selectedSeqSet.has(popover.node.projectSeq)
                    ? 'Added'
                    : '+ Add'}
                </button>
              ) : null}
              {popover.node.status === 'DRAFT' && onEditDecision ? (
                <button
                  type="button"
                  onClick={() => {
                    setPopover(null);
                    onEditDecision(popover.node);
                  }}
                  className="inline-flex w-[80px] items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:border-amber-300"
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  Edit
                </button>
              ) : null}
              {popover.node.status === 'COMMITTED' && canReview ? (
                <Link
                  href={(getReviewUrl ?? defaultGetReviewUrl)(popover.node.id, projectId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-[80px] items-center justify-center gap-1.5 rounded-md border border-[#3CCED7]/30 bg-[#3CCED7]/10 px-3 py-1.5 text-xs font-semibold text-[#1a9ba3] hover:border-blue-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Review
                </Link>
              ) : null}
              <Link
                href={(getDecisionUrl ?? defaultGetDecisionUrl)(popover.node.id, projectId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <FileText className="h-3.5 w-3.5" />
                Details
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {headerTooltip ? (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 shadow-lg"
          style={{ left: headerTooltip.x, top: headerTooltip.y }}
        >
          <div className="font-semibold text-slate-900">
            {formatDateTooltip(headerTooltip.dateKey)}
          </div>
          <div className="text-[11px] text-slate-600">
            {headerTooltip.count} decision{headerTooltip.count === 1 ? '' : 's'}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DecisionTree;
