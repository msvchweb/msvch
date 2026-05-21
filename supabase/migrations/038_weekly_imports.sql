-- 038: 주보 HWP/HWPX 자동 채우기 — 업로드 추적 + 변환/파싱 상태 + 7일 보존
--
-- 배경:
--   전도사가 한컴에서 작성한 .hwp / .hwpx 주보를 업로드하면
--   - .hwpx: 서버에서 ZIP+XML 파싱 → 표/문단 추출 → Gemini 가 WeeklyContentInput 부분 구조화
--   - .hwp : GitHub Actions(LibreOffice headless) 가 .hwpx 로 변환 후 위 흐름 합류
--   결과는 검수 모달에서 사용자가 확인한 뒤 WeeklyForm 폼에 patch (자동 저장 X — Q2=A).
--
--   업로드 원본은 7일 후 cleanup cron 이 Storage 와 DB 행을 함께 삭제 (Q4=B).
--   마스터(올해 표어 등)와 다른 값은 warnings 만 — DB 변경 안 함 (Q3=B).
--
-- RLS:
--   037 매트릭스에 맞춰 admin/master 만 SELECT/INSERT/UPDATE. DELETE 는 admin/master 전용.
--   service_role 은 RLS 우회 — cron 라우트(cleanup) 가 이를 사용.

CREATE TABLE IF NOT EXISTS public.weekly_imports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name             text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 300),
  file_path             text NOT NULL CHECK (length(file_path) BETWEEN 1 AND 500),
  source_format         text NOT NULL CHECK (source_format IN ('hwp', 'hwpx')),
  status                text NOT NULL DEFAULT 'uploaded'
                          CHECK (status IN ('uploaded', 'converting', 'parsing', 'parsed', 'failed')),
  error_message         text CHECK (error_message IS NULL OR length(error_message) <= 2000),
  parsed_json           jsonb,
  raw_text_excerpt      text CHECK (raw_text_excerpt IS NULL OR length(raw_text_excerpt) <= 10000),
  applied_to_weekly_id  uuid REFERENCES public.weeklies(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_imports_created_at
  ON public.weekly_imports (created_at);

CREATE INDEX IF NOT EXISTS idx_weekly_imports_status
  ON public.weekly_imports (status);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.touch_weekly_imports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS weekly_imports_updated_at ON public.weekly_imports;
CREATE TRIGGER weekly_imports_updated_at
  BEFORE UPDATE ON public.weekly_imports
  FOR EACH ROW EXECUTE FUNCTION public.touch_weekly_imports_updated_at();

ALTER TABLE public.weekly_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read weekly_imports" ON public.weekly_imports;
CREATE POLICY "Admin can read weekly_imports" ON public.weekly_imports
  FOR SELECT USING (public.is_admin_or_master());

DROP POLICY IF EXISTS "Admin can insert weekly_imports" ON public.weekly_imports;
CREATE POLICY "Admin can insert weekly_imports" ON public.weekly_imports
  FOR INSERT WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Admin can update weekly_imports" ON public.weekly_imports;
CREATE POLICY "Admin can update weekly_imports" ON public.weekly_imports
  FOR UPDATE USING (public.is_admin_or_master())
  WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Admin can delete weekly_imports" ON public.weekly_imports;
CREATE POLICY "Admin can delete weekly_imports" ON public.weekly_imports
  FOR DELETE USING (public.is_admin_or_master());

-- 참고:
--   원본 파일은 기존 'weeklies' Storage 버킷의 imports/{id}.{hwp|hwpx} 경로에 저장된다.
--   037 의 storage 'weeklies' INSERT/DELETE 정책 (admin/master) 이 그대로 적용된다.
--   별도 storage 정책 변경 없음.
