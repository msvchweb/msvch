import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/admin-auth";
import { listAiCourseApplications, requireAiCourseAdmin } from "@/lib/ai-course-server";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAiCourseAdmin(request);
    const value = request.nextUrl.searchParams.get("page");
    const page = value === null ? 1 : Number(value);
    if ((value !== null && !/^[1-9]\d*$/.test(value)) || !Number.isSafeInteger(page) || page * 25 > Number.MAX_SAFE_INTEGER) {
      return NextResponse.json({ error: "페이지 번호를 확인해 주세요." }, { status: 400, headers });
    }
    return NextResponse.json(await listAiCourseApplications(supabase, page), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthError ? error.message : "신청 목록을 조회하지 못했습니다." }, { status: error instanceof AuthError ? error.status : 500, headers });
  }
}
