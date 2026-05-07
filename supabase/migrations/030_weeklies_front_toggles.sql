-- 페이지 4(교회소식 영역) 섹션별 표시 토글.
-- bibleReading / newMembers / mealDuty / volunteerNote — 각 섹션을 그 주에만 끄거나 켤 수 있다.
-- OFF 면 주보 렌더에서 행 제거 + 번호 자동 재계산.
ALTER TABLE public.weeklies
  ADD COLUMN IF NOT EXISTS front_toggles jsonb NOT NULL
  DEFAULT '{"bibleReading":true,"newMembers":true,"mealDuty":true,"volunteerNote":true}'::jsonb;
