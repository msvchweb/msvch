-- Additive migration: preserve all legacy clip IDs and media URLs.
create table public.shorts_job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.shorts_jobs(id),
  attempt_no integer not null,
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed')),
  stage text not null default 'pending',
  github_run_id text, github_run_attempt integer,
  heartbeat_at timestamptz, started_at timestamptz, finished_at timestamptz,
  error_code text, error_message text, transcription_source text,
  created_at timestamptz not null default now(),
  unique(job_id, attempt_no)
);
create unique index shorts_one_active_attempt on public.shorts_job_attempts(job_id)
  where status in ('queued','running');
alter table public.shorts_jobs
  add column active_attempt_id uuid references public.shorts_job_attempts(id),
  add column review_attempt_id uuid references public.shorts_job_attempts(id);
alter table public.shorts_clips
  add column attempt_id uuid references public.shorts_job_attempts(id),
  add column selection_reason text,
  add column title_yt text,
  add column transcript_status text not null default 'unverified' check(transcript_status in ('verified','unverified')),
  add column rendered_duration_sec numeric,
  add column selection_data jsonb,
  add column media_check jsonb,
  add column content_version int not null default 1,
  add column approved_version int,
  add column reject_category text check(reject_category in ('context','hook','subtitle','framing','sync','other')),
  add constraint shorts_attempt_clip_unique unique(attempt_id,clip_index);
update public.shorts_clips set selection_reason=transcript;
alter table public.shorts_settings add column bgm_enabled boolean not null default false;

-- Only server transitions may mutate these tables. Admin/master can inspect drafts.
do $$ declare p record; begin
  for p in select schemaname,tablename,policyname from pg_policies
    where schemaname='public' and tablename in ('shorts_jobs','shorts_clips','shorts_settings')
  loop execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename); end loop;
end $$;

create function public.shorts_save_clip(p_attempt uuid,p_run text,p_run_attempt int,p_clip jsonb) returns uuid
language plpgsql set search_path='' as $$
declare a public.shorts_job_attempts; clip_id uuid;
begin
  select * into a from public.shorts_job_attempts where id=p_attempt for update;
  if not found or a.status<>'running' or a.github_run_id is distinct from p_run or a.github_run_attempt is distinct from p_run_attempt
    then raise exception 'attempt_ownership_lost'; end if;
  if (p_clip->'media_check'->>'valid')::boolean is distinct from true then raise exception 'invalid_media'; end if;
  select id into clip_id from public.shorts_clips where attempt_id=p_attempt and clip_index=(p_clip->>'clip_index')::int;
  if found then return clip_id; end if;
  insert into public.shorts_clips(job_id,attempt_id,clip_index,start_sec,end_sec,title,hook,transcript,transcript_status,
    selection_reason,title_yt,caption_yt,caption_ig,video_url,selection_data,media_check,rendered_duration_sec)
  values(a.job_id,p_attempt,(p_clip->>'clip_index')::int,(p_clip->>'start_sec')::numeric,(p_clip->>'end_sec')::numeric,
    p_clip->>'title',p_clip->>'hook',p_clip->>'transcript','verified',p_clip->>'selection_reason',p_clip->>'title_yt',
    p_clip->>'caption_yt',p_clip->>'caption_ig',p_clip->>'video_url',p_clip->'selection_data',p_clip->'media_check',
    (p_clip->>'rendered_duration_sec')::numeric) returning id into clip_id;
  return clip_id;
end $$;
revoke all on function public.shorts_save_clip(uuid,text,int,jsonb) from public,anon,authenticated;
grant execute on function public.shorts_save_clip(uuid,text,int,jsonb) to service_role;

create function public.shorts_heartbeat_attempt(p_attempt uuid,p_run text,p_run_attempt int) returns boolean
language plpgsql set search_path='' as $$
begin
  update public.shorts_job_attempts set heartbeat_at=now() where id=p_attempt and status='running'
    and github_run_id=p_run and github_run_attempt=p_run_attempt;
  return found;
end $$;
revoke all on function public.shorts_heartbeat_attempt(uuid,text,int) from public,anon,authenticated;
grant execute on function public.shorts_heartbeat_attempt(uuid,text,int) to service_role;
alter table public.shorts_job_attempts enable row level security;
create policy shorts_jobs_read on public.shorts_jobs for select to anon,authenticated
  using (status='published' or public.is_admin_or_master());
create policy shorts_clips_read on public.shorts_clips for select to anon,authenticated
  using (published_at is not null or public.is_admin_or_master());
create policy shorts_settings_read on public.shorts_settings for select to authenticated
  using (public.is_admin_or_master());
create policy shorts_attempts_read on public.shorts_job_attempts for select to authenticated
  using (public.is_admin_or_master());
revoke all on public.shorts_jobs,public.shorts_clips,public.shorts_settings,public.shorts_job_attempts from anon,authenticated;
grant select on public.shorts_jobs,public.shorts_clips to anon,authenticated;
grant select on public.shorts_settings,public.shorts_job_attempts to authenticated;
grant all on public.shorts_jobs,public.shorts_clips,public.shorts_settings,public.shorts_job_attempts to service_role;

create function public.shorts_create_attempt(p_job uuid) returns public.shorts_job_attempts
language plpgsql set search_path='' as $$
declare j public.shorts_jobs; a public.shorts_job_attempts;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  select * into strict j from public.shorts_jobs where id=p_job for update;
  if exists(select 1 from public.shorts_job_attempts where job_id=p_job and status in ('queued','running')) then
    raise exception 'active_attempt_exists' using errcode='P0001';
  end if;
  if exists(select 1 from public.shorts_clips where job_id=p_job and (review_status='approved' or published_at is not null)) then
    raise exception 'approved_clips_exist' using errcode='P0001';
  end if;
  insert into public.shorts_job_attempts(job_id,attempt_no)
    select p_job,coalesce(max(attempt_no),0)+1 from public.shorts_job_attempts where job_id=p_job returning * into a;
  update public.shorts_jobs set active_attempt_id=a.id,status='pending',error=null,updated_at=now() where id=p_job;
  return a;
end $$;

create function public.shorts_review_clip(p_clip uuid,p_action text,p_version int,p_patch jsonb) returns public.shorts_clips
language plpgsql set search_path='' as $$
declare c public.shorts_clips; j public.shorts_jobs;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  select * into strict c from public.shorts_clips where id=p_clip for update;
  select * into strict j from public.shorts_jobs where id=c.job_id;
  if j.active_attempt_id is not null then raise exception 'generation_in_progress'; end if;
  if c.attempt_id is distinct from j.review_attempt_id then raise exception 'not_current_review'; end if;
  if p_version is not null and c.content_version<>p_version then raise exception 'version_conflict'; end if;
  if c.published_at is not null then raise exception 'already_published'; end if;
  if p_action='edit' then
    if p_version is null then raise exception 'version_required'; end if;
    update public.shorts_clips set title=p_patch->>'title',title_yt=p_patch->>'titleYt',caption_yt=p_patch->>'captionYt',
      caption_ig=p_patch->>'captionIg',content_version=content_version+1,approved_version=null,review_status='pending'
      where id=p_clip returning * into c;
  elsif p_action='approve' then
    update public.shorts_clips set review_status='approved',approved_version=content_version where id=p_clip returning * into c;
  elsif p_action='reject' then
    if p_version is null then raise exception 'version_required'; end if;
    update public.shorts_clips set review_status='rejected',approved_version=null,reject_category=p_patch->>'category',reviewer_note=p_patch->>'note'
      where id=p_clip returning * into c;
  else raise exception 'invalid_review_action'; end if;
  return c;
end $$;
revoke all on function public.shorts_review_clip(uuid,text,int,jsonb) from public,anon,authenticated;
grant execute on function public.shorts_review_clip(uuid,text,int,jsonb) to service_role;

create function public.shorts_create_generation(p_request jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare j public.shorts_jobs; a public.shorts_job_attempts;
begin
  if p_request->>'videoId' !~ '^[A-Za-z0-9_-]{11}$' or coalesce((p_request->>'count')::int,5) not in (5,10) then
    raise exception 'invalid_generation_request';
  end if;
  insert into public.shorts_jobs(video_id,video_title,video_published_at,video_thumbnail,highlight_count)
  values(p_request->>'videoId',p_request->>'videoTitle',(p_request->>'videoPublishedAt')::timestamptz,
    p_request->>'videoThumbnail',coalesce((p_request->>'count')::int,5)) returning * into j;
  a := public.shorts_create_attempt(j.id);
  return jsonb_build_object('jobId',j.id,'attemptId',a.id,'status','pending');
end $$;

create function public.shorts_claim_attempt(p_attempt uuid,p_run text,p_run_attempt int) returns boolean
language plpgsql set search_path='' as $$
declare a public.shorts_job_attempts;
begin
  if p_run='' or p_run_attempt<1 then return false; end if;
  select * into a from public.shorts_job_attempts where id=p_attempt for update;
  if not found or a.status<>'queued' then return false; end if;
  if not exists(select 1 from public.shorts_jobs where id=a.job_id and active_attempt_id=a.id) then return false; end if;
  update public.shorts_job_attempts set status='running',github_run_id=p_run,github_run_attempt=p_run_attempt,
    started_at=now(),heartbeat_at=now(),error_code=null,error_message=null where id=a.id;
  return true;
end $$;

create function public.shorts_update_attempt(p_attempt uuid,p_run text,p_run_attempt int,p_stage text,p_source text default null)
returns boolean language plpgsql set search_path='' as $$
declare a public.shorts_job_attempts;
begin
  if p_stage not in ('downloading','transcribing','selecting','editing') then raise exception 'invalid_stage'; end if;
  update public.shorts_job_attempts set stage=p_stage,heartbeat_at=now(),transcription_source=coalesce(p_source,transcription_source)
  where id=p_attempt and status='running' and github_run_id=p_run and github_run_attempt=p_run_attempt returning * into a;
  if not found then return false; end if;
  update public.shorts_jobs set status=p_stage,updated_at=now() where id=a.job_id and active_attempt_id=p_attempt;
  return found;
end $$;

create function public.shorts_finish_attempt(p_attempt uuid,p_run text,p_run_attempt int,p_success boolean,p_code text default null,p_message text default null)
returns boolean language plpgsql set search_path='' as $$
declare a public.shorts_job_attempts;
begin
  select * into a from public.shorts_job_attempts where id=p_attempt for update;
  if not found or a.status<>'running' or a.github_run_id is distinct from p_run or a.github_run_attempt is distinct from p_run_attempt then return false; end if;
  if p_success and not exists(select 1 from public.shorts_clips where attempt_id=p_attempt) then raise exception 'no_rendered_clips'; end if;
  update public.shorts_job_attempts set status=case when p_success then 'succeeded' else 'failed' end,
    finished_at=now(),heartbeat_at=now(),error_code=p_code,error_message=p_message where id=p_attempt;
  update public.shorts_jobs set status=case when p_success then 'ready_for_review' else 'failed' end,
    review_attempt_id=case when p_success then p_attempt else review_attempt_id end,
    active_attempt_id=null,error=p_message,updated_at=now() where id=a.job_id and active_attempt_id=p_attempt;
  return found;
end $$;

-- Only confirmed dispatch failure or confirmed terminal GitHub run may call this.
create function public.shorts_fail_attempt(p_attempt uuid,p_code text,p_message text,p_run text default null) returns boolean
language plpgsql set search_path='' as $$
declare a public.shorts_job_attempts;
begin
  select * into a from public.shorts_job_attempts where id=p_attempt for update;
  if not found or a.status not in ('queued','running') then return false; end if;
  if a.status='running' and a.github_run_id is distinct from p_run then return false; end if;
  update public.shorts_job_attempts set status='failed',error_code=p_code,error_message=p_message,finished_at=now() where id=p_attempt;
  update public.shorts_jobs set status='failed',active_attempt_id=null,error=p_message,updated_at=now()
    where id=a.job_id and active_attempt_id=p_attempt;
  return found;
end $$;

do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace
    and proname in ('shorts_create_attempt','shorts_create_generation','shorts_claim_attempt','shorts_update_attempt','shorts_finish_attempt','shorts_fail_attempt')
  loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
