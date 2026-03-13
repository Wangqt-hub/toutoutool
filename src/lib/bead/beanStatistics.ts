/**
 * 拼豆工具 - 豆子统计函数
 * 统计每种颜色的使用数量
 */

import { PaletteColor } from './palette';

export interface BeanStatistics {
  totalBeans: number;
  colorStats: ColorStatistic[];
}

export interface ColorStatistic {
  colorIndex: number;
  color: PaletteColor;
  count: number;
  percentage: number;
}

/**
 * 统计网格中各颜色的使用数量
 * @param grid 网格数据
 * @param palette 色卡库
 * @returns 统计结果
 */
export function countBeans(
  grid: number[][],
  palette: PaletteColor[]
): BeanStatistics {
  const colorCountMap = new Map<number, number>();
  let totalBeans = 0;

  // 统计每个颜色的数量
  grid.forEach(row => {
    row.forEach(colorIndex => {
    const currentCount = colorCountMap.get(colorIndex) || 0;
     colorCountMap.set(colorIndex, currentCount +1);
      totalBeans++;
    });
  });

  // 转换为统计数组
  const colorStats: ColorStatistic[] = Array.from(colorCountMap.entries())
    .map(([colorIndex, count]) => ({
    colorIndex,
    color: palette[colorIndex],
     count,
      percentage: totalBeans > 0 ? (count / totalBeans) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count); // 按数量降序排序

  return {
    totalBeans,
   colorStats
  };
}

/**
 * 格式化统计信息为可读文本
 */
export function formatStatistics(statistics: BeanStatistics, brand?: 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝'): string {
  let output = `拼豆统计报告\n`;
  output += `${'='.repeat(50)}\n\n`;
  output += `总豆子数：${statistics.totalBeans} 颗\n\n`;
  output += `颜色明细:\n`;
  output += `${'-'.repeat(50)}\n`;
  
  statistics.colorStats.forEach((stat, index) => {
  const colorName= `#${stat.color.id.toString().padStart(2, '0')}`;
  const brandCode = brand && stat.color.brandCodes ? stat.color.brandCodes[brand] || '' : '';
  const brandText = brand && brandCode ? ` [${brand}: ${brandCode}]` : '';
    
    output += `${index + 1}. ${colorName}${brandText}: ${stat.count} 颗 (${stat.percentage.toFixed(1)}%)\n`;
  });
  
  output += `${'-'.repeat(50)}\n`;
  
  return output;
}

/**
 * 导出统计结果为 JSON
 */
export function exportStatisticsToJSON(
  statistics: BeanStatistics,
  brand?: 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝'
): object {
 return {
   totalBeans: statistics.totalBeans,
  colors: statistics.colorStats.map(stat => ({
   colorIndex: stat.colorIndex,
   colorId: stat.color.id,
   hex: stat.color.hex,
     brandCode: brand && stat.color.brandCodes ? stat.color.brandCodes[brand] : undefined,
   count: stat.count,
     percentage: parseFloat(stat.percentage.toFixed(2))
    }))
  };
}
