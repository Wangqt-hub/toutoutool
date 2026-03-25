"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { getBrandCode, type ColorBrand, type PaletteColor } from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";

interface Point {
  x: number;
  y: number;
}

export interface BeadWorkbenchCanvasHandle {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  focusColor: (colorIndex: number) => void;
  ensureColorLabelScale: () => void;
}

interface BeadWorkbenchCanvasProps {
  grid: BeadGrid;
  palette: PaletteColor[];
  brand: string;
  selectedColorIndex: number | null;
  completedColorIndexes: number[];
  showColorNumbers?: boolean;
  hideCompleted?: boolean;
  className?: string;
  onSelectedColorIndexChange: (colorIndex: number | null) => void;
  onToggleCompletedColor: (colorIndex: number) => void;
  onScaleChange?: (scale: number) => void;
}

const BASE_CELL_SIZE = 20;
const MIN_SCALE = 0.35;
const MAX_SCALE = 4.5;
const VIEW_PADDING = 24;
const LONG_PRESS_MS = 360;
const DRAG_THRESHOLD = 6;
const ZOOM_STEP = 0.14;
const MIN_LABEL_CELL_SIZE = 18;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBrightness(hex: string): number {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function getTextColor(hex: string): string {
  return getBrightness(hex) > 170 ? "#0F172A" : "#F8FAFC";
}

function getDistance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function getMidpoint(left: Point, right: Point): Point {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

export const BeadWorkbenchCanvas = forwardRef<
  BeadWorkbenchCanvasHandle,
  BeadWorkbenchCanvasProps
>(function BeadWorkbenchCanvas(
  {
    grid,
    palette,
    brand,
    selectedColorIndex,
    completedColorIndexes,
    showColorNumbers = true,
    hideCompleted = false,
    className,
    onSelectedColorIndexChange,
    onToggleCompletedColor,
    onScaleChange,
  },
  ref
) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const viewInitializedRef = useRef(false);
  const viewRef = useRef({
    scale: 1,
    position: { x: 0, y: 0 },
  });
  const gestureRef = useRef<{
    pointers: Map<number, Point>;
    primaryPointerId: number | null;
    startPoint: Point | null;
    startPosition: Point | null;
    moved: boolean;
    longPressTriggered: boolean;
    pinchStartDistance: number;
    pinchStartScale: number;
    pinchStartWorldMid: Point | null;
  }>({
    pointers: new Map(),
    primaryPointerId: null,
    startPoint: null,
    startPosition: null,
    moved: false,
    longPressTriggered: false,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    pinchStartWorldMid: null,
  });

  const completedColorSet = useMemo(
    () => new Set(completedColorIndexes),
    [completedColorIndexes]
  );
  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;
  const patternWidth = colCount * BASE_CELL_SIZE;
  const patternHeight = rowCount * BASE_CELL_SIZE;

  useEffect(() => {
    viewRef.current = {
      scale,
      position,
    };
    onScaleChange?.(scale);
  }, [onScaleChange, position, scale]);

  useEffect(() => {
    viewInitializedRef.current = false;
  }, [patternHeight, patternWidth]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const element = containerRef.current;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const constrainView = (
    nextScale: number,
    nextPosition: Point
  ): { scale: number; position: Point } => {
    if (viewportSize.width === 0 || viewportSize.height === 0) {
      return {
        scale: nextScale,
        position: nextPosition,
      };
    }

    const scaledWidth = patternWidth * nextScale;
    const scaledHeight = patternHeight * nextScale;
    const centeredX = (viewportSize.width - scaledWidth) / 2;
    const centeredY = (viewportSize.height - scaledHeight) / 2;

    if (scaledWidth <= viewportSize.width - VIEW_PADDING * 2) {
      nextPosition.x = centeredX;
    } else {
      nextPosition.x = clamp(
        nextPosition.x,
        viewportSize.width - scaledWidth - VIEW_PADDING,
        VIEW_PADDING
      );
    }

    if (scaledHeight <= viewportSize.height - VIEW_PADDING * 2) {
      nextPosition.y = centeredY;
    } else {
      nextPosition.y = clamp(
        nextPosition.y,
        viewportSize.height - scaledHeight - VIEW_PADDING,
        VIEW_PADDING
      );
    }

    return {
      scale: nextScale,
      position: nextPosition,
    };
  };

  const fitView = () => {
    if (
      viewportSize.width === 0 ||
      viewportSize.height === 0 ||
      patternWidth === 0 ||
      patternHeight === 0
    ) {
      return;
    }

    const fitScale = Math.min(
      (viewportSize.width - VIEW_PADDING * 2) / patternWidth,
      (viewportSize.height - VIEW_PADDING * 2) / patternHeight
    );
    const nextScale = clamp(Math.min(2.4, fitScale), MIN_SCALE, MAX_SCALE);
    const nextPosition = {
      x: (viewportSize.width - patternWidth * nextScale) / 2,
      y: (viewportSize.height - patternHeight * nextScale) / 2,
    };
    const constrained = constrainView(nextScale, nextPosition);

    setScale(constrained.scale);
    setPosition(constrained.position);
  };

  const ensureColorLabelScale = () => {
    const minimumScale = clamp(
      MIN_LABEL_CELL_SIZE / BASE_CELL_SIZE,
      MIN_SCALE,
      MAX_SCALE
    );

    if (
      viewportSize.width === 0 ||
      viewportSize.height === 0 ||
      viewRef.current.scale >= minimumScale
    ) {
      return;
    }

    zoomAtPoint(
      {
        x: viewportSize.width / 2,
        y: viewportSize.height / 2,
      },
      minimumScale
    );
  };

  useEffect(() => {
    if (
      viewInitializedRef.current ||
      viewportSize.width === 0 ||
      viewportSize.height === 0
    ) {
      return;
    }

    fitView();
    viewInitializedRef.current = true;
  }, [viewportSize.height, viewportSize.width]);

  const screenToWorld = (
    point: Point,
    nextScale = viewRef.current.scale,
    nextPosition = viewRef.current.position
  ) => ({
    x: (point.x - nextPosition.x) / nextScale,
    y: (point.y - nextPosition.y) / nextScale,
  });

  const getLocalPoint = (clientX: number, clientY: number): Point | null => {
    if (!containerRef.current) {
      return null;
    }

    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const getColorIndexAtPoint = (
    point: Point,
    nextScale = viewRef.current.scale,
    nextPosition = viewRef.current.position
  ): number | null => {
    const world = screenToWorld(point, nextScale, nextPosition);
    const col = Math.floor(world.x / BASE_CELL_SIZE);
    const row = Math.floor(world.y / BASE_CELL_SIZE);

    if (col < 0 || row < 0 || col >= colCount || row >= rowCount) {
      return null;
    }

    return grid[row][col];
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const zoomAtPoint = (point: Point, nextScale: number) => {
    const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const worldPoint = screenToWorld(
      point,
      viewRef.current.scale,
      viewRef.current.position
    );
    const nextPosition = {
      x: point.x - worldPoint.x * clampedScale,
      y: point.y - worldPoint.y * clampedScale,
    };
    const constrained = constrainView(clampedScale, nextPosition);

    setScale(constrained.scale);
    setPosition(constrained.position);
  };

  const focusColor = (colorIndex: number) => {
    if (
      viewportSize.width === 0 ||
      viewportSize.height === 0 ||
      colorIndex < 0
    ) {
      return;
    }

    let minRow = Number.POSITIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;
    let minCol = Number.POSITIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;

    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell !== colorIndex) {
          return;
        }

        minRow = Math.min(minRow, rowIndex);
        maxRow = Math.max(maxRow, rowIndex);
        minCol = Math.min(minCol, colIndex);
        maxCol = Math.max(maxCol, colIndex);
      });
    });

    if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) {
      return;
    }

    const boundsWidth = (maxCol - minCol + 1) * BASE_CELL_SIZE;
    const boundsHeight = (maxRow - minRow + 1) * BASE_CELL_SIZE;
    const nextScale = clamp(
      Math.min(
        MAX_SCALE,
        (viewportSize.width - VIEW_PADDING * 4) / Math.max(boundsWidth, BASE_CELL_SIZE),
        (viewportSize.height - VIEW_PADDING * 4) /
          Math.max(boundsHeight, BASE_CELL_SIZE),
        3
      ),
      MIN_SCALE,
      MAX_SCALE
    );
    const centerX = (minCol + maxCol + 1) * 0.5 * BASE_CELL_SIZE;
    const centerY = (minRow + maxRow + 1) * 0.5 * BASE_CELL_SIZE;
    const nextPosition = {
      x: viewportSize.width / 2 - centerX * nextScale,
      y: viewportSize.height / 2 - centerY * nextScale,
    };
    const constrained = constrainView(nextScale, nextPosition);

    setScale(constrained.scale);
    setPosition(constrained.position);
  };

  useImperativeHandle(
    ref,
    () => ({
      fitView,
      zoomIn: () =>
        zoomAtPoint(
          {
            x: viewportSize.width / 2,
            y: viewportSize.height / 2,
          },
          viewRef.current.scale + ZOOM_STEP
        ),
      zoomOut: () =>
        zoomAtPoint(
          {
            x: viewportSize.width / 2,
            y: viewportSize.height / 2,
          },
          viewRef.current.scale - ZOOM_STEP
        ),
      focusColor,
      ensureColorLabelScale,
    }),
    [viewportSize.height, viewportSize.width]
  );

  useEffect(() => {
    if (
      !canvasRef.current ||
      viewportSize.width === 0 ||
      viewportSize.height === 0 ||
      rowCount === 0 ||
      colCount === 0
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewportSize.width * dpr);
    canvas.height = Math.round(viewportSize.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, viewportSize.width, viewportSize.height);
    context.fillStyle = "#F7F2EA";
    context.fillRect(0, 0, viewportSize.width, viewportSize.height);

    const cellSize = BASE_CELL_SIZE * scale;
    const startCol = clamp(
      Math.floor((0 - position.x) / cellSize),
      0,
      Math.max(0, colCount - 1)
    );
    const endCol = clamp(
      Math.ceil((viewportSize.width - position.x) / cellSize),
      1,
      colCount
    );
    const startRow = clamp(
      Math.floor((0 - position.y) / cellSize),
      0,
      Math.max(0, rowCount - 1)
    );
    const endRow = clamp(
      Math.ceil((viewportSize.height - position.y) / cellSize),
      1,
      rowCount
    );
    const showLabels = showColorNumbers && cellSize >= MIN_LABEL_CELL_SIZE;
    const showGridLines = cellSize >= 7;

    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        const colorIndex = grid[row][col];
        const color = colorIndex === null ? null : palette[colorIndex] ?? null;
        const x = position.x + col * cellSize;
        const y = position.y + row * cellSize;
        const isSelected =
          colorIndex !== null && selectedColorIndex === colorIndex;
        const isCompleted =
          colorIndex !== null && completedColorSet.has(colorIndex);
        const isOtherColor =
          selectedColorIndex !== null &&
          colorIndex !== null &&
          selectedColorIndex !== colorIndex;
        const backgroundColor = color?.hex ?? "#FFFFFF";

        context.fillStyle = backgroundColor;
        context.fillRect(x, y, cellSize, cellSize);

        if (hideCompleted && isCompleted) {
          context.fillStyle =
            selectedColorIndex === colorIndex
              ? "rgba(248,243,238,0.42)"
              : "rgba(248,243,238,0.82)";
          context.fillRect(x, y, cellSize, cellSize);
        }

        if (isOtherColor) {
          context.fillStyle = "rgba(255,255,255,0.68)";
          context.fillRect(x, y, cellSize, cellSize);
        }

        if (showGridLines) {
          context.strokeStyle =
            colorIndex === null
              ? "rgba(203, 213, 225, 0.9)"
              : "rgba(255,255,255,0.28)";
          context.lineWidth = 1;
          context.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
        }

        if (isSelected) {
          context.strokeStyle = "#B45309";
          context.lineWidth = Math.max(2, Math.floor(cellSize * 0.14));
          context.strokeRect(
            x + context.lineWidth / 2,
            y + context.lineWidth / 2,
            cellSize - context.lineWidth,
            cellSize - context.lineWidth
          );
        }

        if (isCompleted) {
          if (cellSize >= 12) {
            context.strokeStyle = "#16A34A";
            context.lineWidth = Math.max(2, Math.floor(cellSize * 0.12));
            context.beginPath();
            context.moveTo(x + cellSize * 0.26, y + cellSize * 0.56);
            context.lineTo(x + cellSize * 0.44, y + cellSize * 0.74);
            context.lineTo(x + cellSize * 0.74, y + cellSize * 0.3);
            context.stroke();
          } else {
            context.fillStyle = "#16A34A";
            context.beginPath();
            context.arc(
              x + cellSize * 0.5,
              y + cellSize * 0.5,
              Math.max(2, cellSize * 0.18),
              0,
              Math.PI * 2
            );
            context.fill();
          }
        }

        if (showLabels && color) {
          const label =
            getBrandCode(color, brand as ColorBrand) || color.id.toString();

          context.fillStyle = getTextColor(backgroundColor);
          context.font = `600 ${Math.max(8, Math.floor(cellSize * 0.32))}px system-ui, sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(label, x + cellSize / 2, y + cellSize / 2 + 0.5);
        }
      }
    }
  }, [
    brand,
    colCount,
    completedColorSet,
    grid,
    hideCompleted,
    palette,
    position.x,
    position.y,
    rowCount,
    scale,
    selectedColorIndex,
    showColorNumbers,
    viewportSize.height,
    viewportSize.width,
  ]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getLocalPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current.pointers.set(event.pointerId, point);

    if (gestureRef.current.pointers.size === 1) {
      gestureRef.current.primaryPointerId = event.pointerId;
      gestureRef.current.startPoint = point;
      gestureRef.current.startPosition = viewRef.current.position;
      gestureRef.current.moved = false;
      gestureRef.current.longPressTriggered = false;
      gestureRef.current.pinchStartDistance = 0;
      gestureRef.current.pinchStartWorldMid = null;
      gestureRef.current.pinchStartScale = viewRef.current.scale;

      cancelLongPress();
      const colorIndex = getColorIndexAtPoint(point);

      if (colorIndex !== null) {
        longPressTimerRef.current = window.setTimeout(() => {
          onToggleCompletedColor(colorIndex);
          gestureRef.current.longPressTriggered = true;
          longPressTimerRef.current = null;
        }, LONG_PRESS_MS);
      }

      return;
    }

    if (gestureRef.current.pointers.size === 2) {
      cancelLongPress();
      const [left, right] = Array.from(gestureRef.current.pointers.values());
      const midpoint = getMidpoint(left, right);

      gestureRef.current.primaryPointerId = null;
      gestureRef.current.startPoint = null;
      gestureRef.current.startPosition = null;
      gestureRef.current.pinchStartDistance = getDistance(left, right);
      gestureRef.current.pinchStartScale = viewRef.current.scale;
      gestureRef.current.pinchStartWorldMid = screenToWorld(
        midpoint,
        viewRef.current.scale,
        viewRef.current.position
      );
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!gestureRef.current.pointers.has(event.pointerId)) {
      return;
    }

    const point = getLocalPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    gestureRef.current.pointers.set(event.pointerId, point);

    if (gestureRef.current.pointers.size >= 2) {
      const [left, right] = Array.from(gestureRef.current.pointers.values());
      const midpoint = getMidpoint(left, right);
      const distance = getDistance(left, right);

      if (
        gestureRef.current.pinchStartDistance > 0 &&
        gestureRef.current.pinchStartWorldMid
      ) {
        const nextScale =
          gestureRef.current.pinchStartScale *
          (distance / gestureRef.current.pinchStartDistance);
        const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        const nextPosition = {
          x: midpoint.x - gestureRef.current.pinchStartWorldMid.x * clampedScale,
          y: midpoint.y - gestureRef.current.pinchStartWorldMid.y * clampedScale,
        };
        const constrained = constrainView(clampedScale, nextPosition);

        setScale(constrained.scale);
        setPosition(constrained.position);
      }

      return;
    }

    if (
      gestureRef.current.primaryPointerId !== event.pointerId ||
      !gestureRef.current.startPoint ||
      !gestureRef.current.startPosition
    ) {
      return;
    }

    const deltaX = point.x - gestureRef.current.startPoint.x;
    const deltaY = point.y - gestureRef.current.startPoint.y;

    if (
      !gestureRef.current.moved &&
      (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)
    ) {
      gestureRef.current.moved = true;
      cancelLongPress();
    }

    if (!gestureRef.current.moved) {
      return;
    }

    const constrained = constrainView(viewRef.current.scale, {
      x: gestureRef.current.startPosition.x + deltaX,
      y: gestureRef.current.startPosition.y + deltaY,
    });

    setPosition(constrained.position);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point =
      gestureRef.current.pointers.get(event.pointerId) ??
      getLocalPoint(event.clientX, event.clientY);
    const wasSinglePointer = gestureRef.current.pointers.size === 1;
    const wasPrimary = gestureRef.current.primaryPointerId === event.pointerId;
    const wasMoved = gestureRef.current.moved;
    const wasLongPressTriggered = gestureRef.current.longPressTriggered;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    gestureRef.current.pointers.delete(event.pointerId);

    if (wasPrimary) {
      cancelLongPress();
    }

    if (
      wasSinglePointer &&
      wasPrimary &&
      point &&
      !wasMoved &&
      !wasLongPressTriggered
    ) {
      const colorIndex = getColorIndexAtPoint(point);
      onSelectedColorIndexChange(
        selectedColorIndex === colorIndex ? null : colorIndex
      );
    }

    if (gestureRef.current.pointers.size === 1) {
      const [remainingPointerId, remainingPoint] = Array.from(
        gestureRef.current.pointers.entries()
      )[0];
      gestureRef.current.primaryPointerId = remainingPointerId;
      gestureRef.current.startPoint = remainingPoint;
      gestureRef.current.startPosition = viewRef.current.position;
      gestureRef.current.moved = true;
      gestureRef.current.longPressTriggered = false;
      gestureRef.current.pinchStartDistance = 0;
      gestureRef.current.pinchStartWorldMid = null;
      return;
    }

    gestureRef.current.primaryPointerId = null;
    gestureRef.current.startPoint = null;
    gestureRef.current.startPosition = null;
    gestureRef.current.moved = false;
    gestureRef.current.longPressTriggered = false;
    gestureRef.current.pinchStartDistance = 0;
    gestureRef.current.pinchStartWorldMid = null;
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const point = getLocalPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    zoomAtPoint(point, viewRef.current.scale + (event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP));
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const point = getLocalPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    const colorIndex = getColorIndexAtPoint(point);

    if (colorIndex !== null) {
      onToggleCompletedColor(colorIndex);
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        touchAction: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
});
