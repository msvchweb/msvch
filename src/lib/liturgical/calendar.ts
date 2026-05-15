import { easterSundayUtc } from "./easter";
import { SEASON_TO_TOKENS } from "./colors";
import { toKstYmd } from "./season";
import type { CalendarEvent } from "@/types/calendar";
import type { LiturgicalSeason } from "./types";

function lastSundayOfOctober(year: number): Date {
  const oct31 = new Date(Date.UTC(year, 9, 31));
  return new Date(oct31.getTime() - oct31.getUTCDay() * 86_400_000);
}

function advent1Date(year: number): Date {
  const dec25 = new Date(Date.UTC(year, 11, 25));
  const dow = dec25.getUTCDay();
  const offset = (dow === 0 ? 0 : dow) + 21;
  return new Date(dec25.getTime() - offset * 86_400_000);
}

interface SeasonEventSpec {
  date: Date;
  title: string;
  season: LiturgicalSeason;
}

export function getLiturgicalEventsForYear(year: number): CalendarEvent[] {
  const easter = easterSundayUtc(year);
  const D = (offset: number): Date =>
    new Date(easter.getTime() + offset * 86_400_000);

  const specs: SeasonEventSpec[] = [
    { date: new Date(Date.UTC(year, 0, 6)), title: "주현주일", season: "epiphany" },
    { date: D(-46), title: "재의 수요일 · 사순절 시작", season: "lent" },
    { date: D(-7),  title: "종려주일 · 성주간 시작",   season: "holy_week" },
    { date: D(-2),  title: "성금요일",                  season: "good_friday" },
    { date: D(0),   title: "부활주일",                  season: "easter" },
    { date: D(49),  title: "성령강림주일",              season: "pentecost" },
    { date: D(56),  title: "삼위일체주일",              season: "trinity" },
    { date: lastSundayOfOctober(year), title: "종교개혁주일", season: "reformation" },
    { date: advent1Date(year), title: "대림절 시작", season: "advent" },
    { date: new Date(Date.UTC(year, 11, 25)), title: "성탄절", season: "christmas" },
  ];

  return specs.map<CalendarEvent>((s) => {
    const c = SEASON_TO_TOKENS[s.season];
    return {
      id: `liturgy:${year}:${s.season}`,
      title: s.title,
      description: null,
      location: null,
      start: toKstYmd(s.date),
      end: null,
      isAllDay: true,
      recurrence: null,
      notify: false,
      liturgical: {
        season: s.season,
        colorSoft: c.soft,
        colorStrong: c.strong,
      },
    };
  });
}

/** YMD 범위 (포함)에 걸치는 가상 이벤트만 반환. 다년도 자동 조회. */
export function getLiturgicalEventsInRange(
  startYmd: string,
  endYmd: string,
): CalendarEvent[] {
  const startYear = Number(startYmd.slice(0, 4));
  const endYear = Number(endYmd.slice(0, 4));
  const items: CalendarEvent[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (const ev of getLiturgicalEventsForYear(y)) {
      if (ev.start >= startYmd && ev.start <= endYmd) items.push(ev);
    }
  }
  return items.sort((a, b) => a.start.localeCompare(b.start));
}
