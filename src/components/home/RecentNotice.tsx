import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ArrowRight, Bell } from "lucide-react";
import type { NoticeItem } from "@/types/notion";

export function RecentNotice({ notices }: { notices: NoticeItem[] }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              공지사항
            </h2>
            <p className="mt-1 text-gray-500">교회 소식을 확인하세요</p>
          </div>
          <Link
            href="/notice"
            className="group flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            전체보기
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {notices.length > 0 ? (
            notices.map((notice, idx) => (
              <Link
                key={notice.id}
                href={`/notice/${notice.slug}`}
                className={`flex items-center justify-between px-6 py-4.5 transition-colors hover:bg-gray-50 ${
                  idx !== notices.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {notice.category === "긴급" ? (
                    <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                      <Bell size={10} />
                      긴급
                    </span>
                  ) : notice.category ? (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                      {notice.category}
                    </span>
                  ) : null}
                  <span className="font-medium text-gray-800">
                    {notice.title}
                  </span>
                </div>
                {notice.date && (
                  <time className="shrink-0 text-sm tabular-nums text-gray-400">
                    {formatDate(notice.date)}
                  </time>
                )}
              </Link>
            ))
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="text-gray-400">공지사항이 준비 중입니다.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
