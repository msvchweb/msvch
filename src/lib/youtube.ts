import type { SermonVideo } from "@/types/youtube";

const CHANNEL_ID = "UCcJc6fm6McCxvpizoe3T4YQ";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

interface RssEntry {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

function parseXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function parseXmlAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/?>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseEntries(xml: string): RssEntry[] {
  const entries: RssEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const videoId = parseXmlTag(entry, "yt:videoId");
    const title = decodeHtmlEntities(parseXmlTag(entry, "title"));
    const description = decodeHtmlEntities(parseXmlTag(entry, "media:description"));
    const thumbnail = parseXmlAttr(entry, "media:thumbnail", "url");
    const published = parseXmlTag(entry, "published");

    if (videoId) {
      entries.push({
        videoId,
        title,
        description,
        thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: published,
      });
    }
  }

  return entries;
}

export async function getSermonVideos(maxResults = 15): Promise<SermonVideo[]> {
  try {
    const res = await fetch(RSS_URL, {
      next: { revalidate: 1800 },
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; msvch/1.0)",
      },
    });
    if (!res.ok) {
      console.error(`YouTube RSS fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const xml = await res.text();
    const entries = parseEntries(xml);

    return entries.slice(0, maxResults);
  } catch (error) {
    console.error("YouTube RSS fetch error:", error);
    return [];
  }
}

export async function getLatestSermon(): Promise<SermonVideo | null> {
  const videos = await getSermonVideos(1);
  return videos[0] || null;
}
