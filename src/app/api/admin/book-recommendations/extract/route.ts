import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parse, type HTMLElement } from "node-html-parser";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import type { BookSourceData } from "@/types/book-recommendation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RequestSchema = z.object({
  url: z.string().trim().url(),
});

const MAX_HTML_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "올바른 URL을 입력해 주세요." },
        { status: 400 },
      );
    }

    const target = parseYes24Url(parsed.data.url);
    if (!target) {
      return NextResponse.json(
        { error: "YES24 도서 상품 URL만 사용할 수 있습니다." },
        { status: 400 },
      );
    }

    const html = await fetchHtml(target.url);
    const book = extractYes24Book(html, target.url, target.productId);

    return NextResponse.json({ book });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("book-recommendations/extract error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "도서 정보를 가져오지 못했습니다." },
      { status: 500 },
    );
  }
}

function parseYes24Url(rawUrl: string): { url: string; productId: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "www.yes24.com" && host !== "yes24.com") return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const match = url.pathname.match(/^\/Product\/Goods\/(\d+)/i);
  if (!match) return null;

  return {
    url: `https://www.yes24.com/Product/Goods/${match[1]}`,
    productId: match[1],
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; msvch-book-recommendation/1.0; +https://www.msvch.org)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`YES24 응답 오류: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error("YES24에서 HTML 응답을 받지 못했습니다.");
  }

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_HTML_BYTES) {
    throw new Error("YES24 응답이 너무 큽니다.");
  }

  const html = await res.text();
  if (new Blob([html]).size > MAX_HTML_BYTES) {
    throw new Error("YES24 응답이 너무 큽니다.");
  }
  return html;
}

function extractYes24Book(html: string, sourceUrl: string, productId: string): BookSourceData {
  const root = parse(html);
  const rawText = normalize(root.structuredText || root.textContent || "");

  const title =
    firstContent(root, [
      'meta[property="og:title"]',
      'meta[name="title"]',
      "h2.gd_name",
      "h1",
    ]) || capture(rawText, /(?:^|\n)\s*##\s*([^\n]+)\s*/);

  const coverImageUrl =
    absoluteUrl(
      firstContent(root, [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        "#yesBigImg",
        ".gImg img",
      ]),
      sourceUrl,
    ) || undefined;

  const authorLine =
    textFromSelector(root, ".gd_auth") ||
    capture(rawText, new RegExp(`${escapeRegExp(title || "")}\\s+([^\\n]+?저\\s*\\|[^\\n]+)`));

  const meta = parseMainMeta(authorLine || rawText);
  const publishedDate =
    meta.publishedDate || capture(rawText, /발행일\s*([0-9]{4}년\s*[0-9]{1,2}월\s*[0-9]{1,2}일)/);
  const pageInfo =
    capture(rawText, /쪽수,\s*무게,\s*크기\s*([^\n]+)/) ||
    capture(rawText, /([0-9]+쪽\s*\|\s*[0-9* xX]+mm)/);
  const isbn13 = capture(rawText, /ISBN13\s*([0-9Xx-]+)/);
  const isbn10 = capture(rawText, /ISBN10\s*([0-9Xx-]+)/);
  const categoryPath = extractCategoryPath(root, rawText);

  const description = sectionText(rawText, "책소개", ["관련 동영상", "목차"]);
  const tableOfContents = sectionText(rawText, "목차", ["상세 이미지", "저자 소개"]);
  const authorBio = sectionText(rawText, "저자 소개", ["만든 이 코멘트", "책 속으로"]);
  const publisherReview = sectionText(rawText, "출판사 리뷰", ["추천평", "회원리뷰", "배송"]);
  const quotesText = sectionText(rawText, "책 속으로", ["출판사 리뷰", "추천평"]);

  const book: BookSourceData = {
    sourceUrl,
    provider: "yes24",
    productId,
    title: cleanTitle(title) || "제목 미상",
    author: meta.author || "저자 미상",
    publisher: meta.publisher || "출판사 미상",
    publishedDate: publishedDate || undefined,
    isbn13: isbn13 || undefined,
    isbn10: isbn10 || undefined,
    pageInfo: pageInfo || undefined,
    categoryPath,
    coverImageUrl,
    description: limitText(description, 1200),
    tableOfContents: limitText(tableOfContents, 1800),
    authorBio: limitText(authorBio, 1200),
    publisherReview: limitText(publisherReview, 1600),
    quotes: quotesText ? splitQuotes(quotesText).slice(0, 5) : undefined,
  };

  return book;
}

function firstContent(root: HTMLElement, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (!el) continue;
    const content = el.getAttribute("content") || el.getAttribute("src") || el.textContent;
    const value = normalize(content || "");
    if (value) return value;
  }
  return undefined;
}

function textFromSelector(root: HTMLElement, selector: string): string | undefined {
  const el = root.querySelector(selector);
  const value = normalize(el?.textContent || "");
  return value || undefined;
}

function parseMainMeta(input: string): {
  author?: string;
  publisher?: string;
  publishedDate?: string;
} {
  const text = normalize(input);
  const compact = text.replace(/\s+/g, " ");
  const match = compact.match(/(.+?)\s*저\s*\|\s*([^|]+)\|\s*([0-9]{4}년\s*[0-9]{1,2}월\s*[0-9]{1,2}일)/);
  if (match) {
    return {
      author: normalize(match[1]).replace(/^저\s*:\s*/, ""),
      publisher: normalize(match[2]),
      publishedDate: normalize(match[3]),
    };
  }

  const fallback = compact.match(/([^\n|]+?)\s*저\s*\|\s*([^|]+)\|/);
  if (fallback) {
    return {
      author: normalize(fallback[1]).replace(/^저\s*:\s*/, ""),
      publisher: normalize(fallback[2]),
    };
  }

  return {};
}

function extractCategoryPath(root: HTMLElement, rawText: string): string[] {
  const links = root.querySelectorAll("a").map((a) => normalize(a.textContent));
  const known = ["국내도서", "종교", "기독교(개신교)", "신앙생활", "영적성장/비전"];
  const found = known.filter((item) => links.includes(item) || rawText.includes(item));
  if (found.length > 0) return found;
  const line = capture(rawText, /카테고리\s*분류\s*([^\n]+)/);
  return line
    ? line
        .split(">")
        .map((v) => normalize(v))
        .filter(Boolean)
    : [];
}

function sectionText(rawText: string, start: string, endLabels: string[]): string | undefined {
  const startIndex = rawText.indexOf(start);
  if (startIndex < 0) return undefined;
  let endIndex = rawText.length;
  for (const label of endLabels) {
    const idx = rawText.indexOf(label, startIndex + start.length);
    if (idx > startIndex && idx < endIndex) endIndex = idx;
  }
  const text = normalize(rawText.slice(startIndex + start.length, endIndex));
  return text || undefined;
}

function splitQuotes(text: string): string[] {
  return text
    .split(/---\s*p\.[0-9]+/i)
    .map((v) => normalize(v))
    .filter((v) => v.length > 20)
    .map((v) => limitText(v, 260))
    .filter((v): v is string => Boolean(v));
}

function normalize(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTitle(value?: string): string | undefined {
  if (!value) return undefined;
  return normalize(value.replace(/\s*-\s*예스24\s*$/i, ""));
}

function capture(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  return match?.[1] ? normalize(match[1]) : undefined;
}

function limitText(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max).trimEnd()}...` : value;
}

function absoluteUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
