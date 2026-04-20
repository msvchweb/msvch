import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWeeklyHtml } from "@/lib/weekly-html-template";
import type { Weekly } from "@/types/notice";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile as { role: string }).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: weekly } = await supabase
    .from("weeklies")
    .select("*")
    .eq("id", id)
    .single();

  if (!weekly) return new NextResponse("Not Found", { status: 404 });

  const html = buildWeeklyHtml(weekly as Weekly);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
