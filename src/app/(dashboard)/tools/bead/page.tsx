"use client";

import { Layers3, Palette, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ImportModeSelector } from "@/components/bead-tool/ImportModeSelector";

export default function BeadToolPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Pick A Flow
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            选择最适合你当前素材的入口
          </h2>
        </div>
        <ImportModeSelector />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-white/80 bg-white/88">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              初次使用
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              先从图片转图纸开始
            </h3>
            <p className="text-sm leading-7 text-slate-600">
              如果你只是想把一张普通图片变成拼豆图纸，这是学习成本最低、反馈最快的流程。
            </p>
          </div>
        </Card>

        <Card className="border-white/80 bg-white/88">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              想做风格化成品
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              走 AI 生成像素画
            </h3>
            <p className="text-sm leading-7 text-slate-600">
              更适合想先做出像素感、再继续控制图纸尺寸和色数的人，历史记录也会自动保留最近结果。
            </p>
          </div>
        </Card>

        <Card className="border-white/80 bg-white/88">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              已有纸质图纸
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              走图纸导入恢复
            </h3>
            <p className="text-sm leading-7 text-slate-600">
              把截图、照片或朋友分享的图纸恢复成可编辑电子版，再继续进拼豆模式修正细节。
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
