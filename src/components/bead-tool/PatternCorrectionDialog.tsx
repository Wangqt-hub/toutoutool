"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColorBrand, PaletteColor } from "@/lib/bead/palette";
import type { GridGeometry, ImportedPatternCell } from "@/lib/bead/patternImport";

interface PatternCorrectionDialogProps {
  open: boolean;
  imageUrl: string;
  geometry: GridGeometry | null;
  cells: ImportedPatternCell[][] | null;
  palette: PaletteColor[] | null;
  brand: ColorBrand;
  onClose: () => void;
  onApplyCode: (row: number, col: number, code: string) => string | null;
  onMarkEmpty: (row: number, col: number) => void;
}

function getCellStyle(geometry: GridGeometry, row: number, col: number) {
  const left = geometry.verticalLines[col];
  const right = geometry.verticalLines[col + 1];
  const top = geometry.horizontalLines[row];
  const bottom = geometry.horizontalLines[row + 1];

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

export function PatternCorrectionDialog({
  open,
  imageUrl,
  geometry,
  cells,
  palette,
  brand,
  onClose,
  onApplyCode,
  onMarkEmpty,
}: PatternCorrectionDialogProps) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(
    null
  );
  const [draftCode, setDraftCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showOnlyFailures, setShowOnlyFailures] = useState(false);
  const [renderedWidth, setRenderedWidth] = useState(0);
  const [renderedHeight, setRenderedHeight] = useState(0);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);

  const failureCells = useMemo(
    () =>
      cells?.flat().filter((cell) => cell.state === "unresolved") ?? [],
    [cells]
  );

  useEffect(() => {
    if (!open || !cells) {
      return;
    }

    const firstFailure = cells.flat().find((cell) => cell.state === "unresolved");
    const fallback = cells[0]?.[0];
    const initial = firstFailure ?? fallback;

    if (initial) {
      setSelected({ row: initial.row, col: initial.col });
      setDraftCode(initial.code ?? "");
      setError(null);
    }
  }, [cells, open]);

  if (!open || !geometry || !cells || !palette) {
    return null;
  }

  const selectedCell =
    selected === null ? null : cells[selected.row]?.[selected.col] ?? null;

  const handleSelect = (row: number, col: number) => {
    const cell = cells[row][col];
    setSelected({ row, col });
    setDraftCode(cell.code ?? cell.matchedCode ?? "");
    setError(null);
  };

  const handleApply = () => {
    if (!selected) {
      return;
    }

    const message = onApplyCode(selected.row, selected.col, draftCode);
    if (message) {
      setError(message);
      return;
    }

    setError(null);
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    setRenderedWidth(image.clientWidth);
    setRenderedHeight(image.clientHeight);
    setNaturalWidth(image.naturalWidth);
    setNaturalHeight(image.naturalHeight);
  };

  const scaleX = naturalWidth > 0 ? renderedWidth / naturalWidth : 1;
  const scaleY = naturalHeight > 0 ? renderedHeight / naturalHeight : 1;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm p-4">
      <div className="mx-auto h-full max-w-7xl rounded-[28px] bg-white shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">OCR 失败格校对</h2>
            <p className="text-xs text-slate-500">
              点击图上的格子后，在右侧输入 {brand} 品牌色号。支持宽松匹配，例如
              `A4 → A04`、`B03 → B3`。
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-auto bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="text-xs text-slate-500">
                总失败格 {failureCells.length} 个。红框表示待处理格子。
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowOnlyFailures((previous) => !previous)}
              >
                {showOnlyFailures ? (
                  <EyeOff className="w-4 h-4 mr-1" />
                ) : (
                  <Eye className="w-4 h-4 mr-1" />
                )}
                {showOnlyFailures ? "显示全部格子" : "仅显示失败格"}
              </Button>
            </div>

            <div className="relative inline-block rounded-3xl overflow-hidden border border-slate-200 bg-white">
              <img
                src={imageUrl}
                alt="裁切后的图纸"
                className="block max-w-full h-auto"
                onLoad={handleImageLoad}
              />

              <div className="absolute inset-0">
                {cells.flatMap((row) =>
                  row.map((cell) => {
                    const cellStyle = getCellStyle(geometry, cell.row, cell.col);
                    const isSelected =
                      selected?.row === cell.row && selected?.col === cell.col;
                    const isFailure = cell.state === "unresolved";
                    const isFilteredOut = showOnlyFailures && !isFailure;

                    return (
                      <button
                        key={`${cell.row}-${cell.col}`}
                        type="button"
                        className={`absolute transition-all ${
                          isFilteredOut ? "opacity-10 pointer-events-none" : ""
                        } ${
                          isSelected
                            ? "ring-2 ring-amber-400 ring-inset bg-amber-300/10"
                            : isFailure
                              ? "bg-red-500/12 ring-1 ring-red-400/80 ring-inset"
                              : "hover:bg-slate-900/5"
                        }`}
                        style={{
                          left: cellStyle.left * scaleX,
                          top: cellStyle.top * scaleY,
                          width: cellStyle.width * scaleX,
                          height: cellStyle.height * scaleY,
                        }}
                        onClick={() => handleSelect(cell.row, cell.col)}
                        title={`${cell.row + 1} 行 ${cell.col + 1} 列`}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="border-l border-slate-100 p-5 space-y-4 overflow-auto">
            {selectedCell ? (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    第 {selectedCell.row + 1} 行 / 第 {selectedCell.col + 1} 列
                  </p>
                  <h3 className="text-base font-semibold text-slate-900">
                    {selectedCell.state === "unresolved"
                      ? "待修正格子"
                      : selectedCell.state === "empty"
                        ? "无豆格"
                        : "已识别格子"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    当前 OCR 结果：
                    {selectedCell.code ? (
                      <span className="font-medium text-slate-700">
                        {selectedCell.code}
                      </span>
                    ) : (
                      <span>无</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    当前匹配结果：
                    {selectedCell.matchedCode ? (
                      <span className="font-medium text-slate-700">
                        {selectedCell.matchedCode}
                      </span>
                    ) : (
                      <span>未匹配</span>
                    )}
                  </p>
                </div>

                {selectedCell.state === "unresolved" ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      这个格子还没有修正完成。修正前不能进入后续拼豆编辑器。
                    </span>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">
                    输入 {brand} 色号
                  </label>
                  <input
                    value={draftCode}
                    onChange={(event) => setDraftCode(event.target.value)}
                    className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
                    placeholder="例如 H6、A4、B03"
                  />
                  <p className="text-[11px] text-slate-500">
                    会自动按所选品牌做宽松匹配和校验。
                  </p>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleApply}>
                    应用色号
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!selected) {
                        return;
                      }

                      onMarkEmpty(selected.row, selected.col);
                      setError(null);
                    }}
                  >
                    标记为空格
                  </Button>
                </div>

                {failureCells.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-700">
                      失败格快速跳转
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {failureCells.map((cell) => (
                        <button
                          key={`${cell.row}-${cell.col}`}
                          type="button"
                          className={`rounded-xl border px-2 py-2 text-[11px] ${
                            selected?.row === cell.row && selected?.col === cell.col
                              ? "border-red-400 bg-red-50 text-red-600"
                              : "border-cream-100 bg-white text-slate-600"
                          }`}
                          onClick={() => handleSelect(cell.row, cell.col)}
                        >
                          {cell.row + 1}-{cell.col + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-slate-500">请选择一个格子开始修正。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
