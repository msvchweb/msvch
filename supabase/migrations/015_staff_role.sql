-- 015: staff role 추가 — admin 과 동일한 권한으로 admin UI 에 접근 가능한 중간 역할
--
-- 설계:
--   - member  : 일반 회원 (기본값)
--   - staff   : 직원 (admin 동일 권한, admin UI 접근 가능)
--   - admin   : 최상위 관리자
--
-- 현재 staff 는 admin 과 동일 RLS 권한. 추후 세분화가 필요하면 이 마이그레이션 이후
-- 새 마이그레이션에서 특정 테이블 정책을 role='admin' 으로 다시 좁히면 된다.

-- 1. CHECK constraint 확장 ─────────────────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member', 'staff', 'admin'));

-- 2. 역할 판별 헬퍼 ─────────────────────────────────────────────────────
-- 정책에서 반복되는 EXISTS (SELECT ... WHERE role='admin') 패턴을 대체.
-- SECURITY DEFINER: auth.uid() 기반 profiles 조회 권한 보장.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('staff', 'admin')
  );
$$;

-- 3. 기존 admin 전용 정책 재작성 (is_staff 사용) ─────────────────────────

-- gallery (002)
DROP POLICY IF EXISTS "Admins can manage albums" ON public.gallery_albums;
CREATE POLICY "Staff can manage albums" ON public.gallery_albums
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can manage images" ON public.gallery_images;
CREATE POLICY "Staff can manage images" ON public.gallery_images
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can upload gallery files" ON storage.objects;
CREATE POLICY "Staff can upload gallery files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gallery' AND public.is_staff());

DROP POLICY IF EXISTS "Admins can delete gallery files" ON storage.objects;
CREATE POLICY "Staff can delete gallery files" ON storage.objects
  FOR DELETE USING (bucket_id = 'gallery' AND public.is_staff());

-- notices & weeklies (003)
DROP POLICY IF EXISTS "Admins can manage notices" ON public.notices;
CREATE POLICY "Staff can manage notices" ON public.notices
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can manage weeklies" ON public.weeklies;
CREATE POLICY "Staff can manage weeklies" ON public.weeklies
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can upload weekly files" ON storage.objects;
CREATE POLICY "Staff can upload weekly files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'weeklies' AND public.is_staff());

DROP POLICY IF EXISTS "Admins can delete weekly files" ON storage.objects;
CREATE POLICY "Staff can delete weekly files" ON storage.objects
  FOR DELETE USING (bucket_id = 'weeklies' AND public.is_staff());

-- shorts (005)
DROP POLICY IF EXISTS "Admins can manage jobs" ON public.shorts_jobs;
CREATE POLICY "Staff can manage jobs" ON public.shorts_jobs
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Anyone can view approved clips" ON public.shorts_clips;
CREATE POLICY "View approved or staff all" ON public.shorts_clips
  FOR SELECT USING (review_status = 'approved' OR public.is_staff());

DROP POLICY IF EXISTS "Admins can manage clips" ON public.shorts_clips;
CREATE POLICY "Staff can manage clips" ON public.shorts_clips
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can manage settings" ON public.shorts_settings;
CREATE POLICY "Staff can manage settings" ON public.shorts_settings
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can upload shorts files" ON storage.objects;
CREATE POLICY "Staff can upload shorts files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'shorts' AND public.is_staff());

DROP POLICY IF EXISTS "Admins can delete shorts files" ON storage.objects;
CREATE POLICY "Staff can delete shorts files" ON storage.objects
  FOR DELETE USING (bucket_id = 'shorts' AND public.is_staff());

-- chat_inquiries (006)
DROP POLICY IF EXISTS "Admins can view inquiries" ON public.chat_inquiries;
CREATE POLICY "Staff can view inquiries" ON public.chat_inquiries
  FOR SELECT USING (public.is_staff());

-- bulletin master (012)
DROP POLICY IF EXISTS "Admins manage church_settings" ON public.church_settings;
CREATE POLICY "Staff manage church_settings" ON public.church_settings
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins manage mokjang_entries" ON public.mokjang_entries;
CREATE POLICY "Staff manage mokjang_entries" ON public.mokjang_entries
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins manage servants" ON public.servants;
CREATE POLICY "Staff manage servants" ON public.servants
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins manage support_sections" ON public.support_sections;
CREATE POLICY "Staff manage support_sections" ON public.support_sections
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "Admins manage community_prayers" ON public.community_prayers;
CREATE POLICY "Staff manage community_prayers" ON public.community_prayers
  FOR ALL USING (public.is_staff());

-- 4. role 변경 보호 ─────────────────────────────────────────────────────
-- "Users can update own profile" 정책은 모든 컬럼을 허용하므로, staff/member 가
-- 자기 role 을 admin 으로 바꾸는 공격이 가능. role 변경은 오직 admin 만 허용.
-- (SQL Editor/service_role 경로는 RLS/트리거 우회 → 여전히 가능. 웹/모바일 세션 공격만 차단)

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'role 변경은 관리자만 가능합니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_unauthorized_role_change ON public.profiles;
CREATE TRIGGER prevent_unauthorized_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_unauthorized_role_change();
