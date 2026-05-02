-- 024: 새가족 등록 폼 — 공개 페이지에서 anon 이 INSERT, 관리자만 SELECT/UPDATE/DELETE
--
-- 설계:
--   - chat_inquiries(006) 와 동일한 패턴: 누구나 INSERT, staff 만 SELECT.
--   - 개인정보 동의(consent) 시각을 컬럼으로 보관 — 향후 보존 기간 정책에 활용.
--   - 처리 상태(status) 로 관리자 워크플로우 지원: new → contacted → assigned → done.

CREATE TABLE IF NOT EXISTS public.new_family_registrations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 1. 방문 경로 (복수 선택)
  visit_paths             text[] NOT NULL DEFAULT '{}',
  visit_paths_etc         text,
  -- 2. 예수님 영접 여부
  faith_status            text NOT NULL CHECK (faith_status IN ('accepted','not_yet','unsure')),
  -- 3-7. 인적사항
  name                    text NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  gender                  text NOT NULL CHECK (gender IN ('male','female')),
  birth                   text NOT NULL CHECK (length(birth) BETWEEN 1 AND 40),
  phone                   text NOT NULL CHECK (length(phone) BETWEEN 9 AND 20),
  region                  text CHECK (region IS NULL OR length(region) <= 100),
  -- 8. 신앙생활 여부
  church_history          text NOT NULL CHECK (church_history IN (
    'never','attended_no_baptism','baptized_inactive','baptized_active','etc'
  )),
  church_history_etc      text,
  -- 9. 자유 메시지
  message                 text CHECK (message IS NULL OR length(message) <= 2000),
  -- 개인정보 동의
  privacy_consent         boolean NOT NULL CHECK (privacy_consent = true),
  privacy_consented_at    timestamptz NOT NULL DEFAULT now(),
  -- 처리 상태
  status                  text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','assigned','done')),
  admin_note              text CHECK (admin_note IS NULL OR length(admin_note) <= 2000),
  -- 자동 컬럼
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_new_family_registrations_status
  ON public.new_family_registrations (status);

CREATE INDEX IF NOT EXISTS idx_new_family_registrations_created_at
  ON public.new_family_registrations (created_at DESC);

ALTER TABLE public.new_family_registrations ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT (공개 폼). 단, privacy_consent = true 강제는 CHECK 제약으로.
DROP POLICY IF EXISTS "Anyone can submit new family" ON public.new_family_registrations;
CREATE POLICY "Anyone can submit new family" ON public.new_family_registrations
  FOR INSERT WITH CHECK (true);

-- staff 만 SELECT
DROP POLICY IF EXISTS "Staff can read new family" ON public.new_family_registrations;
CREATE POLICY "Staff can read new family" ON public.new_family_registrations
  FOR SELECT USING (public.is_staff());

-- staff 만 UPDATE (status, admin_note 변경)
DROP POLICY IF EXISTS "Staff can update new family" ON public.new_family_registrations;
CREATE POLICY "Staff can update new family" ON public.new_family_registrations
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

-- admin/master 만 DELETE
DROP POLICY IF EXISTS "Admin can delete new family" ON public.new_family_registrations;
CREATE POLICY "Admin can delete new family" ON public.new_family_registrations
  FOR DELETE USING (public.is_admin_or_master());

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.new_family_registrations_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS new_family_registrations_updated_at
  ON public.new_family_registrations;
CREATE TRIGGER new_family_registrations_updated_at
  BEFORE UPDATE ON public.new_family_registrations
  FOR EACH ROW EXECUTE FUNCTION public.new_family_registrations_set_updated_at();
