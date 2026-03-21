"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3X3, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BeadImagePreviewCard } from "@/components/bead-tool/BeadImagePreviewCard";
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
        caption: "先放入一张清晰的参考图。",
        available: true,
        complete: Boolean(imageUrl),
      },
      {
        id: "settings",
        label: "调整图纸",
        caption: "设定尺寸、色数与转换算法。",
        available: Boolean(imageUrl),
        complete: Boolean(grid && palette),
      },
      {
        id: "result",
        label: "检查结果",
        caption: "预览拼豆图纸并准备进入制作。",
        available: Boolean(grid && palette),
        complete: Boolean(grid && palette),
      },
    ],
    [grid, imageUrl, palette]
  );

  const stageCopy = [
    {
      eyebrow: "Step 1 / 3",
      title: "先把原图放进来",
      description:
        "建议使用主体明确、背景干净的图片。上传完成后，你就可以开始控制图纸密度和风格。",
    },
    {
      eyebrow: "Step 2 / 3",
      title: "决定这张图纸的颗粒感",
      description:
        "这里决定最终拼豆图纸的尺寸、色彩数量与处理算法。桌面端更适合细调，手机端则更适合快速生成。",
    },
    {
      eyebrow: "Step 3 / 3",
      title: "检查成品并准备开工",
      description:
        "确认图纸的细节和用色后，就可以把结果带入拼豆模式继续制作。",
    },
  ][currentStep];

  const sideNote = (
    <Card className="border-white/70 bg-white/82">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          生成建议
        </p>
        <div className="space-y-2 text-sm leading-6 text-slate-600">
          <p>尺寸越小，图纸越偏图标化；尺寸越大，保留的轮廓与层次越多。</p>
          <p>如果你在手机上操作，先生成一个小尺寸版本，确认效果后再放大更稳妥。</p>
          <p>需要更清晰的轮廓时，优先尝试“轮廓增强”算法。</p>
        </div>
      </div>
    </Card>
  );

  const preview = grid && palette ? (
    <PatternPreviewPanel
      grid={grid}
      palette={palette}
      brand={brand}
      showColorNumbers={showColorNumbers}
      onShowColorNumbersChange={setShowColorNumbers}
      fileNameBase="bead-image-preview"
      emptyState={<></>}
    />
  ) : (
    <BeadImagePreviewCard
      badge="Live Preview"
      title={imageUrl ? "原图预览" : "等待上传"}
      description={
        imageUrl
          ? "这张原图会作为后续转换的基础，你可以在下一步决定图纸密度。"
          : "完成上传后，这里会展示当前正在处理的图像。"
      }
      imageUrl={imageUrl}
      alt="原图预览"
      fit="contain"
      meta={
        imageMetadata
          ? [
              `原始尺寸 ${imageMetadata.width} × ${imageMetadata.height}`,
              `当前图纸 ${canvasWidth} × ${canvasHeight}`,
            ]
          : undefined
      }
      emptyTitle="还没有图像"
      emptyDescription="上传完成后，这里会出现原图与关键参数摘要。"
    />
  );

  const footer =
    currentStep === 0 ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-500">
          上传完成后即可进入下一步设定图纸尺寸与用色。
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => setCurrentStep(1)}
          disabled={!imageUrl}
        >
          继续设置
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
          {loading ? "正在生成图纸..." : "生成拼豆图纸"}
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
          返回调参
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
      title="图片转拼豆图纸"
      description="把一张普通图片转换成更适合制作的拼豆图纸。桌面端提供并排预览，手机端则改成单步聚焦，避免控件堆满整屏。"
      badge="Image Workflow"
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
      stageDescription={stageCopy.description}
      error={error}
      preview={preview}
      sideNote={sideNote}
      footer={footer}
    >
      {currentStep === 0 ? (
        <div className="space-y-4">
          <ImageUploadStep
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

          <Card className="border-dashed border-cream-100 bg-cream-50/70">
            <div className="space-y-2 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slate-900">适合的图片类型</p>
              <p>头像、Q 版角色、宠物、玩具和插画的转换成功率通常更高。</p>
              <p>如果画面过于复杂，建议先裁掉背景，再来生成图纸。</p>
            </div>
          </Card>
        </div>
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
        <div className="space-y-4">
          <Card className="border-white/70 bg-cream-50/75">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Ready To Make
              </p>
              <h3 className="text-xl font-semibold text-slate-900">
                图纸已经准备好了
              </h3>
              <p className="text-sm leading-7 text-slate-600">
                现在可以回到上一步继续调参，也可以直接进入拼豆模式开始逐色制作。
              </p>
            </div>
          </Card>

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
        </div>
      )}
    </BeadWorkflowShell>
  );
}
