"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useBeadWorkspaceLaunch } from "@/components/bead-tool/useBeadWorkspaceLaunch";
import { BeadImagePreviewCard } from "@/components/bead-tool/BeadImagePreviewCard";
import { AutoRefreshImage } from "@/components/ui/AutoRefreshImage";
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
import { createWorkspaceName } from "@/lib/bead/workspaces";

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

function getPreferredSourceImageUrl(item: AIGenerationHistoryItem): string {
  return item.sourceImageUrl || item.sourceImageProxyUrl;
}

function getPreferredAIImageUrl(
  item: AIGenerationHistoryItem
): string | null {
  return item.aiImageUrl || item.aiImageProxyUrl;
}

function getPreferredHistoryThumbnailUrl(
  item: AIGenerationHistoryItem
): string {
  return (
    item.historyThumbnailUrl ||
    item.aiThumbnailUrl ||
    item.sourceThumbnailUrl ||
    getPreferredAIImageUrl(item) ||
    getPreferredSourceImageUrl(item)
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

function getSmoothedGenerationProgress(
  item: AIGenerationHistoryItem,
  now: number
): number {
  if (!isAIGenerationActive(item.status)) {
    return item.progressPercent;
  }

  const createdAt = Number.isNaN(Date.parse(item.createdAt))
    ? now
    : Date.parse(item.createdAt);
  const updatedAt = Number.isNaN(Date.parse(item.updatedAt))
    ? createdAt
    : Date.parse(item.updatedAt);
  const actualProgress = Math.max(0, Math.min(100, item.progressPercent));

  if (item.id.startsWith("optimistic-")) {
    const elapsed = Math.max(0, now - createdAt);
    const eased =
      actualProgress + (88 - actualProgress) * (1 - Math.exp(-elapsed / 12000));

    return Math.max(actualProgress, Math.min(88, Math.round(eased)));
  }

  const stageConfig =
    item.status === "UPLOADING_SOURCE"
      ? { target: 24, anchor: createdAt, duration: 2500 }
      : item.status === "PENDING"
      ? { target: 58, anchor: updatedAt, duration: 9000 }
      : item.status === "RUNNING"
      ? { target: 86, anchor: updatedAt, duration: 22000 }
      : { target: 96, anchor: updatedAt, duration: 6000 };

  const elapsed = Math.max(0, now - stageConfig.anchor);
  const eased =
    actualProgress +
    (stageConfig.target - actualProgress) *
      (1 - Math.exp(-elapsed / stageConfig.duration));

  return Math.max(
    actualProgress,
    Math.min(stageConfig.target, Math.round(eased))
  );
}

const HISTORY_CACHE_KEY = "bead-ai-history-cache-v1";
const SIGNED_IMAGE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

type CachedHistoryPayload = {
  etag: string | null;
  items: AIGenerationHistoryItem[];
  cachedAt: number;
};

function isSignedImageCacheFresh(cachedAt: number) {
  return Date.now() - cachedAt < SIGNED_IMAGE_CACHE_MAX_AGE_MS;
}

function readHistoryCache(): CachedHistoryPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(HISTORY_CACHE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as
      | CachedHistoryPayload
      | { etag?: string | null; items?: AIGenerationHistoryItem[] };

    if (!Array.isArray(parsed.items)) {
      return null;
    }

    return {
      etag: parsed.etag ?? null,
      items: parsed.items,
      cachedAt: "cachedAt" in parsed && typeof parsed.cachedAt === "number" ? parsed.cachedAt : 0,
    };
  } catch {
    return null;
  }
}

function writeHistoryCache(payload: Omit<CachedHistoryPayload, "cachedAt">) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    HISTORY_CACHE_KEY,
    JSON.stringify({
      ...payload,
      cachedAt: Date.now(),
    })
  );
}


function ProgressBar({
  progress,
  animated = false,
  tone = "rose",
  className = "",
}: {
  progress: number;
  animated?: boolean;
  tone?: "rose" | "emerald" | "red" | "amber";
  className?: string;
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
    <div className={`overflow-hidden rounded-full bg-slate-100 ${className}`}>
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
  const { launchWorkspace, launching, workspaceLaunchDialog } =
    useBeadWorkspaceLaunch({
      onError: setError,
    });

  const [selectedStyle, setSelectedStyle] = useState("anime");
  const [customPrompt, setCustomPrompt] = useState("");
  const [historyItems, setHistoryItems] = useState<AIGenerationHistoryItem[]>([]);
  const [historyEtag, setHistoryEtag] = useState<string | null>(null);
  const [optimisticItem, setOptimisticItem] =
    useState<AIGenerationHistoryItem | null>(null);
  const [progressNow, setProgressNow] = useState(() => Date.now());
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
  const hasWorkingSelectionRef = useRef(false);
  const selectedHistoryIdRef = useRef<string | null>(null);
  const canvasWidthRef = useRef(canvasWidth);
  const maintainAspectRatioRef = useRef(maintainAspectRatio);
  const imageMetadataRef = useRef<ImageMetadata | null>(imageMetadata);
  const historyRequestIdRef = useRef(0);
  const restoreRequestIdRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const pollFailureCountRef = useRef(0);
  const activeHistoryEtagRef = useRef<string | null>(null);
  const imageMetadataCacheRef = useRef<Map<string, ImageMetadata | null>>(
    new Map()
  );
  const historyItemRefreshPromisesRef = useRef<
    Map<string, Promise<AIGenerationHistoryItem | null>>
  >(new Map());

  const getDisplayedProgress = useCallback(
    (item: AIGenerationHistoryItem | null | undefined) =>
      item ? getSmoothedGenerationProgress(item, progressNow) : 0,
    [progressNow]
  );

  useEffect(() => {
    hasWorkingSelectionRef.current = Boolean(
      sourcePreviewUrl || imageFile || selectedHistoryId || grid || palette
    );
  }, [grid, imageFile, palette, selectedHistoryId, sourcePreviewUrl]);

  useEffect(() => {
    selectedHistoryIdRef.current = selectedHistoryId;
  }, [selectedHistoryId]);

  useEffect(() => {
    canvasWidthRef.current = canvasWidth;
  }, [canvasWidth]);

  useEffect(() => {
    maintainAspectRatioRef.current = maintainAspectRatio;
  }, [maintainAspectRatio]);

  useEffect(() => {
    imageMetadataRef.current = imageMetadata;
  }, [imageMetadata]);

  useEffect(() => {
    activeHistoryEtagRef.current = null;
  }, [activeHistoryId]);

  useEffect(() => {
    if (!currentTaskItem || !isAIGenerationActive(currentTaskItem.status)) {
      return undefined;
    }

    setProgressNow(Date.now());

    const timer = window.setInterval(() => {
      setProgressNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentTaskItem]);

  const resetPatternState = useCallback(() => {
    setGrid(null);
    setPalette(null);
  }, []);

  const resetImportFlow = useCallback(() => {
    setSourcePreviewUrl(null);
    setSourcePreviewLabel(null);
    setImageFile(null);
    setImageMetadata(null);
    setSelectedHistoryId(null);
    setOptimisticItem(null);
    setActiveHistoryId(null);
    setSelectedStyle("anime");
    setCustomPrompt("");
    setHistoryOpen(false);
    setError(null);
    resetPatternState();
    setCurrentStep(0);
  }, [resetPatternState]);

  const syncAspectRatioSize = useCallback(
    (nextWidth: number, metadata?: ImageMetadata | null) => {
      const effectiveMetadata = metadata ?? imageMetadataRef.current;

      if (!effectiveMetadata) {
        setCanvasWidth(clampSize(nextWidth));
        return;
      }

      const dimensions = calculateAspectRatioDimensionsFromWidth(
        effectiveMetadata.width,
        effectiveMetadata.height,
        nextWidth
      );

      setCanvasWidth(dimensions.width);
      setCanvasHeight(dimensions.height);
    },
    []
  );

  const loadCachedImageMetadata = useCallback(async (url: string) => {
    const cache = imageMetadataCacheRef.current;

    if (cache.has(url)) {
      return cache.get(url) ?? null;
    }

    const metadata = await loadImageMetadata(url);
    cache.set(url, metadata);
    return metadata;
  }, []);

  const restoreHistorySelection = useCallback(
    async (item: AIGenerationHistoryItem, label: string) => {
      const requestId = ++restoreRequestIdRef.current;
      const sourceImageUrl = getPreferredSourceImageUrl(item);
      const previewImageUrl =
        getPreferredAIImageUrl(item) || sourceImageUrl;

      setSelectedHistoryId(item.id);
      setSourcePreviewUrl(sourceImageUrl);
      setSourcePreviewLabel(label);
      setSelectedStyle(item.styleId || "anime");
      setCustomPrompt(item.prompt);
      setImageFile(null);
      resetPatternState();

      const preferredMetadata = await loadCachedImageMetadata(previewImageUrl);

      if (restoreRequestIdRef.current !== requestId) {
        return;
      }

      setImageMetadata(preferredMetadata);

      if (maintainAspectRatioRef.current && preferredMetadata) {
        syncAspectRatioSize(canvasWidthRef.current, preferredMetadata);
      }
    },
    [loadCachedImageMetadata, resetPatternState, syncAspectRatioSize]
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

      if (hasWorkingSelectionRef.current) {
        return;
      }
    },
    [restoreHistorySelection]
  );

  const loadHistory = useCallback(
    async (etag?: string | null) => {
      const requestId = ++historyRequestIdRef.current;

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

        if (historyRequestIdRef.current !== requestId) {
          return;
        }

        setHistoryEtag(nextEtag);
        writeHistoryCache({
          etag: nextEtag,
          items,
        });

        await applyLoadedHistory(items);
      } catch (loadError) {
        if (historyRequestIdRef.current === requestId) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "加载 AI 历史记录失败。"
          );
        }
      } finally {
        if (historyRequestIdRef.current === requestId) {
          setHistoryLoading(false);
        }
      }
    },
    [applyLoadedHistory]
  );

  const refreshHistoryItem = useCallback(
    async (historyId: string) => {
      const existing = historyItemRefreshPromisesRef.current.get(historyId);

      if (existing) {
        return existing;
      }

      const promise = (async () => {
        const response = await fetch(`/api/ai-generate/history/${historyId}`, {
          cache: "no-store",
        });
        const payload = await readJsonResponse(response);
        const item = (payload.data as AIGenerationHistoryItem | null) || null;

        if (!item) {
          return null;
        }

        setHistoryItems((items) => mergeHistoryItems(items, item));

        if (
          selectedHistoryIdRef.current === historyId ||
          activeHistoryId === historyId
        ) {
          await restoreHistorySelection(
            item,
            item.status === "SUCCEEDED" ? "??????" : "??????"
          );
        }

        return item;
      })()
        .catch(() => null)
        .finally(() => {
          historyItemRefreshPromisesRef.current.delete(historyId);
        });

      historyItemRefreshPromisesRef.current.set(historyId, promise);
      return promise;
    },
    [activeHistoryId, restoreHistorySelection]
  );

  const refreshHistoryThumbnailUrl = useCallback(
    async (historyId: string) => {
      const item = await refreshHistoryItem(historyId);
      return item ? getPreferredHistoryThumbnailUrl(item) : null;
    },
    [refreshHistoryItem]
  );

  const refreshHistoryAIImageUrl = useCallback(
    async (historyId: string) => {
      const item = await refreshHistoryItem(historyId);
      return item ? getPreferredAIImageUrl(item) : null;
    },
    [refreshHistoryItem]
  );

  const refreshHistorySourceImageUrl = useCallback(
    async (historyId: string) => {
      const item = await refreshHistoryItem(historyId);
      return item ? getPreferredSourceImageUrl(item) : null;
    },
    [refreshHistoryItem]
  );


  useEffect(() => {
    const cachedHistory = readHistoryCache();
    const canHydrateCachedHistory =
      cachedHistory && isSignedImageCacheFresh(cachedHistory.cachedAt);

    if (canHydrateCachedHistory) {
      setHistoryEtag(cachedHistory.etag);
      setHistoryLoading(false);
      applyLoadedHistory(cachedHistory.items).catch(() => {
        // Cached history hydration is best-effort.
      });
    }

    loadHistory(canHydrateCachedHistory ? cachedHistory?.etag ?? null : null).catch(() => {
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
    let timer: number | null = null;

    const scheduleNextPoll = (
      status: AIGenerationHistoryItem["status"] | null,
      failureCount: number
    ) => {
      if (cancelled) {
        return;
      }

      const baseDelay =
        failureCount > 0
          ? Math.min(15000, 2000 * 2 ** (failureCount - 1))
          : status === "UPLOADING_SOURCE"
          ? 2000
          : status === "PENDING"
          ? 4000
          : 6000;
      const delay =
        document.visibilityState === "hidden"
          ? Math.max(baseDelay, 15000)
          : baseDelay;

      timer = window.setTimeout(() => {
        void poll();
      }, delay);
    };

    const poll = async () => {
      if (cancelled || pollInFlightRef.current) {
        return;
      }

      if (document.visibilityState === "hidden") {
        scheduleNextPoll(null, pollFailureCountRef.current);
        return;
      }

      pollInFlightRef.current = true;

      try {
        const headers: HeadersInit = {};

        if (activeHistoryEtagRef.current) {
          headers["If-None-Match"] = activeHistoryEtagRef.current;
        }

        const response = await fetch(`/api/ai-generate/history/${activeHistoryId}`, {
          cache: "no-store",
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        });

        if (cancelled) {
          return;
        }

        if (response.status === 304) {
          pollFailureCountRef.current = 0;
          setError(null);
          scheduleNextPoll(null, 0);
          return;
        }

        const nextEtag = response.headers.get("etag");

        if (nextEtag) {
          activeHistoryEtagRef.current = nextEtag;
        }

        const payload = await readJsonResponse(response);
        const item = payload.data as AIGenerationHistoryItem;

        pollFailureCountRef.current = 0;
        setError(null);
        setOptimisticItem(null);
        setHistoryItems((items) => mergeHistoryItems(items, item));

        if (
          selectedHistoryIdRef.current === activeHistoryId ||
          selectedHistoryIdRef.current === null ||
          item.status !== "SUCCEEDED"
        ) {
          await restoreHistorySelection(
            item,
            item.status === "SUCCEEDED" ? "\u5386\u53F2\u8BB0\u5F55\u539F\u56FE" : "\u5F53\u524D\u4EFB\u52A1\u539F\u56FE"
          );
        }

        setCurrentStep((previous) => (previous < 2 ? 2 : previous));

        if (item.status === "FAILED") {
          setActiveHistoryId(null);
          setError(item.errorMessage || "AI \u751F\u6210\u5931\u8D25\u3002");
          return;
        }

        if (!isAIGenerationActive(item.status)) {
          setActiveHistoryId(null);
          return;
        }

        scheduleNextPoll(item.status, 0);
      } catch (pollError) {
        if (!cancelled) {
          pollFailureCountRef.current += 1;
          const message =
            pollError instanceof Error
              ? pollError.message
              : "\u5237\u65B0 AI \u751F\u6210\u72B6\u6001\u5931\u8D25\u3002";

          if (
            message.includes("Authentication required") ||
            message.includes("Generation record not found")
          ) {
            setActiveHistoryId(null);
            return;
          }

          setError(
            message === "Failed to fetch"
              ? "\u7F51\u7EDC\u6CE2\u52A8\uFF0C\u6B63\u5728\u91CD\u8BD5\u83B7\u53D6 AI \u7ED3\u679C\u3002"
              : message
          );
          scheduleNextPoll(null, pollFailureCountRef.current);
        }
      } finally {
        pollInFlightRef.current = false;
      }
    };

    void poll();

    return () => {
      cancelled = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      pollInFlightRef.current = false;
    };
  }, [activeHistoryId, restoreHistorySelection]);

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
        throw new Error("AI 接口没有返回任务记录。");
      }

      setHistoryItems((items) => mergeHistoryItems(items, item));
      setSelectedHistoryId(item.id);
      setActiveHistoryId(isAIGenerationActive(item.status) ? item.id : null);
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
    const aiImageUrl = selectedCompletedHistory
      ? selectedCompletedHistory.aiImageProxyUrl ||
        getPreferredAIImageUrl(selectedCompletedHistory)
      : null;

    if (!aiImageUrl) {
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
        aiImageUrl,
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

    void launchWorkspace({
      name: createWorkspaceName(
        "ai",
        selectedCompletedHistory
          ? `${selectedCompletedHistory.styleName} 图纸`
          : "AI 图纸"
      ),
      sourceType: "ai",
      brand,
      patternData: {
        grid,
        palette,
      },
    });
  }, [brand, grid, launchWorkspace, palette, selectedCompletedHistory]);

  const steps = useMemo<BeadWorkflowStep[]>(
    () => [
      {
        id: "upload",
        label: "上传原图",
        caption: "导入图片",
        available: true,
        complete: Boolean(sourcePreviewUrl),
      },
      {
        id: "style",
        label: "选择风格",
        caption: "设置提示词",
        available: Boolean(sourcePreviewUrl),
        complete: Boolean(sourcePreviewUrl && selectedStyle),
      },
      {
        id: "generate",
        label: "AI 结果",
        caption: "查看进度与历史",
        available: Boolean(sourcePreviewUrl),
        complete: Boolean(selectedCompletedHistory),
      },
      {
        id: "pattern",
        label: "最终图纸",
        caption: "生成拼豆图纸",
        available: Boolean(selectedCompletedHistory),
        complete: Boolean(grid && palette),
      },
    ],
    [grid, palette, selectedCompletedHistory, selectedStyle, sourcePreviewUrl]
  );

  const stageCopy = [
    {
      eyebrow: "Step 1 / 4",
      title: "上传原图",
    },
    {
      eyebrow: "Step 2 / 4",
      title: "选择风格",
    },
    {
      eyebrow: "Step 3 / 4",
      title: "AI 结果",
    },
    {
      eyebrow: "Step 4 / 4",
      title: "最终图纸",
    },
  ][currentStep];

  const preview = (() => {
    if (currentStep === 3 && grid && palette) {
      return (
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
              disabled={!grid || !palette || launching}
            >
              <Grid3X3 className="mr-2 h-4 w-4" />
              {launching ? "进入工作台中..." : "进入拼豆模式"}
            </Button>
          }
        />
      );
    }

    const selectedHistoryAIImageUrl = selectedHistory
      ? getPreferredAIImageUrl(selectedHistory)
      : null;

    if (currentStep === 2 && selectedHistory && selectedHistoryAIImageUrl) {
      return (
        <BeadImagePreviewCard
          badge="AI Result"
          title="当前 AI 图片"
          description="已完成的 AI 结果。"
          imageUrl={selectedHistoryAIImageUrl}
          alt="AI 生成结果"
          fit="contain"
          meta={[
            `${selectedHistory.styleName} · ${selectedHistory.statusLabel}`,
            formatDateTime(selectedHistory.createdAt),
          ]}
          emptyTitle="等待 AI 结果"
          emptyDescription="任务完成后这里会显示 AI 图片。"
        />
      );
    }

    return undefined;
  })();

  const footer = (() => {
    if (currentStep === 0) {
      return (
        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={() => setCurrentStep(1)}
            disabled={!sourcePreviewUrl}
          >
            下一步
          </Button>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
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
            {isTaskRunning ? "生成中..." : "AI 生成像素画"}
          </Button>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
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
              下一步
            </Button>
          ) : (
            <Button type="button" size="lg" disabled>
              {isTaskRunning ? "等待 AI 完成" : "选择已完成记录"}
            </Button>
          )}
        </div>
      );
    }

    return (
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
            ? "生成中..."
            : grid && palette
            ? "重新生成图纸"
            : "生成图纸"}
        </Button>
      </div>
    );
  })();

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
                    最近 10 条记录
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
                    还没有 AI 历史记录。                  </div>
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
                            src={getPreferredHistoryThumbnailUrl(item)}
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
                              {item.status === "FAILED" ? (
                                <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-500">
                                  失败
                                </span>
                              ) : isAIGenerationActive(item.status) ? (
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
                                <span>{getDisplayedProgress(item)}%</span>
                              </div>
                              <ProgressBar
                                progress={getDisplayedProgress(item)}
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
              {getDisplayedProgress(currentTaskItem)}%
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
    <>
      <BeadWorkflowShell
        title="AI 生成像素画"
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
        error={error}
        preview={preview}
        mobilePreviewPlacement={currentStep === 2 ? "before" : "after"}
        footer={footer}
        floatingSlot={historyPanel}
      >
        {currentStep === 0 ? (
        <ImageUploadStep
          previewUrl={sourcePreviewUrl}
          previewLabel={sourcePreviewLabel}
          onRefreshPreviewUrl={
            selectedHistory ? () => refreshHistorySourceImageUrl(selectedHistory.id) : undefined
          }
          disabled={isTaskRunning}
          allowReplaceWhenPreviewed={false}
          onImageSelect={(url, file, metadata) => {
            setSourcePreviewUrl(url);
            setSourcePreviewLabel(file.name);
            setImageFile(file);
            setImageMetadata(metadata);
            setSelectedHistoryId(null);
            setOptimisticItem(null);
            setError(null);
            resetPatternState();
            setCurrentStep(1);

            if (maintainAspectRatio) {
              syncAspectRatioSize(canvasWidth, metadata);
            }
          }}
          onClear={resetImportFlow}
          onError={setError}
        />
      ) : currentStep === 1 ? (
        <StyleSelector
          selectedStyle={selectedStyle}
          onStyleSelect={setSelectedStyle}
          customPrompt={customPrompt}
          onCustomPromptChange={setCustomPrompt}
          disabled={isTaskRunning}
        />
      ) : currentStep === 2 ? (
        <div className="space-y-4">
          <Card className="border-rose-100 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(255,241,242,0.96),rgba(255,247,237,0.96))] shadow-[0_22px_60px_rgba(244,63,94,0.12)]">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Generation Progress
                  </p>
                  <div className="flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg">
                    {selectedHistory ? getHistoryItemIcon(selectedHistory) : null}
                    <span>
                      {currentTaskItem
                        ? currentTaskItem.statusLabel
                        : selectedCompletedHistory
                        ? "已选择完成记录"
                        : "等待开始生成"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedHistory
                      ? formatDateTime(selectedHistory.createdAt)
                      : "从上一步发起生成后，这里会出现任务记录。"}
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/90 bg-white px-3 py-2 text-right shadow-[0_12px_28px_rgba(15,23,42,0.08)] sm:px-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Progress
                  </p>
                  <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    {getDisplayedProgress(selectedHistory || currentTaskItem)}%
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <ProgressBar
                  progress={getDisplayedProgress(selectedHistory || currentTaskItem)}
                  animated={
                    (selectedHistory || currentTaskItem)?.status === "RUNNING"
                  }
                  tone={
                    (selectedHistory || currentTaskItem)?.status === "FAILED"
                      ? "red"
                      : (selectedHistory || currentTaskItem)?.status === "SUCCEEDED"
                      ? "emerald"
                      : "rose"
                  }
                  className="h-3.5 bg-white shadow-inner shadow-slate-200/70"
                />

                <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                  <span>
                    {selectedHistory?.statusLabel || "等待 AI 任务开始"}
                  </span>
                  <span>
                    {selectedHistory?.status === "SUCCEEDED"
                      ? "已完成"
                      : selectedHistory?.status === "FAILED"
                      ? "失败"
                      : "处理中"}
                  </span>
                </div>

                {selectedHistory?.errorMessage ? (
                  <p className="text-xs leading-6 text-red-500">
                    {selectedHistory.errorMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
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

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="bg-cream-50/75">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                当前尺寸
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {canvasWidth} × {canvasHeight}
              </p>
            </Card>
            <Card className="bg-cream-50/75">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                色数 / 品牌
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {colorCount} 色 · {brand}
              </p>
            </Card>
            <Card className="bg-cream-50/75">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                AI 来源
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {selectedCompletedHistory?.styleName || "等待 AI 结果"}
              </p>
            </Card>
          </div>
        </div>
        )}
      </BeadWorkflowShell>
      {workspaceLaunchDialog}
    </>
  );
}

