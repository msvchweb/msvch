# Google Calendar 연동 구현 계획

> 기반: research.md Google Calendar 연동 분석 보고서 (2026-04-13)
> 원칙: 모바일 앱 백엔드 재사용 가능하도록 범용 설계
> 추가 의존성: 없음 (raw fetch)
> 변경 파일: 6개 수정 + 4개 신규
> **상태: ✅ 구현 완료 (2026-04-13)**

---

## 사전 준비 (수동, 완료됨)

- [x] Google Cloud Console — Calendar API 활성화 + API 키 생성
- [x] 교회 Google 캘린더 공개 설정
- [x] .env.local에 `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY` 추가

---

## Step 1. 타입 정의 ✅

**신규 파일**: `src/types/calendar.ts`

```typescript
// src/types/calendar.ts

/** Google Calendar 이벤트를 앱 내부 타입으로 변환한 결과 */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string; // ISO 8601 또는 YYYY-MM-DD (종일)
  end: string;
  isAllDay: boolean;
  htmlLink: string;
}
```

---

## Step 2. API 래퍼 ✅

**신규 파일**: `src/lib/google-calendar.ts`

youtube.ts와 동일한 패턴: 환경변수 → 빈 값 방어 → fetch + ISR → 타입 변환 → 에러 시 빈 배열.

```typescript
// src/lib/google-calendar.ts
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
    console.error("GOOGLE_CALENDAR_ID or GOOGLE_CALENDAR_API_KEY is not set");
    return [];
  }

  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

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
```

---

## Step 3. API 엔드포인트 (모바일 앱 호환) ✅

**신규 파일**: `src/app/api/calendar/route.ts`

모바일 앱에서 동일 데이터를 사용할 수 있도록 API 라우트 제공.
sermons/route.ts와 동일한 패턴.

```typescript
// src/app/api/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/google-calendar";
import { parseLimit } from "@/lib/validation";

export const revalidate = 600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = parseLimit(searchParams.get("limit"), 20);
  const rawDays = parseInt(searchParams.get("days") ?? "60", 10);
  const daysAhead = Math.min(
    isNaN(rawDays) || rawDays < 1 ? 60 : rawDays,
    365,
  );

  const events = await getUpcomingEvents(limit, daysAhead);
  return NextResponse.json(events);
}
```

**사용 예시**:
```
GET /api/calendar                   → 향후 60일, 최대 20개
GET /api/calendar?limit=5&days=7    → 이번 주, 최대 5개
GET /api/calendar?days=30           → 이번 달
```

---

## Step 4. 캘린더 페이지 ✅

**신규 파일**: `src/app/(public)/calendar/page.tsx`

서버 컴포넌트로 `getUpcomingEvents()`를 직접 호출하여 렌더링.
디자인: 기존 notice/[slug]/page.tsx, worship/page.tsx 스타일과 통일.

```typescript
// src/app/(public)/calendar/page.tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUpcomingEvents } from "@/lib/google-calendar";
import { Calendar, Clock, MapPin, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import type { CalendarEvent } from "@/types/calendar";

export const metadata: Metadata = { title: "교회 일정" };
export const revalidate = 600;

function formatEventDate(start: string, isAllDay: boolean): string {
  if (isAllDay) {
    const [, m, d] = start.split("-").map(Number);
    return `${m}월 ${d}일`;
  }
  const dt = new Date(start);
  return dt.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
}

function formatEventTime(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Seoul",
    });
  return `${fmt(s)} ~ ${fmt(e)}`;
}

/** 이벤트를 날짜별로 그룹핑 */
function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.isAllDay
      ? event.start
      : event.start.split("T")[0];
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  return groups;
}

function DateHeader({ dateStr }: { dateStr: string }) {
  const [, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(dateStr + "T00:00:00+09:00");
  const weekday = dt.toLocaleDateString("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-sm font-bold text-primary-700">
        {d}
      </div>
      <span className="text-sm font-medium text-gray-500">
        {m}월 {d}일 ({weekday})
      </span>
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-gradient-to-b from-church-gold to-amber-600" />
      <div className="pl-3">
        <h3 className="font-bold text-gray-900">{event.title}</h3>

        <div className="mt-2 space-y-1 text-sm">
          {!event.isAllDay && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={14} className="shrink-0 text-primary-500" />
              <span>{formatEventTime(event.start, event.end)}</span>
            </div>
          )}
          {event.isAllDay && (
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={14} className="shrink-0 text-primary-500" />
              <span>종일</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={14} className="shrink-0 text-primary-500" />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="mt-3 whitespace-pre-line text-sm text-gray-500 line-clamp-3">
            {event.description}
          </p>
        )}

        <a
          href={event.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
        >
          Google Calendar에서 보기
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

export default async function CalendarPage() {
  const events = await getUpcomingEvents(30, 90);
  const grouped = groupByDate(events);

  return (
    <>
      <PageHeader
        title="교회 일정"
        description="명성비전교회 주요 일정을 확인하세요"
      />
      <Container>
        <div className="mx-auto max-w-3xl">
          {grouped.size > 0 ? (
            Array.from(grouped.entries()).map(([dateStr, dayEvents]) => (
              <div key={dateStr} className="mb-8">
                <DateHeader dateStr={dateStr} />
                <div className="space-y-3">
                  {dayEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center">
              <Calendar
                size={48}
                className="mx-auto text-gray-300"
              />
              <p className="mt-4 text-gray-400">
                예정된 일정이 없습니다
              </p>
            </div>
          )}
        </div>
      </Container>
    </>
  );
}
```

---

## Step 5. 홈페이지에 다가오는 일정 위젯 추가 ✅

**수정 파일**: `src/app/page.tsx`

WorshipTimeCard 아래에 다가오는 일정 섹션 추가. 이벤트가 있을 때만 표시.

현재 코드 (line 1-26):
```typescript
import { HeroSection } from "@/components/home/HeroSection";
import { QuickLinks } from "@/components/home/QuickLinks";
import { WorshipTimeCard } from "@/components/home/WorshipTimeCard";
import { RecentNotice } from "@/components/home/RecentNotice";
import { LatestSermon } from "@/components/home/LatestSermon";
import { getNotices } from "@/lib/notices";
import { getLatestSermon } from "@/lib/youtube";

export const revalidate = 3600;

export default async function HomePage() {
  const [notices, sermon] = await Promise.all([
    getNotices().then((list) => list.slice(0, 5)),
    getLatestSermon(),
  ]);

  return (
    <>
      <HeroSection />
      <QuickLinks />
      <WorshipTimeCard />
      <RecentNotice notices={notices} />
      <LatestSermon sermon={sermon} />
    </>
  );
}
```

수정 후:
```typescript
import { HeroSection } from "@/components/home/HeroSection";
import { QuickLinks } from "@/components/home/QuickLinks";
import { WorshipTimeCard } from "@/components/home/WorshipTimeCard";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { RecentNotice } from "@/components/home/RecentNotice";
import { LatestSermon } from "@/components/home/LatestSermon";
import { getNotices } from "@/lib/notices";
import { getLatestSermon } from "@/lib/youtube";
import { getUpcomingEvents } from "@/lib/google-calendar";

export const revalidate = 3600;

export default async function HomePage() {
  const [notices, sermon, events] = await Promise.all([
    getNotices().then((list) => list.slice(0, 5)),
    getLatestSermon(),
    getUpcomingEvents(5, 30),
  ]);

  return (
    <>
      <HeroSection />
      <QuickLinks />
      <WorshipTimeCard />
      {events.length > 0 && <UpcomingEvents events={events} />}
      <RecentNotice notices={notices} />
      <LatestSermon sermon={sermon} />
    </>
  );
}
```

**신규 파일**: `src/components/home/UpcomingEvents.tsx`

RecentNotice.tsx와 동일한 스타일 패턴 (타이틀 + 리스트 + "전체보기" 링크).

```typescript
// src/components/home/UpcomingEvents.tsx
import Link from "next/link";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import type { CalendarEvent } from "@/types/calendar";

function formatShortDate(start: string, isAllDay: boolean): string {
  if (isAllDay) {
    const [, m, d] = start.split("-").map(Number);
    return `${m}/${d}`;
  }
  const dt = new Date(start);
  const m = dt.toLocaleDateString("ko-KR", { month: "numeric", timeZone: "Asia/Seoul" });
  const d = dt.toLocaleDateString("ko-KR", { day: "numeric", timeZone: "Asia/Seoul" });
  const time = dt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  return `${m} ${d} ${time}`;
}

export function UpcomingEvents({ events }: { events: CalendarEvent[] }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              다가오는 일정
            </h2>
            <p className="mt-1 text-gray-500">교회 주요 행사를 확인하세요</p>
          </div>
          <Link
            href="/calendar"
            className="group flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            전체보기
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {events.map((event, idx) => (
            <a
              key={event.id}
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between px-6 py-4.5 transition-colors hover:bg-gray-50 ${
                idx !== events.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  <Calendar size={10} />
                  일정
                </span>
                <span className="font-medium text-gray-800">
                  {event.title}
                </span>
                {event.location && (
                  <span className="hidden items-center gap-1 text-xs text-gray-400 sm:flex">
                    <MapPin size={10} />
                    {event.location}
                  </span>
                )}
              </div>
              <time className="shrink-0 text-sm tabular-nums text-gray-400">
                {formatShortDate(event.start, event.isAllDay)}
              </time>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Step 6. 네비게이션 메뉴 추가 ✅

### nav-config.ts

"교회소개" 하위 children에 "교회일정" 추가 (line 18, "예배안내" 다음):

현재 (line 16-22):
```typescript
children: [
  { label: "인사말", href: "/greetings" },
  { label: "공지사항", href: "/notice", badgeKey: "notices" },
  { label: "예배안내", href: "/worship" },
  { label: "섬기는 이들", href: "/staff" },
  { label: "찾아오시는 길", href: "/map" },
  { label: "주보", href: "/weekly", badgeKey: "weeklies" },
],
```

수정 후:
```typescript
children: [
  { label: "인사말", href: "/greetings" },
  { label: "공지사항", href: "/notice", badgeKey: "notices" },
  { label: "예배안내", href: "/worship" },
  { label: "교회일정", href: "/calendar" },
  { label: "섬기는 이들", href: "/staff" },
  { label: "찾아오시는 길", href: "/map" },
  { label: "주보", href: "/weekly", badgeKey: "weeklies" },
],
```

### MenuContent.tsx (더보기 메뉴)

"소식" 섹션에 "교회일정" 추가 (line 47-51):

현재:
```typescript
{
  title: "소식",
  items: [
    { label: "갤러리", href: "/gallery", icon: ImageIcon, description: "사진 모음", badgeKey: "gallery" },
  ],
},
```

수정 후:
```typescript
{
  title: "소식",
  items: [
    { label: "갤러리", href: "/gallery", icon: ImageIcon, description: "사진 모음", badgeKey: "gallery" },
    { label: "교회일정", href: "/calendar", icon: Calendar, description: "다가오는 행사" },
  ],
},
```

`Calendar` 아이콘 import 추가:
```typescript
import {
  BookOpen,
  Calendar,           // ← 추가
  Church,
  MapPin,
  // ...
} from "lucide-react";
```

---

## Step 7. sitemap 추가 ✅

**수정 파일**: `src/app/sitemap.ts`

staticPages 배열에 `/calendar` 추가 (line 16 근처, `/worship` 뒤):

```typescript
"/worship",
"/calendar",     // ← 추가
"/weekly",
```

---

## 변경 파일 요약

| # | 파일 | 작업 | 유형 |
|---|------|------|------|
| 1 | `src/types/calendar.ts` | **신규** — CalendarEvent 타입 | 신규 |
| 2 | `src/lib/google-calendar.ts` | **신규** — Google Calendar API 래퍼 | 신규 |
| 3 | `src/app/api/calendar/route.ts` | **신규** — API 엔드포인트 (모바일 호환) | 신규 |
| 4 | `src/app/(public)/calendar/page.tsx` | **신규** — 캘린더 페이지 | 신규 |
| 5 | `src/components/home/UpcomingEvents.tsx` | **신규** — 홈 위젯 | 신규 |
| 6 | `src/app/page.tsx` | 수정 — UpcomingEvents 추가 | 수정 |
| 7 | `src/components/layout/nav-config.ts` | 수정 — "교회일정" 메뉴 항목 | 수정 |
| 8 | `src/app/(public)/menu/MenuContent.tsx` | 수정 — "교회일정" 더보기 항목 | 수정 |
| 9 | `src/app/sitemap.ts` | 수정 — /calendar 추가 | 수정 |

---

## 환경변수

```env
# .env.local (+ Vercel 환경변수)
GOOGLE_CALENDAR_ID=교회계정@gmail.com
GOOGLE_CALENDAR_API_KEY=AIzaSy...
```

---

## 모바일 호환성

- `GET /api/calendar?limit=5&days=7` — 모바일 앱에서 이번 주 일정 조회
- `CalendarEvent` 타입은 웹/모바일 공용
- API 래퍼(`getUpcomingEvents`)는 서버 전용이지만, API 라우트를 통해 모바일에 동일 데이터 제공
- `parseLimit()` 재사용으로 쿼리 파라미터 검증 통일
