-- 013: 소그룹목장 year 컬럼 제거
-- 사용자 요청으로 연도 관리 제거. 목장 테이블은 id/name/sub/active/updated_at 만 유지
ALTER TABLE public.mokjang_entries DROP COLUMN IF EXISTS year;
