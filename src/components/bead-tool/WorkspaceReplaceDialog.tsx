"use client";

import { AlertTriangle, ArrowRightCircle, History, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BeadWorkspaceSummary } from "@/lib/bead/workspaces";

interface WorkspaceReplaceDialogProps {
  open: boolean;
  currentWorkspace: BeadWorkspaceSummary | null;
  incomingName: string | null;
  loading?: boolean;
  onClose: () => void;
  onContinueCurrent: () => void;
  onOverwrite: () => void;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function WorkspaceReplaceDialog({
  open,
  currentWorkspace,
  incomingName,
  loading = false,
  onClose,
  onContinueCurrent,
  onOverwrite,
}: WorkspaceReplaceDialogProps) {
  if (!open || !currentWorkspace) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="关闭弹窗"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
      />

      <Card className="relative z-10 w-full max-w-xl border-white/80 bg-white/96 shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current Draft Found
              </p>
              <h3 className="text-xl font-semibold text-slate-900">
                检测到未完成的拼豆工作台
              </h3>
              <p className="text-sm leading-6 text-slate-600">
                你现在有一张正在制作中的图纸。可以继续当前草稿，也可以用新图纸覆盖当前工作台，旧草稿会自动保留到历史记录里。
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-cream-100 bg-cream-50/80 p-4">
            <div className="flex items-start gap-4">
              {currentWorkspace.thumbnailUrl ? (
                <img
                  src={currentWorkspace.thumbnailUrl}
                  alt="当前草稿缩略图"
                  className="h-24 w-24 rounded-2xl border border-cream-100 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-cream-100 bg-white text-slate-400">
                  <Layers3 className="h-8 w-8" />
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="truncate text-base font-semibold text-slate-900">
                    {currentWorkspace.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {currentWorkspace.width} × {currentWorkspace.height} ·{" "}
                    {currentWorkspace.brand}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      豆格进度
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {currentWorkspace.progress.completedBeans} /{" "}
                      {currentWorkspace.progress.totalBeans} ·{" "}
                      {formatPercent(currentWorkspace.progress.beanPercentage)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      色号进度
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {currentWorkspace.progress.completedColors} /{" "}
                      {currentWorkspace.progress.totalColors} ·{" "}
                      {formatPercent(currentWorkspace.progress.colorPercentage)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-dashed border-cream-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <History className="h-4 w-4 text-accent-brown" />
              <span>即将导入的新图纸</span>
            </div>
            <p className="mt-2 truncate">
              {incomingName || "新的拼豆图纸"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={onContinueCurrent}
              disabled={loading}
            >
              继续当前图纸
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={onOverwrite}
              disabled={loading}
            >
              覆盖为新图纸
              <ArrowRightCircle className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
