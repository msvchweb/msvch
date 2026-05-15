import { NextResponse } from "next/server";
import { getLiturgicalDay, toKstYmd, isOrdinary } from "@/lib/liturgical/season";
import { SEASON_TO_TOKENS, brandTokens } from "@/lib/liturgical/colors";

export const revalidate = 3600;

/**
 * GET /api/liturgical/today
 *
 * 오늘(KST)의 절기와 색상 토큰. 인증 불필요. 모바일 호환 안정 스키마.
 *
 * 응답 스키마는 안정성 보증 — 필드 삭제/이름·타입 변경 금지.
 */
export async function GET(): Promise<NextResponse> {
  const now = new Date();
  const day = getLiturgicalDay(now);
  const c = SEASON_TO_TOKENS[day.season];
  const b = brandTokens(day.season);

  return NextResponse.json(
    {
      date: toKstYmd(now),
      season: day.season,
      seasonKo: day.ko,
      week: day.week,
      isOrdinary: isOrdinary(day.season),
      color: { base: c.base, soft: c.soft, strong: c.strong, onBase: c.onBase },
      brand: { base: b.base, soft: b.soft, strong: b.strong },
      rangeStart: day.rangeStart,
      rangeEnd: day.rangeEnd,
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
