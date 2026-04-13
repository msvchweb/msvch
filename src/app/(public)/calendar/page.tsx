import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUpcomingEvents } from "@/lib/google-calendar";
import { Clock, MapPin, ExternalLink, Calendar } from "lucide-react";
import type { Metadata } from "next";
import type { CalendarEvent } from "@/types/calendar";

export const metadata: Metadata = { title: "교회 일정" };
export const revalidate = 600;

// ──────────────────────────────────────────────
//  날짜 유틸
// ──────────────────────────────────────────────

/** KST 기준 오늘 YYYY-MM-DD */
function todayKST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  )
    .toISOString()
    .split("T")[0];
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

/** 이벤트의 날짜 키 (YYYY-MM-DD) 추출 */
function eventDateKey(event: CalendarEvent): string {
  return event.isAllDay ? event.start : event.start.split("T")[0];
}

// ──────────────────────────────────────────────
//  월간 달력 그리드
// ──────────────────────────────────────────────

interface CalendarDay {
  date: number;
  dateStr: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEvents: boolean;
}

function buildMonthGrid(year: number, month: number, eventDates: Set<string>): CalendarDay[] {
  const today = todayKST();
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: CalendarDay[] = [];

  // 이전 달 채우기
  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const dateStr = `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === today, hasEvents: eventDates.has(dateStr) });
  }

  // 이번 달
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: d, dateStr, isCurrentMonth: true, isToday: dateStr === today, hasEvents: eventDates.has(dateStr) });
  }

  // 다음 달 채우기 (6줄 = 42칸)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    const dateStr = `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === today, hasEvents: eventDates.has(dateStr) });
  }

  return days;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function MonthGrid({
  year,
  month,
  eventDates,
}: {
  year: number;
  month: number;
  eventDates: Set<string>;
}) {
  const days = buildMonthGrid(year, month, eventDates);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* 월 타이틀 */}
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900">
          {year}년 {month + 1}월
        </h2>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`py-2.5 text-center text-xs font-semibold ${
              i === 0
                ? "text-red-400"
                : i === 6
                  ? "text-blue-400"
                  : "text-gray-400"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dow = idx % 7;
          return (
            <div
              key={day.dateStr}
              className={`relative flex h-12 items-center justify-center border-b border-r border-gray-50 text-sm transition-colors sm:h-14 ${
                !day.isCurrentMonth ? "text-gray-300" : "text-gray-700"
              } ${day.isToday ? "font-bold" : ""} ${
                dow === 0 && day.isCurrentMonth ? "text-red-500" : ""
              } ${dow === 6 && day.isCurrentMonth ? "text-blue-500" : ""}`}
            >
              {day.isToday ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white">
                  {day.date}
                </span>
              ) : (
                day.date
              )}
              {day.hasEvents && (
                <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-church-gold" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
//  이벤트 카드
// ──────────────────────────────────────────────

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
          <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-gray-500">
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

// ──────────────────────────────────────────────
//  페이지
// ──────────────────────────────────────────────

export default async function CalendarPage() {
  const events = await getUpcomingEvents(30, 90);

  // KST 기준 현재 연/월
  const nowKST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const currentYear = nowKST.getFullYear();
  const currentMonth = nowKST.getMonth();

  // 이번 달 + 다음 달
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  // 이벤트가 있는 날짜 Set
  const eventDates = new Set(events.map(eventDateKey));

  // 이벤트 날짜별 그룹핑
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }

  return (
    <>
      <PageHeader
        title="교회 일정"
        description="명성비전교회 주요 일정을 확인하세요"
      />
      <Container>
        <div className="mx-auto max-w-3xl">
          {/* 월간 달력 */}
          <div className="mb-10 grid gap-6 lg:grid-cols-2">
            <MonthGrid
              year={currentYear}
              month={currentMonth}
              eventDates={eventDates}
            />
            <MonthGrid
              year={nextYear}
              month={nextMonth}
              eventDates={eventDates}
            />
          </div>

          {/* 이벤트가 있는 날에 금색 점 표시 */}
          {eventDates.size > 0 && (
            <p className="mb-8 flex items-center gap-2 text-sm text-gray-400">
              <span className="inline-block h-2 w-2 rounded-full bg-church-gold" />
              일정이 있는 날
            </p>
          )}

          {/* 다가오는 일정 목록 */}
          <h2 className="mb-6 text-xl font-bold text-gray-900">
            다가오는 일정
          </h2>

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
            <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
              <Calendar size={40} className="mx-auto text-gray-300" />
              <p className="mt-3 text-gray-400">
                예정된 일정이 없습니다
              </p>
            </div>
          )}
        </div>
      </Container>
    </>
  );
}
