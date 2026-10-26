-- 쇼츠 관리 권한을 admin 이상 → staff 이상으로 완화.
-- UI(/admin/shorts)와 API(requireShortsAdmin)가 staff 를 허용하므로
-- 사용자 세션으로 조회하는 읽기 정책도 is_staff() 로 맞춘다.

drop policy if exists shorts_jobs_read on public.shorts_jobs;
create policy shorts_jobs_read on public.shorts_jobs for select to anon,authenticated
  using (status='published' or public.is_staff());

drop policy if exists shorts_clips_read on public.shorts_clips;
create policy shorts_clips_read on public.shorts_clips for select to anon,authenticated
  using (published_at is not null or public.is_staff());

drop policy if exists shorts_settings_read on public.shorts_settings;
create policy shorts_settings_read on public.shorts_settings for select to authenticated
  using (public.is_staff());

drop policy if exists shorts_attempts_read on public.shorts_job_attempts;
create policy shorts_attempts_read on public.shorts_job_attempts for select to authenticated
  using (public.is_staff());

drop policy if exists shorts_publications_admin_read on public.shorts_publications;
create policy shorts_publications_staff_read on public.shorts_publications for select to authenticated
  using (public.is_staff());
