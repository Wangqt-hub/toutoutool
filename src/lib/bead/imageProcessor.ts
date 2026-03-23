/**
 * 拼豆工具 - 图像处理函数
 * 负责图片缩放、像素化和颜色量化。
 */

import { findClosestColor, type PaletteColor } from "./palette";
import type { BeadGrid } from "./types";

export interface ImageProcessingResult {
  width: number;
  height: number;
  grid: BeadGrid;
  palette: PaletteColor[];
}

export type PixelAlgorithm = "standard" | "edge-enhanced" | "clustered";

export interface CanvasSettings {
  width: number;
  height: number;
  maintainAspectRatio: boolean;
  algorithm?: PixelAlgorithm;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampDimension(value: number): number {
  return Math.max(8, Math.min(128, Math.round(value)));
}

function loadImage(imageSource: HTMLImageElement | string): Promise<HTMLImageElement> {
  if (typeof imageSource !== "string") {
    return Promise.resolve(imageSource);
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = imageSource;
  });
}

function createWorkingCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("浏览器不支持 Canvas API");
  }

  canvas.width = width;
  canvas.height = height;

  return { canvas, context };
}

const PROCESSING_PIXELS_PER_CELL = 16;
const DOMINANT_BUCKET_SIZE = 20;

function calculateProcessingDimensions(
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
  targetHeight: number
): { width: number; height: number } {
  return {
    width: Math.max(
      targetWidth,
      Math.min(originalWidth, targetWidth * PROCESSING_PIXELS_PER_CELL)
    ),
    height: Math.max(
      targetHeight,
      Math.min(originalHeight, targetHeight * PROCESSING_PIXELS_PER_CELL)
    ),
  };
}

function boxBlur(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const output = new Float32Array(pixels.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let samples = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = Math.max(0, Math.min(width - 1, x + offsetX));
          const sampleY = Math.max(0, Math.min(height - 1, y + offsetY));
          const index = (sampleY * width + sampleX) * 4;

          r += pixels[index];
          g += pixels[index + 1];
          b += pixels[index + 2];
          a += pixels[index + 3];
          samples += 1;
        }
      }

      const outputIndex = (y * width + x) * 4;
      output[outputIndex] = r / samples;
      output[outputIndex + 1] = g / samples;
      output[outputIndex + 2] = b / samples;
      output[outputIndex + 3] = a / samples;
    }
  }

  return output;
}

function computeEdgeMap(
  pixels: Float32Array,
  width: number,
  height: number
): Float32Array {
  const luminance = new Float32Array(width * height);
  const edgeMap = new Float32Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const pixelIndex = index * 4;
    luminance[index] =
      pixels[pixelIndex] * 0.299 +
      pixels[pixelIndex + 1] * 0.587 +
      pixels[pixelIndex + 2] * 0.114;
  }

  let maxMagnitude = 1;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;

      const topLeft = luminance[(y - 1) * width + (x - 1)];
      const top = luminance[(y - 1) * width + x];
      const topRight = luminance[(y - 1) * width + (x + 1)];
      const left = luminance[y * width + (x - 1)];
      const right = luminance[y * width + (x + 1)];
      const bottomLeft = luminance[(y + 1) * width + (x - 1)];
      const bottom = luminance[(y + 1) * width + x];
      const bottomRight = luminance[(y + 1) * width + (x + 1)];

      const gradientX =
        -topLeft +
        topRight -
        2 * left +
        2 * right -
        bottomLeft +
        bottomRight;
      const gradientY =
        -topLeft -
        2 * top -
        topRight +
        bottomLeft +
        2 * bottom +
        bottomRight;

      const magnitude = Math.sqrt(
        gradientX * gradientX + gradientY * gradientY
      );

      edgeMap[index] = magnitude;
      maxMagnitude = Math.max(maxMagnitude, magnitude);
    }
  }

  for (let index = 0; index < edgeMap.length; index += 1) {
    edgeMap[index] /= maxMagnitude;
  }

  return edgeMap;
}

function applyEdgeEnhanced(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const blurred = boxBlur(data, width, height);
  const edgeMap = computeEdgeMap(blurred, width, height);
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const edgeStrength = Math.min(1, edgeMap[y * width + x] * 1.35);

      for (let channel = 0; channel < 3; channel += 1) {
        const original = data[pixelIndex + channel];
        const softened = original * 0.82 + blurred[pixelIndex + channel] * 0.18;
        const contrasted = (softened - 128) * 1.14 + 128;
        const outlined = contrasted - edgeStrength * 58;
        output[pixelIndex + channel] = clampChannel(outlined);
      }

      output[pixelIndex + 3] = data[pixelIndex + 3];
    }
  }

  return new ImageData(output, width, height);
}

function mapPixelsToGrid(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  palette: PaletteColor[]
): BeadGrid {
  const grid: BeadGrid = [];

  for (let y = 0; y < height; y += 1) {
    const row: Array<number | null> = [];

    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];

      if (alpha === 0) {
        row.push(null);
        continue;
      }

      row.push(
        findClosestColor(
          {
            r: clampChannel(pixels[index]),
            g: clampChannel(pixels[index + 1]),
            b: clampChannel(pixels[index + 2]),
          },
          palette
        )
      );
    }

    grid.push(row);
  }

  return grid;
}

function getCellBounds(
  sourceWidth: number,
  sourceHeight: number,
  gridWidth: number,
  gridHeight: number,
  row: number,
  col: number
): { x: number; y: number; width: number; height: number } {
  const startX = Math.floor((col * sourceWidth) / gridWidth);
  const endX = Math.floor(((col + 1) * sourceWidth) / gridWidth);
  const startY = Math.floor((row * sourceHeight) / gridHeight);
  const endY = Math.floor(((row + 1) * sourceHeight) / gridHeight);

  return {
    x: startX,
    y: startY,
    width: Math.max(1, endX - startX),
    height: Math.max(1, endY - startY),
  };
}

function estimateDominantCellColor(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  rect: { x: number; y: number; width: number; height: number }
): {
  r: number;
  g: number;
  b: number;
  alphaRatio: number;
} {
  const inset = Math.max(0, Math.round(Math.min(rect.width, rect.height) * 0.05));
  const sampleX = Math.max(0, rect.x + inset);
  const sampleY = Math.max(0, rect.y + inset);
  const sampleWidth = Math.max(1, Math.min(imageWidth - sampleX, rect.width - inset * 2));
  const sampleHeight = Math.max(
    1,
    Math.min(imageHeight - sampleY, rect.height - inset * 2)
  );
  const buckets = new Map<
    string,
    { weight: number; sumR: number; sumG: number; sumB: number }
  >();
  const borderBuckets = new Map<
    string,
    { weight: number; sumR: number; sumG: number; sumB: number }
  >();
  const samples: Array<{ r: number; g: number; b: number; weight: number }> = [];
  const totalSamples = sampleWidth * sampleHeight;
  let totalWeight = 0;
  let opaqueSamples = 0;

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceX = sampleX + x;
      const sourceY = sampleY + y;
      const index = (sourceY * imageWidth + sourceX) * 4;
      const alpha = pixels[index + 3];

      if (alpha < 24) {
        continue;
      }

      opaqueSamples += 1;

      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const normalizedX =
        sampleWidth > 1 ? Math.abs((x + 0.5) / sampleWidth - 0.5) * 2 : 0;
      const normalizedY =
        sampleHeight > 1 ? Math.abs((y + 0.5) / sampleHeight - 0.5) * 2 : 0;
      const edgeBias = Math.max(normalizedX, normalizedY);
      const weight = 0.92 + edgeBias * 0.36;
      const key = `${Math.round(r / DOMINANT_BUCKET_SIZE)}-${Math.round(
        g / DOMINANT_BUCKET_SIZE
      )}-${Math.round(b / DOMINANT_BUCKET_SIZE)}`;
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

      if (edgeBias >= 0.58) {
        const borderBucket = borderBuckets.get(key) ?? {
          weight: 0,
          sumR: 0,
          sumG: 0,
          sumB: 0,
        };

        borderBucket.weight += weight;
        borderBucket.sumR += r * weight;
        borderBucket.sumG += g * weight;
        borderBucket.sumB += b * weight;
        borderBuckets.set(key, borderBucket);
      }

      samples.push({ r, g, b, weight });
      totalWeight += weight;
    }
  }

  if (samples.length === 0 || totalWeight <= 0) {
    return {
      r: 255,
      g: 255,
      b: 255,
      alphaRatio: 0,
    };
  }

  const dominantSource = borderBuckets.size > 0 ? borderBuckets : buckets;
  const dominantBucket = Array.from(dominantSource.values()).reduce<{
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
    Math.min(42, Math.round(Math.min(sampleWidth, sampleHeight) * 0.9))
  );
  let refinedWeight = 0;
  let refinedR = 0;
  let refinedG = 0;
  let refinedB = 0;

  samples.forEach((sample) => {
    const dr = sample.r - initialColor.r;
    const dg = sample.g - initialColor.g;
    const db = sample.b - initialColor.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    if (distance > refineThreshold) {
      return;
    }

    refinedWeight += sample.weight;
    refinedR += sample.r * sample.weight;
    refinedG += sample.g * sample.weight;
    refinedB += sample.b * sample.weight;
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
    alphaRatio: opaqueSamples / Math.max(1, totalSamples),
  };
}

export function mapPixelsToClusteredGrid(
  pixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  gridWidth: number,
  gridHeight: number,
  palette: PaletteColor[]
): BeadGrid {
  const grid: BeadGrid = [];

  for (let row = 0; row < gridHeight; row += 1) {
    const gridRow: Array<number | null> = [];

    for (let col = 0; col < gridWidth; col += 1) {
      const rect = getCellBounds(
        sourceWidth,
        sourceHeight,
        gridWidth,
        gridHeight,
        row,
        col
      );
      const dominant = estimateDominantCellColor(
        pixels,
        sourceWidth,
        sourceHeight,
        rect
      );

      if (dominant.alphaRatio < 0.08) {
        gridRow.push(null);
        continue;
      }

      gridRow.push(
        findClosestColor(
          {
            r: clampChannel(dominant.r),
            g: clampChannel(dominant.g),
            b: clampChannel(dominant.b),
          },
          palette
        )
      );
    }

    grid.push(gridRow);
  }

  return grid;
}

export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  settings: CanvasSettings
): { width: number; height: number } {
  if (!settings.maintainAspectRatio) {
    return {
      width: settings.width,
      height: settings.height,
    };
  }

  const aspectRatio = originalWidth / originalHeight;
  const targetSize = Math.max(settings.width, settings.height);

  if (aspectRatio >= 1) {
    return {
      width: settings.width,
      height: Math.round(settings.width / aspectRatio),
    };
  }

  return {
    width: Math.round(targetSize * aspectRatio),
    height: targetSize,
  };
}

export function calculateAspectRatioDimensionsFromWidth(
  originalWidth: number,
  originalHeight: number,
  targetWidth: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  let width = clampDimension(targetWidth);
  let height = clampDimension(width / aspectRatio);

  if (height > 128) {
    height = 128;
    width = clampDimension(height * aspectRatio);
  }

  if (width > 128) {
    width = 128;
    height = clampDimension(width / aspectRatio);
  }

  if (height < 8) {
    height = 8;
    width = clampDimension(height * aspectRatio);
  }

  if (width < 8) {
    width = 8;
    height = clampDimension(width / aspectRatio);
  }

  return { width, height };
}

export async function processImage(
  imageSource: HTMLImageElement | string,
  settings: CanvasSettings,
  palette: PaletteColor[]
): Promise<ImageProcessingResult> {
  const image = await loadImage(imageSource);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const { width, height } = calculateDimensions(
    sourceWidth,
    sourceHeight,
    settings
  );
  const algorithm = settings.algorithm ?? "standard";

  let grid: BeadGrid;

  if (algorithm === "clustered") {
    const processingSize = calculateProcessingDimensions(
      sourceWidth,
      sourceHeight,
      width,
      height
    );
    const { context } = createWorkingCanvas(
      processingSize.width,
      processingSize.height
    );

    context.clearRect(0, 0, processingSize.width, processingSize.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, processingSize.width, processingSize.height);

    const sourceImageData = context.getImageData(
      0,
      0,
      processingSize.width,
      processingSize.height
    );

    grid = mapPixelsToClusteredGrid(
      sourceImageData.data,
      sourceImageData.width,
      sourceImageData.height,
      width,
      height,
      palette
    );
  } else {
    const { context } = createWorkingCanvas(width, height);

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    const sourceImageData = context.getImageData(0, 0, width, height);
    const workingImageData =
      algorithm === "edge-enhanced"
        ? applyEdgeEnhanced(sourceImageData)
        : sourceImageData;

    grid = mapPixelsToGrid(
      workingImageData.data,
      width,
      height,
      palette
    );
  }

  return {
    width,
    height,
    grid,
    palette,
  };
}

export function exportToCSV(
  grid: BeadGrid,
  palette: PaletteColor[],
  brand: string = "MARD"
): string {
  let csv = "row,col,colorIndex,colorName,hex,brandCode,state\n";

  grid.forEach((row, y) => {
    row.forEach((colorIndex, x) => {
      if (colorIndex === null) {
        csv += `${y + 1},${x + 1},,,,,empty\n`;
        return;
      }

      const color = palette[colorIndex];
      const brandCode =
        color.brandCodes?.[brand as keyof typeof color.brandCodes] || "";
      csv += `${y + 1},${x + 1},${colorIndex},${color.id},${color.hex},${brandCode},filled\n`;
    });
  });

  return csv;
}

export function parseFromCSV(csv: string): {
  grid: BeadGrid;
  width: number;
  height: number;
} {
  const lines = csv.trim().split("\n");
  const dataLines = lines.slice(1);

  if (dataLines.length === 0) {
    throw new Error("CSV 数据为空");
  }

  let maxWidth = 0;
  let maxHeight = 0;

  dataLines.forEach((line) => {
    const parts = line.split(",");
    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    maxHeight = Math.max(maxHeight, row);
    maxWidth = Math.max(maxWidth, col);
  });

  const grid: BeadGrid = Array.from({ length: maxHeight }, () =>
    Array.from({ length: maxWidth }, () => null)
  );

  dataLines.forEach((line) => {
    const parts = line.split(",");
    const row = parseInt(parts[0], 10) - 1;
    const col = parseInt(parts[1], 10) - 1;
    const rawColorIndex = parts[2]?.trim();

    if (row >= 0 && row < maxHeight && col >= 0 && col < maxWidth) {
      grid[row][col] = rawColorIndex ? parseInt(rawColorIndex, 10) : null;
    }
  });

  return {
    grid,
    width: maxWidth,
    height: maxHeight,
  };
}
