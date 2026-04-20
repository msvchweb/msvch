import type { Weekly } from "@/types/notice";

export default function BulletinFront({ weekly }: { weekly: Weekly }) {
  const dateStr = weekly.date
    ? (() => {
        const d = new Date(weekly.date + "T00:00:00");
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
      })()
    : "";

  return (
    <div className="bulletin-front bg-white text-gray-800 p-8">
      {/* TODO: 앞면 디자인 미정 — 기본 플레이스홀더 */}
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-sm text-gray-400 mb-2">명성비전교회</div>
        <h1 className="text-3xl font-bold mb-2">{weekly.title}</h1>
        {dateStr && <div className="text-sm text-gray-500 mb-6">{dateStr}</div>}
        {weekly.volume && weekly.issue && (
          <div className="text-xs text-gray-400">
            제 {weekly.volume}권 {weekly.issue}호
          </div>
        )}
        {weekly.sermon_title && (
          <div className="mt-10 text-center">
            <div className="text-xs text-gray-400 mb-1">이번 주 설교</div>
            <div className="text-lg font-semibold">{weekly.sermon_title}</div>
            {weekly.sermon_pastor && (
              <div className="text-sm text-gray-500 mt-1">{weekly.sermon_pastor}</div>
            )}
          </div>
        )}
        <div className="mt-auto text-[10px] text-gray-300 pt-16">
          앞면 디자인은 추후 작업 예정
        </div>
      </div>
    </div>
  );
}
