-- 주일오후 찬양예배 → 목장모임 대체 토글.
-- ON 인 주(主)에는 페이지 2의 좌상단(주일오후) 영역이 "목장모임" 이미지/제목으로 대체된다.
ALTER TABLE public.weeklies
  ADD COLUMN IF NOT EXISTS afternoon_mokjang_mode boolean NOT NULL DEFAULT false;
