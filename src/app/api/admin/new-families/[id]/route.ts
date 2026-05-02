import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { NewFamilyUpdateSchema } from "@/lib/validation";
import { toDto } from "../route";

export const dynamic = "force-dynamic";

const SELECT_COLS =
  "id, visit_paths, visit_paths_etc, faith_status, name, gender, birth, phone, region, church_history, church_history_etc, message, privacy_consent, privacy_consented_at, status, admin_note, created_at, updated_at";

type Params = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const parsed = NewFamilyUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.adminNote !== undefined)
      update.admin_note = parsed.data.adminNote.trim() || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
    }

    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("new_family_registrations")
      .update(update)
      .eq("id", id)
      .select(SELECT_COLS)
      .single();

    if (error || !data) {
      console.error("new-family update error", error);
      return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
    return NextResponse.json(
      toDto(
        data as Parameters<typeof toDto>[0],
      ),
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
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
    const { error } = await supabase
      .from("new_family_registrations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("new-family delete error", error);
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
