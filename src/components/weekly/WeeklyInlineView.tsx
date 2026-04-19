import { BookOpen, Heart, Bell } from "lucide-react";
import type { Weekly } from "@/types/notice";

interface Props {
  weekly: Weekly;
}

export function WeeklyInlineView({ weekly: w }: Props) {
  const hasPrayers = w.prayer_items && w.prayer_items.length > 0;
  const hasNotices = w.announcements && w.announcements.length > 0;

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
      {/* 설교 정보 */}
      {(w.sermon_title || w.scripture) && (
        <div className="flex items-start gap-3">
          <BookOpen size={16} className="mt-0.5 shrink-0 text-primary-400" />
          <div>
            {w.sermon_title && (
              <p className="font-medium text-gray-900">
                &ldquo;{w.sermon_title}&rdquo;
                {w.sermon_pastor && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {w.sermon_pastor} 목사
                  </span>
                )}
              </p>
            )}
            {w.scripture && (
              <p className="mt-0.5 text-sm text-gray-500">{w.scripture}</p>
            )}
          </div>
        </div>
      )}

      {/* 입술말씀 */}
      {w.weekly_verse && (
        <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-primary-600">
            이번 주 입술말씀
          </p>
          <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
            {w.weekly_verse}
          </p>
        </div>
      )}

      {/* 기도제목 */}
      {hasPrayers && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Heart size={14} className="text-primary-400" />
            <p className="text-xs font-semibold text-gray-600">
              교회공동체 기도제목
            </p>
          </div>
          <ol className="space-y-1 pl-1">
            {w.prayer_items.map((p, i) => (
              <li key={i} className="text-sm text-gray-600">
                <span className="mr-1 font-medium text-primary-500">
                  {i + 1}.
                </span>
                {p.text}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 공지사항 */}
      {hasNotices && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Bell size={14} className="text-primary-400" />
            <p className="text-xs font-semibold text-gray-600">공지사항</p>
          </div>
          <ol className="space-y-1 pl-1">
            {w.announcements.map((a, i) => (
              <li key={i} className="text-sm text-gray-600">
                <span className="mr-1 font-medium text-primary-500">
                  {i + 1}.
                </span>
                {a.text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
