"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    return "??";
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
    <Card className="overflow-hidden border-white/80 bg-white/92 p-0 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center justify-center self-stretch bg-cream-50 px-2 py-2 sm:px-4 sm:py-4">
          {workspace.thumbnailUrl ? (
            <div className="flex h-[9.95rem] w-[9.95rem] items-center justify-center rounded-[24px] border border-cream-100 bg-cream-50 p-2 shadow-sm sm:h-full sm:min-h-[12.5rem] sm:w-auto sm:aspect-square sm:rounded-[28px] sm:p-4">
              <AutoRefreshImage
                src={workspace.thumbnailUrl}
                onRefreshSrc={onRefreshThumbnail}
                alt="???????"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-[9.95rem] w-[9.95rem] items-center justify-center rounded-[24px] border border-dashed border-cream-100 bg-cream-50 text-slate-400 sm:h-full sm:min-h-[12.5rem] sm:w-auto sm:aspect-square sm:rounded-[28px]">
              <Layers3 className="h-11 w-11" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-2.5 pr-2 sm:gap-4 sm:p-5">
          <div className="space-y-2 sm:space-y-3">
            <div className="space-y-0.5 sm:space-y-1">
              <h3 className="truncate text-[0.95rem] font-semibold leading-tight text-slate-900 sm:text-lg">
                {workspace.name}
              </h3>
              <p className="text-[11px] leading-tight text-slate-500 sm:mt-1 sm:text-xs">
                {workspace.width} ? {workspace.height} ? {workspace.brand}
              </p>
            </div>

            <p className="text-[10px] font-medium leading-tight text-slate-500 sm:hidden">
              ???? {formatDateTime(workspace.lastOpenedAt)}
            </p>

            <div className="hidden rounded-xl bg-cream-50/80 px-2.5 py-2 sm:block sm:rounded-2xl sm:px-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                ????
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatDateTime(workspace.lastOpenedAt)}
              </p>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600 sm:text-xs">
                <span>?????</span>
                <span>{workspace.progress.beanPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-100 sm:h-2.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                  style={{ width: `${workspace.progress.beanPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 sm:text-xs">
                {workspace.progress.completedBeans} / {workspace.progress.totalBeans}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
              onClick={onOpen}
              disabled={loading}
            >
              ????
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
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
    <Card className="min-w-[340px] shrink-0 border-white/80 bg-white/92 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:min-w-0">
      <div className="flex items-stretch gap-4">
        <WorkspaceSquareThumbnail
          src={workspace.thumbnailUrl}
          alt="???????"
          onRefreshSrc={onRefreshThumbnail}
        />

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
              <span>????</span>
              <span>{workspace.progress.beanPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-cream-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                style={{ width: `${workspace.progress.beanPercentage}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {workspace.progress.completedBeans} / {workspace.progress.totalBeans}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={onOpen}
            disabled={loading}
          >
            ????
          </Button>
        </div>
      </div>
    </Card>
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
      setError(cause instanceof Error ? cause.message : "????????????");
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
        setError(cause instanceof Error ? cause.message : "??????????");
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
            ?????
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadOverview()}
        >
          ??
        </Button>
      </div>

      {overview?.current ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-accent-brown" />
            <h3 className="text-lg font-semibold text-slate-900">????</h3>
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
          <h3 className="text-lg font-semibold text-slate-900">????</h3>
        </div>

        {loading ? (
          <Card className="border-white/80 bg-white/92 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-brown/25 border-t-accent-brown" />
              ?????????...
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
                <p className="text-sm font-medium text-slate-700">???????</p>
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
          <h3 className="text-lg font-semibold text-slate-900">????</h3>
        </div>

        <ImportModeSelector />
      </section>
    </div>
  );
}
