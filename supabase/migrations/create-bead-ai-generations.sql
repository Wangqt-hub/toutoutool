-- AI generation history for bead import

CREATE TABLE IF NOT EXISTS public.bead_ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style_id TEXT NOT NULL,
  style_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'UPLOADING_SOURCE',
      'PENDING',
      'RUNNING',
      'SAVING_RESULT',
      'SUCCEEDED',
      'FAILED'
    )
  ),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (
    progress_percent BETWEEN 0 AND 100
  ),
  source_image_path TEXT NOT NULL,
  ai_image_path TEXT,
  dashscope_task_id TEXT UNIQUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bead_ai_generations_user_created_at
  ON public.bead_ai_generations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bead_ai_generations_user_status
  ON public.bead_ai_generations(user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bead_ai_generations_user_active
  ON public.bead_ai_generations(user_id)
  WHERE status IN ('UPLOADING_SOURCE', 'PENDING', 'RUNNING', 'SAVING_RESULT');

ALTER TABLE public.bead_ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ai generations"
  ON public.bead_ai_generations;
CREATE POLICY "Users can view their own ai generations"
  ON public.bead_ai_generations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own ai generations"
  ON public.bead_ai_generations;
CREATE POLICY "Users can insert their own ai generations"
  ON public.bead_ai_generations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ai generations"
  ON public.bead_ai_generations;
CREATE POLICY "Users can update their own ai generations"
  ON public.bead_ai_generations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own ai generations"
  ON public.bead_ai_generations;
CREATE POLICY "Users can delete their own ai generations"
  ON public.bead_ai_generations
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bead_ai_generations_updated_at
  ON public.bead_ai_generations;
CREATE TRIGGER update_bead_ai_generations_updated_at
  BEFORE UPDATE ON public.bead_ai_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can upload their own ai images"
  ON storage.objects;
CREATE POLICY "Users can upload their own ai images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bead-ai-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can view their own ai images"
  ON storage.objects;
CREATE POLICY "Users can view their own ai images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bead-ai-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own ai images"
  ON storage.objects;
CREATE POLICY "Users can update their own ai images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bead-ai-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'bead-ai-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own ai images"
  ON storage.objects;
CREATE POLICY "Users can delete their own ai images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bead-ai-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
