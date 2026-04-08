"use client";

import { useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { GalleryAlbum } from "@/types/gallery";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

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

  function handleCategoryChange(cat: string) {
    setFilter(cat);
    setSubFilter("전체");
  }

  function openAlbum(images: string[]) {
    setLightboxImages(images);
    setLightboxOpen(true);
  }

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
              onClick={() => setSubFilter(sub)}
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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((album) => {
          const imageUrls = album.images.map((img) => img.image_url);
          const thumb = album.thumbnail_url || imageUrls[0];

          return (
            <button
              key={album.id}
              onClick={() => openAlbum(imageUrls)}
              className="group overflow-hidden rounded-2xl border border-gray-100 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] bg-gray-100">
                {thumb ? (
                  <Image
                    src={thumb}
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
              </div>
              <div className="bg-white p-4">
                <h3 className="font-semibold text-gray-900">{album.title}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {album.date} &middot; {album.images.length}장
                </p>
              </div>
            </button>
          );
        })}
      </div>

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
