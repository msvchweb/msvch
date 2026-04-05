-- Gallery albums
create table public.gallery_albums (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text check (category in ('예배', '교회학교', '교회행사', '봉사센터', '새가족')),
  date date,
  thumbnail_url text,
  is_public boolean default false,
  created_at timestamptz default now()
);

alter table public.gallery_albums enable row level security;

create policy "Anyone can view public albums" on public.gallery_albums
  for select using (is_public = true);

create policy "Admins can manage albums" on public.gallery_albums
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Gallery images
create table public.gallery_images (
  id uuid default gen_random_uuid() primary key,
  album_id uuid references public.gallery_albums on delete cascade not null,
  image_url text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.gallery_images enable row level security;

create policy "Anyone can view images of public albums" on public.gallery_images
  for select using (
    exists (select 1 from public.gallery_albums where id = album_id and is_public = true)
  );

create policy "Admins can manage images" on public.gallery_images
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Storage bucket for gallery
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Anyone can view gallery files" on storage.objects
  for select using (bucket_id = 'gallery');

create policy "Admins can upload gallery files" on storage.objects
  for insert with check (
    bucket_id = 'gallery'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete gallery files" on storage.objects
  for delete using (
    bucket_id = 'gallery'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
