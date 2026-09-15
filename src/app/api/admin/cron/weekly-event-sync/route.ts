/**
 * POST /api/admin/cron/weekly-event-sync
 *
 * 주보 사진 → 캘린더 주간 자동 등록. GitHub Actions(.github/workflows/weekly-event-sync.yml)가
 * 3시간마다 호출한다. 토요일 22:00 KST 이후 첫 호출이 그 주 작업을 만들고,
 * 매 호출마다 처리할 작업을 최대 3건 처리한다 (일시적 실패는 3시간 뒤 재시도).
 *
 * 인증: `Authorization: Bearer <CRON_SECRET>` 또는 `x-cron-secret` 헤더. 불일치 시 401.
 * 쿠키를 쓰지 않는 시스템 전용 엔드포인트.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/api";
import {
  createSupabaseWeeklyEventSyncStore,
  runWeeklyEventSyncTick,
  sanitizeErrorMessage,
} from "@/lib/weekly-event-sync";
import { extractEventsFromWeeklyPhotos } from "@/lib/weekly-photo-event-extractor";
import type { WeeklyEventSyncTickResult } from "@/types/weekly-event-sync";

export const dynamic = "force-dynamic";
// 작업 1건 최악 약 130초(사진 30초 + Gemini 90초 + DB). 3건이면 이 제한을 넘으므로
// runWeeklyEventSyncTick 이 남은 시간(remainingMs)을 보고 끝낼 수 없는 작업은 시작하지 않는다.
export const maxDuration = 300;
/** maxDuration 에서 응답·로그 여유 15초를 뺀 처리 예산 */
const TICK_TIME_BUDGET_MS = (maxDuration - 15) * 1000;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<WeeklyEventSyncTickResult | { error: string }>> {
  const startedAtMs = Date.now();

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected || !constantTimeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "supabase env missing" },
      { status: 500 },
    );
  }

  try {
    const result = await runWeeklyEventSyncTick({
      store: createSupabaseWeeklyEventSyncStore(supabase),
      extract: extractEventsFromWeeklyPhotos,
      now: new Date(startedAtMs),
      remainingMs: () => TICK_TIME_BUDGET_MS - (Date.now() - startedAtMs),
    });
    return NextResponse.json<WeeklyEventSyncTickResult>(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[cron/weekly-event-sync] tick failed:",
      sanitizeErrorMessage(message),
    );
    return NextResponse.json(
      { error: "weekly event sync failed" },
      { status: 500 },
    );
  }
}
