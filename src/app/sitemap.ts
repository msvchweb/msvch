import type { MetadataRoute } from "next";
import { getNotices } from "@/lib/notion";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.msvch.org";

  const staticPages = [
    "",
    "/greetings",
    "/intro",
    "/map",
    "/worship",
    "/weekly",
    "/timetable",
    "/sermons",
    "/churchschool",
    "/churchschool/infant",
    "/churchschool/elementary",
    "/churchschool/teen",
    "/churchschool/youth",
    "/notice",
    "/gallery",
    "/volunteer",
    "/ministry",
    "/ministry/beauty",
    "/ministry/tabletennis",
    "/ministry/sidedish",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
  }));

  const notices = await getNotices();
  const noticePages = notices.map((n) => ({
    url: `${baseUrl}/notice/${n.slug}`,
    lastModified: n.date ? new Date(n.date) : new Date(),
    changeFrequency: "monthly" as const,
  }));

  return [...staticPages, ...noticePages];
}
