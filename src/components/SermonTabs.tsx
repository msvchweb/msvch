"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDateKorean } from "@/lib/utils";
import type { SermonVideo } from "@/types/youtube";

const TABS = [
  { key: "all", label: "전체" },
  { key: "sunday", label: "주일" },
  { key: "wednesday", label: "수요" },
  { key: "friday", label: "금요" },
  { key: "dawn", label: "새벽" },
  { key: "praise", label: "찬양" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function categorize(title: string): TabKey {
  if (/주일/.test(title)) return "sunday";
  if (/수요/.test(title)) return "wednesday";
  if (/금요/.test(title)) return "friday";
  if (/새벽/.test(title)) return "dawn";
  if (/찬양/.test(title)) return "praise";
  return "all";
}

export function SermonTabs({ videos }: { videos: SermonVideo[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("sunday");

  const filtered =
    activeTab === "all"
      ? videos
      : videos.filter((v) => categorize(v.title) === activeTab);

  return (
    <>
      <div className="mb-8 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video) => (
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
                  unoptimized
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
          <p>해당 카테고리의 영상이 없습니다.</p>
        </div>
      )}
    </>
  );
}
