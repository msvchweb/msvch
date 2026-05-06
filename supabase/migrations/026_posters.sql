-- 026: AI 포스터 생성 — Gemini 이미지 모델 + 클라이언트 텍스트 오버레이 합성
--
-- 설계 (docs/poster-generation-strategy.md):
--   - posters                  : 생성된 포스터 메타 + 최종 PNG URL
--   - poster_generations_log   : 사용자별 일 20회 rate-limit 추적
--   - storage 버킷 'poster-images' (public read / staff write)
--
-- 권한:
--   - posters       SELECT/INSERT/UPDATE/DELETE — staff 이상 (UPDATE/DELETE 는 본인 또는 admin/master)
--   - log           본인 INSERT/SELECT (rate-limit 자체 검증), admin/master 만 전체 SELECT
--
-- linked_*_id 는 Phase 2 에서 events/notices 와 양방향 연결할 때 채워진다. Phase 1 에선 항상 NULL.
-- 30 일 이상 어떤 entity 에도 연결 안 된 row 는 cron 이 정리한다.

------------------------------------------------------------------------
-- 1. posters 테이블
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,

  category text NOT NULL
    CHECK (category IN ('event','welcome','group','notice','custom')),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  body_text text CHECK (body_text IS NULL OR length(body_text) <= 500),
  prompt_used text NOT NULL,
  ratio text NOT NULL CHECK (ratio IN ('1:1','9:16','a4')),

  ai_image_url    text NOT NULL,
  final_image_url text NOT NULL,

  linked_event_id  uuid REFERENCES public.events(id)  ON DELETE SET NULL,
  linked_notice_id uuid REFERENCES public.notices(id) ON DELETE SET NULL,

  cost_cents int
);

CREATE INDEX IF NOT EXISTS idx_posters_created_at
  ON public.posters (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posters_created_by
  ON public.posters (created_by, created_at DESC);

------------------------------------------------------------------------
-- 2. updated_at 트리거 — 기존 boards_set_updated_at 재사용
------------------------------------------------------------------------
DROP TRIGGER IF EXISTS posters_updated_at ON public.posters;
CREATE TRIGGER posters_updated_at
  BEFORE UPDATE ON public.posters
  FOR EACH ROW EXECUTE FUNCTION public.boards_set_updated_at();

------------------------------------------------------------------------
-- 3. RLS — posters
------------------------------------------------------------------------
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
CREATE POLICY "Owner or admin can update posters" ON public.posters
  FOR UPDATE USING (
    public.is_admin_or_master() OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Owner or admin can delete posters" ON public.posters;
CREATE POLICY "Owner or admin can delete posters" ON public.posters
  FOR DELETE USING (
    public.is_admin_or_master() OR created_by = auth.uid()
  );

------------------------------------------------------------------------
-- 4. poster_generations_log — 사용자별 rate-limit 추적
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poster_generations_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variants_count  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
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

------------------------------------------------------------------------
-- 5. Storage 버킷 — poster-images
------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'poster-images', 'poster-images', true, 10485760,  -- 10 MB
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 누구나 읽기 (URL 알면)
DROP POLICY IF EXISTS "Public read poster-images" ON storage.objects;
CREATE POLICY "Public read poster-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'poster-images');

-- staff 만 업로드/수정/삭제
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
