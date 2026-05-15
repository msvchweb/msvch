import { NextResponse } from "next/server";
import { loadUpdates, stripMetaComments, type UpdateEntry } from "@/lib/updates";

/** ISR 1시간. UPDATES.md 변경 후 재배포 시 즉시 반영. */
export const revalidate = 3600;

interface PublicUpdateItem {
  date: string;
  title: string;
  body: string;
  highlight: boolean;
}

function toPublic(e: UpdateEntry): PublicUpdateItem {
  return {
    date: e.date,
    title: e.title,
    body: stripMetaComments(e.body),
    highlight: e.highlight,
  };
}

/**
 * GET /api/updates
 *   ?limit=number   (default 20, max 50)
 *   ?since=YYYY-MM-DD  (해당 날짜 이후만)
 * 응답: { items: PublicUpdateItem[] } — staff-only 제외.
 *
 * 모바일 앱은 인증 없이 동일 URL 호출. 스키마는 안정성 보증(필드 삭제/이름 변경 금지).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(50, Math.floor(limitParam))
    : 20;
  const since = url.searchParams.get("since");

  let items = (await loadUpdates()).filter((e) => !e.staffOnly);
  if (since) items = items.filter((e) => e.date >= since);
  const out = items.slice(0, limit).map(toPublic);

  return NextResponse.json(
    { items: out },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
