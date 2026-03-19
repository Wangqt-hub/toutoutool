"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileImage,
  RefreshCcw,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImageUploadStep, type ImageMetadata } from "@/components/bead-tool/ImageUploadStep";
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "裁切后自动识别行列失败，请重新裁切到像素格区域。"
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
      setError(
        `还有 ${unresolvedCount} 个失败格未修正，不能进入后续拼豆编辑器。`
      );
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
          <h1 className="text-2xl font-bold text-slate-900">拼豆图纸导入</h1>
          <FileImage className="w-6 h-6 text-green-500" />
        </div>
        <p className="text-sm text-slate-600">
          先裁切目标像素格区域，再自动识别行列数，最后按品牌、色数进行颜色识别或 OCR 识别。
        </p>
      </section>

      {error ? (
        <div className="bg-red-50 border border-red-100 rounded-3xl px-4 py-3 text-xs text-red-600">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] gap-4 items-start">
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
            }}
            onError={setError}
          />

          {sourceImageUrl ? (
            <PatternCropper
              imageUrl={sourceImageUrl}
              onConfirm={handleCropConfirm}
            />
          ) : null}

          {croppedImageUrl && geometry ? (
            <Card className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-blue-500" />
                  3. 确认行列与识别参数
                </label>
                <p className="text-[11px] text-slate-500">
                  自动检测结果：{geometry.rowCount} 行 × {geometry.colCount} 列。
                  检测不准时可手动修改。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    行数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="256"
                    value={rowCount}
                    onChange={(event) => {
                      setRowCount(clampGridSize(Number(event.target.value)));
                      resetRecognition();
                    }}
                    className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    列数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="256"
                    value={colCount}
                    onChange={(event) => {
                      setColCount(clampGridSize(Number(event.target.value)));
                      resetRecognition();
                    }}
                    className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    拼豆品牌
                  </label>
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

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  识别方式
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecognitionMode("color");
                      resetRecognition();
                    }}
                    className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-medium ${
                      recognitionMode === "color"
                        ? "border-accent-brown bg-accent-brown/10 text-accent-brown"
                        : "border-cream-100 bg-cream-50/60 text-slate-600"
                    }`}
                  >
                    颜色识别
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecognitionMode("ocr");
                      resetRecognition();
                    }}
                    className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-medium ${
                      recognitionMode === "ocr"
                        ? "border-accent-brown bg-accent-brown/10 text-accent-brown"
                        : "border-cream-100 bg-cream-50/60 text-slate-600"
                    }`}
                  >
                    OCR 识别
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-cream-50/70 border border-cream-100 px-3 py-3 text-[11px] text-slate-500 space-y-1">
                <p>
                  颜色识别和 OCR 匹配都会只在当前选择的 `{colorCount}` 色色卡范围内进行。
                </p>
                <p>
                  OCR 会按当前品牌和色数做校验，并支持宽松匹配，例如 MARD 的
                  `A4` 会匹配 `A04`，漫漫的 `B03` 会匹配 `B3`。
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRerunGridDetection}
                  disabled={cropping}
                >
                  <RefreshCcw className="w-4 h-4 mr-1" />
                  {cropping ? "识别中..." : "重新识别行列"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRecognize}
                  disabled={recognizing || cropping}
                >
                  {recognizing
                    ? recognitionMode === "ocr"
                      ? "OCR 识别中..."
                      : "颜色识别中..."
                    : recognitionMode === "ocr"
                      ? "开始 OCR 识别"
                      : "开始颜色识别"}
                </Button>
              </div>
            </Card>
          ) : null}

          {imageMetadata ? (
            <Card className="space-y-2">
              <div className="text-xs text-slate-700 font-medium">原图信息</div>
              <div className="text-[11px] text-slate-500">
                原始尺寸：{imageMetadata.width} × {imageMetadata.height}
              </div>
              {croppedImageUrl && geometry ? (
                <div className="text-[11px] text-slate-500">
                  当前裁切后自动检测：{geometry.rowCount} 行 × {geometry.colCount} 列
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <PatternImportPreview
          cells={cells}
          palette={palette}
          brand={brand}
          unresolvedCount={unresolvedCount}
          onOpenCorrection={() => setShowCorrectionDialog(true)}
          onEnterBeadMode={handleEnterBeadMode}
        />
      </div>

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
    </div>
  );
}
