-- blog-images Storage 버킷 생성 (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,  -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 누구나 읽기 가능
create policy "Public read blog-images"
  on storage.objects for select
  using (bucket_id = 'blog-images');

-- service role만 업로드/삭제 가능 (RLS 우회)

-- notices 테이블에 images 컬럼 추가
alter table public.notices
  add column if not exists images text[] not null default '{}';

-- churchschool_posts 테이블에 images 컬럼 추가
alter table public.churchschool_posts
  add column if not exists images text[] not null default '{}';
