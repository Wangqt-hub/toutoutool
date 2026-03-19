"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { countBeans } from "@/lib/bead/beanStatistics";
import { getBrandCode, type ColorBrand, type PaletteColor } from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";
import {
  downloadCanvasAsPng,
  renderPatternPreview,
} from "@/lib/bead/patternPreview";

interface PatternPreviewPanelProps {
  grid: BeadGrid | null;
  palette: PaletteColor[] | null;
  brand: ColorBrand;
  showColorNumbers: boolean;
  onShowColorNumbersChange: (show: boolean) => void;
  emptyState: ReactNode;
  footer?: ReactNode;
  fileNameBase?: string;
}

function getColorLabel(colorId: number): string {
  return `#${String(colorId).padStart(2, "0")}`;
}

export function PatternPreviewPanel({
  grid,
  palette,
  brand,
  showColorNumbers,
  onShowColorNumbersChange,
  emptyState,
  footer,
  fileNameBase = "bead-pattern",
}: PatternPreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statistics = useMemo(() => {
    if (!grid || !palette) {
      return null;
    }

    return countBeans(grid, palette);
  }, [grid, palette]);

  useEffect(() => {
    if (!grid || !palette || !canvasRef.current) {
      return;
    }

    renderPatternPreview(canvasRef.current, {
      grid,
      palette,
      brand,
      showColorNumbers,
    });
  }, [brand, grid, palette, showColorNumbers]);

  const handleDownload = () => {
    if (!grid || !palette || !canvasRef.current) {
      return;
    }

    renderPatternPreview(canvasRef.current, {
      grid,
      palette,
      brand,
      showColorNumbers,
    });

    downloadCanvasAsPng(
      canvasRef.current,
      `${fileNameBase}-${Date.now()}.png`
    );
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900">拼豆图纸预览</h2>
          <p className="text-xs text-slate-500">每个小方块代表一颗拼豆</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-700 flex items-center gap-1">
            <input
              type="checkbox"
              checked={showColorNumbers}
              onChange={(event) => onShowColorNumbersChange(event.target.checked)}
              className="rounded border-cream-100 text-accent-brown focus:ring-accent-brown"
            />
            显示色号
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={!grid || !palette}
          >
            <Download className="w-4 h-4 mr-1" />
            保存 PNG
          </Button>
        </div>
      </div>

      {!grid || !palette ? (
        emptyState
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl border border-cream-100 bg-cream-50/60 p-3">
            <div className="rounded-2xl bg-white p-3">
              <canvas
                ref={canvasRef}
                className="block w-full h-auto max-h-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>网格：{grid[0].length} × {grid.length}</span>
            <span>·</span>
            <span>颜色数：{statistics?.colorStats.length ?? 0}</span>
            <span>·</span>
            <span>品牌：{brand}</span>
            <span>·</span>
            <span>总用量：{statistics?.totalBeans ?? 0}</span>
          </div>

          {statistics && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-slate-900">色号统计</h3>
                <span className="text-xs text-slate-500">
                  共 {statistics.colorStats.length} 种颜色
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {statistics.colorStats.map((stat) => {
                    const brandCode =
                      getBrandCode(stat.color, brand) || getColorLabel(stat.color.id);

                    return (
                      <div
                        key={stat.colorIndex}
                        className="min-h-[78px] rounded-2xl border border-cream-100 bg-white/80 px-3 py-2 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-8 w-8 rounded-xl border border-cream-100 flex-shrink-0"
                            style={{ backgroundColor: stat.color.hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {brandCode}
                            </p>
                            <p className="truncate text-[11px] text-slate-500 uppercase">
                              {stat.color.hex}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{stat.count} 颗</span>
                          <span>{stat.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {footer}
        </div>
      )}
    </Card>
  );
}
