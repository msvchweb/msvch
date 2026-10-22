import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/admin-auth";
import { getAiCourseApplication, requireAiCourseAdmin } from "@/lib/ai-course-server";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAiCourseAdmin(request);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "신청 번호를 확인해 주세요." }, { status: 400, headers });
    const application = await getAiCourseApplication(supabase, id);
    if (!application) return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404, headers });
    return NextResponse.json(application, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthError ? error.message : "신청 상세를 조회하지 못했습니다." }, { status: error instanceof AuthError ? error.status : 500, headers });
  }
}
