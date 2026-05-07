-- 주보 "기타" 탭 삭제: 한때 사용된 자유 형식 입력란들을 완전히 제거.
-- prayer_items: 마스터(community_prayers)로 완전 대체
-- announcements / servants_text / offering_list_text / sogroup_text: 어디에서도 렌더링되지 않던 레거시
ALTER TABLE public.weeklies
  DROP COLUMN IF EXISTS prayer_items,
  DROP COLUMN IF EXISTS announcements,
  DROP COLUMN IF EXISTS servants_text,
  DROP COLUMN IF EXISTS offering_list_text,
  DROP COLUMN IF EXISTS sogroup_text;
