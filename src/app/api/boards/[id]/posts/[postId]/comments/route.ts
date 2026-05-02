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

interface InsertedCommentRow {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { postId } = await params;
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    .single<InsertedCommentRow>();

  if (error || !row) {
    console.error("comments POST", error);
    return NextResponse.json(
      { error: "댓글 작성 실패 (권한 또는 존재하지 않음)" },
      { status: 403 },
    );
  }

  const { isAdminOrMaster } = await getViewerContext(supabase);
  return NextResponse.json<BoardComment>(
    toBoardCommentDto(row, user.id, isAdminOrMaster),
    { status: 201 },
  );
}
