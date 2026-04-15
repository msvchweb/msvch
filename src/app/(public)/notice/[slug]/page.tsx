import { Container } from "@/components/ui/Container";
import { getNoticeBySlug } from "@/lib/notices";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const notice = await getNoticeBySlug(slug);
  return notice ? { title: notice.title } : {};
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const notice = await getNoticeBySlug(slug);
  if (!notice) notFound();

  return (
    <Container>
      <div className="mx-auto max-w-3xl">
        <Link
          href="/notice"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} /> 목록으로
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">{notice.title}</h1>
        {notice.date && (
          <p className="mt-2 text-sm text-gray-400">{formatDate(notice.date)}</p>
        )}

        <hr className="my-6 border-gray-200" />

        <article className="prose max-w-none whitespace-pre-line text-gray-700">
          {notice.content}
        </article>

        {notice.images && notice.images.length > 0 && (
          <div className="mt-8 space-y-4">
            {notice.images.map((url, i) => (
              <div key={i} className="relative w-full overflow-hidden rounded-xl">
                <Image
                  src={url}
                  alt={`${notice.title} 이미지 ${i + 1}`}
                  width={800}
                  height={600}
                  className="h-auto w-full object-contain"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
