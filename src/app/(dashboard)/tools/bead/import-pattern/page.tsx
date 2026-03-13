"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileImage, Grid3X3 } from "lucide-react";
import { GridCalibrator } from "@/components/bead-tool/GridCalibrator";
import { ColorRecognizer } from "@/components/bead-tool/ColorRecognizer";
import { BeadEditor } from "@/components/bead-tool/BeadEditor";
import { getPalette, type ColorBrand, type PaletteColor } from "@/lib/bead/palette";

export default function PatternImportPage() {
  const router = useRouter();
  
  // 网格校准参数
  const [gridRows, setGridRows] = useState<number | null>(null);
  const [gridCols, setGridCols] = useState<number | null>(null);
  const [cellSize, setCellSize] = useState<number | null>(null);
  
  // 识别结果
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 显示选项
  const [showColorNumbers, setShowColorNumbers] = useState<boolean>(true);
  const [brand, setBrand] = useState<ColorBrand>('MARD');

  // 网格校准完成
  const handleGridCalibrated = (rows: number, cols: number, size: number) => {
   setGridRows(rows);
   setGridCols(cols);
   setCellSize(size);
  };

  // 颜色识别完成
  const handleColorRecognized = (recognizedGrid: number[][], recognizedPalette: PaletteColor[]) => {
    setGrid(recognizedGrid);
    setPalette(recognizedPalette);
  };

  // 进入拼豆模式
  const handleEnterBeadMode = () => {
   if (!grid || !palette) return;
   
   // 将数据保存到 sessionStorage
   const beadData = {
     grid,
     palette,
     brand
   };
   sessionStorage.setItem('currentBeadPattern', JSON.stringify(beadData));
   
   // 跳转到拼豆模式页面
   router.push('/tools/bead/bead-mode');
  };

  // 保存功能（暂未实现）
  const handleSave = () => {
   alert("云端存储功能即将上线！");
  };

 return (
    <div className="space-y-6">
      {/* 头部 */}
      <section className="flex flex-col gap-2">
        <Button
         type="button"
          variant="ghost"
          size="sm"
        onClick={() => router.push('/tools/bead')}
       className="w-fit -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">拼豆图纸导入</h1>
          <FileImage className="w-6 h-6 text-green-500" />
        </div>
        <p className="text-sm text-slate-600">
          导入已有的拼豆图纸，自动识别网格和颜色
        </p>
      </section>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-3xl px-4 py-3 text-xs text-red-600">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* 左侧：设置面板 */}
        <div className="space-y-4">
          {/* 1. 网格校准 */}
          <GridCalibrator onGridCalibrated={handleGridCalibrated} />

          {/* 2. 颜色识别 */}
          {gridRows && gridCols && (
            <ColorRecognizer
            gridRows={gridRows}
            gridCols={gridCols}
            cellSize={cellSize || 20}
            onColorRecognized={handleColorRecognized}
            />
          )}

          {/* 色卡品牌选择 */}
          {palette && (
            <Card className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">
                  3. 匹配本地色卡库
                </label>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    品牌
                  </label>
                  <select
                    value={brand}
                   onChange={(e) => setBrand(e.target.value as ColorBrand)}
                  className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                  >
                    {['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                
                <p className="text-[11px] text-slate-500">
                  💡 系统会将识别的颜色匹配到最接近的本地色卡
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* 右侧：预览面板 */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  拼豆图纸预览
                </h2>
                <p className="text-xs text-slate-500">
                  每个小方块代表一颗拼豆
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  <input
                   type="checkbox"
                 checked={showColorNumbers}
                   onChange={(e) => setShowColorNumbers(e.target.checked)}
                 className="rounded border-cream-100 text-accent-brown focus:ring-accent-brown"
                  />
                  显示色号
                </label>
              </div>
            </div>

            {!grid && (
              <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-cream-100 bg-cream-50/60 text-xs text-slate-500 text-center px-4">
                <div className="space-y-2">
                  <FileImage className="w-8 h-8 mx-auto text-slate-300" />
                  <p>先在左侧上传图纸并完成网格校准<br/>然后进行颜色识别</p>
                </div>
              </div>
            )}

            {grid && palette && (
              <div className="space-y-4">
                {/* 简单预览 */}
                <div className="overflow-auto rounded-3xl border border-cream-100 bg-cream-50/60 p-3 max-h-96">
                  <div
                   className="grid gap-px bg-white"
                    style={{
                     gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))`
                    }}
                  >
                    {grid.flatMap((row, y) =>
                     row.map((colorIndex, x) => {
                       const color = palette[colorIndex];
                        return (
                          <div
                            key={`${x}-${y}`}
                           className="aspect-square relative"
                            style={{
                              backgroundColor: color?.hex || "#FFFFFF"
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
                
                {/* 统计信息 */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>网格：{grid[0].length} × {grid.length}</span>
                  <span>·</span>
                  <span>颜色数：{palette.length}</span>
                  <span>·</span>
                  <span>品牌：{brand}</span>
                </div>
                
                {/* 进入拼豆模式按钮 */}
                <Button
                 type="button"
                 size="lg"
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-600/90 hover:to-blue-600/90 text-white"
                 onClick={handleEnterBeadMode}
                >
                  <Grid3X3 className="w-5 h-5 mr-2" />
                  进入拼豆模式 · 开始制作
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
