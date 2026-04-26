-- 021: 컨텐츠 삭제 권한 분리 — 작성자 본인 OR admin OR master 만 삭제 가능
--
-- 배경:
--   015 에서 notices/weeklies/gallery_albums 의 모든 작업(SELECT/INSERT/UPDATE/DELETE)을
--   "FOR ALL USING (is_staff())" 로 묶어 두었다. 즉 staff 등급도 다른 사람이 작성한
--   글을 삭제할 수 있는 상태.
--
--   020 에서 도입한 content_authors shadow 테이블을 활용해 DELETE 만 따로 좁힌다.
--   - 작성자 본인     → 삭제 가능
--   - admin / master  → 모든 글 삭제 가능
--   - staff (비-작성자) → 삭제 불가
--
--   SELECT/INSERT/UPDATE 는 기존대로 staff 전체에게 허용 (편집 협업 유지).
--   public SELECT 정책 (is_public, 002/003 마이그레이션) 은 기존 그대로 유지된다.
--
-- 적용 대상:
--   - notices         (작성자 추적 O)
--   - weeklies        (작성자 추적 O)
--   - gallery_albums  (작성자 추적 O)
--   - gallery_images  (앨범에 종속 — 부모 앨범의 작성자 권한을 따름)


-- 1. 헬퍼 함수 ─────────────────────────────────────────────────────────

-- 현재 사용자가 admin 또는 master 인지
CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'master')
  );
$$;

-- 현재 사용자가 특정 컨텐츠의 작성자인지
CREATE OR REPLACE FUNCTION public.is_content_author(p_content_type text, p_content_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_authors
    WHERE content_type = p_content_type
      AND content_id   = p_content_id
      AND author_id    = auth.uid()
  );
$$;


-- 2. notices ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can manage notices" ON public.notices;

CREATE POLICY "Staff can read all notices" ON public.notices
  FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert notices" ON public.notices
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update notices" ON public.notices
  FOR UPDATE USING (public.is_staff());
CREATE POLICY "Author/admin/master can delete notices" ON public.notices
  FOR DELETE USING (
    public.is_admin_or_master()
    OR public.is_content_author('notice', id)
  );


-- 3. weeklies ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can manage weeklies" ON public.weeklies;

CREATE POLICY "Staff can read all weeklies" ON public.weeklies
  FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert weeklies" ON public.weeklies
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update weeklies" ON public.weeklies
  FOR UPDATE USING (public.is_staff());
CREATE POLICY "Author/admin/master can delete weeklies" ON public.weeklies
  FOR DELETE USING (
    public.is_admin_or_master()
    OR public.is_content_author('weekly', id)
  );


-- 4. gallery_albums ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can manage albums" ON public.gallery_albums;

CREATE POLICY "Staff can read all albums" ON public.gallery_albums
  FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert albums" ON public.gallery_albums
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update albums" ON public.gallery_albums
  FOR UPDATE USING (public.is_staff());
CREATE POLICY "Author/admin/master can delete albums" ON public.gallery_albums
  FOR DELETE USING (
    public.is_admin_or_master()
    OR public.is_content_author('gallery_album', id)
  );


-- 5. gallery_images — 부모 앨범의 작성자/admin/master 만 삭제 가능 ─────
DROP POLICY IF EXISTS "Staff can manage images" ON public.gallery_images;

CREATE POLICY "Staff can read all gallery_images" ON public.gallery_images
  FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert gallery_images" ON public.gallery_images
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update gallery_images" ON public.gallery_images
  FOR UPDATE USING (public.is_staff());
CREATE POLICY "Author/admin/master can delete gallery_images" ON public.gallery_images
  FOR DELETE USING (
    public.is_admin_or_master()
    OR public.is_content_author('gallery_album', album_id)
  );


-- 참고: storage.objects (gallery / weeklies 버킷) 의 DELETE 정책은
-- 015 에서 "Staff can delete ..." 로 두었다. 작성자 매칭이 필요하면
-- 별도 마이그레이션에서 좁힐 수 있으나, 파일 자체는 DB 행이 지워질 때
-- 클라이언트가 명시적으로 storage.remove() 를 호출하도록 흐름이 짜여
-- 있으므로, DB 행 DELETE 만 막아도 실질적으로 삭제 흐름이 차단된다.
