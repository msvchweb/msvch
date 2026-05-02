-- 025: 소모임 게시판 시스템
--
-- 설계: research.md rev.2 / PLAN.md 단계 1 — ad-hoc 멤버 모델
--   - boards         : 게시판 (제목 + 가시 토글)
--   - board_members  : M:N 멤버십 (admin 이 직접 관리)
--   - board_posts    : 글 (제목 + 본문 + 이미지 + 작성자 스냅샷)
--   - board_comments : 댓글
--   - storage 버킷 'board-images'
--
-- 권한 (021 패턴 답습):
--   - SELECT: can_view_board() — 멤버 OR admin/master, 숨김 게시판은 admin 만
--   - INSERT: 멤버 본인만 (author_id = auth.uid())
--   - UPDATE: 본인 글
--   - DELETE: 본인 OR admin/master

------------------------------------------------------------------------
-- 1. 게시판
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR length(description) <= 500),
  is_visible  boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boards_visible_created
  ON public.boards (is_visible, created_at DESC);

------------------------------------------------------------------------
-- 2. 멤버 매핑
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.board_members (
  board_id    uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  added_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (board_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_board_members_profile
  ON public.board_members (profile_id);

------------------------------------------------------------------------
-- 3. 글
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.board_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 150),
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 10000),
  images      text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_posts_board_created
  ON public.board_posts (board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_posts_author
  ON public.board_posts (author_id);

------------------------------------------------------------------------
-- 4. 댓글
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.board_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_comments_post_created
  ON public.board_comments (post_id, created_at);

------------------------------------------------------------------------
-- 5. updated_at 트리거 (events_set_updated_at 패턴 재사용)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boards_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS boards_updated_at ON public.boards;
CREATE TRIGGER boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.boards_set_updated_at();

DROP TRIGGER IF EXISTS board_posts_updated_at ON public.board_posts;
CREATE TRIGGER board_posts_updated_at
  BEFORE UPDATE ON public.board_posts
  FOR EACH ROW EXECUTE FUNCTION public.boards_set_updated_at();

------------------------------------------------------------------------
-- 6. 권한 헬퍼
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_master()
    OR EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = p_board_id
        AND b.is_visible = true
        AND public.is_board_member(b.id)
    );
$$;

------------------------------------------------------------------------
-- 7. RLS — boards
------------------------------------------------------------------------
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view boards" ON public.boards;
CREATE POLICY "Members can view boards" ON public.boards
  FOR SELECT USING (public.can_view_board(id));

DROP POLICY IF EXISTS "Admin can insert boards" ON public.boards;
CREATE POLICY "Admin can insert boards" ON public.boards
  FOR INSERT WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Admin can update boards" ON public.boards;
CREATE POLICY "Admin can update boards" ON public.boards
  FOR UPDATE USING (public.is_admin_or_master());

DROP POLICY IF EXISTS "Admin can delete boards" ON public.boards;
CREATE POLICY "Admin can delete boards" ON public.boards
  FOR DELETE USING (public.is_admin_or_master());

------------------------------------------------------------------------
-- 8. RLS — board_members
------------------------------------------------------------------------
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Self or admin can view memberships" ON public.board_members;
CREATE POLICY "Self or admin can view memberships" ON public.board_members
  FOR SELECT USING (
    profile_id = auth.uid() OR public.is_admin_or_master()
  );

DROP POLICY IF EXISTS "Admin can insert memberships" ON public.board_members;
CREATE POLICY "Admin can insert memberships" ON public.board_members
  FOR INSERT WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Admin can delete memberships" ON public.board_members;
CREATE POLICY "Admin can delete memberships" ON public.board_members
  FOR DELETE USING (public.is_admin_or_master());

------------------------------------------------------------------------
-- 9. RLS — board_posts
------------------------------------------------------------------------
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read posts" ON public.board_posts;
CREATE POLICY "Members can read posts" ON public.board_posts
  FOR SELECT USING (public.can_view_board(board_id));

DROP POLICY IF EXISTS "Members can insert posts" ON public.board_posts;
CREATE POLICY "Members can insert posts" ON public.board_posts
  FOR INSERT WITH CHECK (
    public.is_board_member(board_id)
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "Author can update own posts" ON public.board_posts;
CREATE POLICY "Author can update own posts" ON public.board_posts
  FOR UPDATE USING (
    author_id = auth.uid() AND public.is_board_member(board_id)
  );

DROP POLICY IF EXISTS "Author or admin can delete posts" ON public.board_posts;
CREATE POLICY "Author or admin can delete posts" ON public.board_posts
  FOR DELETE USING (
    public.is_admin_or_master() OR author_id = auth.uid()
  );

------------------------------------------------------------------------
-- 10. RLS — board_comments
------------------------------------------------------------------------
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read comments" ON public.board_comments;
CREATE POLICY "Members can read comments" ON public.board_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.board_posts bp
      WHERE bp.id = board_comments.post_id
        AND public.can_view_board(bp.board_id)
    )
  );

DROP POLICY IF EXISTS "Members can insert comments" ON public.board_comments;
CREATE POLICY "Members can insert comments" ON public.board_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.board_posts bp
      WHERE bp.id = post_id
        AND public.is_board_member(bp.board_id)
    )
  );

DROP POLICY IF EXISTS "Author or admin can delete comments" ON public.board_comments;
CREATE POLICY "Author or admin can delete comments" ON public.board_comments
  FOR DELETE USING (
    public.is_admin_or_master() OR author_id = auth.uid()
  );

------------------------------------------------------------------------
-- 11. Storage — board-images 버킷
------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-images', 'board-images', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 누구나 읽기 (URL 알면)
DROP POLICY IF EXISTS "Public read board-images" ON storage.objects;
CREATE POLICY "Public read board-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'board-images');

-- 어떤 board 멤버라도 업로드. 진짜 게이트는 board_posts.images INSERT 시 RLS.
DROP POLICY IF EXISTS "Members upload board-images" ON storage.objects;
CREATE POLICY "Members upload board-images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'board-images'
    AND auth.uid() IS NOT NULL
    AND (
      public.is_admin_or_master()
      OR EXISTS (SELECT 1 FROM public.board_members WHERE profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members delete board-images" ON storage.objects;
CREATE POLICY "Members delete board-images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'board-images'
    AND (
      public.is_admin_or_master()
      OR EXISTS (SELECT 1 FROM public.board_members WHERE profile_id = auth.uid())
    )
  );
