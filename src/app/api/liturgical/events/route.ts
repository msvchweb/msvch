import { NextResponse } from "next/server";
import { getLiturgicalEventsInRange } from "@/lib/liturgical/calendar";

export const revalidate = 3600;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/liturgical/events?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * 지정 범위의 큰 절기(부활/성탄/대림 등) 가상 이벤트.
 * 응답 아이템은 `CalendarEvent` 스키마와 동일하므로 모바일 캘린더가
 * 일반 이벤트와 똑같이 렌더 가능. `liturgical` 필드는 옵션.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  if (!YMD_RE.test(start) || !YMD_RE.test(end) || start > end) {
    return NextResponse.json(
      { error: "start/end 는 YYYY-MM-DD 형식이며 start <= end 여야 합니다." },
      { status: 400 },
    );
  }
  const items = getLiturgicalEventsInRange(start, end);
  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
