-- 014: profiles 테이블에 이메일/아바타 컬럼 + handle_new_user 트리거 보강
--
-- 목적:
--   1. Google OAuth 로 들어오는 사용자의 프로필 정보(이메일, 아바타) 저장
--   2. 트리거가 Google 메타데이터(full_name, picture) 와 기존 이메일 가입의 name 모두 처리
--   3. 기존 사용자(email 가입)의 email 컬럼 백필

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 기존 사용자 이메일 백필 (auth.users.email 에서 복사)
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id AND p.email IS NULL;

-- 트리거 함수 교체: Google OAuth / 이메일 가입 둘 다 커버
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      ''
    ),
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 자체(on_auth_user_created)는 재생성 불필요 — 함수만 교체하면 됨.
