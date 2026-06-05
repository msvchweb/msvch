"use client";

import { ProtectedView } from "./ProtectedView";

interface Props {
  images: string[];
  title: string;
}

/**
 * 이미지형 주보 — 업로드한 사진을 세로로 순서대로 그대로 표시한다 (마이그 040).
 *
 * 분기: BulletinWebView 가 weekly.photo_images.length > 0 이면 이 컴포넌트를 반환.
 * 외부(Storage public) URL 이라 next/image config 영향을 피하고자 일반 <img loading="lazy"> 사용.
 * CSP img-src 에 https://*.supabase.co 가 이미 허용되어 있다.
 *
 * 모바일(RN): photo_images: string[] 를 그대로 <Image source={{uri}} /> 로 소비 가능.
 */
export function WeeklyPhotoView({ images, title }: Props) {
  return (
    <ProtectedView>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={`${title} 사진 ${i + 1}`}
            loading="lazy"
            draggable={false}
            className="h-auto w-full rounded-lg border border-gray-200 bg-white shadow-sm"
          />
        ))}
      </div>
    </ProtectedView>
  );
}
