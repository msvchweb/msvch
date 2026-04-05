import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import type {
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { NoticeItem, NoticeDetail, WeeklyItem, GalleryAlbum } from "@/types/notion";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });

function isConfigured(): boolean {
  const key = process.env.NOTION_API_KEY;
  return Boolean(key && key !== "placeholder" && key.startsWith("secret_"));
}

// --- Property helpers ---

function getTitle(page: PageObjectResponse): string {
  const prop = Object.values(page.properties).find((p) => p.type === "title");
  if (prop?.type === "title") {
    return prop.title.map((t) => t.plain_text).join("");
  }
  return "";
}

function getRichText(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  if (prop?.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

function getDate(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (prop?.type === "date" && prop.date) {
    return prop.date.start;
  }
  return null;
}

function getSelect(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (prop?.type === "select" && prop.select) {
    return prop.select.name;
  }
  return null;
}

function getFiles(page: PageObjectResponse, name: string): string[] {
  const prop = page.properties[name];
  if (prop?.type === "files") {
    return prop.files
      .map((f) => {
        if (f.type === "file") return f.file.url;
        if (f.type === "external") return f.external.url;
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

function getCoverImage(page: PageObjectResponse): string | undefined {
  if (page.cover?.type === "file") return page.cover.file.url;
  if (page.cover?.type === "external") return page.cover.external.url;
  return undefined;
}

// --- Notices ---

export async function getNotices(): Promise<NoticeItem[]> {
  const dbId = process.env.NOTION_NOTICE_DB_ID;
  if (!dbId || dbId === "placeholder" || !isConfigured()) return [];

  try {
    const response = await notion.databases.query({
      database_id: dbId,
      filter: { property: "\uacf5\uac1c", checkbox: { equals: true } },
      sorts: [{ property: "\ub0a0\uc9dc", direction: "descending" }],
    });

    return (response.results as PageObjectResponse[]).map((page) => ({
      id: page.id,
      title: getTitle(page),
      slug: getRichText(page, "\uc2ac\ub7ec\uadf8") || page.id,
      category: getSelect(page, "\uce74\ud14c\uace0\ub9ac"),
      date: getDate(page, "\ub0a0\uc9dc"),
      coverImage: getCoverImage(page),
    }));
  } catch {
    return [];
  }
}

export async function getNoticeBySlug(slug: string): Promise<NoticeDetail | null> {
  const notices = await getNotices();
  const notice = notices.find((n) => n.slug === slug);
  if (!notice) return null;

  try {
    const mdBlocks = await n2m.pageToMarkdown(notice.id);
    const content = n2m.toMarkdownString(mdBlocks).parent;
    return { ...notice, content };
  } catch {
    return { ...notice, content: "" };
  }
}

// --- Weeklies ---

export async function getWeeklies(): Promise<WeeklyItem[]> {
  const dbId = process.env.NOTION_WEEKLY_DB_ID;
  if (!dbId || dbId === "placeholder" || !isConfigured()) return [];

  try {
    const response = await notion.databases.query({
      database_id: dbId,
      sorts: [{ property: "\ub0a0\uc9dc", direction: "descending" }],
      page_size: 20,
    });

    return (response.results as PageObjectResponse[]).map((page) => ({
      id: page.id,
      title: getTitle(page),
      date: getDate(page, "\ub0a0\uc9dc"),
      pdfUrl: getFiles(page, "PDF")[0] || null,
    }));
  } catch {
    return [];
  }
}

// --- Gallery ---

export async function getGalleryAlbums(): Promise<GalleryAlbum[]> {
  const dbId = process.env.NOTION_GALLERY_DB_ID;
  if (!dbId || dbId === "placeholder" || !isConfigured()) return [];

  try {
    const response = await notion.databases.query({
      database_id: dbId,
      filter: { property: "\uacf5\uac1c", checkbox: { equals: true } },
      sorts: [{ property: "\ub0a0\uc9dc", direction: "descending" }],
    });

    return (response.results as PageObjectResponse[]).map((page) => ({
      id: page.id,
      title: getTitle(page),
      category: getSelect(page, "\uce74\ud14c\uace0\ub9ac"),
      date: getDate(page, "\ub0a0\uc9dc"),
      thumbnail: getFiles(page, "\ub300\ud45c\uc774\ubbf8\uc9c0")[0] || null,
      images: getFiles(page, "\uc774\ubbf8\uc9c0\ub4e4"),
    }));
  } catch {
    return [];
  }
}
