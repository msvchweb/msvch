-- blog-images 버킷: staff(admin/staff role) 업로드/수정/삭제 허용
-- 기존(마이그레이션 009)에서는 service_role 만 업로드 가능했음.
-- 관리자 UI에서 공지 히어로 이미지를 교체할 수 있도록 RLS 정책 추가.

CREATE POLICY "Staff can upload blog-images" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'blog-images' AND public.is_staff());

CREATE POLICY "Staff can update blog-images" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'blog-images' AND public.is_staff());

CREATE POLICY "Staff can delete blog-images" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'blog-images' AND public.is_staff());
