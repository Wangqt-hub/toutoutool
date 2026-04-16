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

// -------------------------------------------------------------------------------- //
// NEW DESKTOP SCENE LAYOUT 
// -------------------------------------------------------------------------------- //

function WorkspaceDeskScene({
  current,
  history,
  onOpen,
  onRefreshThumbnail,
  loadingId,
}: {
  current?: BeadWorkspaceSummary;
  history: BeadWorkspaceSummary[];
  onOpen: (ws: BeadWorkspaceSummary) => void;
  onRefreshThumbnail: (id: string) => Promise<string | null | undefined>;
  loadingId: string | null;
}) {

  if (!current && history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 rounded-[2.5rem] border-4 border-dashed border-white/60 bg-white/40 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream-50 shadow-inner mb-4">
          <Layers3 className="h-8 w-8 text-cream-200" />
        </div>
        <h3 className="text-xl font-black text-slate-700 mb-2">桌子上空空如也</h3>
        <p className="text-sm font-bold text-slate-400">目前还没有任何拼豆草稿呢，在下方选择一个方式开始吧！</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-[3rem] border-4 border-white bg-gradient-to-br from-[#f8f5ec] to-[#e4ded0] shadow-[inset_0_20px_50px_rgba(0,0,0,0.02)] p-6 md:p-10 lg:p-14 lg:pb-24 overflow-hidden">
       <div className="absolute top-8 left-8 flex items-center gap-2 opacity-50">
          <div className="h-3 w-3 rounded-full bg-[#d0c6b6]" />
          <div className="h-3 w-3 rounded-full bg-[#d0c6b6]" />
       </div>

       <div className="relative mx-auto max-w-4xl flex flex-col items-center lg:flex-row lg:items-start lg:justify-center gap-8 lg:gap-14">
          
          {current ? (
            <motion.div 
               initial={{ opacity: 0, y: 20, rotate: -2 }}
               animate={{ opacity: 1, y: 0, rotate: -2 }}
               whileHover={{ y: -8, rotate: 0 }}
               transition={{ type: "spring", bounce: 0.4 }}
               className="relative z-20 w-full max-w-[340px] shrink-0"
            >
               <div className="absolute -top-4 left-1/2 h-8 w-24 -translate-x-1/2 rotate-3 rounded bg-white/60 backdrop-blur-md shadow-sm z-30" />
               
               <div className="relative bg-white rounded-2xl p-4 md:p-5 shadow-[0_30px_70px_rgba(20,10,0,0.12)] border border-[#ede3cf]">
                  <div className="aspect-square w-full rounded-xl bg-[#fdfaf5] border border-[#f0e6d5] shadow-inner flex items-center justify-center p-4 relative overflow-hidden">
                     {current.thumbnailUrl ? (
                         <AutoRefreshImage
                           src={current.thumbnailUrl}
                           onRefreshSrc={() => onRefreshThumbnail(current.id)}
                           alt="当前图纸"
                           loading="eager"
                           className="h-full w-full object-contain filter drop-shadow-md"
                         />
                     ) : (
                         <Layers3 className="h-16 w-16 text-[#e8dac1]" />
                     )}
                     
                     <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-black tracking-widest px-2 py-1 rounded-full shadow-sm">
                        CURRENT
                     </div>
                  </div>

                  <div className="mt-5 px-1 space-y-4">
                     <div>
                        <h3 className="font-black text-2xl text-slate-800 tracking-tight truncate">{current.name}</h3>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                           {current.width} × {current.height} · {current.brand}
                        </p>
                     </div>

                     <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-end text-xs font-black text-slate-600">
                           <span className="uppercase tracking-widest opacity-60">Progress</span>
                           <span className="text-rose-500 text-sm">{current.progress.beanPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/60 shadow-inner w-full">
                           <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${current.progress.beanPercentage}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500 shadow-sm"
                           />
                        </div>
                     </div>

                     <Button
                        onClick={() => onOpen(current)}
                        disabled={loadingId === current.id}
                        className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base transition-transform active:scale-95 shadow-lg"
                     >
                        继续制作 <ArrowRight className="ml-2 h-4 w-4" />
                     </Button>
                  </div>
               </div>
            </motion.div>
          ) : (
             <div className="relative z-20 w-full max-w-[340px] shrink-0 aspect-[4/5] rounded-3xl border-4 border-dashed border-white/50 bg-white/20 flex flex-col items-center justify-center p-6 text-center shadow-inner">
                <div className="text-[#c0b5a6] mb-4"><Layers3 className="h-12 w-12" /></div>
                <h3 className="text-lg font-black text-[#a69d8f]">这有一个空位</h3>
             </div>
          )}

          {history.length > 0 && (
             <div className="relative z-10 w-full lg:w-[220px] flex flex-row justify-center lg:justify-start lg:flex-col gap-6 lg:-ml-6 mt-4 lg:mt-12 overflow-visible px-4 lg:px-0">
                {history.map((his, idx) => {
                   const tilt = idx === 0 ? 5 : -4;
                   const xOffset = idx === 0 ? 0 : 15;
                   
                   return (
                     <motion.div
                        key={his.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1, rotate: tilt, x: xOffset }}
                        whileHover={{ scale: 1.05, rotate: 0, x: 0, zIndex: 30 }}
                        transition={{ type: "spring", bounce: 0.3, delay: idx * 0.1 }}
                        className="cursor-pointer shrink-0 w-[140px] lg:w-full bg-white p-2.5 pb-4 md:p-3 md:pb-6 rounded-xl shadow-[0_15px_30px_rgba(20,10,0,0.08)] border border-cream-50"
                        onClick={() => onOpen(his)}
                     >
                        <div className="w-full aspect-square bg-[#f8f5ec] rounded-lg border border-[#e8dfce] shadow-inner mb-3 flex items-center justify-center p-2 relative overflow-hidden">
                           <AutoRefreshImage
                              src={his.thumbnailUrl}
                              onRefreshSrc={() => onRefreshThumbnail(his.id)}
                              alt={his.name}
                              loading="lazy"
                              className="h-full w-full object-contain mix-blend-multiply opacity-80"
                           />
                           <div className="absolute block top-0 right-0 border-[10px] border-transparent border-t-slate-300 border-r-slate-300" />
                        </div>
                        
                        <div className="px-1 space-y-1 text-center">
                           <h4 className="font-black text-xs text-slate-700 truncate">{his.name}</h4>
                           <div className="text-[10px] font-bold text-slate-400">
                             {his.progress.beanPercentage.toFixed(0)}%
                           </div>
                        </div>
                        
                        <div className="absolute inset-0 bg-slate-900/5 opacity-0 hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                           <div className="bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                              唤起 <History className="w-3 h-3"/>
                           </div>
                        </div>
                     </motion.div>
                   )
                })}
             </div>
          )}
       </div>
    </div>
  );
}

// -------------------------------------------------------------------------------- //

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
      <div className="flex items-start justify-between gap-3 px-2">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-500/70">
            Bead Dashboard
          </p>
          <h2 className="text-3xl font-black tracking-tight text-slate-800">
            拼豆工作台
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="rounded-full shadow-sm font-bold border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:scale-105 transition-all"
          onClick={() => void loadOverview()}
        >
          刷新桌面
        </Button>
      </div>

      <section>
        {loading ? (
            <div className="flex items-center justify-center p-16 rounded-[3rem] border-4 border-white bg-cream-50 shadow-sm animate-pulse text-slate-400 font-black tracking-widest text-sm">
               加载中...
            </div>
        ) : (
            <WorkspaceDeskScene 
               current={overview?.current ?? undefined}
               history={overview?.history || []}
               onOpen={openWorkspace}
               onRefreshThumbnail={refreshWorkspaceThumbnailSrc}
               loadingId={openingId}
            />
        )}
      </section>

      {error ? (
        <Card className="border-red-200 bg-red-50/80 p-4 text-sm font-bold text-red-600 shadow-sm rounded-2xl">
          {error}
        </Card>
      ) : null}

      <section className="space-y-5 pt-8 border-t-4 border-dashed border-slate-200 px-2 mt-8">
        <div>
          <h3 className="text-xl font-black text-slate-800">新建图纸</h3>
          <p className="text-xs font-bold text-slate-400 mt-1">从这里把新的素材丢进工作台吧</p>
        </div>

        <ImportModeSelector />
      </section>
    </div>
  );
}
