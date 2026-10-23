import { NextRequest, NextResponse } from "next/server";
import { AiCourseSubmissionSchema, aiCourseFieldErrors } from "@/lib/ai-course";
import { createServiceClient } from "@/lib/supabase/api";
import { submitAiCourseApplication } from "@/lib/ai-course-server";

export async function POST(request: NextRequest) {
  if (process.env.AI_COURSE_PREVIEW === "1") return NextResponse.json({ error: "미리보기에서는 신청을 전송하지 않습니다." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ error: "신청 내용을 확인해 주세요." }, { status: 400 }); }
  const parsed = AiCourseSubmissionSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "입력한 내용을 확인해 주세요.", fieldErrors: aiCourseFieldErrors(parsed.error) }, { status: 400 });
  try {
    const result = await submitAiCourseApplication(createServiceClient(), parsed.data);
    if (result === "conflict") return NextResponse.json({ error: "이전 제출 내용과 다릅니다. 내용을 확인한 후 다시 제출해 주세요." }, { status: 409 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "신청을 저장하지 못했습니다. 잠시 후 다시 제출해 주세요." }, { status: 500 });
  }
}
