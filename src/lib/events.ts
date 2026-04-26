import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/types/calendar";

/**
 * 자체 캘린더 데이터 함수 (마이그레이션 022 이후).
 * Server Component / API 라우트에서 호출.
 *
 * 입력/수정/삭제는 API 라우트가 직접 supabase.from("events") CUD 호출 — RLS 가 권한 가드.
 */

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;              // YYYY-MM-DD
  start_time: string | null;  // HH:mm:ss
  end_time: string | null;
  rrule: string | null;
  notify: boolean;
}

/** DB row → 플랫폼 공용 DTO */
export function toCalendarEvent(row: EventRow): CalendarEvent {
  const isAllDay = row.start_time === null;
  if (isAllDay) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      start: row.date,
      end: null,
      isAllDay: true,
      recurrence: row.rrule,
      notify: row.notify,
    };
  }
  // KST 명시적 표기 — 클라이언트가 동일 시각으로 해석
  const startIso = `${row.date}T${row.start_time}+09:00`;
  const endIso = row.end_time
    ? `${row.date}T${row.end_time}+09:00`
    : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    start: startIso,
    end: endIso,
    isAllDay: false,
    recurrence: row.rrule,
    notify: row.notify,
  };
}

/** KST 기준 오늘 YYYY-MM-DD */
export function todayKST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  )
    .toISOString()
    .split("T")[0];
}

export function addDaysKST(baseDate: string, days: number): string {
  const d = new Date(baseDate + "T00:00:00+09:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const EVENT_COLUMNS =
  "id, title, description, location, date, start_time, end_time, rrule, notify";

/** 다가오는 이벤트 (오늘 ~ +daysAhead) */
export async function getUpcomingEvents(
  maxResults = 20,
  daysAhead = 60,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const today = todayKST();
  const end = addDaysKST(today, daysAhead);

  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("date", today)
    .lte("date", end)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(maxResults);

  return ((data ?? []) as EventRow[]).map(toCalendarEvent);
}

/** 관리자용 — 과거 30일 + 미래 90일 */
export async function getAllEvents(maxResults = 50): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const today = todayKST();
  const past = addDaysKST(today, -30);
  const future = addDaysKST(today, 90);

  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("date", past)
    .lte("date", future)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(maxResults);

  return ((data ?? []) as EventRow[]).map(toCalendarEvent);
}

/** 단건 조회 */
export async function getEventById(id: string): Promise<CalendarEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle<EventRow>();
  return data ? toCalendarEvent(data) : null;
}
