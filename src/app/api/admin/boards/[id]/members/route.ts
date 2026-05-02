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
    name: string | null;
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
      .order("added_at", { ascending: true })
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
    console.error("admin/boards/members GET", err);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

/** PUT — 멤버 명단 일괄 교체 */
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

    return NextResponse.json({
      ok: true,
      added: toAdd.length,
      removed: toRemove.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("admin/boards/members PUT", err);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
