"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageUploadStep } from "@/components/bead-tool/ImageUploadStep";
import { PatternSettings } from "@/components/bead-tool/PatternSettings";
import { getPalette, type ColorBrand, type PaletteColor } from "@/lib/bead/palette";
import { processImage, type CanvasSettings } from "@/lib/bead/imageProcessor";
import { ArrowLeft, Image as ImageIcon, Grid3X3 } from "lucide-react";

export default function ImageImportPage() {
  const router = useRouter();
  
  // 图片状态
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 参数设置 - 使用统一的图纸设置
  const [canvasWidth, setCanvasWidth] = useState<number>(32);
  const [canvasHeight, setCanvasHeight] = useState<number>(32);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [colorCount, setColorCount] = useState<number>(24);
  const [brand, setBrand] = useState<ColorBrand>('MARD');
  
  // 生成结果
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // 显示选项
  const [showColorNumbers, setShowColorNumbers] = useState<boolean>(true);

  // 保存功能（暂未实现）
  const handleSave = () => {
   alert("云端存储功能即将上线！");
  };

  // 生成拼豆图纸
  const handleGenerate = async () => {
   if (!imageUrl) {
     setError("请先上传图片");
     return;
   }
   
   setLoading(true);
   setError(null);
   
   try {
   const selectedPalette = getPalette(colorCount);
     
   const settings: CanvasSettings = {
     width: canvasWidth,
     height: canvasHeight,
      maintainAspectRatio: maintainAspectRatio
    };
     
   const result = await processImage(imageUrl, settings, selectedPalette);
     
     setGrid(result.grid);
     setPalette(result.palette);
   } catch (err) {
     setError("生成图纸时出错，请稍后再试");
   } finally {
     setLoading(false);
   }
  };

  // 进入拼豆模式
  const handleEnterBeadMode = () => {
   if (!grid || !palette) return;
   
   // 将数据保存到 sessionStorage
   const beadData = {
     grid,
     palette,
     brand
   };
   sessionStorage.setItem('currentBeadPattern', JSON.stringify(beadData));
   
   // 跳转到拼豆模式页面
   router.push('/tools/bead/bead-mode');
  };

 return (
    <div className="space-y-6">
      {/* 头部 */}
      <section className="flex flex-col gap-2">
        <Button
         type="button"
          variant="ghost"
          size="sm"
        onClick={() => router.push('/tools/bead')}
       className="w-fit -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">图片转像素画</h1>
          <ImageIcon className="w-6 h-6 text-blue-500" />
        </div>
        <p className="text-sm text-slate-600">
          上传喜欢的图片，调整参数后自动生成拼豆图纸
        </p>
      </section>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-3xl px-4 py-3 text-xs text-red-600">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* 左侧：设置面板 */}
        <div className="space-y-4">
          {/* 1. 上传图片 */}
          <ImageUploadStep
            onImageSelect={(url, file) => {
              setImageUrl(url);
              setImageFile(file);
              setGrid(null);
              setPalette(null);
              setError(null);
            }}
            onError={setError}
          />

          {/* 2. 图纸设置（合并画布和色卡） */}
          <PatternSettings
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            maintainAspectRatio={maintainAspectRatio}
            onCanvasWidthChange={setCanvasWidth}
            onCanvasHeightChange={setCanvasHeight}
            onMaintainAspectRatioChange={setMaintainAspectRatio}
            colorCount={colorCount}
            brand={brand}
            onColorCountChange={setColorCount}
            onBrandChange={setBrand}
          />

          {/* 生成按钮 */}
          <Button
           type="button"
           size="lg"
          className="w-full"
           onClick={handleGenerate}
           disabled={loading || !imageUrl}
          >
            {loading ? '生成中…' : '生成拼豆图纸'}
          </Button>
        </div>

        {/* 右侧：预览面板 */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  拼豆图纸预览
                </h2>
                <p className="text-xs text-slate-500">
                  每个小方块代表一颗拼豆
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  <input
                   type="checkbox"
                 checked={showColorNumbers}
                   onChange={(e) => setShowColorNumbers(e.target.checked)}
                 className="rounded border-cream-100 text-accent-brown focus:ring-accent-brown"
                  />
                  显示色号
                </label>
              </div>
            </div>

            {!grid && (
              <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-cream-100 bg-cream-50/60 text-xs text-slate-500 text-center px-4">
                <div className="space-y-2">
                  <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                  <p>先在左侧上传并设置参数<br/>然后点击生成按钮</p>
                </div>
              </div>
            )}

            {grid && palette && (
              <div className="space-y-4">
                {/* 简单预览 */}
                <div className="overflow-auto rounded-3xl border border-cream-100 bg-cream-50/60 p-3 max-h-96">
                  <div
                   className="grid gap-px bg-white"
                    style={{
                     gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))`
                    }}
                  >
                    {grid.flatMap((row, y) =>
                     row.map((colorIndex, x) => {
                       const color = palette[colorIndex];
                        return (
                          <div
                            key={`${x}-${y}`}
                           className="aspect-square relative"
                            style={{
                              backgroundColor: color?.hex || "#FFFFFF"
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
                
                {/* 统计信息 */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>网格：{grid[0].length} × {grid.length}</span>
                  <span>·</span>
                  <span>颜色数：{palette.length}</span>
                  <span>·</span>
                  <span>品牌：{brand}</span>
                </div>
                
                {/* 进入拼豆模式按钮 */}
                <Button
                 type="button"
                 size="lg"
                className="w-full bg-gradient-to-r from-accent-brown to-purple-600 hover:from-accent-brown/90 hover:to-purple-600/90 text-white"
                 onClick={handleEnterBeadMode}
                >
                  <Grid3X3 className="w-5 h-5 mr-2" />
                  进入拼豆模式 · 开始制作
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
