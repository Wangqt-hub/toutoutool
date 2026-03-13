"use client";

import { Card } from "@/components/ui/card";
import { getAvailableColorCounts, getAvailableBrands, type ColorBrand } from "@/lib/bead/palette";

interface PatternSettingsProps {
  // 画布设置
  canvasWidth: number;
  canvasHeight: number;
  maintainAspectRatio: boolean;
  onCanvasWidthChange: (width: number) => void;
  onCanvasHeightChange: (height: number) => void;
  onMaintainAspectRatioChange: (maintain: boolean) => void;
  
  // 色卡设置
  colorCount: number;
  brand: ColorBrand;
  onColorCountChange: (count: number) => void;
  onBrandChange: (brand: ColorBrand) => void;
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
  onBrandChange
}: PatternSettingsProps) {
  const availableColorCounts = getAvailableColorCounts();
  const brands = getAvailableBrands();

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
          <span>📐</span> 图纸设置
        </label>
        
        {/* 画布尺寸设置 */}
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
              onChange={(e) => onCanvasWidthChange(Math.max(8, Math.min(128, Number(e.target.value))))}
             className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              高度（格数）{maintainAspectRatio && '（自动'}）
            </label>
            <input
              type="number"
              min="8"
              max="128"
              value={canvasHeight}
              onChange={(e) => onCanvasHeightChange(Math.max(8, Math.min(128, Number(e.target.value))))}
             disabled={maintainAspectRatio}
             className={`w-full rounded-2xl border px-3 py-2 text-sm outline-none ${
               maintainAspectRatio 
                 ? 'border-cream-100 bg-slate-100 text-slate-400 cursor-not-allowed' 
                 : 'border-cream-100 bg-cream-50/60 focus:ring-2 focus:ring-accent-brown'
             }`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <input
           type="checkbox"
           id="aspect-ratio"
           checked={maintainAspectRatio}
            onChange={(e) => onMaintainAspectRatioChange(e.target.checked)}
           className="rounded border-cream-100 text-accent-brown focus:ring-accent-brown"
          />
          <label htmlFor="aspect-ratio" className="text-xs text-slate-700">
            保持原图宽高比例
          </label>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="h-px bg-cream-100" />

      {/* 色卡库设置 */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              颜色数量
            </label>
            <select
              value={colorCount}
             onChange={(e) => onColorCountChange(Number(e.target.value))}
             className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
            >
              {availableColorCounts.map((count) => (
                <option key={count} value={count}>
                  {count}色 {count <= 24 ? '（简单）' : count <= 48 ? '（推荐）' : count <= 72 ? '（丰富）' : '（专业）'}
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
             onChange={(e) => onBrandChange(e.target.value as ColorBrand)}
             className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <p className="text-[11px] text-slate-500">
          💡 系统会将图片颜色匹配到最接近的本地色卡，并显示对应品牌的色号
        </p>
      </div>
    </Card>
  );
}
