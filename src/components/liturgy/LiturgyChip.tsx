import { getLiturgicalDay } from "@/lib/liturgical/season";
import { formatLiturgyLabel } from "@/lib/liturgical/format";

/** 절기 라벨 칩 — 헤더 아래·주보·관리자 가이드 등에서 재사용. RSC. */
export function LiturgyChip({
  className,
  showDot = true,
}: {
  className?: string;
  showDot?: boolean;
}) {
  const day = getLiturgicalDay();
  const label = formatLiturgyLabel(day);
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full bg-liturgy-soft px-2.5 py-0.5 text-xs font-medium text-liturgy-strong " +
        (className ?? "")
      }
      title={`${day.rangeStart} ~ ${day.rangeEnd}`}
    >
      {showDot && (
        <span className="h-1.5 w-1.5 rounded-full bg-liturgy" aria-hidden />
      )}
      {label}
    </span>
  );
}
