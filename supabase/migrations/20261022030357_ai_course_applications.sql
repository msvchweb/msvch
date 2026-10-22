CREATE TABLE public.ai_course_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 50),
  phone text NOT NULL CHECK (phone ~ '^010-[0-9]{4}-[0-9]{4}$'),
  application_context jsonb NOT NULL CHECK (jsonb_typeof(application_context) = 'object'),
  survey_answers jsonb NOT NULL CHECK (jsonb_typeof(survey_answers) = 'object'),
  survey_version text NOT NULL CHECK (char_length(btrim(survey_version)) > 0),
  privacy_consent boolean NOT NULL CHECK (privacy_consent = true),
  privacy_policy_version text NOT NULL CHECK (char_length(btrim(privacy_policy_version)) > 0),
  privacy_consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_course_applications_created_id_idx
  ON public.ai_course_applications (created_at DESC, id DESC);

ALTER TABLE public.ai_course_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_course_applications FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ai_course_applications TO authenticated;
GRANT INSERT, SELECT ON TABLE public.ai_course_applications TO service_role;
CREATE POLICY "Admin can read AI course applications"
  ON public.ai_course_applications FOR SELECT TO authenticated
  USING (public.is_admin_or_master());
