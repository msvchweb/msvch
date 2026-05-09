-- 034: events 테이블에 AI 추출 추적 컬럼 추가
--
-- 목적:
--   - "교회소식 → 일정 AI 자동 추출" (PLAN.md 2026-05-09) 의 결과 추적.
--   - 어느 주보로부터 뽑혔는지, news[] 의 몇 번째 항목인지 보관해
--     운영 가시성 확보 + 추후 중복 검출 정책 추가 시 기반.
--
-- 정책:
--   - 모두 nullable. 기존 INSERT 경로(수동 입력 캘린더)는 NULL 유지.
--   - extracted_by_ai 는 boolean DEFAULT false — 기존 row 도 자연스럽게 false.
--   - source_weekly_id ON DELETE SET NULL — 주보 삭제해도 일정은 살아남음.
--   - 부분 인덱스로 AI 추출 일정만 빠르게 조회.
--
-- RLS / 트리거 무변경 — 022 의 정책·트리거 그대로 유지.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source_weekly_id uuid
    REFERENCES public.weeklies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_news_index integer
    CHECK (source_news_index IS NULL OR (source_news_index >= 0 AND source_news_index < 50)),
  ADD COLUMN IF NOT EXISTS extracted_by_ai boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_source_weekly
  ON public.events (source_weekly_id)
  WHERE source_weekly_id IS NOT NULL;

COMMENT ON COLUMN public.events.source_weekly_id
  IS 'AI 추출 시 어느 weeklies row 에서 뽑혔는지. 수동 입력은 NULL.';
COMMENT ON COLUMN public.events.source_news_index
  IS 'AI 추출 시 weeklies.news 의 몇 번째 항목(0-based). 수동 입력은 NULL.';
COMMENT ON COLUMN public.events.extracted_by_ai
  IS 'true = AI 추출 후 staff 검수를 거쳐 INSERT 된 일정. false = 수동 입력 또는 cron.';
