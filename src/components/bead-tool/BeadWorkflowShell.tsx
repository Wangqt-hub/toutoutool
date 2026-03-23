"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";

export interface BeadWorkflowStep {
  id: string;
  label: string;
  caption: string;
  available?: boolean;
  complete?: boolean;
}

type WorkflowAccent = "sky" | "rose" | "emerald";

interface BeadWorkflowShellProps {
  title: string;
  description?: string;
  badge?: string;
  icon: LucideIcon;
  accent: WorkflowAccent;
  steps: BeadWorkflowStep[];
  currentStep: number;
  onStepChange: (stepIndex: number) => void;
  onBack: () => void;
  stageEyebrow: string;
  stageTitle: string;
  stageDescription?: string;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
  preview?: ReactNode;
  mobilePreviewPlacement?: "before" | "after";
  sideNote?: ReactNode;
  floatingSlot?: ReactNode;
}

const DEFAULT_STICKY_OFFSET = 84;

const ACCENT_STYLES: Record<
  WorkflowAccent,
  {
    icon: string;
    idle: string;
    current: string;
    currentIcon: string;
    complete: string;
  }
> = {
  sky: {
    icon: "bg-sky-500 text-white shadow-[0_16px_34px_rgba(14,165,233,0.24)]",
    idle: "border-slate-200 bg-white/90 text-slate-700 hover:border-sky-200",
    current: "border-sky-300 bg-sky-50 text-sky-800",
    currentIcon: "bg-sky-500 text-white",
    complete: "border-sky-500 bg-sky-500 text-white",
  },
  rose: {
    icon: "bg-rose-500 text-white shadow-[0_16px_34px_rgba(244,63,94,0.22)]",
    idle: "border-slate-200 bg-white/90 text-slate-700 hover:border-rose-200",
    current: "border-rose-300 bg-rose-50 text-rose-800",
    currentIcon: "bg-rose-500 text-white",
    complete: "border-rose-500 bg-rose-500 text-white",
  },
  emerald: {
    icon:
      "bg-emerald-500 text-white shadow-[0_16px_34px_rgba(16,185,129,0.24)]",
    idle:
      "border-slate-200 bg-white/90 text-slate-700 hover:border-emerald-200",
    current: "border-emerald-300 bg-emerald-50 text-emerald-800",
    currentIcon: "bg-emerald-500 text-white",
    complete: "border-emerald-500 bg-emerald-500 text-white",
  },
};

export function BeadWorkflowShell({
  title,
  icon: Icon,
  accent,
  steps,
  currentStep,
  onStepChange,
  onBack,
  stageEyebrow,
  stageTitle,
  stageDescription,
  error,
  children,
  footer,
  preview,
  mobilePreviewPlacement = "after",
  sideNote,
  floatingSlot,
}: BeadWorkflowShellProps) {
  const accentStyles = ACCENT_STYLES[accent];
  const stepsRef = useRef<HTMLDivElement | null>(null);
  const stepsContentRef = useRef<HTMLDivElement | null>(null);
  const [compactSteps, setCompactSteps] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stickyOffset, setStickyOffset] = useState(DEFAULT_STICKY_OFFSET);
  const [stepsHeight, setStepsHeight] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;

      if (!stepsRef.current) {
        return;
      }

      const rootHeaderHeight = Number.parseFloat(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--dashboard-header-height")
          .trim()
      );
      const header =
        document.querySelector<HTMLElement>("[data-dashboard-header='true']") ||
        document.querySelector<HTMLElement>("header");
      const measuredHeaderHeight = header
        ? Math.ceil(header.getBoundingClientRect().height)
        : DEFAULT_STICKY_OFFSET;
      const nextStickyOffset = Math.max(
        Number.isFinite(rootHeaderHeight) && rootHeaderHeight > 0
          ? rootHeaderHeight
          : measuredHeaderHeight,
        0
      );

      setStickyOffset((previous) =>
        previous === nextStickyOffset ? previous : nextStickyOffset
      );

      const shouldCompact =
        stepsRef.current.getBoundingClientRect().top <= nextStickyOffset + 2;

      setCompactSteps((previous) =>
        previous === shouldCompact ? previous : shouldCompact
      );
    };

    const onScroll = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const element = stepsContentRef.current;

    if (!element) {
      return;
    }

    const updateHeight = () => {
      const nextHeight = Math.ceil(element.getBoundingClientRect().height);
      setStepsHeight((previous) =>
        previous === nextHeight ? previous : nextHeight
      );
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);

      return () => {
        window.removeEventListener("resize", updateHeight);
      };
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [compactSteps, steps.length]);

  useEffect(() => {
    const updateDrawerState = () => {
      const nextValue =
        document.documentElement.dataset.dashboardDrawerOpen === "true";
      setDrawerOpen((previous) =>
        previous === nextValue ? previous : nextValue
      );
    };

    updateDrawerState();

    if (typeof MutationObserver === "undefined") {
      window.addEventListener("resize", updateDrawerState);

      return () => {
        window.removeEventListener("resize", updateDrawerState);
      };
    }

    const observer = new MutationObserver(updateDrawerState);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-dashboard-drawer-open"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[1720px] space-y-3 lg:space-y-4">
      <section className="rounded-[24px] border border-white/80 bg-white/90 px-3 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </Button>

          <span
            className={clsx(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[18px]",
              accentStyles.icon
            )}
          >
            <Icon className="h-5 w-5" />
          </span>

          <h1 className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
        </div>
      </section>

      <div
        ref={stepsRef}
        className="relative"
        style={{ minHeight: compactSteps ? `${stepsHeight}px` : undefined }}
      >
        <div
          ref={stepsContentRef}
          className={clsx(
            "overflow-x-auto px-1 pb-1 transition-all duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            compactSteps ? "" : "-mx-1",
            compactSteps
              ? "fixed left-0 right-0 z-30 mx-auto w-full max-w-[1720px] border-x border-b border-slate-200 bg-white py-1.5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
              : "",
            compactSteps && drawerOpen ? "pointer-events-none opacity-0" : ""
          )}
          style={
            compactSteps
              ? { top: `${Math.max(stickyOffset - 1, 0)}px` }
              : undefined
          }
        >
          <div
            className={clsx(
              "flex min-w-max xl:grid xl:min-w-0",
              compactSteps ? "gap-1.5" : "gap-3"
            )}
            style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          >
            {steps.map((step, index) => {
              const isCurrent = index === currentStep;
              const isComplete = Boolean(step.complete);
              const isAvailable = step.available !== false;

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => onStepChange(index)}
                  className={clsx(
                    "group shrink-0 rounded-[20px] border text-left transition-all disabled:cursor-not-allowed disabled:opacity-45",
                    compactSteps
                      ? "flex min-w-[104px] items-center gap-1.5 rounded-md px-2.5 py-2"
                      : "flex min-w-[176px] items-center gap-3 px-3 py-3 xl:min-h-[88px] xl:min-w-0 xl:flex-col xl:items-start xl:justify-between xl:px-4",
                    isCurrent
                      ? accentStyles.current
                      : isComplete
                      ? "border-slate-200 bg-white text-slate-800"
                      : accentStyles.idle
                  )}
                >
                  <div
                    className={clsx(
                      "flex flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      compactSteps ? "h-6 w-6 text-[10px]" : "h-8 w-8",
                      isCurrent
                        ? accentStyles.currentIcon
                        : isComplete
                        ? accentStyles.complete
                        : isAvailable
                        ? "bg-slate-100 text-slate-600"
                        : "bg-slate-200 text-slate-500"
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : !isAvailable ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <div className={clsx("min-w-0", compactSteps ? "flex-1" : "flex-1 space-y-1 xl:flex-none")}>
                    <p
                      className={clsx(
                        "truncate font-semibold",
                        compactSteps ? "text-xs" : "text-sm"
                      )}
                    >
                      {step.label}
                    </p>
                    <p
                      className={clsx(
                        "text-[11px] leading-5 text-slate-500",
                        compactSteps
                          ? "hidden"
                          : "line-clamp-1 xl:line-clamp-2"
                      )}
                    >
                      {step.caption}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "grid gap-4",
          preview
            ? "xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,440px)] 2xl:grid-cols-[minmax(0,1.58fr)_minmax(360px,470px)]"
            : ""
        )}
      >
        <section className="space-y-4">
          {error ? (
            <div className="rounded-[22px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="rounded-[28px] border border-white/85 bg-white/92 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-5 xl:p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {stageEyebrow}
                </p>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">
                    {stageTitle}
                  </h2>
                  {stageDescription ? (
                    <p className="text-sm leading-6 text-slate-600">
                      {stageDescription}
                    </p>
                  ) : null}
                </div>
              </div>

              {preview && mobilePreviewPlacement === "before" ? (
                <div className="xl:hidden">{preview}</div>
              ) : null}

              <div className="space-y-4">{children}</div>

              {preview && mobilePreviewPlacement === "after" ? (
                <div className="xl:hidden">{preview}</div>
              ) : null}
            </div>
          </div>

          {footer ? <div>{footer}</div> : null}
          {sideNote ? <div>{sideNote}</div> : null}
        </section>

        {preview ? <aside className="hidden space-y-4 xl:block">{preview}</aside> : null}
      </div>

      {floatingSlot}
    </div>
  );
}
