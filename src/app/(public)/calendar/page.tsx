import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUpcomingEvents } from "@/lib/google-calendar";
import { Calendar, Clock, MapPin, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import type { CalendarEvent } from "@/types/calendar";

export const metadata: Metadata = { title: "교회 일정" };
export const revalidate = 600;

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
function groupByDate(
  events: CalendarEvent[],
): [string, CalendarEvent[]][] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.isAllDay
      ? event.start
      : event.start.split("T")[0];
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  return Array.from(groups.entries());
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
              <Calendar
                size={14}
                className="shrink-0 text-primary-500"
              />
              <span>종일</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin
                size={14}
                className="shrink-0 text-primary-500"
              />
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
            <div className="py-20 text-center">
              <Calendar size={48} className="mx-auto text-gray-300" />
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
