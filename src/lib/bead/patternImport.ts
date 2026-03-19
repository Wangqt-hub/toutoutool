"use client";

import {
  createBrandCodeLookup,
  findClosestColor,
  getPalette,
  normalizeBrandCode,
  rgbToHex,
  type ColorBrand,
  type PaletteColor,
} from "./palette";
import type { BeadGrid } from "./types";

export type ImportRecognitionMode = "color" | "ocr";
export type ImportCellState = "filled" | "empty" | "unresolved";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridGeometry {
  bounds: CropRect;
  rowCount: number;
  colCount: number;
  horizontalLines: number[];
  verticalLines: number[];
}

export interface ImportedPatternCell {
  row: number;
  col: number;
  state: ImportCellState;
  paletteIndex: number | null;
  code: string | null;
  matchedCode: string | null;
  estimatedHex: string | null;
  confidence: number;
  source: "color" | "ocr" | "manual";
  failureReason?: "ocr-not-found" | "ocr-unmatched";
}

export interface ImportedPatternResult {
  cells: ImportedPatternCell[][];
  geometry: GridGeometry;
  palette: PaletteColor[];
  unresolvedCount: number;
}

export interface PreviewPatternResult {
  grid: BeadGrid;
  palette: PaletteColor[];
}

const UNRESOLVED_PREVIEW_COLOR: PaletteColor = {
  id: 999,
  hex: "#EF4444",
  brandCodes: {},
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("浏览器不支持 Canvas。");
  }

  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return { canvas, context };
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图纸图片加载失败。"));
    image.src = source;
  });
}

function getLuminance(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function getColorDistance(
  left: { r: number; g: number; b: number },
  right: { r: number; g: number; b: number }
): number {
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function smoothSignal(signal: number[], radius: number): number[] {
  return signal.map((_, index) => {
    let sum = 0;
    let count = 0;

    for (
      let neighbor = Math.max(0, index - radius);
      neighbor <= Math.min(signal.length - 1, index + radius);
      neighbor += 1
    ) {
      sum += signal[neighbor];
      count += 1;
    }

    return count > 0 ? sum / count : signal[index];
  });
}

function estimateDominantSpacing(signal: number[]): number {
  const minLag = Math.max(8, Math.floor(signal.length / 120));
  const maxLag = Math.max(minLag + 1, Math.floor(signal.length / 4));
  let bestLag = minLag;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;

    for (let index = 0; index + lag < signal.length; index += 1) {
      score += signal[index] * signal[index + lag];
    }

    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  return bestLag;
}

function getLocalPeak(
  signal: number[],
  center: number,
  tolerance: number
): { index: number; value: number } {
  let bestIndex = clamp(Math.round(center), 0, signal.length - 1);
  let bestValue = signal[bestIndex] ?? 0;

  for (
    let index = Math.max(0, Math.round(center - tolerance));
    index <= Math.min(signal.length - 1, Math.round(center + tolerance));
    index += 1
  ) {
    if ((signal[index] ?? 0) > bestValue) {
      bestIndex = index;
      bestValue = signal[index];
    }
  }

  return { index: bestIndex, value: bestValue };
}

function buildRegularLinePositions(signal: number[], step: number): number[] {
  const roundedStep = Math.max(6, Math.round(step));
  const tolerance = Math.max(2, Math.round(roundedStep * 0.22));
  let bestOffset = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let offset = 0; offset < roundedStep; offset += 1) {
    let score = 0;
    let samples = 0;

    for (let pos = offset; pos < signal.length; pos += roundedStep) {
      const peak = getLocalPeak(signal, pos, tolerance);
      score += peak.value;
      samples += 1;
    }

    if (samples > 0 && score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  const positions: number[] = [];
  for (let pos = bestOffset; pos < signal.length; pos += roundedStep) {
    const peak = getLocalPeak(signal, pos, tolerance);
    if (positions.length === 0 || peak.index - positions[positions.length - 1] > 2) {
      positions.push(peak.index);
    }
  }

  const average =
    signal.reduce((sum, value) => sum + value, 0) / Math.max(signal.length, 1);
  const max = Math.max(...signal, average);
  const minStrength = average + (max - average) * 0.15;

  while (positions.length > 2 && (signal[positions[0]] ?? 0) < minStrength) {
    positions.shift();
  }

  while (
    positions.length > 2 &&
    (signal[positions[positions.length - 1]] ?? 0) < minStrength
  ) {
    positions.pop();
  }

  return positions;
}

function computeLineSignal(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  axis: "horizontal" | "vertical"
): number[] {
  const signal = Array.from(
    { length: axis === "vertical" ? width : height },
    () => 0
  );

  if (axis === "vertical") {
    for (let x = 0; x < width; x += 1) {
      let score = 0;

      for (let y = 0; y < height; y += 1) {
        const index = (y * width + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const darkness = 255 - getLuminance(r, g, b);
        const left = x > 0 ? (y * width + (x - 1)) * 4 : index;
        const right = x < width - 1 ? (y * width + (x + 1)) * 4 : index;
        const edge =
          Math.abs(getLuminance(pixels[left], pixels[left + 1], pixels[left + 2]) -
            getLuminance(pixels[right], pixels[right + 1], pixels[right + 2]));

        score += darkness * 0.35 + edge * 0.65;
      }

      signal[x] = score / height;
    }
  } else {
    for (let y = 0; y < height; y += 1) {
      let score = 0;

      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const darkness = 255 - getLuminance(r, g, b);
        const top = y > 0 ? (((y - 1) * width + x) * 4) : index;
        const bottom = y < height - 1 ? (((y + 1) * width + x) * 4) : index;
        const edge =
          Math.abs(getLuminance(pixels[top], pixels[top + 1], pixels[top + 2]) -
            getLuminance(pixels[bottom], pixels[bottom + 1], pixels[bottom + 2]));

        score += darkness * 0.35 + edge * 0.65;
      }

      signal[y] = score / width;
    }
  }

  return smoothSignal(signal, 2);
}

function normalizeLinePositions(
  positions: number[],
  count: number,
  boundsStart: number,
  boundsSize: number
): number[] {
  if (positions.length === count + 1) {
    return positions;
  }

  return Array.from({ length: count + 1 }, (_, index) =>
    Math.round(boundsStart + (boundsSize * index) / count)
  );
}

function getCellRect(
  geometry: GridGeometry,
  row: number,
  col: number
): CropRect {
  const verticalLines = normalizeLinePositions(
    geometry.verticalLines,
    geometry.colCount,
    geometry.bounds.x,
    geometry.bounds.width
  );
  const horizontalLines = normalizeLinePositions(
    geometry.horizontalLines,
    geometry.rowCount,
    geometry.bounds.y,
    geometry.bounds.height
  );

  return {
    x: verticalLines[col],
    y: horizontalLines[row],
    width: Math.max(1, verticalLines[col + 1] - verticalLines[col]),
    height: Math.max(1, horizontalLines[row + 1] - horizontalLines[row]),
  };
}

function estimateCellBackground(
  context: CanvasRenderingContext2D,
  rect: CropRect
): { r: number; g: number; b: number; meanDiff: number; activeRatio: number } {
  const inset = Math.max(1, Math.round(Math.min(rect.width, rect.height) * 0.12));
  const sampleX = Math.round(rect.x + inset);
  const sampleY = Math.round(rect.y + inset);
  const sampleWidth = Math.max(2, Math.round(rect.width - inset * 2));
  const sampleHeight = Math.max(2, Math.round(rect.height - inset * 2));
  const imageData = context.getImageData(sampleX, sampleY, sampleWidth, sampleHeight);
  const { data, width, height } = imageData;

  let borderR = 0;
  let borderG = 0;
  let borderB = 0;
  let borderCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBorder =
        x < Math.max(1, Math.round(width * 0.18)) ||
        x >= width - Math.max(1, Math.round(width * 0.18)) ||
        y < Math.max(1, Math.round(height * 0.18)) ||
        y >= height - Math.max(1, Math.round(height * 0.18));

      if (!isBorder) {
        continue;
      }

      const index = (y * width + x) * 4;
      borderR += data[index];
      borderG += data[index + 1];
      borderB += data[index + 2];
      borderCount += 1;
    }
  }

  const background = {
    r: Math.round(borderR / Math.max(1, borderCount)),
    g: Math.round(borderG / Math.max(1, borderCount)),
    b: Math.round(borderB / Math.max(1, borderCount)),
  };

  let totalDiff = 0;
  let activePixels = 0;
  const activeThreshold = 28;

  for (let index = 0; index < data.length; index += 4) {
    const diff = getColorDistance(background, {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
    });

    totalDiff += diff;

    if (diff > activeThreshold) {
      activePixels += 1;
    }
  }

  const pixelCount = data.length / 4;
  return {
    ...background,
    meanDiff: totalDiff / Math.max(1, pixelCount),
    activeRatio: activePixels / Math.max(1, pixelCount),
  };
}

function isEmptyCell(sample: {
  r: number;
  g: number;
  b: number;
  meanDiff: number;
  activeRatio: number;
}): boolean {
  const luminance = getLuminance(sample.r, sample.g, sample.b);
  const maxChannel = Math.max(sample.r, sample.g, sample.b);
  const minChannel = Math.min(sample.r, sample.g, sample.b);
  return (
    luminance > 236 &&
    maxChannel - minChannel < 18 &&
    sample.meanDiff < 18 &&
    sample.activeRatio < 0.12
  );
}

function buildOcrTile(
  context: CanvasRenderingContext2D,
  rect: CropRect,
  background: { r: number; g: number; b: number }
): HTMLCanvasElement {
  const inset = Math.max(1, Math.round(Math.min(rect.width, rect.height) * 0.1));
  const sourceX = Math.round(rect.x + inset);
  const sourceY = Math.round(rect.y + inset);
  const sourceWidth = Math.max(2, Math.round(rect.width - inset * 2));
  const sourceHeight = Math.max(2, Math.round(rect.height - inset * 2));
  const imageData = context.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
  const { data } = imageData;

  const diffs: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const diff = getColorDistance(background, {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
    });
    diffs.push(diff);
  }

  const mean = diffs.reduce((sum, value) => sum + value, 0) / Math.max(1, diffs.length);
  const variance =
    diffs.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, diffs.length);
  const threshold = Math.max(20, mean + Math.sqrt(variance) * 1.05);

  const { canvas, context: tileContext } = createCanvas(64, 64);
  tileContext.fillStyle = "#FFFFFF";
  tileContext.fillRect(0, 0, canvas.width, canvas.height);

  const temp = document.createElement("canvas");
  temp.width = sourceWidth;
  temp.height = sourceHeight;
  const tempContext = temp.getContext("2d");

  if (!tempContext) {
    return canvas;
  }

  const output = tempContext.createImageData(sourceWidth, sourceHeight);

  for (let index = 0; index < data.length; index += 4) {
    const diff = diffs[index / 4];
    const luminanceDiff = Math.abs(
      getLuminance(data[index], data[index + 1], data[index + 2]) -
        getLuminance(background.r, background.g, background.b)
    );
    const isInk = diff > threshold || luminanceDiff > threshold * 0.85;
    const value = isInk ? 0 : 255;
    output.data[index] = value;
    output.data[index + 1] = value;
    output.data[index + 2] = value;
    output.data[index + 3] = 255;
  }

  tempContext.putImageData(output, 0, 0);
  tileContext.imageSmoothingEnabled = false;
  tileContext.drawImage(temp, 4, 4, 56, 56);
  return canvas;
}

function flattenWords(blocks: Tesseract.Block[] | null): Tesseract.Word[] {
  if (!blocks) {
    return [];
  }

  return blocks.flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.flatMap((line) => line.words)
    )
  );
}

function sanitizeOcrWord(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function cropImage(
  imageSource: string,
  crop: CropRect
): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(imageSource);
  const { canvas, context } = createCanvas(crop.width, crop.height);
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

export async function detectGridGeometry(imageSource: string): Promise<GridGeometry> {
  const image = await loadImage(imageSource);
  const { canvas, context } = createCanvas(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const verticalSignal = computeLineSignal(
    imageData.data,
    canvas.width,
    canvas.height,
    "vertical"
  );
  const horizontalSignal = computeLineSignal(
    imageData.data,
    canvas.width,
    canvas.height,
    "horizontal"
  );

  const estimatedColStep = estimateDominantSpacing(verticalSignal);
  const estimatedRowStep = estimateDominantSpacing(horizontalSignal);
  const verticalLines = buildRegularLinePositions(verticalSignal, estimatedColStep);
  const horizontalLines = buildRegularLinePositions(horizontalSignal, estimatedRowStep);

  if (verticalLines.length < 2 || horizontalLines.length < 2) {
    throw new Error("自动识别行列失败，请重新裁切到像素格区域。");
  }

  return {
    bounds: {
      x: verticalLines[0],
      y: horizontalLines[0],
      width: Math.max(1, verticalLines[verticalLines.length - 1] - verticalLines[0]),
      height: Math.max(1, horizontalLines[horizontalLines.length - 1] - horizontalLines[0]),
    },
    rowCount: horizontalLines.length - 1,
    colCount: verticalLines.length - 1,
    horizontalLines,
    verticalLines,
  };
}

export function applyGridSizeOverride(
  geometry: GridGeometry,
  rowCount: number,
  colCount: number
): GridGeometry {
  return {
    ...geometry,
    rowCount,
    colCount,
    horizontalLines: normalizeLinePositions(
      geometry.horizontalLines,
      rowCount,
      geometry.bounds.y,
      geometry.bounds.height
    ),
    verticalLines: normalizeLinePositions(
      geometry.verticalLines,
      colCount,
      geometry.bounds.x,
      geometry.bounds.width
    ),
  };
}

export async function recognizeImportedPattern(options: {
  imageSource: string;
  brand: ColorBrand;
  colorCount: number;
  mode: ImportRecognitionMode;
  geometry: GridGeometry;
}): Promise<ImportedPatternResult> {
  const palette = getPalette(options.colorCount);
  const image = await loadImage(options.imageSource);
  const { canvas, context } = createCanvas(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const cells: ImportedPatternCell[][] = [];
  const ocrCandidates: Array<{
    row: number;
    col: number;
    tile: HTMLCanvasElement;
    sheetRect?: CropRect;
    recognized?: { text: string; confidence: number };
  }> = [];

  for (let row = 0; row < options.geometry.rowCount; row += 1) {
    const cellRow: ImportedPatternCell[] = [];

    for (let col = 0; col < options.geometry.colCount; col += 1) {
      const rect = getCellRect(options.geometry, row, col);
      const background = estimateCellBackground(context, rect);
      const estimatedHex = rgbToHex(background.r, background.g, background.b);

      if (isEmptyCell(background)) {
        cellRow.push({
          row,
          col,
          state: "empty",
          paletteIndex: null,
          code: null,
          matchedCode: null,
          estimatedHex,
          confidence: 1,
          source: options.mode === "ocr" ? "ocr" : "color",
        });
        continue;
      }

      if (options.mode === "color") {
        const paletteIndex = findClosestColor(background, palette);
        const color = palette[paletteIndex];

        cellRow.push({
          row,
          col,
          state: "filled",
          paletteIndex,
          code: color.brandCodes?.[options.brand] ?? null,
          matchedCode: color.brandCodes?.[options.brand] ?? null,
          estimatedHex,
          confidence: 1,
          source: "color",
        });
        continue;
      }

      const tile = buildOcrTile(context, rect, background);
      ocrCandidates.push({ row, col, tile });
      cellRow.push({
        row,
        col,
        state: "unresolved",
        paletteIndex: null,
        code: null,
        matchedCode: null,
        estimatedHex,
        confidence: 0,
        source: "ocr",
        failureReason: "ocr-not-found",
      });
    }

    cells.push(cellRow);
  }

  if (options.mode === "ocr" && ocrCandidates.length > 0) {
    const tileSize = 64;
    const gap = 12;
    const sheetColumns = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(ocrCandidates.length))));
    const sheetRows = Math.ceil(ocrCandidates.length / sheetColumns);
    const { canvas: sheetCanvas, context: sheetContext } = createCanvas(
      sheetColumns * (tileSize + gap) + gap,
      sheetRows * (tileSize + gap) + gap
    );

    sheetContext.fillStyle = "#FFFFFF";
    sheetContext.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    ocrCandidates.forEach((candidate, index) => {
      const sheetX = gap + (index % sheetColumns) * (tileSize + gap);
      const sheetY = gap + Math.floor(index / sheetColumns) * (tileSize + gap);
      candidate.sheetRect = {
        x: sheetX,
        y: sheetY,
        width: tileSize,
        height: tileSize,
      };
      sheetContext.drawImage(candidate.tile, sheetX, sheetY, tileSize, tileSize);
    });

    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng");

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const {
        data: { blocks },
      } = await worker.recognize(
        sheetCanvas,
        {},
        { blocks: true }
      );

      const words = flattenWords(blocks);
      const bestMatches = new Map<string, { text: string; confidence: number }>();

      words.forEach((word) => {
        const cleaned = sanitizeOcrWord(word.text);
        if (!cleaned) {
          return;
        }

        const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
        const centerY = (word.bbox.y0 + word.bbox.y1) / 2;

        const candidate = ocrCandidates.find((item) => {
          if (!item.sheetRect) {
            return false;
          }

          return (
            centerX >= item.sheetRect.x &&
            centerX <= item.sheetRect.x + item.sheetRect.width &&
            centerY >= item.sheetRect.y &&
            centerY <= item.sheetRect.y + item.sheetRect.height
          );
        });

        if (!candidate) {
          return;
        }

        const key = `${candidate.row}-${candidate.col}`;
        const previous = bestMatches.get(key);
        if (!previous || word.confidence > previous.confidence) {
          bestMatches.set(key, {
            text: cleaned,
            confidence: word.confidence / 100,
          });
        }
      });

      const lookup = createBrandCodeLookup(options.brand, palette);

      ocrCandidates.forEach((candidate) => {
        const key = `${candidate.row}-${candidate.col}`;
        const recognized = bestMatches.get(key);
        const cell = cells[candidate.row][candidate.col];

        if (!recognized) {
          return;
        }

        const rawCode = recognized.text;
        const normalized = normalizeBrandCode(rawCode);
        const matchedColor = lookup.get(rawCode) ?? lookup.get(normalized);

        if (!matchedColor) {
          cell.code = rawCode;
          cell.confidence = recognized.confidence;
          cell.failureReason = "ocr-unmatched";
          return;
        }

        const paletteIndex = palette.findIndex((item) => item.id === matchedColor.id);
        cell.state = "filled";
        cell.paletteIndex = paletteIndex;
        cell.code = rawCode;
        cell.matchedCode = matchedColor.brandCodes?.[options.brand] ?? rawCode;
        cell.confidence = recognized.confidence;
        cell.failureReason = undefined;
      });
    } finally {
      await worker.terminate();
    }
  }

  const unresolvedCount = cells.flat().filter((cell) => cell.state === "unresolved").length;

  return {
    cells,
    geometry: options.geometry,
    palette,
    unresolvedCount,
  };
}

export function resolveImportedCellCode(options: {
  cell: ImportedPatternCell;
  palette: PaletteColor[];
  brand: ColorBrand;
  code: string;
}): ImportedPatternCell | null {
  const lookup = createBrandCodeLookup(options.brand, options.palette);
  const raw = options.code.trim().toUpperCase();
  const normalized = normalizeBrandCode(raw);
  const matchedColor = lookup.get(raw) ?? lookup.get(normalized);

  if (!matchedColor) {
    return null;
  }

  const paletteIndex = options.palette.findIndex((item) => item.id === matchedColor.id);

  return {
    ...options.cell,
    state: "filled",
    paletteIndex,
    code: raw,
    matchedCode: matchedColor.brandCodes?.[options.brand] ?? raw,
    confidence: 1,
    source: "manual",
    failureReason: undefined,
  };
}

export function toBeadGrid(cells: ImportedPatternCell[][]): BeadGrid {
  return cells.map((row) =>
    row.map((cell) => (cell.state === "filled" ? cell.paletteIndex : null))
  );
}

export function toPreviewPattern(
  cells: ImportedPatternCell[][],
  palette: PaletteColor[]
): PreviewPatternResult {
  const previewPalette = [...palette, UNRESOLVED_PREVIEW_COLOR];
  const unresolvedIndex = previewPalette.length - 1;

  return {
    grid: cells.map((row) =>
      row.map((cell) => {
        if (cell.state === "filled") {
          return cell.paletteIndex;
        }

        if (cell.state === "unresolved") {
          return unresolvedIndex;
        }

        return null;
      })
    ),
    palette: previewPalette,
  };
}
