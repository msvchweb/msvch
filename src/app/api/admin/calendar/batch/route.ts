import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { createApiClient } from "@/lib/supabase/api";
import { EventBatchInsertSchema } from "@/lib/validation";
import { toCalendarEvent } from "@/lib/events";
import type {
  BatchInsertResult,
  BatchSkipped,
} from "@/types/event-extraction";
import type { CalendarEvent } from "@/types/calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

interface InsertedRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  rrule: string | null;
  notify: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAdmin(request);
    const parsed = EventBatchInsertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }

    const supabase = await createApiClient(request);
    const inserted: CalendarEvent[] = [];
    const skipped: BatchSkipped[] = [];

    // 한 번에 INSERT 하면 일부 RLS 거부 시 통째로 롤백됨 → 항목별 INSERT.
    // 보통 3~10건이라 N+1 비용 무시 가능.
    for (let i = 0; i < parsed.data.events.length; i++) {
      const ev = parsed.data.events[i];
      const { data, error } = await supabase
        .from("events")
        .insert({
          title: ev.title,
          description: ev.description ?? null,
          location: ev.location ?? null,
          date: ev.date,
          start_time: ev.startTime ?? null,
          end_time: ev.endTime ?? null,
          notify: ev.notify ?? false,
          created_by: userId,
          source_weekly_id: ev.sourceWeeklyId ?? null,
          source_news_index: ev.sourceNewsIndex ?? null,
          extracted_by_ai: true,
        })
        .select(
          "id, title, description, location, date, start_time, end_time, rrule, notify",
        )
        .single<InsertedRow>();

      if (error || !data) {
        console.error(`batch insert [${i}] error:`, error);
        skipped.push({
          index: i,
          reason: error?.message ?? "INSERT 실패",
        });
        continue;
      }
      inserted.push(toCalendarEvent(data));
    }

    const body: BatchInsertResult = { inserted, skipped };
    return NextResponse.json(body, {
      // 207 Multi-Status — 일부만 성공한 경우. 전부 성공이면 201, 전부 실패면 207.
      status: skipped.length === 0 ? 201 : 207,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("calendar/batch error:", err);
    return NextResponse.json(
      { error: "일정 등록 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
