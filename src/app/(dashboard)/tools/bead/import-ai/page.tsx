"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageUploadStep } from "@/components/bead-tool/ImageUploadStep";
import { StyleSelector } from "@/components/bead-tool/StyleSelector";
import { BeadEditor } from "@/components/bead-tool/BeadEditor";
import { getPalette, type ColorBrand, type PaletteColor } from "@/lib/bead/palette";
import { processImage, type CanvasSettings } from "@/lib/bead/imageProcessor";
import { Wand2, ArrowLeft, Sparkles, Grid3X3 } from "lucide-react";

const CANVAS_SIZES = [
  { label: '16× 16（迷你）', value: 16 },
  { label: '24 × 24', value: 24 },
  { label: '32× 32（推荐）', value: 32 },
  { label: '40 × 40', value: 40 },
  { label: '48 × 48（较大）', value: 48 },
  { label: '64× 64（精细）', value: 64 }
];

const COLOR_COUNTS = [
  { label: '12 色（简单）', value: 12 },
  { label: '24 色（推荐）', value: 24 },
  { label: '48 色（丰富）', value: 48 },
  { label: '72 色（专业）', value: 72 }
];

export default function AIGeneratePage() {
  const router = useRouter();
  
  // 图片状态
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // AI 生成状态
  const [selectedStyle, setSelectedStyle] = useState<string>('anime');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  
  // 参数设置
  const [canvasSize, setCanvasSize] = useState<number>(32);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [colorCount, setColorCount] = useState<number>(24);
  const [brand, setBrand] = useState<ColorBrand>('MARD');
  
  // 生成结果
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // 显示选项
  const [showColorNumbers, setShowColorNumbers] = useState<boolean>(true);

  // 调用 AI 生成 API
  const handleAIGenerate = async () => {
   if (!imageUrl) {
     setError("请先上传图片");
     return;
   }
   
   setAiLoading(true);
   setError(null);
   
   try {
   const response = await fetch('/api/ai-generate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      imageUrl,
        styleId: selectedStyle,
        customPrompt
      })
    });

   const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'AI 生成失败');
    }

    // 显示生成的图片
   setGeneratedImageUrl(result.data.imageUrl);
    
    // 如果有演示模式提示，显示错误
    if (result.data.message) {
      setError(result.data.message);
    }
   } catch (err) {
     setError(err instanceof Error ? err.message: "AI 生成失败，请稍后再试");
   } finally {
     setAiLoading(false);
   }
  };
  
  // 使用 AI生成的图片继续制作
  const handleContinueWithGenerated = async () => {
   if (!generatedImageUrl) return;
     
   setLoading(true);
   setError(null);
     
   try {
   const selectedPalette = getPalette(colorCount);
       
   const settings: CanvasSettings = {
     width: canvasSize,
     height: canvasSize,
      maintainAspectRatio: maintainAspectRatio
    };
       
   const result = await processImage(generatedImageUrl, settings, selectedPalette);
       
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
  
  // 直接使用原图制作
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
     width: canvasSize,
     height: canvasSize,
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
  
  // 保存功能（暂未实现）
  const handleSave = () => {
   alert("云端存储功能即将上线！");
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
          <h1 className="text-2xl font-bold text-slate-900">AI 生成像素画</h1>
          <Sparkles className="w-6 h-6 text-purple-500" />
        </div>
        <p className="text-sm text-slate-600">
          使用 AI 将图片转换为独特的像素艺术风格，再制作成拼豆图纸
        </p>
      </section>

      {/* 错误提示 */}
      {error && (
        <div className={`rounded-3xl px-4 py-3 text-xs ${
          error.includes('演示模式') 
            ? 'bg-blue-50 border border-blue-100 text-blue-600'
            : 'bg-red-50 border border-red-100 text-red-600'
        }`}>
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
              setGeneratedImageUrl(null);
              setGrid(null);
              setPalette(null);
              setError(null);
            }}
            onError={setError}
          />

          {/* 2. 选择 AI 风格 */}
          <StyleSelector
            selectedStyle={selectedStyle}
            onStyleSelect={setSelectedStyle}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
          />

          {/* AI 生成按钮 */}
          <Button
            type="button"
            size="lg"
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            onClick={handleAIGenerate}
            disabled={aiLoading || !imageUrl}
          >
            {aiLoading ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                AI 生成中…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                AI 生成像素画
              </>
            )}
          </Button>

          {/* AI 生成预览 */}
          {generatedImageUrl && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  ✨ AI 生成预览
                </h3>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                 onClick={handleContinueWithGenerated}
                 disabled={loading}
                >
                  使用此图继续
                </Button>
              </div>
              <img
               src={generatedImageUrl}
               alt="AI 生成预览"
              className="w-full rounded-2xl border border-cream-100"
              />
            </Card>
          )}

          {/* 3. 画布设置 */}
          <Card className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">
               3. 画布设置
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    网格大小
                  </label>
                  <select
                    value={canvasSize}
                    onChange={(e) => setCanvasSize(Number(e.target.value))}
                  className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                  >
                    {CANVAS_SIZES.map((size) => (
                      <option key={size.value} value={size.value}>
                        {size.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    颜色数量
                  </label>
                  <select
                    value={colorCount}
                    onChange={(e) => setColorCount(Number(e.target.value))}
                  className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                  >
                    {COLOR_COUNTS.map((count) => (
                      <option key={count.value} value={count.value}>
                        {count.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                id="aspect-ratio-ai"
                checked={maintainAspectRatio}
                  onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                className="rounded border-cream-100 text-accent-brown focus:ring-accent-brown"
                />
                <label htmlFor="aspect-ratio-ai" className="text-xs text-slate-700">
                  保持原图宽高比例
                </label>
              </div>
            </div>
          </Card>

          {/* 4. 色卡设置 */}
          <Card className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">
                4. 色卡库选择
              </label>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  品牌
                </label>
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value as ColorBrand)}
                className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                >
                  {['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* 生成/跳过 AI 直接制作按钮 */}
          <div className="flex gap-2">
            {!generatedImageUrl ? (
              <Button
                type="button"
                variant="secondary"
               size="lg"
              className="flex-1"
               onClick={handleGenerate}
               disabled={loading || !imageUrl}
              >
                跳过 AI，直接制作
              </Button>
            ) : (
              <Button
                type="button"
               size="lg"
              className="flex-1"
               onClick={handleGenerate}
               disabled={loading || !imageUrl}
              >
                使用原图重新制作
              </Button>
            )}
          </div>
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
                  <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                  <p>先在左侧上传并设置参数<br/>可以选择 AI 生成或直接制作</p>
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
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-600/90 hover:to-pink-600/90 text-white"
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
