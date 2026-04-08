import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { getGalleryAlbums } from "@/lib/gallery";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "갤러리" };
export const revalidate = 3600;

type SearchParams = Promise<{ category?: string; sub?: string }>;

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { category, sub } = await searchParams;
  const albums = await getGalleryAlbums();

  return (
    <>
      <PageHeader title="비전갤러리" description="교회 활동 사진을 확인하세요" />
      <Container>
        <GalleryGrid
          albums={albums}
          initialCategory={category}
          initialSub={sub}
        />
      </Container>
    </>
  );
}
