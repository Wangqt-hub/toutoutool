"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Clock3, History, Layers3, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ImportModeSelector } from "@/components/bead-tool/ImportModeSelector";
import { AutoRefreshImage } from "@/components/ui/AutoRefreshImage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  activateBeadWorkspace,
  fetchBeadWorkspaceOverview,
} from "@/lib/bead/workspaceClient";
import type {
  BeadWorkspaceOverview,
  BeadWorkspaceSummary,
} from "@/lib/bead/workspaces";

const WORKSPACE_OVERVIEW_CACHE_KEY = "bead-workspace-overview-cache-v3";
const SIGNED_IMAGE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

type CachedOverviewPayload = {
  cachedAt: number;
  overview: BeadWorkspaceOverview;
};

function formatDateTime(value: string | null) {
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

function isCacheFresh(cachedAt: number) {
  return Date.now() - cachedAt < SIGNED_IMAGE_CACHE_MAX_AGE_MS;
}

function readOverviewCache(): CachedOverviewPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(WORKSPACE_OVERVIEW_CACHE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as
      | CachedOverviewPayload
      | BeadWorkspaceOverview;
    const legacyOverview = parsed as BeadWorkspaceOverview;

    if ("overview" in parsed && parsed.overview && Array.isArray(parsed.overview.history)) {
      return parsed;
    }

    if (legacyOverview && Array.isArray(legacyOverview.history)) {
      return {
        cachedAt: 0,
        overview: legacyOverview,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function writeOverviewCache(overview: BeadWorkspaceOverview) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: CachedOverviewPayload = {
    cachedAt: Date.now(),
    overview,
  };

  window.sessionStorage.setItem(
    WORKSPACE_OVERVIEW_CACHE_KEY,
    JSON.stringify(payload)
  );
}

function promoteWorkspaceToCurrent(
  overview: BeadWorkspaceOverview | null,
  workspaceId: string
): BeadWorkspaceOverview | null {
  if (!overview) {
    return null;
  }

  const items = overview.current
    ? [overview.current, ...overview.history]
    : [...overview.history];
  const nextCurrent = items.find((item) => item.id === workspaceId);

  if (!nextCurrent) {
    return overview;
  }

  return {
    current: {
      ...nextCurrent,
      isCurrent: true,
      lastOpenedAt: new Date().toISOString(),
    },
    history: items
      .filter((item) => item.id !== workspaceId)
      .map((item) => ({ ...item, isCurrent: false })),
  };
}

function listOverviewItems(overview: BeadWorkspaceOverview | null) {
  if (!overview) {
    return [] as BeadWorkspaceSummary[];
  }

  return overview.current
    ? [overview.current, ...overview.history]
    : [...overview.history];
}

function WorkspaceSquareThumbnail({
  src,
  alt,
  eager = false,
  containerClassName = "h-32 w-32 sm:h-36 sm:w-36",
  onRefreshSrc,
}: {
  src: string | null;
  alt: string;
  eager?: boolean;
  containerClassName?: string;
  onRefreshSrc?: () => Promise<string | null | undefined>;
}) {
  if (!src) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-[28px] border border-dashed border-cream-100 bg-cream-50 text-slate-400 ${containerClassName}`}
      >
        <Layers3 className="h-9 w-9" />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-[28px] border border-cream-100 bg-cream-50 p-3 shadow-sm ${containerClassName}`}
    >
      <AutoRefreshImage
        src={src}
        onRefreshSrc={onRefreshSrc}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function CurrentWorkspaceCard({
  workspace,
  onOpen,
  onRefreshThumbnail,
  loading,
}: {
  workspace: BeadWorkspaceSummary;
  onOpen: () => void;
  onRefreshThumbnail?: () => Promise<string | null | undefined>;
  loading?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02, rotate: -1 }}
      transition={{ type: "spring", bounce: 0.4 }}
      className="relative max-w-sm"
    >
      <div className="overflow-hidden rounded-xl border border-slate-200/50 bg-white p-3 shadow-cute pb-8">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-cream-50/50">
          {workspace.thumbnailUrl ? (
            <AutoRefreshImage
              src={workspace.thumbnailUrl}
              onRefreshSrc={onRefreshThumbnail}
              alt="当前图纸缩略图"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Layers3 className="h-12 w-12" />
            </div>
          )}
          <div className="absolute -top-1 left-1/2 h-4 w-12 -translate-x-1/2 rotate-2 bg-[#FFFDE7]/80 shadow-sm backdrop-blur" />
        </div>

        <div className="mt-4 flex flex-col gap-3 px-1">
          <div>
            <h3 className="truncate font-bold text-lg text-slate-800">
              {workspace.name}
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              {workspace.width} × {workspace.height} · {workspace.brand}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold text-slate-600">
              <span>完成度</span>
              <span>{workspace.progress.beanPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-100">
              <div
                className="h-full rounded-full bg-accent-brown"
                style={{ width: `${workspace.progress.beanPercentage}%` }}
              />
            </div>
          </div>

          <Button
            type="button"
            className="mt-2 w-full rounded-full font-bold shadow-sm h-10 hover:-translate-y-0.5 transition-all"
            onClick={onOpen}
            disabled={loading}
          >
            继续制作
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
function HistoryWorkspaceCard({
  workspace,
  onOpen,
  onRefreshThumbnail,
  loading,
}: {
  workspace: BeadWorkspaceSummary;
  onOpen: () => void;
  onRefreshThumbnail?: () => Promise<string | null | undefined>;
  loading?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.05, rotate: 2 }}
      transition={{ type: "spring", bounce: 0.4 }}
      className="relative shrink-0 md:min-w-[180px] w-[200px]"
    >
      <div className="overflow-hidden rounded-xl border border-slate-200/50 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-cute pb-6 group cursor-pointer" onClick={onOpen}>
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-cream-50 group-hover:bg-cream-100 transition-colors">
          <WorkspaceSquareThumbnail
            src={workspace.thumbnailUrl}
            alt="历史图纸缩略图"
            onRefreshSrc={onRefreshThumbnail}
            containerClassName="h-full w-full border-none shadow-none bg-transparent"
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 px-1">
          <div>
            <h3 className="truncate text-sm font-bold text-slate-800">
              {workspace.name}
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-500">
              <span>{workspace.progress.beanPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-cream-100">
              <div
                className="h-full rounded-full bg-accent-deep"
                style={{ width: `${workspace.progress.beanPercentage}%` }}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 w-full text-[11px] h-7 bg-cream-50/50 hover:bg-cream-100/50 text-slate-600"
            disabled={loading}
          >
            打开图纸
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
export default function BeadToolPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<BeadWorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const overviewRefreshPromiseRef = useRef<Promise<BeadWorkspaceOverview | null> | null>(null);

  const loadOverview = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true);
    }

    setError(null);

    try {
      const nextOverview = await fetchBeadWorkspaceOverview();
      setOverview(nextOverview);
      writeOverviewCache(nextOverview);
      return nextOverview;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载拼豆工作台历史失败。");
      return null;
    } finally {
      if (!options?.background) {
        setLoading(false);
      }
    }
  }, []);

  const refreshOverviewSignedUrls = useCallback(async () => {
    if (overviewRefreshPromiseRef.current) {
      return overviewRefreshPromiseRef.current;
    }

    const promise = loadOverview({ background: true }).finally(() => {
      overviewRefreshPromiseRef.current = null;
    });

    overviewRefreshPromiseRef.current = promise;
    return promise;
  }, [loadOverview]);

  const refreshWorkspaceThumbnailSrc = useCallback(
    async (workspaceId: string) => {
      const nextOverview = await refreshOverviewSignedUrls();
      return listOverviewItems(nextOverview).find((item) => item.id === workspaceId)?.thumbnailUrl ?? null;
    },
    [refreshOverviewSignedUrls]
  );

  useEffect(() => {
    const cachedOverview = readOverviewCache();
    const canHydrate = cachedOverview && isCacheFresh(cachedOverview.cachedAt);

    if (canHydrate) {
      setOverview(cachedOverview.overview);
      setLoading(false);
    }

    void loadOverview({
      background: Boolean(canHydrate),
    });
  }, [loadOverview]);

  const openWorkspace = useCallback(
    async (workspace: BeadWorkspaceSummary) => {
      setOpeningId(workspace.id);

      try {
        if (!workspace.isCurrent) {
          setOverview((previous) => {
            const nextOverview = promoteWorkspaceToCurrent(previous, workspace.id);

            if (nextOverview) {
              writeOverviewCache(nextOverview);
            }

            return nextOverview;
          });

          void activateBeadWorkspace(workspace.id).catch(() => undefined);
        }

        router.push(`/tools/bead/bead-mode?workspace=${workspace.id}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "打开拼豆工作台失败。");
      } finally {
        setOpeningId(null);
      }
    },
    [router]
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Bead Tool
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            拼豆工作台
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadOverview()}
        >
          刷新
        </Button>
      </div>

      {overview?.current ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-accent-brown" />
            <h3 className="text-lg font-semibold text-slate-900">当前草稿</h3>
          </div>
          <CurrentWorkspaceCard
            workspace={overview.current}
            onOpen={() => openWorkspace(overview.current!)}
            onRefreshThumbnail={() => refreshWorkspaceThumbnailSrc(overview.current!.id)}
            loading={openingId === overview.current.id}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-accent-brown" />
          <h3 className="text-lg font-semibold text-slate-900">历史图纸</h3>
        </div>

        {loading ? (
          <Card className="border-white/80 bg-white/92 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-brown/25 border-t-accent-brown" />
              正在加载历史工作台...
            </div>
          </Card>
        ) : overview?.history.length ? (
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3">
            {overview.history.map((workspace) => (
              <HistoryWorkspaceCard
                key={workspace.id}
                workspace={workspace}
                onOpen={() => openWorkspace(workspace)}
                onRefreshThumbnail={() => refreshWorkspaceThumbnailSrc(workspace.id)}
                loading={openingId === workspace.id}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-cream-100 bg-cream-50/70">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">还没有历史图纸</p>
              </div>
            </div>
          </Card>
        )}
      </section>

      {error ? (
        <Card className="border-red-200 bg-red-50/80 text-sm text-red-600">
          {error}
        </Card>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">新建图纸</h3>
        </div>

        <ImportModeSelector />
      </section>
    </div>
  );
}
