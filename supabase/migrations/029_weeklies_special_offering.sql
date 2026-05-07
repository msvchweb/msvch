-- 향기로운 예물의 부활감사 자리(인덱스 3)를 토글/라벨 변경 가능한 "특별헌금" 슬롯으로 분리.
-- enabled=false 면 주보 렌더 시 해당 행 제거. label 은 부활감사/추수감사/성탄감사 등 자유 변경.
ALTER TABLE public.weeklies
  ADD COLUMN IF NOT EXISTS special_offering jsonb NOT NULL
  DEFAULT '{"enabled":false,"label":"부활감사"}'::jsonb;
