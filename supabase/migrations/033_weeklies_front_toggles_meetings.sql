-- front_toggles 에 meetings 키 추가 (페이지 4 모임 안내 섹션 표시 토글).
-- 신규 row 의 default 갱신 + 기존 row 에 meetings:true 백필.
ALTER TABLE public.weeklies
  ALTER COLUMN front_toggles SET DEFAULT
  '{"meetings":true,"bibleReading":true,"newMembers":true,"mealDuty":true,"volunteerNote":true}'::jsonb;

UPDATE public.weeklies
SET front_toggles = front_toggles || '{"meetings":true}'::jsonb
WHERE NOT (front_toggles ? 'meetings');
