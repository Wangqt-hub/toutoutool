"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }

  if (item.status === "FAILED") {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }

  return <Clock3 className="h-4 w-4 text-amber-500" />;
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
  return PIXEL_STYLES.find((style) => style.id === styleId)?.name || "自定义";
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

const HISTORY_CACHE_KEY = "bead-ai-history-cache-v1";

type CachedHistoryPayload = {
  etag: string | null;
  items: AIGenerationHistoryItem[];
};

function readHistoryCache(): CachedHistoryPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(HISTORY_CACHE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedHistoryPayload;

    if (!Array.isArray(parsed.items)) {
      return null;
    }

    return {
      etag: parsed.etag ?? null,
      items: parsed.items,
    };
  } catch {
    return null;
  }
}

function writeHistoryCache(payload: CachedHistoryPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(payload));
}

function ProgressBar({
  progress,
  animated = false,
  tone = "rose",
}: {
  progress: number;
  animated?: boolean;
  tone?: "rose" | "emerald" | "red" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "red"
      ? "bg-red-500"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-rose-500";

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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

  const [currentStep, setCurrentStep] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePreviewLabel, setSourcePreviewLabel] = useState<string | null>(
    null
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [aiSubmitting, setAiSubmitting] = useState(false);

  const [selectedStyle, setSelectedStyle] = useState("anime");
  const [customPrompt, setCustomPrompt] = useState("");
  const [historyItems, setHistoryItems] = useState<AIGenerationHistoryItem[]>([]);
  const [historyEtag, setHistoryEtag] = useState<string | null>(null);
  const [optimisticItem, setOptimisticItem] =
    useState<AIGenerationHistoryItem | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null
  );

  const [canvasWidth, setCanvasWidth] = useState<number>(32);
  const [canvasHeight, setCanvasHeight] = useState<number>(32);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [algorithm, setAlgorithm] =
    useState<PixelAlgorithm>("edge-enhanced");
  const [colorCount, setColorCount] = useState<number>(24);
  const [brand, setBrand] = useState<ColorBrand>("MARD");

  const [grid, setGrid] = useState<BeadGrid | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [showColorNumbers, setShowColorNumbers] = useState(true);

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

  const resetPatternState = useCallback(() => {
    setGrid(null);
    setPalette(null);
  }, []);

  const syncAspectRatioSize = useCallback(
    (nextWidth: number, metadata: ImageMetadata | null = imageMetadata) => {
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
    },
    [imageMetadata]
  );

  const restoreHistorySelection = useCallback(
    async (item: AIGenerationHistoryItem, label: string) => {
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
    },
    [canvasWidth, maintainAspectRatio, resetPatternState, syncAspectRatioSize]
  );

  const applyLoadedHistory = useCallback(
    async (items: AIGenerationHistoryItem[]) => {
      setHistoryItems(items);
      const activeItem = items.find((item) => isAIGenerationActive(item.status));

      setActiveHistoryId(activeItem?.id || null);

      if (activeItem) {
        await restoreHistorySelection(activeItem, "当前任务原图");
        setCurrentStep((previous) => (previous < 2 ? 2 : previous));
        return;
      }

      setSelectedHistoryId(null);
      setSourcePreviewUrl(null);
      setSourcePreviewLabel(null);
      setImageFile(null);
      setImageMetadata(null);
      resetPatternState();
      setCurrentStep(0);
    },
    [resetPatternState, restoreHistorySelection]
  );

  const loadHistory = useCallback(
    async (etag?: string | null) => {
      if (!etag) {
        setHistoryLoading(true);
      }

      try {
        const response = await fetch("/api/ai-generate/history", {
          cache: "no-store",
          headers: etag
            ? {
                "If-None-Match": etag,
              }
            : undefined,
        });

        if (response.status === 304) {
          return;
        }

        const payload = await readJsonResponse(response);
        const items = (payload.data as AIGenerationHistoryItem[]) || [];
        const nextEtag = response.headers.get("etag");

        setHistoryEtag(nextEtag);
        writeHistoryCache({
          etag: nextEtag,
          items,
        });

        await applyLoadedHistory(items);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "加载 AI 历史记录失败。"
        );
      } finally {
        setHistoryLoading(false);
      }
    },
    [applyLoadedHistory]
  );

  useEffect(() => {
    const cachedHistory = readHistoryCache();

    if (cachedHistory) {
      setHistoryEtag(cachedHistory.etag);
      setHistoryLoading(false);
      applyLoadedHistory(cachedHistory.items).catch(() => {
        // Cached history hydration is best-effort.
      });
    }

    loadHistory(cachedHistory?.etag ?? null).catch(() => {
      // Error state is already handled in loadHistory.
    });
  }, [applyLoadedHistory, loadHistory]);

  useEffect(() => {
    if (historyLoading) {
      return;
    }

    writeHistoryCache({
      etag: historyEtag,
      items: historyItems,
    });
  }, [historyEtag, historyItems, historyLoading]);

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

        setCurrentStep((previous) => (previous < 2 ? 2 : previous));

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
  }, [activeHistoryId, restoreHistorySelection, selectedHistoryId]);

  const handleAIGenerate = useCallback(async () => {
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
    setHistoryOpen(false);
    setAiSubmitting(true);
    setCurrentStep(2);
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
      sourceImageProxyUrl: sourcePreviewUrl,
      sourceThumbnailUrl: sourcePreviewUrl,
      aiImageUrl: null,
      aiImageProxyUrl: null,
      aiThumbnailUrl: null,
      historyThumbnailUrl: sourcePreviewUrl,
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
  }, [
    customPrompt,
    imageFile,
    resetPatternState,
    restoreHistorySelection,
    selectedStyle,
    sourcePreviewUrl,
  ]);

  const handleCreatePattern = useCallback(async () => {
    if (!selectedCompletedHistory?.aiImageProxyUrl) {
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
        selectedCompletedHistory.aiImageProxyUrl,
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
  }, [
    algorithm,
    canvasHeight,
    canvasWidth,
    colorCount,
    maintainAspectRatio,
    resetPatternState,
    selectedCompletedHistory,
  ]);

  const handleSelectHistory = useCallback(
    async (item: AIGenerationHistoryItem) => {
      if (item.status !== "SUCCEEDED") {
        return;
      }

      setHistoryOpen(false);
      setError(null);
      await restoreHistorySelection(item, "历史记录原图");
      setCurrentStep(2);
    },
    [restoreHistorySelection]
  );

  const handleEnterBeadMode = useCallback(() => {
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
  }, [brand, grid, palette, router]);

  const steps = useMemo<BeadWorkflowStep[]>(
    () => [
      {
        id: "upload",
        label: "上传原图",
        caption: "先放进一张适合转成像素风的参考图。",
        available: true,
        complete: Boolean(sourcePreviewUrl),
      },
      {
        id: "style",
        label: "选择风格",
        caption: "决定这次 AI 生成走哪种像素语气。",
        available: Boolean(sourcePreviewUrl),
        complete: Boolean(sourcePreviewUrl && selectedStyle),
      },
      {
        id: "generate",
        label: "生成 AI 图",
        caption: "跟踪进度，或从历史记录里挑一张已完成结果。",
        available: Boolean(sourcePreviewUrl),
        complete: Boolean(selectedCompletedHistory),
      },
      {
        id: "pattern",
        label: "制作图纸",
        caption: "基于选中的 AI 图生成最终拼豆图纸。",
        available: Boolean(selectedCompletedHistory),
        complete: Boolean(grid && palette),
      },
    ],
    [grid, palette, selectedCompletedHistory, selectedStyle, sourcePreviewUrl]
  );

  const stageCopy = [
    {
      eyebrow: "Step 1 / 4",
      title: "先确定这次改造的原图",
      description:
        "上传完成后，后面的流程都会围绕这张原图展开。手机端会把流程收成单步页面，避免所有控件一次性堆满屏幕。",
    },
    {
      eyebrow: "Step 2 / 4",
      title: "给 AI 一个明确的像素方向",
      description:
        "先选预设风格，再决定要不要补充自定义提示词。这里的选择会直接影响后续 AI 历史记录中的结果风格。",
    },
    {
      eyebrow: "Step 3 / 4",
      title: "等待 AI 出图，或切回历史结果",
      description:
        "当前任务会在这里显示实时进度。你也可以通过右下角悬浮历史球切换到已完成记录，再继续制作最终图纸。",
    },
    {
      eyebrow: "Step 4 / 4",
      title: "把 AI 图压缩成可制作的拼豆图纸",
      description:
        "这一步决定最终图纸的尺寸、色数和算法。生成后可以继续进拼豆模式做逐格编辑。",
    },
  ][currentStep];

  const sideNote = (
    <Card className="border-white/70 bg-white/82">
      <div className="space-y-3 text-sm leading-6 text-slate-600">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          使用建议
        </p>
        <p>手机端更适合先生成 24 色左右的小尺寸版本，确认风格后再放大细调。</p>
        <p>如果主体轮廓不够稳定，优先换一张背景更干净的原图，通常比反复补提示词更有效。</p>
        <p>AI 历史只保留最近 10 条，完成后的结果可以随时通过右下角悬浮球重新打开。</p>
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
      fileNameBase="bead-ai-preview"
      emptyState={<></>}
      footer={
        <Button
          type="button"
          size="lg"
          className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600"
          onClick={handleEnterBeadMode}
          disabled={!grid || !palette}
        >
          <Grid3X3 className="mr-2 h-4 w-4" />
          进入拼豆模式
        </Button>
      }
    />
  ) : selectedHistory?.aiImageUrl ? (
    <BeadImagePreviewCard
      badge="AI Result"
      title="当前 AI 图片"
      description="右侧始终显示当前选中的 AI 结果，确认满意后再继续制作最终图纸。"
      imageUrl={selectedHistory.aiImageUrl}
      alt="AI 生成结果"
      fit="contain"
      meta={[
        `${selectedHistory.styleName} · ${selectedHistory.statusLabel}`,
        `生成于 ${formatDateTime(selectedHistory.createdAt)}`,
      ]}
      emptyTitle="等待 AI 出图"
      emptyDescription="任务完成后，这里会显示当前记录生成出来的像素风图片。"
    />
  ) : (
    <BeadImagePreviewCard
      badge={sourcePreviewUrl ? "Source Preview" : "Waiting"}
      title={sourcePreviewUrl ? "原图预览" : "等待上传"}
      description={
        sourcePreviewUrl
          ? "这张原图会贯穿整个 AI 流程。完成风格设定后，就可以开始异步生成。"
          : "先上传一张原图，右侧就会出现实时预览与后续步骤摘要。"
      }
      imageUrl={sourcePreviewUrl}
      alt="原图预览"
      fit="contain"
      meta={
        imageMetadata
          ? [
              `原始尺寸 ${imageMetadata.width} × ${imageMetadata.height}`,
              selectedHistory ? `当前记录 ${selectedHistory.styleName}` : "等待选择风格",
            ]
          : undefined
      }
      emptyTitle="还没有原图"
      emptyDescription="上传后这里会展示原图预览，桌面端会保持固定在右侧，手机端则跟随步骤显示在下方。"
    />
  );

  const footer =
    currentStep === 0 ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-500">
          原图上传完成后进入下一步，开始选择这次要生成的像素风格。
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => setCurrentStep(1)}
          disabled={!sourcePreviewUrl}
        >
          继续选风格
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
        <Button
          type="button"
          size="lg"
          className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600"
          onClick={handleAIGenerate}
          disabled={isTaskRunning || !imageFile}
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {isTaskRunning ? "AI 正在处理中..." : "开始 AI 生成"}
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
          返回风格
        </Button>
        {selectedCompletedHistory ? (
          <Button type="button" size="lg" onClick={() => setCurrentStep(3)}>
            继续制作图纸
          </Button>
        ) : (
          <Button type="button" size="lg" disabled>
            {isTaskRunning ? "等待 AI 完成" : "选择一条已完成记录"}
          </Button>
        )}
      </div>
    ) : (
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => setCurrentStep(2)}
        >
          返回 AI 结果
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={handleCreatePattern}
          disabled={patternLoading || !selectedCompletedHistory}
        >
          {patternLoading
            ? "正在生成最终图纸..."
            : grid && palette
            ? "重新生成最终图纸"
            : "生成最终图纸"}
        </Button>
      </div>
    );

  const historyPanel = (
    <>
      {historyOpen ? (
        <button
          type="button"
          aria-label="关闭历史记录"
          onClick={() => setHistoryOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/18 backdrop-blur-[1px]"
        />
      ) : null}

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-5 sm:right-5">
        {historyOpen ? (
          <div className="pointer-events-auto w-[min(92vw,380px)]">
            <Card className="max-h-[min(72vh,680px)] overflow-hidden border-white/85 bg-white/94 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur">
              <div className="flex items-center justify-between gap-3 border-b border-cream-100 pb-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    AI History
                  </p>
                  <h3 className="text-base font-semibold text-slate-900">
                    最近 10 条生成记录
                  </h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryOpen(false)}
                >
                  关闭
                </Button>
              </div>

              <div className="mt-4 max-h-[calc(min(72vh,680px)-92px)] space-y-3 overflow-y-auto pr-1">
                {historyLoading ? (
                  <div className="rounded-[24px] border border-dashed border-cream-100 bg-cream-50/70 px-4 py-6 text-sm text-slate-500">
                    正在加载历史记录...
                  </div>
                ) : displayedHistoryItems.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-cream-100 bg-cream-50/70 px-4 py-6 text-sm text-slate-500">
                    还没有 AI 历史记录。先上传原图并开始生成，记录会实时出现在这里。
                  </div>
                ) : (
                  displayedHistoryItems.map((item) => {
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
                        className={`w-full rounded-[24px] border px-3 py-3 text-left transition ${
                          selected
                            ? "border-rose-300 bg-rose-50"
                            : "border-cream-100 bg-white/82"
                        } ${
                          clickable
                            ? "hover:border-rose-200 hover:bg-rose-50/70"
                            : "cursor-not-allowed opacity-90"
                        }`}
                      >
                        <div className="flex gap-3">
                          <img
                            src={item.historyThumbnailUrl}
                            alt="历史记录缩略图"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            className="h-16 w-16 flex-shrink-0 rounded-2xl border border-cream-100 object-cover"
                          />

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                  {getHistoryItemIcon(item)}
                                  <span className="truncate">{item.styleName}</span>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  {formatDateTime(item.createdAt)}
                                </p>
                              </div>
                              {!clickable ? (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                                  进行中
                                </span>
                              ) : null}
                            </div>

                            <p className="line-clamp-2 text-[11px] leading-5 text-slate-500 break-all">
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

                            {item.errorMessage ? (
                              <p className="line-clamp-2 text-[11px] text-red-500">
                                {item.errorMessage}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setHistoryOpen((previous) => !previous)}
          className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 text-white shadow-[0_20px_40px_rgba(244,114,182,0.34)] transition-transform hover:scale-[1.03]"
          aria-label={historyOpen ? "关闭 AI 历史记录" : "打开 AI 历史记录"}
        >
          {currentTaskItem && isAIGenerationActive(currentTaskItem.status) ? (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-white px-1 text-[10px] font-bold text-rose-600">
              {currentTaskItem.progressPercent}%
            </span>
          ) : displayedHistoryItems.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-white px-1 text-[10px] font-bold text-slate-700">
              {displayedHistoryItems.length}
            </span>
          ) : null}

          <History className="h-7 w-7" />
        </button>
      </div>
    </>
  );

  return (
    <BeadWorkflowShell
      title="AI 生成像素画"
      description="把原图先交给 AI 变成像素风，再基于 AI 图生成最终拼豆图纸。桌面端会把步骤、内容和预览并排展开，手机端则改成单步聚焦式流程。"
      badge="AI Workflow"
      icon={Sparkles}
      accent="rose"
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
      floatingSlot={historyPanel}
    >
      {currentStep === 0 ? (
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
              setOptimisticItem(null);
              setCurrentStep(1);
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
              setOptimisticItem(null);
              setCurrentStep(0);
              resetPatternState();
              setError(null);
            }}
            onError={setError}
          />

          <Card className="border-dashed border-cream-100 bg-cream-50/70">
            <div className="space-y-2 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slate-900">什么样的原图更适合 AI 像素化？</p>
              <p>人物、宠物、玩具和插画通常更容易生成稳定的像素风效果，复杂背景则容易让主体边缘发散。</p>
              <p>如果你主要在手机上操作，先用构图简单的图更容易得到干净结果。</p>
            </div>
          </Card>
        </div>
      ) : currentStep === 1 ? (
        <div className="space-y-4">
          <StyleSelector
            selectedStyle={selectedStyle}
            onStyleSelect={setSelectedStyle}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            disabled={isTaskRunning}
          />

          <Card className="border-white/70 bg-cream-50/75">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Current Direction
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    风格
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {getStyleName(selectedStyle)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    提示词
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                    {customPrompt.trim() ||
                      PIXEL_STYLES.find((style) => style.id === selectedStyle)?.prompt ||
                      "pixel art style"}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : currentStep === 2 ? (
        <div className="space-y-4">
          <Card className="border-white/70 bg-white/84">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Generation Status
                  </p>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {currentTaskItem
                      ? currentTaskItem.statusLabel
                      : selectedCompletedHistory
                      ? "已选择完成记录"
                      : "等待开始生成"}
                  </h3>
                  <p className="text-sm leading-7 text-slate-600">
                    {currentTaskItem
                      ? "当前任务会自动轮询刷新。你也可以打开右下角悬浮球，切换到其它已完成历史记录。"
                      : selectedCompletedHistory
                      ? "这条记录已经生成完成，可以直接继续制作最终图纸。"
                      : "从上一步发起 AI 生成后，这里会显示进度和当前结果。"}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="mr-2 h-4 w-4" />
                  打开历史
                </Button>
              </div>

              <div className="rounded-[28px] border border-cream-100 bg-cream-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {selectedHistory ? getHistoryItemIcon(selectedHistory) : null}
                      <span>
                        {selectedHistory
                          ? `${selectedHistory.styleName} · ${selectedHistory.statusLabel}`
                          : "尚未选择记录"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {selectedHistory
                        ? formatDateTime(selectedHistory.createdAt)
                        : "开始生成后会创建一条新的任务记录。"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {selectedHistory?.progressPercent ?? 0}%
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <ProgressBar
                    progress={selectedHistory?.progressPercent ?? 0}
                    animated={selectedHistory?.status === "RUNNING"}
                    tone={
                      selectedHistory?.status === "FAILED"
                        ? "red"
                        : selectedHistory?.status === "SUCCEEDED"
                        ? "emerald"
                        : "rose"
                    }
                  />
                  <p className="text-xs leading-6 text-slate-500">
                    {selectedHistory?.prompt ||
                      "选中记录后，这里会显示它对应的提示词和当前进度。"}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {selectedHistory ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-white/70 bg-white/84">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    当前记录
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-cream-50/75 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        风格
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {selectedHistory.styleName}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-cream-50/75 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        状态
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {selectedHistory.statusLabel}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-cream-50/75 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      提示词
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600 break-all">
                      {selectedHistory.prompt}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="border-white/70 bg-cream-50/75">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    下一步
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedCompletedHistory
                      ? "可以继续做最终图纸"
                      : "先等待这条记录完成"}
                  </h3>
                  <p className="text-sm leading-7 text-slate-600">
                    {selectedCompletedHistory
                      ? "这条 AI 图已经可用。点击下方按钮进入图纸设置步骤，控制最终尺寸与色数。"
                      : "生成中的记录不可点击，但会在这里同步更新进度。任务完成后就能进入下一步。"}
                  </p>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed border-cream-100 bg-cream-50/70">
              <div className="space-y-2 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-900">还没有当前记录</p>
                <p>你可以从上一步开始新的 AI 生成，或者打开右下角的悬浮历史球，从已完成记录中挑一条继续制作。</p>
              </div>
            </Card>
          )}
        </div>
      ) : (
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  当前尺寸
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {canvasWidth} × {canvasHeight}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  色数 / 品牌
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {colorCount} 色 · {brand}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  当前来源
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {selectedCompletedHistory?.styleName || "等待 AI 结果"}
                </p>
              </div>
            </div>
          </Card>

          {grid && palette ? (
            <Card className="border-white/70 bg-white/84">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Ready To Make
                </p>
                <h3 className="text-xl font-semibold text-slate-900">
                  最终图纸已经生成完成
                </h3>
                <p className="text-sm leading-7 text-slate-600">
                  如果还想继续微调尺寸或色数，可以直接改完再重新生成；如果已经满意，就从右侧预览卡片进入拼豆模式。
                </p>
              </div>
            </Card>
          ) : (
            <Card className="border-dashed border-cream-100 bg-cream-50/70">
              <div className="space-y-2 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-900">下一步会生成最终图纸</p>
                <p>当前只会使用你选中的 AI 图片作为图纸来源，不会回退到原图。</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </BeadWorkflowShell>
  );
}
