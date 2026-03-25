import { countBeans } from "@/lib/bead/beanStatistics";
import { getBrandCode, type ColorBrand, type PaletteColor } from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";

export type BeadWorkspaceSourceType = "image" | "ai" | "pattern" | "legacy";

export const MAX_BEAD_WORKSPACES = 3;
export const WORKSPACE_LIMIT_ERROR_CODE = "WORKSPACE_LIMIT_REACHED";

export interface BeadWorkspacePatternData {
  grid: BeadGrid;
  palette: PaletteColor[];
}

export interface BeadWorkspaceColorUsage {
  colorIndex: number;
  colorId: number;
  hex: string;
  brandCode: string | null;
  count: number;
}

export interface BeadWorkspaceProgress {
  totalBeans: number;
  completedBeans: number;
  remainingBeans: number;
  totalColors: number;
  completedColors: number;
  remainingColors: number;
  beanPercentage: number;
  colorPercentage: number;
}

export interface BeadWorkspaceSummary {
  id: string;
  name: string;
  sourceType: BeadWorkspaceSourceType;
  brand: string;
  width: number;
  height: number;
  usedColorCodes: BeadWorkspaceColorUsage[];
  completedColorIndexes: number[];
  selectedColorIndex: number | null;
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  progress: BeadWorkspaceProgress;
}

export interface BeadWorkspaceRecord extends BeadWorkspaceSummary {
  patternData: BeadWorkspacePatternData;
}

export interface BeadWorkspaceOverview {
  current: BeadWorkspaceSummary | null;
  history: BeadWorkspaceSummary[];
}

export interface BeadWorkspaceLimitData {
  overview: BeadWorkspaceOverview;
  requiredDeletionCount: number;
  maxWorkspaces: number;
}

export interface CreateBeadWorkspaceInput {
  name: string;
  sourceType: BeadWorkspaceSourceType;
  brand: string;
  patternData: BeadWorkspacePatternData;
  completedColorIndexes?: number[];
  selectedColorIndex?: number | null;
  thumbnailDataUrl?: string | null;
  deleteWorkspaceIds?: string[];
}

export interface UpdateBeadWorkspaceStateInput {
  completedColorIndexes: number[];
  selectedColorIndex: number | null;
}

export function getWorkspaceDimensions(patternData: BeadWorkspacePatternData) {
  return {
    width: patternData.grid[0]?.length ?? 0,
    height: patternData.grid.length,
  };
}

export function normalizeCompletedColorIndexes(
  completedColorIndexes: number[]
): number[] {
  return Array.from(
    new Set(
      completedColorIndexes.filter((value) =>
        Number.isInteger(value) && value >= 0
      )
    )
  ).sort((left, right) => left - right);
}

export function buildWorkspaceColorUsage(options: {
  patternData: BeadWorkspacePatternData;
  brand: string;
}): BeadWorkspaceColorUsage[] {
  const statistics = countBeans(options.patternData.grid, options.patternData.palette);
  const normalizedBrand = options.brand as ColorBrand;

  return statistics.colorStats.map((stat) => ({
    colorIndex: stat.colorIndex,
    colorId: stat.color.id,
    hex: stat.color.hex,
    brandCode: getBrandCode(stat.color, normalizedBrand) ?? null,
    count: stat.count,
  }));
}

export function buildWorkspaceProgress(
  usedColorCodes: BeadWorkspaceColorUsage[],
  completedColorIndexes: number[]
): BeadWorkspaceProgress {
  const completedSet = new Set(normalizeCompletedColorIndexes(completedColorIndexes));
  const totalBeans = usedColorCodes.reduce((sum, item) => sum + item.count, 0);
  const completedBeans = usedColorCodes.reduce(
    (sum, item) => sum + (completedSet.has(item.colorIndex) ? item.count : 0),
    0
  );
  const totalColors = usedColorCodes.length;
  const completedColors = usedColorCodes.filter((item) =>
    completedSet.has(item.colorIndex)
  ).length;

  return {
    totalBeans,
    completedBeans,
    remainingBeans: Math.max(0, totalBeans - completedBeans),
    totalColors,
    completedColors,
    remainingColors: Math.max(0, totalColors - completedColors),
    beanPercentage: totalBeans > 0 ? (completedBeans / totalBeans) * 100 : 0,
    colorPercentage: totalColors > 0 ? (completedColors / totalColors) * 100 : 0,
  };
}

export function getWorkspaceTotalCount(overview: BeadWorkspaceOverview): number {
  return (overview.current ? 1 : 0) + overview.history.length;
}

export function listWorkspaceSummaries(
  overview: BeadWorkspaceOverview
): BeadWorkspaceSummary[] {
  return overview.current ? [overview.current, ...overview.history] : [...overview.history];
}

export function exportWorkspaceToCSV(record: {
  brand: string;
  patternData: BeadWorkspacePatternData;
}): string {
  let csv = "row,col,colorIndex,colorName,hex,brandCode,state\n";

  record.patternData.grid.forEach((row, rowIndex) => {
    row.forEach((colorIndex, colIndex) => {
      if (colorIndex === null) {
        csv += `${rowIndex + 1},${colIndex + 1},,,,,empty\n`;
        return;
      }

      const color = record.patternData.palette[colorIndex];
      const brandCode =
        color?.brandCodes?.[record.brand as keyof typeof color.brandCodes] || "";

      csv += `${rowIndex + 1},${colIndex + 1},${colorIndex},${color?.id ?? ""},${color?.hex ?? ""},${brandCode},filled\n`;
    });
  });

  return csv;
}

export function createWorkspaceName(
  sourceType: BeadWorkspaceSourceType,
  preferredName?: string | null
): string {
  const trimmed = preferredName?.trim();

  if (trimmed) {
    return trimmed;
  }

  const prefix =
    sourceType === "ai"
      ? "AI 图纸"
      : sourceType === "pattern"
      ? "导入图纸"
      : sourceType === "legacy"
      ? "历史图纸"
      : "图片图纸";

  const stamp = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "")
    .replace(/:/g, "-");

  return `${prefix} ${stamp}`;
}
