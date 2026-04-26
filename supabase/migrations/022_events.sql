-- 022: 자체 캘린더 — Google Calendar 대체
--
-- 설계:
--   - 단일 날짜 일정 (v1). end_date / rrule 컬럼은 미리 두지만 v1 미사용.
--   - start_time / end_time 모두 nullable.
--     · start_time NULL = 종일 일정
--     · end_time   NULL = 종료시간 미정/오픈엔드 (가장 흔한 입력 패턴)
--   - notify boolean — 알림톡 발송 대상 여부 (admin 이 일정 등록 시 체크)
--   - 작성자 추적은 020 의 record_content_author() 트리거 재사용 ('event' 추가).
--   - 삭제 권한은 021 패턴 — 작성자 본인 OR admin OR master.

CREATE TABLE IF NOT EXISTS public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 5000),
  location    text CHECK (location IS NULL OR length(location) <= 200),
  date        date NOT NULL,
  start_time  time,
  end_time    time,
  end_date    date,                   -- v2 다일 일정용 (v1 미사용)
  rrule       text,                   -- v2 반복 일정용 (v1 미사용)
  notify      boolean NOT NULL DEFAULT false,  -- 알림톡 발송 대상
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT events_end_date_after_start CHECK (
    end_date IS NULL OR end_date >= date
  ),
  CONSTRAINT events_end_time_after_start CHECK (
    end_time IS NULL OR start_time IS NULL OR end_time > start_time
  )
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (date);
CREATE INDEX IF NOT EXISTS idx_events_notify ON public.events (notify, date) WHERE notify = true;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- SELECT: 누구나 (캘린더는 공개)
DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
CREATE POLICY "Anyone can read events" ON public.events
  FOR SELECT USING (true);

-- INSERT/UPDATE: staff
DROP POLICY IF EXISTS "Staff can insert events" ON public.events;
CREATE POLICY "Staff can insert events" ON public.events
  FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can update events" ON public.events;
CREATE POLICY "Staff can update events" ON public.events
  FOR UPDATE USING (public.is_staff());

-- DELETE: 작성자 OR admin/master (021 패턴)
DROP POLICY IF EXISTS "Author/admin/master can delete events" ON public.events;
CREATE POLICY "Author/admin/master can delete events" ON public.events
  FOR DELETE USING (
    public.is_admin_or_master()
    OR public.is_content_author('event', id)
  );

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.events_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_set_updated_at();

-- 작성자 추적 (020 재사용)
-- content_authors CHECK 제약에 'event' 추가
ALTER TABLE public.content_authors DROP CONSTRAINT IF EXISTS content_authors_content_type_check;
ALTER TABLE public.content_authors ADD CONSTRAINT content_authors_content_type_check
  CHECK (content_type IN ('notice', 'weekly', 'gallery_album', 'event'));

DROP TRIGGER IF EXISTS record_event_author ON public.events;
CREATE TRIGGER record_event_author
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.record_content_author('event');
