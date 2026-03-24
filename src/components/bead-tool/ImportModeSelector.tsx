"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, FileImage, Image, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ImportMode = "image" | "ai" | "pattern";

const MODES: Array<{
  id: ImportMode;
  title: string;
  description: string;
  badge: string;
  icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
  buttonClass: string;
}> = [
  {
    id: "image",
    title: "图片转图纸",
    description: "直接把图片转换成拼豆图纸。",
    badge: "快速开始",
    icon: Image,
    iconClass:
      "bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-[0_18px_40px_rgba(56,189,248,0.28)]",
    badgeClass: "bg-sky-50 text-sky-700",
    buttonClass: "bg-sky-500 text-white hover:bg-sky-600",
  },
  {
    id: "ai",
    title: "AI 生成像素画",
    description: "先生成 AI 图，再制作最终图纸。",
    badge: "风格优先",
    icon: Wand2,
    iconClass:
      "bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-[0_18px_40px_rgba(244,114,182,0.28)]",
    badgeClass: "bg-rose-50 text-rose-700",
    buttonClass: "bg-rose-500 text-white hover:bg-rose-600",
  },
  {
    id: "pattern",
    title: "导入现成图纸",
    description: "把截图或照片恢复成可编辑图纸。",
    badge: "恢复图纸",
    icon: FileImage,
    iconClass:
      "bg-gradient-to-br from-emerald-500 to-lime-400 text-white shadow-[0_18px_40px_rgba(16,185,129,0.28)]",
    badgeClass: "bg-emerald-50 text-emerald-700",
    buttonClass: "bg-emerald-500 text-white hover:bg-emerald-600",
  },
];

interface ImportModeSelectorProps {
  onModeSelect?: (mode: ImportMode) => void;
}

export function ImportModeSelector({ onModeSelect }: ImportModeSelectorProps) {
  const router = useRouter();
  const routes: Record<ImportMode, string> = {
    image: "/tools/bead/import-image",
    ai: "/tools/bead/import-ai",
    pattern: "/tools/bead/import-pattern",
  };

  useEffect(() => {
    Object.values(routes).forEach((route) => router.prefetch(route as any));
  }, [router]);

  const handleSelect = (modeId: ImportMode) => {
    if (onModeSelect) {
      onModeSelect(modeId);
      return;
    }

    router.push(routes[modeId] as any);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {MODES.map((mode) => {
        const Icon = mode.icon;

        return (
          <Card
            key={mode.id}
            className="group relative overflow-hidden border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-[22px] ${mode.iconClass}`}
                >
                  <Icon className="h-7 w-7" />
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${mode.badgeClass}`}
                >
                  {mode.badge}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight text-slate-900">
                  {mode.title}
                </h3>
                <p className="text-sm leading-6 text-slate-600">
                  {mode.description}
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                className={`w-full justify-between rounded-[22px] ${mode.buttonClass}`}
                onClick={() => handleSelect(mode.id)}
              >
                进入流程
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
