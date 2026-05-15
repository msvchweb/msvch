"use client";

import { useState, useMemo } from "react";
import { Clock, MapPin, Calendar } from "lucide-react";
import type { CalendarEvent } from "@/types/calendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ──────────────────────────────────────────────
//  유틸
// ──────────────────────────────────────────────

function todayKST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  )
    .toISOString()
    .split("T")[0];
}

function eventDateKey(event: CalendarEvent): string {
  return event.isAllDay ? event.start : event.start.split("T")[0];
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

function formatEventTimeRange(event: CalendarEvent): string {
  if (event.isAllDay) return "종일";
  const start = formatTimeShort(event.start);
  if (!event.end) return `${start} ~`;
  return `${start} ~ ${formatTimeShort(event.end)}`;
}

function formatDateHeader(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(dateStr + "T00:00:00+09:00");
  const weekday = dt.toLocaleDateString("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  return `${m}월 ${d}일 (${weekday})`;
}

// ──────────────────────────────────────────────
//  월 그리드
// ──────────────────────────────────────────────

interface CalendarDay {
  date: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const today = todayKST();
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const days: CalendarDay[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const dateStr = `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === today });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: d, dateStr, isCurrentMonth: true, isToday: dateStr === today });
  }

  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    const dateStr = `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: d, dateStr, isCurrentMonth: false, isToday: dateStr === today });
  }

  return days;
}

// ──────────────────────────────────────────────
//  팝오버
// ──────────────────────────────────────────────

interface DayPopoverProps {
  events: CalendarEvent[];
  dateStr: string;
  /** 그리드 우측 절반에 위치한 셀이면 popover 를 왼쪽으로 정렬 */
  alignRight: boolean;
}

function DayPopover({ events, dateStr, alignRight }: DayPopoverProps) {
  const positionCls = alignRight
    ? "right-0 sm:right-1/2 sm:translate-x-1/2"
    : "left-1/2 -translate-x-1/2";
  return (
    <div
      role="tooltip"
      className={`pointer-events-auto absolute bottom-full z-30 mb-2 w-64 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl ${positionCls}`}
    >
      <p className="mb-2 text-xs font-semibold text-gray-500">
        {formatDateHeader(dateStr)}
      </p>
      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev.id} className="text-sm leading-tight">
            {ev.liturgical ? (
              <p
                className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold"
                style={{
                  background: ev.liturgical.colorSoft,
                  color: ev.liturgical.colorStrong,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: ev.liturgical.colorStrong }}
                  aria-hidden
                />
                {ev.title}
              </p>
            ) : (
              <p className="font-medium text-gray-900">{ev.title}</p>
            )}
            {!ev.liturgical && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  {ev.isAllDay ? <Calendar size={11} /> : <Clock size={11} />}
                  {formatEventTimeRange(ev)}
                </span>
                {ev.location && (
                  <span className="flex items-center gap-1 text-gray-400">
                    <MapPin size={11} />
                    {ev.location}
                  </span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────
//  MonthGrid (호버/탭으로 popover)
// ──────────────────────────────────────────────

interface MonthGridProps {
  year: number;
  month: number;
  eventsByDate: Map<string, CalendarEvent[]>;
}

function MonthGrid({ year, month, eventsByDate }: MonthGridProps) {
  const days = buildMonthGrid(year, month);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  return (
    <div className="overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900">
          {year}년 {month + 1}월
        </h2>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`py-2.5 text-center text-xs font-semibold ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dow = idx % 7;
          const dayEvents = eventsByDate.get(day.dateStr) ?? [];
          const hasEvents = dayEvents.length > 0;
          const isActive = activeDate === day.dateStr;
          const alignRight = dow >= 4; // 우측 4~6열은 popover 를 왼쪽 정렬

          return (
            <div
              key={day.dateStr + "-" + idx}
              className={`relative flex h-12 items-center justify-center border-b border-r border-gray-50 text-sm transition-colors sm:h-14 ${
                !day.isCurrentMonth ? "text-gray-300" : "text-gray-700"
              } ${day.isToday ? "font-bold" : ""} ${
                dow === 0 && day.isCurrentMonth ? "text-red-500" : ""
              } ${dow === 6 && day.isCurrentMonth ? "text-blue-500" : ""} ${
                hasEvents ? "cursor-pointer" : ""
              }`}
              onMouseEnter={() => hasEvents && setActiveDate(day.dateStr)}
              onMouseLeave={() => setActiveDate((curr) => (curr === day.dateStr ? null : curr))}
              onClick={() =>
                hasEvents &&
                setActiveDate((curr) => (curr === day.dateStr ? null : day.dateStr))
              }
            >
              {day.isToday ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white">
                  {day.date}
                </span>
              ) : (
                day.date
              )}
              {hasEvents && (() => {
                // 절기 이벤트가 있으면 절기색 dot, 없으면 기존 골드
                const liturgicalEv = dayEvents.find((e) => e.liturgical);
                if (liturgicalEv?.liturgical) {
                  return (
                    <span
                      className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                      style={{ background: liturgicalEv.liturgical.colorStrong }}
                    />
                  );
                }
                return (
                  <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-church-gold" />
                );
              })()}
              {isActive && hasEvents && (
                <DayPopover
                  events={dayEvents}
                  dateStr={day.dateStr}
                  alignRight={alignRight}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
//  카드 + 페이지 컴포넌트
// ──────────────────────────────────────────────

function EventCard({ event }: { event: CalendarEvent }) {
  const isLiturgical = !!event.liturgical;
  return (
    <div
      className="group relative overflow-hidden rounded-xl p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: isLiturgical && event.liturgical
          ? event.liturgical.colorSoft
          : "#FFFFFF",
      }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{
          background: isLiturgical && event.liturgical
            ? event.liturgical.colorStrong
            : undefined,
        }}
      >
        {!isLiturgical && (
          <div className="h-full w-full rounded-l-xl bg-gradient-to-b from-church-gold to-amber-600" />
        )}
      </div>
      <div className="pl-3">
        <h3
          className="font-bold"
          style={{
            color: isLiturgical && event.liturgical
              ? event.liturgical.colorStrong
              : "#111827",
          }}
        >
          {event.title}
        </h3>
        {!isLiturgical && (
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              {event.isAllDay ? (
                <Calendar size={14} className="shrink-0 text-primary-500" />
              ) : (
                <Clock size={14} className="shrink-0 text-primary-500" />
              )}
              <span>{formatEventTimeRange(event)}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={14} className="shrink-0 text-primary-500" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        )}
        {isLiturgical && (
          <p className="mt-1 text-xs font-medium" style={{ color: event.liturgical?.colorStrong }}>
            교회 절기
          </p>
        )}
        {event.description && (
          <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-gray-500">
            {event.description}
          </p>
        )}
      </div>
    </div>
  );
}

function DateHeader({ dateStr }: { dateStr: string }) {
  const [, , d] = dateStr.split("-").map(Number);
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-sm font-bold text-primary-700">
        {d}
      </div>
      <span className="text-sm font-medium text-gray-500">
        {formatDateHeader(dateStr)}
      </span>
    </div>
  );
}

interface Props {
  events: CalendarEvent[];
  currentYear: number;
  currentMonth: number;
  nextYear: number;
  nextMonth: number;
}

export function CalendarView({
  events,
  currentYear,
  currentMonth,
  nextYear,
  nextMonth,
}: Props) {
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = eventDateKey(ev);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const grouped = useMemo(() => {
    return Array.from(eventsByDate.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, [eventsByDate]);

  return (
    <>
      {/* 월간 달력 */}
      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <MonthGrid
          year={currentYear}
          month={currentMonth}
          eventsByDate={eventsByDate}
        />
        <MonthGrid
          year={nextYear}
          month={nextMonth}
          eventsByDate={eventsByDate}
        />
      </div>

      {eventsByDate.size > 0 && (
        <p className="mb-8 flex items-center gap-2 text-sm text-gray-400">
          <span className="inline-block h-2 w-2 rounded-full bg-church-gold" />
          일정이 있는 날 (마우스/탭으로 미리보기)
        </p>
      )}

      <h2 className="mb-6 text-xl font-bold text-gray-900">다가오는 일정</h2>

      {grouped.length > 0 ? (
        grouped.map(([dateStr, dayEvents]) => (
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
          <p className="mt-3 text-gray-400">예정된 일정이 없습니다</p>
        </div>
      )}
    </>
  );
}
