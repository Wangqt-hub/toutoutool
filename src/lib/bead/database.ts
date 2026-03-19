/**
 * 拼豆工具 - 数据库操作
 * 管理拼豆图纸的数据库记录
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { BeadGrid } from './types';

export interface BeadPatternRecord {
  id: string;
  user_id: string;
  name: string;
  pattern_data: {
  width: number;
  height: number;
  grid: BeadGrid;
    palette: Array<{
     id: number;
    hex: string;
      brandCodes?: Record<string, string>;
    }>;
  };
  csv_data?: string;
  thumbnail_url?: string;
  storage_path?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 创建新的拼豆图案记录
 */
export async function createPattern(
  userId: string,
  name: string,
  patternData: BeadPatternRecord['pattern_data'],
  options?: {
    csvData?: string;
    thumbnailUrl?: string;
    storagePath?: string;
  }
): Promise<BeadPatternRecord> {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('bead_patterns')
    .insert({
    user_id: userId,
     name,
     pattern_data: patternData,
      csv_data: options?.csvData,
      thumbnail_url: options?.thumbnailUrl,
      storage_path: options?.storagePath
    })
    .select()
    .single();

  if (error || !data) {
   throw new Error(`创建失败：${error?.message || '未知错误'}`);
  }

 return data as BeadPatternRecord;
}

/**
 * 更新拼豆图案记录
 */
export async function updatePattern(
  patternId: string,
  updates: Partial<Pick<BeadPatternRecord, 'name' | 'pattern_data' | 'csv_data'>>
): Promise<BeadPatternRecord> {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('bead_patterns')
    .update({
     ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', patternId)
    .select()
    .single();

  if (error || !data) {
   throw new Error(`更新失败：${error?.message || '未知错误'}`);
  }

 return data as BeadPatternRecord;
}

/**
 * 获取用户的所有拼豆图案（按时间倒序）
 */
export async function getUserPatterns(userId: string, limit = 50): Promise<BeadPatternRecord[]> {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('bead_patterns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
   throw new Error(`查询失败：${error.message}`);
  }

 return (data as BeadPatternRecord[]) || [];
}

/**
 * 获取单个拼豆图案
 */
export async function getPattern(patternId: string): Promise<BeadPatternRecord | null> {
  const supabase = createSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('bead_patterns')
    .select('*')
    .eq('id', patternId)
    .single();

  if (error || !data) {
   return null;
  }

 return data as BeadPatternRecord;
}

/**
 * 删除拼豆图案记录
 */
export async function deletePattern(patternId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  
  const { error } = await supabase
    .from('bead_patterns')
    .delete()
    .eq('id', patternId);

  if (error) {
   throw new Error(`删除失败：${error.message}`);
  }
}
