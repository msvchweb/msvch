-- 023: 알림톡 인프라 — 구독자 명단 + 발송 추적
--
-- 설계:
--   - event_subscribers : 일정 알림을 받을 수신자 명단. admin/master 가 직접 관리.
--                         (회원이 직접 opt-in 하는 흐름은 v2)
--   - alimtalk_sent     : 발송 추적 — 중복 발송 방지 + 운영 가시성
--   - 두 테이블 모두 service_role / staff 만 접근
--   - 카카오 비즈 승인 전에는 cron 이 noop, alimtalk_sent 도 빈 상태 유지

-- ─────────────────────────────────────────────────────────
--  event_subscribers — 알림 수신자 명단
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_subscribers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  -- 한국 휴대폰: 010-XXXX-XXXX 또는 +82-... 형식 모두 허용. 앱 레벨에서 정규화.
  phone         text NOT NULL CHECK (length(phone) BETWEEN 10 AND 20),
  is_active     boolean NOT NULL DEFAULT true,
  notify_d1     boolean NOT NULL DEFAULT true,   -- 하루 전 알림
  notify_d_day  boolean NOT NULL DEFAULT false,  -- 당일 알림
  note          text CHECK (note IS NULL OR length(note) <= 500),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS idx_event_subscribers_active ON public.event_subscribers (is_active) WHERE is_active = true;

ALTER TABLE public.event_subscribers ENABLE ROW LEVEL SECURITY;

-- staff 는 SELECT 가능 (관리 페이지)
DROP POLICY IF EXISTS "Staff can read subscribers" ON public.event_subscribers;
CREATE POLICY "Staff can read subscribers" ON public.event_subscribers
  FOR SELECT USING (public.is_staff());

-- INSERT/UPDATE/DELETE 는 admin/master 만
DROP POLICY IF EXISTS "Admin/master can manage subscribers" ON public.event_subscribers;
CREATE POLICY "Admin/master can manage subscribers" ON public.event_subscribers
  FOR ALL USING (public.is_admin_or_master())
  WITH CHECK (public.is_admin_or_master());

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.event_subscribers_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_subscribers_updated_at ON public.event_subscribers;
CREATE TRIGGER event_subscribers_updated_at
  BEFORE UPDATE ON public.event_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.event_subscribers_set_updated_at();


-- ─────────────────────────────────────────────────────────
--  alimtalk_sent — 발송 추적 (중복 발송 방지)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alimtalk_sent (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template     text NOT NULL,        -- 카카오 비즈 템플릿 코드 (예: 'event_d1')
  event_id     uuid REFERENCES public.events(id) ON DELETE CASCADE,
  recipient    text NOT NULL,        -- 정규화된 전화번호
  sent_at      timestamptz DEFAULT now(),
  status       text NOT NULL CHECK (status IN ('sent', 'failed', 'noop')),
  error        text,
  -- 같은 일정에 대해 같은 템플릿/수신자 조합은 한 번만 발송
  UNIQUE (template, event_id, recipient)
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_sent_event ON public.alimtalk_sent (event_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_sent_at ON public.alimtalk_sent (sent_at DESC);

ALTER TABLE public.alimtalk_sent ENABLE ROW LEVEL SECURITY;

-- staff SELECT (운영 가시성)
DROP POLICY IF EXISTS "Staff can read alimtalk log" ON public.alimtalk_sent;
CREATE POLICY "Staff can read alimtalk log" ON public.alimtalk_sent
  FOR SELECT USING (public.is_staff());

-- INSERT/UPDATE/DELETE 는 정책 없음 — service_role (cron 라우트) 만 가능
