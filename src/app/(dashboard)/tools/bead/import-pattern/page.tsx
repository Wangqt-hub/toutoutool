"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileImage, RefreshCcw, ScanLine } from "lucide-react";
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
import { PatternCorrectionDialog } from "@/components/bead-tool/PatternCorrectionDialog";
import { PatternCropper } from "@/components/bead-tool/PatternCropper";
import { PatternImportPreview } from "@/components/bead-tool/PatternImportPreview";
import {
  applyGridSizeOverride,
  cropImage,
  detectGridGeometry,
  recognizeImportedPattern,
  resolveImportedCellCode,
  toBeadGrid,
  type GridGeometry,
  type ImportedPatternCell,
  type ImportRecognitionMode,
} from "@/lib/bead/patternImport";
import {
  getAvailableBrands,
  getAvailableColorCounts,
  type ColorBrand,
  type PaletteColor,
} from "@/lib/bead/palette";

function clampGridSize(value: number): number {
  return Math.max(1, Math.min(256, Math.round(value)));
}

export default function PatternImportPage() {
  const router = useRouter();
  const brands = useMemo(() => getAvailableBrands(), []);
  const availableColorCounts = useMemo(() => getAvailableColorCounts(), []);
  const defaultColorCount = useMemo(
    () =>
      availableColorCounts.includes(48)
        ? 48
        : (availableColorCounts[0] ?? 24),
    [availableColorCounts]
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [geometry, setGeometry] = useState<GridGeometry | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [colCount, setColCount] = useState(0);
  const [brand, setBrand] = useState<ColorBrand>("MARD");
  const [colorCount, setColorCount] = useState<number>(defaultColorCount);
  const [recognitionMode, setRecognitionMode] =
    useState<ImportRecognitionMode>("color");
  const [cells, setCells] = useState<ImportedPatternCell[][] | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  const resetRecognition = () => {
    setCells(null);
    setPalette(null);
    setUnresolvedCount(0);
    setShowCorrectionDialog(false);
  };

  const handleCropConfirm = async (cropRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    if (!sourceImageUrl) {
      return;
    }

    setCropping(true);
    setError(null);
    resetRecognition();

    try {
      const cropped = await cropImage(sourceImageUrl, cropRect);
      const nextGeometry = await detectGridGeometry(cropped.dataUrl);

      setCroppedImageUrl(cropped.dataUrl);
      setGeometry(nextGeometry);
      setRowCount(nextGeometry.rowCount);
      setColCount(nextGeometry.colCount);
      setCurrentStep(2);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "裁切完成后自动识别网格失败，请重新选择像素区域。"
      );
    } finally {
      setCropping(false);
    }
  };

  const handleRerunGridDetection = async () => {
    if (!croppedImageUrl) {
      return;
    }

    setCropping(true);
    setError(null);

    try {
      const nextGeometry = await detectGridGeometry(croppedImageUrl);
      setGeometry(nextGeometry);
      setRowCount(nextGeometry.rowCount);
      setColCount(nextGeometry.colCount);
      resetRecognition();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "重新识别行列失败，请检查裁切区域。"
      );
    } finally {
      setCropping(false);
    }
  };

  const handleRecognize = async () => {
    if (!croppedImageUrl || !geometry || rowCount <= 0 || colCount <= 0) {
      setError("请先完成裁切，并确认行列数。");
      return;
    }

    setRecognizing(true);
    setError(null);

    try {
      const adjustedGeometry = applyGridSizeOverride(geometry, rowCount, colCount);
      const result = await recognizeImportedPattern({
        imageSource: croppedImageUrl,
        brand,
        colorCount,
        mode: recognitionMode,
        geometry: adjustedGeometry,
      });

      setGeometry(result.geometry);
      setCells(result.cells);
      setPalette(result.palette);
      setUnresolvedCount(result.unresolvedCount);
      setCurrentStep(3);

      if (recognitionMode === "ocr" && result.unresolvedCount > 0) {
        setShowCorrectionDialog(true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "识别失败，请稍后重试。"
      );
    } finally {
      setRecognizing(false);
    }
  };

  const replaceCell = (
    row: number,
    col: number,
    updater: (cell: ImportedPatternCell) => ImportedPatternCell
  ) => {
    setCells((previous) => {
      if (!previous) {
        return previous;
      }

      const next = previous.map((cellRow) =>
        cellRow.map((cell) => ({ ...cell }))
      );
      next[row][col] = updater(next[row][col]);
      setUnresolvedCount(
        next.flat().filter((cell) => cell.state === "unresolved").length
      );
      return next;
    });
  };

  const handleApplyCode = (
    row: number,
    col: number,
    code: string
  ): string | null => {
    if (!cells || !palette) {
      return "当前没有可修正的识别结果。";
    }

    const nextCell = resolveImportedCellCode({
      cell: cells[row][col],
      palette,
      brand,
      code,
    });

    if (!nextCell) {
      return `色号 ${code.trim() || "(空)"} 不属于当前品牌 ${brand} 的 ${colorCount} 色色卡。`;
    }

    replaceCell(row, col, () => nextCell);
    return null;
  };

  const handleMarkEmpty = (row: number, col: number) => {
    replaceCell(row, col, (cell) => ({
      ...cell,
      state: "empty",
      paletteIndex: null,
      code: null,
      matchedCode: null,
      confidence: 1,
      source: "manual",
      failureReason: undefined,
    }));
  };

  const handleEnterBeadMode = () => {
    if (!cells || !palette) {
      return;
    }

    if (unresolvedCount > 0) {
      setError(`还有 ${unresolvedCount} 个失败格未修正，不能进入后续拼豆编辑器。`);
      setShowCorrectionDialog(true);
      return;
    }

    sessionStorage.setItem(
      "currentBeadPattern",
      JSON.stringify({
        grid: toBeadGrid(cells),
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
        label: "上传图纸",
        caption: "导入原始图纸照片或截图。",
        available: true,
        complete: Boolean(sourceImageUrl),
      },
      {
        id: "crop",
        label: "裁切网格",
        caption: "框住真正的像素/网格区域。",
        available: Boolean(sourceImageUrl),
        complete: Boolean(croppedImageUrl),
      },
      {
        id: "recognize",
        label: "识别参数",
        caption: "校正行列与识别方式。",
        available: Boolean(croppedImageUrl && geometry),
        complete: Boolean(cells && palette),
      },
      {
        id: "review",
        label: "检查结果",
        caption: "修正失败格并准备进入编辑。",
        available: Boolean(cells && palette),
        complete: Boolean(cells && palette && unresolvedCount === 0),
      },
    ],
    [cells, croppedImageUrl, geometry, palette, sourceImageUrl, unresolvedCount]
  );

  const stageCopy = [
    {
      eyebrow: "Step 1 / 4",
      title: "先导入一张现成图纸",
      description:
        "支持照片、截图和电子图纸。上传后先不要急着识别，先把真正的网格区域裁出来。",
    },
    {
      eyebrow: "Step 2 / 4",
      title: "只留下需要识别的网格区域",
      description:
        "尽量框住中间的像素格，不要把大面积边框、说明文字和色卡一起带进来。",
    },
    {
      eyebrow: "Step 3 / 4",
      title: "告诉系统该怎么理解这张图纸",
      description:
        "确认行列、品牌和颜色范围，再决定使用纯颜色识别还是带色号 OCR 的模式。",
    },
    {
      eyebrow: "Step 4 / 4",
      title: "检查识别结果并修正细节",
      description:
        "如果 OCR 有失败格，可以手动补码。所有失败格清理完以后，就可以进入拼豆编辑模式。",
    },
  ][currentStep];

  const sideNote = (
    <Card className="border-white/70 bg-white/82">
      <div className="space-y-3 text-sm leading-6 text-slate-600">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          导入建议
        </p>
        <p>如果原图带有透视倾斜，先在相册里裁正后再上传，识别会更稳定。</p>
        <p>只有在图纸真的印了色号时，才建议开启 OCR；纯配色图纸通常用颜色识别更快。</p>
      </div>
    </Card>
  );

  const preview = cells && palette ? (
    <PatternImportPreview
      cells={cells}
      palette={palette}
      brand={brand}
      unresolvedCount={unresolvedCount}
      onOpenCorrection={() => setShowCorrectionDialog(true)}
      onEnterBeadMode={handleEnterBeadMode}
    />
  ) : (
    <BeadImagePreviewCard
      badge={croppedImageUrl ? "Cropped Grid" : "Source Sheet"}
      title={croppedImageUrl ? "裁切预览" : "原图预览"}
      description={
        croppedImageUrl
          ? "这是接下来会被识别的网格区域。你可以在左侧继续修正行列和识别方式。"
          : "先上传原始图纸，再逐步裁切和识别。"
      }
      imageUrl={croppedImageUrl || sourceImageUrl}
      alt="图纸预览"
      fit="contain"
      meta={
        croppedImageUrl && geometry
          ? [
              `自动检测 ${geometry.rowCount} × ${geometry.colCount}`,
              `当前设定 ${rowCount || geometry.rowCount} × ${
                colCount || geometry.colCount
              }`,
            ]
          : imageMetadata
          ? [`原始尺寸 ${imageMetadata.width} × ${imageMetadata.height}`]
          : undefined
      }
      emptyTitle="等待图纸"
      emptyDescription="导入原图后，这里会显示原始图纸和裁切中的网格区域。"
    />
  );

  const footer =
    currentStep === 0 ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-500">
          导入成功后进入裁切步骤，先把真正的网格区域框出来。
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => setCurrentStep(1)}
          disabled={!sourceImageUrl}
        >
          继续裁切
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
        <p className="text-sm leading-6 text-slate-500">
          在裁切卡片里确认区域后，会自动进入下一步。
        </p>
      </div>
    ) : currentStep === 2 ? (
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => setCurrentStep(1)}
        >
          返回裁切
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleRerunGridDetection}
            disabled={cropping}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            {cropping ? "重新检测中..." : "重新识别行列"}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleRecognize}
            disabled={recognizing || cropping}
          >
            {recognizing ? "识别中..." : "开始识别图纸"}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => setCurrentStep(2)}
        >
          返回识别设置
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={handleEnterBeadMode}
          disabled={!cells || !palette || unresolvedCount > 0}
        >
          进入拼豆模式
        </Button>
      </div>
    );

  return (
    <>
      <BeadWorkflowShell
        title="现成图纸导入"
        description="把已经存在的拼豆图纸恢复成可编辑的数字版本。桌面端会保留并排预览，手机端则集中显示当前步骤，减少误触和视觉噪音。"
        badge="Pattern Import"
        icon={FileImage}
        accent="emerald"
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
                setSourceImageUrl(url);
                setImageMetadata(metadata);
                setCroppedImageUrl(null);
                setGeometry(null);
                setRowCount(0);
                setColCount(0);
                setBrand("MARD");
                setColorCount(defaultColorCount);
                setRecognitionMode("color");
                setError(null);
                resetRecognition();
                setCurrentStep(1);
              }}
              onClear={() => {
                setSourceImageUrl(null);
                setImageMetadata(null);
                setCroppedImageUrl(null);
                setGeometry(null);
                setRowCount(0);
                setColCount(0);
                setBrand("MARD");
                setColorCount(defaultColorCount);
                setRecognitionMode("color");
                setError(null);
                resetRecognition();
                setCurrentStep(0);
              }}
              onError={setError}
            />

            <Card className="border-dashed border-cream-100 bg-cream-50/70">
              <div className="space-y-2 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-900">什么样的原图更好识别</p>
                <p>优先使用正视角截图或拍照，尽量避免强反光、手指遮挡和阴影压住色号。</p>
              </div>
            </Card>
          </div>
        ) : currentStep === 1 ? (
          sourceImageUrl ? (
            <PatternCropper imageUrl={sourceImageUrl} onConfirm={handleCropConfirm} />
          ) : (
            <Card className="border-dashed border-cream-100 bg-cream-50/70">
              <p className="text-sm text-slate-600">
                请先完成上传，再进入裁切步骤。
              </p>
            </Card>
          )
        ) : currentStep === 2 ? (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <ScanLine className="h-4 w-4 text-emerald-500" />
                  识别参数
                </label>
                <p className="text-[11px] text-slate-500">
                  自动检测结果为 {geometry?.rowCount ?? 0} × {geometry?.colCount ?? 0}。如果你觉得不准，可以手动修正后再识别。
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">行数</label>
                  <input
                    type="number"
                    min="1"
                    max="256"
                    inputMode="numeric"
                    value={rowCount}
                    onChange={(event) => {
                      setRowCount(clampGridSize(Number(event.target.value)));
                      resetRecognition();
                    }}
                    className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">列数</label>
                  <input
                    type="number"
                    min="1"
                    max="256"
                    inputMode="numeric"
                    value={colCount}
                    onChange={(event) => {
                      setColCount(clampGridSize(Number(event.target.value)));
                      resetRecognition();
                    }}
                    className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">拼豆品牌</label>
                  <select
                    value={brand}
                    onChange={(event) => {
                      setBrand(event.target.value as ColorBrand);
                      resetRecognition();
                    }}
                    className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
                  >
                    {brands.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">颜色数量</label>
                  <select
                    value={colorCount}
                    onChange={(event) => {
                      setColorCount(Number(event.target.value));
                      resetRecognition();
                    }}
                    className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
                  >
                    {availableColorCounts.map((count) => (
                      <option key={count} value={count}>
                        {count} 色
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">识别方式</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecognitionMode("color");
                      resetRecognition();
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                      recognitionMode === "color"
                        ? "border-accent-brown bg-accent-brown/10 text-accent-brown"
                        : "border-cream-100 bg-cream-50/60 text-slate-600"
                    }`}
                  >
                    <span className="block font-semibold">颜色识别</span>
                    <span className="mt-1 block text-xs leading-5">
                      适合没有色号、只有网格和颜色块的图纸。
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecognitionMode("ocr");
                      resetRecognition();
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                      recognitionMode === "ocr"
                        ? "border-accent-brown bg-accent-brown/10 text-accent-brown"
                        : "border-cream-100 bg-cream-50/60 text-slate-600"
                    }`}
                  >
                    <span className="block font-semibold">OCR + 颜色</span>
                    <span className="mt-1 block text-xs leading-5">
                      适合带印刷色号的图纸，失败格可以在下一步手动补码。
                    </span>
                  </button>
                </div>
              </div>
            </Card>

            <Card className="border-white/70 bg-cream-50/75">
              <div className="space-y-2 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-900">识别范围说明</p>
                <p>
                  当前识别会限制在 {brand} 的 {colorCount} 色色卡范围内，OCR 也会按这个范围做校验与宽松匹配。
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-white/70 bg-cream-50/75">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Review Status
                </p>
                <h3 className="text-xl font-semibold text-slate-900">
                  已完成识别，接下来检查失败格
                </h3>
                <p className="text-sm leading-7 text-slate-600">
                  如果 OCR 还有失败格，点开手动校正即可。全部修正完成后就能进入拼豆编辑模式。
                </p>
              </div>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="bg-cream-50/75">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  网格
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {cells?.[0]?.length ?? 0} × {cells?.length ?? 0}
                </p>
              </Card>
              <Card className="bg-cream-50/75">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  失败格
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {unresolvedCount}
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

      <PatternCorrectionDialog
        open={showCorrectionDialog}
        imageUrl={croppedImageUrl ?? ""}
        geometry={geometry}
        cells={cells}
        palette={palette}
        brand={brand}
        onClose={() => setShowCorrectionDialog(false)}
        onApplyCode={handleApplyCode}
        onMarkEmpty={handleMarkEmpty}
      />
    </>
  );
}
