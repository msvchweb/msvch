import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { getGalleryAlbums } from "@/lib/notion";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "갤러리" };
export const revalidate = 3600;

export default async function GalleryPage() {
  const albums = await getGalleryAlbums();

  return (
    <>
      <PageHeader title="갤러리" description="교회 활동 사진을 확인하세요" />
      <Container>
        <GalleryGrid albums={albums} />
      </Container>
    </>
  );
}
