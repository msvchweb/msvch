-- 설교 영상 누적 저장 테이블.
-- YouTube 업로드 플레이리스트에서 매일 한 번 동기화 (cron) → 한 번 들어온 영상은 영구 보존.
-- 표시는 이 테이블에서만 읽음. YouTube API 는 sync 경로에서만 사용.
CREATE TABLE IF NOT EXISTS public.sermon_videos (
  video_id     text PRIMARY KEY,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  thumbnail    text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL,
  -- sunday / wednesday / friday / dawn / praise / all (sermon-category.ts 와 동기)
  category     text NOT NULL DEFAULT 'all',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sermon_videos_published_at
  ON public.sermon_videos (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_sermon_videos_category
  ON public.sermon_videos (category);

ALTER TABLE public.sermon_videos ENABLE ROW LEVEL SECURITY;

-- 공개 읽기. 쓰기는 service role(cron) 만.
CREATE POLICY "sermon_videos public read"
  ON public.sermon_videos
  FOR SELECT
  USING (true);
