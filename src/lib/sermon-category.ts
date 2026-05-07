/** 설교 영상 카테고리. SermonTabs UI 와 동기화. */
export type SermonCategory =
  | "sunday"
  | "wednesday"
  | "friday"
  | "dawn"
  | "praise"
  | "all";

/** 영상 제목으로 카테고리 추정. 일치하는 키워드 없으면 "all". */
export function categorizeSermon(title: string): SermonCategory {
  if (/주일/.test(title)) return "sunday";
  if (/수요/.test(title)) return "wednesday";
  if (/금요/.test(title)) return "friday";
  if (/새벽/.test(title)) return "dawn";
  if (/찬양/.test(title)) return "praise";
  return "all";
}
