"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Grid3X3, Download, List, CheckCircle2 } from "lucide-react";
import { BeadEditor } from "@/components/bead-tool/BeadEditor";
import type { PaletteColor } from "@/lib/bead/palette";

interface BeadGridData {
  grid: number[][];
  palette: PaletteColor[];
  brand: string;
  name?: string;
}

export default function BeadModePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 从 URL 参数或 sessionStorage 加载数据
  const [gridData, setGridData] = useState<BeadGridData | null>(null);
  const [showColorNumbers, setShowColorNumbers] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 尝试从 sessionStorage 加载数据
    try {
      const savedData = sessionStorage.getItem('currentBeadPattern');
      if (savedData) {
        const data = JSON.parse(savedData) as BeadGridData;
        setGridData(data);
      } else {
        // 或者从 URL 参数加载（如果是直接访问）
        const gridParam = searchParams.get('grid');
        const paletteParam = searchParams.get('palette');
        const brandParam = searchParams.get('brand');
        
        if (gridParam && paletteParam && brandParam) {
          const data: BeadGridData = {
            grid: JSON.parse(gridParam),
            palette: JSON.parse(paletteParam),
            brand: brandParam
          };
          setGridData(data);
        }
      }
    } catch (err) {
      setError("加载图纸数据失败");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // 保存功能（暂未实现）
  const handleSave = () => {
   alert("云端存储功能即将上线！");
  };

  // 导出 CSV
  const handleExportCSV = () => {
   if (!gridData) return;
    
   // 生成 CSV 内容
   const headers = ['row', 'col', 'colorIndex', 'hex', 'brandCode'];
   const rows = gridData.grid.flatMap((row, y) =>
     row.map((colorIndex, x) => {
       const color = gridData.palette[colorIndex];
       const brandCode = color?.brandCodes?.[gridData.brand as keyof typeof color.brandCodes] || '';
       return [y, x, colorIndex, color?.hex || '', brandCode];
     })
   );
    
   const csvContent = [
     headers.join(','),
     ...rows.map(r => r.join(','))
   ].join('\n');
    
   // 下载文件
   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
   const link = document.createElement('a');
   link.href = URL.createObjectURL(blob);
   link.download = `bead-pattern-${Date.now()}.csv`;
   link.click();
  };

  if (loading) {
   return (
     <div className="min-h-screen flex items-center justify-center bg-cream-50">
       <div className="text-center space-y-4">
         <div className="w-16 h-16 border-4 border-accent-brown border-t-transparent rounded-full animate-spin mx-auto" />
         <p className="text-slate-600">正在加载拼豆工作台...</p>
       </div>
     </div>
   );
  }

  if (error || !gridData) {
   return (
     <div className="min-h-screen flex items-center justify-center bg-cream-50">
       <Card className="p-8 text-center max-w-md">
         <h2 className="text-xl font-bold text-slate-900 mb-4">
           ⚠️ 未找到图纸数据
         </h2>
         <p className="text-sm text-slate-600 mb-6">
           请先在导入页面生成拼豆图纸，然后进入拼豆模式
         </p>
         <Button
           type="button"
           variant="primary"
           size="lg"
           onClick={() => router.push('/tools/bead')}
         >
           返回工具首页
         </Button>
       </Card>
     </div>
   );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-cream-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* 左侧：返回按钮 + 标题 */}
            <div className="flex items-center gap-3">
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
              
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-accent-brown" />
                <div>
                  <h1 className="text-lg font-bold text-slate-900">
                    拼豆工作台
                  </h1>
                  <p className="text-xs text-slate-500">
                    {gridData.grid[0].length} × {gridData.grid.length} · {gridData.palette.length}色
                  </p>
                </div>
              </div>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-2">
              <Button
               type="button"
                variant="ghost"
                size="sm"
               onClick={() => setShowColorNumbers(!showColorNumbers)}
               title={showColorNumbers ? "隐藏色号" : "显示色号"}
              >
                <List className="w-4 h-4" />
              </Button>
              
              <Button
               type="button"
                variant="ghost"
                size="sm"
               onClick={handleExportCSV}
               title="导出 CSV"
              >
                <Download className="w-4 h-4" />
              </Button>
              
              <Button
               type="button"
               size="sm"
               variant="primary"
               onClick={handleSave}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区：全屏拼豆编辑器 */}
      <main className="max-w-[1600px] mx-auto p-4">
        <Card className="bg-white shadow-lg overflow-hidden">
          <BeadEditor
           grid={gridData.grid}
           palette={gridData.palette}
           brand={gridData.brand as any}
           onSave={handleSave}
          />
        </Card>

        {/* 使用提示 */}
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            💡 拼豆模式使用指南
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">1.</span>
              <div>
                <strong className="block mb-1">点击高亮</strong>
                <span>点击任意格子，相同颜色的所有豆子都会高亮放大显示</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-600 font-bold">2.</span>
              <div>
                <strong className="block mb-1">长按标记完成</strong>
                <span>长按某个颜色的格子，该颜色所有豆子打上✓标记</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600 font-bold">3.</span>
              <div>
                <strong className="block mb-1">手势操作</strong>
                <span>滚轮缩放、拖拽平移、右键菜单快速操作</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
