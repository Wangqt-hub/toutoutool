/**
 * 拼豆工具 - Supabase Storage 封装
 * 用于存储和管理拼豆图纸
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { BeadGrid } from './types';

export interface BeadPatternMetadata {
  id?: string;
  name: string;
  userId: string;
  patternData: {
   width: number;
   height: number;
   grid: BeadGrid;
    palette: Array<{
      id: number;
     hex: string;
      brandCodes?: Record<string, string>;
    }>;
  };
  csvData?: string;
  thumbnailUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

const BUCKET_NAME = 'bead-patterns';

/**
 * 上传拼豆图纸到 Storage
 */
export async function uploadPattern(
  userId: string,
  patternId: string,
  jsonData: object
): Promise<{ url: string; path: string }> {
  const supabase = createSupabaseBrowserClient();
  
  const fileName = `${userId}/${patternId}.json`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, JSON.stringify(jsonData), {
     cacheControl: '3600',
      upsert: true
    });

  if (error) {
   throw new Error(`上传失败：${error.message}`);
  }

  // 获取公开访问 URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

 return {
   url: urlData.publicUrl,
   path: data.path
  };
}

/**
 * 从 Storage 下载拼豆图纸
 */
export async function downloadPattern(patternPath: string): Promise<object> {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(patternPath);

  if (error || !data) {
   throw new Error(`下载失败：${error?.message || '文件不存在'}`);
  }

  const text = await data.text();
 return JSON.parse(text);
}

/**
 * 删除拼豆图纸
 */
export async function deletePattern(patternPath: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([patternPath]);

  if (error) {
   throw new Error(`删除失败：${error.message}`);
  }
}

/**
 * 生成缩略图 Canvas
 */
export function generateThumbnail(
  grid: BeadGrid,
  palette: Array<{ hex: string }>,
  cellSize: number= 10
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
   throw new Error('Canvas 不支持');
  }

  const width = grid[0].length;
  const height = grid.length;

  canvas.width = width * cellSize;
  canvas.height = height * cellSize;

  // 绘制网格
  for (let y = 0; y < height; y++) {
   for (let x = 0; x < width; x++) {
    const colorIndex = grid[y][x];
    const color = colorIndex === null ? null : palette[colorIndex];
     
     ctx.fillStyle = color?.hex || '#FFFFFF';
     ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

 return canvas;
}

/**
 * 将 Canvas 转换为 Blob 用于上传
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
 return new Promise((resolve, reject) => {
   canvas.toBlob(blob => {
     if (blob) {
       resolve(blob);
     } else {
      reject(new Error('无法生成 Blob'));
     }
   }, 'image/png');
  });
}
