-- 035: profiles SELECT 정책 좁히기 — PIPA(개인정보보호법) 위반 차단
--
-- 배경:
--   001 에서 만든 "Anyone can view profiles" using (true) 정책이
--   014 에서 email/avatar_url 컬럼 추가된 이후로도 그대로 유지되어,
--   anon key 만으로 전 회원의 name/phone/email/role 이 무인증 조회되던 상태.
--
-- 변경:
--   - 본인 행만 SELECT (auth.uid() = id)
--   - staff 이상은 모든 행 SELECT (is_staff())
--
-- 영향:
--   - 게시판(boards) 시스템: author_name 스냅샷 컬럼을 쓰므로 영향 없음.
--   - 자기 프로필 조회/role 체크: 전부 .eq("id", user.id) 패턴이라 정상 동작.
--   - 관리자 멤버 목록(/admin/members, /admin/boards/[id]/members): staff 이상만 접근하는 페이지라 정상.
--   - 레거시 groups 페이지(/groups/*): group_posts JOIN profiles(name) 가 비-staff 사용자에게는 null 로 떨어짐.
--     (이 페이지는 boards 025 로 대체되어 비핵심. 작성자 이름이 보이지 않을 뿐 동작은 함.)

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Staff see all profiles" ON public.profiles
  FOR SELECT USING (public.is_staff());
