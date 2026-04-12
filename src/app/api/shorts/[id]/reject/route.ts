import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";

type Params = Promise<{ id: string }>;

interface RejectBody {
  note?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const { supabase } = await requireAdmin();

    const body = (await request.json()) as RejectBody;

    const { error } = await supabase
      .from("shorts_clips")
      .update({
        review_status: "rejected",
        reviewer_note: body.note ?? null,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
