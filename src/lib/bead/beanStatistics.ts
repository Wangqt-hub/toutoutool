/**
 * 拼豆工具 - 豆子统计函数
 */

import type { PaletteColor, ColorBrand } from "./palette";
import type { BeadGrid } from "./types";

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

export function countBeans(
  grid: BeadGrid,
  palette: PaletteColor[]
): BeanStatistics {
  const colorCountMap = new Map<number, number>();
  let totalBeans = 0;

  grid.forEach((row) => {
    row.forEach((colorIndex) => {
      if (colorIndex === null) {
        return;
      }

      colorCountMap.set(colorIndex, (colorCountMap.get(colorIndex) ?? 0) + 1);
      totalBeans += 1;
    });
  });

  const colorStats: ColorStatistic[] = Array.from(colorCountMap.entries())
    .map(([colorIndex, count]) => ({
      colorIndex,
      color: palette[colorIndex],
      count,
      percentage: totalBeans > 0 ? (count / totalBeans) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count);

  return {
    totalBeans,
    colorStats,
  };
}

export function formatStatistics(
  statistics: BeanStatistics,
  brand?: ColorBrand
): string {
  let output = "拼豆统计报告\n";
  output += `${"=".repeat(50)}\n\n`;
  output += `总豆子数：${statistics.totalBeans} 颗\n\n`;
  output += "颜色明细：\n";
  output += `${"-".repeat(50)}\n`;

  statistics.colorStats.forEach((stat, index) => {
    const colorName = `#${stat.color.id.toString().padStart(2, "0")}`;
    const brandCode =
      brand && stat.color.brandCodes ? stat.color.brandCodes[brand] || "" : "";
    const brandText = brand && brandCode ? ` [${brand}: ${brandCode}]` : "";

    output += `${index + 1}. ${colorName}${brandText}: ${stat.count} 颗 (${stat.percentage.toFixed(1)}%)\n`;
  });

  output += `${"-".repeat(50)}\n`;
  return output;
}

export function exportStatisticsToJSON(
  statistics: BeanStatistics,
  brand?: ColorBrand
): object {
  return {
    totalBeans: statistics.totalBeans,
    colors: statistics.colorStats.map((stat) => ({
      colorIndex: stat.colorIndex,
      colorId: stat.color.id,
      hex: stat.color.hex,
      brandCode:
        brand && stat.color.brandCodes ? stat.color.brandCodes[brand] : undefined,
      count: stat.count,
      percentage: Number.parseFloat(stat.percentage.toFixed(2)),
    })),
  };
}
