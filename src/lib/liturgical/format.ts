import type { LiturgicalDay } from "./types";

/** "사순 4주", "부활 2주", "성탄절", "평주일" 등 표시 라벨 */
export function formatLiturgyLabel(day: LiturgicalDay): string {
  if (day.week === null) return day.ko;
  if (day.season.startsWith("ordinary_")) return day.ko;
  const short = day.ko.replace(/절$/, "");
  return `${short} ${day.week}주`;
}
