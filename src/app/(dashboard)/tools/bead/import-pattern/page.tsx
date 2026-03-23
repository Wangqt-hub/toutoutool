"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileImage, RefreshCcw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BeadWorkflowShell,
  type BeadWorkflowStep,
} from "@/components/bead-tool/BeadWorkflowShell";
import { ImageUploadStep } from "@/components/bead-tool/ImageUploadStep";
import { PatternCorrectionDialog } from "@/components/bead-tool/PatternCorrectionDialog";
import { PatternCropper } from "@/components/bead-tool/PatternCropper";
import { PatternGridOverlayPreview } from "@/components/bead-tool/PatternGridOverlayPreview";
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
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [geometry, setGeometry] = useState<GridGeometry | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [colCount, setColCount] = useState(0);
  const [brand, setBrand] = useState<ColorBrand>("MARD");
  const [colorCount, setColorCount] = useState<number>(defaultColorCount);
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

  const adjustedGeometry = useMemo(
    () =>
      geometry && rowCount > 0 && colCount > 0
        ? applyGridSizeOverride(geometry, rowCount, colCount)
        : null,
    [colCount, geometry, rowCount]
  );

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
          : "裁切完成后自动识别网格失败，请重新选择图纸边缘。"
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
          : "重新识别行列失败，请检查裁切范围。"
      );
    } finally {
      setCropping(false);
    }
  };

  const handleRecognize = async () => {
    if (!croppedImageUrl || !adjustedGeometry || rowCount <= 0 || colCount <= 0) {
      setError("请先完成裁切，并确认行数和列数。");
      return;
    }

    setRecognizing(true);
    setError(null);

    try {
      const result = await recognizeImportedPattern({
        imageSource: croppedImageUrl,
        brand,
        colorCount,
        geometry: adjustedGeometry,
      });

      setGeometry(result.geometry);
      setCells(result.cells);
      setPalette(result.palette);
      setUnresolvedCount(result.unresolvedCount);
      setCurrentStep(3);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "识别失败，请稍后再试。"
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
      setError(`还有 ${unresolvedCount} 个未识别格，请先修正后再进入拼豆模式。`);
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
        caption: "导入原图",
        available: true,
        complete: Boolean(sourceImageUrl),
      },
      {
        id: "crop",
        label: "裁切网格",
        caption: "框选图纸区域",
        available: Boolean(sourceImageUrl),
        complete: Boolean(croppedImageUrl),
      },
      {
        id: "recognize",
        label: "识别参数",
        caption: "调整行列和色卡",
        available: Boolean(croppedImageUrl && geometry),
        complete: Boolean(cells && palette),
      },
      {
        id: "review",
        label: "查看结果",
        caption: "检查导入结果",
        available: Boolean(cells && palette),
        complete: Boolean(cells && palette && unresolvedCount === 0),
      },
    ],
    [cells, croppedImageUrl, geometry, palette, sourceImageUrl, unresolvedCount]
  );

  const stageCopy = [
    {
      eyebrow: "Step 1 / 4",
      title: "上传图纸",
    },
    {
      eyebrow: "Step 2 / 4",
      title: "裁切网格",
    },
    {
      eyebrow: "Step 3 / 4",
      title: "识别参数",
    },
    {
      eyebrow: "Step 4 / 4",
      title: "查看结果",
    },
  ][currentStep];

  const preview =
    currentStep === 3 && cells && palette ? (
      <PatternImportPreview
        cells={cells}
        palette={palette}
        brand={brand}
        unresolvedCount={unresolvedCount}
        onOpenCorrection={() => setShowCorrectionDialog(true)}
      />
    ) : undefined;

  const footer =
    currentStep === 0 ? (
      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          onClick={() => setCurrentStep(1)}
          disabled={!sourceImageUrl}
        >
          下一步
        </Button>
      </div>
    ) : currentStep === 1 ? (
      <div className="flex justify-start">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => setCurrentStep(0)}
        >
          返回上传
        </Button>
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
            {cropping ? "识别中..." : "重新识别行列"}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleRecognize}
            disabled={recognizing || cropping}
          >
            {recognizing ? "识别中..." : "开始识别"}
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
          返回识别参数
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
        title="导入现成图纸"
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
        error={error}
        preview={preview}
        footer={footer}
      >
        {currentStep === 0 ? (
          <ImageUploadStep
            previewUrl={sourceImageUrl}
            previewLabel={sourceImageUrl ? "当前图纸" : null}
            onImageSelect={(url) => {
              setSourceImageUrl(url);
              setCroppedImageUrl(null);
              setGeometry(null);
              setRowCount(0);
              setColCount(0);
              setBrand("MARD");
              setColorCount(defaultColorCount);
              setError(null);
              resetRecognition();
              setCurrentStep(1);
            }}
            onClear={() => {
              setSourceImageUrl(null);
              setCroppedImageUrl(null);
              setGeometry(null);
              setRowCount(0);
              setColCount(0);
              setBrand("MARD");
              setColorCount(defaultColorCount);
              setError(null);
              resetRecognition();
              setCurrentStep(0);
            }}
            onError={setError}
          />
        ) : currentStep === 1 ? (
          sourceImageUrl ? (
            <PatternCropper imageUrl={sourceImageUrl} onConfirm={handleCropConfirm} />
          ) : (
            <Card className="border-dashed border-cream-100 bg-cream-50/70">
              <p className="text-sm text-slate-600">请先上传图纸。</p>
            </Card>
          )
        ) : currentStep === 2 ? (
          <div className="space-y-4">
            {croppedImageUrl && adjustedGeometry ? (
              <PatternGridOverlayPreview
                imageUrl={croppedImageUrl}
                geometry={adjustedGeometry}
                rowCount={rowCount}
                colCount={colCount}
              />
            ) : null}

            <Card className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <ScanLine className="h-4 w-4 text-emerald-500" />
                  识别参数
                </label>

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
                    <label className="text-xs font-medium text-slate-700">
                      颜色数量
                    </label>
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
                {cells?.[0]?.length ?? 0} × {cells?.length ?? 0}
              </p>
            </Card>
            <Card className="bg-cream-50/75">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                未识别
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
