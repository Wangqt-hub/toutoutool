"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BeadWorkflowShell,
  type BeadWorkflowStep,
} from "@/components/bead-tool/BeadWorkflowShell";
import {
  ImageUploadStep,
  type ImageMetadata,
} from "@/components/bead-tool/ImageUploadStep";
import { PatternPreviewPanel } from "@/components/bead-tool/PatternPreviewPanel";
import { PatternSettings } from "@/components/bead-tool/PatternSettings";
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

export default function ImageImportPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [canvasWidth, setCanvasWidth] = useState<number>(32);
  const [canvasHeight, setCanvasHeight] = useState<number>(32);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [algorithm, setAlgorithm] =
    useState<PixelAlgorithm>("edge-enhanced");
  const [colorCount, setColorCount] = useState<number>(24);
  const [brand, setBrand] = useState<ColorBrand>("MARD");

  const [grid, setGrid] = useState<BeadGrid | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showColorNumbers, setShowColorNumbers] = useState(true);

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
      setError("请先上传图片。");
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
      setCurrentStep(2);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "生成图纸时出错，请稍后再试。"
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

  const steps = useMemo<BeadWorkflowStep[]>(
    () => [
      {
        id: "upload",
        label: "上传图片",
        caption: "导入原图",
        available: true,
        complete: Boolean(imageUrl),
      },
      {
        id: "settings",
        label: "图纸设置",
        caption: "调整尺寸与算法",
        available: Boolean(imageUrl),
        complete: Boolean(grid && palette),
      },
      {
        id: "result",
        label: "查看结果",
        caption: "确认图纸",
        available: Boolean(grid && palette),
        complete: Boolean(grid && palette),
      },
    ],
    [grid, imageUrl, palette]
  );

  const stageCopy = [
    {
      eyebrow: "Step 1 / 3",
      title: "上传图片",
    },
    {
      eyebrow: "Step 2 / 3",
      title: "图纸设置",
    },
    {
      eyebrow: "Step 3 / 3",
      title: "查看结果",
    },
  ][currentStep];

  const preview =
    currentStep === 2 && grid && palette ? (
      <PatternPreviewPanel
        grid={grid}
        palette={palette}
        brand={brand}
        showColorNumbers={showColorNumbers}
        onShowColorNumbersChange={setShowColorNumbers}
        fileNameBase="bead-image-preview"
        emptyState={<></>}
      />
    ) : undefined;

  const footer =
    currentStep === 0 ? (
      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          onClick={() => setCurrentStep(1)}
          disabled={!imageUrl}
        >
          下一步
        </Button>
      </div>
    ) : currentStep === 1 ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => setCurrentStep(0)}
        >
          返回上传
        </Button>
        <Button type="button" size="lg" onClick={handleGenerate} disabled={loading}>
          {loading ? "生成中..." : "生成图纸"}
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => setCurrentStep(1)}
        >
          返回设置
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={handleEnterBeadMode}
          disabled={!grid || !palette}
        >
          进入拼豆模式
        </Button>
      </div>
    );

  return (
    <BeadWorkflowShell
      title="图片转图纸"
      icon={ImageIcon}
      accent="sky"
      steps={steps}
      currentStep={currentStep}
      onStepChange={(stepIndex) => {
        if (steps[stepIndex]?.available !== false) {
          setCurrentStep(stepIndex);
        }
      }}
      onBack={() => router.push("/tools/bead")}
      stageEyebrow={stageCopy.eyebrow}
      stageTitle={stageCopy.title}
      error={error}
      preview={preview}
      footer={footer}
    >
      {currentStep === 0 ? (
        <ImageUploadStep
          previewUrl={imageUrl}
          previewLabel={imageUrl ? "当前图片" : null}
          onImageSelect={(url, _file, metadata) => {
            setImageUrl(url);
            setImageMetadata(metadata);
            setGrid(null);
            setPalette(null);
            setError(null);
            setCurrentStep(1);

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
            setCurrentStep(0);
          }}
          onError={setError}
        />
      ) : currentStep === 1 ? (
        <div className="space-y-4">
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

          <Card className="border-white/70 bg-cream-50/75">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  当前尺寸
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {canvasWidth} × {canvasHeight}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  当前色卡
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {brand} / {colorCount} 色
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="bg-cream-50/75">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              网格
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {grid?.[0]?.length ?? 0} × {grid?.length ?? 0}
            </p>
          </Card>
          <Card className="bg-cream-50/75">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              色数
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {palette?.length ?? 0} 种
            </p>
          </Card>
          <Card className="bg-cream-50/75">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              品牌
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{brand}</p>
          </Card>
        </div>
      )}
    </BeadWorkflowShell>
  );
}
