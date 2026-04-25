-- 020: 컨텐츠 작성자 추적 — admin 내부에서만 노출, 공개 응답에는 절대 포함 안 됨
--
-- 설계:
--   별도 shadow 테이블 content_authors 에 (content_type, content_id, author_id, author_name)
--   를 기록한다. notices/weeklies/gallery_albums 같은 base 테이블에는 author 컬럼을 추가하지
--   않으므로, 공개 페이지의 select("*") 응답에는 작성자 정보가 절대 노출되지 않는다.
--
--   author_name 은 작성 시점의 닉네임 스냅샷. 추후 staff 가 닉네임을 바꿔도 과거 기록 유지.
--   RLS: SELECT 는 staff 만. INSERT 는 트리거(SECURITY DEFINER) 만 가능.
--
-- 추적 대상:
--   - notice           : 공지사항
--   - weekly           : 주보
--   - gallery_album    : 갤러리 앨범
--
--   gallery_images / shorts / 마스터 테이블은 추적 안 함 (각각 자동 생성, 또는 단건 config 성격).

CREATE TABLE IF NOT EXISTS public.content_authors (
  content_type text NOT NULL CHECK (content_type IN ('notice', 'weekly', 'gallery_album')),
  content_id   uuid NOT NULL,
  author_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name  text,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (content_type, content_id)
);

ALTER TABLE public.content_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view content authors" ON public.content_authors;
CREATE POLICY "Staff can view content authors" ON public.content_authors
  FOR SELECT USING (public.is_staff());

-- INSERT 정책 없음 — 아래 SECURITY DEFINER 트리거를 통해서만 삽입.

CREATE OR REPLACE FUNCTION public.record_content_author()
RETURNS trigger AS $$
DECLARE
  uid uuid;
  uname text;
BEGIN
  uid := auth.uid();
  -- service_role / SQL Editor 컨텍스트에서는 작성자 미기록 (조용히 통과)
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO uname FROM public.profiles WHERE id = uid;

  INSERT INTO public.content_authors (content_type, content_id, author_id, author_name)
  VALUES (TG_ARGV[0], NEW.id, uid, uname)
  ON CONFLICT (content_type, content_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS record_notice_author ON public.notices;
CREATE TRIGGER record_notice_author
  AFTER INSERT ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.record_content_author('notice');

DROP TRIGGER IF EXISTS record_weekly_author ON public.weeklies;
CREATE TRIGGER record_weekly_author
  AFTER INSERT ON public.weeklies
  FOR EACH ROW EXECUTE FUNCTION public.record_content_author('weekly');

DROP TRIGGER IF EXISTS record_gallery_album_author ON public.gallery_albums;
CREATE TRIGGER record_gallery_album_author
  AFTER INSERT ON public.gallery_albums
  FOR EACH ROW EXECUTE FUNCTION public.record_content_author('gallery_album');
