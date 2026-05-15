import { easterSundayUtc } from "./easter";
import type { LiturgicalDay, LiturgicalSeason } from "./types";

/** UTC Date → KST 기준 YYYY-MM-DD */
export function toKstYmd(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function addDaysUtc(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function christmasSundayOrEarlier(year: number): Date {
  const xmas = new Date(Date.UTC(year, 11, 25));
  const dow = xmas.getUTCDay();
  const offsetBack = dow === 0 ? 0 : dow;
  return addDaysUtc(xmas, -offsetBack);
}

function lastSundayOfOctober(year: number): Date {
  const oct31 = new Date(Date.UTC(year, 9, 31));
  return addDaysUtc(oct31, -oct31.getUTCDay());
}

interface YearKeyDates {
  easter: Date;
  ashWednesday: Date;
  palmSunday: Date;
  goodFriday: Date;
  pentecost: Date;
  trinity: Date;
  advent1: Date;
  reformationSun: Date;
  epiphany: Date;
  baptismOfLord: Date;
}

function computeKeyDates(year: number): YearKeyDates {
  const easter = easterSundayUtc(year);
  const advent1 = addDaysUtc(christmasSundayOrEarlier(year), -21);
  const epiphany = new Date(Date.UTC(year, 0, 6));
  const dow = epiphany.getUTCDay();
  const baptismOfLord = dow === 0 ? epiphany : addDaysUtc(epiphany, 7 - dow);
  return {
    easter,
    ashWednesday: addDaysUtc(easter, -46),
    palmSunday: addDaysUtc(easter, -7),
    goodFriday: addDaysUtc(easter, -2),
    pentecost: addDaysUtc(easter, 49),
    trinity: addDaysUtc(easter, 56),
    advent1,
    reformationSun: lastSundayOfOctober(year),
    epiphany,
    baptismOfLord,
  };
}

function inRange(ymd: string, a: Date, b: Date): boolean {
  return ymd >= toKstYmd(a) && ymd <= toKstYmd(b);
}

function weeksBetween(target: string, anchor: Date): number {
  const t = new Date(target + "T00:00:00Z").getTime();
  return Math.floor((t - anchor.getTime()) / (7 * 86_400_000)) + 1;
}

export function getLiturgicalDay(now: Date = new Date()): LiturgicalDay {
  const ymd = toKstYmd(now);
  const year = Number(ymd.slice(0, 4));
  const k = computeKeyDates(year);

  if (ymd === toKstYmd(k.goodFriday)) {
    return mk("good_friday", "성금요일", null, k.goodFriday, k.goodFriday);
  }

  if (inRange(ymd, k.palmSunday, addDaysUtc(k.easter, -1))) {
    return mk("holy_week", "성주간", null, k.palmSunday, addDaysUtc(k.easter, -1));
  }

  if (inRange(ymd, k.ashWednesday, addDaysUtc(k.palmSunday, -1))) {
    return mk(
      "lent",
      "사순절",
      weeksBetween(ymd, k.ashWednesday),
      k.ashWednesday,
      addDaysUtc(k.palmSunday, -1),
    );
  }

  if (inRange(ymd, k.easter, addDaysUtc(k.pentecost, -1))) {
    return mk(
      "easter",
      "부활절",
      weeksBetween(ymd, k.easter),
      k.easter,
      addDaysUtc(k.pentecost, -1),
    );
  }

  if (ymd === toKstYmd(k.pentecost)) {
    return mk("pentecost", "성령강림주일", null, k.pentecost, k.pentecost);
  }

  if (ymd === toKstYmd(k.trinity)) {
    return mk("trinity", "삼위일체주일", null, k.trinity, k.trinity);
  }

  if (ymd === toKstYmd(k.reformationSun)) {
    return mk("reformation", "종교개혁주일", null, k.reformationSun, k.reformationSun);
  }

  const xmasEve = new Date(Date.UTC(year, 11, 24));
  if (inRange(ymd, k.advent1, xmasEve)) {
    return mk(
      "advent",
      "대림절",
      weeksBetween(ymd, k.advent1),
      k.advent1,
      xmasEve,
    );
  }

  const xmasDay = new Date(Date.UTC(year, 11, 25));
  const epiphanyEveNextYr = new Date(Date.UTC(year + 1, 0, 5));
  if (inRange(ymd, xmasDay, epiphanyEveNextYr)) {
    return mk("christmas", "성탄절", null, xmasDay, epiphanyEveNextYr);
  }

  const prevXmasDay = new Date(Date.UTC(year - 1, 11, 25));
  const thisEpiphanyEve = new Date(Date.UTC(year, 0, 5));
  if (inRange(ymd, prevXmasDay, thisEpiphanyEve)) {
    return mk("christmas", "성탄절", null, prevXmasDay, thisEpiphanyEve);
  }

  if (inRange(ymd, k.epiphany, k.baptismOfLord)) {
    return mk("epiphany", "주현주일", null, k.epiphany, k.baptismOfLord);
  }

  if (inRange(ymd, addDaysUtc(k.baptismOfLord, 1), addDaysUtc(k.ashWednesday, -1))) {
    return mk(
      "ordinary_after_epiphany",
      "주현절 후 평주일",
      null,
      addDaysUtc(k.baptismOfLord, 1),
      addDaysUtc(k.ashWednesday, -1),
    );
  }

  if (inRange(ymd, addDaysUtc(k.trinity, 1), addDaysUtc(k.advent1, -1))) {
    return mk(
      "ordinary_after_pentecost",
      "성령강림 후 평주일",
      null,
      addDaysUtc(k.trinity, 1),
      addDaysUtc(k.advent1, -1),
    );
  }

  return mk(
    "ordinary_after_pentecost",
    "평주일",
    null,
    new Date(Date.UTC(year, 0, 1)),
    new Date(Date.UTC(year, 11, 31)),
  );
}

function mk(
  season: LiturgicalSeason,
  ko: string,
  week: number | null,
  start: Date,
  end: Date,
): LiturgicalDay {
  return { season, ko, week, rangeStart: toKstYmd(start), rangeEnd: toKstYmd(end) };
}

const ORDINARY: LiturgicalSeason[] = [
  "ordinary_after_epiphany",
  "ordinary_after_pentecost",
];

export function isOrdinary(season: LiturgicalSeason): boolean {
  return ORDINARY.includes(season);
}
