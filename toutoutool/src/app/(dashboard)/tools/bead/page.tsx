"use client";

import { useCallback, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PaletteColor = {
  id: number;
  hex: string;
};

type BeadParams = {
  gridSize: number;
  colorCount: number;
};

type BeadResult = {
  width: number;
  height: number;
  grid: number[][];
  palette: PaletteColor[];
};

const DEFAULT_PARAMS: BeadParams = {
  gridSize: 32,
  colorCount: 16
};

const BASE_PALETTE: string[] = [
  "#FFFFFF",
  "#000000",
  "#FFCDD2",
  "#F8BBD0",
  "#E1BEE7",
  "#D1C4E9",
  "#C5CAE9",
  "#BBDEFB",
  "#B3E5FC",
  "#B2EBF2",
  "#B2DFDB",
  "#C8E6C9",
  "#DCEDC8",
  "#FFF9C4",
  "#FFE0B2",
  "#FFCCBC",
  "#D7CCC8",
  "#CFD8DC"
];

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const num = parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function distanceSq(a: { r: number; g: number; b: number }, b: {
  r: number;
  g: number;
  b: number;
}) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function quantizeToPalette(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  colorCount: number
): BeadResult {
  const paletteHex = BASE_PALETTE.slice(0, colorCount);
  const palette = paletteHex.map((hex, index) => ({
    id: index,
    hex
  }));
  const paletteRgb = paletteHex.map(hexToRgb);

  const grid: number[][] = [];

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const pixel = { r, g, b };
      let bestIndex = 0;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let i = 0; i < paletteRgb.length; i++) {
        const d = distanceSq(pixel, paletteRgb[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }

      row.push(bestIndex);
    }
    grid.push(row);
  }

  return {
    width,
    height,
    grid,
    palette
  };
}

export default function BeadToolPage() {
  const [params, setParams] = useState<BeadParams>(DEFAULT_PARAMS);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [result, setResult] = useState<BeadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setResult(null);

      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("请上传图片文件（JPG / PNG 等）。");
        return;
      }

      const url = URL.createObjectURL(file);
      setSourceUrl(url);
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (!sourceUrl) {
      setError("请先上传一张图片。");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setError(null);

    try {
      const img = new Image();
      img.src = sourceUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片加载失败"));
      });

      const gridSize = params.gridSize;
      canvas.width = gridSize;
      canvas.height = gridSize;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("浏览器暂不支持 Canvas。");
      }

      ctx.clearRect(0, 0, gridSize, gridSize);
      ctx.drawImage(img, 0, 0, gridSize, gridSize);

      const imageData = ctx.getImageData(0, 0, gridSize, gridSize);
      const quantized = quantizeToPalette(
        imageData.data,
        gridSize,
        gridSize,
        params.colorCount
      );

      setResult(quantized);

      const exportCanvas = exportCanvasRef.current;
      if (exportCanvas) {
        const cellSize = 20;
        exportCanvas.width = quantized.width * cellSize;
        exportCanvas.height = quantized.height * cellSize;
        const exportCtx = exportCanvas.getContext("2d");
        if (exportCtx) {
          exportCtx.clearRect(
            0,
            0,
            exportCanvas.width,
            exportCanvas.height
          );
          for (let y = 0; y < quantized.height; y++) {
            for (let x = 0; x < quantized.width; x++) {
              const colorIndex = quantized.grid[y][x];
              exportCtx.fillStyle =
                quantized.palette[colorIndex]?.hex ?? "#FFFFFF";
              exportCtx.fillRect(
                x * cellSize,
                y * cellSize,
                cellSize,
                cellSize
              );
            }
          }
        }
      }
    } catch (err) {
      setError("生成拼豆图纸时出错，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }, [params.colorCount, params.gridSize, sourceUrl]);

  const handleDownload = useCallback(() => {
    if (!result || !exportCanvasRef.current) return;
    const dataUrl = exportCanvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "toutoutool-bead-pattern.png";
    link.click();
  }, [result]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">拼豆工具</h1>
        <p className="text-sm text-slate-600">
          上传一张喜欢的图片，选择网格大小和颜色数量，头头会帮你把它变成一张可爱的拼豆图纸。
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700">
              1. 上传图片
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-2xl file:border-0 file:bg-accent-brown file:px-4 file:py-2 file:text-xs file:font-medium file:text-cream-50 hover:file:bg-[#b0936d]"
            />
            <p className="text-[11px] text-slate-500">
              建议使用方形或接近方形的小图，长边不超过 1024 像素。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                2. 网格大小（边长像素）
              </label>
              <select
                value={params.gridSize}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    gridSize: Number(e.target.value)
                  }))
                }
                className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
              >
                <option value={16}>16 × 16（迷你）</option>
                <option value={24}>24 × 24</option>
                <option value={32}>32 × 32（推荐）</option>
                <option value={40}>40 × 40</option>
                <option value={48}>48 × 48（较大）</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                3. 颜色数量
              </label>
              <select
                value={params.colorCount}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    colorCount: Number(e.target.value)
                  }))
                }
                className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
              >
                <option value={8}>8 色（简单好配色）</option>
                <option value={12}>12 色</option>
                <option value={16}>16 色（推荐）</option>
                <option value={24}>24 色</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-2xl px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="button"
            size="lg"
            className="w-full mt-2"
            onClick={handleGenerate}
            disabled={loading || !sourceUrl}
          >
            {loading ? "生成中…" : "生成拼豆图纸"}
          </Button>

          {sourceUrl && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-slate-700">原图预览</p>
              <div className="rounded-3xl border border-cream-100 bg-cream-50/60 p-2 inline-flex">
                <img
                  src={sourceUrl}
                  alt="原始图片预览"
                  className="max-h-40 w-auto rounded-2xl object-contain"
                />
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="hidden"
            aria-hidden="true"
          />
          <canvas
            ref={exportCanvasRef}
            className="hidden"
            aria-hidden="true"
          />
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                拼豆图纸预览
              </h2>
              <p className="text-xs text-slate-500">
                每个小方块代表一颗拼豆，可以根据色卡配色进行实际制作。
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              disabled={!result}
            >
              下载 PNG
            </Button>
          </div>

          {!result && (
            <div className="flex h-48 items-center justify-center rounded-3xl border border-dashed border-cream-100 bg-cream-50/60 text-xs text-slate-500 text-center px-4">
              还没有生成图纸。先在左侧上传一张图片，并设置好网格和颜色数量，然后点击「生成拼豆图纸」吧。
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>
                  网格：{result.width} × {result.height}
                </span>
                <span>·</span>
                <span>颜色数：{result.palette.length}</span>
              </div>
              <div className="overflow-auto rounded-3xl border border-cream-100 bg-cream-50/60 p-3">
                <div
                  className="grid gap-px"
                  style={{
                    gridTemplateColumns: `repeat(${result.width}, minmax(0, 1fr))`
                  }}
                >
                  {result.grid.map((row, y) =>
                    row.map((colorIndex, x) => (
                      <div
                        key={`${x}-${y}`}
                        className="aspect-square"
                        style={{
                          backgroundColor:
                            result.palette[colorIndex]?.hex ?? "#FFFFFF"
                        }}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-700">颜色图例</p>
                <div className="flex flex-wrap gap-2">
                  {result.palette.map((color) => (
                    <div
                      key={color.id}
                      className="flex items-center gap-2 rounded-2xl border border-cream-100 bg-white/70 px-2 py-1"
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-cream-100"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-[11px] text-slate-600">
                        #{color.id.toString().padStart(2, "0")} · {color.hex}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

