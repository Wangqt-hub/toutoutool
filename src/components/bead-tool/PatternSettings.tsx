"use client";

import { Card } from "@/components/ui/card";
import {
  getAvailableColorCounts,
  getAvailableBrands,
  type ColorBrand,
} from "@/lib/bead/palette";
import type { PixelAlgorithm } from "@/lib/bead/imageProcessor";

interface PatternSettingsProps {
  canvasWidth: number;
  canvasHeight: number;
  maintainAspectRatio: boolean;
  onCanvasWidthChange: (width: number) => void;
  onCanvasHeightChange: (height: number) => void;
  onMaintainAspectRatioChange: (maintain: boolean) => void;
  colorCount: number;
  brand: ColorBrand;
  onColorCountChange: (count: number) => void;
  onBrandChange: (brand: ColorBrand) => void;
  algorithm: PixelAlgorithm;
  onAlgorithmChange: (algorithm: PixelAlgorithm) => void;
}

const ALGORITHM_OPTIONS: Array<{
  value: PixelAlgorithm;
  label: string;
  description: string;
}> = [
  {
    value: "standard",
    label: "标准还原",
    description: "高质量缩放后直接匹配色卡，适合大多数图片。",
  },
  {
    value: "edge-enhanced",
    label: "轮廓增强",
    description: "强化边缘和局部对比，轮廓会更清晰。",
  },
  {
    value: "dithered",
    label: "复古抖动",
    description: "加入抖动颗粒感，适合想要更明显像素风的图。",
  },
];

function clampSize(value: number): number {
  return Math.max(8, Math.min(128, value));
}

export function PatternSettings({
  canvasWidth,
  canvasHeight,
  maintainAspectRatio,
  onCanvasWidthChange,
  onCanvasHeightChange,
  onMaintainAspectRatioChange,
  colorCount,
  brand,
  onColorCountChange,
  onBrandChange,
  algorithm,
  onAlgorithmChange,
}: PatternSettingsProps) {
  const availableColorCounts = getAvailableColorCounts();
  const brands = getAvailableBrands();

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
          <span>📐</span>
          图纸设置
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              宽度（格数）
            </label>
            <input
              type="number"
              min="8"
              max="128"
              value={canvasWidth}
              onChange={(event) =>
                onCanvasWidthChange(clampSize(Number(event.target.value)))
              }
              className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              高度（格数）{maintainAspectRatio ? "（自动）" : ""}
            </label>
            <input
              type="number"
              min="8"
              max="128"
              value={canvasHeight}
              onChange={(event) =>
                onCanvasHeightChange(clampSize(Number(event.target.value)))
              }
              disabled={maintainAspectRatio}
              className={`w-full rounded-2xl border px-3 py-2 text-sm outline-none ${
                maintainAspectRatio
                  ? "border-cream-100 bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "border-cream-100 bg-cream-50/60 focus:ring-2 focus:ring-accent-brown"
              }`}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 mt-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={maintainAspectRatio}
            onChange={(event) =>
              onMaintainAspectRatioChange(event.target.checked)
            }
            className="rounded border-cream-100 text-accent-brown focus:ring-accent-brown"
          />
          保持原图宽高比例
        </label>
      </div>

      <div className="h-px bg-cream-100" />

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700">
          转换算法
        </label>
        <div className="grid grid-cols-1 gap-2">
          {ALGORITHM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onAlgorithmChange(option.value)}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                algorithm === option.value
                  ? "border-accent-brown bg-accent-brown/10"
                  : "border-cream-100 bg-white/70 hover:bg-cream-50"
              }`}
            >
              <p className="text-sm font-medium text-slate-800">
                {option.label}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-cream-100" />

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              颜色数量
            </label>
            <select
              value={colorCount}
              onChange={(event) => onColorCountChange(Number(event.target.value))}
              className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
            >
              {availableColorCounts.map((count) => (
                <option key={count} value={count}>
                  {count} 色
                  {count <= 24
                    ? "（简单）"
                    : count <= 48
                      ? "（推荐）"
                      : count <= 72
                        ? "（丰富）"
                        : "（专业）"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              拼豆品牌
            </label>
            <select
              value={brand}
              onChange={(event) => onBrandChange(event.target.value as ColorBrand)}
              className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
            >
              {brands.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          系统会将图片颜色匹配到最接近的本地色卡，并显示对应品牌色号。
        </p>
      </div>
    </Card>
  );
}
