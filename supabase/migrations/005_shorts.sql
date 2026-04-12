-- ============================================================
-- 005_shorts.sql — 쇼츠 자동화
-- ============================================================

-- 1. shorts_jobs: 파이프라인 작업 단위
create table public.shorts_jobs (
  id uuid default gen_random_uuid() primary key,
  video_id text not null unique,
  video_title text not null,
  video_published_at timestamptz,
  video_thumbnail text,
  status text not null default 'pending'
    check (status in (
      'pending','downloading','transcribing','selecting',
      'editing','ready_for_review','published','failed'
    )),
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.shorts_jobs enable row level security;

create policy "Anyone can view jobs" on public.shorts_jobs
  for select using (true);

create policy "Admins can manage jobs" on public.shorts_jobs
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 2. shorts_clips: 생성된 쇼츠 후보
create table public.shorts_clips (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.shorts_jobs on delete cascade not null,
  clip_index int not null,
  start_sec numeric not null,
  end_sec numeric not null,
  duration_sec numeric generated always as (end_sec - start_sec) stored,
  title text,
  hook text,
  transcript text,
  caption_yt text,
  caption_ig text,
  video_url text,
  review_status text not null default 'pending'
    check (review_status in ('pending','approved','rejected')),
  reviewer_note text,
  youtube_video_id text,
  published_at timestamptz,
  created_at timestamptz default now()
);

alter table public.shorts_clips enable row level security;

create policy "Anyone can view approved clips" on public.shorts_clips
  for select using (
    review_status = 'approved'
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can manage clips" on public.shorts_clips
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_shorts_clips_job_id on public.shorts_clips(job_id);
create index idx_shorts_clips_review on public.shorts_clips(review_status);

-- 3. shorts_settings: 글로벌 설정 (싱글톤)
create table public.shorts_settings (
  id int primary key default 1 check (id = 1),
  auto_publish boolean default false,
  max_clips_per_sermon int default 5,
  daily_publish_limit int default 5,
  highlight_prompt text,
  metadata_prompt text,
  updated_at timestamptz default now()
);

alter table public.shorts_settings enable row level security;

create policy "Anyone can view settings" on public.shorts_settings
  for select using (true);

create policy "Admins can manage settings" on public.shorts_settings
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

insert into public.shorts_settings (id) values (1);

-- 4. Storage 버킷
insert into storage.buckets (id, name, public)
values ('shorts', 'shorts', true)
on conflict (id) do nothing;

create policy "Anyone can view shorts files" on storage.objects
  for select using (bucket_id = 'shorts');

create policy "Admins can upload shorts files" on storage.objects
  for insert with check (
    bucket_id = 'shorts'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete shorts files" on storage.objects
  for delete using (
    bucket_id = 'shorts'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Service role can upload shorts" on storage.objects
  for insert with check (
    bucket_id = 'shorts' and auth.role() = 'service_role'
  );

create policy "Service role can delete shorts" on storage.objects
  for delete using (
    bucket_id = 'shorts' and auth.role() = 'service_role'
  );
