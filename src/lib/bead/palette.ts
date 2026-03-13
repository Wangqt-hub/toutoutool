/**
 * 拼豆工具 - 色卡库工具函数
 * 从 color_library.json 读取和管理色卡数据
 */

import colorLibrary from '@/app/color_library.json';

export type ColorBrand = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝';

export interface PaletteColor {
  id: number;
  hex: string;
  brandCodes?: Partial<Record<ColorBrand, string>>;
}

export interface ColorLibraryData {
  [key: string]: PaletteColor[];
}

// 色卡库类型定义
type ColorLibrary = Record<string, Array<{
  hex: string;
  MARD?: string;
  COCO?: string;
  漫漫?: string;
  盼盼?: string;
  咪小窝?: string;
}>>;

const library = colorLibrary as ColorLibrary;

/**
 * 获取指定颜色数量的色卡列表
 * @param colorCount 颜色数量（24, 48, 72 等）
 * @returns 色卡数组
 */
export function getPalette(colorCount: number): PaletteColor[] {
  const key = `${colorCount}colors`;
  const colors = library[key] || [];
  
 return colors.map((color, index) => ({
  id: index,
   hex: color.hex,
  brandCodes: {
     MARD: color.MARD,
     COCO: color.COCO,
     '漫漫': color['漫漫'],
     '盼盼': color['盼盼'],
     '咪小窝': color['咪小窝']
   }
  }));
}

/**
 * 获取所有可用的色卡品牌名称
 * @returns 品牌名称数组
 */
export function getAvailableBrands(): ColorBrand[] {
  return ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'];
}

/**
 * 获取指定的色号代码
 * @param color 色卡对象
 * @param brand 品牌名称
 * @returns 色号代码
 */
export function getBrandCode(color: PaletteColor, brand: ColorBrand): string | undefined {
  return color.brandCodes?.[brand];
}

/**
 * 将 RGB 颜色转换为 Hex 格式
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
   const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

/**
 * 将 Hex 颜色转换为 RGB 格式
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const num = parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * 计算两个 RGB 颜色之间的欧几里得距离
 */
export function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 找到最接近的色卡颜色
 * @param rgb RGB 颜色值
 * @param palette 色卡库
 * @returns 最接近的色卡索引
 */
export function findClosestColor(
  rgb: { r: number; g: number; b: number },
  palette: PaletteColor[]
): number {
  let closestIndex = 0;
  let minDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < palette.length; i++) {
   const colorRgb = hexToRgb(palette[i].hex);
   const distance = colorDistance(rgb, colorRgb);
    
    if (distance < minDistance) {
      minDistance = distance;
     closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * 获取所有可用的颜色数量选项
 */
export function getAvailableColorCounts(): number[] {
  return Object.keys(library)
    .filter(key => key.endsWith('colors'))
    .map(key => parseInt(key.replace('colors', '')))
    .sort((a, b) => a - b);
}
