"use client";

import { AlertTriangle, Edit3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { countBeans } from "@/lib/bead/beanStatistics";
import { toBeadGrid } from "@/lib/bead/patternImport";
import type { ImportedPatternCell } from "@/lib/bead/patternImport";
import type { ColorBrand, PaletteColor } from "@/lib/bead/palette";

interface PatternImportPreviewProps {
  cells: ImportedPatternCell[][] | null;
  palette: PaletteColor[] | null;
  brand: ColorBrand;
  unresolvedCount: number;
  onOpenCorrection: () => void;
  onEnterBeadMode: () => void;
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

export function PatternImportPreview({
  cells,
  palette,
  brand,
  unresolvedCount,
  onOpenCorrection,
  onEnterBeadMode,
}: PatternImportPreviewProps) {
  const statistics =
    cells && palette ? countBeans(toBeadGrid(cells), palette) : null;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900">导入结果预览</h2>
          <p className="text-xs text-slate-500">
            白色为空格无豆，红色为待修正格。当前品牌：{brand}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenCorrection}
            disabled={!cells}
          >
            <Edit3 className="w-4 h-4 mr-1" />
            手动编辑图纸
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onEnterBeadMode}
            disabled={!cells || unresolvedCount > 0}
          >
            进入拼豆编辑器
          </Button>
        </div>
      </div>

      {!cells || !palette ? (
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
            <div
              className="inline-grid gap-px bg-slate-200"
              style={{
                gridTemplateColumns: `repeat(${cells[0]?.length ?? 0}, minmax(0, 1fr))`,
              }}
            >
              {cells.flatMap((row, y) =>
                row.map((cell, x) => {
                  const color =
                    cell.paletteIndex === null
                      ? null
                      : (palette[cell.paletteIndex] ?? null);
                  const backgroundColor =
                    cell.state === "unresolved"
                      ? "#FCA5A5"
                      : color?.hex ?? "#FFFFFF";
                  const label =
                    cell.state === "filled"
                      ? cell.matchedCode || cell.code || ""
                      : "";

                  return (
                    <div
                      key={`${x}-${y}`}
                      className="flex items-center justify-center text-[10px] font-medium"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor,
                        color: getTextColor(backgroundColor),
                      }}
                      title={`${y + 1} 行 ${x + 1} 列`}
                    >
                      {label}
                    </div>
                  );
                })
              )}
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
