-- 041: 새가족 등록 — 간편 등록(QR) 대응 필드 추가 및 제약 완화
--
-- 추가 필드: instagram_id, age_group
-- 제약 완화: 기존 필수 필드들을 선택 사항으로 변경하여 간편 등록 폼 지원

ALTER TABLE public.new_family_registrations
  -- 필드 추가
  ADD COLUMN IF NOT EXISTS instagram_id text,
  ADD COLUMN IF NOT EXISTS age_group text,
  -- 기존 제약 완화 (NOT NULL 제거)
  ALTER COLUMN faith_status DROP NOT NULL,
  ALTER COLUMN birth DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN church_history DROP NOT NULL;

-- 인덱스 추가 (조회 성능)
CREATE INDEX IF NOT EXISTS idx_new_family_registrations_instagram_id
  ON public.new_family_registrations (instagram_id);

-- 기존 CHECK 제약 조건 수정 (phone 길이 제약 등은 필요 시 완화)
-- 기존 phone 제약: length(phone) BETWEEN 9 AND 20
-- Instagram ID 가 들어올 경우 phone 이 없을 수 있으므로.
-- 하지만 기존 CHECK 제약은 컬럼이 NULL 이면 통과하므로 그대로 두어도 됨.
