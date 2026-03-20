"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Grid3X3,
  List,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BeadEditor } from "@/components/bead-tool/BeadEditor";
import type { PaletteColor } from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";

interface BeadGridData {
  grid: BeadGrid;
  palette: PaletteColor[];
  brand: string;
  name?: string;
}

function exportGridToCSV(data: BeadGridData): string {
  let csv = "row,col,colorIndex,colorName,hex,brandCode,state\n";

  data.grid.forEach((row, y) => {
    row.forEach((colorIndex, x) => {
      if (colorIndex === null) {
        csv += `${y + 1},${x + 1},,,,,empty\n`;
        return;
      }

      const color = data.palette[colorIndex];
      const brandCode =
        color?.brandCodes?.[data.brand as keyof typeof color.brandCodes] || "";

      csv += `${y + 1},${x + 1},${colorIndex},${color?.id ?? ""},${color?.hex ?? ""},${brandCode},filled\n`;
    });
  });

  return csv;
}

export default function BeadModePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [gridData, setGridData] = useState<BeadGridData | null>(null);
  const [showColorNumbers, setShowColorNumbers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedData = sessionStorage.getItem("currentBeadPattern");

      if (savedData) {
        setGridData(JSON.parse(savedData) as BeadGridData);
        return;
      }

      const gridParam = searchParams.get("grid");
      const paletteParam = searchParams.get("palette");
      const brandParam = searchParams.get("brand");

      if (gridParam && paletteParam && brandParam) {
        setGridData({
          grid: JSON.parse(gridParam) as BeadGrid,
          palette: JSON.parse(paletteParam) as PaletteColor[],
          brand: brandParam,
        });
        return;
      }

      setError("未找到图纸数据");
    } catch (cause) {
      console.error(cause);
      setError("加载图纸数据失败");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const handleSave = () => {
    window.alert("云端保存功能暂未接入。");
  };

  const handleExportCSV = () => {
    if (!gridData) {
      return;
    }

    const blob = new Blob([exportGridToCSV(gridData)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bead-pattern-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-accent-brown border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600">正在加载拼豆编辑器...</p>
        </div>
      </div>
    );
  }

  if (error || !gridData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-900 mb-4">未找到图纸数据</h2>
          <p className="text-sm text-slate-600 mb-6">
            请先在导入页面完成图纸生成，再进入拼豆编辑器。
          </p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => router.push("/tools/bead")}
          >
            返回工具首页
          </Button>
        </Card>
      </div>
    );
  }

  const filledCells = gridData.grid.flat().filter((cell) => cell !== null).length;

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-cream-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="-ml-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">返回</span>
              </Button>

              <div className="min-w-0 flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-accent-brown" />
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-slate-900">拼豆编辑器</h1>
                  <p className="break-words text-xs text-slate-500">
                    {gridData.grid[0]?.length ?? 0} × {gridData.grid.length} · 已识别
                    {filledCells} 颗豆
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => setShowColorNumbers((previous) => !previous)}
                title={showColorNumbers ? "隐藏色号" : "显示色号"}
              >
                <List className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={handleExportCSV}
                title="导出 CSV"
              >
                <Download className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                size="sm"
                variant="primary"
                className="w-full sm:w-auto"
                onClick={handleSave}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-3 sm:p-4">
        <Card className="bg-white shadow-lg overflow-hidden">
          <BeadEditor
            grid={gridData.grid}
            palette={gridData.palette}
            brand={gridData.brand}
            onSave={handleSave}
            showColorNumbers={showColorNumbers}
          />
        </Card>

        <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            拼豆模式使用提示
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">1.</span>
              <div>
                <strong className="block mb-1">点击高亮</strong>
                <span>点击任意有豆格子，会高亮同色豆子，方便逐色制作。</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-600 font-bold">2.</span>
              <div>
                <strong className="block mb-1">拖动与缩放</strong>
                <span>桌面端可滚轮缩放、拖动画布；手机端支持单指拖动、双指缩放。</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600 font-bold">3.</span>
              <div>
                <strong className="block mb-1">标记完成</strong>
                <span>桌面端右键或手机端长按某个颜色格子，可标记这个颜色已经完成。</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
