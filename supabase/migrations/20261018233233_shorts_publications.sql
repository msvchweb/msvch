-- Approval, leases and platform quota are committed by database transactions.
alter table public.shorts_settings
  add column publishing_enabled boolean not null default false,
  add column auto_generate_enabled boolean not null default false,
  add column auto_generate_after timestamptz,
  add column source_playlist_id text,
  add column allowed_categories text[] not null default array['sunday','wednesday','friday','dawn'];
create table public.shorts_connections(
  platform text primary key check(platform in ('youtube','instagram')),
  account_id text not null,
  credentials_encrypted text not null,
  expires_at timestamptz,
  refreshed_at timestamptz,
  status text not null check(status in ('connected','needs_attention')),
  updated_at timestamptz not null default now()
);
create table public.shorts_publications(
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.shorts_clips(id),
  platform text not null check(platform in ('youtube','instagram')),
  content_version int not null,
  test_only boolean not null default false,
  status text not null default 'queued' check(status in ('queued','processing','retry_wait','needs_attention','test_uploaded','published','canceled')),
  scheduled_at timestamptz not null,
  next_attempt_at timestamptz,
  attempt_count int not null default 0,
  public_request_started boolean not null default false,
  quota_date date,
  lease_token uuid, lease_expires_at timestamptz, worker_run_id text,
  provider_id text, provider_url text, published_at timestamptz,
  error_code text, error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(clip_id,platform,content_version,test_only),
  check(not test_only or platform='youtube')
);
create index shorts_publications_due on public.shorts_publications(status,scheduled_at,next_attempt_at);
create index shorts_publications_quota on public.shorts_publications(platform,quota_date) where not test_only;
create table public.shorts_publish_private(
  publication_id uuid primary key references public.shorts_publications(id),
  checkpoint_encrypted text not null,
  updated_at timestamptz not null default now()
);
alter table public.shorts_connections enable row level security;
alter table public.shorts_publications enable row level security;
alter table public.shorts_publish_private enable row level security;
revoke all on public.shorts_connections,public.shorts_publish_private,public.shorts_publications from public,anon,authenticated;
grant all on public.shorts_connections,public.shorts_publish_private,public.shorts_publications to service_role;
grant select on public.shorts_publications to authenticated;
create policy shorts_publications_admin_read on public.shorts_publications for select to authenticated using(public.is_admin_or_master());

-- Mutations serialize briefly. No network IO occurs under this lock.
create function public.shorts_protect_clip() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  if new.content_version is distinct from old.content_version or new.review_status is distinct from old.review_status then
    if exists(select 1 from public.shorts_publications where clip_id=old.id and
      (status in ('processing','published','needs_attention') or public_request_started))
      then raise exception 'publication_in_flight'; end if;
    update public.shorts_publications set status='canceled',quota_date=null,updated_at=now()
      where clip_id=old.id and status in ('queued','retry_wait')
      and (new.content_version<>content_version or new.review_status<>'approved');
  end if;
  return new;
end $$;
create trigger shorts_protect_clip before update on public.shorts_clips for each row execute function public.shorts_protect_clip();

create function public.shorts_approve_schedule(p_clip uuid,p_version int,p_platforms text[],p_scheduled timestamptz,p_test boolean default false)
returns setof public.shorts_publications language plpgsql set search_path='' as $$
declare c public.shorts_clips; platform_name text;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  select * into strict c from public.shorts_clips where id=p_clip for update;
  if c.content_version<>p_version then raise exception 'version_conflict'; end if;
  if c.transcript_status<>'verified' or (c.media_check->>'valid')::boolean is distinct from true or c.video_url is null then raise exception 'media_not_verified'; end if;
  if p_scheduled is null or cardinality(p_platforms)<1 or cardinality(p_platforms)>2 then raise exception 'invalid_schedule'; end if;
  foreach platform_name in array p_platforms loop
    if platform_name not in ('youtube','instagram') or (p_test and platform_name<>'youtube') then raise exception 'invalid_platform'; end if;
    if not exists(select 1 from public.shorts_connections where platform=platform_name and status='connected') then raise exception 'account_not_connected'; end if;
  end loop;
  -- Repeated approvals return the original rows and do not re-schedule completed work.
  if c.review_status<>'approved' or c.approved_version is distinct from c.content_version then
    perform public.shorts_review_clip(p_clip,'approve',p_version,'{}');
  end if;
  foreach platform_name in array p_platforms loop
    insert into public.shorts_publications(clip_id,platform,content_version,test_only,scheduled_at)
      values(p_clip,platform_name,p_version,p_test,p_scheduled) on conflict(clip_id,platform,content_version,test_only)
      do update set status='queued',scheduled_at=excluded.scheduled_at,next_attempt_at=null,error_code=null,error_message=null,updated_at=now()
      where public.shorts_publications.status='canceled';
  end loop;
  if exists(select 1 from public.shorts_publications where clip_id=p_clip and content_version=p_version and not test_only and status not in ('published','canceled')) then
    update public.shorts_jobs set status='ready_for_review',updated_at=now() where id=c.job_id;
  end if;
  return query select * from public.shorts_publications where clip_id=p_clip and content_version=p_version and test_only=p_test and platform=any(p_platforms);
end $$;

create function public.shorts_claim_publication(p_now timestamptz,p_worker text,p_mode text) returns jsonb
language plpgsql set search_path='' as $$
declare p public.shorts_publications; quota_limit int; day date:=(p_now at time zone 'Asia/Seoul')::date;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  if p_mode not in ('live','private-test') or not (select publishing_enabled from public.shorts_settings where id=1) then return null; end if;
  select daily_publish_limit into quota_limit from public.shorts_settings where id=1;
  for p in select q.* from public.shorts_publications q
    join public.shorts_clips c on c.id=q.clip_id join public.shorts_jobs j on j.id=c.job_id
    where q.status in ('queued','retry_wait') and q.scheduled_at<=p_now and coalesce(q.next_attempt_at,p_now)<=p_now
      and q.test_only=(p_mode='private-test') and c.review_status='approved'
      and c.approved_version=q.content_version and c.content_version=q.content_version
      and c.attempt_id is not distinct from j.review_attempt_id
    order by q.scheduled_at,q.id for update of q skip locked
  loop
    if not p.test_only then
      perform pg_advisory_xact_lock(hashtext('shorts_quota_'||p.platform||day::text));
      if (select count(*) from public.shorts_publications where platform=p.platform and quota_date=day and not test_only and status<>'canceled' and id<>p.id)>=quota_limit then continue; end if;
    end if;
    update public.shorts_publications set status='processing',lease_token=gen_random_uuid(),
      lease_expires_at=p_now+interval '20 minutes',worker_run_id=p_worker,
      quota_date=case when p.test_only then null else day end,updated_at=p_now
      where id=p.id returning * into p;
    return to_jsonb(p);
  end loop;
  return null;
end $$;

create function public.shorts_guard_publication(p_id uuid,p_token uuid,p_now timestamptz default now()) returns boolean
language plpgsql set search_path='' as $$
declare p public.shorts_publications; c public.shorts_clips; day date:=(p_now at time zone 'Asia/Seoul')::date; quota_limit int;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  select * into p from public.shorts_publications where id=p_id for update;
  if not found or p.status<>'processing' or p.lease_token is distinct from p_token or p.lease_expires_at<=p_now then return false; end if;
  select * into c from public.shorts_clips where id=p.clip_id;
  if not (select publishing_enabled from public.shorts_settings where id=1) or c.review_status<>'approved'
    or c.content_version<>p.content_version or c.approved_version is distinct from p.content_version then return false; end if;
  if not p.test_only and p.quota_date is distinct from day then
    perform pg_advisory_xact_lock(hashtext('shorts_quota_'||p.platform||day::text));
    select daily_publish_limit into quota_limit from public.shorts_settings where id=1;
    if (select count(*) from public.shorts_publications where platform=p.platform and quota_date=day and not test_only and status<>'canceled' and id<>p.id)>=quota_limit then return false; end if;
    update public.shorts_publications set quota_date=day where id=p.id;
  end if;
  return true;
end $$;

create function public.shorts_publication_checkpoint(p_id uuid,p_token uuid,p_checkpoint text default null,p_public_request_started boolean default false) returns boolean
language plpgsql set search_path='' as $$
begin
  perform 1 from public.shorts_publications where id=p_id and status='processing' and lease_token=p_token and lease_expires_at>now() for update;
  if not found then return false; end if;
  -- Persist before a public provider mutation. Heartbeats/retries cannot erase it.
  update public.shorts_publications set lease_expires_at=now()+interval '20 minutes',
    public_request_started=public_request_started or coalesce(p_public_request_started,false),updated_at=now() where id=p_id;
  if p_checkpoint is not null then
    insert into public.shorts_publish_private(publication_id,checkpoint_encrypted) values(p_id,p_checkpoint)
      on conflict(publication_id) do update set checkpoint_encrypted=excluded.checkpoint_encrypted,updated_at=now();
  end if;
  return true;
end $$;

-- Caller MUST confirm the old GitHub run is terminal before requesting recovery.
-- Recovery preserves the checkpoint; adapters query provider status before any new mutation.
create function public.shorts_recover_publication(p_id uuid,p_old_worker text,p_worker text,p_now timestamptz default now()) returns jsonb
language plpgsql set search_path='' as $$
declare p public.shorts_publications;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  update public.shorts_publications set lease_token=gen_random_uuid(),lease_expires_at=p_now+interval '20 minutes',worker_run_id=p_worker,updated_at=p_now
    where id=p_id and status='processing' and worker_run_id=p_old_worker and lease_expires_at<=p_now returning * into p;
  if not found then return null; end if;
  return to_jsonb(p);
end $$;

create function public.shorts_finish_publication(p_id uuid,p_token uuid,p_result jsonb) returns boolean
language plpgsql set search_path='' as $$
declare p public.shorts_publications; c public.shorts_clips; state text:=p_result->>'status'; retries int;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  select * into p from public.shorts_publications where id=p_id for update;
  if not found or p.status<>'processing' or p.lease_token is distinct from p_token or p.lease_expires_at<=now() then return false; end if;
  if state not in ('published','test_uploaded','retry_wait','needs_attention') then raise exception 'invalid_result'; end if;
  if (state='published' and p.test_only) or (state='test_uploaded' and not p.test_only) then raise exception 'test_mode_mismatch'; end if;
  if state in ('published','test_uploaded') and coalesce(p_result->>'providerId','')='' then raise exception 'provider_id_required'; end if;
  retries:=p.attempt_count+case when coalesce((p_result->>'consumeRetry')::boolean,false) then 1 else 0 end;
  if state='retry_wait' and retries>3 then state:='needs_attention'; end if;
  update public.shorts_publications set status=state,attempt_count=retries,
    provider_id=coalesce(p_result->>'providerId',provider_id),provider_url=coalesce(p_result->>'providerUrl',provider_url),
    published_at=case when state='published' then now() else published_at end,
    next_attempt_at=(p_result->>'nextAttemptAt')::timestamptz,
    error_code=p_result->>'code',error_message=p_result->>'code',
    quota_date=case when coalesce((p_result->>'definiteFailure')::boolean,false) then null else quota_date end,
    lease_token=null,lease_expires_at=null,updated_at=now() where id=p_id;
  if state='published' then
    if p.platform='youtube' then update public.shorts_clips set youtube_video_id=p_result->>'providerId' where id=p.clip_id; end if;
    if not exists(select 1 from public.shorts_publications where clip_id=p.clip_id and content_version=p.content_version and not test_only and status not in ('published','canceled')) then
      update public.shorts_clips set published_at=now() where id=p.clip_id;
    end if;
    select * into c from public.shorts_clips where id=p.clip_id;
    if not exists(select 1 from public.shorts_clips x join public.shorts_jobs j on j.id=x.job_id
      where x.job_id=c.job_id and x.attempt_id is not distinct from j.review_attempt_id and x.review_status='approved'
      and (not exists(select 1 from public.shorts_publications q where q.clip_id=x.id and q.content_version=x.content_version and not q.test_only and q.status='published')
      or exists(select 1 from public.shorts_publications q where q.clip_id=x.id and q.content_version=x.content_version and not q.test_only and q.status not in ('published','canceled'))))
    then update public.shorts_jobs set status='published',updated_at=now() where id=c.job_id; end if;
  end if;
  return true;
end $$;

create function public.shorts_change_publication(p_id uuid,p_action text) returns boolean language plpgsql set search_path='' as $$
declare p public.shorts_publications;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  select * into strict p from public.shorts_publications where id=p_id for update;
  if p_action='cancel' and p.status in ('queued','retry_wait') and not p.public_request_started then
    update public.shorts_publications set status='canceled',quota_date=null,updated_at=now() where id=p_id; return true;
  elsif p_action='retry' and p.status in ('retry_wait','needs_attention') and p.error_code in
    ('rate_limited','provider_temporary','credentials_expired','credentials_missing','publishing_paused','quota_wait') then
    update public.shorts_publications set status='queued',next_attempt_at=now(),error_code=null,error_message=null,updated_at=now() where id=p_id; return true;
  end if;
  raise exception 'publication_requires_reconciliation';
end $$;

create function public.shorts_update_settings(p_patch jsonb) returns public.shorts_settings language plpgsql set search_path='' as $$
declare s public.shorts_settings;
begin
  perform pg_advisory_xact_lock(hashtext('shorts_transition'));
  select * into strict s from public.shorts_settings where id=1 for update;
  s.publishing_enabled:=coalesce((p_patch->>'publishing_enabled')::boolean,s.publishing_enabled);
  s.bgm_enabled:=coalesce((p_patch->>'bgm_enabled')::boolean,s.bgm_enabled);
  s.daily_publish_limit:=coalesce((p_patch->>'daily_publish_limit')::int,s.daily_publish_limit);
  if p_patch ? 'source_playlist_id' then s.source_playlist_id:=p_patch->>'source_playlist_id'; end if;
  if p_patch ? 'allowed_categories' then s.allowed_categories:=array(select jsonb_array_elements_text(p_patch->'allowed_categories')); end if;
  if (p_patch->>'auto_generate_enabled')::boolean is true and not s.auto_generate_enabled then s.auto_generate_after:=now(); end if;
  s.auto_generate_enabled:=coalesce((p_patch->>'auto_generate_enabled')::boolean,s.auto_generate_enabled);
  if s.auto_generate_enabled and (coalesce(s.source_playlist_id,'')='' or cardinality(s.allowed_categories)<1) then raise exception 'source_policy_required'; end if;
  if s.daily_publish_limit<1 or s.daily_publish_limit>20 then raise exception 'invalid_quota'; end if;
  update public.shorts_settings set publishing_enabled=s.publishing_enabled,bgm_enabled=s.bgm_enabled,daily_publish_limit=s.daily_publish_limit,
    source_playlist_id=s.source_playlist_id,allowed_categories=s.allowed_categories,auto_generate_enabled=s.auto_generate_enabled,
    auto_generate_after=s.auto_generate_after,auto_publish=false,updated_at=now() where id=1 returning * into s;
  return s;
end $$;

do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'shorts_%'
  loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
