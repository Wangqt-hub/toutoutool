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

function getAutocorrelationScores(
  signal: number[],
  minLag: number,
  maxLag: number
): number[] {
  const mean = signal.reduce((sum, value) => sum + value, 0) / Math.max(1, signal.length);
  const centered = signal.map((value) => value - mean);
  const scores = Array.from({ length: maxLag + 1 }, () => 0);

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    let samples = 0;

    for (let index = 0; index + lag < centered.length; index += 1) {
      score += centered[index] * centered[index + lag];
      samples += 1;
    }

    scores[lag] = samples > 0 ? score / samples : 0;
  }

  return scores;
}

function getSearchLagBounds(signalLength: number): { minLag: number; maxLag: number } {
  const minLag = Math.max(8, Math.floor(signalLength / 180));
  const maxLag = Math.max(minLag + 2, Math.floor(signalLength / 4));
  return { minLag, maxLag };
}

function collectSpacingCandidates(signal: number[]): number[] {
  const { minLag, maxLag } = getSearchLagBounds(signal.length);
  const scores = getAutocorrelationScores(signal, minLag, maxLag);
  const smoothedScores = smoothSignal(scores, 2);
  const rankedCandidates = Array.from({ length: maxLag - minLag + 1 }, (_, index) => {
    const lag = index + minLag;
    return {
      lag,
      score: smoothedScores[lag] ?? scores[lag] ?? 0,
    };
  })
    .filter((candidate) => {
      const previous = smoothedScores[candidate.lag - 1] ?? Number.NEGATIVE_INFINITY;
      const next = smoothedScores[candidate.lag + 1] ?? Number.NEGATIVE_INFINITY;
      return candidate.score >= previous && candidate.score >= next;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  if (rankedCandidates.length === 0) {
    return [minLag];
  }

  const searchLags = new Set<number>();
  const enqueueLag = (candidateLag: number) => {
    if (candidateLag < minLag || candidateLag > maxLag) {
      return;
    }

    searchLags.add(candidateLag);
  };

  rankedCandidates.forEach(({ lag }) => {
    for (let delta = -2; delta <= 2; delta += 1) {
      enqueueLag(lag + delta);
    }

    for (const divisor of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const reduced = Math.round(lag / divisor);
      for (let delta = -2; delta <= 2; delta += 1) {
        enqueueLag(reduced + delta);
      }
    }

    for (const multiple of [2, 3]) {
      const expanded = lag * multiple;
      for (let delta = -2; delta <= 2; delta += 1) {
        enqueueLag(expanded + delta);
      }
    }
  });

  return Array.from(searchLags).sort((left, right) => left - right);
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

function getLocalValley(
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
    if ((signal[index] ?? 0) < bestValue) {
      bestIndex = index;
      bestValue = signal[index];
    }
  }

  return { index: bestIndex, value: bestValue };
}

function getSignalWindowAverage(
  signal: number[],
  center: number,
  radius: number
): number {
  let sum = 0;
  let count = 0;

  for (
    let index = Math.max(0, Math.round(center - radius));
    index <= Math.min(signal.length - 1, Math.round(center + radius));
    index += 1
  ) {
    sum += signal[index];
    count += 1;
  }

  return count > 0 ? sum / count : signal[clamp(Math.round(center), 0, signal.length - 1)];
}

function getInteriorPeakStrength(
  signal: number[],
  start: number,
  end: number,
  edgeInset: number
): number {
  let best = 0;

  for (
    let index = Math.max(0, Math.round(start + edgeInset));
    index <= Math.min(signal.length - 1, Math.round(end - edgeInset));
    index += 1
  ) {
    best = Math.max(best, signal[index] ?? 0);
  }

  return best;
}

function buildRegularLinePositions(signal: number[], step: number): number[] {
  const roundedStep = Math.max(6, Math.round(step));
  const tolerance = Math.max(2, Math.round(roundedStep * 0.22));
  const average =
    signal.reduce((sum, value) => sum + value, 0) / Math.max(signal.length, 1);
  const max = Math.max(...signal, average);
  const extensionMinStrength = average + (max - average) * 0.04;
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

  while (positions.length > 0) {
    const next = positions[0] - roundedStep;

    if (next < -tolerance) {
      break;
    }

    const peak = getLocalPeak(signal, next, tolerance);

    if (peak.value < extensionMinStrength) {
      break;
    }

    positions.unshift(peak.index);
  }

  while (positions.length > 0) {
    const next = positions[positions.length - 1] + roundedStep;

    if (next > signal.length - 1 + tolerance) {
      break;
    }

    const peak = getLocalPeak(signal, next, tolerance);

    if (peak.value < extensionMinStrength) {
      break;
    }

    positions.push(peak.index);
  }

  return positions.filter(
    (position, index) =>
      index === 0 || position - positions[index - 1] > Math.max(2, tolerance * 0.35)
  );
}

function buildRegularValleyPositions(signal: number[], step: number): number[] {
  const roundedStep = Math.max(6, Math.round(step));
  const tolerance = Math.max(2, Math.round(roundedStep * 0.24));
  const average =
    signal.reduce((sum, value) => sum + value, 0) / Math.max(signal.length, 1);
  const min = Math.min(...signal, average);
  const extensionMaxStrength = average - (average - min) * 0.05;
  let bestOffset = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let offset = 0; offset < roundedStep; offset += 1) {
    let score = 0;
    let samples = 0;

    for (let pos = offset; pos < signal.length; pos += roundedStep) {
      const valley = getLocalValley(signal, pos, tolerance);
      const center = getLocalPeak(signal, pos + roundedStep / 2, tolerance);
      score += center.value - valley.value;
      samples += 1;
    }

    if (samples > 0 && score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  const positions: number[] = [];
  for (let pos = bestOffset; pos < signal.length; pos += roundedStep) {
    const valley = getLocalValley(signal, pos, tolerance);
    if (positions.length === 0 || valley.index - positions[positions.length - 1] > 2) {
      positions.push(valley.index);
    }
  }

  while (positions.length > 0) {
    const next = positions[0] - roundedStep;

    if (next < -tolerance) {
      break;
    }

    const valley = getLocalValley(signal, next, tolerance);

    if (valley.value > extensionMaxStrength) {
      break;
    }

    positions.unshift(valley.index);
  }

  while (positions.length > 0) {
    const next = positions[positions.length - 1] + roundedStep;

    if (next > signal.length - 1 + tolerance) {
      break;
    }

    const valley = getLocalValley(signal, next, tolerance);

    if (valley.value > extensionMaxStrength) {
      break;
    }

    positions.push(valley.index);
  }

  return positions.filter(
    (position, index) =>
      index === 0 || position - positions[index - 1] > Math.max(2, tolerance * 0.35)
  );
}

function evaluateSpacingCandidate(signal: number[], lag: number): number {
  const positions = buildRegularLinePositions(signal, lag);

  if (positions.length < 3) {
    return Number.NEGATIVE_INFINITY;
  }

  const diffs = positions.slice(1).map((position, index) => position - positions[index]);
  const meanDiff =
    diffs.reduce((sum, value) => sum + value, 0) / Math.max(1, diffs.length);
  const deviation =
    diffs.reduce((sum, value) => sum + Math.abs(value - meanDiff), 0) /
    Math.max(1, diffs.length);
  const regularity = 1 / (1 + deviation / Math.max(1, meanDiff));

  const lineStrength =
    positions.reduce((sum, position) => sum + (signal[position] ?? 0), 0) /
    Math.max(1, positions.length);
  const midpointStrength =
    diffs.reduce((sum, diff, index) => {
      const midpoint = positions[index] + diff / 2;
      return sum + getSignalWindowAverage(signal, midpoint, Math.max(1, diff * 0.12));
    }, 0) / Math.max(1, diffs.length);
  const interiorPeakStrength =
    diffs.reduce((sum, diff, index) => {
      return (
        sum +
        getInteriorPeakStrength(
          signal,
          positions[index],
          positions[index + 1],
          Math.max(2, diff * 0.16)
        )
      );
    }, 0) / Math.max(1, diffs.length);
  const contrast = Math.max(0, lineStrength - midpointStrength);
  const contrastRatio = contrast / Math.max(lineStrength, 1);
  const lineCountFactor = Math.min(1, Math.max(0.08, (positions.length - 1) / 24));
  const largeLagPenalty =
    positions.length <= 6 && lag > signal.length / 12 ? 0.18 : 1;
  const interiorPenalty = Math.max(
    0.12,
    1 - interiorPeakStrength / Math.max(lineStrength, 1)
  );

  return (
    contrastRatio *
    (0.72 + regularity * 0.58) *
    lineCountFactor *
    interiorPenalty *
    interiorPenalty *
    largeLagPenalty
  );
}

function evaluateValleySpacingCandidate(signal: number[], lag: number): number {
  const positions = buildRegularValleyPositions(signal, lag);

  if (positions.length < 3) {
    return Number.NEGATIVE_INFINITY;
  }

  const diffs = positions.slice(1).map((position, index) => position - positions[index]);
  const meanDiff =
    diffs.reduce((sum, value) => sum + value, 0) / Math.max(1, diffs.length);
  const deviation =
    diffs.reduce((sum, value) => sum + Math.abs(value - meanDiff), 0) /
    Math.max(1, diffs.length);
  const regularity = 1 / (1 + deviation / Math.max(1, meanDiff));
  const boundaryStrength =
    positions.reduce((sum, position) => sum + (signal[position] ?? 0), 0) /
    Math.max(1, positions.length);
  const centerStrength =
    diffs.reduce((sum, diff, index) => {
      return (
        sum +
        getLocalPeak(
          signal,
          positions[index] + diff / 2,
          Math.max(1, diff * 0.22)
        ).value
      );
    }, 0) / Math.max(1, diffs.length);
  const contrastRatio = Math.max(
    0,
    (centerStrength - boundaryStrength) / Math.max(centerStrength, 1)
  );
  const boundaryDepth = Math.max(
    0.12,
    1 - boundaryStrength / Math.max(centerStrength, 1)
  );
  const lineCountFactor = Math.min(1, Math.max(0.08, (positions.length - 1) / 24));

  return contrastRatio * (0.72 + regularity * 0.58) * lineCountFactor * boundaryDepth;
}

function estimateDominantSpacing(signal: number[]): number {
  const candidateLags = collectSpacingCandidates(signal);
  let bestLag = candidateLags[0] ?? getSearchLagBounds(signal.length).minLag;
  let bestQuality = Number.NEGATIVE_INFINITY;

  candidateLags.forEach((lag) => {
    const quality = evaluateSpacingCandidate(signal, lag);

    if (
      quality > bestQuality ||
      (Math.abs(quality - bestQuality) < 1.5 && lag < bestLag)
    ) {
      bestQuality = quality;
      bestLag = lag;
    }
  });

  return bestLag;
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
  const coverage = Array.from({ length: signal.length }, () => 0);
  const continuity = Array.from({ length: signal.length }, () => 0);

  if (axis === "vertical") {
    for (let x = 0; x < width; x += 1) {
      let score = 0;
      let active = 0;
      let longestRun = 0;
      let currentRun = 0;

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

        const response = edge * 0.82 + darkness * 0.18;
        score += response;

        if (edge > 14 || (edge > 8 && darkness > 40) || darkness > 105) {
          active += 1;
          currentRun += 1;
          longestRun = Math.max(longestRun, currentRun);
        } else {
          currentRun = 0;
        }
      }

      signal[x] = score / height;
      coverage[x] = active / Math.max(1, height);
      continuity[x] = longestRun / Math.max(1, height);
    }
  } else {
    for (let y = 0; y < height; y += 1) {
      let score = 0;
      let active = 0;
      let longestRun = 0;
      let currentRun = 0;

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

        const response = edge * 0.82 + darkness * 0.18;
        score += response;

        if (edge > 14 || (edge > 8 && darkness > 40) || darkness > 105) {
          active += 1;
          currentRun += 1;
          longestRun = Math.max(longestRun, currentRun);
        } else {
          currentRun = 0;
        }
      }

      signal[y] = score / width;
      coverage[y] = active / Math.max(1, width);
      continuity[y] = longestRun / Math.max(1, width);
    }
  }

  const blended = signal.map(
    (value, index) =>
      value * 0.62 + coverage[index] * 255 * 0.22 + continuity[index] * 255 * 0.2
  );
  const lightlySmoothed = smoothSignal(blended, 1);
  const broadlySmoothed = smoothSignal(blended, 3);

  return lightlySmoothed.map(
    (value, index) => value * 0.38 + broadlySmoothed[index] * 0.62
  );
}

function computeInkSignal(
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
      let darknessSum = 0;
      let saturationSum = 0;

      for (let y = 0; y < height; y += 1) {
        const index = (y * width + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        darknessSum += 255 - getLuminance(r, g, b);
        saturationSum += Math.max(r, g, b) - Math.min(r, g, b);
      }

      signal[x] = darknessSum / Math.max(1, height) + saturationSum / Math.max(1, height) * 0.18;
    }
  } else {
    for (let y = 0; y < height; y += 1) {
      let darknessSum = 0;
      let saturationSum = 0;

      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        darknessSum += 255 - getLuminance(r, g, b);
        saturationSum += Math.max(r, g, b) - Math.min(r, g, b);
      }

      signal[y] = darknessSum / Math.max(1, width) + saturationSum / Math.max(1, width) * 0.18;
    }
  }

  return smoothSignal(signal, 2);
}

function detectAxisLinePositions(
  lineSignal: number[],
  inkSignal: number[]
): number[] {
  const candidateLags = new Set<number>([
    ...collectSpacingCandidates(lineSignal),
    ...collectSpacingCandidates(inkSignal),
  ]);
  let bestLinePositions = buildRegularLinePositions(
    lineSignal,
    estimateDominantSpacing(lineSignal)
  );
  let bestLineScore = Number.NEGATIVE_INFINITY;
  let bestValleyPositions = buildRegularValleyPositions(
    inkSignal,
    estimateDominantSpacing(inkSignal)
  );
  let bestValleyScore = Number.NEGATIVE_INFINITY;

  Array.from(candidateLags)
    .sort((left, right) => left - right)
    .forEach((lag) => {
      const lineScore = evaluateSpacingCandidate(lineSignal, lag);

      if (lineScore > bestLineScore) {
        bestLineScore = lineScore;
        bestLinePositions = buildRegularLinePositions(lineSignal, lag);
      }

      const valleyScore = evaluateValleySpacingCandidate(inkSignal, lag);

      if (valleyScore > bestValleyScore) {
        bestValleyScore = valleyScore;
        bestValleyPositions = buildRegularValleyPositions(inkSignal, lag);
      }
    });

  const lineCount = Math.max(0, bestLinePositions.length - 1);
  const valleyCount = Math.max(0, bestValleyPositions.length - 1);
  const shouldUseValley =
    valleyCount > lineCount &&
    valleyCount <= Math.max(6, Math.round(lineCount * 1.35)) &&
    bestValleyScore >= bestLineScore * 0.55;

  return shouldUseValley ? bestValleyPositions : bestLinePositions;
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

function estimateCellDominantColorFromPixels(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  rect: CropRect
): {
  r: number;
  g: number;
  b: number;
  meanDiff: number;
  activeRatio: number;
  dominantRatio: number;
} {
  const inset = Math.max(1, Math.round(Math.min(rect.width, rect.height) * 0.12));
  const sampleX = clamp(Math.round(rect.x + inset), 0, Math.max(0, imageWidth - 1));
  const sampleY = clamp(Math.round(rect.y + inset), 0, Math.max(0, imageHeight - 1));
  const sampleWidth = Math.max(
    2,
    Math.min(
      imageWidth - sampleX,
      Math.round(rect.width - inset * 2)
    )
  );
  const sampleHeight = Math.max(
    2,
    Math.min(
      imageHeight - sampleY,
      Math.round(rect.height - inset * 2)
    )
  );

  const buckets = new Map<
    string,
    { weight: number; sumR: number; sumG: number; sumB: number }
  >();
  const samples: Array<{ r: number; g: number; b: number; weight: number }> = [];
  let totalWeight = 0;

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceX = sampleX + x;
      const sourceY = sampleY + y;
      const index = (sourceY * imageWidth + sourceX) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const alpha = pixels[index + 3];

      if (alpha < 32) {
        continue;
      }

      const normalizedX =
        sampleWidth > 1 ? Math.abs((x + 0.5) / sampleWidth - 0.5) * 2 : 0;
      const normalizedY =
        sampleHeight > 1 ? Math.abs((y + 0.5) / sampleHeight - 0.5) * 2 : 0;
      const edgeBias = Math.max(normalizedX, normalizedY);
      const weight = 1 + edgeBias * 0.85;
      const key = `${Math.round(r / 16)}-${Math.round(g / 16)}-${Math.round(b / 16)}`;
      const bucket = buckets.get(key) ?? {
        weight: 0,
        sumR: 0,
        sumG: 0,
        sumB: 0,
      };

      bucket.weight += weight;
      bucket.sumR += r * weight;
      bucket.sumG += g * weight;
      bucket.sumB += b * weight;
      buckets.set(key, bucket);

      samples.push({ r, g, b, weight });
      totalWeight += weight;
    }
  }

  if (samples.length === 0 || totalWeight <= 0) {
    return {
      r: 255,
      g: 255,
      b: 255,
      meanDiff: 0,
      activeRatio: 0,
      dominantRatio: 1,
    };
  }

  const dominantBucket = Array.from(buckets.values()).reduce<{
    weight: number;
    sumR: number;
    sumG: number;
    sumB: number;
  } | null>((best, bucket) => {
    if (!best || bucket.weight > best.weight) {
      return bucket;
    }

    return best;
  }, null);

  const initialColor = dominantBucket
    ? {
        r: dominantBucket.sumR / dominantBucket.weight,
        g: dominantBucket.sumG / dominantBucket.weight,
        b: dominantBucket.sumB / dominantBucket.weight,
      }
    : { r: 255, g: 255, b: 255 };

  const refineThreshold = Math.max(
    18,
    Math.min(42, Math.round(Math.min(sampleWidth, sampleHeight) * 1.7))
  );
  let refinedWeight = 0;
  let refinedR = 0;
  let refinedG = 0;
  let refinedB = 0;
  let totalDiff = 0;
  let activeWeight = 0;

  samples.forEach((sample) => {
    const diff = getColorDistance(sample, initialColor);
    totalDiff += diff * sample.weight;

    if (diff <= refineThreshold) {
      refinedWeight += sample.weight;
      refinedR += sample.r * sample.weight;
      refinedG += sample.g * sample.weight;
      refinedB += sample.b * sample.weight;
    } else {
      activeWeight += sample.weight;
    }
  });

  const finalColor =
    refinedWeight > totalWeight * 0.16
      ? {
          r: Math.round(refinedR / refinedWeight),
          g: Math.round(refinedG / refinedWeight),
          b: Math.round(refinedB / refinedWeight),
        }
      : {
          r: Math.round(initialColor.r),
          g: Math.round(initialColor.g),
          b: Math.round(initialColor.b),
        };

  return {
    ...finalColor,
    meanDiff: totalDiff / totalWeight,
    activeRatio: activeWeight / totalWeight,
    dominantRatio: refinedWeight / totalWeight,
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
  dominantRatio?: number;
}): boolean {
  const luminance = getLuminance(sample.r, sample.g, sample.b);
  const maxChannel = Math.max(sample.r, sample.g, sample.b);
  const minChannel = Math.min(sample.r, sample.g, sample.b);
  const dominantRatio = sample.dominantRatio ?? 1 - sample.activeRatio;
  return (
    luminance > 242 &&
    maxChannel - minChannel < 18 &&
    sample.meanDiff < 12 &&
    sample.activeRatio < 0.12 &&
    dominantRatio > 0.68
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

export function detectGridGeometryFromPixels(options: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}): GridGeometry {
  const verticalLineSignal = computeLineSignal(
    options.pixels,
    options.width,
    options.height,
    "vertical"
  );
  const horizontalLineSignal = computeLineSignal(
    options.pixels,
    options.width,
    options.height,
    "horizontal"
  );
  const verticalInkSignal = computeInkSignal(
    options.pixels,
    options.width,
    options.height,
    "vertical"
  );
  const horizontalInkSignal = computeInkSignal(
    options.pixels,
    options.width,
    options.height,
    "horizontal"
  );

  const verticalLines = detectAxisLinePositions(
    verticalLineSignal,
    verticalInkSignal
  );
  const horizontalLines = detectAxisLinePositions(
    horizontalLineSignal,
    horizontalInkSignal
  );

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

export async function detectGridGeometry(imageSource: string): Promise<GridGeometry> {
  const image = await loadImage(imageSource);
  const { canvas, context } = createCanvas(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return detectGridGeometryFromPixels({
    pixels: imageData.data,
    width: canvas.width,
    height: canvas.height,
  });
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

export function recognizePatternColorsFromPixels(options: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  brand: ColorBrand;
  colorCount: number;
  geometry: GridGeometry;
}): ImportedPatternResult {
  const palette = getPalette(options.colorCount);
  const cells: ImportedPatternCell[][] = [];

  for (let row = 0; row < options.geometry.rowCount; row += 1) {
    const cellRow: ImportedPatternCell[] = [];

    for (let col = 0; col < options.geometry.colCount; col += 1) {
      const rect = getCellRect(options.geometry, row, col);
      const background = estimateCellDominantColorFromPixels(
        options.pixels,
        options.width,
        options.height,
        rect
      );
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
          source: "color",
        });
        continue;
      }

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
    }

    cells.push(cellRow);
  }

  return {
    cells,
    geometry: options.geometry,
    palette,
    unresolvedCount: 0,
  };
}

export async function recognizeImportedPattern(options: {
  imageSource: string;
  brand: ColorBrand;
  colorCount: number;
  mode?: ImportRecognitionMode;
  geometry: GridGeometry;
}): Promise<ImportedPatternResult> {
  const palette = getPalette(options.colorCount);
  const image = await loadImage(options.imageSource);
  const { canvas, context } = createCanvas(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  if (options.mode !== "ocr") {
    return recognizePatternColorsFromPixels({
      pixels: imageData.data,
      width: canvas.width,
      height: canvas.height,
      brand: options.brand,
      colorCount: options.colorCount,
      geometry: options.geometry,
    });
  }

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
          source: "ocr",
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
