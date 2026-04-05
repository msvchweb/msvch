import { Container } from "@/components/ui/Container";
import { getSermonVideos } from "@/lib/youtube";
import { formatDateKorean } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const videos = await getSermonVideos();
  const video = videos.find((v) => v.videoId === id);
  return video ? { title: video.title } : { title: "설교 영상" };
}

export default async function SermonDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const videos = await getSermonVideos();
  const video = videos.find((v) => v.videoId === id);

  return (
    <Container>
      <div className="mx-auto max-w-4xl">
        <Link
          href="/sermons"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} /> 목록으로
        </Link>

        <div className="aspect-video overflow-hidden rounded-xl shadow-lg">
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            title={video?.title ?? "설교 영상"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>

        {video && (
          <>
            <h1 className="mt-6 text-2xl font-bold text-gray-900">
              {video.title}
            </h1>
            <p className="mt-2 text-gray-400">
              {formatDateKorean(video.publishedAt)}
            </p>
            {video.description && (
              <p className="mt-4 whitespace-pre-line text-gray-600">
                {video.description}
              </p>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
