import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireMaster } from "@/lib/admin-auth";

const VALID_ROLES = ["member", "staff", "admin", "master"] as const;
type Role = (typeof VALID_ROLES)[number];

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, userId } = await requireMaster(request);

    const body = (await request.json()) as { id?: unknown; role?: unknown };
    const { id, role } = body;

    if (
      typeof id !== "string" ||
      typeof role !== "string" ||
      !VALID_ROLES.includes(role as Role)
    ) {
      return NextResponse.json(
        { error: "유효하지 않은 입력입니다." },
        { status: 400 },
      );
    }

    if (id === userId) {
      return NextResponse.json(
        { error: "자신의 권한은 변경할 수 없습니다." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
