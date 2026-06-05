-- 040: 이미지형 주보 (사진 업로드 → 공개 상세뷰에 그대로 표시)
--
-- 설계: _workspace/01_planner_plan.md — 신규 테이블/RLS/정책 없음.
--   - weeklies.photo_images text[] : 업로드한 사진들의 weeklies 버킷 public URL 배열
--   - default '{}' 로 기존 행 자동 백필 → 기존 주보 무영향
--   - 배열이 비어있지 않으면 공개 상세뷰가 구조화 렌더링 대신 사진을 표시 (클라이언트 분기)
--
-- 기존 weeklies RLS(037: admin/master INSERT·UPDATE, anyone SELECT published) 그대로 상속.
-- weeklies Storage 버킷도 003(public)·037(admin/master write) 그대로 — 추가 정책 불필요.
-- 재실행 안전(idempotent).

ALTER TABLE public.weeklies
  ADD COLUMN IF NOT EXISTS photo_images text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.weeklies.photo_images IS
  '이미지형 주보: weeklies 버킷 public URL 배열. 비어있지 않으면 공개 상세뷰에서 구조화 렌더링 대신 사진을 표시.';
