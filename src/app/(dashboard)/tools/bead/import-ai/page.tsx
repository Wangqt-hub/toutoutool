"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Grid3X3, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ImageUploadStep,
  type ImageMetadata,
} from "@/components/bead-tool/ImageUploadStep";
import { PatternPreviewPanel } from "@/components/bead-tool/PatternPreviewPanel";
import { PatternSettings } from "@/components/bead-tool/PatternSettings";
import { StyleSelector } from "@/components/bead-tool/StyleSelector";
import {
  getPalette,
  type ColorBrand,
  type PaletteColor,
} from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";
import {
  calculateAspectRatioDimensionsFromWidth,
  processImage,
  type CanvasSettings,
  type PixelAlgorithm,
} from "@/lib/bead/imageProcessor";

function clampSize(value: number): number {
  return Math.max(8, Math.min(128, Math.round(value)));
}

function toProcessSafeImageUrl(url: string): string {
  if (url.startsWith("data:")) {
    return url;
  }

  if (url.startsWith("/api/image-proxy")) {
    return url;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
}

export default function AIGeneratePage() {
  const router = useRouter();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedStyle, setSelectedStyle] = useState<string>("anime");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const [canvasWidth, setCanvasWidth] = useState<number>(32);
  const [canvasHeight, setCanvasHeight] = useState<number>(32);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [algorithm, setAlgorithm] =
    useState<PixelAlgorithm>("edge-enhanced");
  const [colorCount, setColorCount] = useState<number>(24);
  const [brand, setBrand] = useState<ColorBrand>("MARD");

  const [grid, setGrid] = useState<BeadGrid | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showColorNumbers, setShowColorNumbers] = useState<boolean>(true);

  const hasGeneratedImage = Boolean(generatedImageUrl);
  const hasPattern = Boolean(grid && palette);
  const isInfoMessage = Boolean(error?.includes("Demo mode:"));

  const syncAspectRatioSize = (
    nextWidth: number,
    metadata: ImageMetadata | null = imageMetadata
  ) => {
    if (!metadata) {
      setCanvasWidth(clampSize(nextWidth));
      return;
    }

    const dimensions = calculateAspectRatioDimensionsFromWidth(
      metadata.width,
      metadata.height,
      nextWidth
    );

    setCanvasWidth(dimensions.width);
    setCanvasHeight(dimensions.height);
  };

  const resetPatternState = () => {
    setGrid(null);
    setPalette(null);
  };

  const handleAIGenerate = async () => {
    if (!imageFile) {
      setError("请先上传图片");
      return;
    }

    setAiLoading(true);
    setError(null);
    setGeneratedImageUrl(null);
    resetPatternState();

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("styleId", selectedStyle);

      if (customPrompt.trim()) {
        formData.append("customPrompt", customPrompt.trim());
      }

      const response = await fetch("/api/ai-generate", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "AI 生成失败");
      }

      setGeneratedImageUrl(toProcessSafeImageUrl(result.data.imageUrl));

      if (result.data.message) {
        setError(result.data.message);
      }
    } catch (generationError) {
      setGeneratedImageUrl(null);
      resetPatternState();
      setError(
        generationError instanceof Error
          ? generationError.message
          : "AI 生成失败，请稍后再试"
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreatePattern = async () => {
    if (!generatedImageUrl) {
      setError("请先成功生成 AI 图片");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedPalette = getPalette(colorCount);
      const settings: CanvasSettings = {
        width: canvasWidth,
        height: canvasHeight,
        maintainAspectRatio,
        algorithm,
      };

      const result = await processImage(
        generatedImageUrl,
        settings,
        selectedPalette
      );

      setGrid(result.grid);
      setPalette(result.palette);
      setCanvasWidth(result.width);
      setCanvasHeight(result.height);
    } catch (generationError) {
      resetPatternState();
      setError(
        generationError instanceof Error
          ? generationError.message
          : "生成图纸时出错，请稍后再试"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEnterBeadMode = () => {
    if (!grid || !palette) {
      return;
    }

    sessionStorage.setItem(
      "currentBeadPattern",
      JSON.stringify({
        grid,
        palette,
        brand,
      })
    );

    router.push("/tools/bead/bead-mode");
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/tools/bead")}
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
          先用 AI 生成像素风图片，再基于 AI 结果调整图纸设置并生成最终拼豆图纸。
        </p>
      </section>

      {error && (
        <div
          className={`rounded-3xl px-4 py-3 text-xs ${
            isInfoMessage
              ? "bg-blue-50 border border-blue-100 text-blue-600"
              : "bg-red-50 border border-red-100 text-red-600"
          }`}
        >
          提示：{error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <ImageUploadStep
            onImageSelect={(url, file, metadata) => {
              setImageUrl(url);
              setImageFile(file);
              setImageMetadata(metadata);
              setGeneratedImageUrl(null);
              resetPatternState();
              setError(null);

              if (maintainAspectRatio) {
                syncAspectRatioSize(canvasWidth, metadata);
              }
            }}
            onClear={() => {
              setImageUrl(null);
              setImageFile(null);
              setImageMetadata(null);
              setGeneratedImageUrl(null);
              resetPatternState();
              setError(null);
            }}
            onError={setError}
          />

          <StyleSelector
            selectedStyle={selectedStyle}
            onStyleSelect={setSelectedStyle}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
          />

          <Button
            type="button"
            size="lg"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            onClick={handleAIGenerate}
            disabled={aiLoading || !imageFile}
          >
            {aiLoading ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                AI 生成中...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                AI 生成像素画
              </>
            )}
          </Button>

          {hasGeneratedImage && (
            <>
              <Card className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    AI 生成预览
                  </h3>
                  <span className="text-xs text-slate-500">
                    后续图纸将只基于这张 AI 图片生成
                  </span>
                </div>
                <img
                  src={generatedImageUrl ?? undefined}
                  alt="AI 生成预览"
                  className="w-full rounded-2xl border border-cream-100"
                />
              </Card>

              <PatternSettings
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                maintainAspectRatio={maintainAspectRatio}
                onCanvasWidthChange={(nextWidth) => {
                  if (maintainAspectRatio) {
                    syncAspectRatioSize(nextWidth);
                    return;
                  }

                  setCanvasWidth(clampSize(nextWidth));
                }}
                onCanvasHeightChange={(nextHeight) => {
                  setCanvasHeight(clampSize(nextHeight));
                }}
                onMaintainAspectRatioChange={(nextMaintainAspectRatio) => {
                  setMaintainAspectRatio(nextMaintainAspectRatio);

                  if (nextMaintainAspectRatio) {
                    syncAspectRatioSize(canvasWidth);
                  }
                }}
                colorCount={colorCount}
                brand={brand}
                onColorCountChange={setColorCount}
                onBrandChange={setBrand}
                algorithm={algorithm}
                onAlgorithmChange={setAlgorithm}
              />

              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={handleCreatePattern}
                disabled={loading || !generatedImageUrl}
              >
                {loading ? "正在生成最终图纸..." : "使用 AI 图片生成最终图纸"}
              </Button>
            </>
          )}
        </div>

        <div className="space-y-4">
          <PatternPreviewPanel
            grid={grid}
            palette={palette}
            brand={brand}
            showColorNumbers={showColorNumbers}
            onShowColorNumbersChange={setShowColorNumbers}
            fileNameBase="bead-ai-preview"
            emptyState={
              <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-cream-100 bg-cream-50/60 text-xs text-slate-500 text-center px-4">
                <div className="space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                  <p>先上传图片并成功生成 AI 像素图，然后再继续生成最终图纸。</p>
                </div>
              </div>
            }
            footer={
              <Button
                type="button"
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-600/90 hover:to-pink-600/90 text-white"
                onClick={handleEnterBeadMode}
                disabled={!hasPattern}
              >
                <Grid3X3 className="w-5 h-5 mr-2" />
                进入拼豆模式，开始制作
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
