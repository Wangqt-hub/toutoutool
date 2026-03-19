"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Download, Move, ZoomIn, ZoomOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { countBeans, formatStatistics } from "@/lib/bead/beanStatistics";
import { type ColorBrand, type PaletteColor } from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";

interface BeadEditorProps {
  grid: BeadGrid;
  palette: PaletteColor[];
  brand?: string;
  onSave?: () => void;
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

export function BeadEditor({ grid, palette, brand, onSave }: BeadEditorProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(
    null
  );
  const [completedColors, setCompletedColors] = useState<number[]>([]);

  const statistics = countBeans(grid, palette);
  const totalColors = statistics.colorStats.length;
  const completedCount = completedColors.length;
  const progressPercentage =
    totalColors > 0 ? (completedCount / totalColors) * 100 : 0;

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      setIsDragging(true);
      dragStart.current = {
        x: event.clientX - position.x,
        y: event.clientY - position.y,
      };
    },
    [position.x, position.y]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDragging || !dragStart.current) {
        return;
      }

      setPosition({
        x: event.clientX - dragStart.current.x,
        y: event.clientY - dragStart.current.y,
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setScale((previous) => Math.min(Math.max(previous + delta, 0.5), 4));
  }, []);

  const handleCellClick = (colorIndex: number | null) => {
    if (colorIndex === null) {
      setSelectedColorIndex(null);
      return;
    }

    setSelectedColorIndex((previous) =>
      previous === colorIndex ? null : colorIndex
    );
  };

  const handleCellLongPress = (colorIndex: number | null) => {
    if (colorIndex === null) {
      return;
    }

    setCompletedColors((previous) =>
      previous.includes(colorIndex)
        ? previous.filter((item) => item !== colorIndex)
        : [...previous, colorIndex]
    );
  };

  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((previous) => Math.max(previous - 0.1, 0.5))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-600 w-16 text-center">
            {(scale * 100).toFixed(0)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((previous) => Math.min(previous + 0.1, 4))}
            disabled={scale >= 4}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleResetView}>
            <Move className="w-4 h-4" />
            <span className="ml-1 text-xs">重置</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            <span className="ml-1 text-xs">导出 CSV</span>
          </Button>
          {onSave ? (
            <Button variant="primary" size="sm" onClick={onSave}>
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
          点击格子高亮颜色，右键标记该颜色已完成。白色格子表示无豆格。
        </p>
      </div>

      <div
        className="relative overflow-auto rounded-3xl border border-cream-100 bg-cream-50/60 p-4 cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="inline-grid gap-px bg-white shadow-lg"
          style={{
            gridTemplateColumns: `repeat(${grid[0]?.length ?? 0}, minmax(0, 1fr))`,
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "top left",
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
        >
          {grid.flatMap((row, y) =>
            row.map((colorIndex, x) => {
              const color =
                colorIndex === null ? null : palette[colorIndex] ?? null;
              const isSelected =
                colorIndex !== null && selectedColorIndex === colorIndex;
              const isCompleted =
                colorIndex !== null && completedColors.includes(colorIndex);
              const isOtherColor =
                selectedColorIndex !== null &&
                colorIndex !== null &&
                selectedColorIndex !== colorIndex;

              return (
                <div
                  key={`${x}-${y}`}
                  className={`relative group transition-all duration-150 ${
                    colorIndex === null ? "cursor-default" : "cursor-pointer"
                  } ${isOtherColor ? "opacity-30 grayscale" : "opacity-100"} ${
                    isCompleted ? "ring-2 ring-green-400 ring-inset" : ""
                  }`}
                  style={{
                    width: "20px",
                    height: "20px",
                    minWidth: "20px",
                    minHeight: "20px",
                    backgroundColor: color?.hex ?? "#FFFFFF",
                    border:
                      colorIndex === null ? "1px solid rgba(203, 213, 225, 0.75)" : undefined,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCellClick(colorIndex);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    handleCellLongPress(colorIndex);
                  }}
                  title={
                    colorIndex === null
                      ? "无豆格"
                      : `色号：${color?.id ?? ""} ${
                          brand && color?.brandCodes
                            ? color.brandCodes[brand as ColorBrand] || ""
                            : ""
                        }`
                  }
                >
                  {isCompleted ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Check className="w-3 h-3 text-white drop-shadow-md" />
                    </div>
                  ) : null}
                  {color ? (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {color.id}
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-900">颜色清单</h3>
          {selectedColorStat ? (
            <div className="text-xs text-slate-600">
              当前选中 #{selectedColorStat.color.id.toString().padStart(2, "0")} ·{" "}
              {selectedColorStat.count} 颗 ·{" "}
              {selectedColorStat.percentage.toFixed(1)}%
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-auto">
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
                onClick={() => handleCellClick(stat.colorIndex)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  handleCellLongPress(stat.colorIndex);
                }}
                className={`flex items-center gap-2 p-2 rounded-2xl border transition-all ${
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
