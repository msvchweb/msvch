export type LiturgicalSeason =
  | "advent"
  | "christmas"
  | "epiphany"
  | "ordinary_after_epiphany"
  | "lent"
  | "holy_week"
  | "good_friday"
  | "easter"
  | "pentecost"
  | "trinity"
  | "ordinary_after_pentecost"
  | "reformation";

export interface LiturgicalDay {
  season: LiturgicalSeason;
  /** 한국어 절기 이름 (예: "사순절", "성령강림 후 평주일") */
  ko: string;
  /** N주차. 단일일 절기·평주일은 null */
  week: number | null;
  /** 이번 절기의 시작·끝 (KST YMD) */
  rangeStart: string;
  rangeEnd: string;
}

export interface LiturgicalColorTokens {
  base: string;
  soft: string;
  strong: string;
  onBase: string;
}
