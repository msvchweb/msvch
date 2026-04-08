import type { SermonVideo } from "@/types/youtube";

const API_KEY = process.env.YOUTUBE_API_KEY ?? "";
const UPLOADS_PLAYLIST_ID = "UUcJc6fm6McCxvpizoe3T4YQ";

interface PlaylistItemSnippet {
  title: string;
  description: string;
  publishedAt: string;
  resourceId: { videoId: string };
  thumbnails?: { high?: { url: string } };
}

interface PlaylistItemsResponse {
  items?: { snippet: PlaylistItemSnippet }[];
  nextPageToken?: string;
}

export async function getSermonVideos(maxResults = 15): Promise<SermonVideo[]> {
  if (!API_KEY) {
    console.error("YOUTUBE_API_KEY is not set");
    return [];
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${UPLOADS_PLAYLIST_ID}&maxResults=${maxResults}&key=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });

    if (!res.ok) {
      console.error(`YouTube API failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data: PlaylistItemsResponse = await res.json();
    if (!data.items) return [];

    return data.items.map((item) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail:
        item.snippet.thumbnails?.high?.url ??
        `https://i.ytimg.com/vi/${item.snippet.resourceId.videoId}/hqdefault.jpg`,
      publishedAt: item.snippet.publishedAt,
    }));
  } catch (error) {
    console.error("YouTube API error:", error);
    return [];
  }
}

export async function getLatestSermon(): Promise<SermonVideo | null> {
  const videos = await getSermonVideos(1);
  return videos[0] || null;
}
