"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Check, ChevronRight, Lock } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  description: string;
  badge: string;
  icon: LucideIcon;
  accent: WorkflowAccent;
  steps: BeadWorkflowStep[];
  currentStep: number;
  onStepChange: (stepIndex: number) => void;
  onBack: () => void;
  stageEyebrow: string;
  stageTitle: string;
  stageDescription: string;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
  preview?: ReactNode;
  sideNote?: ReactNode;
  floatingSlot?: ReactNode;
}

const ACCENT_STYLES: Record<
  WorkflowAccent,
  {
    hero: string;
    badge: string;
    icon: string;
    dot: string;
    current: string;
    currentIcon: string;
    complete: string;
  }
> = {
  sky: {
    hero:
      "from-sky-100 via-white to-cyan-50 border-sky-100/80 shadow-[0_22px_80px_rgba(56,189,248,0.12)]",
    badge: "border-sky-200 bg-white/85 text-sky-700",
    icon: "bg-sky-500 text-white shadow-[0_16px_34px_rgba(14,165,233,0.24)]",
    dot: "bg-sky-500/12 text-sky-700",
    current: "border-sky-300 bg-sky-50 text-sky-800",
    currentIcon: "bg-sky-500 text-white",
    complete: "bg-sky-500 text-white border-sky-500",
  },
  rose: {
    hero:
      "from-orange-100 via-rose-50 to-white border-orange-100/80 shadow-[0_22px_80px_rgba(244,114,182,0.12)]",
    badge: "border-orange-200 bg-white/85 text-orange-700",
    icon: "bg-rose-500 text-white shadow-[0_16px_34px_rgba(244,63,94,0.22)]",
    dot: "bg-rose-500/12 text-rose-700",
    current: "border-rose-300 bg-rose-50 text-rose-800",
    currentIcon: "bg-rose-500 text-white",
    complete: "bg-rose-500 text-white border-rose-500",
  },
  emerald: {
    hero:
      "from-emerald-100 via-white to-lime-50 border-emerald-100/80 shadow-[0_22px_80px_rgba(16,185,129,0.12)]",
    badge: "border-emerald-200 bg-white/85 text-emerald-700",
    icon: "bg-emerald-500 text-white shadow-[0_16px_34px_rgba(16,185,129,0.24)]",
    dot: "bg-emerald-500/12 text-emerald-700",
    current: "border-emerald-300 bg-emerald-50 text-emerald-800",
    currentIcon: "bg-emerald-500 text-white",
    complete: "bg-emerald-500 text-white border-emerald-500",
  },
};

export function BeadWorkflowShell({
  title,
  description,
  badge,
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
  sideNote,
  floatingSlot,
}: BeadWorkflowShellProps) {
  const accentStyles = ACCENT_STYLES[accent];

  const renderStepButton = (
    step: BeadWorkflowStep,
    index: number,
    mode: "desktop" | "mobile"
  ) => {
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
          "group flex w-full items-center gap-3 rounded-[24px] border transition-all disabled:cursor-not-allowed disabled:opacity-45",
          mode === "desktop"
            ? "px-3 py-3 text-left"
            : "min-w-[172px] px-3 py-2.5 text-left sm:min-w-[196px]",
          isCurrent
            ? accentStyles.current
            : isComplete
            ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
            : "border-transparent bg-white/72 text-slate-600 hover:border-white hover:bg-white"
        )}
      >
        <span
          className={clsx(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            isCurrent
              ? accentStyles.currentIcon
              : isComplete
              ? accentStyles.complete
              : isAvailable
              ? accentStyles.dot
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
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{step.label}</span>
          <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">
            {step.caption}
          </span>
        </span>

        {mode === "desktop" ? (
          <ChevronRight
            className={clsx(
              "h-4 w-4 flex-shrink-0 transition-transform",
              isCurrent ? "translate-x-0.5 text-slate-700" : "text-slate-300"
            )}
          />
        ) : null}
      </button>
    );
  };

  return (
    <div className="relative mx-auto max-w-7xl space-y-5">
      <section
        className={clsx(
          "relative overflow-hidden rounded-[32px] border bg-gradient-to-br",
          accentStyles.hero
        )}
      >
        <div className="absolute inset-y-0 right-0 hidden w-2/5 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.85),transparent_60%)] xl:block" />
        <div className="relative space-y-5 p-4 sm:p-6 xl:p-8">
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              <span>返回</span>
            </Button>
            <span
              className={clsx(
                "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                accentStyles.badge
              )}
            >
              {badge}
            </span>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex items-start gap-4">
                <span
                  className={clsx(
                    "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[22px]",
                    accentStyles.icon
                  )}
                >
                  <Icon className="h-7 w-7" />
                </span>
                <div className="space-y-2">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            <Card className="hidden min-w-[260px] border-white/70 bg-white/78 xl:block">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  当前流程
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {steps[currentStep]?.label}
                </p>
                <p className="text-sm leading-6 text-slate-600">
                  {steps[currentStep]?.caption}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <div className="xl:hidden">
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 px-1">
            {steps.map((step, index) => renderStepButton(step, index, "mobile"))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_minmax(300px,360px)]">
        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            <Card className="border-white/70 bg-white/78">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    步骤导航
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    你可以随时从已完成或已解锁的步骤中快速跳转。
                  </p>
                </div>
                <div className="space-y-2">
                  {steps.map((step, index) =>
                    renderStepButton(step, index, "desktop")
                  )}
                </div>
              </div>
            </Card>

            {sideNote}
          </div>
        </aside>

        <section className="space-y-5">
          {error ? (
            <div className="rounded-[26px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/82 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="border-b border-cream-100 px-4 py-4 sm:px-6 sm:py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {stageEyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {stageTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                {stageDescription}
              </p>
            </div>

            <div className="p-4 sm:p-6">{children}</div>

            {footer ? (
              <div className="border-t border-cream-100 bg-cream-50/55 px-4 py-4 sm:px-6">
                {footer}
              </div>
            ) : null}
          </section>

          {preview ? <div className="xl:hidden">{preview}</div> : null}
          {sideNote ? <div className="xl:hidden">{sideNote}</div> : null}
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">{preview}</div>
        </aside>
      </div>

      {floatingSlot}
    </div>
  );
}
