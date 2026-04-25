-- 017: 카카오 OAuth 메타데이터 키 보강
--
-- 목적:
--   1. Kakao raw_user_meta_data 의 nickname / profile_image_url 키도 트리거가 인식
--   2. Google과 Kakao 모두에서 동일하게 동작 (provider 비종속)
--
-- 참고: Supabase 가 OIDC 정규화로 'name' / 'picture' 도 함께 채워 주므로
--      이 보강이 없어도 대부분 동작하지만, 키 누락에 대비한 방어선이다.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'preferred_username',
      split_part(new.email, '@', 1),
      ''
    ),
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      new.raw_user_meta_data->>'profile_image_url'
    )
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
