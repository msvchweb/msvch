import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { BoardCreateSchema } from "@/lib/validation";
import { listVisibleBoards, toBoardDto } from "@/lib/boards";
import type { Board } from "@/types/board";

export const dynamic = "force-dynamic";

interface InsertedBoardRow {
  id: string;
  title: string;
  description: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

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
      .single<InsertedBoardRow>();

    if (error || !row) {
      console.error("admin/boards POST", error);
      return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }

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

    return NextResponse.json<Board>(toBoardDto(row, memberIds.length, 0), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("admin/boards POST", err);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
