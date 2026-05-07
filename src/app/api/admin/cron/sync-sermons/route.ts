import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { fetchYouTubeUploads } from "@/lib/youtube";
import { categorizeSermon } from "@/lib/sermon-category";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

interface SyncSummary {
  fetched: number;
  upserted: number;
  inserted_new: number;
  error?: string;
}

/**
 * GET /api/admin/cron/sync-sermons
 *
 * 인증: x-cron-secret 헤더 또는 Authorization: Bearer (Vercel Cron 호환)
 * 동작: YouTube 업로드 플레이리스트 → 50개 fetch → sermon_videos upsert.
 *       기존 행은 메타데이터만 갱신, 신규 행은 추가 (누적).
 */
export async function GET(request: NextRequest) {
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected || !constantTimeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "supabase env missing" },
      { status: 500 },
    );
  }

  const videos = await fetchYouTubeUploads(50);
  if (videos.length === 0) {
    const summary: SyncSummary = {
      fetched: 0,
      upserted: 0,
      inserted_new: 0,
      error: "youtube returned 0 items (api key issue 또는 quota)",
    };
    return NextResponse.json(summary);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 신규 추가만 카운트하기 위해 미리 기존 video_id 조회
  const ids = videos.map((v) => v.videoId);
  const { data: existingRaw } = await supabase
    .from("sermon_videos")
    .select("video_id")
    .in("video_id", ids);
  const existingSet = new Set(
    ((existingRaw ?? []) as { video_id: string }[]).map((r) => r.video_id),
  );

  const rows = videos.map((v) => ({
    video_id: v.videoId,
    title: v.title,
    description: v.description,
    thumbnail: v.thumbnail,
    published_at: v.publishedAt,
    category: categorizeSermon(v.title),
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertErr } = await supabase
    .from("sermon_videos")
    .upsert(rows, { onConflict: "video_id" });

  if (upsertErr) {
    console.error("[cron/sync-sermons] upsert error", upsertErr);
    return NextResponse.json(
      { fetched: videos.length, upserted: 0, inserted_new: 0, error: upsertErr.message },
      { status: 500 },
    );
  }

  const insertedNew = videos.filter((v) => !existingSet.has(v.videoId)).length;

  const summary: SyncSummary = {
    fetched: videos.length,
    upserted: videos.length,
    inserted_new: insertedNew,
  };
  return NextResponse.json(summary);
}
