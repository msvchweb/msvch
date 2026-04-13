import type { CalendarEvent } from "@/types/calendar";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "";
const API_KEY = process.env.GOOGLE_CALENDAR_API_KEY ?? "";

/** Google Calendar API 원본 이벤트 (내부용) */
interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink: string;
}

interface GCalResponse {
  items?: GCalEvent[];
}

function toCalendarEvent(e: GCalEvent): CalendarEvent {
  const isAllDay = !e.start.dateTime;
  return {
    id: e.id,
    title: e.summary,
    description: e.description ?? null,
    location: e.location ?? null,
    start: e.start.dateTime ?? e.start.date ?? "",
    end: e.end.dateTime ?? e.end.date ?? "",
    isAllDay,
    htmlLink: e.htmlLink,
  };
}

/**
 * 다가오는 이벤트를 가져온다.
 * @param maxResults 최대 결과 수 (기본 20)
 * @param daysAhead 오늘부터 며칠 후까지 (기본 60)
 */
export async function getUpcomingEvents(
  maxResults = 20,
  daysAhead = 60,
): Promise<CalendarEvent[]> {
  if (!CALENDAR_ID || !API_KEY) {
    console.error(
      "GOOGLE_CALENDAR_ID or GOOGLE_CALENDAR_API_KEY is not set",
    );
    return [];
  }

  const now = new Date();
  const future = new Date(
    now.getTime() + daysAhead * 24 * 60 * 60 * 1000,
  );

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
  );
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("timeMin", now.toISOString());
  url.searchParams.set("timeMax", future.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("timeZone", "Asia/Seoul");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      console.error("Google Calendar API error:", res.status);
      return [];
    }
    const data: GCalResponse = await res.json();
    return (data.items ?? []).map(toCalendarEvent);
  } catch (err) {
    console.error("Google Calendar fetch failed:", err);
    return [];
  }
}
