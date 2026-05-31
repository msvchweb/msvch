-- 039: 미디어선교부 전용 게시판 (HWPX 회의록 AI 자동 변환)
--
-- 설계: _workspace/01_planner_plan.md — 신규 테이블 없음, 025 boards 재사용.
--   - boards.is_media_dept boolean : 전용 게시판 식별 플래그 (방안 A — DB 가 진실의 원천)
--   - 부분 유니크 인덱스       : 전용 게시판 최대 1개 보장
--   - board_posts.content 상한 : 10000 → 30000 (표/이미지 마커 포함 회의록 대응)
--   - 전용 게시판 지정         : title 매칭 1회성 UPDATE (board id 하드코딩 X, 환경 독립)
--
-- RLS·트리거·새 테이블 변경 없음. 전용 게시판도 일반 게시판과 동일한 멤버십 게이트 유지.
-- 재실행 안전(idempotent).

------------------------------------------------------------------------
-- 1. 전용 board 식별 플래그 (방안 A)
------------------------------------------------------------------------
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS is_media_dept boolean NOT NULL DEFAULT false;

------------------------------------------------------------------------
-- 2. 전용 board 는 최대 1개 (DB 보장)
------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_one_media_dept
  ON public.boards (is_media_dept) WHERE is_media_dept = true;

------------------------------------------------------------------------
-- 3. 회의록 본문 길이 상한 완화 (표/이미지 마커 포함 대응) — 기존 글 영향 없음
------------------------------------------------------------------------
ALTER TABLE public.board_posts DROP CONSTRAINT IF EXISTS board_posts_content_check;
ALTER TABLE public.board_posts
  ADD CONSTRAINT board_posts_content_check CHECK (length(content) BETWEEN 1 AND 30000);

------------------------------------------------------------------------
-- 4. 전용 board 지정 (O1 확정) — 기존 "미디어선교부게시판" row 를 전환.
--    board id 하드코딩 X. title 매칭(띄어쓰기 변형 포괄). 매칭 0건이면 0행 갱신 = 무동작(에러 없음).
--    이미 다른 row 가 is_media_dept=true 이면 NOT EXISTS 가드로 재실행해도 무동작(idempotent).
--    title 매칭이 2건 이상이어도 부분 유니크 인덱스가 두 번째를 거부 → 안전.
------------------------------------------------------------------------
UPDATE public.boards
SET is_media_dept = true
WHERE replace(title, ' ', '') = '미디어선교부게시판'
  AND NOT EXISTS (
    SELECT 1 FROM public.boards b2 WHERE b2.is_media_dept = true
  );

-- 적용 직후 확인 (운영자 수동):
--   SELECT count(*) FROM public.boards WHERE is_media_dept = true;   -- 기대값 1
--   0 이면 실제 게시판 title 확인 후 1회성 수동 UPDATE 필요 (Risk R8).
