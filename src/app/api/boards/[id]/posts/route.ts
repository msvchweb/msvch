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

interface InsertedPostRow {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
      author_id: user.id,
      author_name: authorName,
      title: parsed.data.title,
      content: parsed.data.content,
      images: parsed.data.images,
    })
    .select(
      "id, board_id, author_id, author_name, title, content, images, created_at, updated_at",
    )
    .single<InsertedPostRow>();

  if (error || !row) {
    console.error("boards/posts POST", error);
    return NextResponse.json(
      { error: "글 작성 실패 (권한 또는 입력 오류)" },
      { status: 403 },
    );
  }

  const { isAdminOrMaster } = await getViewerContext(supabase);
  return NextResponse.json<BoardPost>(
    toBoardPostDto(row, 0, user.id, isAdminOrMaster),
    { status: 201 },
  );
}
