-- 019: master role 추가 — 회원의 권한 등급을 변경할 수 있는 최상위 등급
--
-- 설계:
--   - member  : 일반 회원 (기본값)
--   - staff   : 직원 (admin UI 접근, admin 동일 RLS)
--   - admin   : 컨텐츠 최상위 관리자
--   - master  : 회원관리 권한자. admin/staff 의 모든 권한 포함 + role 변경 권한 단독 보유.
--
-- 기존(015)에서 admin 만 role 변경 가능하던 것을 master 전용으로 좁힌다.

-- 1. CHECK 제약 확장
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member', 'staff', 'admin', 'master'));

-- 2. is_staff() 확장 — master 도 staff 권한 보유
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('staff', 'admin', 'master')
  );
$$;

-- 3. is_master() 신규
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'master'
  );
$$;

-- 4. role 변경 트리거 — master 만 가능
-- auth.uid() 가 NULL 인 컨텍스트(SQL Editor / service_role)는 통과시켜
-- 초기 master 지정 등 운영 작업이 가능하게 한다.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'master'
      ) THEN
        RAISE EXCEPTION 'role 변경은 master 권한자만 가능합니다';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. master 가 다른 사용자의 profile 을 UPDATE 할 수 있는 RLS 정책
-- 기존 "Users can update own profile" 와 OR 결합되어, master 는 모든 행을 업데이트할 수 있다.
DROP POLICY IF EXISTS "Master can update any profile" ON public.profiles;
CREATE POLICY "Master can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_master());
