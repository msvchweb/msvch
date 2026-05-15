-- 037: RLS 매트릭스를 UI 권한과 일치시킴
--
-- 배경:
--   src/lib/admin-permissions.ts 의 UI 매트릭스는 일부 페이지를 admin 이상으로
--   좁혔지만, RLS 는 015 이후 staff 등급도 동일 권한을 가졌다.
--   이 마이그레이션은 admin+ UI 경로에 해당하는 테이블의 staff 정책을
--   is_admin_or_master() 로 좁힌다.
--
-- 적용 대상 (admin+ UI 와 매칭):
--   - notices                       (/admin/notices)
--   - weeklies + storage 'weeklies'  (/admin/weeklies)
--   - church_settings               (/admin/masters)
--   - mokjang_entries
--   - servants
--   - support_sections
--   - community_prayers
--   - events                        (/admin/calendar)
--   - event_subscribers             (/admin/event-subscribers)
--   - alimtalk_sent
--   - chat_inquiries                (/admin/inquiries) — INSERT 는 anon 유지
--   - new_family_registrations      (/admin/new-families) — INSERT 는 anon 유지
--   - storage 'blog-images'          (공지 히어로 이미지 — admin+ 페이지에서만 사용)
--
-- 적용하지 않는 대상 (UI 가 staff+ 또는 master 단독 — 기존 정책 유지):
--   - gallery_albums / gallery_images / storage 'gallery'  (staff+)
--   - boards / board_members / board_posts / board_comments / storage 'board-images' (staff+ UI, RLS 는 admin+ 관리)
--   - posters / poster_generations_log / storage 'poster-images'  (staff+)
--   - sermon_videos / shorts_jobs / shorts_clips / shorts_settings / storage 'shorts'  (staff+)
--   - profiles role 변경 트리거  (master 단독, 019)
--
-- 보존되는 흐름:
--   - 공개 SELECT 정책 (notices is_public, weeklies anyone, events anyone) — 그대로
--   - 작성자 본인의 DELETE (021 패턴) — 그대로
--   - service_role / cron 라우트 — RLS 우회로 영향 없음

-- 1. notices ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can read all notices" ON public.notices;
CREATE POLICY "Admin can read all notices" ON public.notices
  FOR SELECT USING (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff can insert notices" ON public.notices;
CREATE POLICY "Admin can insert notices" ON public.notices
  FOR INSERT WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff can update notices" ON public.notices;
CREATE POLICY "Admin can update notices" ON public.notices
  FOR UPDATE USING (public.is_admin_or_master());

-- DELETE 정책 ("Author/admin/master can delete notices") 은 그대로 유지


-- 2. weeklies + storage 'weeklies' ───────────────────────────────────
DROP POLICY IF EXISTS "Staff can read all weeklies" ON public.weeklies;
CREATE POLICY "Admin can read all weeklies" ON public.weeklies
  FOR SELECT USING (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff can insert weeklies" ON public.weeklies;
CREATE POLICY "Admin can insert weeklies" ON public.weeklies
  FOR INSERT WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff can update weeklies" ON public.weeklies;
CREATE POLICY "Admin can update weeklies" ON public.weeklies
  FOR UPDATE USING (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff can upload weekly files" ON storage.objects;
CREATE POLICY "Admin can upload weekly files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'weeklies' AND public.is_admin_or_master()
  );

DROP POLICY IF EXISTS "Staff can delete weekly files" ON storage.objects;
CREATE POLICY "Admin can delete weekly files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'weeklies' AND public.is_admin_or_master()
  );


-- 3. weekly masters (church_settings / mokjang_entries / servants / support_sections / community_prayers)
DROP POLICY IF EXISTS "Staff manage church_settings" ON public.church_settings;
CREATE POLICY "Admin manage church_settings" ON public.church_settings
  FOR ALL USING (public.is_admin_or_master())
  WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff manage mokjang_entries" ON public.mokjang_entries;
CREATE POLICY "Admin manage mokjang_entries" ON public.mokjang_entries
  FOR ALL USING (public.is_admin_or_master())
  WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff manage servants" ON public.servants;
CREATE POLICY "Admin manage servants" ON public.servants
  FOR ALL USING (public.is_admin_or_master())
  WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff manage support_sections" ON public.support_sections;
CREATE POLICY "Admin manage support_sections" ON public.support_sections
  FOR ALL USING (public.is_admin_or_master())
  WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff manage community_prayers" ON public.community_prayers;
CREATE POLICY "Admin manage community_prayers" ON public.community_prayers
  FOR ALL USING (public.is_admin_or_master())
  WITH CHECK (public.is_admin_or_master());


-- 4. events ──────────────────────────────────────────────────────────
-- SELECT 누구나 (캘린더 공개) 유지, DELETE (작성자 OR admin/master) 유지
DROP POLICY IF EXISTS "Staff can insert events" ON public.events;
CREATE POLICY "Admin can insert events" ON public.events
  FOR INSERT WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff can update events" ON public.events;
CREATE POLICY "Admin can update events" ON public.events
  FOR UPDATE USING (public.is_admin_or_master());


-- 5. event_subscribers / alimtalk_sent ────────────────────────────────
-- event_subscribers 의 INSERT/UPDATE/DELETE 는 023 에서 이미 is_admin_or_master.
-- SELECT 만 staff 였으므로 좁힌다.
DROP POLICY IF EXISTS "Staff can read subscribers" ON public.event_subscribers;
CREATE POLICY "Admin can read subscribers" ON public.event_subscribers
  FOR SELECT USING (public.is_admin_or_master());

-- alimtalk_sent: SELECT 만 정책 존재 (INSERT/UPDATE/DELETE 는 service_role 전용)
DROP POLICY IF EXISTS "Staff can read alimtalk log" ON public.alimtalk_sent;
CREATE POLICY "Admin can read alimtalk log" ON public.alimtalk_sent
  FOR SELECT USING (public.is_admin_or_master());


-- 6. chat_inquiries ──────────────────────────────────────────────────
-- INSERT (anon 챗봇) 은 그대로
DROP POLICY IF EXISTS "Staff can view inquiries" ON public.chat_inquiries;
CREATE POLICY "Admin can view inquiries" ON public.chat_inquiries
  FOR SELECT USING (public.is_admin_or_master());


-- 7. new_family_registrations ────────────────────────────────────────
-- INSERT (anon 공개 폼) 그대로, DELETE (admin/master, 024) 그대로
DROP POLICY IF EXISTS "Staff can read new family" ON public.new_family_registrations;
CREATE POLICY "Admin can read new family" ON public.new_family_registrations
  FOR SELECT USING (public.is_admin_or_master());

DROP POLICY IF EXISTS "Staff can update new family" ON public.new_family_registrations;
CREATE POLICY "Admin can update new family" ON public.new_family_registrations
  FOR UPDATE USING (public.is_admin_or_master())
  WITH CHECK (public.is_admin_or_master());


-- 8. storage 'blog-images' (공지 히어로 이미지 — admin+ 페이지에서만 사용)
DROP POLICY IF EXISTS "Staff can upload blog-images" ON storage.objects;
CREATE POLICY "Admin can upload blog-images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'blog-images' AND public.is_admin_or_master()
  );

DROP POLICY IF EXISTS "Staff can update blog-images" ON storage.objects;
CREATE POLICY "Admin can update blog-images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'blog-images' AND public.is_admin_or_master()
  );

DROP POLICY IF EXISTS "Staff can delete blog-images" ON storage.objects;
CREATE POLICY "Admin can delete blog-images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'blog-images' AND public.is_admin_or_master()
  );
