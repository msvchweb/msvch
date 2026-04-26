# 자체 캘린더 (Google Calendar 대체) 구현 계획

## 진행 상태

- [x] PLAN 작성 (v2 — 별도 구독 테이블 + RRULE v2 보류 확정)
- [x] Step 1: 마이그레이션 022 (events 테이블 + `notify` 컬럼 + RLS + 작성자 트리거 확장)
- [x] Step 2: 마이그레이션 023 (alimtalk_sent + event_subscribers)
- [x] Step 3: 타입 + DTO 정의 (`src/types/calendar.ts` 갱신, `src/types/subscribers.ts` 신규)
- [x] Step 4: 데이터 lib (`src/lib/events.ts` 신규)
- [x] Step 5: Validation (`CalendarEventSchema` 갱신 + `EventSubscriberSchema` 신규)
- [x] Step 6: API 라우트 갱신 (GET/POST/PATCH/DELETE `/api/calendar*`)
- [x] Step 7: 입력 폼 단순화 + 수정 기능 (admin)
- [x] Step 8: 공개 캘린더 hover popover (클라이언트 컴포넌트 분리)
- [x] Step 9: 홈 `UpcomingEvents` 정리 (htmlLink → 내부 링크)
- [x] Step 10: 알림톡 골격 (`src/lib/alimtalk.ts`)
- [x] Step 11: 알림톡 cron 엔드포인트 (`/api/admin/cron/alimtalk-events`)
- [x] Step 12: 구독자 관리 API (`/api/admin/event-subscribers`)
- [x] Step 13: 구독자 관리 admin 페이지 (`/admin/event-subscribers`)
- [x] Step 14: `vercel.json` cron 설정
- [x] Step 15: Google Calendar 데이터 1회 import 스크립트
- [x] Step 16: `src/lib/google-calendar.ts` 삭제 + 환경변수 정리 가이드
- [x] 최종 typecheck + lint
- [x] 문서 갱신 (API_SPEC.md / ARCHIT.md / DB_SCHEMA.md)
- [x] 커밋 + 푸시

---

## 목표

1. **종료시간 생략 가능** — 보통 시작시간만 정함 (`end_time NULL` = 미정/오픈엔드)
2. **공개 캘린더 hover** — 점이 있는 날짜 위에 마우스 올리면 그 날의 일정 팝오버
3. **알림톡 준비** — 카카오 비즈 승인 시 즉시 동작 가능한 cron 골격
4. **Google Calendar 의존 제거** — 자체 DB 단일 소스
5. **모바일 앱 호환** — `/api/calendar` 응답 DTO를 안정적으로 유지하여 추후 RN 앱이 백엔드 수정 없이 사용 가능

---

## 설계 원칙

1. **DTO 안정성** — `CalendarEvent` 의 외형(`id/title/start/end/isAllDay/location/description`)은 유지. `htmlLink` 만 제거(외부 링크 → 내부 상세 링크 또는 popover로 대체).
2. **단일 일정 우선** — v1 은 단일 날짜 일정만. 다일(`endDate`)/반복(`rrule`)은 컬럼만 미리 두고 v2 로 미룸. YAGNI.
3. **시간 모델**:
   - `date NOT NULL` — 날짜 (필수)
   - `start_time` nullable — null 이면 종일
   - `end_time` nullable — null 이면 미정/오픈엔드
4. **권한 모델은 020/021 패턴 재사용** — `record_content_author('event')` 트리거 + `is_admin_or_master() OR is_content_author('event', id)` DELETE
5. **알림톡은 단방향 추상화** — `sendAlimtalk(template, to, vars)` 인터페이스만. 미설정 환경변수 시 noop. 카카오 비즈 승인 후 환경변수만 채우면 동작.
6. **타입 엄격** — `any/unknown` 금지. Zod 로 런타임 검증.
7. **외부 라이브러리 회피** — 캘린더 그리드/팝오버/RRULE 모두 내부 구현 (메모리 선호도).
8. **시키지 않은 것은 손대지 않음** — 반복 일정 UI, 다일 일정 UI, 알림톡 실 발송은 v1 범위 밖.

---

## 현재 코드베이스 분석

### Google Calendar 의존 매트릭스

| 파일 | 용도 | v1 처리 |
|------|------|---------|
| `src/lib/google-calendar.ts` | API 호출 + JWT (267줄) | **deprecated** — `events.ts` 가 대체. 마이그레이션 1회용 import 후 삭제. |
| `src/types/calendar.ts` | `CalendarEvent`, `CalendarEventInput` | **갱신** — `htmlLink` 제거, `end: string \| null` 허용 |
| `src/app/api/calendar/route.ts` | GET 목록 / POST 생성 | **갱신** — `events.ts` 호출 |
| `src/app/api/calendar/[id]/route.ts` | DELETE | **갱신** — `events.ts` 호출. **PATCH 신규** 추가 |
| `src/app/(public)/calendar/page.tsx` | 공개 페이지 (월 그리드 + 카드 목록) | **갱신** — htmlLink 의존 제거, 호버 popover 추가 (클라이언트 컴포넌트 분리) |
| `src/app/admin/calendar/page.tsx` | 관리자 입력/삭제 | **갱신** — endTime 옵셔널, endDate 제거, "종일" 토글 정리, 수정 기능 추가 |
| `src/components/home/UpcomingEvents.tsx` | 홈 위젯 | **갱신** — htmlLink → `/calendar` 또는 단건 페이지 |
| `src/app/page.tsx` | 홈에서 `getUpcomingEvents()` 호출 | 시그니처 동일 → 무수정 |
| 환경변수 `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` | | 데이터 마이그레이션 후 **제거 가능** |

### 기존 패턴 (재사용)

- 마이그레이션 020 의 `record_content_author()` SECURITY DEFINER 트리거 → `'event'` content_type 추가
- 마이그레이션 021 의 `is_admin_or_master() OR is_content_author(type, id)` DELETE 정책 패턴
- `src/lib/notices.ts`, `src/lib/gallery.ts` 의 server-side data fn 패턴 (`createClient` from `@/lib/supabase/server`)
- `src/app/admin/notices/page.tsx` 의 작성자 표시 (`fetchAuthorRecordMap`) + `canDelete` 가드
- Zod 스키마는 `src/lib/validation.ts` 한 파일에 집약

---

## 변경 파일 목록

| 파일 | 작업 | 비고 |
|------|------|------|
| `supabase/migrations/022_events.sql` | **신규** | events 테이블 + RLS + 작성자 트리거 확장 |
| `supabase/migrations/023_alimtalk_sent.sql` | **신규** | 알림톡 발송 추적 (카카오 비즈 준비) |
| `src/types/calendar.ts` | **갱신** | DTO 정리 (`end: string \| null`, `htmlLink` 제거, `recurrence` 추가) |
| `src/lib/events.ts` | **신규** | 자체 DB 기반 데이터 함수 (`getUpcomingEvents`, `getAllEvents`, `createEvent`, `updateEvent`, `deleteEvent`) |
| `src/lib/google-calendar.ts` | **삭제** | 마이그레이션 import 후 |
| `src/lib/alimtalk.ts` | **신규** | 알림톡 추상화 (noop 폴백) |
| `src/lib/validation.ts` | **갱신** | `CalendarEventSchema` 갱신 (endTime 옵셔널, endDate 제거) |
| `src/app/api/calendar/route.ts` | **갱신** | events.ts 호출, `requireStaff` 정합 |
| `src/app/api/calendar/[id]/route.ts` | **갱신** | DELETE + **PATCH 신규** |
| `src/app/api/admin/cron/alimtalk-events/route.ts` | **신규** | Vercel Cron 엔드포인트 (시크릿 헤더 인증) |
| `src/app/(public)/calendar/page.tsx` | **갱신 (서버 컴포넌트 슬림화)** | 데이터 로드만, UI 는 클라이언트 컴포넌트로 위임 |
| `src/app/(public)/calendar/CalendarView.tsx` | **신규** | 클라이언트 — 월 그리드 + 호버 popover |
| `src/app/admin/calendar/page.tsx` | **갱신** | 폼 단순화 + 수정 기능 + 작성자 가드 |
| `src/components/home/UpcomingEvents.tsx` | **갱신** | htmlLink 제거, 내부 `/calendar` 링크 |
| `scripts/migrate-google-calendar.ts` | **신규** | 1회용 — 기존 GCal → events 테이블 |
| `vercel.json` | **신규** | Vercel Cron 설정 |
| `API_SPEC.md` / `ARCHIT.md` / `DB_SCHEMA.md` | **갱신** | 자체 캘린더 + 알림톡 반영 |

총: 신규 9, 갱신 9, 삭제 1, 문서 3.

---

## Step 1: 마이그레이션 022 (`events`)

### `supabase/migrations/022_events.sql`

```sql
-- 022: 자체 캘린더 — Google Calendar 대체
--
-- 설계:
--   - 단일 날짜 일정 (v1). end_date / rrule 컬럼은 미리 두지만 사용은 v2.
--   - start_time / end_time 모두 nullable.
--     · start_time NULL = 종일 일정
--     · end_time NULL   = 종료시간 미정/오픈엔드 (가장 흔한 입력 패턴)
--   - 작성자 추적은 020 의 record_content_author() 트리거 재사용 ('event' 추가).
--   - 삭제 권한은 021 패턴 — 작성자 본인 OR admin OR master.

CREATE TABLE IF NOT EXISTS public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (length(description) <= 5000),
  location    text CHECK (length(location) <= 200),
  date        date NOT NULL,
  start_time  time,
  end_time    time,
  end_date    date,                   -- v2 다일 일정용 (v1 미사용, NULL)
  rrule       text,                   -- v2 반복 일정용 (v1 미사용, NULL)
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT events_end_date_after_start CHECK (
    end_date IS NULL OR end_date >= date
  ),
  CONSTRAINT events_end_time_after_start CHECK (
    end_time IS NULL OR start_time IS NULL OR end_time > start_time
  )
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (date);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- SELECT: 누구나 (캘린더는 공개)
CREATE POLICY "Anyone can read events" ON public.events
  FOR SELECT USING (true);

-- INSERT/UPDATE: staff
CREATE POLICY "Staff can insert events" ON public.events
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update events" ON public.events
  FOR UPDATE USING (public.is_staff());

-- DELETE: 작성자 OR admin/master (021 패턴)
CREATE POLICY "Author/admin/master can delete events" ON public.events
  FOR DELETE USING (
    public.is_admin_or_master()
    OR public.is_content_author('event', id)
  );

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.events_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_set_updated_at();

-- 작성자 추적 (020 재사용)
-- content_authors CHECK 제약에 'event' 가 누락되어 있으므로 확장
ALTER TABLE public.content_authors DROP CONSTRAINT IF EXISTS content_authors_content_type_check;
ALTER TABLE public.content_authors ADD CONSTRAINT content_authors_content_type_check
  CHECK (content_type IN ('notice', 'weekly', 'gallery_album', 'event'));

DROP TRIGGER IF EXISTS record_event_author ON public.events;
CREATE TRIGGER record_event_author
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.record_content_author('event');
```

---

## Step 2: 타입 + DTO 정리

### `src/types/calendar.ts`

```ts
/**
 * 캘린더 이벤트 — 플랫폼 공용 DTO.
 * 웹/모바일 동일 스펙. 이 형태가 안정이면 데이터 소스(자체 DB / 외부)와 무관하게 클라이언트 무수정.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  /** ISO 8601 datetime (시간 지정) 또는 YYYY-MM-DD (종일) */
  start: string;
  /**
   * ISO 8601 datetime 또는 YYYY-MM-DD 또는 null.
   * - null = 종료 시간 미정/오픈엔드 ("저녁 6시부터" 같은 케이스)
   * - 종일 + end null = 단일 종일 일정
   */
  end: string | null;
  isAllDay: boolean;
  /** RFC 5545 RRULE — v2 예정, v1 은 항상 null */
  recurrence: string | null;
}

/** 이벤트 생성/수정 요청 — 단일 날짜 v1 */
export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  /** YYYY-MM-DD (필수) */
  date: string;
  /** HH:mm — 미지정 = 종일 */
  startTime?: string;
  /** HH:mm — 미지정 = 미정/오픈엔드 */
  endTime?: string;
}
```

---

## Step 3: 데이터 lib

### `src/lib/events.ts` (신규)

```ts
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, CalendarEventInput } from "@/types/calendar";

/** DB row → 플랫폼 공용 DTO 변환 */
interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;             // YYYY-MM-DD
  start_time: string | null; // HH:mm:ss
  end_time: string | null;
  rrule: string | null;
}

function toCalendarEvent(row: EventRow): CalendarEvent {
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
    };
  }
  // ISO 8601 KST 변환 — DB는 time(HH:mm:ss), 클라이언트가 KST 기준 해석하도록
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
  };
}

/** KST 기준 오늘 (YYYY-MM-DD) */
function todayKST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  )
    .toISOString()
    .split("T")[0];
}

function addDaysKST(baseDate: string, days: number): string {
  const d = new Date(baseDate + "T00:00:00+09:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

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
    .select("id, title, description, location, date, start_time, end_time, rrule")
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
    .select("id, title, description, location, date, start_time, end_time, rrule")
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
    .select("id, title, description, location, date, start_time, end_time, rrule")
    .eq("id", id)
    .maybeSingle<EventRow>();
  return data ? toCalendarEvent(data) : null;
}
```

> 생성/수정/삭제는 API 라우트에서 직접 `supabase.from("events").insert/.update/.delete()` 호출. RLS 가 권한 가드.

---

## Step 4: API 라우트

### `src/app/api/calendar/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getUpcomingEvents } from "@/lib/events";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { parseLimit, CalendarEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic"; // 자체 DB → ISR 불필요

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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAdmin(request);
    const parsed = CalendarEventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        location: parsed.data.location ?? null,
        date: parsed.data.date,
        start_time: parsed.data.startTime ?? null,
        end_time: parsed.data.endTime ?? null,
        created_by: userId,
      })
      .select("id, title, description, location, date, start_time, end_time, rrule")
      .single();

    if (error || !data) {
      console.error("Event create error:", error);
      return NextResponse.json(
        { error: "일정 생성에 실패했습니다." },
        { status: 500 },
      );
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Event create error:", err);
    return NextResponse.json(
      { error: "일정 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}
```

### `src/app/api/calendar/[id]/route.ts` (PATCH 신규 + DELETE 갱신)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { CalendarEventSchema } from "@/lib/validation";

type Params = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    await requireAdmin(request);
    const parsed = CalendarEventSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const supabase = await createApiClient(request);
    const patch: Record<string, string | null> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description ?? null;
    if (parsed.data.location !== undefined) patch.location = parsed.data.location ?? null;
    if (parsed.data.date !== undefined) patch.date = parsed.data.date;
    if (parsed.data.startTime !== undefined) patch.start_time = parsed.data.startTime ?? null;
    if (parsed.data.endTime !== undefined) patch.end_time = parsed.data.endTime ?? null;

    const { error } = await supabase.from("events").update(patch).eq("id", id);
    if (error) {
      console.error("Event update error:", error);
      return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    await requireAdmin(request);

    const supabase = await createApiClient(request);
    // RLS 가 작성자/admin/master 만 통과시킴 — 비-작성자는 0 row 반환
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      console.error("Event delete error:", error);
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
```

### Zod 스키마 (`src/lib/validation.ts`)

```ts
export const CalendarEventSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  description: z.string().max(5000).optional(),
  location: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식: YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "시간 형식: HH:mm").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "시간 형식: HH:mm").optional(),
}).refine(
  (d) => !d.endTime || d.startTime, // endTime 만 있고 startTime 없으면 거부
  { message: "종료시간만 단독 입력은 불가합니다 (시작시간 필요).", path: ["endTime"] },
);
```

---

## Step 5: 입력 폼 단순화 (admin)

`src/app/admin/calendar/page.tsx` 폼 영역만 발췌 (전체 갱신):

```tsx
const [date, setDate] = useState("");
const [startTime, setStartTime] = useState("");
const [endTime, setEndTime] = useState("");
const [isAllDay, setIsAllDay] = useState<boolean>(false);
// ... 기존 title, description, location ...

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!title.trim() || !date) {
    alert("제목과 날짜는 필수입니다.");
    return;
  }
  if (!isAllDay && !startTime) {
    alert("시작 시간을 입력하거나 '종일'을 체크하세요.");
    return;
  }
  setSubmitting(true);
  const body = {
    title: title.trim(),
    description: description.trim() || undefined,
    location: location.trim() || undefined,
    date,
    startTime: isAllDay ? undefined : startTime,
    endTime: isAllDay || !endTime ? undefined : endTime,
  };
  const res = await fetch("/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // ...
}
```

폼 UI:

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <div className="sm:col-span-2">
    <label>제목 *</label>
    <input value={title} onChange={(e) => setTitle(e.target.value)} required />
  </div>

  <div>
    <label>날짜 *</label>
    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
  </div>

  <div className="flex items-end">
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
      종일
    </label>
  </div>

  {!isAllDay && (
    <>
      <div>
        <label>시작 시간 *</label>
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
      </div>
      <div>
        <label>종료 시간 (선택)</label>
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="미입력 가능" />
      </div>
    </>
  )}

  {/* location, description ... */}
</div>
```

추가: 행 클릭으로 수정 모드 진입 + `canDelete(me, authorMap[id]?.id)` 가드 + `fetchAuthorRecordMap('event', ids)` 작성자 표시.

---

## Step 6: 공개 캘린더 hover popover

### 분리 전략
- `src/app/(public)/calendar/page.tsx` (Server Component): events 로드만 → `<CalendarView events={...} />` 위임
- `src/app/(public)/calendar/CalendarView.tsx` (Client Component): 월 그리드 + 호버 popover + 카드 목록

### `CalendarView.tsx` 핵심 (호버 부분만 발췌)

```tsx
"use client";
import { useState } from "react";
import type { CalendarEvent } from "@/types/calendar";

function MonthGrid({
  year,
  month,
  eventsByDate,
}: {
  year: number;
  month: number;
  eventsByDate: Map<string, CalendarEvent[]>;
}) {
  const days = buildMonthGrid(year, month);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* ... 월 타이틀, 요일 헤더 ... */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDate.get(day.dateStr) ?? [];
          const hasEvents = dayEvents.length > 0;
          return (
            <div
              key={day.dateStr}
              className="relative flex h-12 items-center justify-center border-b border-r border-gray-50 sm:h-14"
              onMouseEnter={() => hasEvents && setHoveredDate(day.dateStr)}
              onMouseLeave={() => setHoveredDate(null)}
              onClick={() => hasEvents && setHoveredDate(d => d === day.dateStr ? null : day.dateStr)}
            >
              <span>{day.date}</span>
              {hasEvents && (
                <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-church-gold" />
              )}
              {hoveredDate === day.dateStr && hasEvents && (
                <DayPopover events={dayEvents} dateStr={day.dateStr} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayPopover({ events, dateStr }: { events: CalendarEvent[]; dateStr: string }) {
  return (
    <div
      role="tooltip"
      className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl"
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs font-semibold text-gray-500">{formatHeaderDate(dateStr)}</p>
      <ul className="space-y-1.5">
        {events.map((ev) => (
          <li key={ev.id} className="text-sm">
            <span className="font-medium text-gray-900">{ev.title}</span>
            {!ev.isAllDay && (
              <span className="ml-1.5 text-xs text-gray-400">
                {formatTime(ev.start)}{ev.end ? `~${formatTime(ev.end)}` : ""}
              </span>
            )}
            {ev.location && (
              <span className="ml-1.5 text-xs text-gray-400">· {ev.location}</span>
            )}
          </li>
        ))}
      </ul>
      <span
        className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white"
        aria-hidden="true"
      />
    </div>
  );
}
```

**모바일 처리**: `onMouseEnter` 는 모바일 미동작. `onClick` 토글로 같은 동작 제공. `pointer: coarse` 미디어 쿼리로 분기 가능하나 v1 은 클릭 토글만으로 충분.

---

## Step 7: `UpcomingEvents` 정리

```tsx
// htmlLink 제거 → 내부 /calendar 로 이동
<Link
  key={event.id}
  href="/calendar"
  className="..."
>
  ...
</Link>
```

(추후 단건 상세 페이지 `/calendar/[id]` 만들면 그쪽으로 변경)

---

## Step 8: Google Calendar 데이터 1회 import

### `scripts/migrate-google-calendar.ts`

```ts
/**
 * Google Calendar → Supabase events 테이블 1회 마이그레이션.
 * 실행: npx tsx scripts/migrate-google-calendar.ts
 *
 * 환경변수 필요: GOOGLE_CALENDAR_ID, GOOGLE_CALENDAR_API_KEY,
 *               NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { getAllEvents } from "../src/lib/google-calendar"; // 삭제 직전에 1회만 사용

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const events = await getAllEvents(500);
  console.log(`Fetched ${events.length} events from Google Calendar`);

  for (const ev of events) {
    const isAllDay = ev.isAllDay;
    const dateStr = isAllDay ? ev.start : ev.start.split("T")[0];
    const startTime = isAllDay ? null : ev.start.split("T")[1].slice(0, 5);
    const endTime = isAllDay || !ev.end ? null
      : ev.end.split("T")[1].slice(0, 5);

    const { error } = await supabase.from("events").insert({
      title: ev.title,
      description: ev.description,
      location: ev.location,
      date: dateStr,
      start_time: startTime,
      end_time: endTime,
    });
    if (error) console.error(`Failed: ${ev.title}`, error);
    else console.log(`Imported: ${ev.title} (${dateStr})`);
  }
}

main().catch(console.error);
```

실행 후 `src/lib/google-calendar.ts` 삭제 + 환경변수 정리.

---

## Step 9: 알림톡 골격 (카카오 비즈 준비)

### `supabase/migrations/023_alimtalk_sent.sql`

```sql
-- 알림톡 발송 추적 — 중복 발송 방지
CREATE TABLE IF NOT EXISTS public.alimtalk_sent (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template     text NOT NULL,        -- 카카오 템플릿 코드
  event_id     uuid REFERENCES public.events(id) ON DELETE CASCADE,
  recipient    text NOT NULL,        -- 전화번호 (E.164 또는 010-)
  sent_at      timestamptz DEFAULT now(),
  status       text NOT NULL,        -- 'sent' | 'failed'
  error        text,
  UNIQUE (template, event_id, recipient)
);

ALTER TABLE public.alimtalk_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view alimtalk log" ON public.alimtalk_sent
  FOR SELECT USING (public.is_staff());
-- INSERT/UPDATE 는 service_role 만 (cron 라우트가 서비스 키 사용)
```

### `src/lib/alimtalk.ts`

```ts
/**
 * 알림톡 추상화 — 카카오 비즈 승인 후 환경변수 채우면 동작.
 *
 * 미설정 환경에서는 noop (콘솔 경고만, 에러 throw 없음).
 * 모바일 앱은 이 모듈을 직접 호출하지 않음 — 서버 cron 만 사용.
 */
const ENABLED = !!(
  process.env.KAKAO_BIZ_API_KEY && process.env.KAKAO_BIZ_SENDER_KEY
);

export interface AlimtalkResult {
  ok: boolean;
  error?: string;
}

export async function sendAlimtalk(
  template: string,
  to: string,
  vars: Record<string, string>,
): Promise<AlimtalkResult> {
  if (!ENABLED) {
    console.warn(`[alimtalk] noop — env not set. would send template=${template} to=${to}`);
    return { ok: true };
  }
  // 카카오 비즈 승인 후 실제 호출 구현
  // 예: NHN Cloud / Aligo / Solapi 등 중계사 API 호출
  // const res = await fetch(VENDOR_URL, { ... });
  return { ok: false, error: "not implemented" };
}
```

### Vercel Cron 엔드포인트

`src/app/api/admin/cron/alimtalk-events/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlimtalk } from "@/lib/alimtalk";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 시크릿 검증 (Vercel Cron 헤더 또는 자체 시크릿)
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET ?? "";
  if (
    !secret ||
    !expected ||
    secret.length !== expected.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // D-1 (내일) 일정 조회
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];

  const { data: events } = await supabase
    .from("events")
    .select("id, title, date, start_time, location")
    .eq("date", dateStr);

  // TODO: 수신자 목록 조회 — 별도 'event_subscribers' 테이블 또는 staff role 일괄
  // v1 에서는 자리만 잡고 실제 발송 비활성

  return NextResponse.json({
    checked: events?.length ?? 0,
    note: "alimtalk send disabled until KAKAO_BIZ_* env set",
  });
}
```

### `vercel.json` 신규

```json
{
  "crons": [
    {
      "path": "/api/admin/cron/alimtalk-events",
      "schedule": "0 21 * * *"
    }
  ]
}
```

(매일 21시 UTC = KST 06시. 카카오 비즈 정책상 발송 가능 시간 내. 승인 전까지는 noop)

---

## Step 10: 환경변수 정리 가이드

마이그레이션 + import 완료 후 Vercel 에서 제거 가능:
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_CALENDAR_API_KEY`
- `GOOGLE_SA_CLIENT_EMAIL`
- `GOOGLE_SA_PRIVATE_KEY`

추후 추가:
- `CRON_SECRET` — Vercel Cron 헤더 인증
- `KAKAO_BIZ_API_KEY`, `KAKAO_BIZ_SENDER_KEY` — 카카오 비즈 승인 후

---

## 모바일 앱 호환성

| 엔드포인트 | 변경 | 모바일 영향 |
|-----------|------|------------|
| `GET /api/calendar` | DTO 에 `recurrence` 추가, `htmlLink` 제거, `end: string \| null` | **하위 호환 깨짐** — `htmlLink` 사용 시. 모바일 앱 출시 전이므로 OK |
| `POST /api/calendar` | `endDate` 제거, `endTime` 옵셔널 | 모바일 앱 미출시 — OK |
| `PATCH /api/calendar/[id]` | **신규** | 옵션 추가 |
| `DELETE /api/calendar/[id]` | 동일 | 무영향 |
| 인증 | `requireAdmin(request)` 동일 | 쿠키/Bearer 모두 동작 |

DTO 안정성: 자체 DB 로 옮긴 후에도 `CalendarEvent` 형태가 같으므로 추후 데이터 소스 변경(샤딩/캐시 추가 등)에도 클라이언트 무수정.

---

## 테스트 시나리오 (수동)

### 관리자 입력 폼
| # | 입력 | 기대 |
|---|------|------|
| 1 | 제목 + 날짜만 + 종일 체크 | 종일 일정 생성 |
| 2 | 제목 + 날짜 + 시작시간 (종료 비움) | DB 에 `start_time` 저장, `end_time NULL`, 카드에 "오후 2:00~" |
| 3 | 제목 + 날짜 + 시작 + 종료 | "오후 2:00 ~ 4:00" |
| 4 | 종료시간만 입력 (시작 비움) | Zod 거부 alert |

### 공개 캘린더
| # | 액션 | 기대 |
|---|------|------|
| 5 | 점이 있는 날짜에 마우스 hover | 팝오버에 그 날 일정 목록 표시 |
| 6 | 점 없는 날짜 hover | 팝오버 미노출 |
| 7 | 모바일 터치 (점 있는 날짜) | 팝오버 토글 (한 번 더 탭하면 닫힘) |
| 8 | 점 표시 | "일정이 있는 날" 범례 그대로 |

### 권한
| # | 역할 | 액션 | 기대 |
|---|------|------|------|
| 9 | staff (작성자) | 본인 일정 삭제 | 성공 |
| 10 | staff (비-작성자) | 다른 staff 의 일정 삭제 | UI 버튼 숨김 + RLS 차단 |
| 11 | admin / master | 임의 일정 삭제 | 성공 |

### 알림톡 (카카오 비즈 미설정)
| # | 액션 | 기대 |
|---|------|------|
| 12 | Vercel Cron 트리거 (시크릿 헤더 OK) | 200 + `{ checked, note: "...disabled..." }` |
| 13 | 잘못된 시크릿 | 401 |

### TypeScript / Lint
```bash
npx tsc --noEmit
npx eslint src/lib/events.ts src/lib/alimtalk.ts src/app/api/calendar src/app/\(public\)/calendar src/app/admin/calendar
```

---

## 롤아웃 순서

1. **마이그레이션 022 작성** → 사용자가 Supabase 에 수동 적용
2. **import 스크립트 실행** (`npx tsx scripts/migrate-google-calendar.ts`) — 기존 GCal 데이터 이전
3. **코드 PR** — 위 변경 일괄 커밋, Vercel 배포
4. **확인** — 실기기로 4가지 시나리오 검증
5. **GCal 환경변수 제거** (Vercel 대시보드)
6. **`src/lib/google-calendar.ts` 삭제** (별도 PR, history 보존)
7. **알림톡 단계** — 카카오 비즈 승인 후 환경변수만 채우면 cron 자동 동작

---

## 명시적으로 v1 범위 밖

- **반복 일정 (RRULE)** — `rrule` 컬럼만 두고 v2 별도 PR. 매주 주일예배 같은 패턴은 당분간 매주 수동 입력.
- **다일 일정 (`end_date`)** — 컬럼만 두고 v2.
- **단건 상세 페이지 `/calendar/[id]`** — 팝오버로 충분, 필요 시 후속.
- **알림톡 실 발송** — 카카오 비즈 승인 + 수신자 목록 설계 후.
- **iCal export 구독** — Google Calendar 구독 기능 대체. 수요 발생 시 `/api/calendar/feed.ics` 추가.
- **푸시 알림 / 캘린더 동기화** — 모바일 앱 단계.
