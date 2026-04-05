import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { summarizeSermonFromVideo } from "@/lib/gemini";
import type { SermonVideo } from "@/types/youtube";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Server Component */ }
        },
      },
    }
  );

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
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = await request.json() as { sermon: SermonVideo; saveAsNotice: boolean };

  try {
    // Summarize with Gemini (directly from video or description)
    const summary = await summarizeSermonFromVideo(body.sermon);

    // Optionally save as notice
    if (body.saveAsNotice) {
      const slug = `sermon-${body.sermon.videoId}`;
      const title = `[설교요약] ${body.sermon.title}`;
      const date = body.sermon.publishedAt.split("T")[0];

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
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
