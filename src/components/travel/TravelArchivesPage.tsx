"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  Link2,
  Plus,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { readTravelApiResponse } from "@/lib/travel/client";
import type { TravelPlanArchive } from "@/lib/travel/types";
import {
  getBudgetLabel,
  getPlanStatusLabel,
  getPlanStatusTone,
  getTravelDayCount,
} from "@/lib/travel/utils";

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

export function TravelArchivesPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<TravelPlanArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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

  async function handleCreateArchive() {
    setCreating(true);
    setError("");

    try {
      const data = await readTravelApiResponse<TravelPlanArchive>(
        await fetch("/api/travel-plans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        })
      );

      router.push(`/tools/travel/${data.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建旅行档案失败。");
      setCreating(false);
    }
  }

  const stats = buildStats(plans);

  return (
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
              onClick={handleCreateArchive}
              disabled={creating}
            >
              <Plus className="mr-2 h-4 w-4" />
              {creating ? "创建中…" : "新建"}
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-[2rem] bg-white/80 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
            />
          ))}
        </div>
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
                只要先填地点和时间，就可以进入工作台继续排。
              </p>
              <Button
                type="button"
                className="rounded-full"
                onClick={handleCreateArchive}
                disabled={creating}
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
                <Link
                  href={`/tools/travel/${plan.id}`}
                  className="block overflow-hidden rounded-[2rem] border border-[#eadfce] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,241,232,0.98))] px-5 py-5 shadow-[0_18px_56px_rgba(79,54,27,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(79,54,27,0.09)]"
                >
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

                    <p className="text-xs text-slate-400">
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
                          : `${getTravelDayCount(plan.startDate, plan.endDate)} 天待排`}
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
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-4 bottom-4 z-30 sm:hidden">
        <Button
          type="button"
          className="w-full rounded-[1.6rem] shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
          onClick={handleCreateArchive}
          disabled={creating}
        >
          <Plus className="mr-2 h-4 w-4" />
          {creating ? "创建中…" : "新建档案"}
        </Button>
      </div>
    </div>
  );
}
