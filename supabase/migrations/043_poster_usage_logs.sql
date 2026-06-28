-- 043: master-only audit log for poster tool usage.
--
-- This table is separate from poster_generations_log, which is used for
-- generation/rate-limit tracking. It stores only audit metadata, not prompts
-- or generated image data.

CREATE TABLE IF NOT EXISTS public.poster_usage_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  user_name       text,
  user_email      text,
  user_role       text,
  action          text NOT NULL CHECK (
    action IN ('build_prompt', 'generate_image', 'revise_image')
  ),
  poster_title    text CHECK (poster_title IS NULL OR length(poster_title) <= 100),
  poster_category text,
  poster_ratio    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poster_usage_logs_created_at
  ON public.poster_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_poster_usage_logs_user_time
  ON public.poster_usage_logs (user_id, created_at DESC);

ALTER TABLE public.poster_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can write own poster usage logs" ON public.poster_usage_logs;
CREATE POLICY "Staff can write own poster usage logs" ON public.poster_usage_logs
  FOR INSERT WITH CHECK (
    public.is_staff()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Master can read poster usage logs" ON public.poster_usage_logs;
CREATE POLICY "Master can read poster usage logs" ON public.poster_usage_logs
  FOR SELECT USING (public.is_master());
