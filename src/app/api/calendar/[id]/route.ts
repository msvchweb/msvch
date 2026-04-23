import { NextRequest, NextResponse } from "next/server";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { requireAdmin, AuthError } from "@/lib/admin-auth";

type Params = Promise<{ id: string }>;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    await requireAdmin(request);

    await deleteCalendarEvent(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    console.error("Calendar delete error:", err);
    return NextResponse.json(
      { error: "일정 삭제에 실패했습니다." },
      { status: 500 },
    );
  }
}
