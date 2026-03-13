-- 拼豆工具 - 数据库迁移脚本
-- 在 Supabase 中执行以下 SQL 创建必要的表和策略

-- 1. 创建拼豆图案表
CREATE TABLE IF NOT EXISTS bead_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  pattern_data JSONB NOT NULL,
  csv_data TEXT,
  thumbnail_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_bead_patterns_user_id ON bead_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_bead_patterns_created_at ON bead_patterns(created_at DESC);

-- 3. 启用行级安全策略 (RLS)
ALTER TABLE bead_patterns ENABLE ROW LEVEL SECURITY;

-- 4. 创建策略：用户只能查看自己的数据
CREATE POLICY "Users can view their own patterns"
  ON bead_patterns
  FOR SELECT
  USING (auth.uid() = user_id);

-- 5. 创建策略：用户可以插入自己的数据
CREATE POLICY "Users can insert their own patterns"
  ON bead_patterns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. 创建策略：用户可以更新自己的数据
CREATE POLICY "Users can update their own patterns"
  ON bead_patterns
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 7. 创建策略：用户可以删除自己的数据
CREATE POLICY "Users can delete their own patterns"
  ON bead_patterns
  FOR DELETE
  USING (auth.uid() = user_id);

-- 8. 创建 Storage Bucket（需要在 Supabase 界面手动创建或通过 API）
-- 注意：这个 SQL 不会自动创建 bucket，需要在 Supabase Dashboard -> Storage 中创建
-- Bucket 名称：bead-patterns
-- 权限：设置为私有（只有认证用户可以访问）

-- 9. 创建 Storage 策略（如果 bucket 已存在）
-- 这些策略需要根据实际 bucket ID 调整
/*
CREATE POLICY "Users can upload their own patterns"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'bead-patterns' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own patterns"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'bead-patterns' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own patterns"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'bead-patterns' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
*/

-- 10. 创建自动更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bead_patterns_updated_at
  BEFORE UPDATE ON bead_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 完成提示
SELECT '拼豆工具数据库迁移完成！' AS status;
