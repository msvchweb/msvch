import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getUpcomingEvents } from "@/lib/events";
import { getLiturgicalEventsInRange } from "@/lib/liturgical/calendar";
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

  // 같은 범위의 절기 가상 이벤트(부활/성탄/대림 등) 합치기. KST 기준.
  const liturgyEvents = getLiturgicalEventsInRange(rangeStart, rangeEnd);

  const merged: CalendarEvent[] = [...rangeEvents, ...liturgyEvents].sort(
    (a, b) => {
      const ak = eventDateKey(a);
      const bk = eventDateKey(b);
      if (ak !== bk) return ak.localeCompare(bk);
      // 같은 날짜에 절기 이벤트를 위로
      const aLi = a.liturgical ? 0 : 1;
      const bLi = b.liturgical ? 0 : 1;
      return aLi - bLi;
    },
  );

  return (
    <>
      <PageHeader
        title="교회 일정"
        description="명성비전교회 주요 일정을 확인하세요"
      />
      <Container>
        <div className="mx-auto max-w-3xl">
          <CalendarView
            events={merged}
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
