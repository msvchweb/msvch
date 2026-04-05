import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getNotices } from "@/lib/notices";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "공지사항" };
export const revalidate = 3600;

export default async function NoticePage() {
  const notices = await getNotices();

  return (
    <>
      <PageHeader title="공지사항" />
      <Container>
        <div className="mx-auto max-w-3xl divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
          {notices.length > 0 ? (
            notices.map((notice) => (
              <Link
                key={notice.id}
                href={`/notice/${notice.slug}`}
                className="flex items-center justify-between px-6 py-4 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {notice.category && notice.category !== "일반" && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        notice.category === "긴급"
                          ? "bg-red-50 text-red-600"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {notice.category}
                    </span>
                  )}
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
            <p className="px-6 py-12 text-center text-gray-400">
              등록된 공지사항이 없습니다.
            </p>
          )}
        </div>
      </Container>
    </>
  );
}
