/**
 * YouTube 업로드 플레이리스트 fetch — cron sync 전용.
 *
 * 표시용 코드는 이 모듈을 직접 호출하지 않는다. (대신 src/lib/sermons.ts → DB)
 * 호출 횟수를 최소화하기 위해 sync 엔드포인트에서만 사용.
 */

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

/**
 * 업로드 플레이리스트에서 최근 영상 fetch.
 * sync 시 누적 저장하므로 maxResults 가 작아도 시간이 지나면 DB에 자연스럽게 누적됨.
 */
export async function fetchYouTubeUploads(
  maxResults = 50,
): Promise<SermonVideo[]> {
  if (!API_KEY) {
    console.error("YOUTUBE_API_KEY is not set");
    return [];
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${UPLOADS_PLAYLIST_ID}&maxResults=${maxResults}&key=${API_KEY}`;
    const res = await fetch(url, { cache: "no-store" });

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
