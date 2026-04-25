-- 018: 동일 이메일이 다른 OAuth provider 로 이미 가입된 경우 신규 가입 거절
--
-- 목적:
--   Google 로 가입한 이메일과 동일한 이메일로 카카오(또는 그 반대) 신규 가입을 막아
--   profiles 가 같은 이메일로 중복 생성되지 않게 한다.
--
-- 거절 시점:
--   handle_new_user 트리거 안에서 RAISE EXCEPTION → auth.users INSERT 자체가 롤백된다.
--   에러 메시지는 'EMAIL_ALREADY_REGISTERED' 토큰을 포함하므로 /auth/callback 에서
--   검출해 /login?error=email_exists 로 리디렉트한다.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  duplicate_count int;
BEGIN
  -- 동일 이메일이 이미 다른 사용자(profiles 행)로 존재하면 거절
  IF new.email IS NOT NULL AND new.email <> '' THEN
    SELECT COUNT(*) INTO duplicate_count
      FROM public.profiles
     WHERE email = new.email
       AND id <> new.id;

    IF duplicate_count > 0 THEN
      RAISE EXCEPTION 'EMAIL_ALREADY_REGISTERED: %', new.email
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

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
