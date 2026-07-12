-- 045: Versioned poster storage.
--
-- `posters` remains the poster work/session table. `poster_versions` stores
-- every downloaded or uploaded image that can be resumed for future edits.

CREATE TABLE IF NOT EXISTS public.poster_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid NOT NULL REFERENCES public.posters(id) ON DELETE CASCADE,
  version_no int NOT NULL CHECK (version_no > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,

  source_type text NOT NULL CHECK (
    source_type IN ('generated', 'revised', 'uploaded', 'book_recommendation')
  ),
  image_url text NOT NULL,
  thumbnail_url text,
  storage_path text NOT NULL,
  thumbnail_storage_path text,
  prompt_used text,
  revision_instruction text CHECK (
    revision_instruction IS NULL OR length(revision_instruction) <= 1000
  ),
  input_version_id uuid REFERENCES public.poster_versions(id) ON DELETE SET NULL,
  mime_type text NOT NULL DEFAULT 'image/png',
  width int,
  height int,
  file_size_bytes int,
  model text,
  quality text,
  size text,
  estimated_cost_cents int,

  UNIQUE (poster_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_poster_versions_poster_created_at
  ON public.poster_versions (poster_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_poster_versions_created_at
  ON public.poster_versions (created_at DESC);

ALTER TABLE public.poster_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view poster versions" ON public.poster_versions;
CREATE POLICY "Staff can view poster versions" ON public.poster_versions
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert poster versions" ON public.poster_versions;
CREATE POLICY "Staff can insert poster versions" ON public.poster_versions
  FOR INSERT WITH CHECK (
    public.is_staff()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Owner or admin can update poster versions" ON public.poster_versions;
CREATE POLICY "Owner or admin can update poster versions" ON public.poster_versions
  FOR UPDATE USING (
    public.is_admin_or_master() OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Owner or admin can delete poster versions" ON public.poster_versions;
CREATE POLICY "Owner or admin can delete poster versions" ON public.poster_versions
  FOR DELETE USING (
    public.is_admin_or_master() OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Owner or admin can update posters" ON public.posters;
DROP POLICY IF EXISTS "Staff can update posters" ON public.posters;
CREATE POLICY "Staff can update posters" ON public.posters
  FOR UPDATE USING (public.is_staff())
  WITH CHECK (public.is_staff());

ALTER TABLE public.posters
  ADD COLUMN IF NOT EXISTS current_version_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posters_current_version_id_fkey'
  ) THEN
    ALTER TABLE public.posters
      ADD CONSTRAINT posters_current_version_id_fkey
      FOREIGN KEY (current_version_id)
      REFERENCES public.poster_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;
