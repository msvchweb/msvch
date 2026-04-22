-- 012: 주보 마스터 데이터 테이블 (Live Reference 방식)
-- 주보는 이 테이블들을 렌더 시점에 조회하며, 값이 변경되면 기존 주보에도 자동 반영된다.
-- (스냅샷이 필요해지면 별도 마이그레이션에서 weeklies.master_snapshot jsonb 추가 검토)

-- 공통 사이트 설정(key-value). 연간 표어 등 단일 값 저장
CREATE TABLE IF NOT EXISTS public.church_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 소그룹 목장 (2026 기준 40개). id = 주보 상의 목장 번호
CREATE TABLE IF NOT EXISTS public.mokjang_entries (
  id      integer PRIMARY KEY,
  name    text NOT NULL DEFAULT '',
  sub     text NOT NULL DEFAULT '',
  year    integer,
  active  boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- 섬기는 분들 (역할, 이름 묶음). seq 로 정렬
CREATE TABLE IF NOT EXISTS public.servants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq        integer NOT NULL,
  role       text NOT NULL,
  names      text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS servants_seq_idx ON public.servants (seq);

-- 우리가 후원하는 분들 (섹션 3개)
CREATE TABLE IF NOT EXISTS public.support_sections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq        integer NOT NULL,
  heading    text NOT NULL,
  lines      jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS support_sections_seq_idx ON public.support_sections (seq);

-- 교회공동체 기도제목 (7개 내외, 비정기 변경)
CREATE TABLE IF NOT EXISTS public.community_prayers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq        integer NOT NULL,
  text       text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS community_prayers_seq_idx ON public.community_prayers (seq);

-- RLS: 공개 읽기, admin 전용 쓰기
ALTER TABLE public.church_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mokjang_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_prayers  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view church_settings"    ON public.church_settings    FOR SELECT USING (true);
CREATE POLICY "Anyone can view mokjang_entries"    ON public.mokjang_entries    FOR SELECT USING (true);
CREATE POLICY "Anyone can view servants"           ON public.servants           FOR SELECT USING (true);
CREATE POLICY "Anyone can view support_sections"   ON public.support_sections   FOR SELECT USING (true);
CREATE POLICY "Anyone can view community_prayers"  ON public.community_prayers  FOR SELECT USING (true);

CREATE POLICY "Admins manage church_settings"   ON public.church_settings   FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins manage mokjang_entries"   ON public.mokjang_entries   FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins manage servants"          ON public.servants          FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins manage support_sections"  ON public.support_sections  FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins manage community_prayers" ON public.community_prayers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 초기 시드 데이터: 2026년 표어 (사용자 요청 유지값)
INSERT INTO public.church_settings (key, value)
VALUES ('topic_of_year', '{"text":"복음의 열매","year":2026}'::jsonb)
ON CONFLICT (key) DO NOTHING;
