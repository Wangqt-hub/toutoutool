"use client";

import { ImportModeSelector } from "@/components/bead-tool/ImportModeSelector";

export default function BeadToolPage() {
  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Bead Tool
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          选择导入方式
        </h2>
      </div>

      <ImportModeSelector />
    </div>
  );
}
