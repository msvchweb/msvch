import { Container } from "@/components/ui/Container";
import { BlogContent } from "@/components/ui/BlogContent";
import { getNoticeBySlug } from "@/lib/notices";
import { notFound } from "next/navigation";
import Link from "next/link";
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

        <article className="prose max-w-none">
          <BlogContent content={notice.content} title={notice.title} />
        </article>
      </div>
    </Container>
  );
}
