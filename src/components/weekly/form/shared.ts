export const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400";
export const inputErrCls =
  "w-full rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400";
export const textareaCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 resize-y";

export function weekOfMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const week = Math.ceil(d.getDate() / 7);
  return ["첫째", "둘째", "셋째", "넷째", "다섯째"][week - 1] ?? `${week}째`;
}

/**
 * "1. 제목" / "10.  제목" 처럼 머리글 번호를 떼어낸다.
 * 점 없는 "1 제목" 은 번호로 보지 않고 그대로 둔다(파괴 방지).
 */
export function stripLeadingNumber(title: string): string {
  return title.replace(/^\s*\d+\.\s*/, "");
}
