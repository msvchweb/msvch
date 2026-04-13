import { createSign } from "crypto";
import type { CalendarEvent, CalendarEventInput } from "@/types/calendar";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "";
const API_KEY = process.env.GOOGLE_CALENDAR_API_KEY ?? "";

// Service Account 환경변수 (이벤트 생성/삭제용)
const SA_CLIENT_EMAIL =
  process.env.GOOGLE_SA_CLIENT_EMAIL ?? "";
const SA_PRIVATE_KEY_RAW = process.env.GOOGLE_SA_PRIVATE_KEY ?? "";
// .env.local: 리터럴 백슬래시+n (charCode 92,110)
// Vercel: 실제 줄바꿈 (charCode 10)이거나 동일한 리터럴일 수 있음
// 리터럴 \n(2문자)을 실제 줄바꿈(1문자)으로 치환
const LITERAL_BACKSLASH_N = String.fromCharCode(92, 110);
const SA_PRIVATE_KEY = SA_PRIVATE_KEY_RAW.includes(LITERAL_BACKSLASH_N)
  ? SA_PRIVATE_KEY_RAW.split(LITERAL_BACKSLASH_N).join("\n")
  : SA_PRIVATE_KEY_RAW;

// ──────────────────────────────────────────────
//  Google Calendar API 원본 타입 (내부용)
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
//  읽기 (공개 API 키)
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
//  Service Account JWT 인증
// ──────────────────────────────────────────────

function base64url(input: string | Buffer): string {
  const buf =
    typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getServiceAccountToken(): Promise<string> {
  // 캐싱: 만료 1분 전까지 재사용
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );
  const payload = base64url(
    JSON.stringify({
      iss: SA_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/calendar.events",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signInput);
  const signature = base64url(signer.sign(SA_PRIVATE_KEY));
  const jwt = `${signInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Service account token failed: ${res.status} ${text}`);
  }

  const data: { access_token: string; expires_in: number } =
    await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// ──────────────────────────────────────────────
//  쓰기 (Service Account)
// ──────────────────────────────────────────────

/** 이벤트 생성 */
export async function createCalendarEvent(
  input: CalendarEventInput,
): Promise<CalendarEvent> {
  const token = await getServiceAccountToken();

  const isAllDay = !input.startTime;
  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description || undefined,
    location: input.location || undefined,
  };

  if (isAllDay) {
    body.start = { date: input.startDate };
    body.end = { date: input.endDate };
  } else {
    body.start = {
      dateTime: `${input.startDate}T${input.startTime}:00+09:00`,
      timeZone: "Asia/Seoul",
    };
    body.end = {
      dateTime: `${input.endDate}T${input.endTime}:00+09:00`,
      timeZone: "Asia/Seoul",
    };
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Google Calendar create error:", text);
    throw new Error("일정 생성에 실패했습니다.");
  }

  const event: GCalEvent = await res.json();
  return toCalendarEvent(event);
}

/** 이벤트 삭제 */
export async function deleteCalendarEvent(
  eventId: string,
): Promise<void> {
  const token = await getServiceAccountToken();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    console.error("Google Calendar delete error:", text);
    throw new Error("일정 삭제에 실패했습니다.");
  }
}

/** 관리자용 — 과거 포함 모든 이벤트 조회 */
export async function getAllEvents(
  maxResults = 50,
): Promise<CalendarEvent[]> {
  if (!CALENDAR_ID || !API_KEY) return [];

  const now = new Date();
  // 과거 30일 + 미래 90일
  const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
  );
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("timeMin", past.toISOString());
  url.searchParams.set("timeMax", future.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("timeZone", "Asia/Seoul");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data: GCalResponse = await res.json();
    return (data.items ?? []).map(toCalendarEvent);
  } catch {
    return [];
  }
}
