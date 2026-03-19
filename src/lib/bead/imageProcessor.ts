/**
 * 拼豆工具 - 图像处理函数
 * 负责图片缩放、像素化和颜色量化。
 */

import { findClosestColor, hexToRgb, type PaletteColor } from "./palette";
import type { BeadGrid } from "./types";

export interface ImageProcessingResult {
  width: number;
  height: number;
  grid: BeadGrid;
  palette: PaletteColor[];
}

export type PixelAlgorithm = "standard" | "edge-enhanced" | "dithered";

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

function mapPixelsWithDithering(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: PaletteColor[]
): BeadGrid {
  const working = new Float32Array(pixels.length);
  const paletteRgb = palette.map((color) => hexToRgb(color.hex));
  const grid: BeadGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );

  for (let index = 0; index < pixels.length; index += 1) {
    working[index] = pixels[index];
  }

  const distributeError = (
    targetX: number,
    targetY: number,
    errorR: number,
    errorG: number,
    errorB: number,
    weight: number
  ) => {
    if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
      return;
    }

    const targetIndex = (targetY * width + targetX) * 4;

    if (working[targetIndex + 3] === 0) {
      return;
    }

    working[targetIndex] += errorR * weight;
    working[targetIndex + 1] += errorG * weight;
    working[targetIndex + 2] += errorB * weight;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;

      if (working[index + 3] === 0) {
        grid[y][x] = null;
        continue;
      }

      const current = {
        r: clampChannel(working[index]),
        g: clampChannel(working[index + 1]),
        b: clampChannel(working[index + 2]),
      };

      const colorIndex = findClosestColor(current, palette);
      const matched = paletteRgb[colorIndex];

      grid[y][x] = colorIndex;

      const errorR = current.r - matched.r;
      const errorG = current.g - matched.g;
      const errorB = current.b - matched.b;

      distributeError(x + 1, y, errorR, errorG, errorB, 7 / 16);
      distributeError(x - 1, y + 1, errorR, errorG, errorB, 3 / 16);
      distributeError(x, y + 1, errorR, errorG, errorB, 5 / 16);
      distributeError(x + 1, y + 1, errorR, errorG, errorB, 1 / 16);
    }
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
  const { width, height } = calculateDimensions(
    image.width,
    image.height,
    settings
  );
  const { canvas, context } = createWorkingCanvas(width, height);

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const sourceImageData = context.getImageData(0, 0, width, height);
  const algorithm = settings.algorithm ?? "standard";

  let grid: BeadGrid;

  if (algorithm === "dithered") {
    grid = mapPixelsWithDithering(
      sourceImageData.data,
      width,
      height,
      palette
    );
  } else {
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
