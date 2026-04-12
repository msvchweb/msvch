import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";

type Params = Promise<{ id: string }>;

export async function POST(
  _request: Request,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const { supabase } = await requireAdmin();

    const { error } = await supabase
      .from("shorts_clips")
      .update({ review_status: "approved" })
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
