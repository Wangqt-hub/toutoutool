"use client";

import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Coffee,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Link2,
  Loader2,
  Bus,
  Banknote,
  Info,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiLoadingStage } from "@/components/mascot/EmojiLoadingStage";
import { useMinimumLoadingDuration } from "@/components/mascot/useMinimumLoadingDuration";
import { readTravelApiResponse } from "@/lib/travel/client";
import {
  type BudgetLevel,
  type Itinerary,
  type ItineraryItem,
  type ItineraryItemKind,
  type PreferenceKey,
  type TravelPlanArchive,
  TRAVEL_BUDGET_OPTIONS,
  TRAVEL_PREFERENCE_OPTIONS,
} from "@/lib/travel/types";
import {
  createEmptyItineraryItem,
  getBudgetLabel,
  getPlanStatusLabel,
  getPlanStatusTone,
  getTravelDayCount,
  inferItineraryItemKind,
  isCompleteTravelTime,
  normalizeTravelItinerary,
  sortTravelItineraryItems,
  toEditableTravelSnapshot,
} from "@/lib/travel/utils";
import type { LoadingStorySlide } from "@/lib/loading-story-presets";

type Props = {
  travelPlanId: string;
};

type OverlayTone = "running" | "success" | "error";
type VisibleTimelineKind = Exclude<ItineraryItemKind, "shopping">;

const travelWorkspaceLoadingSlides: LoadingStorySlide[] = [
  {
    id: "travel-workspace-load-01",
    eyebrow: "Trip Workspace",
    tag: "档案",
    status: "正在读取旅行档案",
    headline: "正在打开旅行工作台",
    body: "目的地、日期和草稿内容正在恢复。",
    image: "/loading-lab/emoji-heads/emoji_04.png",
    alt: "思考表情",
    accent: "#D7E6C7",
    accentSoft: "#F5F9EF",
    glow: "rgba(137, 177, 107, 0.22)"
  },
  {
    id: "travel-workspace-load-02",
    eyebrow: "Trip Workspace",
    tag: "时间线",
    status: "正在准备时间线",
    headline: "正在整理行程内容",
    body: "天数、地点和参考链接马上就位。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静微笑表情",
    accent: "#F3CDBB",
    accentSoft: "#FFF2EA",
    glow: "rgba(233, 154, 107, 0.22)"
  }
];

const travelGenerationSlides: LoadingStorySlide[] = [
  {
    id: "travel-generate-01",
    eyebrow: "Qwen Planning",
    tag: "同步",
    status: "正在同步旅行档案",
    headline: "正在整理出行条件",
    body: "先确认目的地、日期、预算和偏好。",
    image: "/loading-lab/emoji-heads/emoji_08.png",
    alt: "平静微笑表情",
    accent: "#F3CDBB",
    accentSoft: "#FFF2EA",
    glow: "rgba(233, 154, 107, 0.22)"
  },
  {
    id: "travel-generate-02",
    eyebrow: "Qwen Planning",
    tag: "生成",
    status: "正在生成时间线",
    headline: "正在规划每天的安排",
    body: "AI 正在把地点、节奏和交通串起来。",
    image: "/loading-lab/emoji-heads/emoji_05.png",
    alt: "专注表情",
    accent: "#C9DDF6",
    accentSoft: "#EFF6FF",
    glow: "rgba(111, 157, 219, 0.2)"
  },
  {
    id: "travel-generate-03",
    eyebrow: "Qwen Planning",
    tag: "收尾",
    status: "正在补齐细节",
    headline: "正在润色行程细节",
    body: "交通、花费和提醒正在补齐。",
    image: "/loading-lab/emoji-heads/emoji_01.png",
    alt: "开心表情",
    accent: "#F6D9A9",
    accentSoft: "#FFF7E3",
    glow: "rgba(239, 189, 88, 0.24)"
  }
];

const DAY_SURFACES = [
  {
    shell:
      "border-[4px] border-white bg-[#fcf8f2] shadow-cute",
    badge: "bg-rose-100 text-rose-700",
    line: "from-rose-200 via-orange-100 to-transparent",
    dot: "border-white bg-rose-300",
    glaze: "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.8),transparent_60%)]",
  },
  {
    shell:
      "border-[4px] border-white bg-[#f2f8f5] shadow-cute",
    badge: "bg-emerald-100 text-emerald-700",
    line: "from-emerald-200 via-teal-100 to-transparent",
    dot: "border-white bg-emerald-300",
    glaze: "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.82),transparent_62%)]",
  },
  {
    shell:
      "border-[4px] border-white bg-[#f9f1f0] shadow-cute",
    badge: "bg-sky-100 text-sky-700",
    line: "from-sky-200 via-blue-100 to-transparent",
    dot: "border-white bg-sky-300",
    glaze: "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.8),transparent_62%)]",
  },
];

const TIMELINE_CARD_META = {
  food: {
    label: "美食",
    icon: UtensilsCrossed,
    shell:
      "border-[4px] border-white bg-orange-50/90 backdrop-blur-md shadow-sm",
    chip: "bg-orange-100 text-orange-700",
    glow: "bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_52%)]",
  },
  sightseeing: {
    label: "景点",
    icon: MapPinned,
    shell:
      "border-[4px] border-white bg-sky-50/90 backdrop-blur-md shadow-sm",
    chip: "bg-sky-100 text-sky-700",
    glow: "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_52%)]",
  },
  activity: {
    label: "活动",
    icon: Compass,
    shell:
      "border-[4px] border-white bg-emerald-50/90 backdrop-blur-md shadow-sm",
    chip: "bg-emerald-100 text-emerald-700",
    glow: "bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_52%)]",
  },
  rest: {
    label: "休息",
    icon: Coffee,
    shell:
      "border-[4px] border-white bg-rose-50/90 backdrop-blur-md shadow-sm",
    chip: "bg-rose-100 text-rose-700",
    glow: "bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.18),transparent_52%)]",
  },
} satisfies Record<
  VisibleTimelineKind,
  {
    label: string;
    icon: typeof Compass;
    shell: string;
    chip: string;
    glow: string;
  }
>;

const TIMELINE_EDIT_KIND_OPTIONS: VisibleTimelineKind[] = [
  "food",
  "sightseeing",
  "activity",
  "rest",
];

function getVisibleTimelineKind(kind: ItineraryItemKind): VisibleTimelineKind {
  return kind === "shopping" ? "activity" : kind;
}

function formatDetailTime(value: string | null) {
  if (!value) {
    return "未生成";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateChip(value: string) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function buildSavePayload(plan: TravelPlanArchive) {
  return {
    destination: plan.destination,
    startDate: plan.startDate,
    endDate: plan.endDate,
    budget: plan.budget,
    preferences: plan.preferences,
    notes: plan.notes,
    planStatus: plan.planStatus,
    sourceLinks: plan.sourceLinks,
    itinerary: plan.itinerary,
    generationModel: plan.generationModel,
    generationError: plan.generationError,
    lastGeneratedAt: plan.lastGeneratedAt,
  };
}

function clampDates(startDate: string, endDate: string) {
  if (!startDate) {
    return { startDate, endDate };
  }

  if (!endDate || endDate < startDate) {
    return { startDate, endDate: startDate };
  }

  return { startDate, endDate };
}

function countTimelineItems(itinerary: Itinerary) {
  return itinerary.days.reduce((count, day) => count + day.items.length, 0);
}

function hasTimelineContent(itinerary: Itinerary) {
  return itinerary.days.some(
    (day) =>
      day.theme.trim().length > 0 ||
      day.items.some(
        (item) =>
          item.startTime.trim() ||
          item.endTime.trim() ||
          item.placeName.trim() ||
          item.districtOrArea.trim() ||
          item.summary.trim() ||
          item.transport.trim() ||
          item.estimatedCost.trim() ||
          item.tips.trim()
      )
  );
}

function getDisplayDestination(value: string) {
  const trimmed = value.trim();
  return !trimmed || trimmed === "未命名旅程" ? "新的旅程" : trimmed;
}

function getOverlayMeta(progress: number, tone: OverlayTone) {
  if (tone === "success") {
    return { title: "行程已生成", detail: "时间轴已经回到工作台，马上就能继续改。" };
  }

  if (tone === "error") {
    return { title: "生成中断", detail: "正在返回工作台，你可以修改条件后再试一次。" };
  }

  if (progress < 26) {
    return { title: "同步旅行档案", detail: "正在整理地点、时间和偏好。" };
  }

  if (progress < 54) {
    return { title: "提炼攻略信息", detail: "把攻略内容压缩成可用线索。" };
  }

  if (progress < 82) {
    return { title: "生成时间轴", detail: "Qwen 正在串联每天的安排。" };
  }

  return { title: "润色细节", detail: "补齐交通、花费和提醒。" };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function mergeTravelPlanSnapshot(
  base: TravelPlanArchive,
  latest: TravelPlanArchive
) {
  return {
    ...base,
    ...latest,
    sourceLinks: latest.sourceLinks,
    itinerary: latest.itinerary,
    preferences: latest.preferences,
  };
}

function didGeneratePlanChange(
  previousPlan: TravelPlanArchive,
  latestPlan: TravelPlanArchive
) {
  return (
    latestPlan.planStatus === "generated" &&
    !latestPlan.generationError &&
    (latestPlan.lastGeneratedAt !== previousPlan.lastGeneratedAt ||
      latestPlan.updatedAt !== previousPlan.updatedAt ||
      toEditableTravelSnapshot(latestPlan) !== toEditableTravelSnapshot(previousPlan))
  );
}

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }

  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

const TIME_WHEEL_ITEM_HEIGHT = 42;
const TIME_WHEEL_SPACER_HEIGHT = TIME_WHEEL_ITEM_HEIGHT * 2;
const TIME_HOUR_OPTIONS = [
  "",
  ...Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, "0")),
];
const TIME_MINUTE_OPTIONS = [
  "",
  ...Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, "0")),
];

function parseTimeValue(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return { hour: "", minute: "" };
  }

  return {
    hour: match[1],
    minute: match[2],
  };
}

function buildTimeValue(hour: string, minute: string) {
  if (!hour && !minute) {
    return "";
  }

  const nextHour = hour || "00";
  const nextMinute = minute || "00";
  return `${nextHour}:${nextMinute}`;
}

function formatTimeLabel(value: string) {
  return value || "时间";
}


function formatTimeDisplayLabel(value: string) {
  return value || "时间";
}

function parseLocalDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfCalendarMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftCalendarMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function buildCalendarDays(month: Date) {
  const firstDay = startOfCalendarMonth(month);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      value: formatLocalDateValue(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

function formatCalendarMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatDateFieldLabel(value: string) {
  const date = parseLocalDate(value);

  if (!date) {
    return "选择日期";
  }

  return `${date.getFullYear()}/${`${date.getMonth() + 1}`.padStart(2, "0")}/${`${date.getDate()}`.padStart(2, "0")}`;
}

function formatSelectedDateTitle(value: string) {
  const date = parseLocalDate(value);

  if (!date) {
    return "未选择日期";
  }

  const weekLabel = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekLabel}`;
}

function TimeWheelColumn({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const container = ref.current;

    if (!container) {
      return;
    }

    const index = Math.max(0, options.indexOf(value));
    const targetTop = index * TIME_WHEEL_ITEM_HEIGHT;

    if (Math.abs(container.scrollTop - targetTop) > 1) {
      container.scrollTo({
        top: targetTop,
        behavior: "auto",
      });
    }
  }, [options, value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleScroll = () => {
    const container = ref.current;

    if (!container) {
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      const index = Math.max(
        0,
        Math.min(options.length - 1, Math.round(container.scrollTop / TIME_WHEEL_ITEM_HEIGHT))
      );
      const nextValue = options[index] ?? "";

      if (nextValue !== value) {
        onChange(nextValue);
      }
    }, 60);
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        aria-label={ariaLabel}
        onScroll={handleScroll}
        className="h-[210px] overflow-y-auto overscroll-contain rounded-[1.6rem] bg-[#f7efe6] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: TIME_WHEEL_SPACER_HEIGHT }} />
        {options.map((option, index) => {
          const selected = option === value;

          return (
            <button
              key={`${ariaLabel}-${option || "blank"}-${index}`}
              type="button"
              onClick={() => {
                onChange(option);
                ref.current?.scrollTo({
                  top: index * TIME_WHEEL_ITEM_HEIGHT,
                  behavior: "smooth",
                });
              }}
              className={clsx(
                "flex h-[42px] w-full snap-center items-center justify-center rounded-[0.95rem] font-mono text-[22px] font-semibold tabular-nums tracking-[0.01em] transition",
                selected ? "text-slate-900" : "text-slate-400"
              )}
            >
              {option || "--"}
            </button>
          );
        })}
        <div style={{ height: TIME_WHEEL_SPACER_HEIGHT }} />
      </div>

      <div className="pointer-events-none absolute inset-x-2 top-1/2 h-[42px] -translate-y-1/2 rounded-[1rem] border border-[#dfccb8] bg-white/88 shadow-[0_10px_26px_rgba(79,54,27,0.08)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 rounded-t-[1.6rem] bg-[linear-gradient(180deg,rgba(247,239,230,0.98),rgba(247,239,230,0))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-[1.6rem] bg-[linear-gradient(0deg,rgba(247,239,230,0.98),rgba(247,239,230,0))]" />
    </div>
  );
}

function FloatingPickerPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") {
      return undefined;
    }

    const { body, documentElement } = document;
    const lockCount = Number(body.dataset.scrollLockCount ?? "0");

    if (lockCount === 0) {
      body.dataset.scrollLockOverflow = body.style.overflow;
      body.dataset.scrollLockPosition = body.style.position;
      body.dataset.scrollLockTop = body.style.top;
      body.dataset.scrollLockLeft = body.style.left;
      body.dataset.scrollLockRight = body.style.right;
      body.dataset.scrollLockWidth = body.style.width;
      body.dataset.scrollLockTouchAction = body.style.touchAction;
      body.dataset.scrollLockHtmlOverflow = documentElement.style.overflow;
      body.dataset.scrollLockHtmlOverscroll = documentElement.style.overscrollBehavior;
      body.dataset.scrollLockY = `${window.scrollY}`;

      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${window.scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.touchAction = "none";
      documentElement.style.overflow = "hidden";
      documentElement.style.overscrollBehavior = "none";
    }

    body.dataset.scrollLockCount = `${lockCount + 1}`;

    return () => {
      const nextCount = Math.max(0, Number(body.dataset.scrollLockCount ?? "1") - 1);
      body.dataset.scrollLockCount = `${nextCount}`;

      if (nextCount > 0) {
        return;
      }

      const scrollY = Number(body.dataset.scrollLockY ?? "0");

      body.style.overflow = body.dataset.scrollLockOverflow ?? "";
      body.style.position = body.dataset.scrollLockPosition ?? "";
      body.style.top = body.dataset.scrollLockTop ?? "";
      body.style.left = body.dataset.scrollLockLeft ?? "";
      body.style.right = body.dataset.scrollLockRight ?? "";
      body.style.width = body.dataset.scrollLockWidth ?? "";
      body.style.touchAction = body.dataset.scrollLockTouchAction ?? "";
      documentElement.style.overflow = body.dataset.scrollLockHtmlOverflow ?? "";
      documentElement.style.overscrollBehavior = body.dataset.scrollLockHtmlOverscroll ?? "";

      delete body.dataset.scrollLockCount;
      delete body.dataset.scrollLockOverflow;
      delete body.dataset.scrollLockPosition;
      delete body.dataset.scrollLockTop;
      delete body.dataset.scrollLockLeft;
      delete body.dataset.scrollLockRight;
      delete body.dataset.scrollLockWidth;
      delete body.dataset.scrollLockTouchAction;
      delete body.dataset.scrollLockHtmlOverflow;
      delete body.dataset.scrollLockHtmlOverscroll;
      delete body.dataset.scrollLockY;

      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

function TimePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState("");
  const [draftMinute, setDraftMinute] = useState("");
  const isEndField = label.includes("结束") || label.toLowerCase().includes("end");
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const { hour, minute } = parseTimeValue(value);
    setDraftHour(hour);
    setDraftMinute(minute);

  }, [open, value]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "inline-flex min-w-0 items-center bg-transparent px-0 py-1 text-left font-mono text-[18px] font-semibold tabular-nums tracking-[0.01em] transition sm:text-[19px]",
          value ? "text-slate-900" : "text-slate-400"
        )}
      >
        <span className="truncate">{formatTimeDisplayLabel(value)}</span>
        {isEndField ? null : (
          <span className="shrink-0 pl-2 text-slate-300">
            -
          </span>
        )}
      </button>

      <FloatingPickerPortal>
        <AnimatePresence>
          {open ? (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[80] bg-slate-950/28 backdrop-blur-[2px]"
                onClick={() => setOpen(false)}
                aria-label="关闭时间选择器"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[90] flex items-center justify-center p-4"
              >
                <div className="w-full max-w-[360px] rounded-[2rem] border border-[#eadfce] bg-[linear-gradient(180deg,#fffdf9_0%,#f4ece1_100%)] shadow-[0_20px_60px_rgba(33,24,18,0.16)]">
                  <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      取消
                    </button>

                    <div className="min-w-0 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Time
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {isEndField ? "结束时间" : "开始时间"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftHour("");
                          setDraftMinute("");
                        }}
                        className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        清空
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(buildTimeValue(draftHour, draftMinute));
                          setOpen(false);
                        }}
                        className="text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                      >
                        完成
                      </button>
                    </div>
                  </div>

                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <div className="rounded-[2rem] border border-[#eadfce] bg-white/72 p-4 shadow-[0_14px_40px_rgba(79,54,27,0.08)]">
                      <div className="text-center font-mono text-[2rem] font-semibold tabular-nums tracking-[0.02em] text-slate-900">
                        {draftHour || "--"}:{draftMinute || "--"}
                      </div>

                      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-center gap-2">
                        <TimeWheelColumn
                          options={TIME_HOUR_OPTIONS}
                          value={draftHour}
                          onChange={setDraftHour}
                          ariaLabel="小时"
                        />
                        <div className="text-center font-mono text-[1.75rem] font-semibold text-slate-300">
                          :
                        </div>
                        <TimeWheelColumn
                          options={TIME_MINUTE_OPTIONS}
                          value={draftMinute}
                          onChange={setDraftMinute}
                          ariaLabel="分钟"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </FloatingPickerPortal>
    </>
  );
}

function DatePickerField({
  label,
  value,
  onChange,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfCalendarMonth(parseLocalDate(value) ?? new Date())
  );
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setVisibleMonth(startOfCalendarMonth(parseLocalDate(value) ?? new Date()));

  }, [open, value]);

  const selectedValue = parseLocalDate(value) ? value : "";
  const calendarDays = buildCalendarDays(visibleMonth);

  return (
    <div className="space-y-2">
      {hideLabel ? null : <label className="text-xs font-medium text-slate-500">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[1.35rem] border border-[#eadfce] bg-white px-4 py-3 text-left text-[16px] text-slate-700 outline-none transition hover:border-slate-300"
      >
        {formatDateFieldLabel(value)}
      </button>

      <FloatingPickerPortal>
        <AnimatePresence>
          {open ? (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[80] bg-slate-950/28 backdrop-blur-[2px]"
                onClick={() => setOpen(false)}
                aria-label="关闭日期选择器"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[90] flex items-center justify-center p-4"
              >
                <div className="w-full max-w-[368px] rounded-[2rem] border border-[#eadfce] bg-[linear-gradient(180deg,#fffdf9_0%,#f4ece1_100%)] shadow-[0_20px_60px_rgba(33,24,18,0.16)]">
                  <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      取消
                    </button>

                    <div className="min-w-0 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Date
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {label}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const todayValue = formatLocalDateValue(new Date());
                        onChange(todayValue);
                        setOpen(false);
                      }}
                      className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      今天
                    </button>
                  </div>

                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    <div className="rounded-[2rem] border border-[#eadfce] bg-white/72 p-4 shadow-[0_14px_40px_rgba(79,54,27,0.08)]">
                      <div className="text-center text-lg font-semibold text-slate-900">
                        {formatSelectedDateTitle(value)}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setVisibleMonth((current) => shiftCalendarMonth(current, -1))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#eadfce] bg-white text-slate-700 transition hover:border-slate-300"
                          aria-label="上个月"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="text-sm font-semibold text-slate-800">
                          {formatCalendarMonthLabel(visibleMonth)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setVisibleMonth((current) => shiftCalendarMonth(current, 1))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#eadfce] bg-white text-slate-700 transition hover:border-slate-300"
                          aria-label="下个月"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
                        {["日", "一", "二", "三", "四", "五", "六"].map((weekDay) => (
                          <div key={weekDay}>{weekDay}</div>
                        ))}
                      </div>

                      <div className="mt-2 grid grid-cols-7 gap-1">
                        {calendarDays.map((day) => {
                          const isSelected = day.value === selectedValue;

                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => {
                                onChange(day.value);
                                setOpen(false);
                              }}
                              className={clsx(
                                "flex h-10 items-center justify-center rounded-[0.95rem] text-sm font-medium transition",
                                isSelected
                                  ? "bg-slate-900 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]"
                                  : day.isCurrentMonth
                                    ? "text-slate-700 hover:bg-slate-100"
                                    : "text-slate-300 hover:bg-slate-100/70"
                              )}
                            >
                              {day.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </FloatingPickerPortal>
    </div>
  );
}

function LabeledAutoField({
  label,
  value,
  onChange,
  readOnly,
  minRows = 1,
  emptyHint = "未填写",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  minRows?: number;
  emptyHint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      resizeTextarea(element);
    });

    const observer = new ResizeObserver(() => {
      resizeTextarea(element);
    });

    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value, readOnly]);

  const shellClassName = clsx(
    "grid grid-cols-[42px_minmax(0,1fr)] items-start gap-2 rounded-[1.1rem] border px-3 py-2 transition sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-2.5 sm:rounded-[1.2rem] sm:py-2.5",
    readOnly
      ? "border-white/40 bg-white/42"
      : "border-[#dcc6b2] bg-white shadow-[0_12px_28px_rgba(79,54,27,0.08)]"
  );

  return (
    <div className={shellClassName}>
      <div className="pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:pt-1.5 sm:text-[11px] sm:tracking-[0.14em]">
        {label}
      </div>

      {readOnly && !value.trim() ? (
        <div className="min-h-[32px] py-1 text-[13px] leading-[1.55] text-slate-400 sm:min-h-[36px] sm:py-1.5 sm:text-sm sm:leading-6">
          {emptyHint}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onInput={(event) => resizeTextarea(event.currentTarget)}
          readOnly={readOnly}
          rows={minRows}
          aria-label={label}
          className="min-h-[32px] w-full resize-none overflow-hidden bg-transparent px-0 py-1 text-[13px] leading-[1.55] text-slate-700 outline-none sm:min-h-[36px] sm:py-1.5 sm:text-sm sm:leading-6"
        />
      )}
    </div>
  );
}

function SourcePreview({
  source,
  onChange,
  onRemove,
}: {
  source: TravelPlanArchive["sourceLinks"][number];
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[1.9rem] border border-[#ebdfd0] bg-[#fffaf2] shadow-[0_18px_44px_rgba(83,56,28,0.06)]">
      {source.coverImage ? (
        <div
          className="h-28 w-full bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(16,24,40,0.08), rgba(16,24,40,0.28)), url("${source.coverImage}")`,
          }}
        />
      ) : null}

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  source.status === "error"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-800"
                )}
              >
                {source.status === "error" ? "解析失败" : "已解析"}
              </span>
              <span className="text-xs text-slate-400">
                {formatDetailTime(source.fetchedAt)}
              </span>
            </div>

            <div className="space-y-1">
              <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                {source.title || "未识别标题"}
              </p>
              <p className="break-all text-xs leading-5 text-slate-500">
                {source.url}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {source.excerpt ? (
          <p className="text-sm leading-6 text-slate-600">{source.excerpt}</p>
        ) : null}

        {source.status === "error" && source.error ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
            <AlertCircle className="h-3.5 w-3.5" />
            {source.error}
          </div>
        ) : null}

        <textarea
          value={source.manualSummary}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder="这篇攻略里你真正想保留什么"
          className="w-full resize-none rounded-[1.3rem] border border-[#eadfce] bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-400"
        />
      </div>
    </div>
  );
}

function GenerationOverlay({
  visible,
  progress,
  tone,
  model,
}: {
  visible: boolean;
  progress: number;
  tone: OverlayTone;
  model: string;
}) {
  const meta = getOverlayMeta(progress, tone);
  const progressRatio =
    tone === "error" ? 1 : Math.max(progress / 100, tone === "success" ? 1 : 0.1);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[rgba(247,239,231,0.9)] backdrop-blur-xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(248,240,231,0.68)_36%,rgba(236,221,205,0.62)_100%)]" />
          <div className="relative z-10">
            <EmojiLoadingStage
              slides={travelGenerationSlides}
              title={meta.title}
              detail={meta.detail}
              eyebrow={model}
              progressRatio={progressRatio}
              autoPlayMs={4300}
              fullScreen
              showBrand={false}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function TravelWorkspace({ travelPlanId }: Props) {
  const router = useRouter();
  const timelineItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [savedPlan, setSavedPlan] = useState<TravelPlanArchive | null>(null);
  const [plan, setPlan] = useState<TravelPlanArchive | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [showGenerationOverlay, setShowGenerationOverlay] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationTone, setGenerationTone] = useState<OverlayTone>("running");
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [pendingScrollItemId, setPendingScrollItemId] = useState<string | null>(null);
  const showInitialLoading = useMinimumLoadingDuration(loading, 3000);
  const showGenerationLoading = useMinimumLoadingDuration(showGenerationOverlay, 3000);

  useEffect(() => {
    async function loadPlan() {
      try {
        const data = await readTravelApiResponse<TravelPlanArchive>(
          await fetch(`/api/travel-plans/${travelPlanId}`, {
            cache: "no-store",
          })
        );

        setSavedPlan(data);
        setPlan(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "旅行档案加载失败。");
      } finally {
        setLoading(false);
      }
    }

    void loadPlan();
  }, [travelPlanId]);

  useEffect(() => {
    if (!generating) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGenerationProgress((current) => {
        if (current >= 92) {
          return current;
        }

        if (current < 24) {
          return Math.min(current + 8, 92);
        }

        if (current < 58) {
          return Math.min(current + 5, 92);
        }

        return Math.min(current + 3, 92);
      });
    }, 520);

    return () => {
      window.clearInterval(timer);
    };
  }, [generating]);

  const isDirty = useMemo(() => {
    if (!plan || !savedPlan) {
      return false;
    }

    return toEditableTravelSnapshot(plan) !== toEditableTravelSnapshot(savedPlan);
  }, [plan, savedPlan]);

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isDirty]);

  useLayoutEffect(() => {
    if (!pendingScrollItemId) {
      return undefined;
    }

    const target = timelineItemRefs.current[pendingScrollItemId];

    if (!target) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      setPendingScrollItemId((current) =>
        current === pendingScrollItemId ? null : current
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pendingScrollItemId, plan]);

  function updatePlan(mutator: (current: TravelPlanArchive) => TravelPlanArchive) {
    setPlan((current) => (current ? mutator(current) : current));
  }

  async function fetchLatestPlan() {
    return readTravelApiResponse<TravelPlanArchive>(
      await fetch(`/api/travel-plans/${travelPlanId}`, {
        cache: "no-store",
      })
    );
  }

  async function waitForGenerateResult(previousPlan: TravelPlanArchive) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const latest = await fetchLatestPlan().catch(() => null);

      if (latest) {
        if (didGeneratePlanChange(previousPlan, latest)) {
          return latest;
        }

        if (
          latest.planStatus === "attention" &&
          !!latest.generationError &&
          latest.updatedAt !== previousPlan.updatedAt
        ) {
          return latest;
        }
      }

      if (attempt < 5) {
        await delay(1200);
      }
    }

    return null;
  }

  function setItemEditing(itemId: string, editing: boolean) {
    setEditingItemId(editing ? itemId : null);
  }

  function updateDates(nextStart: string, nextEnd: string) {
    updatePlan((current) => {
      const { startDate, endDate } = clampDates(nextStart, nextEnd);

      return {
        ...current,
        startDate,
        endDate,
        itinerary: normalizeTravelItinerary(current.itinerary, startDate, endDate),
      };
    });
  }

  function updateBudget(value: BudgetLevel) {
    updatePlan((current) => ({
      ...current,
      budget: value,
    }));
  }

  function togglePreference(key: PreferenceKey) {
    updatePlan((current) => {
      const nextPreferences = current.preferences.includes(key)
        ? current.preferences.filter((item) => item !== key)
        : [...current.preferences, key];

      return {
        ...current,
        preferences: nextPreferences.length > 0 ? nextPreferences : [key],
      };
    });
  }

  function updateItinerary(mutator: (current: Itinerary) => Itinerary) {
    updatePlan((current) => ({
      ...current,
      itinerary: mutator(current.itinerary),
    }));
  }

  function addTimelineItem(dayIndex: number) {
    const nextItem = createEmptyItineraryItem();

    updateItinerary((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? {
            ...day,
            items: [nextItem, ...day.items],
          }
          : day
      ),
    }));

    setItemEditing(nextItem.id, true);
  }

  function removeTimelineItem(dayIndex: number, itemId: string) {
    updateItinerary((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? {
            ...day,
            items: day.items.filter((item) => item.id !== itemId),
          }
          : day
      ),
    }));
    delete timelineItemRefs.current[itemId];
    setEditingItemId((current) => (current === itemId ? null : current));
    setPendingScrollItemId((current) => (current === itemId ? null : current));
  }

  function updateTimelineItem(
    dayIndex: number,
    itemId: string,
    field: keyof ItineraryItem,
    value: string | string[]
  ) {
    updateItinerary((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? (() => {
            const nextItems = day.items.map((item) =>
              item.id === itemId
                ? {
                  ...item,
                  [field]: value,
                }
                : item
            );
            const shouldSort =
              field !== "startTime" &&
                field !== "endTime"
                ? true
                : typeof value !== "string" ||
                value === "" ||
                isCompleteTravelTime(value);

            return {
              ...day,
              items: shouldSort ? sortTravelItineraryItems(nextItems) : nextItems,
            };
          })()
          : day
      ),
    }));

    if (field === "startTime" || field === "endTime") {
      setPendingScrollItemId(itemId);
    }
  }

  function updateTimelineKind(
    dayIndex: number,
    itemId: string,
    kind: ItineraryItemKind
  ) {
    updateTimelineItem(dayIndex, itemId, "kind", kind);
  }

  function updateSourceField(sourceId: string, value: string) {
    updatePlan((current) => ({
      ...current,
      sourceLinks: current.sourceLinks.map((source) =>
        source.id === sourceId
          ? {
            ...source,
            manualSummary: value,
          }
          : source
      ),
    }));
  }

  function removeSource(sourceId: string) {
    updatePlan((current) => ({
      ...current,
      sourceLinks: current.sourceLinks.filter((source) => source.id !== sourceId),
    }));
  }

  async function handleSave(silent = false) {
    if (!plan) {
      return null;
    }

    const draftSnapshot = plan;
    setSaving(true);
    setError("");
    if (!silent) {
      setMessage("");
    }

    try {
      const data = await readTravelApiResponse<TravelPlanArchive>(
        await fetch(`/api/travel-plans/${travelPlanId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildSavePayload(plan)),
        })
      );

      const latest = (await fetchLatestPlan().catch(() => null)) || data;
      const nextPlan = mergeTravelPlanSnapshot(draftSnapshot, latest);

      setSavedPlan(nextPlan);
      setPlan(nextPlan);

      if (!silent) {
        setMessage("已同步到 CloudBase。");
      }

      return nextPlan;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败。");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!plan) {
      return;
    }

    const destination = plan.destination.trim();

    if (!destination || destination === "未命名旅程") {
      setError("先填入旅行地点，再开始生成。");
      return;
    }

    const readyPlan = isDirty ? await handleSave(true) : plan;

    if (!readyPlan) {
      return;
    }

    setGenerating(true);
    setShowGenerationOverlay(true);
    setGenerationTone("running");
    setGenerationProgress(10);
    setError("");
    setMessage("");

    try {
      const data = await readTravelApiResponse<TravelPlanArchive>(
        await fetch(`/api/travel-plans/${travelPlanId}/generate`, {
          method: "POST",
        })
      );

      const nextPlan = mergeTravelPlanSnapshot(readyPlan, data);

      setSavedPlan(nextPlan);
      setPlan(nextPlan);
      setGenerationTone("success");
      setGenerationProgress(100);
      setMessage("Qwen 已生成新时间轴，现在可以继续编辑。");
      await delay(420);
    } catch (generateError) {
      const recoveredPlan = await waitForGenerateResult(readyPlan);

      if (recoveredPlan && didGeneratePlanChange(readyPlan, recoveredPlan)) {
        const nextPlan = mergeTravelPlanSnapshot(readyPlan, recoveredPlan);

        setSavedPlan(nextPlan);
        setPlan(nextPlan);
        setError("");
        setGenerationTone("success");
        setGenerationProgress(100);
        setMessage("Qwen 已生成新时间轴，现在可以继续编辑。");
        await delay(420);
        return;
      }

      if (recoveredPlan) {
        const nextPlan = mergeTravelPlanSnapshot(readyPlan, recoveredPlan);

        setSavedPlan(nextPlan);
        setPlan(nextPlan);
      }

      setGenerationTone("error");
      setGenerationProgress(100);
      setError(
        recoveredPlan?.generationError ||
        (generateError instanceof Error ? generateError.message : "生成行程失败。")
      );
      await delay(520);
    } finally {
      setGenerating(false);
      setShowGenerationOverlay(false);
      setGenerationProgress(0);
    }
  }

  async function handleAddSource() {
    const nextUrl = sourceUrl.trim();

    if (!nextUrl) {
      setError("请先贴一个小红书链接。");
      return;
    }

    setAddingSource(true);
    setError("");
    setMessage("");

    try {
      if (isDirty) {
        const saved = await handleSave(true);

        if (!saved) {
          return;
        }
      }

      const data = await readTravelApiResponse<TravelPlanArchive>(
        await fetch(`/api/travel-plans/${travelPlanId}/sources`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: nextUrl,
          }),
        })
      );

      setSavedPlan(data);
      setPlan(data);
      setSourceUrl("");
      setMessage("攻略已入档。");
    } catch (sourceError) {
      setError(
        sourceError instanceof Error ? sourceError.message : "攻略链接解析失败。"
      );
    } finally {
      setAddingSource(false);
    }
  }

  function handleBack() {
    if (isDirty && !window.confirm("还有未保存的修改，确定先离开吗？")) {
      return;
    }

    router.push("/tools/travel");
  }

  if (showInitialLoading) {
    return (
      <div className="flex min-h-[68vh] items-center justify-center rounded-[2rem] bg-[radial-gradient(circle_at_top,#fff8ee,transparent_52%),linear-gradient(180deg,#f8f3ee,#f5eee6)]">
        <EmojiLoadingStage
          slides={travelWorkspaceLoadingSlides}
          autoPlayMs={4100}
          fullScreen={false}
          showBrand={false}
          className="w-full"
        />
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-700">
        {error || "旅行档案不存在。"}
      </div>
    );
  }

  const dayCount = getTravelDayCount(plan.startDate, plan.endDate);
  const visibleTimeline = hasTimelineContent(plan.itinerary);
  const totalItems = countTimelineItems(plan.itinerary);
  const displayDestination = getDisplayDestination(plan.destination);
  return (
    <>
      <GenerationOverlay
        visible={showGenerationLoading}
        progress={generationProgress}
        tone={generationTone}
        model={plan.generationModel || "qwen3.6-plus"}
      />

      <div className="space-y-5 pb-28 xl:pb-10">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[2.5rem] border-4 border-white bg-gradient-to-br from-rose-300 via-orange-200 to-amber-200 px-5 py-6 text-slate-800 shadow-cute sm:px-8"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />

          <div className="relative space-y-5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 bg-white/30 px-3 py-1.5 text-sm text-rose-600 font-bold transition hover:bg-white/50 backdrop-blur-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                返回
              </button>

              <span
                className={clsx(
                  "rounded-full px-3 py-1 text-[11px] font-medium",
                  getPlanStatusTone(plan.planStatus)
                )}
              >
                {getPlanStatusLabel(plan.planStatus)}
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-rose-600/70">
                Trip Workspace
              </p>
              <h1 className="text-[2.6rem] font-black tracking-[-0.06em] text-slate-800 sm:text-[3.4rem]">
                {displayDestination}
              </h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border-2 border-white/40 bg-white/30 px-4 py-3 backdrop-blur-md">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-rose-700/60 uppercase">
                  <CalendarDays className="h-3.5 w-3.5" />
                  日期
                </div>
                <p className="mt-2 text-sm font-black text-slate-800">
                  {formatDateChip(plan.startDate)} - {formatDateChip(plan.endDate)}
                </p>
              </div>

              <div className="rounded-[1.5rem] border-2 border-white/40 bg-white/30 px-4 py-3 backdrop-blur-md">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-rose-700/60 uppercase">
                  <Clock3 className="h-3.5 w-3.5" />
                  计划
                </div>
                <p className="mt-2 text-sm font-black text-slate-800">
                  {visibleTimeline ? `${totalItems} 个节点` : `${dayCount} 天待排`}
                </p>
              </div>

              <div className="rounded-[1.5rem] border-2 border-white/40 bg-white/30 px-4 py-3 backdrop-blur-md">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-rose-700/60 uppercase">
                  <Link2 className="h-3.5 w-3.5" />
                  攻略
                </div>
                <p className="mt-2 text-sm font-black text-slate-800">
                  {plan.sourceLinks.length} 条来源
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {message ? (
          <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="order-1 space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="overflow-visible rounded-[2.3rem] border-4 border-white bg-[#fffdf8] shadow-cute">
              <div className="border-b border-[#eadfce] px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Setup
                </p>
                <h2 className="mt-2 text-[1.55rem] font-black tracking-[-0.04em] text-slate-900">
                  基础设置
                </h2>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">地点</label>
                  <input
                    value={plan.destination === "未命名旅程" ? "" : plan.destination}
                    onChange={(event) =>
                      updatePlan((current) => ({
                        ...current,
                        destination: event.target.value,
                      }))
                    }
                    placeholder="例如：东京 / 上海 / 香港"
                    className="w-full rounded-[1.35rem] border-2 border-white/80 bg-[rgba(255,255,255,0.6)] px-4 py-3 text-sm text-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.03)] outline-none transition focus:border-rose-300 backdrop-blur"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-2">
                    <label className="text-xs font-medium text-slate-500">开始</label>
                    <DatePickerField
                      hideLabel
                      label="开始"
                      value={plan.startDate}
                      onChange={(value) => updateDates(value, plan.endDate)}
                    />
                  </div>

                  <div className="min-w-0 space-y-2">
                    <label className="text-xs font-medium text-slate-500">结束</label>
                    <DatePickerField
                      hideLabel
                      label="结束"
                      value={plan.endDate}
                      onChange={(value) => updateDates(plan.startDate, value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-500">预算</label>
                    <span className="text-[11px] text-slate-400">选填</span>
                  </div>

                  <div className="grid gap-2">
                    {TRAVEL_BUDGET_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateBudget(option.value)}
                        className={clsx(
                          "rounded-[1.35rem] border-2 px-4 py-3 text-left transition",
                          plan.budget === option.value
                            ? "border-rose-400 bg-rose-400 text-white shadow-[0_10px_24px_rgba(251,113,133,0.3)]"
                            : "border-white bg-[#fcf8f2] text-slate-700 shadow-sm hover:border-rose-200"
                        )}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p
                          className={clsx(
                            "mt-1 text-xs leading-5",
                            plan.budget === option.value
                              ? "text-white/70"
                              : "text-slate-500"
                          )}
                        >
                          {option.blurb}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">偏好</label>
                  <div className="flex flex-wrap gap-2">
                    {TRAVEL_PREFERENCE_OPTIONS.map((item) => {
                      const active = plan.preferences.includes(item.key);

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => togglePreference(item.key)}
                          className={clsx(
                            "rounded-full border-2 px-3 py-1.5 text-sm font-bold transition",
                            active
                              ? "border-amber-400 bg-amber-400 text-stone-900 shadow-[0_8px_20px_rgba(251,191,36,0.3)]"
                              : "border-white bg-[#fcf8f2] text-slate-600 shadow-sm hover:border-amber-200"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">补充说明</label>
                  <textarea
                    value={plan.notes}
                    onChange={(event) =>
                      updatePlan((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="同行人、作息、必须去 / 不想去的点"
                    className="w-full resize-none rounded-[1.35rem] border-2 border-white/80 bg-[rgba(255,255,255,0.6)] px-4 py-3 text-sm leading-6 text-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.03)] outline-none transition focus:border-rose-300 backdrop-blur"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2.3rem] border-4 border-white bg-white shadow-cute">
              <div className="border-b border-[#f0e7da] px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Sources
                </p>
                <h2 className="mt-2 text-[1.55rem] font-black tracking-[-0.04em] text-slate-900">
                  攻略来源
                </h2>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="space-y-3">
                  <input
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="粘贴小红书链接"
                    className="w-full rounded-[1.35rem] border border-[#eadfce] bg-[#fffaf2] px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full rounded-full"
                    onClick={() => void handleAddSource()}
                    disabled={addingSource}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {addingSource ? "抓取中…" : "添加并解析"}
                  </Button>
                </div>

                <div className="space-y-3">
                  {addingSource ? (
                    <div className="rounded-[1.8rem] border border-[#eadfce] bg-[#fffaf2] px-4 py-4">
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在抓取这条攻略…
                      </div>
                    </div>
                  ) : null}

                  {plan.sourceLinks.length === 0 ? (
                    <div className="rounded-[1.8rem] border border-dashed border-[#e7d9c6] bg-[#fffaf2] px-4 py-5 text-sm text-slate-500">
                      先贴攻略，或者直接生成第一版时间轴。
                    </div>
                  ) : (
                    plan.sourceLinks.map((source) => (
                      <SourcePreview
                        key={source.id}
                        source={source}
                        onChange={(value) => updateSourceField(source.id, value)}
                        onRemove={() => removeSource(source.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2.3rem] border-4 border-white bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-cute">
              <div className="px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/48">
                      Ready
                    </p>
                    <h2 className="mt-2 text-[1.55rem] font-black tracking-[-0.04em] text-white">
                      保存与生成
                    </h2>
                  </div>

                  <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/68">
                    {isDirty ? "未保存" : "已同步"}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-white/68">
                  <p>预算：{getBudgetLabel(plan.budget)}</p>
                  <p>上次保存：{formatDetailTime(savedPlan?.updatedAt || null)}</p>
                  <p>最近生成：{formatDetailTime(plan.lastGeneratedAt)}</p>
                </div>

                {plan.generationError ? (
                  <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/72">
                    {plan.generationError}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full rounded-full bg-white text-slate-900 hover:bg-[#f5efe4]"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "同步中…" : "保存到 CloudBase"}
                  </Button>

                  <Button
                    type="button"
                    className="w-full rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow-sm"
                    onClick={() => void handleGenerate()}
                    disabled={generating}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {generating ? "Qwen 生成中…" : "用 Qwen 生成行程"}
                  </Button>
                </div>
              </div>
            </div>
          </aside>

          <div className="order-2 space-y-4">
            <div className="rounded-[2.3rem] border-4 border-white bg-white px-5 py-5 shadow-cute">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    Timeline
                  </p>
                  <h2 className="mt-2 text-[1.8rem] font-black tracking-[-0.05em] text-slate-900">
                    时间轴
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900/5 px-3 py-1.5 text-xs text-slate-600">
                    {dayCount} 天
                  </span>
                  <span className="rounded-full bg-slate-900/5 px-3 py-1.5 text-xs text-slate-600">
                    {visibleTimeline ? `${totalItems} 个节点` : "暂未排计划"}
                  </span>
                </div>
              </div>

              {plan.itinerary.overview ? (
                <div className="mt-4 rounded-[1.5rem] border border-[#eadfce] bg-white/75 px-4 py-4 text-sm leading-6 text-slate-600">
                  {plan.itinerary.overview}
                </div>
              ) : null}
            </div>

            {!visibleTimeline ? (
              <div className="overflow-hidden rounded-[2.5rem] border-4 border-white bg-[#fffdf8] shadow-cute">
                <div className="relative px-6 py-8">
                  <div className="absolute right-[-28px] top-[-40px] h-36 w-36 rounded-full bg-[rgba(28,56,68,0.08)] blur-2xl" />

                  <div className="relative mx-auto max-w-md space-y-4 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-white shadow-[0_16px_40px_rgba(79,54,27,0.08)]">
                      <Compass className="h-8 w-8 text-slate-700" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-[1.8rem] font-black tracking-[-0.05em] text-slate-900">
                        先把这趟旅行定下来
                      </h3>
                      <p className="text-sm leading-7 text-slate-500">
                        现在还没有时间轴。你可以先生成一版，也可以从 Day 1 手动添加第一条安排。
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-full"
                        onClick={() => addTimelineItem(0)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        添加第一条安排
                      </Button>
                      <Button
                        type="button"
                        className="rounded-full"
                        onClick={() => void handleGenerate()}
                        disabled={generating}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        用 Qwen 生成
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {plan.itinerary.days.map((day, dayIndex) => {
                  const skin = DAY_SURFACES[dayIndex % DAY_SURFACES.length];

                  return (
                    <motion.section
                      key={`${day.day}-${day.dateLabel}`}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: dayIndex * 0.05 }}
                      className={clsx(
                        "relative overflow-hidden rounded-[2.5rem]",
                        skin.shell
                      )}
                    >
                      <div className={clsx("absolute inset-0", skin.glaze)} />

                      <div className="relative px-5 py-5 sm:px-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-3">
                            <span
                              className={clsx(
                                "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]",
                                skin.badge
                              )}
                            >
                              Day {day.day}
                            </span>

                            <div className="space-y-3">
                              <h3 className="text-[2rem] font-black tracking-[-0.05em] text-slate-900">
                                {day.dateLabel}
                              </h3>
                              <input
                                value={day.theme}
                                onChange={(event) =>
                                  updateItinerary((current) => ({
                                    ...current,
                                    days: current.days.map((item, index) =>
                                      index === dayIndex
                                        ? {
                                          ...item,
                                          theme: event.target.value,
                                        }
                                        : item
                                    ),
                                  }))
                                }
                                placeholder="当天主题"
                                className="w-full rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 sm:w-72"
                              />
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            className="rounded-full bg-white/70 text-slate-900 hover:bg-white"
                            onClick={() => addTimelineItem(dayIndex)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            新增安排
                          </Button>
                        </div>

                        <div className="mt-5 space-y-3 sm:mt-6 sm:space-y-4">
                          {day.items.length === 0 ? (
                            <div className="rounded-[1.8rem] border border-dashed border-white/75 bg-white/55 px-4 py-5 text-sm text-slate-500">
                              这一天还没排内容。
                            </div>
                          ) : (
                            day.items.map((item, itemIndex) => {
                              const rawKind =
                                item.kind || inferItineraryItemKind(item, day.theme);
                              const visibleKind = getVisibleTimelineKind(rawKind);
                              const cardMeta = TIMELINE_CARD_META[visibleKind];
                              const CardIcon = cardMeta.icon;
                              const isEditing = editingItemId === item.id;

                              return (
                                <motion.div
                                  key={item.id}
                                  ref={(node) => {
                                    timelineItemRefs.current[item.id] = node;
                                  }}
                                  initial={{ opacity: 0, x: itemIndex % 2 === 0 ? -14 : 14 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.24, delay: itemIndex * 0.03 }}
                                  className={clsx(
                                    "relative pl-4 sm:pl-7",
                                    itemIndex % 2 === 0 ? "sm:mr-8" : "sm:ml-10"
                                  )}
                                >
                                  <div
                                    className={clsx(
                                      "absolute left-0 top-5 h-3.5 w-3.5 rounded-full border-[4px] sm:h-4 sm:w-4 sm:border-[5px]",
                                      skin.dot
                                    )}
                                  />
                                  {itemIndex < day.items.length - 1 ? (
                                    <div
                                      className={clsx(
                                        "absolute left-[5px] top-8 bottom-[-18px] w-[2px] rounded-full bg-gradient-to-b sm:left-[7px] sm:bottom-[-22px]",
                                        skin.line
                                      )}
                                    />
                                  ) : null}

                                  <div
                                    className={clsx(
                                      "relative overflow-hidden rounded-[1.85rem] px-3.5 py-3 shadow-[0_14px_34px_rgba(79,54,27,0.05)] backdrop-blur transition-all duration-300 sm:rounded-[2.05rem] sm:px-4 sm:py-3.5",
                                      cardMeta.shell,
                                      !isEditing && "hover:-translate-y-1 hover:shadow-cute-hover",
                                      isEditing &&
                                      "border-[4px] border-slate-900 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(250,243,233,0.98))] shadow-[0_28px_70px_rgba(48,35,20,0.18)] scale-[1.02]"
                                    )}
                                  >
                                    <div
                                      className={clsx(
                                        "absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,rgba(15,23,42,0),rgba(15,23,42,0.22),rgba(15,23,42,0))] transition",
                                        !isEditing && "opacity-0"
                                      )}
                                    />
                                    <div
                                      className={clsx(
                                        "pointer-events-none absolute inset-0 transition",
                                        cardMeta.glow,
                                        isEditing ? "opacity-100" : "opacity-55"
                                      )}
                                    />

                                    <div className="relative z-10 space-y-0.5 sm:space-y-3">
                                      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                                        <div className="min-w-0 flex flex-wrap items-center gap-1.5 sm:gap-2">
                                          <span
                                            className={clsx(
                                              "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase transition",
                                              isEditing
                                                ? "px-3 py-1 text-[11px] tracking-[0.18em]"
                                                : "px-5 py-2.5 text-[14px] tracking-[0.14em] shadow-[0_12px_28px_rgba(79,54,27,0.16)] ring-1 ring-white/45",
                                              cardMeta.chip
                                            )}
                                          >
                                            <CardIcon
                                              className={clsx(
                                                isEditing ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"
                                              )}
                                            />
                                            {cardMeta.label}
                                          </span>

                                          {isEditing ? (
                                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                              {TIMELINE_EDIT_KIND_OPTIONS.map((option) => (
                                                <button
                                                  key={option}
                                                  type="button"
                                                  onClick={() =>
                                                    updateTimelineKind(dayIndex, item.id, option)
                                                  }
                                                  className={clsx(
                                                    "rounded-full border px-2.5 py-1 text-[10px] font-medium transition sm:px-3 sm:text-[11px]",
                                                    visibleKind === option
                                                      ? "border-slate-900 bg-slate-900 text-white"
                                                      : "border-white/70 bg-white/72 text-slate-600 hover:border-slate-300"
                                                  )}
                                                >
                                                  {TIMELINE_CARD_META[option].label}
                                                </button>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setItemEditing(item.id, !isEditing)}
                                            className={clsx(
                                              "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                                              isEditing
                                                ? "border-slate-900 bg-slate-900 text-white"
                                                : "border-black/5 bg-white/80 text-slate-600 hover:border-slate-300"
                                            )}
                                            aria-label={isEditing ? "完成编辑" : "编辑安排"}
                                          >
                                            {isEditing ? (
                                              <Check className="h-4 w-4" />
                                            ) : (
                                              <Pencil className="h-4 w-4" />
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => removeTimelineItem(dayIndex, item.id)}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white/80 text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>

                                      <AnimatePresence initial={false} mode="wait">
                                        {isEditing ? (
                                          <motion.div
                                            key="edit"
                                            initial={{ opacity: 0, y: -10, height: 0 }}
                                            animate={{ opacity: 1, y: 0, height: "auto" }}
                                            exit={{ opacity: 0, y: -10, height: 0 }}
                                            transition={{ duration: 0.25, ease: "easeOut" }}
                                            className="space-y-2.5 sm:space-y-3"
                                          >
                                            <div className="grid grid-cols-[42px_minmax(0,1fr)] items-start gap-2 rounded-[1.1rem] border border-[#dcc6b2] bg-white px-3 py-2 shadow-[0_12px_28px_rgba(79,54,27,0.08)] transition sm:grid-cols-[58px_minmax(0,1fr)] sm:gap-2.5 sm:rounded-[1.2rem] sm:py-2.5">
                                              <div className="pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:pt-1.5 sm:text-[11px] sm:tracking-[0.14em]">
                                                时间
                                              </div>
                                              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                                                <TimePickerField
                                                  label="开始"
                                                  value={item.startTime}
                                                  onChange={(v) => updateTimelineItem(dayIndex, item.id, "startTime", v)}
                                                />
                                                <TimePickerField
                                                  label="结束"
                                                  value={item.endTime}
                                                  onChange={(v) => updateTimelineItem(dayIndex, item.id, "endTime", v)}
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                                              <LabeledAutoField
                                                label="地点"
                                                value={item.placeName}
                                                onChange={(v) => updateTimelineItem(dayIndex, item.id, "placeName", v)}
                                                readOnly={false}
                                                emptyHint="添加地点"
                                              />
                                              <LabeledAutoField
                                                label="区域"
                                                value={item.districtOrArea}
                                                onChange={(v) => updateTimelineItem(dayIndex, item.id, "districtOrArea", v)}
                                                readOnly={false}
                                                emptyHint="补充区域"
                                              />
                                              <LabeledAutoField
                                                label="交通"
                                                value={item.transport}
                                                onChange={(v) => updateTimelineItem(dayIndex, item.id, "transport", v)}
                                                readOnly={false}
                                                emptyHint="填写交通方式"
                                              />
                                              <LabeledAutoField
                                                label="花费"
                                                value={item.estimatedCost}
                                                onChange={(v) => updateTimelineItem(dayIndex, item.id, "estimatedCost", v)}
                                                readOnly={false}
                                                emptyHint="补充预算"
                                              />
                                            </div>

                                            <LabeledAutoField
                                              label="安排"
                                              value={item.summary}
                                              onChange={(v) => updateTimelineItem(dayIndex, item.id, "summary", v)}
                                              readOnly={false}
                                              minRows={2}
                                              emptyHint="写下这一段要做什么"
                                            />

                                            <LabeledAutoField
                                              label="提醒"
                                              value={item.tips}
                                              onChange={(v) => updateTimelineItem(dayIndex, item.id, "tips", v)}
                                              readOnly={false}
                                              minRows={2}
                                              emptyHint="预约、备选或注意事项"
                                            />
                                          </motion.div>
                                        ) : (
                                          <motion.div
                                            key="view"
                                            initial={{ opacity: 0, y: -10, height: 0 }}
                                            animate={{ opacity: 1, y: 0, height: "auto" }}
                                            exit={{ opacity: 0, y: -10, height: 0 }}
                                            transition={{ duration: 0.25, ease: "easeOut" }}
                                            className="space-y-4 pt-2"
                                          >
                                            <div className="flex flex-col gap-3">
                                              {(item.placeName || item.districtOrArea) && (
                                                <div className="inline-flex items-start gap-2">
                                                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-rose-500" />
                                                  <div className="min-w-0">
                                                    {item.placeName && (
                                                      <span className="text-[1.18rem] font-black tracking-[-0.03em] text-slate-800">
                                                        {item.placeName}
                                                      </span>
                                                    )}
                                                    {item.districtOrArea && (
                                                      <span className={clsx("text-sm font-semibold text-slate-500", item.placeName && "ml-2")}>
                                                        {item.districtOrArea}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              )}

                                              <div className="min-h-[28px] whitespace-pre-wrap pl-1 text-[14px] leading-[1.65] text-slate-700">
                                                {item.summary || (
                                                  <span className="text-sm italic text-slate-400">
                                                    尚未填写这段行程的具体安排…
                                                  </span>
                                                )}
                                              </div>

                                              {(item.transport || item.estimatedCost || item.startTime || item.endTime) && (
                                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900/5 mt-1">
                                                  {(item.startTime || item.endTime) && (
                                                    <div className="inline-flex items-center gap-1.5 rounded-[0.85rem] bg-slate-100 px-3 py-1.5 text-[0.8rem] font-bold text-slate-700 shadow-sm border border-slate-200">
                                                      <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                                                      {item.startTime || "--:--"} - {item.endTime || "--:--"}
                                                    </div>
                                                  )}
                                                  {item.transport && (
                                                    <div className="inline-flex items-center gap-1.5 rounded-[0.85rem] bg-sky-50 px-3 py-1.5 text-[0.8rem] font-bold text-sky-700 shadow-sm border border-sky-100">
                                                      <Bus className="h-3.5 w-3.5 text-sky-500" />
                                                      {item.transport}
                                                    </div>
                                                  )}
                                                  {item.estimatedCost && (
                                                    <div className="inline-flex items-center gap-1.5 rounded-[0.85rem] bg-amber-50 px-3 py-1.5 text-[0.8rem] font-bold text-amber-700 shadow-sm border border-amber-100">
                                                      <Banknote className="h-3.5 w-3.5 text-amber-500" />
                                                      {item.estimatedCost}
                                                    </div>
                                                  )}
                                                </div>
                                              )}

                                              {item.tips && (
                                                <div className="mt-1 rounded-[1.25rem] border border-orange-100 bg-[#fff9f2] p-3.5 shadow-sm">
                                                  <div className="flex items-start gap-2.5">
                                                    <Info className="mt-[2px] h-4 w-4 shrink-0 text-orange-400" />
                                                    <p className="min-w-0 text-[13px] font-medium leading-relaxed text-orange-800/90 whitespace-pre-wrap">
                                                      {item.tips}
                                                    </p>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </motion.section>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-30 xl:hidden">
        <div className="grid grid-cols-2 gap-3 rounded-[2rem] border border-white/70 bg-white/88 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-md">
          <Button
            type="button"
            variant="secondary"
            className="rounded-full bg-white text-slate-800 shadow-sm"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "同步中" : "保存"}
          </Button>

          <Button
            type="button"
            className="rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow-sm"
            onClick={() => void handleGenerate()}
            disabled={generating}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? "生成中" : "生成"}
          </Button>
        </div>
      </div>
    </>
  );
}
