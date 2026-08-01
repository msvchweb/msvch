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
import sharp from "sharp";
import { objectExists, publicUrlForKey, putObject } from "./lib/r2";

const BLOG_ID = "msvch01";
const RSS_URL = `https://rss.blog.naver.com/${BLOG_ID}`;
const STORAGE_PREFIX = "blog-images";
/** 공지 이미지는 화면 표시용이라 1600px 로 충분 (앱 CONTENT_IMAGE_PRESET 와 동일). */
const CONTENT_IMAGE_WIDTH = 1600;
const CONTENT_IMAGE_QUALITY = 82;
const MAX_IMAGES_PER_POST = 10;

const CATEGORY_NOTICE = "교회소식";
const CATEGORY_SCHOOL = "교회학교";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9",
};
const IMAGE_HEADERS = { ...HEADERS, Referer: "https://blog.naver.com/" };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient(supabaseUrl, serviceKey) as any;

// ── 타입 ──────────────────────────────────────────────────

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  category: string;
  logNo: string;
}

type ContentBlock =
  | { type: "text"; content: string }
  | { type: "image"; src: string };

interface ParsedPost {
  blocks: ContentBlock[];
}

// ── 유틸 ──────────────────────────────────────────────────

function stripCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function parseDate(raw: string): Date {
  const cleaned = stripCdata(raw).trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  const m = cleaned.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  return new Date();
}

function extractLogNo(url: string): string | null {
  return url.match(/\/(\d+)(?:\?|$)/)?.[1] ?? null;
}

function isNaverImageUrl(src: string): boolean {
  return /pstatic\.net|blogfiles\.naver\.net/i.test(src);
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  };
  return map[mime.split(";")[0].trim()] ?? "jpg";
}

// ── RSS 파싱 ──────────────────────────────────────────────

async function fetchRss(): Promise<RssItem[]> {
  const res = await fetch(RSS_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`RSS 요청 실패: ${res.status}`);
  const root = parseHtml(await res.text());

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

// ── 포스트 파싱 (텍스트 + 이미지 순서 유지) ──────────────

async function fetchPost(logNo: string): Promise<ParsedPost> {
  const url = `https://blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`포스트 요청 실패: ${res.status} (${logNo})`);
  const root = parseHtml(await res.text());

  const seContainer = root.querySelector(".se-main-container");
  if (seContainer) {
    const blocks: ContentBlock[] = [];
    let imageCount = 0;

    for (const comp of seContainer.querySelectorAll(".se-component")) {
      const isImageComp =
        comp.classList.value.includes("se-image") ||
        comp.querySelector(".se-image-resource") !== null;

      if (isImageComp && imageCount < MAX_IMAGES_PER_POST) {
        const img = comp.querySelector("img");
        const src =
          img?.getAttribute("data-lazy-src") ??
          img?.getAttribute("src") ?? "";
        if (src && isNaverImageUrl(src)) {
          blocks.push({ type: "image", src });
          imageCount++;
        }
        continue;
      }

      // 텍스트 컴포넌트
      const lines: string[] = [];
      for (const p of comp.querySelectorAll(
        ".se-text-paragraph, .se-heading-text, p, h2, h3"
      )) {
        const t = p.text.trim();
        if (t) lines.push(t);
      }
      if (lines.length > 0) {
        blocks.push({ type: "text", content: lines.join("\n") });
      }
    }

    if (blocks.length > 0) return { blocks };
    // 폴백: 전체 텍스트
    return { blocks: [{ type: "text", content: seContainer.text.replace(/\s{3,}/g, "\n\n").trim() }] };
  }

  // 구버전 에디터
  const legacyArea = root.querySelector("#postViewArea");
  if (legacyArea) {
    const blocks: ContentBlock[] = [];
    let imageCount = 0;

    for (const node of legacyArea.childNodes) {
      const el = node as ReturnType<typeof parseHtml>;
      if (el.rawTagName === "img" && imageCount < MAX_IMAGES_PER_POST) {
        const src = el.getAttribute?.("src") ?? "";
        if (src && isNaverImageUrl(src)) {
          blocks.push({ type: "image", src });
          imageCount++;
        }
      } else {
        const t = node.text?.trim();
        if (t) blocks.push({ type: "text", content: t });
      }
    }
    if (blocks.length > 0) return { blocks };
    return { blocks: [{ type: "text", content: legacyArea.text.replace(/\s{3,}/g, "\n\n").trim() }] };
  }

  throw new Error(`본문 컨테이너를 찾을 수 없습니다 (logNo: ${logNo})`);
}

// ── 이미지 업로드 ─────────────────────────────────────────

async function uploadImages(
  logNo: string,
  imageUrls: string[]
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  for (let i = 0; i < imageUrls.length; i++) {
    const src = imageUrls[i];
    try {
      const res = await fetch(src, { headers: IMAGE_HEADERS });
      if (!res.ok) { console.warn(`    이미지 다운로드 실패 (${res.status}): ${src}`); continue; }

      const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
      const original = Buffer.from(await res.arrayBuffer());

      // 이 이미지들은 공지 본문·홈 히어로가 그대로 로드한다(이미지 최적화 미사용).
      // 저장 시점이 유일한 최적화 지점이므로 webp 로 줄여 넣는다.
      // GIF 는 애니메이션이 깨지므로 원본을 유지한다.
      let body: Buffer = original;
      let contentType = mime;
      let ext = mimeToExt(mime);
      if (mime !== "image/gif") {
        try {
          const webp = await sharp(original)
            .resize({ width: CONTENT_IMAGE_WIDTH, withoutEnlargement: true })
            .webp({ quality: CONTENT_IMAGE_QUALITY })
            .toBuffer();
          if (webp.length < original.length) {
            body = webp;
            contentType = "image/webp";
            ext = "webp";
          }
        } catch (e) {
          console.warn(`    webp 변환 실패, 원본 사용: ${String(e)}`);
        }
      }

      const storageKey = `${STORAGE_PREFIX}/${logNo}/${i + 1}.${ext}`;

      if (await objectExists(storageKey)) {
        urlMap.set(src, publicUrlForKey(storageKey));
        console.log(`    이미지 ${i + 1} 이미 존재 (스킵)`);
        continue;
      }

      const publicUrl = await putObject(storageKey, body, contentType);
      urlMap.set(src, publicUrl);
      console.log(
        `    이미지 ${i + 1}/${imageUrls.length} 업로드 완료` +
          (contentType === "image/webp"
            ? ` (${(original.length / 1024).toFixed(0)}KB → ${(body.length / 1024).toFixed(0)}KB)`
            : ""),
      );

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.warn(`    이미지 처리 오류:`, err);
    }
  }

  return urlMap;
}

/** blocks + urlMap으로 최종 content 문자열 생성 */
function buildContent(blocks: ContentBlock[], urlMap: Map<string, string>): string {
  return blocks
    .map((block) => {
      if (block.type === "text") return block.content;
      const storageUrl = urlMap.get(block.src);
      return storageUrl ? `[IMG:${storageUrl}]` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

// ── Supabase 저장 ─────────────────────────────────────────

async function syncNotice(
  item: RssItem,
  content: string,
  images: string[]
) {
  const slug = `naver-${item.logNo}`;
  const date = parseDate(item.pubDate).toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("notices").select("id").eq("slug", slug).single();
  if (existing) { console.log(`  [공지] 이미 존재: ${item.title}`); return; }

  const { error } = await supabase.from("notices").insert({
    title: item.title, slug, category: "일반", content, images, date, is_public: true,
  });
  if (error) throw new Error(`notices 삽입 실패: ${error.message}`);
  console.log(`  [공지] 추가됨: ${item.title} (이미지 ${images.length}장)`);
}

async function syncSchoolPost(
  item: RssItem,
  content: string,
  images: string[]
) {
  const slug = `naver-${item.logNo}`;

  const { data: existing } = await supabase
    .from("churchschool_posts").select("id").eq("slug", slug).single();
  if (existing) { console.log(`  [교회학교] 이미 존재: ${item.title}`); return; }

  const { error } = await supabase.from("churchschool_posts").insert({
    title: item.title, slug, content, images,
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
    (i) => i.category.includes(CATEGORY_NOTICE) || i.category.includes(CATEGORY_SCHOOL)
  );
  console.log(`  대상 항목: ${targets.length}개`);

  for (const item of targets) {
    console.log(`\n처리 중: [${item.category}] ${item.title}`);
    try {
      const { blocks } = await fetchPost(item.logNo);

      const imageUrls = blocks
        .filter((b): b is Extract<ContentBlock, { type: "image" }> => b.type === "image")
        .map((b) => b.src);
      console.log(`  이미지 URL ${imageUrls.length}개 발견`);

      const urlMap = await uploadImages(item.logNo, imageUrls);
      const content = buildContent(blocks, urlMap);
      const images = [...urlMap.values()];

      if (item.category.includes(CATEGORY_NOTICE)) {
        await syncNotice(item, content, images);
      } else {
        await syncSchoolPost(item, content, images);
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
