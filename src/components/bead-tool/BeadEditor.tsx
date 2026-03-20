"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Move, ZoomIn, ZoomOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { countBeans, formatStatistics } from "@/lib/bead/beanStatistics";
import { getBrandCode, type ColorBrand, type PaletteColor } from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";

interface BeadEditorProps {
  grid: BeadGrid;
  palette: PaletteColor[];
  brand?: string;
  onSave?: () => void;
  showColorNumbers?: boolean;
}

interface Point {
  x: number;
  y: number;
}

function exportGridToCSV(
  grid: BeadGrid,
  palette: PaletteColor[],
  brand?: string
): string {
  let csv = "row,col,colorIndex,colorName,hex,brandCode,state\n";

  grid.forEach((row, y) => {
    row.forEach((colorIndex, x) => {
      if (colorIndex === null) {
        csv += `${y + 1},${x + 1},,,,,empty\n`;
        return;
      }

      const color = palette[colorIndex];
      const brandCode =
        brand && color?.brandCodes
          ? color.brandCodes[brand as ColorBrand] || ""
          : "";

      csv += `${y + 1},${x + 1},${colorIndex},${color?.id ?? ""},${color?.hex ?? ""},${brandCode},filled\n`;
    });
  });

  return csv;
}

const BASE_CELL_SIZE = 20;
const MIN_SCALE = 0.35;
const MAX_SCALE = 4.5;
const VIEW_PADDING = 24;
const LONG_PRESS_MS = 360;
const DRAG_THRESHOLD = 6;

function clamp(value: number, min: number, max: number): number {
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

export function BeadEditor({
  grid,
  palette,
  brand,
  onSave,
  showColorNumbers = false,
}: BeadEditorProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewInitializedRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
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

  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(
    null
  );
  const [completedColors, setCompletedColors] = useState<number[]>([]);

  const statistics = useMemo(() => countBeans(grid, palette), [grid, palette]);
  const completedColorSet = useMemo(
    () => new Set(completedColors),
    [completedColors]
  );
  const totalColors = statistics.colorStats.length;
  const completedCount = completedColors.length;
  const progressPercentage =
    totalColors > 0 ? (completedCount / totalColors) * 100 : 0;
  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;
  const patternWidth = colCount * BASE_CELL_SIZE;
  const patternHeight = rowCount * BASE_CELL_SIZE;

  useEffect(() => {
    viewRef.current = {
      scale,
      position,
    };
  }, [position, scale]);

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

  const screenToWorld = (point: Point, nextScale = scale, nextPosition = position) => ({
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

  const toggleCompletedColor = (colorIndex: number | null) => {
    if (colorIndex === null) {
      return;
    }

    setCompletedColors((previous) =>
      previous.includes(colorIndex)
        ? previous.filter((item) => item !== colorIndex)
        : [...previous, colorIndex]
    );
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
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewportSize.width * dpr);
    canvas.height = Math.round(viewportSize.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);
    ctx.fillStyle = "#F8F3EE";
    ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);

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
    const showLabels = showColorNumbers && cellSize >= 18;
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

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(x, y, cellSize, cellSize);

        if (isOtherColor) {
          ctx.fillStyle = "rgba(255,255,255,0.62)";
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        if (showGridLines) {
          ctx.strokeStyle =
            colorIndex === null ? "rgba(203, 213, 225, 0.9)" : "rgba(255,255,255,0.32)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
        }

        if (isSelected) {
          ctx.strokeStyle = "#8B5CF6";
          ctx.lineWidth = Math.max(2, Math.floor(cellSize * 0.14));
          ctx.strokeRect(
            x + ctx.lineWidth / 2,
            y + ctx.lineWidth / 2,
            cellSize - ctx.lineWidth,
            cellSize - ctx.lineWidth
          );
        }

        if (isCompleted) {
          if (cellSize >= 12) {
            ctx.strokeStyle = "#16A34A";
            ctx.lineWidth = Math.max(2, Math.floor(cellSize * 0.12));
            ctx.beginPath();
            ctx.moveTo(x + cellSize * 0.26, y + cellSize * 0.56);
            ctx.lineTo(x + cellSize * 0.44, y + cellSize * 0.74);
            ctx.lineTo(x + cellSize * 0.74, y + cellSize * 0.3);
            ctx.stroke();
          } else {
            ctx.fillStyle = "#16A34A";
            ctx.beginPath();
            ctx.arc(
              x + cellSize * 0.5,
              y + cellSize * 0.5,
              Math.max(2, cellSize * 0.18),
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }

        if (showLabels && color) {
          const label =
            (brand ? getBrandCode(color, brand as ColorBrand) : undefined) ||
            color.id.toString();

          ctx.fillStyle = getTextColor(backgroundColor);
          ctx.font = `600 ${Math.max(8, Math.floor(cellSize * 0.32))}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, x + cellSize / 2, y + cellSize / 2 + 0.5);
        }
      }
    }
  }, [
    brand,
    colCount,
    completedColorSet,
    grid,
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
          toggleCompletedColor(colorIndex);
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
      setSelectedColorIndex((previous) =>
        previous === colorIndex ? null : colorIndex
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

    const nextScale =
      viewRef.current.scale + (event.deltaY > 0 ? -0.12 : 0.12);
    zoomAtPoint(point, nextScale);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const point = getLocalPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    toggleCompletedColor(getColorIndexAtPoint(point));
  };

  const handleResetView = () => {
    fitView();
  };

  const handleExportCSV = () => {
    const csv = exportGridToCSV(grid, palette, brand);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bead-pattern-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedColorStat =
    selectedColorIndex !== null
      ? statistics.colorStats.find(
          (item) => item.colorIndex === selectedColorIndex
        )
      : null;

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() =>
              zoomAtPoint(
                {
                  x: viewportSize.width / 2,
                  y: viewportSize.height / 2,
                },
                viewRef.current.scale - 0.12
              )
            }
            disabled={scale <= MIN_SCALE}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="order-last w-full text-left text-xs text-slate-600 sm:order-none sm:w-16 sm:text-center">
            {(scale * 100).toFixed(0)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() =>
              zoomAtPoint(
                {
                  x: viewportSize.width / 2,
                  y: viewportSize.height / 2,
                },
                viewRef.current.scale + 0.12
              )
            }
            disabled={scale >= MAX_SCALE}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleResetView}
          >
            <Move className="w-4 h-4" />
            <span className="ml-1 text-xs">重置</span>
          </Button>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleExportCSV}
          >
            <Download className="w-4 h-4" />
            <span className="ml-1 text-xs">导出 CSV</span>
          </Button>
          {onSave ? (
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={onSave}
            >
              保存
            </Button>
          ) : null}
        </div>
      </div>

      <div className="bg-gradient-to-br from-cream-50 to-white rounded-2xl border border-cream-100 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-700 font-medium">制作进度</span>
          <span className="text-slate-600">
            {completedCount} / {totalColors} 种颜色 ({progressPercentage.toFixed(1)}
            %)
          </span>
        </div>
        <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500">
          点击格子高亮颜色，拖动画布平移，双指缩放，长按或右键可标记该颜色已完成。
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative h-[56vh] min-h-[320px] max-h-[820px] overflow-hidden rounded-3xl border border-cream-100 bg-cream-50/60 sm:h-[64vh] lg:h-[72vh]"
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

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-900">颜色清单</h3>
          {selectedColorStat ? (
            <div className="text-xs text-slate-600">
              当前选中 #{selectedColorStat.color.id.toString().padStart(2, "0")} ·{" "}
              {selectedColorStat.count} 颗 · {selectedColorStat.percentage.toFixed(1)}
              %
            </div>
          ) : null}
        </div>

        <div className="grid max-h-64 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {statistics.colorStats.map((stat) => {
            const isCompleted = completedColors.includes(stat.colorIndex);
            const isSelected = selectedColorIndex === stat.colorIndex;
            const brandCode =
              brand && stat.color.brandCodes
                ? stat.color.brandCodes[brand as ColorBrand]
                : undefined;

            return (
              <button
                key={stat.colorIndex}
                onClick={() =>
                  setSelectedColorIndex((previous) =>
                    previous === stat.colorIndex ? null : stat.colorIndex
                  )
                }
                onContextMenu={(event) => {
                  event.preventDefault();
                  toggleCompletedColor(stat.colorIndex);
                }}
                className={`flex min-w-0 items-center gap-2 rounded-2xl border p-2 transition-all ${
                  isSelected
                    ? "border-accent-brown bg-accent-brown/10 ring-2 ring-accent-brown/30"
                    : "border-cream-100 bg-white/70"
                } ${isCompleted ? "opacity-60" : "hover:shadow-md"}`}
              >
                <span
                  className="w-6 h-6 rounded-full border border-cream-100 flex-shrink-0"
                  style={{ backgroundColor: stat.color.hex }}
                />
                <div className="flex-grow text-left">
                  <p className="text-xs font-medium text-slate-700">
                    #{stat.color.id.toString().padStart(2, "0")}
                    {brandCode ? (
                      <span className="text-slate-500 ml-1">· {brandCode}</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {stat.count} 颗 ({stat.percentage.toFixed(1)}%)
                    {isCompleted ? (
                      <span className="text-green-600 ml-1">已完成</span>
                    ) : null}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-br from-cream-50 to-white rounded-3xl border border-cream-100 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">完整统计报告</h3>
        <pre className="text-[10px] text-slate-600 whitespace-pre-wrap bg-white/60 rounded-2xl p-3 max-h-48 overflow-auto">
          {formatStatistics(statistics, brand as ColorBrand | undefined)}
        </pre>
      </div>
    </Card>
  );
}
