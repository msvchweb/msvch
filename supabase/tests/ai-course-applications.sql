-- Run only against a local/test database. No production applicant data is needed.
-- Fixtures: profiles IDs ending 0001..0004 have member/staff/admin/master roles.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %', expected_state;
END;
$$;

SET LOCAL ROLE service_role;
INSERT INTO public.ai_course_applications
  (request_id, payload_hash, name, phone, application_context, survey_answers, survey_version, privacy_consent, privacy_policy_version)
VALUES ('00000000-0000-4000-8000-000000000010', repeat('a', 64), 'DB test', '010-1234-5678', '{"os":"windows"}', '{"tools":["none"]}', 'ai-course-v1', true, 'ai-course-privacy-v1');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.ai_course_applications SELECT * FROM public.ai_course_applications
$sql$, '23505');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.ai_course_applications (request_id,payload_hash,name,phone,application_context,survey_answers,survey_version,privacy_consent,privacy_policy_version)
  VALUES (gen_random_uuid(),repeat('b',64),'test','010-1234-5678','{}','{}','v1',false,'v1')
$sql$, '23514');
SELECT pg_temp.expect_error($sql$
  INSERT INTO public.ai_course_applications (request_id,payload_hash,name,phone,application_context,survey_answers,survey_version,privacy_consent,privacy_policy_version)
  VALUES (gen_random_uuid(),repeat('b',64),'test','010-1234-5678','[]','{}','v1',true,'v1')
$sql$, '23514');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT * FROM public.ai_course_applications', '42501');
SELECT pg_temp.expect_error('INSERT INTO public.ai_course_applications DEFAULT VALUES', '42501');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('INSERT INTO public.ai_course_applications DEFAULT VALUES', '42501');
SELECT pg_temp.expect_error('UPDATE public.ai_course_applications SET name = ''changed''', '42501');
SELECT pg_temp.expect_error('DELETE FROM public.ai_course_applications', '42501');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN IF (SELECT count(*) FROM public.ai_course_applications) <> 0 THEN RAISE EXCEPTION 'member read leak'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN IF (SELECT count(*) FROM public.ai_course_applications) <> 0 THEN RAISE EXCEPTION 'staff read leak'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
DO $$ BEGIN IF (SELECT count(*) FROM public.ai_course_applications) <> 1 THEN RAISE EXCEPTION 'admin cannot read'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
DO $$ BEGIN IF (SELECT count(*) FROM public.ai_course_applications) <> 1 THEN RAISE EXCEPTION 'master cannot read'; END IF; END $$;
RESET ROLE;
ROLLBACK;
