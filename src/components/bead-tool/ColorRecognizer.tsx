"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Droplet } from "lucide-react";
import { PaletteColor } from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";

interface ColorRecognizerProps {
  gridRows?: number;
  gridCols?: number;
  cellSize?: number;
  onColorRecognized?: (grid: BeadGrid, palette: PaletteColor[]) => void;
}

export function ColorRecognizer({ gridRows, gridCols, cellSize, onColorRecognized }: ColorRecognizerProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [recognitionMode, setRecognitionMode] = useState<'color' | 'ocr'>('color');
  const [recognizing, setRecognizing] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
      setImageSrc(url);
    }
  };

  // 简化的颜色识别（从图片中提取每个格子的平均颜色）
  const recognizeColors = async () => {
   if (!imageSrc || !gridRows || !gridCols || !cellSize) return;
    
   setRecognizing(true);
    
   try {
     // 创建临时的 canvas 来处理图片
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
      
     if (!ctx) {
       throw new Error('浏览器不支持 Canvas');
     }

     // 加载图片
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片加载失败'));
     });

     // 设置 canvas 尺寸为图纸实际尺寸
     canvas.width = gridCols * cellSize;
     canvas.height = gridRows * cellSize;

     // 绘制图片
     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

     // 获取像素数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

     // 提取每个格子的平均颜色
    const grid: BeadGrid = [];
    const usedColors = new Map<number, { r: number; g: number; b: number }>();

     for (let row = 0; row < gridRows; row++) {
      const rowData: number[] = [];
        
       for (let col = 0; col < gridCols; col++) {
         // 计算格子中心的坐标
        const centerX = col * cellSize + cellSize / 2;
        const centerY = row * cellSize + cellSize / 2;
          
         // 取中心点的颜色（简化处理）
        const pixelIndex = Math.floor((centerY * canvas.width + centerX) * 4);
        const r = pixels[pixelIndex];
        const g = pixels[pixelIndex + 1];
        const b = pixels[pixelIndex +2];

         // 创建一个临时的颜色 ID
        const colorId = usedColors.size;
         
         // 检查是否已经有相似的颜色
         let foundMatch = false;
         for (const [id, color] of usedColors.entries()) {
          const distance = Math.sqrt(
             Math.pow(color.r - r, 2) +
             Math.pow(color.g - g, 2) +
             Math.pow(color.b - b, 2)
           );
            
           if (distance < 30) { // 颜色相似度阈值
            rowData.push(id);
             foundMatch = true;
             break;
           }
         }

         if (!foundMatch) {
          usedColors.set(colorId, { r, g, b });
          rowData.push(colorId);
         }
       }
        
      grid.push(rowData);
     }

     // 转换为 PaletteColor 格式
    const palette: PaletteColor[] = Array.from(usedColors.entries()).map(([id, color]) => ({
      id,
      hex: `#${componentToHex(color.r)}${componentToHex(color.g)}${componentToHex(color.b)}`,
       brandCodes: {}
     }));

     onColorRecognized?.(grid, palette);
   } catch (error) {
    console.error('颜色识别失败:', error);
   } finally {
     setRecognizing(false);
   }
  };

  const componentToHex = (c: number) => {
  const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

 return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
          <Palette className="w-4 h-4 text-blue-500" />
          2. 颜色识别
        </label>

        {/* 识别模式选择 */}
        <div className="flex gap-2">
          <button
           type="button"
          onClick={() => setRecognitionMode('color')}
         className={`flex-1 px-3 py-2 rounded-2xl text-xs font-medium transition-all ${
             recognitionMode === 'color'
               ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
               : 'bg-cream-50 text-slate-600 border-2 border-cream-100'
           }`}
          >
            <Droplet className="w-4 h-4 inline mr-1" />
            颜色提取
          </button>
          <button
            type="button"
           onClick={() => setRecognitionMode('ocr')}
           disabled
          className={`flex-1 px-3 py-2 rounded-2xl text-xs font-medium transition-all opacity-50 cursor-not-allowed ${
             recognitionMode === 'ocr'
               ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
               : 'bg-cream-50 text-slate-600 border-2 border-cream-100'
           }`}
          >
            OCR 识别 ⏳
          </button>
        </div>

        {recognitionMode === 'ocr' && (
          <p className="text-[11px] text-orange-600 bg-orange-50 p-2 rounded-xl">
            ⚠️ OCR 功能需要集成 Tesseract.js，目前暂不可用
          </p>
        )}

        {/* 图片上传 */}
        {!imageSrc ? (
          <div className="border-2 border-dashed border-cream-100 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-500/50 transition-colors bg-cream-50/60">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
               disabled={!gridRows || !gridCols}
              className="hidden"
              />
              <div className={`flex items-center gap-2 text-sm font-medium ${
                !gridRows || !gridCols ? 'text-slate-400' : 'text-slate-700'
              }`}>
                <Palette className="w-5 h-5 text-blue-500" />
                <span>上传图纸进行颜色识别</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {!gridRows || !gridCols 
                  ? '请先完成网格校准' 
                  : '支持 JPG/PNG/WebP 格式'}
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 图片预览 */}
            <div className="relative rounded-2xl border border-cream-100 overflow-hidden bg-white">
              <img
                src={imageSrc}
                alt="图纸预览"
              className="w-full h-auto"
              />
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
                onClick={recognizeColors}
               disabled={recognizing}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {recognizing ? '识别中…' : '开始识别'}
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">
              💡 系统会提取每个格子的颜色并生成拼豆图纸
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
