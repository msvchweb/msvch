import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Notice } from "@/types/notice";

export function RecentNotice({ notices }: { notices: Notice[] }) {
  return (
    <section className="bg-white px-4 py-16 sm:px-12 sm:py-[88px]">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-church-dark sm:text-4xl">
            공지사항
          </h2>
          <Link href="/notice" className="text-[13px] text-gray-500 hover:text-gray-700">
            전체보기 →
          </Link>
        </div>

        {notices.length > 0 ? (
          <ul className="border-t border-gray-200">
            {notices.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notice/${n.slug}`}
                  className="flex items-center justify-between gap-4 border-b border-gray-200 py-[22px] transition-colors hover:bg-gray-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {n.category === "긴급" && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                        <Bell size={10} /> 긴급
                      </span>
                    )}
                    {n.category === "행사" && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                        행사
                      </span>
                    )}
                    <span className="truncate text-base font-medium tracking-[-0.015em] text-church-dark">
                      {n.title}
                    </span>
                  </span>
                  {n.date && (
                    <span className="shrink-0 text-[13px] tabular-nums text-gray-500">
                      {formatDate(n.date)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-b border-gray-200 py-12 text-center text-gray-400">
            등록된 공지사항이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
