import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { SermonTabs } from "@/components/SermonTabs";
import { getSermonVideos } from "@/lib/sermons";
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
          <SermonTabs videos={videos} />
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
