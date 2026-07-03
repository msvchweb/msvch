-- 044: 명비 기도인 신청 폼 — 공개 페이지에서 신청, 관리자 화면에서 확인

CREATE TABLE IF NOT EXISTS public.myeongbi_prayer_applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  phone         text NOT NULL CHECK (length(phone) BETWEEN 1 AND 30),
  affiliation   text NOT NULL CHECK (length(affiliation) BETWEEN 1 AND 100),
  available     boolean NOT NULL CHECK (available = true),
  message       text CHECK (message IS NULL OR length(message) <= 1000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_myeongbi_prayer_applications_created_at
  ON public.myeongbi_prayer_applications (created_at DESC);

ALTER TABLE public.myeongbi_prayer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit myeongbi prayer application"
  ON public.myeongbi_prayer_applications;
CREATE POLICY "Anyone can submit myeongbi prayer application"
  ON public.myeongbi_prayer_applications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can read myeongbi prayer applications"
  ON public.myeongbi_prayer_applications;
CREATE POLICY "Staff can read myeongbi prayer applications"
  ON public.myeongbi_prayer_applications
  FOR SELECT USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.myeongbi_prayer_applications_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS myeongbi_prayer_applications_updated_at
  ON public.myeongbi_prayer_applications;
CREATE TRIGGER myeongbi_prayer_applications_updated_at
  BEFORE UPDATE ON public.myeongbi_prayer_applications
  FOR EACH ROW EXECUTE FUNCTION public.myeongbi_prayer_applications_set_updated_at();
