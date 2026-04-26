import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUpcomingEvents } from "@/lib/events";
import { CalendarView } from "./CalendarView";
import type { Metadata } from "next";
import type { CalendarEvent } from "@/types/calendar";

export const metadata: Metadata = { title: "교회 일정" };
export const dynamic = "force-dynamic";

function eventDateKey(event: CalendarEvent): string {
  return event.isAllDay ? event.start : event.start.split("T")[0];
}

export default async function CalendarPage() {
  // 다가오는 90일 + 최대 50건
  const events = await getUpcomingEvents(50, 90);

  // KST 기준 현재 / 다음 달
  const nowKST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const currentYear = nowKST.getFullYear();
  const currentMonth = nowKST.getMonth();
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  // 달력에 표시되는 2개월 범위 필터
  const rangeStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
  const rangeEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(lastDayOfNextMonth).padStart(2, "0")}`;

  const rangeEvents = events.filter((e) => {
    const key = eventDateKey(e);
    return key >= rangeStart && key <= rangeEnd;
  });

  return (
    <>
      <PageHeader
        title="교회 일정"
        description="명성비전교회 주요 일정을 확인하세요"
      />
      <Container>
        <div className="mx-auto max-w-3xl">
          <CalendarView
            events={rangeEvents}
            currentYear={currentYear}
            currentMonth={currentMonth}
            nextYear={nextYear}
            nextMonth={nextMonth}
          />
        </div>
      </Container>
    </>
  );
}
