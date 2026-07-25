-- 온라인 헌금 계좌 — church_settings 의 offering_account 키.
-- DDL 없음: 테이블·정책·권한은 012_bulletin_master_tables.sql 의 것을 그대로 쓴다.
-- 지금까지 BulletinBack.tsx 에 문자열로 박혀 있던 값을 관리자가 편집할 수 있게 옮긴다.
insert into public.church_settings (key, value)
values (
  'offering_account',
  '{"bank":"농협","number":"355-0068-1115-73","holder":"명성비전교회","note":"입금자명에 이름과 헌금종류를 함께 적어주세요. 예) 박야곱십일조"}'::jsonb
)
on conflict (key) do nothing;
