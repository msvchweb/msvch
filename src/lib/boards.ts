import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Board,
  BoardComment,
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
  images: string[] | null;
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

export interface ViewerContext {
  userId: string | null;
  isAdminOrMaster: boolean;
}

/** 현재 사용자의 role 을 가져온다 (admin 분기 + canDelete 계산용) */
export async function getViewerContext(
  supabase: SupabaseClient,
): Promise<ViewerContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, isAdminOrMaster: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const role = profile?.role;
  return {
    userId: user.id,
    isAdminOrMaster: role === "admin" || role === "master",
  };
}

async function fetchCounts(
  supabase: SupabaseClient,
  table: "board_members" | "board_posts" | "board_comments",
  column: "board_id" | "post_id",
  ids: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;
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

/**
 * 내가 볼 수 있는 게시판 목록.
 * RLS 가 자동으로 (멤버이고 is_visible) OR (admin/master) 만 노출.
 * memberCount / postCount 는 서버에서 합성.
 */
export async function listVisibleBoards(
  supabase: SupabaseClient,
): Promise<Board[]> {
  const { data: rows } = await supabase
    .from("boards")
    .select("id, title, description, is_visible, created_at, updated_at")
    .order("created_at", { ascending: false })
    .returns<BoardRow[]>();

  if (!rows || rows.length === 0) return [];

  const boardIds = rows.map((b) => b.id);
  const memberCounts = await fetchCounts(
    supabase,
    "board_members",
    "board_id",
    boardIds,
  );
  const postCounts = await fetchCounts(
    supabase,
    "board_posts",
    "board_id",
    boardIds,
  );

  return rows.map((r) =>
    toBoardDto(r, memberCounts[r.id] ?? 0, postCounts[r.id] ?? 0),
  );
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
  const memberCounts = await fetchCounts(supabase, "board_members", "board_id", [
    id,
  ]);
  const postCounts = await fetchCounts(supabase, "board_posts", "board_id", [
    id,
  ]);
  return toBoardDto(data, memberCounts[id] ?? 0, postCounts[id] ?? 0);
}

/** 게시판 글 목록 — cursor 페이지네이션 */
export interface ListPostsOptions {
  limit: number;
  cursor: { createdAt: string; id: string } | null;
  viewerId: string | null;
  viewerIsAdminOrMaster: boolean;
}

export async function listPosts(
  supabase: SupabaseClient,
  boardId: string,
  options: ListPostsOptions,
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

  const postIds = sliced.map((p) => p.id);
  const commentCounts = await fetchCounts(
    supabase,
    "board_comments",
    "post_id",
    postIds,
  );

  const items = sliced.map((r) =>
    toBoardPostDto(
      r,
      commentCounts[r.id] ?? 0,
      options.viewerId,
      options.viewerIsAdminOrMaster,
    ),
  );

  const last = sliced[sliced.length - 1];
  const nextCursor =
    hasMore && last ? buildBoardCursor(last.created_at, last.id) : null;

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
  const name = data?.name?.trim() || "이름없음";
  return name.slice(0, 60);
}
