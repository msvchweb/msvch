import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { BoardUpdateSchema } from "@/lib/validation";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

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
      return NextResponse.json(
        { error: "변경 사항이 없습니다." },
        { status: 400 },
      );
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
    console.error("admin/boards PATCH", err);
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
    console.error("admin/boards DELETE", err);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
