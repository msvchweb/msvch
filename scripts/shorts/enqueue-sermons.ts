import { z } from "zod";
import { shortsDb } from "../../src/lib/shorts/db";
import { createGeneration } from "../../src/lib/shorts/generation";
import {
  isEligibleForAutoGeneration,
  type SourcePolicy,
  type SourceVideo,
} from "../../src/lib/shorts/eligibility";
import { categorizeSermon } from "../../src/lib/sermon-category";
export async function enqueueCandidates(
  videos: SourceVideo[],
  policy: SourcePolicy,
  existing: Set<string>,
  create = createGeneration,
  count: 5 | 10 = 5,
) {
  const result = {
    queued: [] as string[],
    failed: [] as string[],
    excluded: 0,
  };
  for (const video of videos) {
    if (
      existing.has(video.videoId) ||
      !isEligibleForAutoGeneration(video, policy)
    ) {
      result.excluded++;
      continue;
    }
    existing.add(video.videoId);
    try {
      await create({
        videoId: video.videoId,
        videoTitle: video.title,
        videoPublishedAt: video.publishedAt,
        videoThumbnail:
          "https://i.ytimg.com/vi/" + video.videoId + "/hqdefault.jpg",
        count,
      });
      result.queued.push(video.videoId);
    } catch {
      result.failed.push(video.videoId);
    }
  }
  return result;
}
export function durationSeconds(value: string) {
  const m = value.match(
    /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/,
  );
  return m
    ? Number(m[1] ?? 0) * 86400 +
        Number(m[2] ?? 0) * 3600 +
        Number(m[3] ?? 0) * 60 +
        Number(m[4] ?? 0)
    : NaN;
}
const PlaylistSchema = z.object({
  items: z.array(
    z.object({ contentDetails: z.object({ videoId: z.string() }) }),
  ),
  nextPageToken: z.string().optional(),
});
const VideoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({
        title: z.string(),
        channelId: z.string(),
        publishedAt: z.string(),
        liveBroadcastContent: z.string(),
      }),
      contentDetails: z.object({ duration: z.string() }),
      status: z.object({ privacyStatus: z.string() }),
    }),
  ),
});
export async function enqueueSermons() {
  const db = shortsDb();
  const { data: settings, error } = await db
    .from("shorts_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw new Error("settings_read_failed");
  if (!settings?.auto_generate_enabled)
    return { queued: [], failed: [], excluded: 0 };
  const key = process.env.YOUTUBE_API_KEY,
    channel =
      process.env.SHORTS_SOURCE_CHANNEL_ID || process.env.YOUTUBE_CHANNEL_ID;
  if (
    !key ||
    !channel ||
    !settings.source_playlist_id ||
    !settings.auto_generate_after
  )
    throw new Error("source_policy_missing");
  async function get(resource: string, params: Record<string, string>) {
    const url = new URL("https://www.googleapis.com/youtube/v3/" + resource);
    url.search = new URLSearchParams({ ...params, key: key! }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("youtube_discovery_" + response.status);
    return response.json();
  }
  const ids: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 100; page++) {
    const data = PlaylistSchema.parse(
      await get("playlistItems", {
        part: "contentDetails",
        playlistId: settings.source_playlist_id,
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      }),
    );
    ids.push(...data.items.map((i) => i.contentDetails.videoId));
    if (!data.nextPageToken) {
      pageToken = "";
      break;
    }
    pageToken = data.nextPageToken;
  }
  if (pageToken) throw new Error("source_playlist_scan_limit_reached");
  const result = {
    queued: [] as string[],
    failed: [] as string[],
    excluded: 0,
  };
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 50) {
    const batch = unique.slice(offset, offset + 50);
    const [raw, existing, published] = await Promise.all([
      get("videos", {
        part: "snippet,contentDetails,status",
        id: batch.join(","),
      }),
      db.from("shorts_jobs").select("video_id").in("video_id", batch),
      db
        .from("shorts_clips")
        .select("youtube_video_id")
        .in("youtube_video_id", batch),
    ]);
    if (existing.error || published.error)
      throw new Error("source_jobs_read_failed");
    const videos = VideoSchema.parse(raw)
      .items.filter((v) => v.status.privacyStatus === "public")
      .map((v) => ({
        videoId: v.id,
        title: v.snippet.title,
        channelId: v.snippet.channelId,
        publishedAt: v.snippet.publishedAt,
        durationSec: durationSeconds(v.contentDetails.duration),
        category: categorizeSermon(v.snippet.title),
        liveStatus: v.snippet.liveBroadcastContent,
        inSourcePlaylist: true,
      }));
    const policy: SourcePolicy = {
      enabled: true,
      sourceChannelId: channel,
      sourcePlaylistId: settings.source_playlist_id,
      enabledAfter: settings.auto_generate_after,
      allowedCategories: settings.allowed_categories,
      publishedVideoIds: published.data?.map((p) => p.youtube_video_id) ?? [],
    };
    const added = await enqueueCandidates(
      videos,
      policy,
      new Set(existing.data?.map((j) => j.video_id)),
      createGeneration,
      settings.max_clips_per_sermon === 10 ? 10 : 5,
    );
    result.queued.push(...added.queued);
    result.failed.push(...added.failed);
    result.excluded += added.excluded;
  }
  return result;
}
