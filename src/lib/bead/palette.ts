/**
 * 拼豆工具 - 色卡库工具函数
 */

import colorLibrary from "@/app/color_library.json";

export type ColorBrand = "MARD" | "COCO" | "漫漫" | "盼盼" | "咪小窝";

export interface PaletteColor {
  id: number;
  hex: string;
  brandCodes?: Partial<Record<ColorBrand, string>>;
}

export interface ColorLibraryData {
  [key: string]: PaletteColor[];
}

type ColorLibraryEntry = {
  hex: string;
  MARD?: string;
  COCO?: string;
  漫漫?: string;
  盼盼?: string;
  咪小窝?: string;
};

type ColorLibrary = Record<string, ColorLibraryEntry[]>;

const library = colorLibrary as ColorLibrary;

export function getPalette(colorCount: number): PaletteColor[] {
  const key = `${colorCount}colors`;
  const colors = library[key] ?? [];

  return colors.map((color, index) => ({
    id: index,
    hex: color.hex,
    brandCodes: {
      MARD: color.MARD,
      COCO: color.COCO,
      漫漫: color.漫漫,
      盼盼: color.盼盼,
      咪小窝: color.咪小窝,
    },
  }));
}

export function getAvailableBrands(): ColorBrand[] {
  return ["MARD", "COCO", "漫漫", "盼盼", "咪小窝"];
}

export function getBrandCode(
  color: PaletteColor,
  brand: ColorBrand
): string | undefined {
  return color.brandCodes?.[brand];
}

export function getAvailableColorCounts(): number[] {
  return Object.keys(library)
    .filter((key) => key.endsWith("colors"))
    .map((key) => Number.parseInt(key.replace("colors", ""), 10))
    .sort((left, right) => left - right);
}

export function getFullPalette(): PaletteColor[] {
  const counts = getAvailableColorCounts();
  const largestCount = counts[counts.length - 1] ?? 24;
  return getPalette(largestCount);
}

export function normalizeBrandCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "");

  if (!normalized) {
    return "";
  }

  const match = /^([A-Z]+)(\d+)$/.exec(normalized);
  if (!match) {
    return normalized;
  }

  const [, prefix, digits] = match;
  return `${prefix}${Number.parseInt(digits, 10)}`;
}

export function createBrandCodeLookup(
  brand: ColorBrand,
  palette: PaletteColor[]
): Map<string, PaletteColor> {
  const lookup = new Map<string, PaletteColor>();

  palette.forEach((color) => {
    const code = color.brandCodes?.[brand];
    if (!code || code === "-") {
      return;
    }

    lookup.set(code.trim().toUpperCase(), color);
    lookup.set(normalizeBrandCode(code), color);
  });

  return lookup;
}

export function matchBrandCode(
  brand: ColorBrand,
  code: string,
  palette: PaletteColor[]
): { color: PaletteColor; matchedCode: string } | null {
  const lookup = createBrandCodeLookup(brand, palette);
  const raw = code.trim().toUpperCase();
  const normalized = normalizeBrandCode(code);
  const color = lookup.get(raw) ?? lookup.get(normalized);

  if (!color) {
    return null;
  }

  return {
    color,
    matchedCode: color.brandCodes?.[brand] ?? raw,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((value) => {
        const hex = value.toString(16);
        return hex.length === 1 ? `0${hex}` : hex;
      })
      .join("")
      .toUpperCase()
  );
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function colorDistance(
  left: { r: number; g: number; b: number },
  right: { r: number; g: number; b: number }
): number {
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function findClosestColor(
  rgb: { r: number; g: number; b: number },
  palette: PaletteColor[]
): number {
  let closestIndex = 0;
  let minDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < palette.length; index += 1) {
    const paletteRgb = hexToRgb(palette[index].hex);
    const distance = colorDistance(rgb, paletteRgb);

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}
