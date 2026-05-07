-- 레거시 주보 필드 제거: hymn_number, scripture (최상위)
-- 인쇄용 주보(BulletinFront/Back)는 worship_items 등 신규 필드를 사용하며,
-- 공개 웹 주보 또한 동일한 신규 필드 기반으로 렌더링하도록 정리되었다.
ALTER TABLE public.weeklies
  DROP COLUMN IF EXISTS hymn_number,
  DROP COLUMN IF EXISTS scripture;
