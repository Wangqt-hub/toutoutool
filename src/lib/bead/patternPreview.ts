import { getBrandCode, type ColorBrand, type PaletteColor } from "./palette";
import type { BeadGrid } from "./types";

export interface PatternPreviewRenderOptions {
  grid: BeadGrid;
  palette: PaletteColor[];
  brand: ColorBrand;
  showColorNumbers: boolean;
  cellSize?: number;
  padding?: number;
}

const BACKGROUND_COLOR = "#FFFFFF";
const GRID_LINE_COLOR = "#E5E7EB";
const OUTER_BORDER_COLOR = "#CBD5E1";

function getBrightness(hex: string): number {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return (r * 299 + g * 587 + b * 114) / 1000;
}

function getTextColor(hex: string): string {
  return getBrightness(hex) > 160 ? "#0F172A" : "#F8FAFC";
}

function getFallbackCode(colorId: number): string {
  return `#${String(colorId).padStart(2, "0")}`;
}

function getCellSize(maxDimension: number, showColorNumbers: boolean): number {
  if (showColorNumbers) {
    if (maxDimension <= 24) return 30;
    if (maxDimension <= 40) return 26;
    if (maxDimension <= 64) return 22;
    if (maxDimension <= 96) return 18;
    return 16;
  }

  if (maxDimension <= 24) return 24;
  if (maxDimension <= 40) return 20;
  if (maxDimension <= 64) return 18;
  if (maxDimension <= 96) return 14;
  return 12;
}

function getFontSize(cellSize: number, labelLength: number): number {
  if (labelLength >= 5) {
    return Math.max(7, Math.floor(cellSize * 0.28));
  }

  if (labelLength === 4) {
    return Math.max(8, Math.floor(cellSize * 0.31));
  }

  return Math.max(9, Math.floor(cellSize * 0.38));
}

export function renderPatternPreview(
  canvas: HTMLCanvasElement,
  options: PatternPreviewRenderOptions
): HTMLCanvasElement {
  const rows = options.grid.length;
  const cols = options.grid[0]?.length ?? 0;

  if (rows === 0 || cols === 0) {
    canvas.width = 1;
    canvas.height = 1;
    return canvas;
  }

  const cellSize =
    options.cellSize ?? getCellSize(Math.max(rows, cols), options.showColorNumbers);
  const padding = options.padding ?? Math.max(16, Math.floor(cellSize * 0.8));

  const width = cols * cellSize + padding * 2;
  const height = rows * cellSize + padding * 2;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas API is not available");
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const colorIndex = options.grid[y][x];
      const color =
        colorIndex === null ? null : options.palette[colorIndex];
      const fill = color?.hex ?? BACKGROUND_COLOR;
      const left = padding + x * cellSize;
      const top = padding + y * cellSize;

      ctx.fillStyle = fill;
      ctx.fillRect(left, top, cellSize, cellSize);

      if (options.showColorNumbers && color) {
        const label = getBrandCode(color, options.brand) || getFallbackCode(color.id);
        const fontSize = getFontSize(cellSize, label.length);

        ctx.fillStyle = getTextColor(fill);
        ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, left + cellSize / 2, top + cellSize / 2 + 0.5);
      }
    }
  }

  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = 0; x <= cols; x += 1) {
    const lineX = padding + x * cellSize + 0.5;
    ctx.moveTo(lineX, padding);
    ctx.lineTo(lineX, padding + rows * cellSize);
  }

  for (let y = 0; y <= rows; y += 1) {
    const lineY = padding + y * cellSize + 0.5;
    ctx.moveTo(padding, lineY);
    ctx.lineTo(padding + cols * cellSize, lineY);
  }

  ctx.stroke();

  ctx.strokeStyle = OUTER_BORDER_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    padding - 1,
    padding - 1,
    cols * cellSize + 2,
    rows * cellSize + 2
  );

  return canvas;
}

export function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  fileName: string
): void {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = fileName;
  link.click();
}
