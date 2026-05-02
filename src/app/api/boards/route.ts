import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { listVisibleBoards } from "@/lib/boards";
import type { Board } from "@/types/board";

export const dynamic = "force-dynamic";

/** GET — 내가 볼 수 있는 게시판 목록. RLS 가 (가시 + 멤버) OR admin 만 노출. */
export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const boards = await listVisibleBoards(supabase);
  return NextResponse.json<Board[]>(boards);
}
