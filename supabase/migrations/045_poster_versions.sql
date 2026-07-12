-- 045: Versioned poster storage.
--
-- `posters` remains the poster work/session table. `poster_versions` stores
-- every downloaded or uploaded image that can be resumed for future edits.

CREATE TABLE IF NOT EXISTS public.posters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  category text NOT NULL CHECK (category IN ('event','welcome','group','notice','custom')),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  body_text text CHECK (body_text IS NULL OR length(body_text) <= 500),
  prompt_used text NOT NULL,
  ratio text NOT NULL CHECK (ratio IN ('1:1','9:16','a4')),
  ai_image_url text NOT NULL,
  final_image_url text NOT NULL,
  linked_event_id uuid,
  linked_notice_id uuid,
  cost_cents int
);

CREATE INDEX IF NOT EXISTS idx_posters_created_at
  ON public.posters (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posters_created_by
  ON public.posters (created_by, created_at DESC);

ALTER TABLE public.posters
  ADD COLUMN IF NOT EXISTS linked_event_id uuid,
  ADD COLUMN IF NOT EXISTS linked_notice_id uuid;

CREATE OR REPLACE FUNCTION public.poster_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posters_updated_at ON public.posters;
CREATE TRIGGER posters_updated_at
  BEFORE UPDATE ON public.posters
  FOR EACH ROW EXECUTE FUNCTION public.poster_set_updated_at();

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'posters_linked_event_id_fkey'
     ) THEN
    ALTER TABLE public.posters
      ADD CONSTRAINT posters_linked_event_id_fkey
      FOREIGN KEY (linked_event_id)
      REFERENCES public.events(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.notices') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'posters_linked_notice_id_fkey'
     ) THEN
    ALTER TABLE public.posters
      ADD CONSTRAINT posters_linked_notice_id_fkey
      FOREIGN KEY (linked_notice_id)
      REFERENCES public.notices(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.posters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view posters" ON public.posters;
CREATE POLICY "Staff can view posters" ON public.posters
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert posters" ON public.posters;
CREATE POLICY "Staff can insert posters" ON public.posters
  FOR INSERT WITH CHECK (
    public.is_staff()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Owner or admin can update posters" ON public.posters;
DROP POLICY IF EXISTS "Staff can update posters" ON public.posters;
CREATE POLICY "Staff can update posters" ON public.posters
  FOR UPDATE USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Owner or admin can delete posters" ON public.posters;
CREATE POLICY "Owner or admin can delete posters" ON public.posters
  FOR DELETE USING (
    public.is_admin_or_master() OR created_by = auth.uid()
  );

CREATE TABLE IF NOT EXISTS public.poster_generations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variants_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poster_gen_log_user_time
  ON public.poster_generations_log (user_id, created_at DESC);

ALTER TABLE public.poster_generations_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Self can read own log" ON public.poster_generations_log;
CREATE POLICY "Self can read own log" ON public.poster_generations_log
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin_or_master());

DROP POLICY IF EXISTS "Self can write own log" ON public.poster_generations_log;
CREATE POLICY "Self can write own log" ON public.poster_generations_log
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_staff());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'poster-images', 'poster-images', true, 10485760,
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Public read poster-images" ON storage.objects;
CREATE POLICY "Public read poster-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'poster-images');

DROP POLICY IF EXISTS "Staff upload poster-images" ON storage.objects;
CREATE POLICY "Staff upload poster-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'poster-images' AND public.is_staff());

DROP POLICY IF EXISTS "Staff update poster-images" ON storage.objects;
CREATE POLICY "Staff update poster-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'poster-images' AND public.is_staff());

DROP POLICY IF EXISTS "Staff delete poster-images" ON storage.objects;
CREATE POLICY "Staff delete poster-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'poster-images' AND public.is_staff());

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
