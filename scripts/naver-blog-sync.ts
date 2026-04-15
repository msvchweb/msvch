/**
 * 네이버 블로그 → Supabase 동기화 스크립트
 *
 * 카테고리 매핑:
 *   교회소식  → notices 테이블 (category: '일반')
 *   교회학교  → churchschool_posts 테이블
 *
 * 실행: npx tsx scripts/naver-blog-sync.ts
 */

import { createClient } from "@supabase/supabase-js";
import { parse as parseHtml } from "node-html-parser";

const BLOG_ID = "msvch01";
const RSS_URL = `https://rss.blog.naver.com/${BLOG_ID}`;
const STORAGE_BUCKET = "blog-images";
const MAX_IMAGES_PER_POST = 10;

const CATEGORY_NOTICE = "교회소식";
const CATEGORY_SCHOOL = "교회학교";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

// 이미지 다운로드 시 Naver Referer 필요
const IMAGE_HEADERS = {
  ...HEADERS,
  Referer: "https://blog.naver.com/",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient(supabaseUrl, serviceKey) as any;

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  category: string;
  logNo: string;
}

interface ParsedPost {
  text: string;
  imageUrls: string[];
}

// ── 유틸 ──────────────────────────────────────────────────

function stripCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function parseDate(raw: string): Date {
  const cleaned = stripCdata(raw).trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  const dotMatch = cleaned.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (dotMatch) return new Date(`${dotMatch[1]}-${dotMatch[2]}-${dotMatch[3]}`);
  return new Date();
}

function extractLogNo(url: string): string | null {
  const match = url.match(/\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime.split(";")[0].trim()] ?? "jpg";
}

// ── RSS 파싱 ──────────────────────────────────────────────

async function fetchRss(): Promise<RssItem[]> {
  const res = await fetch(RSS_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`RSS 요청 실패: ${res.status}`);
  const xml = await res.text();
  const root = parseHtml(xml);

  return root
    .querySelectorAll("item")
    .map((item) => {
      const rawLink = stripCdata(
        item.querySelector("link")?.text?.trim() ??
        item.querySelector("guid")?.text?.trim() ?? ""
      );
      const link = rawLink.startsWith("http")
        ? rawLink
        : (item.rawText.match(/https?:\/\/blog\.naver\.com\/[^\s<]+/)?.[0] ?? "");

      return {
        title:    stripCdata(item.querySelector("title")?.text?.trim() ?? ""),
        link,
        pubDate:  stripCdata(item.querySelector("pubDate")?.text?.trim() ?? ""),
        category: stripCdata(item.querySelector("category")?.text?.trim() ?? ""),
        logNo:    extractLogNo(link) ?? "",
      };
    })
    .filter((i) => i.logNo);
}

// ── 포스트 본문 + 이미지 URL 파싱 ────────────────────────

function isNaverImageUrl(src: string): boolean {
  return /pstatic\.net|blogfiles\.naver\.net/i.test(src);
}

async function fetchPost(logNo: string): Promise<ParsedPost> {
  const url = `https://blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`포스트 요청 실패: ${res.status} (${logNo})`);
  const html = await res.text();
  const root = parseHtml(html);

  const seContainer = root.querySelector(".se-main-container");
  if (seContainer) {
    // 텍스트 추출
    const lines: string[] = [];
    for (const comp of seContainer.querySelectorAll(".se-component")) {
      for (const p of comp.querySelectorAll(
        ".se-text-paragraph, .se-heading-text, p, h2, h3"
      )) {
        const t = p.text.trim();
        if (t) lines.push(t);
      }
    }
    const text =
      lines.length > 0
        ? lines.join("\n\n")
        : seContainer.text.replace(/\s{3,}/g, "\n\n").trim();

    // 이미지 URL 추출 (SE 이미지 컴포넌트)
    const imageUrls: string[] = [];
    for (const img of seContainer.querySelectorAll("img")) {
      const src =
        img.getAttribute("data-lazy-src") ??
        img.getAttribute("src") ??
        "";
      if (src && isNaverImageUrl(src) && !imageUrls.includes(src)) {
        imageUrls.push(src);
        if (imageUrls.length >= MAX_IMAGES_PER_POST) break;
      }
    }

    return { text, imageUrls };
  }

  // 구버전 에디터
  const legacyArea = root.querySelector("#postViewArea");
  if (legacyArea) {
    const text = legacyArea.text.replace(/\s{3,}/g, "\n\n").trim();
    const imageUrls: string[] = [];
    for (const img of legacyArea.querySelectorAll("img")) {
      const src = img.getAttribute("src") ?? "";
      if (src && isNaverImageUrl(src) && !imageUrls.includes(src)) {
        imageUrls.push(src);
        if (imageUrls.length >= MAX_IMAGES_PER_POST) break;
      }
    }
    return { text, imageUrls };
  }

  throw new Error(`본문 컨테이너를 찾을 수 없습니다 (logNo: ${logNo})`);
}

// ── 이미지 다운로드 → Supabase Storage 업로드 ────────────

async function uploadImages(
  logNo: string,
  imageUrls: string[]
): Promise<string[]> {
  if (imageUrls.length === 0) return [];

  const publicUrls: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const src = imageUrls[i];
    try {
      const res = await fetch(src, { headers: IMAGE_HEADERS });
      if (!res.ok) {
        console.warn(`    이미지 다운로드 실패 (${res.status}): ${src}`);
        continue;
      }

      const mime = res.headers.get("content-type") ?? "image/jpeg";
      const ext = mimeToExt(mime);
      const storagePath = `${logNo}/${i + 1}.${ext}`;
      const buffer = Buffer.from(await res.arrayBuffer());

      // 이미 존재하면 스킵
      const { data: existing } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(logNo, { search: `${i + 1}.${ext}` });

      if (existing && existing.length > 0) {
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath);
        publicUrls.push(urlData.publicUrl);
        console.log(`    이미지 ${i + 1} 이미 존재 (스킵)`);
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mime.split(";")[0].trim(),
          upsert: false,
        });

      if (uploadError) {
        console.warn(`    이미지 업로드 실패: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);
      publicUrls.push(urlData.publicUrl);
      console.log(`    이미지 ${i + 1}/${imageUrls.length} 업로드 완료`);

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.warn(`    이미지 처리 오류:`, err);
    }
  }

  return publicUrls;
}

// ── Supabase 저장 ─────────────────────────────────────────

async function syncNotice(item: RssItem, text: string, images: string[]) {
  const slug = `naver-${item.logNo}`;
  const date = parseDate(item.pubDate).toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("notices")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    console.log(`  [공지] 이미 존재: ${item.title}`);
    return;
  }

  const { error } = await supabase.from("notices").insert({
    title: item.title,
    slug,
    category: "일반",
    content: text,
    images,
    date,
    is_public: true,
  });
  if (error) throw new Error(`notices 삽입 실패: ${error.message}`);
  console.log(`  [공지] 추가됨: ${item.title} (이미지 ${images.length}장)`);
}

async function syncSchoolPost(item: RssItem, text: string, images: string[]) {
  const slug = `naver-${item.logNo}`;

  const { data: existing } = await supabase
    .from("churchschool_posts")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    console.log(`  [교회학교] 이미 존재: ${item.title}`);
    return;
  }

  const { error } = await supabase.from("churchschool_posts").insert({
    title: item.title,
    slug,
    content: text,
    images,
    naver_url: item.link,
    published_at: parseDate(item.pubDate).toISOString(),
  });
  if (error) throw new Error(`churchschool_posts 삽입 실패: ${error.message}`);
  console.log(`  [교회학교] 추가됨: ${item.title} (이미지 ${images.length}장)`);
}

// ── 메인 ─────────────────────────────────────────────────

async function main() {
  console.log("RSS 가져오는 중...");
  const items = await fetchRss();
  console.log(`  총 ${items.length}개 항목 발견`);

  const targets = items.filter(
    (i) =>
      i.category.includes(CATEGORY_NOTICE) ||
      i.category.includes(CATEGORY_SCHOOL)
  );
  console.log(`  대상 항목: ${targets.length}개`);

  for (const item of targets) {
    console.log(`\n처리 중: [${item.category}] ${item.title}`);
    try {
      const { text, imageUrls } = await fetchPost(item.logNo);
      console.log(`  텍스트 추출 완료, 이미지 URL ${imageUrls.length}개 발견`);

      const images = await uploadImages(item.logNo, imageUrls);

      if (item.category.includes(CATEGORY_NOTICE)) {
        await syncNotice(item, text, images);
      } else {
        await syncSchoolPost(item, text, images);
      }

      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`  오류 (${item.logNo}):`, err);
    }
  }

  console.log("\n동기화 완료.");
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
