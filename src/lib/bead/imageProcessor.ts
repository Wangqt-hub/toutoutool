/**
 * 拼豆工具 - 图像处理函数
 * 负责图片缩放、像素化和颜色量化
 */

import { PaletteColor, findClosestColor, hexToRgb } from './palette';

export interface ImageProcessingResult {
  width: number;
  height: number;
  grid: number[][];
  palette: PaletteColor[];
}

export interface CanvasSettings {
  width: number;      // 画布宽度（格子数）
  height: number;     // 画布高度（格子数）
  maintainAspectRatio: boolean;
}

/**
 * 计算调整后的尺寸（保持或不保持宽高比）
 */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  settings: CanvasSettings
): { width: number; height: number } {
  if (settings.maintainAspectRatio) {
   const aspectRatio = originalWidth / originalHeight;
   const targetSize = Math.max(settings.width, settings.height);
    
    if (aspectRatio >= 1) {
      // 横向或方形
      return {
        width: settings.width,
        height: Math.round(settings.width / aspectRatio)
      };
    } else {
      // 纵向
      return {
        width: Math.round(settings.height * aspectRatio),
        height: settings.height
      };
    }
  }
  
  return {
    width: settings.width,
    height: settings.height
  };
}

/**
 * 将图片转换为像素网格
 * @param imageSource 图片 URL 或 Image 对象
 * @param settings 画布设置
 * @param palette 色卡库
 * @returns 处理结果
 */
export async function processImage(
  imageSource: HTMLImageElement | string,
  settings: CanvasSettings,
  palette: PaletteColor[]
): Promise<ImageProcessingResult> {
  // 创建 canvas 进行处理
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('浏览器不支持 Canvas API');
  }

  // 获取图片对象
  let img: HTMLImageElement;
  if (typeof imageSource === 'string') {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
     const image = new Image();
      image.src = imageSource;
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片加载失败'));
    });
  } else {
    img = imageSource;
  }

  // 计算目标尺寸
  const { width, height } = calculateDimensions(img.width, img.height, settings);
  
  // 设置 canvas 尺寸
  canvas.width = width;
  canvas.height = height;

  // 绘制缩放的图片
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // 获取像素数据
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // 生成网格
  const grid: number[][] = [];
  
  for (let y = 0; y < height; y++) {
   const row: number[] = [];
    for (let x = 0; x < width; x++) {
     const idx = (y * width + x) * 4;
     const r = pixels[idx];
     const g = pixels[idx +1];
     const b = pixels[idx + 2];
     const a = pixels[idx + 3];

      // 如果完全透明，使用白色
      if (a === 0) {
        row.push(0);
       continue;
      }

      // 找到最接近的色卡颜色
     const closestIndex = findClosestColor({ r, g, b }, palette);
      row.push(closestIndex);
    }
    grid.push(row);
  }

  return {
    width,
    height,
    grid,
    palette
  };
}

/**
 * 将网格数据导出为 CSV 格式
 */
export function exportToCSV(
  grid: number[][],
  palette: PaletteColor[],
  brand: 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝' = 'MARD'
): string {
  let csv = 'row,col,colorIndex,colorName,hex,brandCode\n';
  
  grid.forEach((row, y) => {
    row.forEach((colorIndex, x) => {
     const color = palette[colorIndex];
     const brandCode = color.brandCodes?.[brand] || '';
      csv += `${y + 1},${x +1},${colorIndex},${color.id},${color.hex},${brandCode}\n`;
    });
  });
  
  return csv;
}

/**
 * 从 CSV 解析网格数据
 */
export function parseFromCSV(csv: string): {
  grid: number[][];
  width: number;
  height: number;
} {
  const lines = csv.trim().split('\n');
  const dataLines = lines.slice(1); // 跳过表头
  
  if (dataLines.length === 0) {
    throw new Error('CSV 数据为空');
  }

  // 找出最大的行列数
  let maxWidth = 0;
  let maxHeight = 0;
  
  dataLines.forEach(line => {
   const parts = line.split(',');
   const row = parseInt(parts[0]);
   const col = parseInt(parts[1]);
    if (row > maxHeight) maxHeight = row;
    if (col> maxWidth) maxWidth = col;
  });

  // 初始化网格
  const grid: number[][] = Array(maxHeight).fill(null).map(() => Array(maxWidth).fill(0));

  // 填充数据
  dataLines.forEach(line => {
   const parts = line.split(',');
   const row = parseInt(parts[0]) - 1; // 转 0-based 索引
   const col = parseInt(parts[1]) - 1;
   const colorIndex = parseInt(parts[2]);
    
    if (row >= 0 && row < maxHeight && col >= 0 && col < maxWidth) {
      grid[row][col] = colorIndex;
    }
  });

  return {
    grid,
    width: maxWidth,
    height: maxHeight
  };
}
