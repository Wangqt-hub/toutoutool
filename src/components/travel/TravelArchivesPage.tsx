"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import {
  TravelDatePicker,
  useBodyScrollLock,
} from "@/components/travel/TravelDatePicker";
import { readTravelApiResponse } from "@/lib/travel/client";
import type { BudgetLevel, TravelPlanArchive } from "@/lib/travel/types";
import {
  getBudgetLabel,
  getPlanStatusLabel,
  getPlanStatusTone,
  getTravelDayCount,
} from "@/lib/travel/utils";

const CREATE_BUDGET_OPTIONS: Array<{ value: BudgetLevel; label: string }> = [
  { value: "unspecified", label: "暂不设预算" },
  { value: "low", label: "轻预算" },
  { value: "medium", label: "平衡" },
  { value: "high", label: "舒展" },
];

function formatRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildStats(plans: TravelPlanArchive[]) {
  return {
    total: plans.length,
    generated: plans.filter((plan) => plan.planStatus === "generated").length,
    pending: plans.filter((plan) => plan.planStatus !== "generated").length,
  };
}

function getDisplayDestination(value: string) {
  const trimmed = value.trim();
  return !trimmed || trimmed === "未命名旅程" ? "新的旅程" : trimmed;
}

function TravelArchivesLoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="overflow-hidden rounded-[2.2rem] border border-[#eadfce] bg-[linear-gradient(180deg,#fffdf8_0%,#f3ebe0_100%)] shadow-[0_22px_70px_rgba(79,54,27,0.06)]"
      aria-busy="true"
    >
      <div className="relative px-5 py-5 sm:px-6">
        <div className="absolute right-[-24px] top-[-36px] h-36 w-36 rounded-full bg-[rgba(28,56,68,0.08)] blur-2xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white shadow-[0_14px_34px_rgba(79,54,27,0.08)]">
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">正在整理旅行档案</p>
              <p className="mt-1 text-xs text-slate-500">马上就好</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_34px_rgba(79,54,27,0.05)]"
              >
                <motion.div
                  className="h-1.5 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(32,56,70,0.16),rgba(255,255,255,0))]"
                  animate={{ x: ["-30%", "130%"] }}
                  transition={{
                    duration: 1.4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay: index * 0.14,
                  }}
                />

                <div className="mt-4 space-y-3">
                  <div className="h-3 w-20 rounded-full bg-[#efe3d4]" />
                  <div className="h-7 w-40 rounded-full bg-[#e7d8c7]" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-16 rounded-[1.2rem] bg-[#f5ede3]" />
                    <div className="h-16 rounded-[1.2rem] bg-[#f5ede3]" />
                    <div className="h-16 rounded-[1.2rem] bg-[#f5ede3]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

type CreateArchiveSheetProps = {
  creating: boolean;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    destination: string;
    startDate: string;
    endDate: string;
    budget: BudgetLevel;
  }) => void;
};

function CreateArchiveSheet({
  creating,
  open,
  onClose,
  onSubmit,
}: CreateArchiveSheetProps) {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState<BudgetLevel>("unspecified");
  const [formError, setFormError] = useState("");

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setDestination("");
      setStartDate("");
      setEndDate("");
      setBudget("unspecified");
      setFormError("");
    }
  }, [open]);

  const canSubmit = useMemo(() => {
    return (
      !creating &&
      destination.trim().length > 0 &&
      !!startDate &&
      !!endDate &&
      endDate >= startDate
    );
  }, [creating, destination, startDate, endDate]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]"
            onClick={() => {
              if (!creating) {
                onClose();
              }
            }}
            aria-label="关闭新建档案面板"
          />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pt-12 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6"
          >
            <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-[#ead7c4] bg-[linear-gradient(180deg,#fffdf8_0%,#f3ebe0_100%)] shadow-[0_28px_80px_rgba(33,24,18,0.18)]">
              <div className="border-b border-[#eadfce] px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Setup
                </p>
                <h2 className="mt-2 text-[1.8rem] font-black tracking-[-0.05em] text-slate-900">
                  先完成基础设置
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  先填地点和时间，再创建新的旅行档案。
                </p>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">地点</label>
                  <input
                    value={destination}
                    onChange={(event) => {
                      setDestination(event.target.value);
                      if (formError) {
                        setFormError("");
                      }
                    }}
                    placeholder="例如：东京 / 上海 / 香港"
                    className="w-full rounded-[1.35rem] border border-[#eadfce] bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TravelDatePicker
                    label="开始日期"
                    value={startDate}
                    onChange={(value) => {
                      setStartDate(value);
                      setEndDate((current) => (!current || current < value ? value : current));
                      if (formError) {
                        setFormError("");
                      }
                    }}
                  />

                  <TravelDatePicker
                    label="结束日期"
                    value={endDate}
                    onChange={(value) => {
                      setEndDate(value);
                      if (formError) {
                        setFormError("");
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-500">预算</label>
                    <span className="text-[11px] text-slate-400">选填</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {CREATE_BUDGET_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setBudget(option.value)}
                        className={clsx(
                          "rounded-[1.2rem] border px-3 py-3 text-sm font-medium transition",
                          budget === option.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-[#eadfce] bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {formError ? (
                  <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {formError}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-full"
                    onClick={onClose}
                    disabled={creating}
                  >
                    取消
                  </Button>

                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={!canSubmit}
                    onClick={() => {
                      if (!destination.trim() || !startDate || !endDate) {
                        setFormError("请先填好地点和时间。");
                        return;
                      }

                      if (endDate < startDate) {
                        setFormError("结束日期不能早于开始日期。");
                        return;
                      }

                      onSubmit({
                        destination: destination.trim(),
                        startDate,
                        endDate,
                        budget,
                      });
                    }}
                  >
                    {creating ? "创建中" : "创建档案"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

type DeleteArchiveSheetProps = {
  deleting: boolean;
  open: boolean;
  plan: TravelPlanArchive | null;
  onClose: () => void;
  onConfirm: () => void;
};

function DeleteArchiveSheet({
  deleting,
  open,
  plan,
  onClose,
  onConfirm,
}: DeleteArchiveSheetProps) {
  useBodyScrollLock(open);

  return (
    <AnimatePresence>
      {open && plan ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-950/34 backdrop-blur-[2px]"
            onClick={() => {
              if (!deleting) {
                onClose();
              }
            }}
            aria-label="关闭删除确认面板"
          />

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pt-12 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6"
          >
            <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[2rem] border border-[#edd8d6] bg-[linear-gradient(180deg,#fffaf8_0%,#f5ebe7_100%)] shadow-[0_28px_80px_rgba(33,24,18,0.18)]">
              <div className="border-b border-[#efdfdb] px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Delete
                </p>
                <h2 className="mt-2 text-[1.75rem] font-black tracking-[-0.05em] text-slate-900">
                  确认删除这份档案
                </h2>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="rounded-[1.5rem] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_14px_34px_rgba(79,54,27,0.05)]">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Travel Plan
                  </p>
                  <p className="mt-3 text-lg font-bold tracking-[-0.03em] text-slate-900">
                    {getDisplayDestination(plan.destination)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    删除后档案和当前行程会一起移除，不能恢复。
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-full"
                    onClick={onClose}
                    disabled={deleting}
                  >
                    取消
                  </Button>

                  <Button
                    type="button"
                    className="rounded-full bg-rose-600 text-white hover:bg-rose-500"
                    onClick={onConfirm}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        删除中
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除档案
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function TravelArchivesPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<TravelPlanArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [planPendingDelete, setPlanPendingDelete] = useState<TravelPlanArchive | null>(
    null
  );
  const canOpenCreateArchive = !loading && !creating && !deletingId;

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await readTravelApiResponse<TravelPlanArchive[]>(
          await fetch("/api/travel-plans", {
            cache: "no-store",
          })
        );

        setPlans(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "旅行档案加载失败。");
      } finally {
        setLoading(false);
      }
    }

    void loadPlans();
  }, []);

  function openCreateSheet() {
    if (!canOpenCreateArchive) {
      return;
    }

    setShowCreateSheet(true);
    setError("");
  }

  function openDeleteSheet(plan: TravelPlanArchive) {
    if (creating || deletingId) {
      return;
    }

    setPlanPendingDelete(plan);
    setError("");
  }

  async function handleCreateArchive(payload: {
    destination: string;
    startDate: string;
    endDate: string;
    budget: BudgetLevel;
  }) {
    setCreating(true);
    setError("");

    try {
      const data = await readTravelApiResponse<TravelPlanArchive>(
        await fetch("/api/travel-plans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
      );

      setShowCreateSheet(false);
      router.push(`/tools/travel/${data.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建旅行档案失败。");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteArchive() {
    if (!planPendingDelete) {
      return;
    }

    const targetId = planPendingDelete.id;
    setDeletingId(targetId);
    setError("");

    try {
      await readTravelApiResponse<TravelPlanArchive>(
        await fetch(`/api/travel-plans/${targetId}`, {
          method: "DELETE",
        })
      );

      setPlans((current) => current.filter((plan) => plan.id !== targetId));
      setPlanPendingDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除旅行档案失败。");
    } finally {
      setDeletingId(null);
    }
  }

  const stats = buildStats(plans);

  return (
    <>
      <div className="space-y-5 pb-24">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[2.4rem] border border-[#ead7c4] bg-[linear-gradient(145deg,#17252f_0%,#243948_44%,#56706d_100%)] px-5 py-5 text-white shadow-[0_30px_90px_rgba(19,25,32,0.22)] sm:px-6"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(246,214,171,0.24),transparent_26%)]" />

          <div className="relative space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">
                  Travel Archive
                </p>
                <h1 className="mt-2 text-[2.3rem] font-black tracking-[-0.06em] text-white sm:text-[2.9rem]">
                  旅行档案
                </h1>
              </div>

              <Button
                type="button"
                className="rounded-full bg-white text-slate-900 hover:bg-[#f5efe4]"
                onClick={openCreateSheet}
                disabled={!canOpenCreateArchive}
              >
                <Plus className="mr-2 h-4 w-4" />
                {loading ? "加载中" : creating ? "创建中" : "新建"}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-xs text-white/60">总档案</p>
                <p className="mt-2 text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-xs text-white/60">已生成</p>
                <p className="mt-2 text-2xl font-bold text-white">{stats.generated}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-xs text-white/60">待继续</p>
                <p className="mt-2 text-2xl font-bold text-white">{stats.pending}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {error ? (
          <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <TravelArchivesLoadingState />
        ) : plans.length === 0 ? (
          <div className="overflow-hidden rounded-[2.2rem] border border-[#eadfce] bg-[linear-gradient(180deg,#fffdf8_0%,#f3ebe0_100%)] shadow-[0_22px_70px_rgba(79,54,27,0.06)]">
            <div className="relative px-6 py-10 text-center">
              <div className="absolute right-[-30px] top-[-36px] h-40 w-40 rounded-full bg-[rgba(28,56,68,0.08)] blur-2xl" />

              <div className="relative mx-auto max-w-md space-y-4">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-white shadow-[0_16px_40px_rgba(79,54,27,0.08)]">
                  <Sparkles className="h-8 w-8 text-slate-700" />
                </div>
                <h2 className="text-[1.9rem] font-black tracking-[-0.05em] text-slate-900">
                  先建第一份旅行档案
                </h2>
                <p className="text-sm leading-7 text-slate-500">
                  先填地点和日期，再进入工作台继续安排行程。
                </p>
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={openCreateSheet}
                  disabled={!canOpenCreateArchive}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新建档案
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan, index) => {
              const itemCount = plan.itinerary.days.reduce(
                (count, day) => count + day.items.length,
                0
              );

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div className="relative overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,241,232,0.98))] shadow-[0_18px_56px_rgba(79,54,27,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(79,54,27,0.09)]">
                    <button
                      type="button"
                      className="absolute right-3.5 top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-[rgba(255,251,247,0.92)] text-slate-500 shadow-[0_10px_28px_rgba(79,54,27,0.12)] backdrop-blur transition hover:border-rose-200 hover:bg-white hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => openDeleteSheet(plan)}
                      disabled={!!deletingId}
                      aria-label={`删除 ${getDisplayDestination(plan.destination)}`}
                    >
                      {deletingId === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>

                    <Link href={`/tools/travel/${plan.id}`} className="block px-5 py-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={clsx(
                                "rounded-full px-3 py-1 text-[11px] font-medium",
                                getPlanStatusTone(plan.planStatus)
                              )}
                            >
                              {getPlanStatusLabel(plan.planStatus)}
                            </span>
                            <span className="rounded-full bg-slate-900/5 px-3 py-1 text-[11px] text-slate-600">
                              {getBudgetLabel(plan.budget)}
                            </span>
                          </div>

                          <h2 className="mt-4 text-[2rem] font-black tracking-[-0.05em] text-slate-900">
                            {getDisplayDestination(plan.destination)}
                          </h2>
                        </div>

                        <p className="pr-12 text-xs text-slate-400 sm:pr-14">
                          {formatRelativeTime(plan.updatedAt)}
                        </p>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[1.4rem] bg-white/80 px-4 py-3">
                          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            <CalendarDays className="h-3.5 w-3.5" />
                            日期
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-700">
                            {plan.startDate} - {plan.endDate}
                          </p>
                        </div>

                        <div className="rounded-[1.4rem] bg-white/80 px-4 py-3">
                          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            <Clock3 className="h-3.5 w-3.5" />
                            节奏
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-700">
                            {itemCount > 0
                              ? `${itemCount} 个节点`
                              : `${getTravelDayCount(plan.startDate, plan.endDate)} 天待安排`}
                          </p>
                        </div>

                        <div className="rounded-[1.4rem] bg-white/80 px-4 py-3">
                          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            <Link2 className="h-3.5 w-3.5" />
                            来源
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-700">
                            {plan.sourceLinks.length} 条攻略
                          </p>
                        </div>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="fixed inset-x-4 bottom-4 z-30 sm:hidden">
          <Button
            type="button"
            className="w-full rounded-[1.6rem] shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
            onClick={openCreateSheet}
            disabled={!canOpenCreateArchive}
          >
            <Plus className="mr-2 h-4 w-4" />
            {loading ? "加载中" : creating ? "创建中" : "新建档案"}
          </Button>
        </div>
      </div>

      <CreateArchiveSheet
        open={showCreateSheet}
        creating={creating}
        onClose={() => setShowCreateSheet(false)}
        onSubmit={handleCreateArchive}
      />

      <DeleteArchiveSheet
        open={!!planPendingDelete}
        deleting={!!deletingId}
        plan={planPendingDelete}
        onClose={() => {
          if (!deletingId) {
            setPlanPendingDelete(null);
          }
        }}
        onConfirm={handleDeleteArchive}
      />
    </>
  );
}
