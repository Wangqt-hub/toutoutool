"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Edit3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { countBeans } from "@/lib/bead/beanStatistics";
import { toBeadGrid, type ImportedPatternCell } from "@/lib/bead/patternImport";
import type { ColorBrand, PaletteColor } from "@/lib/bead/palette";

interface PatternImportPreviewProps {
  cells: ImportedPatternCell[][] | null;
  palette: PaletteColor[] | null;
  brand: ColorBrand;
  unresolvedCount: number;
  onOpenCorrection: () => void;
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

function getPreviewCellSize(maxDimension: number): number {
  if (maxDimension <= 20) return 28;
  if (maxDimension <= 36) return 22;
  if (maxDimension <= 56) return 16;
  if (maxDimension <= 84) return 12;
  if (maxDimension <= 120) return 9;
  return 7;
}

export function PatternImportPreview({
  cells,
  palette,
  brand,
  unresolvedCount,
  onOpenCorrection,
}: PatternImportPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statistics =
    cells && palette ? countBeans(toBeadGrid(cells), palette) : null;
  const previewMetrics = useMemo(() => {
    if (!cells || cells.length === 0 || cells[0]?.length === 0) {
      return null;
    }

    const rows = cells.length;
    const cols = cells[0].length;
    const cellSize = getPreviewCellSize(Math.max(rows, cols));
    const padding = Math.max(10, Math.round(cellSize * 0.75));

    return {
      rows,
      cols,
      cellSize,
      padding,
      width: cols * cellSize + padding * 2,
      height: rows * cellSize + padding * 2,
    };
  }, [cells]);

  useEffect(() => {
    if (!cells || !palette || !canvasRef.current || !previewMetrics) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(previewMetrics.width * dpr);
    canvas.height = Math.round(previewMetrics.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, previewMetrics.width, previewMetrics.height);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, previewMetrics.width, previewMetrics.height);

    const showLabels = previewMetrics.cellSize >= 16;
    const gridLeft = previewMetrics.padding;
    const gridTop = previewMetrics.padding;

    for (let row = 0; row < previewMetrics.rows; row += 1) {
      for (let col = 0; col < previewMetrics.cols; col += 1) {
        const cell = cells[row][col];
        const paletteColor =
          cell.paletteIndex === null ? null : palette[cell.paletteIndex] ?? null;
        const backgroundColor =
          cell.state === "unresolved"
            ? "#FCA5A5"
            : paletteColor?.hex ?? "#FFFFFF";
        const x = gridLeft + col * previewMetrics.cellSize;
        const y = gridTop + row * previewMetrics.cellSize;

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(x, y, previewMetrics.cellSize, previewMetrics.cellSize);

        if (showLabels && cell.state === "filled") {
          const label = cell.matchedCode || cell.code || "";

          if (label) {
            ctx.fillStyle = getTextColor(backgroundColor);
            ctx.font = `600 ${Math.max(
              8,
              Math.floor(previewMetrics.cellSize * 0.34)
            )}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              label,
              x + previewMetrics.cellSize / 2,
              y + previewMetrics.cellSize / 2 + 0.5
            );
          }
        }
      }
    }

    if (previewMetrics.cellSize >= 8) {
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let col = 0; col <= previewMetrics.cols; col += 1) {
        const x = gridLeft + col * previewMetrics.cellSize + 0.5;
        ctx.moveTo(x, gridTop);
        ctx.lineTo(x, gridTop + previewMetrics.rows * previewMetrics.cellSize);
      }

      for (let row = 0; row <= previewMetrics.rows; row += 1) {
        const y = gridTop + row * previewMetrics.cellSize + 0.5;
        ctx.moveTo(gridLeft, y);
        ctx.lineTo(gridLeft + previewMetrics.cols * previewMetrics.cellSize, y);
      }

      ctx.stroke();
    }

    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      gridLeft - 1,
      gridTop - 1,
      previewMetrics.cols * previewMetrics.cellSize + 2,
      previewMetrics.rows * previewMetrics.cellSize + 2
    );
  }, [cells, palette, previewMetrics]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">导入结果预览</h2>
          <p className="text-xs text-slate-500">
            白色为空格无豆，红色为待修正格。当前品牌：{brand}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenCorrection}
            disabled={!cells}
            className="w-full sm:w-auto"
          >
            <Edit3 className="w-4 h-4 mr-1" />
            手动编辑图纸
          </Button>
        </div>
      </div>

      {!cells || !palette || !previewMetrics ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-cream-100 bg-cream-50/60 text-xs text-slate-500 text-center px-4">
          裁切并识别后，这里会显示导入结果。
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>
              网格：{cells[0]?.length ?? 0} × {cells.length}
            </span>
            <span>·</span>
            <span>已识别豆子：{statistics?.totalBeans ?? 0}</span>
            <span>·</span>
            <span>失败格：{unresolvedCount}</span>
          </div>

          {unresolvedCount > 0 ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                还有 {unresolvedCount} 个 OCR 失败格未修正，不能直接进入后续拼豆编辑器。
              </span>
            </div>
          ) : null}

          <div className="overflow-auto rounded-3xl border border-cream-100 bg-cream-50/60 p-3">
            <div className="rounded-2xl bg-white p-3">
              <canvas
                ref={canvasRef}
                className="block h-auto [image-rendering:auto]"
                style={{
                  width: `${previewMetrics.width}px`,
                  maxWidth: "100%",
                }}
              />
            </div>
          </div>

          {statistics ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-auto">
              {statistics.colorStats.map((stat) => {
                const brandCode = stat.color.brandCodes?.[brand] || stat.color.id;

                return (
                  <div
                    key={stat.colorIndex}
                    className="rounded-2xl border border-cream-100 bg-white/80 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-6 w-6 rounded-lg border border-cream-100"
                        style={{ backgroundColor: stat.color.hex }}
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {brandCode}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase">
                          {stat.color.hex}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {stat.count} 颗 · {stat.percentage.toFixed(1)}%
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
