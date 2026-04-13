import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { ShortsRejectSchema } from "@/lib/validation";

type Params = Promise<{ id: string }>;

export async function POST(
  request: Request,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const { supabase } = await requireAdmin();

    const parsed = ShortsRejectSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "반려 사유는 500자까지입니다." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("shorts_clips")
      .update({
        review_status: "rejected",
        reviewer_note: parsed.data.note?.trim() || null,
      })
      .eq("id", id);

    if (error) {
      console.error("Reject clip error:", error);
      return NextResponse.json(
        { error: "반려 처리에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
