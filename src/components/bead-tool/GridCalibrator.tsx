"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Grid3X3, Maximize2 } from "lucide-react";

interface GridCalibratorProps {
  onGridCalibrated?: (rows: number, cols: number, cellSize: number) => void;
}

export function GridCalibrator({ onGridCalibrated }: GridCalibratorProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [gridRows, setGridRows] = useState<number>(10);
  const [gridCols, setGridCols] = useState<number>(10);
  const [cellSize, setCellSize] = useState<number>(20);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
   const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
     const url = URL.createObjectURL(file);
      setImageSrc(url);
    }
  };

  const handleCalibrate = () => {
    onGridCalibrated?.(gridRows, gridCols, cellSize);
  };

 return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-green-500" />
          1. 上传图纸并校准网格
        </label>

        {/* 图片上传 */}
        {!imageSrc ? (
          <div className="border-2 border-dashed border-cream-100 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-green-500/50 transition-colors bg-cream-50/60">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
               className="hidden"
              />
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Maximize2 className="w-5 h-5 text-green-500" />
                <span>点击上传拼豆图纸</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                支持 JPG/PNG/WebP 格式
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 图片预览 + 网格覆盖 */}
            <div className="relative rounded-2xl border border-cream-100 overflow-hidden bg-white">
              <img
                src={imageSrc}
                alt="图纸预览"
               className="w-full h-auto"
                ref={(img) => {
                  if (img && canvasRef.current) {
                    // 可以在这里绘制 canvas
                  }
                }}
              />
              
              {/* 网格覆盖层 */}
              {showGrid && imageSrc && (
                <div 
                 className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(0, 255, 0, 0.3) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(0, 255, 0, 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: `${cellSize}px ${cellSize}px`
                  }}
                />
              )}
            </div>

            {/* 网格参数设置 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  行数
                </label>
                <input
                  type="number"
                  value={gridRows}
                  onChange={(e) => setGridRows(Number(e.target.value))}
                 className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  列数
                </label>
                <input
                  type="number"
                  value={gridCols}
                  onChange={(e) => setGridCols(Number(e.target.value))}
                 className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  格子大小 (px)
                </label>
                <input
                  type="number"
                  value={cellSize}
                  onChange={(e) => setCellSize(Number(e.target.value))}
                 className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
               id="show-grid"
               checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
               className="rounded border-cream-100 text-green-600 focus:ring-green-600"
              />
              <label htmlFor="show-grid" className="text-xs text-slate-700">
                显示辅助网格线
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImageSrc(null)}
               className="flex-1"
              >
                重新上传
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleCalibrate}
               className="flex-1 bg-green-600 hover:bg-green-700"
              >
                确认网格
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">
              💡 调整行数和列数以匹配图纸，绿色网格线会与图纸对齐
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
