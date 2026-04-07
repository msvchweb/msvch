import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSermonVideos } from "@/lib/youtube";

export interface NewContentDates {
  notices: string | null;
  sermons: string | null;
  gallery: string | null;
  weeklies: string | null;
}

/** 콘텐츠 키 유니온 타입 — 프로젝트 전역에서 사용 */
export type ContentKey = keyof NewContentDates;

export const revalidate = 600;

export async function GET() {
  const supabase = await createClient();

  const [noticeRes, galleryRes, weeklyRes, sermons] = await Promise.all([
    supabase
      .from("notices")
      .select("date")
      .eq("is_public", true)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("gallery_albums")
      .select("created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weeklies")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSermonVideos(1),
  ]);

  const dates: NewContentDates = {
    notices: noticeRes.data?.date ?? null,
    sermons: sermons[0]?.publishedAt ?? null,
    gallery: galleryRes.data?.created_at ?? null,
    weeklies: weeklyRes.data?.date ?? null,
  };

  return NextResponse.json(dates);
}
