"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileImage, Image, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ImportMode = "image" | "ai" | "pattern";

const MODES: Array<{
  id: ImportMode;
  title: string;
  description: string;
  badge: string;
  icon: typeof Image;
  iconClass: string;
  featureClass: string;
  buttonClass: string;
  bestFor: string;
  features: string[];
}> = [
  {
    id: "image",
    title: "图片转拼豆图纸",
    description: "直接上传一张参考图，快速压缩成适合制作的拼豆图纸。",
    badge: "最快上手",
    icon: Image,
    iconClass:
      "bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-[0_18px_40px_rgba(56,189,248,0.28)]",
    featureClass: "bg-sky-50 text-sky-700",
    buttonClass: "bg-sky-500 hover:bg-sky-600 text-white",
    bestFor: "手头已经有清晰参考图，想直接开始制作。",
    features: ["自动匹配色卡", "支持手机上传", "适合头像与插画"],
  },
  {
    id: "ai",
    title: "AI 生成像素画",
    description: "先让 AI 生成像素风图片，再继续压缩成最终拼豆图纸。",
    badge: "风格最强",
    icon: Wand2,
    iconClass:
      "bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-[0_18px_40px_rgba(244,114,182,0.28)]",
    featureClass: "bg-rose-50 text-rose-700",
    buttonClass: "bg-rose-500 hover:bg-rose-600 text-white",
    bestFor: "想要更有设计感的像素风成品，或者原图本身不够像素化。",
    features: ["支持异步生成", "自动保存历史", "可继续生成最终图纸"],
  },
  {
    id: "pattern",
    title: "现成图纸导入",
    description: "把拍照或截图得到的纸质图纸恢复成可编辑的数字版。",
    badge: "还原现成图纸",
    icon: FileImage,
    iconClass:
      "bg-gradient-to-br from-emerald-500 to-lime-400 text-white shadow-[0_18px_40px_rgba(16,185,129,0.28)]",
    featureClass: "bg-emerald-50 text-emerald-700",
    buttonClass: "bg-emerald-500 hover:bg-emerald-600 text-white",
    bestFor: "已经有纸质图纸、截图或他人分享的图纸，想恢复成可编辑版本。",
    features: ["手动裁切网格", "支持 OCR 色号", "识别后可继续编辑"],
  },
];

interface ImportModeSelectorProps {
  onModeSelect?: (mode: ImportMode) => void;
}

export function ImportModeSelector({ onModeSelect }: ImportModeSelectorProps) {
  const router = useRouter();

  const handleSelect = (modeId: ImportMode) => {
    if (onModeSelect) {
      onModeSelect(modeId);
      return;
    }

    const routes: Record<ImportMode, string> = {
      image: "/tools/bead/import-image",
      ai: "/tools/bead/import-ai",
      pattern: "/tools/bead/import-pattern",
    };

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
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-white/20 via-white/80 to-white/20" />

            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-[22px] ${mode.iconClass}`}
                >
                  <Icon className="h-7 w-7" />
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${mode.featureClass}`}>
                  {mode.badge}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight text-slate-900">
                  {mode.title}
                </h3>
                <p className="text-sm leading-7 text-slate-600">
                  {mode.description}
                </p>
              </div>

              <div className="rounded-[28px] border border-cream-100 bg-cream-50/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  更适合你，如果你
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {mode.bestFor}
                </p>
              </div>

              <div className="grid gap-2">
                {mode.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 rounded-2xl bg-white/82 px-3 py-2 text-sm text-slate-600"
                  >
                    <CheckCircle2 className="h-4 w-4 text-slate-400" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                size="lg"
                className={`w-full justify-between rounded-[22px] ${mode.buttonClass}`}
                onClick={() => handleSelect(mode.id)}
              >
                进入这个流程
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
