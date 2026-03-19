"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Grid3X3, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploadStep, type ImageMetadata } from "@/components/bead-tool/ImageUploadStep";
import { PatternPreviewPanel } from "@/components/bead-tool/PatternPreviewPanel";
import { PatternSettings } from "@/components/bead-tool/PatternSettings";
import { getPalette, type ColorBrand, type PaletteColor } from "@/lib/bead/palette";
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

export default function ImageImportPage() {
  const router = useRouter();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        maintainAspectRatio,
        algorithm,
      };

      const result = await processImage(imageUrl, settings, selectedPalette);
      setGrid(result.grid);
      setPalette(result.palette);
      setCanvasWidth(result.width);
      setCanvasHeight(result.height);
    } catch (generationError) {
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
          <h1 className="text-2xl font-bold text-slate-900">图片转像素画</h1>
          <ImageIcon className="w-6 h-6 text-blue-500" />
        </div>
        <p className="text-sm text-slate-600">
          上传喜欢的图片，调整参数后自动生成拼豆图纸。
        </p>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-3xl px-4 py-3 text-xs text-red-600">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <ImageUploadStep
            onImageSelect={(url, _file, metadata) => {
              setImageUrl(url);
              setImageMetadata(metadata);
              setGrid(null);
              setPalette(null);
              setError(null);

              if (maintainAspectRatio) {
                syncAspectRatioSize(canvasWidth, metadata);
              }
            }}
            onClear={() => {
              setImageUrl(null);
              setImageMetadata(null);
              setGrid(null);
              setPalette(null);
              setError(null);
            }}
            onError={setError}
          />

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
            size="lg"
            className="w-full"
            onClick={handleGenerate}
            disabled={loading || !imageUrl}
          >
            {loading ? "生成中…" : "生成拼豆图纸"}
          </Button>
        </div>

        <div className="space-y-4">
          <PatternPreviewPanel
            grid={grid}
            palette={palette}
            brand={brand}
            showColorNumbers={showColorNumbers}
            onShowColorNumbersChange={setShowColorNumbers}
            fileNameBase="bead-image-preview"
            emptyState={
              <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-cream-100 bg-cream-50/60 text-xs text-slate-500 text-center px-4">
                <div className="space-y-2">
                  <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                  <p>先在左侧上传并设置参数，然后点击生成按钮。</p>
                </div>
              </div>
            }
            footer={
              <Button
                type="button"
                size="lg"
                className="w-full bg-gradient-to-r from-accent-brown to-purple-600 hover:from-accent-brown/90 hover:to-purple-600/90 text-white"
                onClick={handleEnterBeadMode}
              >
                <Grid3X3 className="w-5 h-5 mr-2" />
                进入拼豆模式 · 开始制作
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
