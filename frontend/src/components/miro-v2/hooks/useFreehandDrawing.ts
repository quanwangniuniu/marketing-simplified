import { useState, useCallback, useRef, useEffect } from 'react';
import { ToolType } from './useToolDnD';
import {
  freehandPointsToWorldPath,
  worldPathToLocalPath,
  worldPointsToScreenPath,
} from '../utils/cubicBsplinePath';

interface UseFreehandDrawingProps {
  activeTool: ToolType;
  canvasRef: React.RefObject<HTMLDivElement>;
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
  brushSettings?: {
    strokeColor: string;
    strokeWidth: number;
  };
  onFreehandCreate?: (data: {
    x: number;
    y: number;
    width: number;
    height: number;
    style: { svgPath: string; strokeColor: string; strokeWidth: number };
  }) => void;
}

interface UseFreehandDrawingReturn {
  freehandDraft: Array<{ x: number; y: number }>;
  isDrawingFreehand: boolean;
  svgPathRef: React.RefObject<SVGPathElement>;
  handleFreehandMouseDown: (e: React.MouseEvent<HTMLDivElement>, isBackground: boolean) => void;
  handleFreehandMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleFreehandMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function useFreehandDrawing({
  activeTool,
  canvasRef,
  screenToWorld,
  worldToScreen,
  brushSettings,
  onFreehandCreate,
}: UseFreehandDrawingProps): UseFreehandDrawingReturn {
  const isDrawingFreehandRef = useRef(false);
  const freehandPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const [freehandDraft, setFreehandDraft] = useState<Array<{ x: number; y: number }>>([]);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);

  // Refs for direct SVG path updates (no React re-renders)
  const svgPathRef = useRef<SVGPathElement>(null);
  const currentPathRef = useRef<string>("");

  // Store latest dependencies in refs so handlers always have access to latest values
  const activeToolRef = useRef(activeTool);
  const screenToWorldRef = useRef(screenToWorld);
  const worldToScreenRef = useRef(worldToScreen);
  const onFreehandCreateRef = useRef(onFreehandCreate);
  const canvasRefRef = useRef(canvasRef);
  const brushSettingsRef = useRef(brushSettings || { strokeColor: "#000000", strokeWidth: 4 });

  // Update refs when dependencies change
  useEffect(() => {
    activeToolRef.current = activeTool;
    screenToWorldRef.current = screenToWorld;
    worldToScreenRef.current = worldToScreen;
    onFreehandCreateRef.current = onFreehandCreate;
    canvasRefRef.current = canvasRef;
    brushSettingsRef.current = brushSettings || { strokeColor: "#000000", strokeWidth: 4 };
  }, [activeTool, screenToWorld, worldToScreen, onFreehandCreate, canvasRef, brushSettings]);

  // Global mouse handlers for freehand drawing (capture events even outside canvas)
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDrawingFreehandRef.current || activeToolRef.current !== "freehand") {
      return;
    }

    const rect = canvasRefRef.current.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorldRef.current(screenX, screenY);
    freehandPointsRef.current.push({ x: worldPoint.x, y: worldPoint.y });

    const halfW = brushSettingsRef.current.strokeWidth / 2;
    currentPathRef.current = worldPointsToScreenPath(
      freehandPointsRef.current,
      halfW,
      worldToScreenRef.current
    );
    if (svgPathRef.current) {
      svgPathRef.current.setAttribute("d", currentPathRef.current);
    }
  }, []);

  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    if (!isDrawingFreehandRef.current || activeToolRef.current !== "freehand") return;

    const points = freehandPointsRef.current;
    if (points.length >= 2 && onFreehandCreateRef.current) {
      const halfW = brushSettingsRef.current.strokeWidth / 2;
      const { pathWorld, bbox } = freehandPointsToWorldPath(points, halfW);
      const svgPath = worldPathToLocalPath(pathWorld, bbox.minX, bbox.minY);
      const width = Math.max(bbox.maxX - bbox.minX, 1);
      const height = Math.max(bbox.maxY - bbox.minY, 1);

      onFreehandCreateRef.current({
        x: bbox.minX,
        y: bbox.minY,
        width,
        height,
        style: {
          svgPath,
          strokeColor: brushSettingsRef.current.strokeColor,
          strokeWidth: brushSettingsRef.current.strokeWidth,
        },
      });
    }

    // Remove global listeners
    document.removeEventListener("mousemove", handleGlobalMouseMove);
    document.removeEventListener("mouseup", handleGlobalMouseUp);

    // Clear drawing state
    isDrawingFreehandRef.current = false;
    setIsDrawingFreehand(false);
    freehandPointsRef.current = [];
    currentPathRef.current = "";
    setFreehandDraft([]);
  }, [handleGlobalMouseMove]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  // Cleanup listeners when tool changes away from freehand
  useEffect(() => {
    if (activeTool !== "freehand" && isDrawingFreehandRef.current) {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      isDrawingFreehandRef.current = false;
      setIsDrawingFreehand(false);
      freehandPointsRef.current = [];
      currentPathRef.current = "";
      setFreehandDraft([]);
    }
  }, [activeTool, handleGlobalMouseMove, handleGlobalMouseUp]);

  // Ensure SVG path is updated when element is mounted
  useEffect(() => {
    if (freehandDraft.length > 0 && svgPathRef.current && currentPathRef.current) {
      svgPathRef.current.setAttribute('d', currentPathRef.current);
    }
  }, [freehandDraft.length]);

  // Handle mouse down for freehand drawing
  const handleFreehandMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, isBackground: boolean) => {
      // Allow drawing on both background and items - remove isBackground check
      if (activeTool !== "freehand") {
        return;
      }

      isDrawingFreehandRef.current = true;
      setIsDrawingFreehand(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPoint = screenToWorld(screenX, screenY);
      freehandPointsRef.current = [{ x: worldPoint.x, y: worldPoint.y }];
      const halfW = brushSettingsRef.current.strokeWidth / 2;
      currentPathRef.current = worldPointsToScreenPath(
        freehandPointsRef.current,
        halfW,
        worldToScreen
      );
      
      // Show overlay (state update only for visibility toggle)
      // This triggers React render to mount the SVG element
      setFreehandDraft([{ x: worldPoint.x, y: worldPoint.y }]);
      
      // Set initial path on SVG element after a microtask to ensure it's mounted
      // The SVG element will be mounted after setFreehandDraft triggers a render
      setTimeout(() => {
        if (svgPathRef.current) {
          svgPathRef.current.setAttribute('d', currentPathRef.current);
        }
      }, 0);

      // Attach global mouse event listeners for real-time drawing
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);

      e.preventDefault();
      e.stopPropagation();
    },
    [activeTool, canvasRef, screenToWorld, worldToScreen, handleGlobalMouseMove, handleGlobalMouseUp]
  );

  // Handle mouse move for freehand drawing
  const handleFreehandMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Freehand drawing is handled by global mouse event listeners for better tracking
      if (isDrawingFreehandRef.current && activeTool === "freehand") {
        // Let global handlers take care of it
        return;
      }
    },
    [activeTool]
  );

  // Handle mouse up for freehand drawing
  const handleFreehandMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDrawingFreehandRef.current && activeTool === "freehand") {
        // Global handlers will handle this, but clean up if React event fires first
        handleGlobalMouseUp(e.nativeEvent);
      }
    },
    [activeTool, handleGlobalMouseUp]
  );

  return {
    freehandDraft,
    isDrawingFreehand,
    svgPathRef,
    handleFreehandMouseDown,
    handleFreehandMouseMove,
    handleFreehandMouseUp,
  };
}

