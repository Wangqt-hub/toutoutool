"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Layers3,
  Move,
  Target,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { BeadWorkbenchCanvas, type BeadWorkbenchCanvasHandle } from "@/components/bead-tool/BeadWorkbenchCanvas";
import { WorkspaceLimitDialog } from "@/components/bead-tool/WorkspaceLimitDialog";
import { WorkspaceReplaceDialog } from "@/components/bead-tool/WorkspaceReplaceDialog";
import { EmojiLoadingStage } from "@/components/mascot/EmojiLoadingStage";
import { useMinimumLoadingDuration } from "@/components/mascot/useMinimumLoadingDuration";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBrandCode, type ColorBrand } from "@/lib/bead/palette";
import { buildWorkspaceThumbnailDataUrl } from "@/lib/bead/workspaceThumbnails";
import {
  createBeadWorkspace,
  fetchBeadWorkspace,
  fetchBeadWorkspaceOverview,
  isWorkspaceLimitError,
  updateBeadWorkspaceState,
} from "@/lib/bead/workspaceClient";
import {
  buildWorkspaceProgress,
  createWorkspaceName,
  exportWorkspaceToCSV,
  listWorkspaceSummaries,
  normalizeCompletedColorIndexes,
  type BeadWorkspaceLimitData,
  type BeadWorkspaceRecord,
  type BeadWorkspaceSummary,
} from "@/lib/bead/workspaces";
import type { LoadingStorySlide } from "@/lib/loading-story-presets";

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
type MobilePanel = "colors" | "progress" | "view";
const BEAD_WORKSPACE_MIN_LOADING_MS = 3000;

const beadWorkspaceLoadingSlides: LoadingStorySlide[] = [
  {
    id: "bead-workspace-load-01",
    eyebrow: "Bead Workspace",
    tag: "图纸",
    status: "正在读取图纸",
    headline: "正在打开拼豆工作台",
    body: "先把图纸、色卡和制作进度取回来。",
    image: "/loading-lab/emoji-heads/emoji_04.png",
    alt: "思考表情",
    accent: "#D7E6C7",
    accentSoft: "#F5F9EF",
    glow: "rgba(137, 177, 107, 0.22)"
  },
  {
    id: "bead-workspace-load-02",
    eyebrow: "Bead Workspace",
    tag: "画布",
    status: "正在准备画布",
    headline: "正在恢复制作现场",
    body: "画布、缩放和已完成豆格马上就位。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静微笑表情",
    accent: "#F3CDBB",
    accentSoft: "#FFF2EA",
    glow: "rgba(233, 154, 107, 0.22)"
  }
];

function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function waitForMinimumLoading(startedAt: number) {
  const remaining = Math.max(
    0,
    BEAD_WORKSPACE_MIN_LOADING_MS - (getNow() - startedAt)
  );

  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}

interface LegacyPatternPayload {
  grid: BeadWorkspaceRecord["patternData"]["grid"];
  palette: BeadWorkspaceRecord["patternData"]["palette"];
  brand: string;
  name?: string;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "刚刚";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSaveStatusLabel(status: SaveStatus, lastSavedAt: string | null) {
  if (status === "saving") {
    return "正在自动保存";
  }

  if (status === "pending") {
    return "等待保存";
  }

  if (status === "error") {
    return "保存失败";
  }

  if (status === "saved") {
    return `已保存 · ${formatDateTime(lastSavedAt)}`;
  }

  return "工作台已就绪";
}

function serializeWorkspaceState(
  completedColorIndexes: number[],
  selectedColorIndex: number | null
) {
  return JSON.stringify({
    completedColorIndexes: normalizeCompletedColorIndexes(completedColorIndexes),
    selectedColorIndex,
  });
}

export default function BeadModePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<BeadWorkbenchCanvasHandle | null>(null);
  const [workspace, setWorkspace] = useState<BeadWorkspaceRecord | null>(null);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(
    null
  );
  const [completedColorIndexes, setCompletedColorIndexes] = useState<number[]>([]);
  const [showColorNumbers, setShowColorNumbers] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [scale, setScale] = useState(1);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legacyPending, setLegacyPending] = useState<LegacyPatternPayload | null>(
    null
  );
  const [legacyCurrentWorkspace, setLegacyCurrentWorkspace] =
    useState<BeadWorkspaceSummary | null>(null);
  const [legacyLimitData, setLegacyLimitData] =
    useState<BeadWorkspaceLimitData | null>(null);
  const [legacyDeleteWorkspaceIds, setLegacyDeleteWorkspaceIds] = useState<string[]>(
    []
  );
  const [resolvingLegacy, setResolvingLegacy] = useState(false);
  const initializedRef = useRef(false);
  const dirtyRef = useRef(false);
  const persistSnapshotRef = useRef("");
  const workspaceId = searchParams.get("workspace");
  const loadingStartedAtRef = useRef(getNow());
  const navigatingDuringLoadRef = useRef(false);
  const showInitialLoading = useMinimumLoadingDuration(
    loading,
    BEAD_WORKSPACE_MIN_LOADING_MS
  );

  const readLegacyPattern = useCallback(() => {
    const legacyRaw = window.sessionStorage.getItem("currentBeadPattern");

    if (!legacyRaw) {
      return null;
    }

    const parsed = JSON.parse(legacyRaw) as LegacyPatternPayload;

    if (
      !parsed ||
      !Array.isArray(parsed.grid) ||
      !Array.isArray(parsed.palette) ||
      !parsed.brand
    ) {
      window.sessionStorage.removeItem("currentBeadPattern");
      throw new Error("历史图纸数据无效，无法恢复。");
    }

    return parsed;
  }, []);

  const importLegacyWorkspace = useCallback(
    async (
      legacyPattern: LegacyPatternPayload,
      deleteWorkspaceIds?: string[]
    ) => {
      const workspaceSummary = await createBeadWorkspace({
        name: createWorkspaceName("legacy", legacyPattern.name),
        sourceType: "legacy",
        brand: legacyPattern.brand,
        patternData: {
          grid: legacyPattern.grid,
          palette: legacyPattern.palette,
        },
        thumbnailDataUrl: buildWorkspaceThumbnailDataUrl(
          legacyPattern.grid,
          legacyPattern.palette
        ),
        deleteWorkspaceIds,
      });

      window.sessionStorage.removeItem("currentBeadPattern");
      return workspaceSummary;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      loadingStartedAtRef.current = getNow();
      navigatingDuringLoadRef.current = false;
      setLoading(true);
      setError(null);
      initializedRef.current = false;
      dirtyRef.current = false;
      persistSnapshotRef.current = "";

      try {
        if (!workspaceId) {
          const legacyPattern = readLegacyPattern();

          if (cancelled) {
            return;
          }

          if (legacyPattern) {
            const overview = await fetchBeadWorkspaceOverview();

            if (cancelled) {
              return;
            }

            if (overview.current) {
              setLegacyPending(legacyPattern);
              setLegacyCurrentWorkspace(overview.current);
              setLegacyLimitData(null);
              setLegacyDeleteWorkspaceIds([]);
              setLoading(false);
              return;
            }

            let legacyWorkspace: BeadWorkspaceSummary;

            try {
              legacyWorkspace = await importLegacyWorkspace(legacyPattern);
            } catch (cause) {
              if (isWorkspaceLimitError(cause) && cause.data) {
                setLegacyPending(legacyPattern);
                setLegacyCurrentWorkspace(null);
                setLegacyLimitData(cause.data);
                setLegacyDeleteWorkspaceIds([]);
                setLoading(false);
                return;
              }

              throw cause;
            }

            if (cancelled) {
              return;
            }

            navigatingDuringLoadRef.current = true;
            await waitForMinimumLoading(loadingStartedAtRef.current);

            if (!cancelled) {
              router.replace(`/tools/bead/bead-mode?workspace=${legacyWorkspace.id}`);
            }

            return;
          }

          const overview = await fetchBeadWorkspaceOverview();

          if (cancelled) {
            return;
          }

          if (overview.current) {
            navigatingDuringLoadRef.current = true;
            await waitForMinimumLoading(loadingStartedAtRef.current);

            if (!cancelled) {
              router.replace(`/tools/bead/bead-mode?workspace=${overview.current.id}`);
            }

            return;
          }

          throw new Error("未找到可继续的拼豆工作台。");
        }

        const record = await fetchBeadWorkspace(workspaceId);

        if (cancelled) {
          return;
        }

        setWorkspace(record);
        setSelectedColorIndex(record.selectedColorIndex);
        setCompletedColorIndexes(record.completedColorIndexes);
        setLastSavedAt(record.updatedAt);
        setSaveStatus("saved");
        persistSnapshotRef.current = serializeWorkspaceState(
          record.completedColorIndexes,
          record.selectedColorIndex
        );
        initializedRef.current = true;
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "加载拼豆工作台失败。"
          );
        }
      } finally {
        if (!cancelled && !navigatingDuringLoadRef.current) {
          setLoading(false);
        }
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [importLegacyWorkspace, readLegacyPattern, router, workspaceId]);

  const persistWorkspaceState = useCallback(
    async (keepalive = false) => {
      if (!workspaceId || !workspace) {
        return;
      }

      const snapshot = serializeWorkspaceState(
        completedColorIndexes,
        selectedColorIndex
      );

      if (snapshot === persistSnapshotRef.current) {
        dirtyRef.current = false;
        return;
      }

      setSaveStatus("saving");

      try {
        const result = await updateBeadWorkspaceState(
          workspaceId,
          {
            completedColorIndexes,
            selectedColorIndex,
          },
          { keepalive }
        );

        persistSnapshotRef.current = snapshot;
        dirtyRef.current = false;
        setSaveStatus("saved");
        setLastSavedAt(result.updatedAt);
        setWorkspace((previous) =>
          previous
            ? {
                ...previous,
                updatedAt: result.updatedAt,
                lastOpenedAt: result.lastOpenedAt,
              }
            : previous
        );
      } catch (cause) {
        console.error(cause);
        setSaveStatus("error");
      }
    },
    [completedColorIndexes, selectedColorIndex, workspace, workspaceId]
  );

  useEffect(() => {
    if (!workspace || !initializedRef.current) {
      return;
    }

    const snapshot = serializeWorkspaceState(
      completedColorIndexes,
      selectedColorIndex
    );

    if (snapshot === persistSnapshotRef.current) {
      return;
    }

    dirtyRef.current = true;
    setSaveStatus("pending");

    const timer = window.setTimeout(() => {
      void persistWorkspaceState();
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    completedColorIndexes,
    persistWorkspaceState,
    selectedColorIndex,
    workspace,
  ]);

  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) {
        void persistWorkspaceState(true);
      }
    };

    window.addEventListener("beforeunload", flush);

    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [persistWorkspaceState]);

  useEffect(() => {
    setMobilePanel(null);
  }, [workspaceId]);

  const progress = useMemo(
    () =>
      workspace
        ? buildWorkspaceProgress(workspace.usedColorCodes, completedColorIndexes)
        : null,
    [completedColorIndexes, workspace]
  );

  const selectedUsage = useMemo(
    () =>
      workspace?.usedColorCodes.find((item) => item.colorIndex === selectedColorIndex) ??
      null,
    [selectedColorIndex, workspace]
  );

  const selectedPaletteColor =
    workspace && selectedColorIndex !== null
      ? workspace.patternData.palette[selectedColorIndex] ?? null
      : null;

  const toggleCompletedColor = useCallback((colorIndex: number) => {
    setCompletedColorIndexes((previous) =>
      previous.includes(colorIndex)
        ? previous.filter((item) => item !== colorIndex)
        : [...previous, colorIndex].sort((left, right) => left - right)
    );
  }, []);

  const handleContinueCurrentWorkspace = useCallback(() => {
    if (!legacyCurrentWorkspace) {
      return;
    }

    window.sessionStorage.removeItem("currentBeadPattern");
    setLegacyPending(null);
    setLegacyCurrentWorkspace(null);
    setLegacyLimitData(null);
    setLegacyDeleteWorkspaceIds([]);
    router.replace(`/tools/bead/bead-mode?workspace=${legacyCurrentWorkspace.id}`);
  }, [legacyCurrentWorkspace, router]);

  const handleOverwriteLegacyWorkspace = useCallback(async () => {
    if (!legacyPending) {
      return;
    }

    setResolvingLegacy(true);

    try {
      const nextWorkspace = await importLegacyWorkspace(legacyPending);
      setLegacyPending(null);
      setLegacyCurrentWorkspace(null);
      setLegacyLimitData(null);
      setLegacyDeleteWorkspaceIds([]);
      router.replace(`/tools/bead/bead-mode?workspace=${nextWorkspace.id}`);
    } catch (cause) {
      if (isWorkspaceLimitError(cause) && cause.data) {
        setLegacyCurrentWorkspace(null);
        setLegacyLimitData(cause.data);
        setLegacyDeleteWorkspaceIds([]);
        return;
      }

      setError(cause instanceof Error ? cause.message : "导入历史图纸失败。");
    } finally {
      setResolvingLegacy(false);
    }
  }, [importLegacyWorkspace, legacyPending, router]);

  const handleConfirmLegacyDeletion = useCallback(async () => {
    if (
      !legacyPending ||
      !legacyLimitData ||
      legacyDeleteWorkspaceIds.length !== legacyLimitData.requiredDeletionCount
    ) {
      return;
    }

    setResolvingLegacy(true);

    try {
      const nextWorkspace = await importLegacyWorkspace(
        legacyPending,
        legacyDeleteWorkspaceIds
      );
      setLegacyPending(null);
      setLegacyCurrentWorkspace(null);
      setLegacyLimitData(null);
      setLegacyDeleteWorkspaceIds([]);
      router.replace(`/tools/bead/bead-mode?workspace=${nextWorkspace.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to import legacy workspace.");
    } finally {
      setResolvingLegacy(false);
    }
  }, [
    importLegacyWorkspace,
    legacyDeleteWorkspaceIds,
    legacyLimitData,
    legacyPending,
    router,
  ]);

  const handleExportCSV = useCallback(() => {
    if (!workspace) {
      return;
    }

    const csv = exportWorkspaceToCSV({
      brand: workspace.brand,
      patternData: workspace.patternData,
    });
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workspace.name || "bead-workspace"}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [workspace]);

  const toggleMobilePanel = useCallback((panel: MobilePanel) => {
    setMobilePanel((previous) => (previous === panel ? null : panel));
  }, []);

  const closeMobilePanel = useCallback(() => {
    setMobilePanel(null);
  }, []);

  const handleToggleShowColorNumbers = useCallback(() => {
    setShowColorNumbers((previous) => {
      const next = !previous;

      if (!previous) {
        window.requestAnimationFrame(() => {
          canvasRef.current?.ensureColorLabelScale();
        });
      }

      return next;
    });
  }, []);

  const renderCurrentColorPanel = () => (
    <Card className="space-y-4 border-white/80 bg-white/92 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Current Color
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {selectedUsage
              ? `#${selectedUsage.colorId.toString().padStart(2, "0")}`
              : "未选择色号"}
          </h2>
        </div>

        {selectedUsage ? (
          <span
            className="h-12 w-12 rounded-2xl border border-white/80 shadow-sm"
            style={{ backgroundColor: selectedUsage.hex }}
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-50 text-slate-400">
            <Layers3 className="h-6 w-6" />
          </div>
        )}
      </div>

      {selectedUsage && selectedPaletteColor ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[24px] bg-cream-50/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              品牌色号
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {selectedUsage.brandCode ||
                getBrandCode(selectedPaletteColor, workspace?.brand as ColorBrand) ||
                "未配置"}
            </p>
          </div>
          <div className="rounded-[24px] bg-cream-50/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              剩余豆格
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {completedColorIndexes.includes(selectedUsage.colorIndex)
                ? 0
                : selectedUsage.count}
            </p>
          </div>
          <div className="rounded-[24px] bg-cream-50/80 px-4 py-3 sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              当前状态
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-700">
                {completedColorIndexes.includes(selectedUsage.colorIndex)
                  ? "该色已完成"
                  : "该色待制作"}
              </p>
              <Button
                type="button"
                size="sm"
                variant={
                  completedColorIndexes.includes(selectedUsage.colorIndex)
                    ? "ghost"
                    : "primary"
                }
                onClick={() => toggleCompletedColor(selectedUsage.colorIndex)}
              >
                {completedColorIndexes.includes(selectedUsage.colorIndex)
                  ? "取消完成"
                  : "标记完成"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-[24px] bg-cream-50/80 px-4 py-4 text-sm leading-6 text-slate-600">
          点击画布中的豆格或右侧色号列表，可以立刻高亮对应颜色，并把它设为当前制作目标。
        </p>
      )}
    </Card>
  );

  const renderCompactCurrentColorPanel = () => {
    const brandCode =
      selectedUsage && selectedPaletteColor
        ? selectedUsage.brandCode ||
          getBrandCode(selectedPaletteColor, workspace?.brand as ColorBrand) ||
          "--"
        : "--";
    const remainingCount = selectedUsage
      ? completedColorIndexes.includes(selectedUsage.colorIndex)
        ? 0
        : selectedUsage.count
      : 0;
    const isCompleted = selectedUsage
      ? completedColorIndexes.includes(selectedUsage.colorIndex)
      : false;

    return (
      <Card className="w-full space-y-2.5 border-white/80 bg-white/94 px-3 py-2.5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-3">
          {selectedUsage ? (
            <span
              className="h-11 w-11 shrink-0 rounded-2xl border border-white/80 shadow-sm"
              style={{ backgroundColor: selectedUsage.hex }}
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream-50 text-slate-400">
              <Layers3 className="h-5 w-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Current Color
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
              {selectedUsage
                ? `#${selectedUsage.colorId.toString().padStart(2, "0")}`
                : "未选择色号"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {selectedUsage ? `Brand ${brandCode}` : "点击图纸或下方色号卡片选择当前颜色"}
            </p>
          </div>

          {selectedUsage ? (
            <Button
              type="button"
              size="sm"
              variant={isCompleted ? "ghost" : "primary"}
              className="h-8 shrink-0 px-3 text-xs"
              onClick={() => toggleCompletedColor(selectedUsage.colorIndex)}
            >
              {isCompleted ? "取消" : "完成"}
            </Button>
          ) : null}
        </div>

        {selectedUsage ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[20px] bg-cream-50/85 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                BRAND
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                {brandCode}
              </p>
            </div>
            <div className="rounded-[20px] bg-cream-50/85 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                LEFT
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {remainingCount}
              </p>
            </div>
          </div>
        ) : null}
      </Card>
    );
  };

  const renderProgressPanel = () => (
    <Card className="space-y-4 border-white/80 bg-white/92 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Progress
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            当前制作进度
          </h2>
        </div>
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      </div>

      {progress ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-700">
              <span>豆格进度</span>
              <span>
                {progress.completedBeans} / {progress.totalBeans}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-cream-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-300"
                style={{ width: `${progress.beanPercentage}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              已完成 {progress.beanPercentage.toFixed(1)}%，剩余{" "}
              {progress.remainingBeans} 颗豆格。
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-700">
              <span>色号进度</span>
              <span>
                {progress.completedColors} / {progress.totalColors}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-cream-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                style={{ width: `${progress.colorPercentage}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              已完成 {progress.colorPercentage.toFixed(1)}%，剩余{" "}
              {progress.remainingColors} 个色号。
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );

  const renderViewPanel = () => (
    <Card className="space-y-4 border-white/80 bg-white/92 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          View Controls
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">工作台视图</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <button
          type="button"
          onClick={handleToggleShowColorNumbers}
          className="flex items-center justify-between rounded-[24px] border border-cream-100 bg-cream-50/80 px-4 py-3 text-left transition hover:border-accent-brown/30 hover:bg-cream-50"
        >
          <div>
            <p className="text-sm font-medium text-slate-800">显示色号</p>
            <p className="text-xs text-slate-500">在足够放大时显示品牌色号。</p>
          </div>
          {showColorNumbers ? (
            <Eye className="h-5 w-5 text-accent-brown" />
          ) : (
            <EyeOff className="h-5 w-5 text-slate-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setHideCompleted((previous) => !previous)}
          className="flex items-center justify-between rounded-[24px] border border-cream-100 bg-cream-50/80 px-4 py-3 text-left transition hover:border-accent-brown/30 hover:bg-cream-50"
        >
          <div>
            <p className="text-sm font-medium text-slate-800">隐藏已完成</p>
            <p className="text-xs text-slate-500">降低已完成色号干扰，专注剩余部分。</p>
          </div>
          {hideCompleted ? (
            <EyeOff className="h-5 w-5 text-accent-brown" />
          ) : (
            <Eye className="h-5 w-5 text-slate-400" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => canvasRef.current?.fitView()}
        >
          <Move className="mr-2 h-4 w-4" />
          适配视图
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (selectedColorIndex !== null) {
              canvasRef.current?.focusColor(selectedColorIndex);
            }
          }}
          disabled={selectedColorIndex === null}
        >
          <Target className="mr-2 h-4 w-4" />
          聚焦当前色
        </Button>
      </div>
    </Card>
  );

  const renderColorList = ({ scrollWithinCard = true }: { scrollWithinCard?: boolean } = {}) => (
    <Card className="space-y-4 border-white/80 bg-white/92 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Palette
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            图纸全部色号
          </h2>
        </div>
        <div className="rounded-full bg-cream-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {workspace?.usedColorCodes.length ?? 0} 色
        </div>
      </div>

      <div
        className={
          scrollWithinCard
            ? "max-h-[48vh] space-y-2 overflow-y-auto pr-1"
            : "space-y-2"
        }
      >
        {workspace?.usedColorCodes.map((usage) => {
          const isSelected = selectedColorIndex === usage.colorIndex;
          const isCompleted = completedColorIndexes.includes(usage.colorIndex);

          return (
            <div
              key={usage.colorIndex}
              className={`flex items-center gap-2 rounded-[24px] border p-2 transition ${
                isSelected
                  ? "border-accent-brown/50 bg-accent-brown/10"
                  : "border-cream-100 bg-cream-50/70"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedColorIndex((previous) =>
                    previous === usage.colorIndex ? null : usage.colorIndex
                  )
                }
                className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] px-2 py-2 text-left"
              >
                <span
                  className="h-10 w-10 rounded-2xl border border-white/90 shadow-sm"
                  style={{ backgroundColor: usage.hex }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    #{usage.colorId.toString().padStart(2, "0")}
                    {usage.brandCode ? ` · ${usage.brandCode}` : ""}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {usage.count} 颗豆格
                    {isCompleted ? " · 已完成" : ""}
                  </span>
                </span>
              </button>

              <Button
                type="button"
                size="sm"
                variant={isCompleted ? "ghost" : "secondary"}
                onClick={() => toggleCompletedColor(usage.colorIndex)}
              >
                {isCompleted ? "取消" : "完成"}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );

  if (showInitialLoading) {
    return (
      <div className="flex h-full min-h-[calc(100dvh-var(--dashboard-header-height,76px))] items-center justify-center bg-[radial-gradient(circle_at_top,#fff8ee,transparent_52%),linear-gradient(180deg,#f8f3ee,#f5eee6)] px-4">
        <EmojiLoadingStage
          slides={beadWorkspaceLoadingSlides}
          autoPlayMs={4100}
          fullScreen={false}
          showBrand={false}
          className="w-full"
        />
      </div>
    );
  }
  if (legacyPending && legacyCurrentWorkspace) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8ee,transparent_52%),linear-gradient(180deg,#f8f3ee,#f4eee7)]">
        <WorkspaceReplaceDialog
          open
          currentWorkspace={legacyCurrentWorkspace}
          incomingName={legacyPending.name || "新的拼豆图纸"}
          loading={resolvingLegacy}
          onClose={() => router.push("/tools/bead")}
          onContinueCurrent={handleContinueCurrentWorkspace}
          onOverwrite={() => {
            void handleOverwriteLegacyWorkspace();
          }}
        />
      </div>
    );
  }

  if (legacyPending && legacyLimitData) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8ee,transparent_52%),linear-gradient(180deg,#f8f3ee,#f4eee7)]">
        <WorkspaceLimitDialog
          open
          workspaces={listWorkspaceSummaries(legacyLimitData.overview)}
          incomingName={legacyPending.name || "新的拼豆图纸"}
          requiredDeletionCount={legacyLimitData.requiredDeletionCount}
          selectedWorkspaceIds={legacyDeleteWorkspaceIds}
          loading={resolvingLegacy}
          onToggleWorkspace={(workspaceId) => {
            if (resolvingLegacy) {
              return;
            }

            setLegacyDeleteWorkspaceIds((previous) => {
              if (previous.includes(workspaceId)) {
                return previous.filter((item) => item !== workspaceId);
              }

              if (previous.length >= legacyLimitData.requiredDeletionCount) {
                return previous;
              }

              return [...previous, workspaceId];
            });
          }}
          onClose={() => router.push("/tools/bead")}
          onConfirm={() => {
            void handleConfirmLegacyDeletion();
          }}
        />
      </div>
    );
  }

  if (error || !workspace || !progress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff8ee,transparent_52%),linear-gradient(180deg,#f8f3ee,#f5eee6)] px-4">
        <Card className="w-full max-w-lg border-white/80 bg-white/96 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <h1 className="text-2xl font-semibold text-slate-900">未找到拼豆工作台</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error || "当前没有可恢复的工作台，请先导入一张图纸。"}
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              size="lg"
              onClick={() => router.push("/tools/bead")}
            >
              返回拼豆工具
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#fff8ee,transparent_52%),linear-gradient(180deg,#f8f3ee,#f4eee7)]">
      <header className="z-10 shrink-0 border-b border-white/70 bg-white/88 backdrop-blur-xl">
        <div className="flex h-[3.15rem] items-center gap-1.5 px-2 sm:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/tools/bead")}
            className="h-8 w-8 shrink-0 rounded-full p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
            <div className="rounded-xl bg-cream-50/90 px-2 py-1">
              <div className="flex items-center justify-between text-[9px] font-medium leading-none text-slate-600">
                <span>豆格</span>
                <span>{progress.beanPercentage.toFixed(0)}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/95">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                  style={{ width: `${progress.beanPercentage}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-cream-50/90 px-2 py-1">
              <div className="flex items-center justify-between text-[9px] font-medium leading-none text-slate-600">
                <span>色号</span>
                <span>{progress.colorPercentage.toFixed(0)}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/95">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{ width: `${progress.colorPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden w-full px-3 py-3 sm:block sm:px-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/tools/bead")}
                  className="-ml-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Bead Workspace
                  </p>
                  <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">
                    {workspace.name}
                  </h1>
                  <p className="mt-1 text-xs text-slate-500">
                    {workspace.width} × {workspace.height} · {workspace.brand} ·{" "}
                    {getSaveStatusLabel(saveStatus, lastSavedAt)}
                  </p>
                </div>
              </div>

              <div className="hidden flex-wrap items-center gap-2 md:flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => canvasRef.current?.zoomOut()}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <div className="min-w-[72px] rounded-full bg-cream-50 px-3 py-1 text-center text-sm font-semibold text-slate-700">
                  {(scale * 100).toFixed(0)}%
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => canvasRef.current?.zoomIn()}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => canvasRef.current?.fitView()}
                >
                  <Move className="mr-2 h-4 w-4" />
                  适配
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedColorIndex !== null) {
                      canvasRef.current?.focusColor(selectedColorIndex);
                    }
                  }}
                  disabled={selectedColorIndex === null}
                >
                  <Target className="mr-2 h-4 w-4" />
                  聚焦
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  导出 CSV
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[26px] bg-cream-50/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                  <span>豆格进度</span>
                  <span>
                    {progress.completedBeans} / {progress.totalBeans} ·{" "}
                    {progress.beanPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/90">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-300"
                    style={{ width: `${progress.beanPercentage}%` }}
                  />
                </div>
              </div>

              <div className="rounded-[26px] bg-cream-50/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                  <span>色号进度</span>
                  <span>
                    {progress.completedColors} / {progress.totalColors} ·{" "}
                    {progress.colorPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/90">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                    style={{ width: `${progress.colorPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col gap-1.5 overflow-hidden px-1.5 py-1.5 sm:gap-4 sm:px-4 sm:py-4 lg:flex-row">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px] border border-white/80 bg-white/70 shadow-[0_30px_100px_rgba(15,23,42,0.08)]">
          <div className="hidden">
            <div className="hidden sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Canvas
              </p>
              <p className="mt-1 text-sm text-slate-600">
                点击同色高亮，长按整色完成，单指拖拽，双指缩放。
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-2 md:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3"
                onClick={() => canvasRef.current?.zoomOut()}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3"
                onClick={() => canvasRef.current?.zoomIn()}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 rounded-full p-0 sm:h-9 sm:w-auto sm:px-3"
                onClick={() => canvasRef.current?.fitView()}
              >
                <Move className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <BeadWorkbenchCanvas
              ref={canvasRef}
              className="h-full min-h-0 flex-1 bg-[radial-gradient(circle_at_top,#fffdf9,transparent_55%),linear-gradient(180deg,#fbf7f1,#f6efe5)]"
              grid={workspace.patternData.grid}
              palette={workspace.patternData.palette}
              brand={workspace.brand}
              selectedColorIndex={selectedColorIndex}
              completedColorIndexes={completedColorIndexes}
              showColorNumbers={showColorNumbers}
              hideCompleted={hideCompleted}
              onSelectedColorIndexChange={setSelectedColorIndex}
              onToggleCompletedColor={toggleCompletedColor}
              onScaleChange={setScale}
            />
          </div>
        </section>

        <aside className="hidden w-[380px] flex-shrink-0 gap-4 overflow-y-auto lg:flex lg:flex-col">
          {renderCurrentColorPanel()}
          {renderProgressPanel()}
          {renderViewPanel()}
          {renderColorList()}
        </aside>
      </main>

      <div className="relative z-30 shrink-0 border-t border-white/80 bg-white/94 backdrop-blur-xl lg:hidden">
        {mobilePanel ? (
          <div className="absolute inset-x-3 bottom-full mb-3 sm:inset-x-4">
            <div className="flex max-h-[min(58dvh,28rem)] flex-col overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.2)]">
              <div className="flex items-center justify-between gap-3 border-b border-white/70 px-3 py-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Mobile Panel
                  </p>
                  <h2 className="mt-0.5 text-sm font-semibold text-slate-900">
                    {mobilePanel === "colors"
                      ? "图纸色号"
                      : mobilePanel === "progress"
                      ? "制作进度"
                      : "视图设置"}
                  </h2>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeMobilePanel}
                >
                  收起
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 sm:px-4">
                {mobilePanel === "colors"
                  ? (
                    <div className="space-y-3">
                      {renderCompactCurrentColorPanel()}
                      {renderColorList({ scrollWithinCard: false })}
                    </div>
                  )
                  : mobilePanel === "progress"
                  ? renderProgressPanel()
                  : renderViewPanel()}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex h-[calc(2.9rem+env(safe-area-inset-bottom))] w-full items-center px-2 pb-[env(safe-area-inset-bottom)] pt-1 sm:px-4">
          <div className="grid h-8 w-full grid-cols-3 gap-1.5">
            <Button
              type="button"
              variant={mobilePanel === "colors" ? "primary" : "ghost"}
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => toggleMobilePanel("colors")}
            >
              色号
            </Button>
            <Button
              type="button"
              variant={mobilePanel === "progress" ? "primary" : "ghost"}
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => toggleMobilePanel("progress")}
            >
              进度
            </Button>
            <Button
              type="button"
              variant={mobilePanel === "view" ? "primary" : "ghost"}
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => toggleMobilePanel("view")}
            >
              视图
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
