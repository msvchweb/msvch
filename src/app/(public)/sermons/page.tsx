import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSermonVideos } from "@/lib/youtube";
import { formatDateKorean } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "설교 영상" };
export const revalidate = 3600;

export default async function SermonsPage() {
  const videos = await getSermonVideos();

  return (
    <>
      <PageHeader
        title="설교 영상"
        description="예배 설교를 다시 보실 수 있습니다"
      />
      <Container>
        {videos.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <Link
                key={video.videoId}
                href={`/sermons/${video.videoId}`}
                className="group overflow-hidden rounded-xl border border-gray-200 shadow-sm transition hover:shadow-md"
              >
                <div className="relative aspect-video">
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                    <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium">
                      ▶ 재생
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4">
                  <h3 className="line-clamp-2 font-medium text-gray-900">
                    {video.title}
                  </h3>
                  <time className="mt-2 block text-sm text-gray-400">
                    {formatDateKorean(video.publishedAt)}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <p>설교 영상이 준비 중입니다.</p>
            <p className="mt-2 text-sm">
              YouTube 채널 연동 후 자동으로 표시됩니다.
            </p>
          </div>
        )}
      </Container>
    </>
  );
}
