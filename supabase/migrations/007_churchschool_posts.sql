-- Church school posts synced from Naver blog
create table public.churchschool_posts (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,          -- naver-{logNo}
  title text not null,
  content text not null,
  naver_url text not null,
  published_at timestamptz not null,
  created_at timestamptz default now()
);

alter table public.churchschool_posts enable row level security;

create policy "Anyone can view churchschool posts" on public.churchschool_posts
  for select using (true);

create policy "Service role can manage churchschool posts" on public.churchschool_posts
  for all using (true)
  with check (true);
