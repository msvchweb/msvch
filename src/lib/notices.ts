import { createClient } from "@/lib/supabase/server";
import type { HeroSlide, Notice, Weekly } from "@/types/notice";

export async function getNotices(): Promise<Notice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("is_public", true)
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as Notice[];
}

const CATEGORY_EYEBROW: Record<Notice["category"], string> = {
  일반: "교회소식",
  긴급: "긴급공지",
  행사: "교회행사",
};

const MYEONGBI_PRAYER_SLIDE: HeroSlide = {
  id: "myeongbi-prayer-2026",
  eyebrow: "기도사역",
  title: "2026 명비 기도인 모집",
  subtitle: "우리 교회는 기도합니다",
  image: "/images/myeongbi-prayer-banner.avif",
  href: "/myeongbi-prayer",
  date: "2026-07-01",
};

function extractSubtitle(content: string, max = 80): string {
  const stripped = content
    .replace(/\[IMG:[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max).trimEnd() + "…";
}

function extractHeroImage(notice: Notice): string | null {
  if (notice.images && notice.images.length > 0) return notice.images[0];
  const m = notice.content.match(/\[IMG:([^\]]+)\]/);
  return m ? m[1] : null;
}

function getNoticeHref(slug: string): string {
  const safeSlug = slug.trim();
  return safeSlug ? `/notice/${encodeURIComponent(safeSlug)}` : "/notice";
}

/**
 * 홈 히어로 슬라이드. 이미지가 있는 공개 공지만 최신순으로 채택.
 * 이미지 0건 공지는 제외 (레이아웃 깨짐 방지).
 */
export async function getHeroSlides(limit = 5): Promise<HeroSlide[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("is_public", true)
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  const notices = (data ?? []) as Notice[];
  const slides: HeroSlide[] = [];

  for (const n of notices) {
    const image = extractHeroImage(n);
    if (!image) continue;
    slides.push({
      id: n.slug,
      eyebrow: CATEGORY_EYEBROW[n.category] ?? "교회소식",
      title: n.title,
      subtitle: extractSubtitle(n.content),
      image,
      href: getNoticeHref(n.slug),
      date: n.date,
    });
    if (slides.length >= limit) break;
  }

  return [MYEONGBI_PRAYER_SLIDE, ...slides];
}

export async function getNoticeBySlug(slug: string): Promise<Notice | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  return (data as Notice) ?? null;
}

export async function getWeeklies(): Promise<Weekly[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weeklies")
    .select("*")
    .eq("is_published", true)
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []) as Weekly[];
}

export async function getWeeklyById(id: string): Promise<Weekly | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weeklies")
    .select("*")
    .eq("id", id)
    .single();

  return (data as Weekly) ?? null;
}
