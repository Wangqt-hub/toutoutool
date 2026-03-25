"use client";

import type { PaletteColor } from "@/lib/bead/palette";
import type { BeadGrid } from "@/lib/bead/types";

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("当前浏览器不支持 Canvas。");
  }

  return context;
}

export function buildWorkspaceThumbnailCanvas(
  grid: BeadGrid,
  palette: PaletteColor[],
  maxEdge = 240
): HTMLCanvasElement {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const longestEdge = Math.max(rows, cols, 1);
  const cellSize = Math.max(2, Math.floor(maxEdge / longestEdge));
  const canvas = document.createElement("canvas");
  const context = getCanvasContext(canvas);

  canvas.width = Math.max(1, cols * cellSize);
  canvas.height = Math.max(1, rows * cellSize);

  context.fillStyle = "#F8F3EE";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let colIndex = 0; colIndex < cols; colIndex += 1) {
      const colorIndex = grid[rowIndex][colIndex];

      if (colorIndex === null) {
        continue;
      }

      context.fillStyle = palette[colorIndex]?.hex ?? "#FFFFFF";
      context.fillRect(
        colIndex * cellSize,
        rowIndex * cellSize,
        cellSize,
        cellSize
      );
    }
  }

  return canvas;
}

export function buildWorkspaceThumbnailDataUrl(
  grid: BeadGrid,
  palette: PaletteColor[],
  maxEdge = 240
): string {
  return buildWorkspaceThumbnailCanvas(grid, palette, maxEdge).toDataURL(
    "image/png"
  );
}
