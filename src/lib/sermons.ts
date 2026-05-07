/**
 * 설교 영상 DB 리더.
 *
 * 표시용은 모두 이 모듈을 통해 sermon_videos 테이블에서 읽는다.
 * YouTube API 호출은 cron sync 경로(/api/admin/cron/sync-sermons)에서만 발생.
 */

import { createClient } from "@/lib/supabase/server";
import type { SermonVideo } from "@/types/youtube";

interface SermonVideoRow {
  video_id: string;
  title: string;
  description: string;
  thumbnail: string;
  published_at: string;
}

function rowToSermon(row: SermonVideoRow): SermonVideo {
  return {
    videoId: row.video_id,
    title: row.title,
    description: row.description,
    thumbnail: row.thumbnail,
    publishedAt: row.published_at,
  };
}

export async function getSermonVideos(limit = 100): Promise<SermonVideo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sermon_videos")
    .select("video_id, title, description, thumbnail, published_at")
    .order("published_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as SermonVideoRow[]).map(rowToSermon);
}

export async function getSermonByVideoId(
  videoId: string,
): Promise<SermonVideo | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sermon_videos")
    .select("video_id, title, description, thumbnail, published_at")
    .eq("video_id", videoId)
    .maybeSingle();
  if (!data) return null;
  return rowToSermon(data as SermonVideoRow);
}

export async function getLatestSermon(): Promise<SermonVideo | null> {
  const list = await getSermonVideos(1);
  return list[0] ?? null;
}
