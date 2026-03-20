"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Grid3X3,
  History,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
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
  AI_GENERATION_STATUS_LABELS,
  isAIGenerationActive,
  type AIGenerationHistoryItem,
} from "@/lib/bead/aiGeneration";
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
import { PIXEL_STYLES } from "@/lib/bead/pixelStyles";

function clampSize(value: number): number {
  return Math.max(8, Math.min(128, Math.round(value)));
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getHistoryItemIcon(item: AIGenerationHistoryItem) {
  if (item.status === "SUCCEEDED") {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  }

  if (item.status === "FAILED") {
    return <XCircle className="w-4 h-4 text-red-500" />;
  }

  return <Clock3 className="w-4 h-4 text-amber-500" />;
}

function mergeHistoryItems(
  items: AIGenerationHistoryItem[],
  nextItem: AIGenerationHistoryItem
): AIGenerationHistoryItem[] {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);

  if (existingIndex === -1) {
    return [nextItem, ...items].slice(0, 10);
  }

  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function getStyleName(styleId: string): string {
  return (
    PIXEL_STYLES.find((style) => style.id === styleId)?.name || "自定义"
  );
}

async function loadImageMetadata(url: string): Promise<ImageMetadata | null> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function readJsonResponse(response: Response) {
  const payload = (await response.json()) as {
    success: boolean;
    error?: string;
    data?: AIGenerationHistoryItem | AIGenerationHistoryItem[];
  };

  if (!response.ok && !payload.success) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function ProgressBar({
  progress,
  animated = false,
  tone = "violet",
}: {
  progress: number;
  animated?: boolean;
  tone?: "violet" | "emerald" | "red" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "red"
      ? "bg-red-500"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-violet-500";

  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${toneClass} ${
          animated ? "animate-pulse" : ""
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function AIGeneratePage() {
  const router = useRouter();

  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePreviewLabel, setSourcePreviewLabel] = useState<string | null>(
    null
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [aiSubmitting, setAiSubmitting] = useState<boolean>(false);

  const [selectedStyle, setSelectedStyle] = useState<string>("anime");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [historyItems, setHistoryItems] = useState<AIGenerationHistoryItem[]>(
    []
  );
  const [optimisticItem, setOptimisticItem] =
    useState<AIGenerationHistoryItem | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null
  );

  const [canvasWidth, setCanvasWidth] = useState<number>(32);
  const [canvasHeight, setCanvasHeight] = useState<number>(32);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [algorithm, setAlgorithm] =
    useState<PixelAlgorithm>("edge-enhanced");
  const [colorCount, setColorCount] = useState<number>(24);
  const [brand, setBrand] = useState<ColorBrand>("MARD");

  const [grid, setGrid] = useState<BeadGrid | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [patternLoading, setPatternLoading] = useState<boolean>(false);
  const [showColorNumbers, setShowColorNumbers] = useState<boolean>(true);

  const displayedHistoryItems = useMemo(() => {
    if (!optimisticItem) {
      return historyItems;
    }

    return [
      optimisticItem,
      ...historyItems.filter((item) => item.id !== optimisticItem.id),
    ];
  }, [historyItems, optimisticItem]);

  const selectedHistory =
    displayedHistoryItems.find((item) => item.id === selectedHistoryId) || null;
  const activeHistory =
    displayedHistoryItems.find((item) => item.id === activeHistoryId) || null;
  const currentTaskItem = optimisticItem || activeHistory;
  const selectedCompletedHistory =
    selectedHistory?.status === "SUCCEEDED" ? selectedHistory : null;
  const isTaskRunning =
    aiSubmitting ||
    Boolean(currentTaskItem && isAIGenerationActive(currentTaskItem.status));

  const resetPatternState = () => {
    setGrid(null);
    setPalette(null);
  };

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

  const restoreHistorySelection = async (
    item: AIGenerationHistoryItem,
    label: string
  ) => {
    setSelectedHistoryId(item.id);
    setSourcePreviewUrl(item.sourceImageUrl);
    setSourcePreviewLabel(label);
    setSelectedStyle(item.styleId || "anime");
    setCustomPrompt(item.prompt);
    setImageFile(null);
    resetPatternState();

    const preferredMetadata = await loadImageMetadata(
      item.aiImageUrl || item.sourceImageUrl
    );

    setImageMetadata(preferredMetadata);

    if (maintainAspectRatio && preferredMetadata) {
      syncAspectRatioSize(canvasWidth, preferredMetadata);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);

    try {
      const response = await fetch("/api/ai-generate/history", {
        cache: "no-store",
      });
      const payload = await readJsonResponse(response);
      const items = (payload.data as AIGenerationHistoryItem[]) || [];

      setHistoryItems(items);

      const activeItem = items.find((item) => isAIGenerationActive(item.status));
      const preferredItem = activeItem || null;

      setActiveHistoryId(activeItem?.id || null);

      if (preferredItem) {
        await restoreHistorySelection(
          preferredItem,
          preferredItem.status === "SUCCEEDED" ? "历史记录原图" : "当前任务原图"
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "加载 AI 历史记录失败。"
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory().catch(() => {
      // Error state is already handled in loadHistory.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeHistoryId) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/ai-generate/history/${activeHistoryId}`, {
          cache: "no-store",
        });
        const payload = await readJsonResponse(response);
        const item = payload.data as AIGenerationHistoryItem;

        if (cancelled) {
          return;
        }

        setOptimisticItem(null);
        setHistoryItems((items) => mergeHistoryItems(items, item));

        if (
          selectedHistoryId === activeHistoryId ||
          selectedHistoryId === null ||
          item.status !== "SUCCEEDED"
        ) {
          await restoreHistorySelection(
            item,
            item.status === "SUCCEEDED" ? "历史记录原图" : "当前任务原图"
          );
        }

        if (item.status === "FAILED") {
          setActiveHistoryId(null);
          setError(item.errorMessage || "AI 生成失败。");
          return;
        }

        if (!isAIGenerationActive(item.status)) {
          setActiveHistoryId(null);
        }
      } catch (pollError) {
        if (!cancelled) {
          setActiveHistoryId(null);
          setError(
            pollError instanceof Error
              ? pollError.message
              : "刷新 AI 生成状态失败。"
          );
        }
      }
    };

    poll().catch(() => {
      // Error state is already handled in poll.
    });

    const timer = window.setInterval(() => {
      poll().catch(() => {
        // Error state is already handled in poll.
      });
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeHistoryId, selectedHistoryId, maintainAspectRatio, canvasWidth]);

  const handleAIGenerate = async () => {
    if (!imageFile || !sourcePreviewUrl) {
      setError("请先上传图片。");
      return;
    }

    const styleName = getStyleName(selectedStyle);
    const prompt =
      customPrompt.trim() ||
      PIXEL_STYLES.find((style) => style.id === selectedStyle)?.prompt ||
      "pixel art style";
    const optimisticId = `optimistic-${Date.now()}`;

    setError(null);
    resetPatternState();
    setAiSubmitting(true);
    setSelectedHistoryId(optimisticId);
    setOptimisticItem({
      id: optimisticId,
      styleId: selectedStyle,
      styleName,
      prompt,
      status: "UPLOADING_SOURCE",
      statusLabel: AI_GENERATION_STATUS_LABELS.UPLOADING_SOURCE,
      progressPercent: 10,
      sourceImageUrl: sourcePreviewUrl,
      aiImageUrl: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    });

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

      const payload = await response.json();
      const item = payload.data as AIGenerationHistoryItem | null;

      setOptimisticItem(null);

      if (!payload.success) {
        if (item) {
          setHistoryItems((items) => mergeHistoryItems(items, item));
          setSelectedHistoryId(item.id);
          setActiveHistoryId(
            isAIGenerationActive(item.status) ? item.id : null
          );
          await restoreHistorySelection(item, "当前任务原图");
        }

        throw new Error(payload.error || "AI 生成失败。");
      }

      if (!item) {
        throw new Error("AI 生成接口没有返回任务记录。");
      }

      setHistoryItems((items) => mergeHistoryItems(items, item));
      setSelectedHistoryId(item.id);
      setActiveHistoryId(item.id);
      await restoreHistorySelection(item, "当前任务原图");
    } catch (generationError) {
      setOptimisticItem(null);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "AI 生成失败，请稍后再试。"
      );
    } finally {
      setAiSubmitting(false);
    }
  };

  const handleCreatePattern = async () => {
    if (!selectedCompletedHistory?.aiImageUrl) {
      setError("请先选择一条已完成的 AI 记录。");
      return;
    }

    setPatternLoading(true);
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
        selectedCompletedHistory.aiImageUrl,
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
          : "生成最终图纸时出错，请稍后再试。"
      );
    } finally {
      setPatternLoading(false);
    }
  };

  const handleSelectHistory = async (item: AIGenerationHistoryItem) => {
    if (item.status !== "SUCCEEDED") {
      return;
    }

    setError(null);
    await restoreHistorySelection(item, "历史记录原图");
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

  const currentProgressTone =
    currentTaskItem?.status === "FAILED"
      ? "red"
      : currentTaskItem?.status === "SUCCEEDED"
      ? "emerald"
      : "violet";

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
          先用 AI 生成像素风图片，再基于 AI 历史结果继续生成最终拼豆图纸。
        </p>
      </section>

      {error && (
        <div className="rounded-3xl px-4 py-3 text-xs bg-red-50 border border-red-100 text-red-600">
          提示：{error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <ImageUploadStep
            previewUrl={sourcePreviewUrl}
            previewLabel={sourcePreviewLabel}
            disabled={isTaskRunning}
            onImageSelect={(url, file, metadata) => {
              setSourcePreviewUrl(url);
              setSourcePreviewLabel(file.name);
              setImageFile(file);
              setImageMetadata(metadata);
              setSelectedHistoryId(null);
              resetPatternState();
              setError(null);

              if (maintainAspectRatio) {
                syncAspectRatioSize(canvasWidth, metadata);
              }
            }}
            onClear={() => {
              setSourcePreviewUrl(null);
              setSourcePreviewLabel(null);
              setImageFile(null);
              setImageMetadata(null);
              setSelectedHistoryId(null);
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
            disabled={isTaskRunning}
          />

          <Card className="space-y-3">
            <Button
              type="button"
              size="lg"
              className="relative w-full overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-80"
              onClick={handleAIGenerate}
              disabled={isTaskRunning || !imageFile}
            >
              {currentTaskItem && (
                <span
                  className={`absolute inset-y-0 left-0 opacity-20 ${
                    currentTaskItem.status === "RUNNING" ? "animate-pulse" : ""
                  } ${currentProgressTone === "red" ? "bg-red-200" : "bg-white"}`}
                  style={{ width: `${currentTaskItem.progressPercent}%` }}
                />
              )}
              <span className="relative flex items-center justify-center gap-2">
                <Wand2 className="w-4 h-4" />
                <span>
                  {currentTaskItem
                    ? `${currentTaskItem.statusLabel} ${currentTaskItem.progressPercent}%`
                    : "AI 生成像素画"}
                </span>
              </span>
            </Button>

            {currentTaskItem && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{currentTaskItem.statusLabel}</span>
                  <span>{currentTaskItem.progressPercent}%</span>
                </div>
                <ProgressBar
                  progress={currentTaskItem.progressPercent}
                  animated={currentTaskItem.status === "RUNNING"}
                  tone={currentProgressTone}
                />
              </div>
            )}
          </Card>

          {selectedHistory && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    当前记录
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedHistory.styleName} ·{" "}
                    {formatDateTime(selectedHistory.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {getHistoryItemIcon(selectedHistory)}
                  <span>{selectedHistory.statusLabel}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs text-slate-600">
                <p className="font-medium text-slate-700 mb-1">提示词</p>
                <p className="line-clamp-3 break-all">{selectedHistory.prompt}</p>
              </div>

              {selectedHistory.aiImageUrl ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-700">AI 图片预览</p>
                  <img
                    src={selectedHistory.aiImageUrl}
                    alt="AI 图片预览"
                    className="w-full rounded-2xl border border-cream-100"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-cream-100 bg-cream-50/60 px-4 py-5 text-xs text-slate-500">
                  当前记录尚未生成完成，AI 图片会在任务完成后出现在这里。
                </div>
              )}
            </Card>
          )}

          {selectedCompletedHistory && (
            <>
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
                disabled={patternLoading}
              >
                {patternLoading
                  ? "正在生成最终图纸..."
                  : "使用当前 AI 图片生成最终图纸"}
              </Button>
            </>
          )}

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  AI 历史记录
                </h3>
              </div>
              <span className="text-xs text-slate-500">每位用户最多 10 条</span>
            </div>

            {historyLoading ? (
              <p className="text-xs text-slate-500">正在加载历史记录...</p>
            ) : displayedHistoryItems.length === 0 ? (
              <p className="text-xs text-slate-500">
                还没有 AI 生成记录，上传图片后开始生成。
              </p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {displayedHistoryItems.map((item) => {
                  const clickable = item.status === "SUCCEEDED";
                  const selected = item.id === selectedHistoryId;
                  const tone =
                    item.status === "FAILED"
                      ? "red"
                      : item.status === "SUCCEEDED"
                      ? "emerald"
                      : "amber";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectHistory(item)}
                      disabled={!clickable}
                      className={`w-full text-left rounded-3xl border px-3 py-3 transition-colors ${
                        selected
                          ? "border-purple-300 bg-purple-50"
                          : "border-cream-100 bg-white/80"
                      } ${
                        clickable
                          ? "hover:border-purple-200"
                          : "cursor-not-allowed opacity-90"
                      }`}
                    >
                      <div className="flex gap-3">
                        <img
                          src={item.aiImageUrl || item.sourceImageUrl}
                          alt="历史记录缩略图"
                          className="h-16 w-16 rounded-2xl border border-cream-100 object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {getHistoryItemIcon(item)}
                              <span className="truncate text-sm font-medium text-slate-900">
                                {item.styleName}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 flex-shrink-0">
                              {formatDateTime(item.createdAt)}
                            </span>
                          </div>

                          <p className="line-clamp-2 text-[11px] text-slate-500 break-all">
                            {item.prompt}
                          </p>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>{item.statusLabel}</span>
                              <span>{item.progressPercent}%</span>
                            </div>
                            <ProgressBar
                              progress={item.progressPercent}
                              animated={item.status === "RUNNING"}
                              tone={tone}
                            />
                          </div>

                          {item.errorMessage && (
                            <p className="text-[11px] text-red-500 line-clamp-2">
                              {item.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
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
                  <p>选择一条已完成的 AI 历史记录，然后继续生成最终图纸。</p>
                </div>
              </div>
            }
            footer={
              <Button
                type="button"
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-600/90 hover:to-pink-600/90 text-white"
                onClick={handleEnterBeadMode}
                disabled={!grid || !palette}
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
