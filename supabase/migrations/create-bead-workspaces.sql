CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.bead_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('image', 'ai', 'pattern', 'legacy')
  ),
  brand TEXT NOT NULL,
  pattern_data JSONB NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  used_color_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_color_indexes INTEGER[] NOT NULL DEFAULT '{}',
  selected_color_index INTEGER,
  thumbnail_path TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bead_workspaces_user_recent
  ON public.bead_workspaces(user_id, last_opened_at DESC, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bead_workspaces_user_current
  ON public.bead_workspaces(user_id)
  WHERE is_current = true;

ALTER TABLE public.bead_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bead workspaces"
  ON public.bead_workspaces;
CREATE POLICY "Users can view their own bead workspaces"
  ON public.bead_workspaces
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bead workspaces"
  ON public.bead_workspaces;
CREATE POLICY "Users can insert their own bead workspaces"
  ON public.bead_workspaces
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bead workspaces"
  ON public.bead_workspaces;
CREATE POLICY "Users can update their own bead workspaces"
  ON public.bead_workspaces
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bead workspaces"
  ON public.bead_workspaces;
CREATE POLICY "Users can delete their own bead workspaces"
  ON public.bead_workspaces
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_bead_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bead_workspaces_updated_at
  ON public.bead_workspaces;
CREATE TRIGGER update_bead_workspaces_updated_at
  BEFORE UPDATE ON public.bead_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bead_workspaces_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bead-patterns',
  'bead-patterns',
  true,
  2097152,
  ARRAY['image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload their own workspace thumbnails"
  ON storage.objects;
CREATE POLICY "Users can upload their own workspace thumbnails"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bead-patterns' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can view their own workspace thumbnails"
  ON storage.objects;
CREATE POLICY "Users can view their own workspace thumbnails"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bead-patterns' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own workspace thumbnails"
  ON storage.objects;
CREATE POLICY "Users can update their own workspace thumbnails"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bead-patterns' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'bead-patterns' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own workspace thumbnails"
  ON storage.objects;
CREATE POLICY "Users can delete their own workspace thumbnails"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bead-patterns' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
