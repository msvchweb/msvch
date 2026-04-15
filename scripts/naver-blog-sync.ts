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

const CATEGORY_NOTICE = "교회소식";
const CATEGORY_SCHOOL = "교회학교";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9",
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

function extractLogNo(url: string): string | null {
  const match = url.match(/\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

async function fetchRss(): Promise<RssItem[]> {
  const res = await fetch(RSS_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`RSS 요청 실패: ${res.status}`);
  const xml = await res.text();

  const root = parseHtml(xml);
  const items = root.querySelectorAll("item");

  return items
    .map((item) => {
      const rawLink =
        item.querySelector("link")?.text?.trim() ??
        item.querySelector("guid")?.text?.trim() ??
        "";
      const link = rawLink.startsWith("http")
        ? rawLink
        : (item.rawText.match(/https?:\/\/blog\.naver\.com\/[^\s<]+/)?.[0] ?? "");

      return {
        title: item.querySelector("title")?.text?.trim() ?? "",
        link,
        pubDate: item.querySelector("pubDate")?.text?.trim() ?? "",
        category: item.querySelector("category")?.text?.trim() ?? "",
        logNo: extractLogNo(link) ?? "",
      };
    })
    .filter((i) => i.logNo);
}

async function fetchPostContent(logNo: string): Promise<string> {
  const url = `https://blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`포스트 요청 실패: ${res.status} (${logNo})`);
  const html = await res.text();
  const root = parseHtml(html);

  // Smart Editor (SE) — 최신 포스트
  const seContainer = root.querySelector(".se-main-container");
  if (seContainer) {
    const lines: string[] = [];
    for (const section of seContainer.querySelectorAll(".se-component")) {
      for (const p of section.querySelectorAll(
        ".se-text-paragraph, .se-heading-text, p, h2, h3"
      )) {
        const text = p.text.trim();
        if (text) lines.push(text);
      }
    }
    if (lines.length > 0) return lines.join("\n\n");
    return seContainer.text.replace(/\s{3,}/g, "\n\n").trim();
  }

  // 구버전 에디터
  const legacyArea = root.querySelector("#postViewArea");
  if (legacyArea) {
    return legacyArea.text.replace(/\s{3,}/g, "\n\n").trim();
  }

  throw new Error(`본문 컨테이너를 찾을 수 없습니다 (logNo: ${logNo})`);
}

async function syncNotice(item: RssItem, content: string) {
  const slug = `naver-${item.logNo}`;
  const date = new Date(item.pubDate).toISOString().split("T")[0];

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
    content,
    date,
    is_public: true,
  });
  if (error) throw new Error(`notices 삽입 실패: ${error.message}`);
  console.log(`  [공지] 추가됨: ${item.title}`);
}

async function syncSchoolPost(item: RssItem, content: string) {
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
    content,
    naver_url: item.link,
    published_at: new Date(item.pubDate).toISOString(),
  });
  if (error) throw new Error(`churchschool_posts 삽입 실패: ${error.message}`);
  console.log(`  [교회학교] 추가됨: ${item.title}`);
}

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
      const content = await fetchPostContent(item.logNo);

      if (item.category.includes(CATEGORY_NOTICE)) {
        await syncNotice(item, content);
      } else {
        await syncSchoolPost(item, content);
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
