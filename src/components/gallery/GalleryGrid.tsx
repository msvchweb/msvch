"use client";

import { useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { GalleryAlbum } from "@/types/notion";

const categories = [
  "전체",
  "예배",
  "교회학교",
  "교회행사",
  "봉사센터",
  "새가족",
];

export function GalleryGrid({ albums }: { albums: GalleryAlbum[] }) {
  const [filter, setFilter] = useState("전체");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  const filtered =
    filter === "전체"
      ? albums
      : albums.filter((a) => a.category === filter);

  function openAlbum(images: string[]) {
    setLightboxImages(images);
    setLightboxOpen(true);
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((album) => (
          <button
            key={album.id}
            onClick={() => openAlbum(album.images)}
            className="group overflow-hidden rounded-xl border border-gray-200 text-left shadow-sm transition hover:shadow-md"
          >
            <div className="relative aspect-[4/3] bg-gray-100">
              {album.thumbnail ? (
                <Image
                  src={album.thumbnail}
                  alt={album.title}
                  fill
                  className="object-cover transition group-hover:scale-105"
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
        ))}
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
