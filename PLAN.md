# 소모임 게시판 시스템 — 구현 계획서

> 기반: `research.md` (rev. 2 — ad-hoc 멤버 모델)
> 작성일: 2026-05-02
> 범위: 웹페이지 전용 UI. **백엔드/API/DTO 는 모바일 앱이 추가될 때 무수정으로 재사용 가능하도록 설계**.
> AGENTS.md 행동 규칙 준수 — 시키지 않은 변경 금지, 외부 라이브러리 추가 금지(이미 있는 supabase-js + zod + lucide 만 사용).

---

## 0. 사전 점검 — 실제 코드베이스에서 확인한 사실

| 항목 | 확인 결과 | 의미 |
|---|---|---|
| `createApiClient(request)` (`src/lib/supabase/api.ts`) | Bearer 토큰 OR 쿠키 자동 분기. RLS 가 동일하게 동작 | **모바일 호환은 이미 인프라 차원에서 완비** — API 라우트가 이걸 쓰면 자동으로 mobile-ready |
| `requireAdmin(request)` / `requireMaster(request)` (`src/lib/admin-auth.ts`) | 역할 검증 + AuthError throw | admin API 의 표준 진입점. 그대로 답습 |
| `useMe()` + `canDelete(me, authorId)` (`src/lib/use-me.ts`) | `/api/me` 폴링 + onAuthStateChange. 삭제 권한은 admin/master OR 본인 | 멤버 UI 의 삭제 버튼 게이트 — 표준 패턴 |
| RLS 헬퍼 — `is_staff()`(015), `is_admin_or_master()`(021), `is_content_author()`(021) | 모든 컨텐츠 테이블이 이 패턴 사용 | 본 시스템도 같은 패턴. `is_board_member()` 만 신규 추가 |
| 트리거 — `events_set_updated_at()`(022) | BEFORE UPDATE NOW() | `boards`, `board_posts` 에 동일 적용 |
| Storage 직접 업로드 (`/admin/notices` hero, `/admin/gallery`) | `supabase.storage.from('bucket').upload(path, file)` + RLS | 멤버 UI 글쓰기에서 그대로 답습. 모바일 RN 도 `@supabase/supabase-js` 로 동일 호출 |
| 이미지 압축 (`src/lib/image-compress.ts`) | Canvas 기반 JPEG 재인코딩 (5MB 자동 압축) | EXIF 제거 + 파일 크기 제한 — 그대로 활용 |
| `validateFile()` (`src/lib/validation.ts`) | 확장자 화이트리스트 + 크기 제한 | 모든 업로드의 1차 검증 |
| `parseLimit()` (`src/lib/validation.ts`) | limit 파라미터 + 상한 100 | 페이지네이션 표준 |
| `(member)` route group (`src/app/(member)/groups/`, `profile/`) | 미들웨어가 `/groups`, `/profile`, `/admin` 보호. 비로그인 → `/login?next=...` | `/boards/:path*` 추가 1줄 |
| `next.config.ts` CSP — `connect-src 'self' https://*.supabase.co` | Supabase storage 업로드 OK | 새 도메인 추가 불필요 |
| `Storage 버킷 RLS` 패턴 (마이그레이션 016) | `is_staff()` 로 INSERT/UPDATE/DELETE 좁힘 | 본 시스템은 `EXISTS(board_members ...)` 로 좁힘 |
| `next.config.ts` 의 `images.remotePatterns` — `*.supabase.co` 허용 | 글에 이미지 첨부 시 `<Image>` 또는 `<img>` 둘 다 OK | next/image 사용 가능 |
| 기존 `groups/group_posts` (001 마이그레이션) | 거의 사용 안 함 | **건드리지 않음** — 본 시스템은 `boards/board_*` 별도 네임스페이스 |

---

## A. 모바일 호환성 원칙 (전 구현 단계 적용)

본 PLAN 의 **모든 멤버용 API 와 응답 DTO 는 다음 7개 규칙을 위반하지 않는다**.

| # | 원칙 | 적용 |
|---|---|---|
| **A-1** | 인증은 `createApiClient(request)` 단일 진입점 | Bearer(모바일) 와 쿠키(웹) 자동 분기. 라우트는 인증 방식을 모름 |
| **A-2** | 응답은 항상 **camelCase JSON DTO** | snake_case 컬럼명 누출 금지. 변환은 `toBoardDto()` 등 헬퍼로 분리 |
| **A-3** | 날짜는 **ISO 8601 문자열** | `toISOString()` 결과 그대로. 타임존 의존 코드는 클라이언트가 처리 |
| **A-4** | 에러 응답은 `{ error: string }` 통일, 상태코드 표준(400/401/403/404/500) | 모바일 클라이언트가 동일 핸들러 |
| **A-5** | 권한 정보(`canDelete` 등)는 **서버가 계산해 응답에 포함** | 모바일이 RLS 룰 재현할 필요 없음 |
| **A-6** | 이미지 업로드는 **클라이언트 → Supabase Storage 직접** + Storage RLS 가 게이트 | 웹/모바일 모두 supabase-js SDK 사용 |
| **A-7** | 페이지네이션은 `limit` + `cursor` (created_at 기반) | 무한 스크롤·하향 호환 |

> **A-7 결정**: cursor 페이지네이션 v1 부터 도입. offset 은 동시 INSERT 시 누락이 생겨 모바일 무한스크롤 UX 가 깨짐. cursor 는 `created_at` ISO 문자열 + `id` tie-breaker.

---

## 1. 단계 1 — DB 마이그레이션 (`supabase/migrations/025_boards.sql`)

### 1-1. 전체 SQL

```sql
-- 025: 소모임 게시판 시스템
--
-- 설계: research.md rev.2 — ad-hoc 멤버 모델
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
```

### 1-2. 적용 절차

1. Supabase 콘솔 → SQL Editor → 위 SQL 붙여넣고 실행
2. Tables 탭에서 4개 테이블 생성 + RLS 활성 확인
3. Storage → Buckets 탭에서 `board-images` 버킷 + 4개 정책 확인 (read/insert/delete + 016 패턴)

---

## 2. 단계 2 — 타입 + Zod 스키마

### 2-1. `src/types/board.ts` (신규)

```ts
/**
 * 소모임 게시판 — DTO + 라벨.
 * 마이그레이션 025 와 1:1 대응. camelCase 만 사용 (snake_case 누출 금지).
 *
 * 모든 필드는 platform-neutral — 웹/모바일이 동일하게 소비.
 */

export interface Board {
  id: string;
  title: string;
  description: string | null;
  isVisible: boolean;
  memberCount: number;       // 서버 합성
  postCount: number;         // 서버 합성 (옵션 — 목록 응답에만)
  createdAt: string;         // ISO 8601
  updatedAt: string;
}

export interface BoardMember {
  profileId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  addedAt: string;
}

export interface BoardPost {
  id: string;
  boardId: string;
  authorId: string | null;
  authorName: string;        // 작성 시점 닉네임 스냅샷
  title: string;
  content: string;
  images: string[];          // Supabase Storage public URL
  commentCount: number;      // 목록·상세 모두 포함
  canDelete: boolean;        // 서버 계산: admin/master OR 본인 (모바일 동일 사용)
  createdAt: string;
  updatedAt: string;
}

export interface BoardComment {
  id: string;
  postId: string;
  authorId: string | null;
  authorName: string;
  content: string;
  canDelete: boolean;
  createdAt: string;
}

/** 페이지네이션 응답 — 모든 목록 엔드포인트 공용 */
export interface CursorPage<T> {
  items: T[];
  /** 다음 페이지 cursor — null 이면 끝 */
  nextCursor: string | null;
}

/** 입력 페이로드 (web + mobile 공용) */
export interface BoardCreateInput {
  title: string;
  description?: string;
  initialMemberIds?: string[];
}

export interface BoardUpdateInput {
  title?: string;
  description?: string;
  isVisible?: boolean;
}

export interface BoardPostInput {
  title: string;
  content: string;
  images?: string[];
}

export interface BoardCommentInput {
  content: string;
}
```

### 2-2. `src/lib/validation.ts` (추가)

기존 파일 끝에 다음 블록 추가:

```ts
/** 소모임 게시판 — 마이그레이션 025 */

export const BoardCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(100, "제목은 100자까지"),
  description: z.string().max(500).optional(),
  initialMemberIds: z.array(z.string().uuid()).max(500).optional(),
});

export const BoardUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isVisible: z.boolean().optional(),
});

export const BoardMembersReplaceSchema = z.object({
  profileIds: z.array(z.string().uuid()).max(500),
});

export const BoardPostSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(150, "제목은 150자까지"),
  content: z.string().min(1, "내용을 입력하세요").max(10000, "내용은 10,000자까지"),
  images: z
    .array(
      z.string().url().refine(
        (u) => u.includes(".supabase.co/storage/v1/object/public/board-images/"),
        "허용되지 않은 이미지 URL"
      ),
    )
    .max(10, "이미지는 최대 10장")
    .default([]),
});

export const BoardCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

/** cursor 파싱 — `${ISO_DATETIME}|${id}` 형태 */
export function parseBoardCursor(raw: string | null): { createdAt: string; id: string } | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf("|");
  if (idx < 0) return null;
  const createdAt = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

export function buildBoardCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}
```

> **A-2 / A-7 준수**: cursor 는 ISO 문자열 + uuid — URL 안전, 모바일 클라이언트가 그대로 다음 호출에 보냄.

---

## 3. 단계 3 — 서버 라이브러리 (`src/lib/boards.ts`)

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Board,
  BoardComment,
  BoardMember,
  BoardPost,
  CursorPage,
} from "@/types/board";
import { buildBoardCursor } from "@/lib/validation";

/**
 * 게시판 데이터 함수 — Server Component / API 라우트 공용.
 * 모든 함수는 RLS 가 적용된 supabase 클라이언트를 받아 결과를 DTO 로 변환한다.
 * RLS 가 권한 가드 — 호출자가 권한 검사할 필요 없음.
 */

interface BoardRow {
  id: string;
  title: string;
  description: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

interface BoardPostRow {
  id: string;
  board_id: string;
  author_id: string | null;
  author_name: string;
  title: string;
  content: string;
  images: string[];
  created_at: string;
  updated_at: string;
}

interface BoardCommentRow {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

const POST_COLUMNS =
  "id, board_id, author_id, author_name, title, content, images, created_at, updated_at";
const COMMENT_COLUMNS =
  "id, post_id, author_id, author_name, content, created_at";

export function toBoardDto(
  row: BoardRow,
  memberCount: number,
  postCount: number,
): Board {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    isVisible: row.is_visible,
    memberCount,
    postCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBoardPostDto(
  row: BoardPostRow,
  commentCount: number,
  viewerId: string | null,
  viewerIsAdminOrMaster: boolean,
): BoardPost {
  return {
    id: row.id,
    boardId: row.board_id,
    authorId: row.author_id,
    authorName: row.author_name,
    title: row.title,
    content: row.content,
    images: row.images ?? [],
    commentCount,
    canDelete:
      viewerIsAdminOrMaster ||
      (viewerId !== null && row.author_id === viewerId),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBoardCommentDto(
  row: BoardCommentRow,
  viewerId: string | null,
  viewerIsAdminOrMaster: boolean,
): BoardComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    canDelete:
      viewerIsAdminOrMaster ||
      (viewerId !== null && row.author_id === viewerId),
    createdAt: row.created_at,
  };
}

/** 현재 사용자의 role 을 가져온다 (admin 분기 + canDelete 계산용) */
export async function getViewerContext(supabase: SupabaseClient): Promise<{
  userId: string | null;
  isAdminOrMaster: boolean;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, isAdminOrMaster: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  return {
    userId: user.id,
    isAdminOrMaster: profile?.role === "admin" || profile?.role === "master",
  };
}

/**
 * 내가 볼 수 있는 게시판 목록.
 * RLS 가 자동으로 (멤버이고 is_visible) OR (admin/master) 만 노출.
 * memberCount / postCount 는 서버에서 합성.
 */
export async function listVisibleBoards(supabase: SupabaseClient): Promise<Board[]> {
  const { data: rows } = await supabase
    .from("boards")
    .select("id, title, description, is_visible, created_at, updated_at")
    .order("created_at", { ascending: false })
    .returns<BoardRow[]>();

  if (!rows || rows.length === 0) return [];

  const boardIds = rows.map((b) => b.id);

  // 카운트는 head:true + count:'exact' 로 가벼운 응답
  const memberCounts = await fetchCounts(supabase, "board_members", "board_id", boardIds);
  const postCounts = await fetchCounts(supabase, "board_posts", "board_id", boardIds);

  return rows.map((r) =>
    toBoardDto(r, memberCounts[r.id] ?? 0, postCounts[r.id] ?? 0)
  );
}

async function fetchCounts(
  supabase: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
): Promise<Record<string, number>> {
  // 단순화 — 각 id 별 head 카운트. 게시판 수가 많아지면 group by RPC 로 교체.
  const out: Record<string, number> = {};
  await Promise.all(
    ids.map(async (id) => {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(column, id);
      out[id] = count ?? 0;
    }),
  );
  return out;
}

/** 단건 board (RLS 가 가시성 + 멤버십 게이트) */
export async function getBoardById(
  supabase: SupabaseClient,
  id: string,
): Promise<Board | null> {
  const { data } = await supabase
    .from("boards")
    .select("id, title, description, is_visible, created_at, updated_at")
    .eq("id", id)
    .maybeSingle<BoardRow>();

  if (!data) return null;
  const memberCounts = await fetchCounts(supabase, "board_members", "board_id", [id]);
  const postCounts = await fetchCounts(supabase, "board_posts", "board_id", [id]);
  return toBoardDto(data, memberCounts[id] ?? 0, postCounts[id] ?? 0);
}

/** 게시판 글 목록 — cursor 페이지네이션 */
export async function listPosts(
  supabase: SupabaseClient,
  boardId: string,
  options: {
    limit: number;
    cursor: { createdAt: string; id: string } | null;
    viewerId: string | null;
    viewerIsAdminOrMaster: boolean;
  },
): Promise<CursorPage<BoardPost>> {
  let query = supabase
    .from("board_posts")
    .select(POST_COLUMNS)
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(options.limit + 1);

  if (options.cursor) {
    // (created_at < cursor.createdAt) OR (created_at = cursor.createdAt AND id < cursor.id)
    query = query.or(
      `created_at.lt.${options.cursor.createdAt},and(created_at.eq.${options.cursor.createdAt},id.lt.${options.cursor.id})`,
    );
  }

  const { data } = await query.returns<BoardPostRow[]>();
  const rows = data ?? [];
  const hasMore = rows.length > options.limit;
  const sliced = hasMore ? rows.slice(0, options.limit) : rows;

  // commentCount 합성
  const postIds = sliced.map((p) => p.id);
  const commentCounts = postIds.length
    ? await fetchCounts(supabase, "board_comments", "post_id", postIds)
    : {};

  const items = sliced.map((r) =>
    toBoardPostDto(
      r,
      commentCounts[r.id] ?? 0,
      options.viewerId,
      options.viewerIsAdminOrMaster,
    ),
  );

  const last = sliced[sliced.length - 1];
  const nextCursor = hasMore && last
    ? buildBoardCursor(last.created_at, last.id)
    : null;

  return { items, nextCursor };
}

/** 단건 글 + 모든 댓글 */
export async function getPostWithComments(
  supabase: SupabaseClient,
  postId: string,
  viewerId: string | null,
  viewerIsAdminOrMaster: boolean,
): Promise<{ post: BoardPost; comments: BoardComment[] } | null> {
  const { data: postRow } = await supabase
    .from("board_posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .maybeSingle<BoardPostRow>();

  if (!postRow) return null;

  const { data: commentRows } = await supabase
    .from("board_comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .returns<BoardCommentRow[]>();

  const comments = (commentRows ?? []).map((c) =>
    toBoardCommentDto(c, viewerId, viewerIsAdminOrMaster),
  );
  const post = toBoardPostDto(
    postRow,
    comments.length,
    viewerId,
    viewerIsAdminOrMaster,
  );
  return { post, comments };
}

/** 작성자 닉네임 스냅샷 — board_posts/board_comments INSERT 시 사용 */
export async function getAuthorNameSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single<{ name: string }>();
  return (data?.name?.trim() || "이름없음").slice(0, 60);
}
```

> **모바일 호환 포인트**: 이 파일은 서버 only(Server Component / API 라우트). 모바일은 이 함수를 직접 호출하지 않고 API 응답만 소비 — DTO 형태가 일정하면 OK.

---

## 4. 단계 4 — Admin API 라우트

### 4-1. `src/app/api/admin/boards/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { BoardCreateSchema } from "@/lib/validation";
import { listVisibleBoards, toBoardDto } from "@/lib/boards";
import type { Board } from "@/types/board";

export const dynamic = "force-dynamic";

/** GET — 전체 게시판 목록 (admin 은 RLS 상 숨김 포함 모두 보임) */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = await createApiClient(request);
    const boards = await listVisibleBoards(supabase);
    return NextResponse.json<Board[]>(boards);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("admin/boards GET", err);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

/** POST — 게시판 신설 (옵션: 초기 멤버 동시 등록) */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAdmin(request);
    const parsed = BoardCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }

    const supabase = await createApiClient(request);
    const { data: row, error } = await supabase
      .from("boards")
      .insert({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        created_by: userId,
      })
      .select("id, title, description, is_visible, created_at, updated_at")
      .single();

    if (error || !row) {
      console.error("admin/boards POST", error);
      return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }

    // 초기 멤버 등록 (선택)
    const memberIds = parsed.data.initialMemberIds ?? [];
    if (memberIds.length > 0) {
      const rows = memberIds.map((profile_id) => ({
        board_id: row.id,
        profile_id,
        added_by: userId,
      }));
      const { error: mErr } = await supabase.from("board_members").insert(rows);
      if (mErr) console.error("admin/boards POST members", mErr);
    }

    return NextResponse.json<Board>(
      toBoardDto(row, memberIds.length, 0),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("admin/boards POST", err);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
```

### 4-2. `src/app/api/admin/boards/[id]/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { BoardUpdateSchema } from "@/lib/validation";

type Params = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const parsed = BoardUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }

    const patch: Record<string, string | boolean | null> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      patch.description = parsed.data.description ?? null;
    if (parsed.data.isVisible !== undefined)
      patch.is_visible = parsed.data.isVisible;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "변경 사항이 없습니다." }, { status: 400 });
    }

    const supabase = await createApiClient(request);
    const { error } = await supabase.from("boards").update(patch).eq("id", id);
    if (error) {
      console.error("admin/boards PATCH", error);
      return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const supabase = await createApiClient(request);
    // CASCADE 가 board_members/posts/comments 자동 정리.
    // Storage 파일은 별도 cleanup (v2 cron) — 우선 DB 만 삭제.
    const { error } = await supabase.from("boards").delete().eq("id", id);
    if (error) {
      console.error("admin/boards DELETE", error);
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
```

### 4-3. `src/app/api/admin/boards/[id]/members/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { BoardMembersReplaceSchema } from "@/lib/validation";
import type { BoardMember } from "@/types/board";

type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";

interface MemberRow {
  profile_id: string;
  added_at: string;
  profiles: {
    name: string;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("board_members")
      .select("profile_id, added_at, profiles(name, email, avatar_url)")
      .eq("board_id", id)
      .returns<MemberRow[]>();

    if (error) {
      console.error("admin/boards/members GET", error);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    const dto: BoardMember[] = (data ?? []).map((row) => ({
      profileId: row.profile_id,
      name: row.profiles?.name ?? "(이름없음)",
      email: row.profiles?.email ?? null,
      avatarUrl: row.profiles?.avatar_url ?? null,
      addedAt: row.added_at,
    }));
    return NextResponse.json<BoardMember[]>(dto);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

/** PUT — 멤버 명단 일괄 교체 (트랜잭션 RPC 가 없어 두 단계로 처리) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { userId } = await requireAdmin(request);
    const { id } = await params;
    const parsed = BoardMembersReplaceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }

    const supabase = await createApiClient(request);

    // 기존 명단 조회
    const { data: existing } = await supabase
      .from("board_members")
      .select("profile_id")
      .eq("board_id", id)
      .returns<{ profile_id: string }[]>();

    const existingIds = new Set((existing ?? []).map((r) => r.profile_id));
    const desiredIds = new Set(parsed.data.profileIds);

    const toRemove = [...existingIds].filter((x) => !desiredIds.has(x));
    const toAdd = [...desiredIds].filter((x) => !existingIds.has(x));

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("board_members")
        .delete()
        .eq("board_id", id)
        .in("profile_id", toRemove);
      if (error) {
        console.error("admin/boards/members PUT remove", error);
        return NextResponse.json({ error: "수정 실패" }, { status: 500 });
      }
    }

    if (toAdd.length > 0) {
      const rows = toAdd.map((profile_id) => ({
        board_id: id,
        profile_id,
        added_by: userId,
      }));
      const { error } = await supabase.from("board_members").insert(rows);
      if (error) {
        console.error("admin/boards/members PUT add", error);
        return NextResponse.json({ error: "수정 실패" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, added: toAdd.length, removed: toRemove.length });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
```

---

## 5. 단계 5 — 멤버 API 라우트

### 5-1. `src/app/api/boards/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { listVisibleBoards } from "@/lib/boards";
import type { Board } from "@/types/board";

export const dynamic = "force-dynamic";

/** GET — 내가 볼 수 있는 게시판 목록. RLS 가 (가시 + 멤버) OR admin 만 노출. */
export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const boards = await listVisibleBoards(supabase);
  return NextResponse.json<Board[]>(boards);
}
```

### 5-2. `src/app/api/boards/[id]/posts/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import {
  BoardPostSchema,
  parseBoardCursor,
  parseLimit,
} from "@/lib/validation";
import {
  getAuthorNameSnapshot,
  getViewerContext,
  listPosts,
  toBoardPostDto,
} from "@/lib/boards";
import type { BoardPost, CursorPage } from "@/types/board";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const supabase = await createApiClient(request);
  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"), 20);
  const cursor = parseBoardCursor(request.nextUrl.searchParams.get("cursor"));

  const page = await listPosts(supabase, id, {
    limit,
    cursor,
    viewerId: userId,
    viewerIsAdminOrMaster: isAdminOrMaster,
  });
  return NextResponse.json<CursorPage<BoardPost>>(page);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const supabase = await createApiClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = BoardPostSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
      { status: 400 },
    );
  }

  const authorName = await getAuthorNameSnapshot(supabase, user.id);

  const { data: row, error } = await supabase
    .from("board_posts")
    .insert({
      board_id: id,
      author_id: user.id,             // RLS 가 author_id = auth.uid() 강제
      author_name: authorName,
      title: parsed.data.title,
      content: parsed.data.content,
      images: parsed.data.images,
    })
    .select("id, board_id, author_id, author_name, title, content, images, created_at, updated_at")
    .single();

  if (error || !row) {
    console.error("boards/posts POST", error);
    // RLS 위반(비멤버)이면 PostgREST 가 에러 반환 — 클라이언트엔 403 매핑
    return NextResponse.json({ error: "글 작성 실패 (권한 또는 입력 오류)" }, { status: 403 });
  }

  const { isAdminOrMaster } = await getViewerContext(supabase);
  return NextResponse.json<BoardPost>(
    toBoardPostDto(row, 0, user.id, isAdminOrMaster),
    { status: 201 },
  );
}
```

### 5-3. `src/app/api/boards/[id]/posts/[postId]/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import {
  getPostWithComments,
  getViewerContext,
  toBoardPostDto,
} from "@/lib/boards";
import { BoardPostSchema } from "@/lib/validation";
import type { BoardComment, BoardPost } from "@/types/board";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string; postId: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { postId } = await params;
  const supabase = await createApiClient(request);
  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const result = await getPostWithComments(supabase, postId, userId, isAdminOrMaster);
  if (!result) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json<{ post: BoardPost; comments: BoardComment[] }>(result);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { postId } = await params;
  const supabase = await createApiClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = BoardPostSchema.partial().safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.content !== undefined) patch.content = parsed.data.content;
  if (parsed.data.images !== undefined) patch.images = parsed.data.images;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경 사항이 없습니다." }, { status: 400 });
  }

  // RLS 가 author_id = auth.uid() 강제
  const { data: row, error } = await supabase
    .from("board_posts")
    .update(patch)
    .eq("id", postId)
    .select("id, board_id, author_id, author_name, title, content, images, created_at, updated_at")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "수정 실패 (권한 또는 존재하지 않음)" }, { status: 403 });
  }

  const { isAdminOrMaster } = await getViewerContext(supabase);
  return NextResponse.json<BoardPost>(
    toBoardPostDto(row, 0, user.id, isAdminOrMaster),
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { postId } = await params;
  const supabase = await createApiClient(request);
  // RLS 가 admin/master OR author 검증
  const { error } = await supabase.from("board_posts").delete().eq("id", postId);
  if (error) {
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

### 5-4. `src/app/api/boards/[id]/posts/[postId]/comments/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { BoardCommentSchema } from "@/lib/validation";
import {
  getAuthorNameSnapshot,
  getViewerContext,
  toBoardCommentDto,
} from "@/lib/boards";
import type { BoardComment } from "@/types/board";

type Params = Promise<{ id: string; postId: string }>;
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { postId } = await params;
  const supabase = await createApiClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = BoardCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
      { status: 400 },
    );
  }

  const authorName = await getAuthorNameSnapshot(supabase, user.id);

  const { data: row, error } = await supabase
    .from("board_comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      author_name: authorName,
      content: parsed.data.content,
    })
    .select("id, post_id, author_id, author_name, content, created_at")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "댓글 작성 실패 (권한 또는 존재하지 않음)" }, { status: 403 });
  }

  const { isAdminOrMaster } = await getViewerContext(supabase);
  return NextResponse.json<BoardComment>(
    toBoardCommentDto(row, user.id, isAdminOrMaster),
    { status: 201 },
  );
}
```

### 5-5. `src/app/api/boards/[id]/posts/[postId]/comments/[cid]/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";

type Params = Promise<{ id: string; postId: string; cid: string }>;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { cid } = await params;
  const supabase = await createApiClient(request);
  const { error } = await supabase.from("board_comments").delete().eq("id", cid);
  if (error) {
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

---

## 6. 단계 6 — Admin UI

### 6-1. `src/app/admin/boards/page.tsx` — 목록 + 신설

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Eye, EyeOff, Trash2, Users, Loader2 } from "lucide-react";
import type { Board } from "@/types/board";
import { BoardCreateSchema } from "@/lib/validation";

export default function AdminBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/boards", { credentials: "same-origin" });
    if (r.ok) setBoards((await r.json()) as Board[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const check = BoardCreateSchema.safeParse({ title, description: description || undefined });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const r = await fetch("/api/admin/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(check.data),
    });
    setSubmitting(false);
    if (!r.ok) {
      alert("생성 실패");
      return;
    }
    setTitle("");
    setDescription("");
    setShowForm(false);
    void load();
  }

  async function toggleVisible(b: Board) {
    const r = await fetch(`/api/admin/boards/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !b.isVisible }),
    });
    if (!r.ok) {
      alert("토글 실패");
      return;
    }
    void load();
  }

  async function deleteBoard(b: Board) {
    if (!confirm(`"${b.title}" 게시판을 영구 삭제합니다. 글·댓글·이미지가 모두 사라집니다. 계속할까요?`))
      return;
    const r = await fetch(`/api/admin/boards/${b.id}`, { method: "DELETE" });
    if (!r.ok) {
      alert("삭제 실패");
      return;
    }
    void load();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 size={20} className="mr-2 animate-spin" />
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">소모임 게시판</h1>
          <p className="mt-1 text-sm text-gray-500">
            소모임별 게시판을 신설하고 멤버를 지정합니다.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          새 게시판
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">제목 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              placeholder="예) 24목장 게시판"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "생성 중..." : "생성"}
          </button>
          <p className="mt-3 text-xs text-gray-500">
            생성 후 행 클릭 → "멤버 관리"에서 멤버를 추가하세요.
          </p>
        </form>
      )}

      {boards.length === 0 ? (
        <p className="py-20 text-center text-gray-400">게시판이 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-sm">
                <th className="px-4 py-3 font-medium text-gray-600">제목</th>
                <th className="px-4 py-3 font-medium text-gray-600">멤버</th>
                <th className="px-4 py-3 font-medium text-gray-600">글</th>
                <th className="px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="px-4 py-3 font-medium text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {boards.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{b.title}</div>
                    {b.description && (
                      <div className="text-xs text-gray-500">{b.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.memberCount}명</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.postCount}건</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        b.isVisible ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {b.isVisible ? "공개" : "숨김"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/boards/${b.id}/members`}
                        className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200"
                      >
                        <Users size={12} />
                        멤버
                      </Link>
                      <button
                        onClick={() => toggleVisible(b)}
                        title={b.isVisible ? "숨김 처리" : "다시 공개"}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200"
                      >
                        {b.isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        onClick={() => deleteBoard(b)}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

### 6-2. `src/app/admin/boards/[id]/members/page.tsx` — 멤버 관리

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, X, Search, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BoardMember } from "@/types/board";

interface ProfileSearchResult {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

type Params = Promise<{ id: string }>;

export default function AdminBoardMembersPage({
  params,
}: {
  params: Params;
}) {
  const { id: boardId } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  async function loadMembers() {
    setLoading(true);
    const r = await fetch(`/api/admin/boards/${boardId}/members`, {
      credentials: "same-origin",
    });
    if (r.ok) setMembers((await r.json()) as BoardMember[]);
    setLoading(false);
  }

  // 회원 검색 (250ms 디바운스)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url")
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20);
      setResults((data ?? []) as ProfileSearchResult[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, supabase]);

  function addMember(p: ProfileSearchResult) {
    if (members.some((m) => m.profileId === p.id)) return;
    setMembers((prev) => [
      ...prev,
      {
        profileId: p.id,
        name: p.name,
        email: p.email,
        avatarUrl: p.avatar_url,
        addedAt: new Date().toISOString(),
      },
    ]);
    setQuery("");
    setResults([]);
  }

  function removeMember(profileId: string) {
    setMembers((prev) => prev.filter((m) => m.profileId !== profileId));
  }

  async function save() {
    setSaving(true);
    const r = await fetch(`/api/admin/boards/${boardId}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileIds: members.map((m) => m.profileId) }),
    });
    setSaving(false);
    if (!r.ok) {
      alert("저장 실패");
      return;
    }
    alert("저장 완료");
    void loadMembers();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 size={20} className="mr-2 animate-spin" />
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/boards"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        게시판 목록
      </Link>

      <h1 className="mb-6 text-xl font-bold text-gray-900 sm:text-2xl">멤버 관리</h1>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">회원 검색 (이름 또는 이메일)</label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="홍길동 또는 hong@..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        {searching && <p className="mt-2 text-xs text-gray-400">검색 중...</p>}
        {results.length > 0 && (
          <ul className="mt-3 max-h-60 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200">
            {results.map((p) => {
              const already = members.some((m) => m.profileId === p.id);
              return (
                <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{p.name || "(이름없음)"}</div>
                    <div className="text-xs text-gray-500">{p.email}</div>
                  </div>
                  <button
                    disabled={already}
                    onClick={() => addMember(p)}
                    className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    {already ? "추가됨" : "추가"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">현재 멤버 ({members.length}명)</h2>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            저장
          </button>
        </div>

        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">멤버가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.profileId}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs"
              >
                {m.name}
                <button
                  onClick={() => removeMember(m.profileId)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">변경 후 [저장] 을 눌러야 적용됩니다.</p>
      </div>
    </div>
  );
}
```

> **회원 검색은 클라이언트 직접 supabase 쿼리** — research.md 5-4 결정. profiles SELECT 가 누구나 허용이라 정상 동작.

---

## 7. 단계 7 — 멤버 UI

### 7-1. `src/app/(member)/boards/page.tsx` — 내 게시판 목록

```tsx
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Users, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listVisibleBoards } from "@/lib/boards";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "소모임 게시판" };
export const dynamic = "force-dynamic";

export default async function BoardsListPage() {
  const supabase = await createClient();
  const boards = await listVisibleBoards(supabase);

  return (
    <>
      <PageHeader title="소모임 게시판" description="내가 속한 게시판 목록" />
      <Container>
        <div className="mx-auto max-w-3xl">
          {boards.length === 0 ? (
            <p className="py-20 text-center text-gray-400">
              아직 속한 게시판이 없습니다.
              <br />
              운영진에게 게시판 등록을 요청해 주세요.
            </p>
          ) : (
            <ul className="space-y-3">
              {boards.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/boards/${b.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{b.title}</h3>
                        {b.description && (
                          <p className="mt-1 text-sm text-gray-500">{b.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {b.memberCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {b.postCount}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </>
  );
}
```

### 7-2. `src/app/(member)/boards/[boardId]/page.tsx` — 글 목록

```tsx
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getBoardById, getViewerContext, listPosts } from "@/lib/boards";
import { BoardPostList } from "./BoardPostList";

export const dynamic = "force-dynamic";

type Params = Promise<{ boardId: string }>;

export default async function BoardPage({ params }: { params: Params }) {
  const { boardId } = await params;
  const supabase = await createClient();
  const board = await getBoardById(supabase, boardId);
  if (!board) notFound();

  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  const initial = await listPosts(supabase, boardId, {
    limit: 20,
    cursor: null,
    viewerId: userId,
    viewerIsAdminOrMaster: isAdminOrMaster,
  });

  return (
    <>
      <PageHeader title={board.title} description={board.description ?? undefined} />
      <Container>
        <BoardPostList
          boardId={boardId}
          initialItems={initial.items}
          initialCursor={initial.nextCursor}
        />
      </Container>
    </>
  );
}
```

### 7-3. `src/app/(member)/boards/[boardId]/BoardPostList.tsx` — 클라이언트 컴포넌트

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MessageSquare, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { BoardPost } from "@/types/board";
import { BoardPostForm } from "./BoardPostForm";

export function BoardPostList({
  boardId,
  initialItems,
  initialCursor,
}: {
  boardId: string;
  initialItems: BoardPost[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    const r = await fetch(
      `/api/boards/${boardId}/posts?cursor=${encodeURIComponent(cursor)}&limit=20`,
      { credentials: "same-origin" },
    );
    setLoading(false);
    if (!r.ok) return;
    const page = (await r.json()) as { items: BoardPost[]; nextCursor: string | null };
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
  }

  function handleCreated(post: BoardPost) {
    setItems((prev) => [post, ...prev]);
    setShowForm(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={14} />
          {showForm ? "취소" : "글쓰기"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <BoardPostForm boardId={boardId} onCreated={handleCreated} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray-400">
          아직 게시글이 없습니다. 첫 글을 작성해보세요!
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/boards/${boardId}/${p.id}`} className="block px-5 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="line-clamp-1 font-medium text-gray-900">{p.title}</h3>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                    <MessageSquare size={12} />
                    {p.commentCount}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                  <span>{p.authorName}</span>
                  <span>·</span>
                  <span>{formatDate(p.createdAt)}</span>
                  {p.images.length > 0 && (
                    <>
                      <span>·</span>
                      <span>이미지 {p.images.length}</span>
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
```

### 7-4. `src/app/(member)/boards/[boardId]/BoardPostForm.tsx` — 작성 폼 + 이미지

```tsx
"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_BLOG_IMAGE_SIZE,
  validateFile,
  safeExtension,
  BoardPostSchema,
} from "@/lib/validation";
import { compressImage } from "@/lib/image-compress";
import type { BoardPost } from "@/types/board";

const HARD_MAX = 50 * 1024 * 1024; // 50MB 절대 상한 (브라우저 OOM 방지)
const MAX_IMAGES = 10;

export function BoardPostForm({
  boardId,
  onCreated,
}: {
  boardId: string;
  onCreated: (post: BoardPost) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      alert(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      for (const file of Array.from(files)) {
        const baseCheck = validateFile(file, ALLOWED_IMAGE_EXTENSIONS, HARD_MAX);
        if (!baseCheck.ok) {
          alert(`${file.name}: ${baseCheck.reason}`);
          continue;
        }

        let toUpload = file;
        if (file.size > MAX_BLOG_IMAGE_SIZE) {
          try {
            toUpload = (await compressImage(file, MAX_BLOG_IMAGE_SIZE)).file;
          } catch (e) {
            alert(`${file.name}: ${e instanceof Error ? e.message : "압축 실패"}`);
            continue;
          }
        }

        const ext = safeExtension(toUpload.name, ALLOWED_IMAGE_EXTENSIONS);
        const path = `${boardId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("board-images")
          .upload(path, toUpload, { contentType: toUpload.type });
        if (upErr) {
          alert(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { data } = supabase.storage.from("board-images").getPublicUrl(path);
        setImages((prev) => [...prev, data.publicUrl]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeImage(idx: number) {
    const url = images[idx];
    setImages((prev) => prev.filter((_, i) => i !== idx));
    // 스토리지에서도 삭제 (다른 글에서 안 씀 — 즉시 작성 중인 폼 한정)
    try {
      const u = new URL(url);
      const path = u.pathname.split("/board-images/")[1];
      if (path) await supabase.storage.from("board-images").remove([path]);
    } catch {
      /* ignore */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = BoardPostSchema.safeParse({ title, content, images });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const r = await fetch(`/api/boards/${boardId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(check.data),
    });
    setSubmitting(false);
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "작성 실패" }));
      alert(err.error ?? "작성 실패");
      return;
    }
    const post = (await r.json()) as BoardPost;
    setTitle("");
    setContent("");
    setImages([]);
    onCreated(post);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        maxLength={150}
        required
        className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용"
        rows={6}
        maxLength={10000}
        required
        className="mb-3 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      />

      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={url} className="relative">
              <Image
                src={url}
                alt={`첨부 ${i + 1}`}
                width={80}
                height={80}
                className="rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || images.length >= MAX_IMAGES}
          className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          이미지 ({images.length}/{MAX_IMAGES})
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded-lg bg-primary-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? "작성 중..." : "등록"}
        </button>
      </div>
    </form>
  );
}
```

### 7-5. `src/app/(member)/boards/[boardId]/[postId]/page.tsx` — 상세 + 댓글

```tsx
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { getBoardById, getPostWithComments, getViewerContext } from "@/lib/boards";
import { BoardPostDetail } from "./BoardPostDetail";

export const dynamic = "force-dynamic";

type Params = Promise<{ boardId: string; postId: string }>;

export default async function BoardPostPage({ params }: { params: Params }) {
  const { boardId, postId } = await params;
  const supabase = await createClient();
  const board = await getBoardById(supabase, boardId);
  if (!board) notFound();

  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  const data = await getPostWithComments(supabase, postId, userId, isAdminOrMaster);
  if (!data) notFound();

  return (
    <Container>
      <BoardPostDetail
        boardId={boardId}
        boardTitle={board.title}
        post={data.post}
        comments={data.comments}
      />
    </Container>
  );
}
```

### 7-6. `src/app/(member)/boards/[boardId]/[postId]/BoardPostDetail.tsx`

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { BoardCommentSchema } from "@/lib/validation";
import type { BoardComment, BoardPost } from "@/types/board";

export function BoardPostDetail({
  boardId,
  boardTitle,
  post,
  comments: initialComments,
}: {
  boardId: string;
  boardTitle: string;
  post: BoardPost;
  comments: BoardComment[];
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function deletePost() {
    if (!confirm("이 글을 삭제하시겠습니까? 댓글도 함께 사라집니다.")) return;
    const r = await fetch(`/api/boards/${boardId}/posts/${post.id}`, { method: "DELETE" });
    if (!r.ok) {
      alert("삭제 실패");
      return;
    }
    router.push(`/boards/${boardId}`);
    router.refresh();
  }

  async function deleteComment(c: BoardComment) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const r = await fetch(
      `/api/boards/${boardId}/posts/${post.id}/comments/${c.id}`,
      { method: "DELETE" },
    );
    if (!r.ok) {
      alert("삭제 실패");
      return;
    }
    setComments((prev) => prev.filter((x) => x.id !== c.id));
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const check = BoardCommentSchema.safeParse({ content });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const r = await fetch(`/api/boards/${boardId}/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(check.data),
    });
    setSubmitting(false);
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "작성 실패" }));
      alert(err.error ?? "작성 실패");
      return;
    }
    const created = (await r.json()) as BoardComment;
    setComments((prev) => [...prev, created]);
    setContent("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/boards/${boardId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        {boardTitle}
      </Link>

      <article className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-bold text-gray-900">{post.title}</h1>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div>
            <span>{post.authorName}</span>
            <span className="mx-2">·</span>
            <span>{formatDate(post.createdAt)}</span>
          </div>
          {post.canDelete && (
            <button
              onClick={deletePost}
              className="flex items-center gap-1 text-red-600 hover:text-red-800"
            >
              <Trash2 size={12} />
              삭제
            </button>
          )}
        </div>

        <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {post.content}
        </div>

        {post.images.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {post.images.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg"
              >
                <Image
                  src={url}
                  alt={`첨부 ${i + 1}`}
                  width={300}
                  height={300}
                  className="aspect-square w-full object-cover"
                  unoptimized
                />
              </a>
            ))}
          </div>
        )}
      </article>

      {/* 댓글 */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">댓글 {comments.length}</h2>

        <ul className="mb-4 space-y-3">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">첫 댓글을 작성해보세요.</p>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{c.authorName}</span>
                    <span className="mx-2">·</span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                  {c.canDelete && (
                    <button
                      onClick={() => deleteComment(c)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-gray-700">{c.content}</p>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={submitComment}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="댓글 작성..."
            rows={2}
            maxLength={1000}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              댓글 등록
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
```

---

## 8. 단계 8 — 통합 (nav, middleware)

### 8-1. `src/middleware.ts` — matcher 1줄 추가

```ts
export const config = {
  matcher: ["/groups/:path*", "/admin/:path*", "/profile/:path*", "/boards/:path*"],
};
```

> `/boards` 도 미들웨어 보호 — 비로그인 시 `/login?next=/boards` 리다이렉트.

### 8-2. `src/app/admin/AdminNav.tsx` — 아이콘 키 추가

```ts
import { /* 기존 import */, Layers } from "lucide-react";

export type AdminIconKey =
  | "dashboard"
  | "notices"
  | "weeklies"
  | "masters"
  | "gallery"
  | "calendar"
  | "sermons"
  | "shorts"
  | "inquiries"
  | "members"
  | "subscribers"
  | "newFamily"
  | "boards";   // ← 추가

const ICONS: Record<AdminIconKey, LucideIcon> = {
  /* 기존 */
  boards: Layers, // ← 추가
};
```

### 8-3. `src/app/admin/layout.tsx` — baseNav 1줄 추가

```ts
const baseNav: AdminNavItem[] = [
  /* 기존 항목들 */
  { label: "새가족 등록", href: "/admin/new-families", icon: "newFamily" },
  { label: "소모임 게시판", href: "/admin/boards", icon: "boards" },  // ← 추가
];
```

### 8-4. `src/components/layout/nav-config.ts` — 교회소개 드롭다운에 추가 (선택)

```ts
{
  label: "교회소개",
  href: "/greetings",
  children: [
    { label: "인사말", href: "/greetings" },
    { label: "새가족 등록", href: "/new-family" },
    { label: "소모임 게시판", href: "/boards" },   // ← 추가 (member 가 클릭하면 진입, 비member 는 로그인)
    { label: "공지사항", href: "/notice", badgeKey: "notices" },
    /* ...나머지 */
  ],
},
```

> 이 변경은 **선택**. 사용자 요청 범위 명확치 않으면 nav 추가는 별도 컨펌받아 진행.

---

## 9. 단계 9 — 검증

### 9-1. 자동 검증

```bash
# 1. typecheck
npm run typecheck

# 2. lint (신규/수정 파일 한정)
npx eslint src/app/admin/boards src/app/api/admin/boards \
           src/app/(member)/boards src/app/api/boards \
           src/lib/boards.ts src/types/board.ts

# 3. build
npm run build
```

기대 결과:
- TypeScript 에러 0
- ESLint 에러 0
- `/boards`, `/boards/[boardId]`, `/boards/[boardId]/[postId]` Dynamic
- `/admin/boards`, `/admin/boards/[id]/members` Dynamic
- API 라우트 모두 Dynamic

### 9-2. 수동 시나리오 (research.md 9 절 매트릭스)

| # | 시나리오 | 통과 조건 |
|---|---|---|
| 1 | admin 이 게시판 신설 + 멤버 5명 추가 | `/admin/boards` 신설 → "멤버" 페이지에서 5명 검색·추가·저장 |
| 2 | 비멤버가 URL `/boards/{id}` 직접 진입 | board 행 안 보여 notFound() |
| 3 | 멤버가 글쓰기 + 이미지 3장 첨부 | 압축·업로드·INSERT 모두 통과 |
| 4 | 다른 멤버가 남의 글 삭제 시도 | 삭제 버튼 안 보임. URL fetch 시 403 |
| 5 | admin 이 게시판 숨김 | 멤버는 목록에서 사라짐. admin 은 목록에 그대로 |
| 6 | admin 이 멤버 명단에서 1명 제거 후 저장 | 제거된 사용자 즉시 접근 차단 |
| 7 | 회원 탈퇴 (auth.users 삭제) | 글 보존 (`author_id NULL`, `author_name` 스냅샷) |
| 8 | 게시판 영구 삭제 | board → posts → comments → board_members CASCADE |
| 9 | admin 으로 숨김 게시판도 보임 | `/admin/boards` 에 "숨김" 행 표시 |
| 10 | cursor 페이지네이션 | 글 30개 만들고 "더 보기" 클릭 시 다음 10개 |

### 9-3. 모바일 호환 자체 검증 (체크리스트)

| 점검 | 통과 조건 |
|---|---|
| `/api/boards/*` 가 `Authorization: Bearer` 헤더로도 호출되는가 | `createApiClient(request)` 사용했으면 자동 OK. curl 테스트 가능 |
| 모든 응답이 camelCase 인가 | `toBoardDto`/`toBoardPostDto`/`toBoardCommentDto` 만 노출 — DB row 직접 반환 금지 |
| 날짜가 ISO 8601 인가 | Supabase timestamptz 가 자동으로 ISO 반환. 수동 변환 없음 |
| `canDelete` 가 응답에 포함되는가 | `toBoardPostDto` 에 viewerId/isAdminOrMaster 받아 계산 |
| 이미지 URL 이 절대 URL 인가 | `getPublicUrl()` 결과 — 항상 절대 URL |
| 페이지네이션이 cursor 인가 | `parseBoardCursor`/`buildBoardCursor` 사용 |
| 에러 응답이 `{ error: string }` 인가 | 모든 라우트 동일 패턴 |
| ISR 대신 dynamic 인가 | `dynamic = "force-dynamic"` 명시 — 모바일은 ISR 무관 |

---

## 10. 부록 A — 모바일 앱이 사용할 엔드포인트 매뉴얼

> 이 섹션은 **나중에 모바일 RN 앱을 만들 때 백엔드를 수정하지 않고도** 사용할 수 있도록 필요한 정보를 모은다.

### 10-1. 인증

```
헤더: Authorization: Bearer <supabase_access_token>
```

`@supabase/supabase-js` 의 `signInWithOAuth` 결과에서 access_token 획득 → 모든 요청에 헤더 첨부.

### 10-2. 엔드포인트 일람

| Method | Path | Body / Query | 응답 |
|---|---|---|---|
| GET | `/api/me` | — | `MeResponse` |
| GET | `/api/boards` | — | `Board[]` |
| GET | `/api/boards/{id}/posts` | `?limit=20&cursor=<token>` | `CursorPage<BoardPost>` |
| POST | `/api/boards/{id}/posts` | `BoardPostInput` | `BoardPost` |
| GET | `/api/boards/{id}/posts/{postId}` | — | `{ post, comments }` |
| PATCH | `/api/boards/{id}/posts/{postId}` | `Partial<BoardPostInput>` | `BoardPost` |
| DELETE | `/api/boards/{id}/posts/{postId}` | — | `{ ok: true }` |
| POST | `/api/boards/{id}/posts/{postId}/comments` | `BoardCommentInput` | `BoardComment` |
| DELETE | `/api/boards/{id}/posts/{postId}/comments/{cid}` | — | `{ ok: true }` |

### 10-3. 이미지 업로드 (모바일 클라이언트)

```ts
// React Native 예시 (의사 코드)
import { supabase } from "./supabase";

const path = `${boardId}/${userId}/${Date.now()}.jpg`;
const { error } = await supabase.storage.from("board-images").upload(path, fileBlob, {
  contentType: "image/jpeg",
});
const { data } = supabase.storage.from("board-images").getPublicUrl(path);
const url = data.publicUrl;

// 그 다음 POST /api/boards/{id}/posts body.images = [url]
```

Storage RLS 가 멤버 여부 검증 — 비멤버는 upload 시점에 차단됨.

### 10-4. 에러 처리

| HTTP | 의미 | 모바일 동작 권장 |
|---|---|---|
| 401 | 미인증 | 토큰 갱신 시도 → 실패 시 로그인 화면 |
| 403 | 권한 없음 (비멤버, RLS 차단) | "접근 권한이 없습니다" 토스트 |
| 400 | 잘못된 입력 (zod 첫 메시지) | 응답 `error` 그대로 표시 |
| 404 | 자원 없음 | 이전 화면으로 돌아가기 |
| 500 | 서버 오류 | "잠시 후 다시 시도" 토스트 |

---

## 11. 작업 순서 요약 (체크리스트)

```
[x] 1. supabase/migrations/025_boards.sql 작성 완료 (사용자가 Supabase 콘솔에서 적용 필요)
       → 4 테이블, 헬퍼 2, 트리거 2, 정책 다수, storage 버킷 1

[x] 2. src/types/board.ts 신규 작성
[x] 3. src/lib/validation.ts 끝에 5 schema + 2 cursor 헬퍼 추가
[x] 4. src/lib/boards.ts 신규 작성

[x] 5. src/app/api/admin/boards/route.ts (GET, POST)
[x] 6. src/app/api/admin/boards/[id]/route.ts (PATCH, DELETE)
[x] 7. src/app/api/admin/boards/[id]/members/route.ts (GET, PUT)

[x] 8. src/app/api/boards/route.ts (GET 내 목록)
[x] 9. src/app/api/boards/[id]/posts/route.ts (GET, POST)
[x] 10. src/app/api/boards/[id]/posts/[postId]/route.ts (GET, PATCH, DELETE)
[x] 11. src/app/api/boards/[id]/posts/[postId]/comments/route.ts (POST)
[x] 12. src/app/api/boards/[id]/posts/[postId]/comments/[cid]/route.ts (DELETE)

[x] 13. src/app/admin/boards/page.tsx
[x] 14. src/app/admin/boards/[id]/members/page.tsx

[x] 15. src/app/(member)/boards/page.tsx
[x] 16. src/app/(member)/boards/[boardId]/page.tsx
[x] 17. src/app/(member)/boards/[boardId]/BoardPostList.tsx
[x] 18. src/app/(member)/boards/[boardId]/BoardPostForm.tsx
[x] 19. src/app/(member)/boards/[boardId]/[postId]/page.tsx
[x] 20. src/app/(member)/boards/[boardId]/[postId]/BoardPostDetail.tsx

[x] 21. src/middleware.ts matcher + 인증 가드 추가
[x] 22. src/app/admin/AdminNav.tsx — boards 키 + Layers 아이콘 추가
[x] 23. src/app/admin/layout.tsx — baseNav 1줄 추가
[ ] 24. (선택 — 미수행) src/components/layout/nav-config.ts "교회소개" 드롭다운 추가
       → AGENTS.md "시키지 않은 것은 하지 않는다" 원칙에 따라 사용자 확인 전까지 보류

[x] 25. npm run typecheck — 0 에러
[x] 26. npm run build — 0 에러, 모든 라우트 Dynamic 등록 확인
[ ] 27. 수동 시나리오 10개 (사용자가 마이그레이션 025 적용 후 검증)
[ ] 28. 모바일 호환 체크리스트 8개 (RN 앱 작업 시점에 검증)
```

**구현 완료 일자**: 2026-05-02. typecheck/build 모두 통과. 마이그레이션 025 적용 후 즉시 사용 가능.

---

## 12. 의도적으로 손대지 않는 영역

- `src/app/(member)/groups/*` (기존 정적 토론 — 본 시스템과 별개, 사용자 결정 전까지 유지)
- `content_authors` (020) — `'board_post'` 추가 안 함, 시스템 분리
- `mokjang_entries` — 주보 마스터 그대로
- `next.config.ts` CSP / 보안 헤더 — Supabase 도메인 이미 허용
- 기존 도메인 정책, OAuth 흐름, 이메일 중복 차단 — 모두 그대로 활용

---

## 13. v2 후보 (지금 안 할 것 — research.md 12 절 참조)

좋아요 / 멘션 / 알림톡 / 검색 / 모더레이터 권한 / Rate limit / 고아 파일 청소 cron / 정규화 소속 자동 매칭.
