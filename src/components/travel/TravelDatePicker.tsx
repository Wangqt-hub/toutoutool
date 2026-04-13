"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

function FloatingPickerPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export function useBodyScrollLock(locked: boolean) {
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

type TravelDatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function TravelDatePicker({ label, value, onChange }: TravelDatePickerProps) {
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
      <label className="text-xs font-medium text-slate-500">{label}</label>
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
                        onChange(formatLocalDateValue(new Date()));
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
