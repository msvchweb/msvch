-- Notices (공지사항)
create table public.notices (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  category text default '일반' check (category in ('일반', '긴급', '행사')),
  content text not null default '',
  is_public boolean default false,
  date date default current_date,
  created_at timestamptz default now()
);

alter table public.notices enable row level security;

create policy "Anyone can view public notices" on public.notices
  for select using (is_public = true);

create policy "Admins can manage notices" on public.notices
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Weeklies (주보)
create table public.weeklies (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date date,
  pdf_url text,
  created_at timestamptz default now()
);

alter table public.weeklies enable row level security;

create policy "Anyone can view weeklies" on public.weeklies
  for select using (true);

create policy "Admins can manage weeklies" on public.weeklies
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Storage bucket for weeklies (PDF)
insert into storage.buckets (id, name, public)
values ('weeklies', 'weeklies', true)
on conflict (id) do nothing;

create policy "Anyone can view weekly files" on storage.objects
  for select using (bucket_id = 'weeklies');

create policy "Admins can upload weekly files" on storage.objects
  for insert with check (
    bucket_id = 'weeklies'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete weekly files" on storage.objects
  for delete using (
    bucket_id = 'weeklies'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
