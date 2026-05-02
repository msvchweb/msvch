import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import {
  getPostWithComments,
  getViewerContext,
  toBoardPostDto,
} from "@/lib/boards";
import { BoardPostPatchSchema } from "@/lib/validation";
import type { BoardComment, BoardPost } from "@/types/board";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string; postId: string }>;

interface UpdatedPostRow {
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
  const { postId } = await params;
  const supabase = await createApiClient(request);
  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const result = await getPostWithComments(
    supabase,
    postId,
    userId,
    isAdminOrMaster,
  );
  if (!result) {
    return NextResponse.json(
      { error: "글을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  return NextResponse.json<{ post: BoardPost; comments: BoardComment[] }>(
    result,
  );
}

export async function PATCH(
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

  const parsed = BoardPostPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
      { status: 400 },
    );
  }

  const patch: Record<string, string | string[]> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.content !== undefined) patch.content = parsed.data.content;
  if (parsed.data.images !== undefined) patch.images = parsed.data.images;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "변경 사항이 없습니다." },
      { status: 400 },
    );
  }

  // RLS 가 author_id = auth.uid() 강제
  const { data: row, error } = await supabase
    .from("board_posts")
    .update(patch)
    .eq("id", postId)
    .select(
      "id, board_id, author_id, author_name, title, content, images, created_at, updated_at",
    )
    .single<UpdatedPostRow>();

  if (error || !row) {
    return NextResponse.json(
      { error: "수정 실패 (권한 또는 존재하지 않음)" },
      { status: 403 },
    );
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
  const { error } = await supabase
    .from("board_posts")
    .delete()
    .eq("id", postId);
  if (error) {
    console.error("boards/posts DELETE", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
