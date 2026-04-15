import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "교회학교 소식",
};

export const revalidate = 3600;

interface Post {
  id: string;
  slug: string;
  title: string;
  content: string;
  images: string[];
  naver_url: string;
  published_at: string;
}

export default async function ChurchschoolNewsPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("churchschool_posts")
    .select("*")
    .order("published_at", { ascending: false });

  const items = (posts ?? []) as Post[];

  return (
    <>
      <PageHeader title="교회학교 소식" description="교회학교의 소식을 전합니다" />
      <Container>
        <div className="mx-auto max-w-3xl">
          {items.length === 0 ? (
            <p className="py-20 text-center text-sm text-gray-400">등록된 소식이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((post) => (
                <li key={post.id}>
                  <a
                    href={post.naver_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-4 py-5 transition hover:bg-gray-50 -mx-4 px-4 rounded-lg"
                  >
                    {post.images?.[0] && (
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <Image
                          src={post.images[0]}
                          alt={post.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
                        {post.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                        {post.content.slice(0, 100)}
                      </p>
                      <time className="mt-1 block text-xs text-gray-400">
                        {formatDistanceToNow(new Date(post.published_at), {
                          addSuffix: true,
                          locale: ko,
                        })}
                      </time>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 text-center">
            <a
              href={`https://blog.naver.com/${encodeURIComponent("msvch01")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition hover:border-primary-300 hover:text-primary-600"
            >
              네이버 블로그 바로가기
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          </div>
        </div>
      </Container>
    </>
  );
}
