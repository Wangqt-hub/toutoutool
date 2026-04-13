"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, FileImage, Image, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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
    iconClass: "bg-gradient-to-br from-sky-400 to-cyan-300 text-white shadow-cute",
    badgeClass: "bg-sky-50 text-sky-700",
    buttonClass: "bg-sky-500 text-white hover:bg-sky-600 shadow-sky-200",
  },
  {
    id: "ai",
    title: "AI 生成像素画",
    description: "先生成 AI 图，再制作最终图纸。",
    badge: "风格优先",
    icon: Wand2,
    iconClass: "bg-gradient-to-br from-rose-400 to-orange-300 text-white shadow-cute",
    badgeClass: "bg-rose-50 text-rose-700",
    buttonClass: "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200",
  },
  {
    id: "pattern",
    title: "导入现成图纸",
    description: "把截图或照片恢复成可编辑图纸。",
    badge: "恢复图纸",
    icon: FileImage,
    iconClass: "bg-gradient-to-br from-emerald-400 to-lime-300 text-white shadow-cute",
    badgeClass: "bg-emerald-50 text-emerald-700",
    buttonClass: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200",
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
    <div className="grid gap-6 xl:grid-cols-3">
      {MODES.map((mode, index) => {
        const Icon = mode.icon;

        return (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, type: "spring", bounce: 0.4 }}
            key={mode.id}
          >
            <motion.div
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-[2.5rem] border-4 border-white/60 bg-white/80 p-6 shadow-cute backdrop-blur-md transition-shadow hover:shadow-cute-hover"
              onClick={() => handleSelect(mode.id)}
            >
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <motion.span
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                    className={`flex h-16 w-16 items-center justify-center rounded-[20px] ${mode.iconClass}`}
                  >
                    <Icon className="h-8 w-8" />
                  </motion.span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-black tracking-wider ${mode.badgeClass}`}
                  >
                    {mode.badge}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight text-slate-800">
                    {mode.title}
                  </h3>
                  <p className="text-sm font-medium leading-relaxed text-slate-500">
                    {mode.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${mode.buttonClass} shadow-lg transition-transform group-hover:scale-110`}>
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
