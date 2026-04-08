"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { GalleryAlbum, GalleryImage } from "@/types/gallery";

const PAGE_SIZE = 20;

const categories = [
  "전체",
  "예배",
  "교회학교",
  "교회행사",
  "봉사센터",
  "새가족",
];

const subCategories: Record<string, string[]> = {
  교회학교: ["전체", "영유치부", "아동부", "청소년부", "청년부"],
  봉사센터: ["전체", "반찬", "이미용", "비전문화", "탁구"],
};

interface GalleryGridProps {
  albums: GalleryAlbum[];
  initialCategory?: string;
  initialSub?: string;
}

export function GalleryGrid({ albums, initialCategory, initialSub }: GalleryGridProps) {
  const [filter, setFilter] = useState(initialCategory || "전체");
  const [subFilter, setSubFilter] = useState(initialSub || "전체");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);

  const hasSubCategories = filter in subCategories;

  const filtered = albums.filter((a) => {
    if (filter === "전체") return true;
    const matchCategory = a.tags.includes(filter) || a.category === filter;
    if (!matchCategory) return false;
    if (hasSubCategories && subFilter !== "전체") {
      return a.tags.includes(subFilter);
    }
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function handleCategoryChange(cat: string) {
    setFilter(cat);
    setSubFilter("전체");
    setVisibleCount(PAGE_SIZE);
  }

  function handleSubChange(sub: string) {
    setSubFilter(sub);
    setVisibleCount(PAGE_SIZE);
  }

  const openAlbum = useCallback(async (album: GalleryAlbum) => {
    // 썸네일만 있는 경우 API에서 이미지 로드
    if (album.images.length > 0) {
      setLightboxImages(album.images.map((img) => img.image_url));
      setLightboxOpen(true);
      return;
    }

    setLoadingAlbumId(album.id);
    try {
      const res = await fetch(`/api/gallery/${album.id}/images`);
      if (!res.ok) throw new Error("fetch failed");
      const images: GalleryImage[] = await res.json();
      const urls = images.map((img) => img.image_url);
      if (urls.length > 0) {
        setLightboxImages(urls);
        setLightboxOpen(true);
      }
    } catch {
      // 실패 시 썸네일이라도 표시
      if (album.thumbnail_url) {
        setLightboxImages([album.thumbnail_url]);
        setLightboxOpen(true);
      }
    } finally {
      setLoadingAlbumId(null);
    }
  }, []);

  return (
    <>
      {/* 1차 카테고리 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === cat
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 2차 하위부서 */}
      {hasSubCategories && (
        <div className="mb-8 flex flex-wrap gap-2">
          {subCategories[filter].map((sub) => (
            <button
              key={sub}
              onClick={() => handleSubChange(sub)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                subFilter === sub
                  ? "bg-gray-900 text-white"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* 앨범 그리드 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((album) => {
          const isLoading = loadingAlbumId === album.id;

          return (
            <button
              key={album.id}
              onClick={() => openAlbum(album)}
              disabled={isLoading}
              className="group overflow-hidden rounded-2xl border border-gray-100 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-70"
            >
              <div className="relative aspect-[4/3] bg-gray-100">
                {album.thumbnail_url ? (
                  <Image
                    src={album.thumbnail_url}
                    alt={album.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    사진 없음
                  </div>
                )}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  </div>
                )}
              </div>
              <div className="bg-white p-4">
                <h3 className="font-semibold text-gray-900">{album.title}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {album.date}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 더보기 */}
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-900"
          >
            더보기 ({filtered.length - visibleCount}개 남음)
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="py-12 text-center text-gray-400">
          해당 카테고리에 앨범이 없습니다.
        </p>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages.map((src) => ({ src }))}
      />
    </>
  );
}
