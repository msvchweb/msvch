import type { LiturgicalColorTokens, LiturgicalSeason } from "./types";

export const SEASON_TO_TOKENS: Record<LiturgicalSeason, LiturgicalColorTokens> = {
  advent:    { base: "#5C2E91", soft: "#EEE5F7", strong: "#3F1F66", onBase: "#FFFFFF" },
  lent:      { base: "#5C2E91", soft: "#EEE5F7", strong: "#3F1F66", onBase: "#FFFFFF" },
  holy_week: { base: "#5C2E91", soft: "#EEE5F7", strong: "#3F1F66", onBase: "#FFFFFF" },
  good_friday: { base: "#1A1A1A", soft: "#E5E5E5", strong: "#000000", onBase: "#FFFFFF" },
  christmas: { base: "#C9A84C", soft: "#F5EDDA", strong: "#8E7325", onBase: "#1A1A1A" },
  epiphany:  { base: "#C9A84C", soft: "#F5EDDA", strong: "#8E7325", onBase: "#1A1A1A" },
  easter:    { base: "#C9A84C", soft: "#F5EDDA", strong: "#8E7325", onBase: "#1A1A1A" },
  trinity:   { base: "#C9A84C", soft: "#F5EDDA", strong: "#8E7325", onBase: "#1A1A1A" },
  pentecost:   { base: "#B91C1C", soft: "#FCE7E7", strong: "#7F1D1D", onBase: "#FFFFFF" },
  reformation: { base: "#B91C1C", soft: "#FCE7E7", strong: "#7F1D1D", onBase: "#FFFFFF" },
  ordinary_after_epiphany:  { base: "#2E7D32", soft: "#E3F1E4", strong: "#1B5E20", onBase: "#FFFFFF" },
  ordinary_after_pentecost: { base: "#2E7D32", soft: "#E3F1E4", strong: "#1B5E20", onBase: "#FFFFFF" },
};

/** 결정 #4: 평주일에는 브랜드 액센트로 church-gold 사용 */
const CHURCH_GOLD = { base: "#C9A84C", soft: "#F5EDDA", strong: "#8E7325" };

export function brandTokens(
  season: LiturgicalSeason,
): { base: string; soft: string; strong: string } {
  if (season === "ordinary_after_epiphany" || season === "ordinary_after_pentecost") {
    return CHURCH_GOLD;
  }
  const t = SEASON_TO_TOKENS[season];
  return { base: t.base, soft: t.soft, strong: t.strong };
}
