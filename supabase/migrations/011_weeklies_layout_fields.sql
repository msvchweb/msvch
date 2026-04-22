-- 011: 주보 4페이지 레이아웃에 필요한 매주-변경 필드 확장
-- 기존 servants_text / offering_list_text / sogroup_text / announcements 등 레거시 컬럼은 유지(드롭은 추후 마이그레이션).

ALTER TABLE public.weeklies
  -- 페이지1 교회소식 news[] = { title, items[] }, MAX 9
  ADD COLUMN IF NOT EXISTS news                jsonb DEFAULT '[]'::jsonb,
  -- 9. 모임표 meetings[] = { group, when, place }, MAX 6
  ADD COLUMN IF NOT EXISTS meetings            jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS north_korea_note    text,
  ADD COLUMN IF NOT EXISTS bible_reading       text,
  -- 11. 지난주 등록 새가족 MAX 4
  ADD COLUMN IF NOT EXISTS new_members         jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meal_duty_note      text,
  ADD COLUMN IF NOT EXISTS volunteer_note      text,
  -- 주일예배 순서
  ADD COLUMN IF NOT EXISTS worship_leader      text,
  ADD COLUMN IF NOT EXISTS worship_items       jsonb DEFAULT '[]'::jsonb,
  -- 금주 암송말씀 { ref, text }
  ADD COLUMN IF NOT EXISTS memorize_verse      jsonb DEFAULT '{"ref":"","text":""}'::jsonb,
  -- 다음주 기도 (1부/2부/3부 이름 배열, MAX 3)
  ADD COLUMN IF NOT EXISTS next_week_prayer    jsonb DEFAULT '[]'::jsonb,
  -- 안내위원 { part, indoor, outdoor } MAX 3
  ADD COLUMN IF NOT EXISTS guide_committee     jsonb DEFAULT '[]'::jsonb,
  -- 향기로운 예물 { label, names } MAX 11
  ADD COLUMN IF NOT EXISTS offerings           jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS week_total          text,
  ADD COLUMN IF NOT EXISTS cumulative_total    text;

-- 주석: 이 필드들은 BulletinFront.tsx / BulletinBack.tsx 의 FrontData / BulletinBackData 타입과 1:1 대응한다.
-- 배열 상한은 레이아웃 고정을 위해 각 컴포넌트에서 slice(0,N) 으로 강제 중이며,
-- Zod 스키마 (src/lib/validation.ts) WeeklyContentSchema 에서 동일 상한을 max(N) 으로 강제한다.
