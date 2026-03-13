"use client";

import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ZoomIn, ZoomOut, Move, Download } from "lucide-react";
import { PaletteColor, ColorBrand } from "@/lib/bead/palette";
import { countBeans, formatStatistics } from "@/lib/bead/beanStatistics";

interface BeadEditorProps {
  grid: number[][];
  palette: PaletteColor[];
  brand?: string;
  onSave?: () => void;
}

export function BeadEditor({ grid, palette, brand, onSave }: BeadEditorProps) {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
  const [completedColors, setCompletedColors] = useState<number[]>([]);
  
  const statistics = countBeans(grid, palette);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  }, [position]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return;
   const newX = e.clientX - dragStart.current.x;
   const newY = e.clientY - dragStart.current.y;
    setPosition({ x: newX, y: newY });
  }, [isDragging]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
   const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(prev + delta, 0.5), 4));
  }, []);
  
  const handleCellClick = (colorIndex: number) => {
    setSelectedColorIndex(colorIndex === selectedColorIndex ? null : colorIndex);
  };
  
  const handleCellLongPress = (colorIndex: number) => {
    setCompletedColors(prev => 
      prev.includes(colorIndex)
        ? prev.filter(c => c !== colorIndex)
        : [...prev, colorIndex]
    );
  };
  
  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  
  const handleExportCSV = () => {
    let csv = 'row,col,colorIndex,colorName,hex,brandCode\n';
   grid.forEach((row, y) => {
     row.forEach((colorIndex, x) => {
       const color = palette[colorIndex];
       const brandCode = brand && color.brandCodes ? (color.brandCodes[brand as ColorBrand] || '') : '';
        csv += `${y + 1},${x + 1},${colorIndex},${color.id},${color.hex},${brandCode}\n`;
      });
    });
   const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
   const url = URL.createObjectURL(blob);
   const link = document.createElement('a');
    link.href = url;
    link.download = `bead-pattern-${new Date().getTime()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalColors = palette.length;
  const completedCount = completedColors.length;
  const progressPercentage = totalColors > 0 ? (completedCount / totalColors) * 100 : 0;
  
  const selectedColorStat = selectedColorIndex !== null 
    ? statistics.colorStats.find(s => s.colorIndex === selectedColorIndex)
    : null;

 return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setScale(prev => Math.max(prev - 0.1, 0.5))} disabled={scale <= 0.5}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-600 w-16 text-center">{(scale * 100).toFixed(0)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setScale(prev => Math.min(prev + 0.1, 4))} disabled={scale >= 4}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleResetView}>
            <Move className="w-4 h-4" />
            <span className="ml-1 text-xs">重置</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            <span className="ml-1 text-xs">导出 CSV</span>
          </Button>
          {onSave && (
            <Button variant="primary" size="sm" onClick={onSave}>
              保存到云端
            </Button>
          )}
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-cream-50 to-white rounded-2xl border border-cream-100 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-700 font-medium">📊 制作进度</span>
          <span className="text-slate-600">{completedCount} / {totalColors} 种颜色 ({progressPercentage.toFixed(1)}%)</span>
        </div>
        <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
        </div>
        <p className="text-[10px] text-slate-500">💡 提示：点击格子选中颜色，右键/长按标记完成</p>
      </div>
      
      <div 
       className="relative overflow-auto rounded-3xl border border-cream-100 bg-cream-50/60 p-4 cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
         className="inline-grid gap-px bg-white shadow-lg"
          style={{
           gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))`,
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'top left',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {grid.flatMap((row, y) =>
           row.map((colorIndex, x) => {
             const color = palette[colorIndex];
             const isSelected = selectedColorIndex === colorIndex;
             const isCompleted = completedColors.includes(colorIndex);
             const isOtherColor = selectedColorIndex !== null && !isSelected;
              
              return (
                <div
                  key={`${x}-${y}`}
                 className={`relative group cursor-pointer transition-all duration-150 ${isOtherColor ? 'opacity-30 grayscale' : 'opacity-100'} ${isCompleted ? 'ring-2 ring-green-400 ring-inset' : ''}`}
                  style={{ width: '20px', height: '20px', backgroundColor: color?.hex || "#FFFFFF", minWidth: '20px', minHeight: '20px' }}
                  onClick={(e) => { e.stopPropagation(); handleCellClick(colorIndex); }}
                  onContextMenu={(e) => { e.preventDefault(); handleCellLongPress(colorIndex); }}
                  title={`色号：${color?.id} ${brand && color.brandCodes ? (color.brandCodes[brand as ColorBrand] || '') : ''} (${statistics.colorStats.find(s => s.colorIndex === colorIndex)?.count}颗)`}
                >
                  {isCompleted && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Check className="w-3 h-3 text-white drop-shadow-md" />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {color?.id}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">颜色清单</h3>
          {selectedColorStat && (
            <div className="text-xs text-slate-600">
              当前选中：<strong>#{selectedColorStat.color.id.toString().padStart(2, '0')}</strong> · {selectedColorStat.count} 颗 · {(selectedColorStat.percentage).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-auto">
          {statistics.colorStats.map((stat) => {
           const isCompleted = completedColors.includes(stat.colorIndex);
           const isSelected = selectedColorIndex === stat.colorIndex;
           const brandCode = brand && stat.color.brandCodes ? stat.color.brandCodes[brand as ColorBrand] : undefined;
            
            return (
              <button
                key={stat.colorIndex}
                onClick={() => handleCellClick(stat.colorIndex)}
                onContextMenu={(e) => { e.preventDefault(); handleCellLongPress(stat.colorIndex); }}
               className={`flex items-center gap-2 p-2 rounded-2xl border transition-all ${isSelected ? 'border-accent-brown bg-accent-brown/10 ring-2 ring-accent-brown/30' : 'border-cream-100 bg-white/70'} ${isCompleted ? 'opacity-60' : 'hover:shadow-md'}`}
              >
                <span className="w-6 h-6 rounded-full border border-cream-100 flex-shrink-0" style={{ backgroundColor: stat.color.hex }} />
                <div className="flex-grow text-left">
                  <p className="text-xs font-medium text-slate-700">
                    #{stat.color.id.toString().padStart(2, '0')}
                    {brandCode && <span className="text-slate-500 ml-1">· {brandCode}</span>}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {stat.count}颗 ({stat.percentage.toFixed(1)}%){isCompleted && <span className="text-green-600 ml-1"> ✓</span>}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-cream-50 to-white rounded-3xl border border-cream-100 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">📋 完整统计报告</h3>
        <pre className="text-[10px] text-slate-600 whitespace-pre-wrap bg-white/60 rounded-2xl p-3 max-h-48 overflow-auto">
          {formatStatistics(statistics, brand as any)}
        </pre>
      </div>
    </Card>
  );
}
