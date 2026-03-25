"use client";

import { CheckCircle2, Layers3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BeadWorkspaceSummary } from "@/lib/bead/workspaces";

interface WorkspaceLimitDialogProps {
  open: boolean;
  workspaces: BeadWorkspaceSummary[];
  incomingName: string | null;
  requiredDeletionCount: number;
  selectedWorkspaceIds: string[];
  loading?: boolean;
  onToggleWorkspace: (workspaceId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

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

export function WorkspaceLimitDialog({
  open,
  workspaces,
  incomingName,
  requiredDeletionCount,
  selectedWorkspaceIds,
  loading = false,
  onToggleWorkspace,
  onClose,
  onConfirm,
}: WorkspaceLimitDialogProps) {
  if (!open) {
    return null;
  }

  const selectedSet = new Set(selectedWorkspaceIds);
  const selectionComplete = selectedWorkspaceIds.length === requiredDeletionCount;
  const title =
    requiredDeletionCount > 1
      ? `需要先删除 ${requiredDeletionCount} 条图纸`
      : "需要先删除 1 条图纸";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="关闭删除选择弹窗"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />

      <Card className="relative z-10 w-full max-w-3xl border-white/80 bg-white/96 shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace Limit
              </p>
              <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
              <p className="text-sm leading-6 text-slate-600">
                工作台最多只保留 3 条记录。创建
                {incomingName ? `「${incomingName}」` : "新图纸"}之前，请先选择要删除的
                {requiredDeletionCount > 1 ? `${requiredDeletionCount} 条旧记录` : "1 条旧记录"}。
              </p>
            </div>
          </div>

          <div className="rounded-[24px] bg-cream-50/80 px-4 py-3 text-sm text-slate-600">
            已选择 {selectedWorkspaceIds.length} / {requiredDeletionCount}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {workspaces.map((workspace) => {
              const selected = selectedSet.has(workspace.id);

              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => onToggleWorkspace(workspace.id)}
                  className={`rounded-[28px] border p-4 text-left transition ${
                    selected
                      ? "border-red-300 bg-red-50"
                      : "border-cream-100 bg-white hover:border-accent-brown/30 hover:bg-cream-50/60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {workspace.thumbnailUrl ? (
                      <img
                        src={workspace.thumbnailUrl}
                        alt="图纸缩略图"
                        loading="lazy"
                        decoding="async"
                        className="h-20 w-20 rounded-2xl border border-cream-100 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-cream-100 bg-cream-50 text-slate-400">
                        <Layers3 className="h-7 w-7" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {workspace.isCurrent ? "当前草稿" : "历史图纸"}
                          </p>
                          <p className="text-xs text-slate-500">
                            豆格完成 {workspace.progress.completedBeans} /{" "}
                            {workspace.progress.totalBeans}
                          </p>
                          <p className="text-xs text-slate-500">
                            最近打开 {formatDateTime(workspace.lastOpenedAt)}
                          </p>
                        </div>

                        <span
                          className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${
                            selected
                              ? "border-red-300 bg-red-500 text-white"
                              : "border-cream-200 bg-white text-transparent"
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-cream-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                          style={{ width: `${workspace.progress.beanPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
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
              size="lg"
              onClick={onConfirm}
              disabled={loading || !selectionComplete}
            >
              删除后创建新图纸
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
