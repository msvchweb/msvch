import type { SermonVideo, YouTubeSearchResponse } from "@/types/youtube";

export async function getSermonVideos(maxResults = 20): Promise<SermonVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey || !channelId || apiKey === "placeholder") {
    return [];
  }

  const params = new URLSearchParams({
    part: "snippet",
    channelId,
    maxResults: String(maxResults),
    order: "date",
    type: "video",
    key: apiKey,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return [];

  const data = (await res.json()) as YouTubeSearchResponse;

  return data.items.map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.high.url,
    publishedAt: item.snippet.publishedAt,
  }));
}

export async function getLatestSermon(): Promise<SermonVideo | null> {
  const videos = await getSermonVideos(1);
  return videos[0] || null;
}
