alter table public.weeklies
  add column if not exists mobile_services jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'weeklies_mobile_services_array'
      and conrelid = 'public.weeklies'::regclass
  ) then
    alter table public.weeklies
      add constraint weeklies_mobile_services_array
      check (jsonb_typeof(mobile_services) = 'array');
  end if;
end $$;

create table if not exists public.worship_resources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('creed', 'hymn', 'scripture', 'text', 'link')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  reference text not null default '',
  content text not null default '',
  external_url text,
  source_label text,
  rights_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worship_resources_reference_length
    check (char_length(reference) <= 200),
  constraint worship_resources_content_length
    check (char_length(content) <= 30000),
  constraint worship_resources_external_url_length
    check (external_url is null or char_length(external_url) <= 2000),
  constraint worship_resources_source_length
    check (source_label is null or char_length(source_label) <= 200),
  constraint worship_resources_rights_length
    check (rights_note is null or char_length(rights_note) <= 2000),
  constraint worship_resources_https_url
    check (external_url is null or external_url ~ '^https://'),
  constraint worship_resources_rights_for_full_text
    check (
      kind not in ('hymn', 'scripture')
      or btrim(content) = ''
      or (nullif(btrim(source_label), '') is not null and nullif(btrim(rights_note), '') is not null)
    )
);

create index if not exists worship_resources_active_kind_idx
  on public.worship_resources (is_active, kind, title);

create or replace function public.worship_resources_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists worship_resources_updated_at on public.worship_resources;
create trigger worship_resources_updated_at
  before update on public.worship_resources
  for each row execute function public.worship_resources_set_updated_at();

alter table public.worship_resources enable row level security;

drop policy if exists "Public can read worship resources" on public.worship_resources;
create policy "Public can read worship resources"
  on public.worship_resources for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can insert worship resources" on public.worship_resources;
create policy "Admin can insert worship resources"
  on public.worship_resources for insert
  to authenticated
  with check (public.is_admin_or_master());

drop policy if exists "Admin can update worship resources" on public.worship_resources;
create policy "Admin can update worship resources"
  on public.worship_resources for update
  to authenticated
  using (public.is_admin_or_master())
  with check (public.is_admin_or_master());

drop policy if exists "Admin can delete worship resources" on public.worship_resources;
revoke all privileges on table public.worship_resources from anon, authenticated;
grant select on table public.worship_resources to anon, authenticated;
grant insert, update on table public.worship_resources to authenticated;
grant select, insert, update, delete on table public.worship_resources to service_role;

insert into public.worship_resources (
  id, kind, title, reference, content, source_label, rights_note, is_active
)
values (
  '00000000-0000-4000-8000-000000000001',
  'creed',
  '사도신경',
  '신앙고백',
  E'전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며,\n그 외아들 우리 주 예수 그리스도를 믿사오니,\n이는 성령으로 잉태하사 동정녀 마리아에게 나시고,\n본디오 빌라도에게 고난을 받으사 십자가에 못 박혀 죽으시고,\n장사한 지 사흘 만에 죽은 자 가운데서 다시 살아나시며,\n하늘에 오르사 전능하신 하나님 우편에 앉아 계시다가,\n저리로서 산 자와 죽은 자를 심판하러 오시리라.\n성령을 믿사오며, 거룩한 공회와 성도가 서로 교통하는 것과,\n죄를 사하여 주시는 것과, 몸이 다시 사는 것과,\n영원히 사는 것을 믿사옵나이다. 아멘.',
  '명성비전교회 예배문',
  '교회 예배용 고백문',
  true
)
on conflict (id) do nothing;
