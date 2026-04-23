import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { hasStaffAccess } from "@/lib/admin-auth";
import { summarizeSermonFromVideo, GeminiUnavailableError } from "@/lib/gemini";
import { SermonSummarySchema } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createApiClient(request);

  // Check admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!hasStaffAccess((profile as { role?: string } | null)?.role)) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const parsed = SermonSummarySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "잘못된 요청 형식입니다." },
      { status: 400 },
    );
  }
  const { sermon, saveAsNotice } = parsed.data;

  try {
    const summary = await summarizeSermonFromVideo({
      videoId: sermon.videoId,
      title: sermon.title,
      description: sermon.description,
      thumbnail: sermon.thumbnail,
      publishedAt: sermon.publishedAt,
    });

    if (saveAsNotice) {
      const slug = `sermon-${sermon.videoId}`;
      const title = `[설교요약] ${sermon.title}`;
      const date = sermon.publishedAt.split("T")[0];

      const { data: existing } = await supabase
        .from("notices")
        .select("id")
        .eq("slug", slug)
        .single();

      if (existing) {
        await supabase
          .from("notices")
          .update({ title, content: summary, date })
          .eq("id", existing.id);
      } else {
        await supabase.from("notices").insert({
          title, slug, category: "일반",
          content: summary, date, is_public: true,
        });
      }
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Sermon summary error:", err);
    const status = err instanceof GeminiUnavailableError ? 503 : 500;
    return NextResponse.json(
      { error: status === 503 ? "AI 서버가 일시적으로 혼잡합니다." : "요약 생성에 실패했습니다." },
      { status },
    );
  }
}
