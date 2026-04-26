import Link from "next/link";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import type { CalendarEvent } from "@/types/calendar";

function formatShortDate(start: string, isAllDay: boolean): string {
  if (isAllDay) {
    const [, m, d] = start.split("-").map(Number);
    return `${m}/${d}`;
  }
  const dt = new Date(start);
  return dt.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
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
            <p className="mt-1 text-gray-500">
              교회 주요 행사를 확인하세요
            </p>
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
            <Link
              key={event.id}
              href="/calendar"
              className={`flex items-center justify-between px-6 py-4.5 transition-colors hover:bg-gray-50 ${
                idx !== events.length - 1
                  ? "border-b border-gray-50"
                  : ""
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
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
