-- 주보 사진 → 캘린더 주간 자동 등록 (실패 시 3시간마다 재시도)
--
-- 설계: _workspace/01_planner_plan.md (2026-09-14)
--   - weekly_event_sync_runs : 토요일 22:00 KST 실행을 주당 한 번만 만들기 위한 잠금
--   - weekly_event_sync_jobs : 주보 1건당 작업 1건 — 상태·재시도·결과 기록
--   - 두 테이블 모두 admin·master SELECT 만 허용 (037 권한 기준과 동일). INSERT/UPDATE/DELETE 정책 없음
--     → service_role (cron 라우트 /api/admin/cron/weekly-event-sync) 만 쓰기 가능
--   - events 컬럼 변경 없음. extracted_by_ai 코멘트 문구만 갱신
--
-- 롤백:
--   DROP TABLE IF EXISTS public.weekly_event_sync_jobs;
--   DROP TABLE IF EXISTS public.weekly_event_sync_runs;
--   DROP FUNCTION IF EXISTS public.weekly_event_sync_jobs_set_updated_at();
--   COMMENT ON COLUMN public.events.extracted_by_ai
--     IS 'true = AI 추출 후 staff 검수를 거쳐 INSERT 된 일정. false = 수동 입력 또는 cron.';
--
-- 재실행 안전(idempotent).

-- ─────────────────────────────────────────────────────────
--  weekly_event_sync_runs — 주간 실행 기록
-- ─────────────────────────────────────────────────────────

-- 토요일 22:00 KST 실행을 주당 한 번만 만들기 위한 잠금
CREATE TABLE IF NOT EXISTS public.weekly_event_sync_runs (
  run_week    date PRIMARY KEY,               -- 해당 주 토요일 (KST 날짜)
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_event_sync_runs ENABLE ROW LEVEL SECURITY;

-- admin·master SELECT (운영 가시성, 037 권한 기준)
DROP POLICY IF EXISTS "Admin can read weekly event sync runs" ON public.weekly_event_sync_runs;
CREATE POLICY "Admin can read weekly event sync runs" ON public.weekly_event_sync_runs
  FOR SELECT USING (public.is_admin_or_master());

-- INSERT/UPDATE/DELETE 는 정책 없음 — service_role (cron 라우트) 만 가능


-- ─────────────────────────────────────────────────────────
--  weekly_event_sync_jobs — 주보 1건당 작업 1건
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.weekly_event_sync_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_week           date NOT NULL REFERENCES public.weekly_event_sync_runs(run_week) ON DELETE CASCADE,
  weekly_id          uuid NOT NULL REFERENCES public.weeklies(id) ON DELETE CASCADE,
  photos_hash        text NOT NULL,           -- sha256(photo_images.join("\n"))
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','running','succeeded','retry_scheduled','failed')),
  attempts           integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_retry_at      timestamptz,
  started_at         timestamptz,
  finished_at        timestamptz,
  error_kind         text CHECK (error_kind IS NULL OR error_kind IN
                     ('transient','invalid_response','photo_fetch','config','superseded','expired')),
  last_error         text CHECK (last_error IS NULL OR length(last_error) <= 2000),
  model              text,
  bulletin_date      date,                    -- 사진에서 읽은 인쇄 발행일
  anchor_date        date,                    -- 실제로 쓴 기준 날짜
  date_mismatch      boolean NOT NULL DEFAULT false,
  inserted_event_ids uuid[] NOT NULL DEFAULT '{}',
  skipped            jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ "title", "date", "reason" }]
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (weekly_id, photos_hash)
);

CREATE INDEX IF NOT EXISTS idx_weekly_event_sync_jobs_due
  ON public.weekly_event_sync_jobs (status, next_retry_at);

ALTER TABLE public.weekly_event_sync_jobs ENABLE ROW LEVEL SECURITY;

-- admin·master SELECT (운영 가시성, 037 권한 기준)
DROP POLICY IF EXISTS "Admin can read weekly event sync jobs" ON public.weekly_event_sync_jobs;
CREATE POLICY "Admin can read weekly event sync jobs" ON public.weekly_event_sync_jobs
  FOR SELECT USING (public.is_admin_or_master());

-- INSERT/UPDATE/DELETE 는 정책 없음 — service_role (cron 라우트) 만 가능

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.weekly_event_sync_jobs_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS weekly_event_sync_jobs_updated_at ON public.weekly_event_sync_jobs;
CREATE TRIGGER weekly_event_sync_jobs_updated_at
  BEFORE UPDATE ON public.weekly_event_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.weekly_event_sync_jobs_set_updated_at();


-- ─────────────────────────────────────────────────────────
--  events.extracted_by_ai — 코멘트만 갱신 (컬럼 변경 없음)
-- ─────────────────────────────────────────────────────────

COMMENT ON COLUMN public.events.extracted_by_ai
  IS 'true = AI가 추출해 INSERT 한 일정 (검수 모달 또는 주간 자동 동기화). false = 수동 입력.';
