import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";

type Params = Promise<{ id: string; postId: string; cid: string }>;
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { cid } = await params;
  const supabase = await createApiClient(request);
  // RLS 가 author OR admin/master 검증
  const { error } = await supabase
    .from("board_comments")
    .delete()
    .eq("id", cid);
  if (error) {
    console.error("comments DELETE", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
