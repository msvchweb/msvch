import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { NoticeItem } from "@/types/notion";

export function RecentNotice({ notices }: { notices: NoticeItem[] }) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">공지사항</h2>
          <Link
            href="/notice"
            className="text-sm text-primary-600 hover:underline"
          >
            전체보기 &rarr;
          </Link>
        </div>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {notices.length > 0 ? (
            notices.map((notice) => (
              <Link
                key={notice.id}
                href={`/notice/${notice.slug}`}
                className="flex items-center justify-between px-6 py-4 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {notice.category === "긴급" && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      긴급
                    </span>
                  )}
                  <span className="font-medium text-gray-800">
                    {notice.title}
                  </span>
                </div>
                {notice.date && (
                  <time className="shrink-0 text-sm text-gray-400">
                    {formatDate(notice.date)}
                  </time>
                )}
              </Link>
            ))
          ) : (
            <p className="px-6 py-8 text-center text-gray-400">
              공지사항이 준비 중입니다.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
