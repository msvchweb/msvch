-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  phone text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Anyone can view profiles" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Groups
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  description text,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;

create policy "Anyone can view groups" on public.groups
  for select using (true);

-- Group posts
create table public.group_posts (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups on delete cascade not null,
  author_id uuid references public.profiles on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.group_posts enable row level security;

create policy "Anyone can view posts" on public.group_posts
  for select using (true);

create policy "Authenticated users can create posts" on public.group_posts
  for insert with check (auth.uid() = author_id);

create policy "Authors can update own posts" on public.group_posts
  for update using (auth.uid() = author_id);

create policy "Authors can delete own posts" on public.group_posts
  for delete using (auth.uid() = author_id);

-- Seed initial groups
insert into public.groups (name, slug, description) values
  ('공지', 'gongji', '교회 공지사항 토론'),
  ('주보', 'jubo', '주보 관련 나눔');
